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
let clientes = {};
let servidores = {};
let templates = {};
let selecionados = new Set();

const TEMPLATES_PADRAO = {
  aviso_3_dias: {
    push: 'Olá {nome}! Seu plano vence em {dias_restantes} dias ({data_vencimento}). Toque para renovar.',
    whatsapp: 'Olá! Meu plano IPTV vence em breve ({data_vencimento}), quero renovar.'
  },
  aviso_hoje: {
    push: 'Olá {nome}! Seu plano vence HOJE. Renove agora para não perder o acesso.',
    whatsapp: 'Olá! Meu plano IPTV vence hoje, quero renovar agora.'
  },
  aviso_vencido: {
    push: 'Olá {nome}, seu plano está vencido há {dias_restantes} dia(s). Renove para reativar.',
    whatsapp: 'Olá! Meu plano IPTV está vencido, quero renovar e reativar o acesso.'
  }
};

// ============================================
// TABS
// ============================================
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.remove('hidden');
  });
});

// ============================================
// HELPERS DE STATUS
// ============================================
function calcularDiasRestantes(vencimentoStr) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const vencimento = new Date(vencimentoStr + 'T00:00:00');
  return Math.round((vencimento - hoje) / (1000 * 60 * 60 * 24));
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
  return isNaN(n) ? (valor || 'R$ 0,00') : `R$ ${n.toFixed(2).replace('.', ',')}`;
}

// ============================================
// FIREBASE REST — HELPERS GENÉRICOS
// ============================================
async function firebaseGet(caminho) {
  const res = await fetch(`${DB_URL}/${caminho}.json`);
  return res.json();
}

async function firebasePatch(caminho, dados) {
  const res = await fetch(`${DB_URL}/${caminho}.json`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados)
  });
  if (!res.ok) throw new Error('Falha ao salvar no Firebase');
  return res.json();
}

