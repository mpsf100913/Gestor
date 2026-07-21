// ============================================
// AUTENTICAÇÃO SIMPLES (PIN)
// ============================================
if (sessionStorage.getItem('admin_auth') !== 'ok') {
  window.location.href = 'index.html';
}

document.getElementById('btnSair').addEventListener('click', () => {
  sessionStorage.removeItem('admin_auth');
  window.location.href = 'index.html';
});

// ============================================
// ESTADO
// ============================================
let clientes = {}; // { id: {nome, whatsapp, email, servidor, valorPlano, vencimento, fcmToken, status...} }

// ============================================
// HELPERS DE STATUS
// ============================================
function calcularDiasRestantes(vencimentoStr) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const vencimento = new Date(vencimentoStr + 'T00:00:00');
  const diffMs = vencimento - hoje;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function statusCliente(vencimentoStr) {
  const dias = calcularDiasRestantes(vencimentoStr);
  if (dias < 0) return 'vencido';
  if (dias <= 3) return 'vencendo';
  return 'ativo';
}

function badgeHtml(status) {
  const map = {
    ativo:    { classe: 'ok',     texto: 'Ativo' },
    vencendo: { classe: 'warn',   texto: 'Vencendo' },
    vencido:  { classe: 'danger', texto: 'Vencido' }
  };
  const s = map[status] || map.ativo;
  return `<span class="badge ${s.classe}">${s.texto}</span>`;
}

function formatarData(vencimentoStr) {
  const [ano, mes, dia] = vencimentoStr.split('-');
  return `${dia}/${mes}/${ano}`;
}

function formatarValor(valor) {
  const n = parseFloat(valor);
  return isNaN(n) ? valor : `R$ ${n.toFixed(2).replace('.', ',')}`;
}

// ============================================
// FIREBASE REST — CRUD (sempre via PATCH)
// ============================================
async function carregarClientes() {
  try {
    const res = await fetch(`${DB_URL}/clientes.json`);
    const data = await res.json();
    clientes = data || {};
    renderizarTudo();
  } catch (err) {
    mostrarToast('Erro ao carregar clientes. Verifique a configuração do Firebase.', true);
    console.error(err);
  }
}

async function salvarClienteFirebase(id, dadosCliente) {
  const res = await fetch(`${DB_URL}/clientes/${id}.json`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dadosCliente)
  });
  if (!res.ok) throw new Error('Falha ao salvar no Firebase');
  return res.json();
}

async function excluirClienteFirebase(id) {
  const res = await fetch(`${DB_URL}/clientes/${id}.json`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Falha ao excluir no Firebase');
}

function gerarId() {
  return 'cli_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

// ============================================
// RENDERIZAÇÃO
// ============================================
function renderizarTudo() {
  atualizarFiltroServidores();
  renderizarTabela();
  renderizarResumo();
}

function atualizarFiltroServidores() {
  const select = document.getElementById('filtroServidor');
  const atual = select.value;
  const servidores = [...new Set(Object.values(clientes).map(c => c.servidor).filter(Boolean))];
  select.innerHTML = '<option value="">Todos os servidores</option>' +
    servidores.map(s => `<option value="${s}">${s}</option>`).join('');
  select.value = atual;
}

function renderizarTabela() {
  const busca = document.getElementById('buscaInput').value.toLowerCase();
  const filtroServidor = document.getElementById('filtroServidor').value;
  const filtroStatus = document.getElementById('filtroStatus').value;

  const tbody = document.getElementById('tabelaClientes');
  const emptyState = document.getElementById('emptyState');
  tbody.innerHTML = '';

  const lista = Object.entries(clientes).filter(([id, c]) => {
    if (!c.nome) return false;
    const status = statusCliente(c.vencimento);
    if (busca && !c.nome.toLowerCase().includes(busca)) return false;
    if (filtroServidor && c.servidor !== filtroServidor) return false;
    if (filtroStatus && status !== filtroStatus) return false;
    return true;
  });

  // ordena por vencimento (mais urgente primeiro)
  lista.sort((a, b) => new Date(a[1].vencimento) - new Date(b[1].vencimento));

  if (lista.length === 0) {
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';

  lista.forEach(([id, c]) => {
    const status = statusCliente(c.vencimento);
    const notifOk = !!c.fcmToken;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${c.nome}</td>
      <td>${c.servidor || '-'}</td>
      <td>${formatarValor(c.valorPlano)}</td>
      <td>${formatarData(c.vencimento)}</td>
      <td>${badgeHtml(status)}</td>
      <td>${notifOk ? '<span class="badge ok">Ativou</span>' : '<span class="badge neutral">Não ativou</span>'}</td>
      <td>
        <div class="row-actions">
          <button class="icon-btn" onclick="abrirEdicao('${id}')">Editar</button>
          <button class="icon-btn" onclick="enviarLinkAtivacao('${id}')">Enviar Link</button>
          <button class="icon-btn" onclick="confirmarExclusao('${id}')">Excluir</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderizarResumo() {
  const todos = Object.values(clientes).filter(c => c.nome);
  let ativos = 0, vencendo = 0, vencidos = 0, comNotif = 0;

  todos.forEach(c => {
    const status = statusCliente(c.vencimento);
    if (status === 'ativo') ativos++;
    if (status === 'vencendo') vencendo++;
    if (status === 'vencido') vencidos++;
    if (c.fcmToken) comNotif++;
  });

  document.getElementById('countAtivos').textContent = ativos;
  document.getElementById('countVencendo').textContent = vencendo;
  document.getElementById('countVencidos').textContent = vencidos;
  document.getElementById('countNotif').textContent = `${comNotif}/${todos.length}`;
}

// ============================================
// MODAL — NOVO / EDITAR
// ============================================
const modal = document.getElementById('modalCliente');

document.getElementById('btnNovoCliente').addEventListener('click', () => abrirModal());
document.getElementById('btnCancelarModal').addEventListener('click', fecharModal);

function abrirModal() {
  document.getElementById('modalTitulo').textContent = 'Novo Cliente';
  document.getElementById('clienteId').value = '';
  ['fNome', 'fWhatsapp', 'fEmail', 'fServidor', 'fValor', 'fVencimento'].forEach(id => {
    document.getElementById(id).value = '';
  });
  modal.classList.remove('hidden');
}

function abrirEdicao(id) {
  const c = clientes[id];
  if (!c) return;
  document.getElementById('modalTitulo').textContent = 'Editar Cliente';
  document.getElementById('clienteId').value = id;
  document.getElementById('fNome').value = c.nome || '';
  document.getElementById('fWhatsapp').value = c.whatsapp || '';
  document.getElementById('fEmail').value = c.email || '';
  document.getElementById('fServidor').value = c.servidor || '';
  document.getElementById('fValor').value = c.valorPlano || '';
  document.getElementById('fVencimento').value = c.vencimento || '';
  modal.classList.remove('hidden');
}

function fecharModal() {
  modal.classList.add('hidden');
}

document.getElementById('btnSalvarCliente').addEventListener('click', async () => {
  const nome = document.getElementById('fNome').value.trim();
  const whatsapp = document.getElementById('fWhatsapp').value.trim();
  const email = document.getElementById('fEmail').value.trim();
  const servidor = document.getElementById('fServidor').value.trim();
  const valorPlano = document.getElementById('fValor').value.trim();
  const vencimento = document.getElementById('fVencimento').value;
  let id = document.getElementById('clienteId').value;

  if (!nome || !whatsapp || !vencimento) {
    mostrarToast('Preencha ao menos nome, WhatsApp e vencimento.', true);
    return;
  }

  const dadosCliente = { nome, whatsapp, email, servidor, valorPlano, vencimento };

  // preserva fcmToken existente se estiver editando
  if (id && clientes[id] && clientes[id].fcmToken) {
    dadosCliente.fcmToken = clientes[id].fcmToken;
  }

  if (!id) id = gerarId();

  try {
    await salvarClienteFirebase(id, dadosCliente);
    clientes[id] = { ...(clientes[id] || {}), ...dadosCliente };
    fecharModal();
    renderizarTudo();
    mostrarToast('Cliente salvo com sucesso.');
  } catch (err) {
    mostrarToast('Erro ao salvar cliente.', true);
    console.error(err);
  }
});

async function confirmarExclusao(id) {
  const c = clientes[id];
  if (!c) return;
  if (!confirm(`Excluir o cliente "${c.nome}"? Essa ação não pode ser desfeita.`)) return;

  try {
    await excluirClienteFirebase(id);
    delete clientes[id];
    renderizarTudo();
    mostrarToast('Cliente excluído.');
  } catch (err) {
    mostrarToast('Erro ao excluir cliente.', true);
    console.error(err);
  }
}

// ============================================
// ENVIO DO LINK DE ATIVAÇÃO VIA WHATSAPP
// ============================================
function normalizarWhatsapp(numero) {
  let limpo = (numero || '').replace(/\D/g, ''); // remove tudo que não é número
  if (!limpo.startsWith('55')) limpo = '55' + limpo; // garante DDI Brasil
  return limpo;
}

function enviarLinkAtivacao(id) {
  const c = clientes[id];
  if (!c) return;
  if (!c.whatsapp) {
    mostrarToast('Esse cliente não tem WhatsApp cadastrado.', true);
    return;
  }

  const linkAtivacao = `${window.location.origin}/ativar-notificacao.html?id=${id}`;
  const mensagem = `Olá ${c.nome}! Para receber avisos automáticos do vencimento do seu plano, clique no link e ative as notificações: ${linkAtivacao}`;
  const numero = normalizarWhatsapp(c.whatsapp);
  const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;

  window.open(url, '_blank');
}

// ============================================
// FILTROS / BUSCA
// ============================================
document.getElementById('buscaInput').addEventListener('input', renderizarTabela);
document.getElementById('filtroServidor').addEventListener('change', renderizarTabela);
document.getElementById('filtroStatus').addEventListener('change', renderizarTabela);

// ============================================
// TOAST
// ============================================
let toastTimeout;
function mostrarToast(mensagem, erro = false) {
  const toast = document.getElementById('toast');
  toast.textContent = mensagem;
  toast.classList.toggle('error', erro);
  toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('show'), 3000);
}

// ============================================
// INIT
// ============================================
carregarClientes();