async function firebaseDelete(caminho) {
  const res = await fetch(`${DB_URL}/${caminho}.json`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Falha ao excluir no Firebase');
}

function gerarId(prefixo) {
  return prefixo + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

// ============================================
// CARREGAMENTO INICIAL
// ============================================
async function carregarTudo() {
  try {
    const [dadosClientes, dadosServidores, dadosTemplates] = await Promise.all([
      firebaseGet('clientes'),
      firebaseGet('servidores'),
      firebaseGet('config/templates')
    ]);
    clientes = dadosClientes || {};
    servidores = dadosServidores || {};
    templates = dadosTemplates || {};
    renderizarTudo();
    preencherFormMensagens();
  } catch (err) {
    mostrarToast('Erro ao carregar dados. Verifique a configuração do Firebase.', true);
    console.error(err);
  }
}

function renderizarTudo() {
  atualizarFiltroServidores();
  atualizarSelectServidorModal();
  renderizarTabelaServidores();
  renderizarTabela();
  renderizarResumo();
  renderizarResumoPorServidor();
}

// ============================================
// CLIENTES — RENDERIZAÇÃO
// ============================================
function atualizarFiltroServidores() {
  const select = document.getElementById('filtroServidor');
  const atual = select.value;
  const nomes = Object.values(servidores).map(s => s.nome).filter(Boolean);
  select.innerHTML = '<option value="">Todos os servidores</option>' +
    nomes.map(n => `<option value="${n}">${n}</option>`).join('');
  select.value = atual;
}

function atualizarSelectServidorModal() {
  const select = document.getElementById('fServidor');
  const atual = select.value;
  const entradas = Object.entries(servidores);
  select.innerHTML = '<option value="">Selecione um servidor</option>' +
    entradas.map(([id, s]) => `<option value="${s.nome}" data-valor="${s.valorPadrao || ''}">${s.nome}</option>`).join('');
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
      <td><input type="checkbox" class="check-cliente" data-id="${id}" ${selecionados.has(id) ? 'checked' : ''}></td>
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

  document.querySelectorAll('.check-cliente').forEach(chk => {
    chk.addEventListener('change', (e) => {
      const id = e.target.dataset.id;
      if (e.target.checked) selecionados.add(id); else selecionados.delete(id);
      atualizarContadorSelecionados();
    });
  });
}

document.getElementById('checkTodos').addEventListener('change', (e) => {
  const linhas = document.querySelectorAll('.check-cliente');
  linhas.forEach(chk => {
    chk.checked = e.target.checked;
    const id = chk.dataset.id;
    if (e.target.checked) selecionados.add(id); else selecionados.delete(id);
  });
  atualizarContadorSelecionados();
});

function atualizarContadorSelecionados() {
  document.getElementById('contadorSelecionados').textContent = `${selecionados.size} cliente(s) selecionado(s)`;
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

function renderizarResumoPorServidor() {
  const tbody = document.getElementById('tabelaResumoServidor');
  const empty = document.getElementById('emptyResumoServidor');
  tbody.innerHTML = '';

  const nomesServidores = Object.values(servidores).map(s => s.nome).filter(Boolean);
  const clientesPorServidor = {};

  Object.values(clientes).forEach(c => {
    if (!c.nome) return;
    const nomeServ = c.servidor || 'Sem servidor';
    if (!clientesPorServidor[nomeServ]) clientesPorServidor[nomeServ] = [];
    clientesPorServidor[nomeServ].push(c);
  });

  // garante que servidores cadastrados sem cliente também apareçam
  nomesServidores.forEach(n => { if (!clientesPorServidor[n]) clientesPorServidor[n] = []; });

  const nomes = Object.keys(clientesPorServidor);

  if (nomes.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  nomes.sort().forEach(nomeServ => {
    const lista = clientesPorServidor[nomeServ];
    let ativos = 0, vencendo = 0, vencidos = 0, receitaAtiva = 0, receitaAtraso = 0;

    lista.forEach(c => {
      const status = statusCliente(c.vencimento);
      const valor = parseFloat(c.valorPlano) || 0;
      if (status === 'ativo') { ativos++; receitaAtiva += valor; }
      if (status === 'vencendo') { vencendo++; receitaAtiva += valor; }
      if (status === 'vencido') { vencidos++; receitaAtraso += valor; }
    });

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${nomeServ}</td>
      <td>${ativos}</td>
      <td>${vencendo}</td>
      <td>${vencidos}</td>
      <td>${formatarValor(receitaAtiva)}</td>
      <td>${formatarValor(receitaAtraso)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ============================================
// MODAL — NOVO / EDITAR CLIENTE
// ============================================
const modal = document.getElementById('modalCliente');

document.getElementById('btnNovoCliente').addEventListener('click', () => abrirModal());
document.getElementById('btnCancelarModal').addEventListener('click', fecharModal);

function abrirModal() {
  document.getElementById('modalTitulo').textContent = 'Novo Cliente';
  document.getElementById('clienteId').value = '';
  ['fNome', 'fWhatsapp', 'fEmail', 'fServidor', 'fValor', 'fVencimento', 'fUsuario', 'fSenha'].forEach(id => {
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
  document.getElementById('fUsuario').value = c.usuarioIptv || '';
  document.getElementById('fSenha').value = c.senhaIptv || '';
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
  const usuarioIptv = document.getElementById('fUsuario').value.trim();
  const senhaIptv = document.getElementById('fSenha').value.trim();
  let id = document.getElementById('clienteId').value;

  if (!nome || !whatsapp || !vencimento) {
    mostrarToast('Preencha ao menos nome, WhatsApp e vencimento.', true);
    return;
  }

  const dadosCliente = { nome, whatsapp, email, servidor, valorPlano, vencimento, usuarioIptv, senhaIptv };

  if (id && clientes[id] && clientes[id].fcmToken) {
    dadosCliente.fcmToken = clientes[id].fcmToken;
  }

  if (!id) id = gerarId('cli');

  try {
    await firebasePatch(`clientes/${id}`, dadosCliente);
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
    await firebaseDelete(`clientes/${id}`);
    delete clientes[id];
    selecionados.delete(id);
    renderizarTudo();
    mostrarToast('Cliente excluído.');
  } catch (err) {
    mostrarToast('Erro ao excluir cliente.', true);
    console.error(err);
  }
}

// ============================================
// SERVIDORES — CRUD
// ============================================
const modalServidor = document.getElementById('modalServidor');

document.getElementById('btnNovoServidor').addEventListener('click', () => {
  document.getElementById('modalServidorTitulo').textContent = 'Novo Servidor';
  document.getElementById('servidorId').value = '';
  document.getElementById('fServidorNome').value = '';
  document.getElementById('fServidorValor').value = '';
  modalServidor.classList.remove('hidden');
});

document.getElementById('btnCancelarModalServidor').addEventListener('click', () => {
  modalServidor.classList.add('hidden');
});

function abrirEdicaoServidor(id) {
  const s = servidores[id];
  if (!s) return;
  document.getElementById('modalServidorTitulo').textContent = 'Editar Servidor';
  document.getElementById('servidorId').value = id;
  document.getElementById('fServidorNome').value = s.nome || '';
  document.getElementById('fServidorValor').value = s.valorPadrao || '';
  modalServidor.classList.remove('hidden');
}

document.getElementById('btnSalvarServidor').addEventListener('click', async () => {
  const nome = document.getElementById('fServidorNome').value.trim();
  const valorPadrao = document.getElementById('fServidorValor').value.trim();
  let id = document.getElementById('servidorId').value;

  if (!nome) {
    mostrarToast('Informe o nome do servidor.', true);
    return;
  }

  const dados = { nome, valorPadrao };
  if (!id) id = gerarId('srv');

  try {
    await firebasePatch(`servidores/${id}`, dados);
    servidores[id] = dados;
    modalServidor.classList.add('hidden');
    renderizarTudo();
    mostrarToast('Servidor salvo com sucesso.');
  } catch (err) {
    mostrarToast('Erro ao salvar servidor.', true);
    console.error(err);
  }
});

async function excluirServidor(id) {
  const s = servidores[id];
  if (!s) return;
  if (!confirm(`Excluir o servidor "${s.nome}"? Isso não afeta clientes já cadastrados com esse nome.`)) return;

  try {
    await firebaseDelete(`servidores/${id}`);
    delete servidores[id];
    renderizarTudo();
    mostrarToast('Servidor excluído.');
  } catch (err) {
    mostrarToast('Erro ao excluir servidor.', true);
    console.error(err);
  }
}

function renderizarTabelaServidores() {
  const tbody = document.getElementById('tabelaServidores');
  const empty = document.getElementById('emptyServidores');
  tbody.innerHTML = '';

  const entradas = Object.entries(servidores);
  if (entradas.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  entradas.forEach(([id, s]) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${s.nome}</td>
      <td>${formatarValor(s.valorPadrao)}</td>
      <td>
        <div class="row-actions">
          <button class="icon-btn" onclick="abrirEdicaoServidor('${id}')">Editar</button>
          <button class="icon-btn" onclick="excluirServidor('${id}')">Excluir</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ============================================
// MENSAGENS — TEMPLATES
// ============================================
function preencherFormMensagens() {
  const t3 = templates.aviso_3_dias || TEMPLATES_PADRAO.aviso_3_dias;
  const th = templates.aviso_hoje || TEMPLATES_PADRAO.aviso_hoje;
  const tv = templates.aviso_vencido || TEMPLATES_PADRAO.aviso_vencido;

  document.getElementById('msg3diasPush').value = t3.push;
  document.getElementById('msg3diasWhats').value = t3.whatsapp;
  document.getElementById('msgHojePush').value = th.push;
  document.getElementById('msgHojeWhats').value = th.whatsapp;
  document.getElementById('msgVencidoPush').value = tv.push;
  document.getElementById('msgVencidoWhats').value = tv.whatsapp;
}

document.getElementById('btnSalvarMensagens').addEventListener('click', async () => {
  const novosTemplates = {
    aviso_3_dias: {
      push: document.getElementById('msg3diasPush').value.trim(),
      whatsapp: document.getElementById('msg3diasWhats').value.trim()
    },
    aviso_hoje: {
      push: document.getElementById('msgHojePush').value.trim(),
      whatsapp: document.getElementById('msgHojeWhats').value.trim()
    },
    aviso_vencido: {
      push: document.getElementById('msgVencidoPush').value.trim(),
      whatsapp: document.getElementById('msgVencidoWhats').value.trim()
    }
  };

  try {
    await firebasePatch('config/templates', novosTemplates);
    templates = novosTemplates;
    mostrarToast('Mensagens salvas com sucesso.');
  } catch (err) {
    mostrarToast('Erro ao salvar mensagens.', true);
    console.error(err);
  }
});

// ============================================
// ENVIO DO LINK DE ATIVAÇÃO VIA WHATSAPP
// ============================================
function normalizarWhatsapp(numero) {
  let limpo = (numero || '').replace(/\D/g, '');
  if (!limpo.startsWith('55')) limpo = '55' + limpo;
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
// NOTIFICAÇÃO MANUAL (PUSH / E-MAIL)
// ============================================
const modalNotificar = document.getElementById('modalNotificar');

document.getElementById('btnNotificarSelecionados').addEventListener('click', () => {
  if (selecionados.size === 0) {
    mostrarToast('Selecione ao menos um cliente na lista.', true);
    return;
  }
  atualizarContadorSelecionados();
  modalNotificar.classList.remove('hidden');
});

document.getElementById('btnCancelarNotificar').addEventListener('click', () => {
  modalNotificar.classList.add('hidden');
});

document.getElementById('canalNotificacao').addEventListener('change', (e) => {
  document.getElementById('campoAssuntoEmail').style.display = e.target.value === 'push' ? 'none' : 'block';
});

document.getElementById('btnEnviarNotificacaoManual').addEventListener('click', async () => {
  const canal = document.getElementById('canalNotificacao').value;
  const mensagem = document.getElementById('mensagemManual').value.trim();
  const assunto = document.getElementById('assuntoManual').value.trim() || 'Aviso do seu plano IPTV';

  if (!mensagem) {
    mostrarToast('Escreva uma mensagem antes de enviar.', true);
    return;
  }

  const btn = document.getElementById('btnEnviarNotificacaoManual');
  btn.disabled = true;
  btn.textContent = 'Enviando...';

  try {
    const res = await fetch('/api/enviar-manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ids: [...selecionados],
        canal,
        mensagem,
        assunto
      })
    });
    const resultado = await res.json();
    if (!res.ok || !resultado.ok) throw new Error(resultado.erro || 'Falha no envio');

    mostrarToast(`Enviado para ${resultado.enviados} cliente(s).`);
    modalNotificar.classList.add('hidden');
  } catch (err) {
    mostrarToast('Erro ao enviar notificação manual.', true);
    console.error(err);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Enviar';
  }
});

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
carregarTudo();
