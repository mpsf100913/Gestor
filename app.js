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
let planos = {};
let templates = {};
let selecionados = new Set();
let selecionadosMassa = new Set();

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

const TEMPLATE_RENOVACAO_PADRAO = 'Boa notícia, {nome}! Sua renovação foi confirmada. Novo vencimento: {data_vencimento}.';

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
    const [dadosClientes, dadosServidores, dadosPlanos, dadosTemplates] = await Promise.all([
      firebaseGet('clientes'),
      firebaseGet('servidores'),
      firebaseGet('planos'),
      firebaseGet('config/templates')
    ]);
    clientes = dadosClientes || {};
    servidores = dadosServidores || {};
    planos = dadosPlanos || {};
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
  atualizarFiltroServidoresMassa();
  atualizarSelectServidorModal();
  atualizarSelectPlanoModal();
  renderizarTabelaServidores();
  renderizarTabelaPlanos();
  renderizarTabela();
  renderizarTabelaMassa();
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
    entradas.map(([id, s]) => `<option value="${s.nome}">${s.nome}</option>`).join('');
  select.value = atual;
}

function atualizarSelectPlanoModal() {
  const select = document.getElementById('fPlano');
  const atual = select.value;
  const entradas = Object.entries(planos);
  select.innerHTML = '<option value="">Selecione um plano</option>' +
    entradas.map(([id, p]) => `<option value="${p.nome}" data-valor="${p.valor || ''}">${p.nome} — ${formatarValor(p.valor)}</option>`).join('');
  select.value = atual;
}

document.getElementById('fPlano').addEventListener('change', (e) => {
  const opcao = e.target.selectedOptions[0];
  const valor = opcao?.dataset?.valor;
  if (valor) document.getElementById('fValor').value = valor;
});

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
          <button class="icon-btn" onclick="abrirRenovacao('${id}')">Renovar</button>
          <button class="icon-btn" onclick="abrirWhatsappRapido('${id}')">WhatsApp</button>
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

document.getElementById('btnSelecionarFiltrados').addEventListener('click', () => {
  const linhas = document.querySelectorAll('.check-cliente');
  if (linhas.length === 0) {
    mostrarToast('Nenhum cliente corresponde ao filtro atual.', true);
    return;
  }
  linhas.forEach(chk => {
    chk.checked = true;
    selecionados.add(chk.dataset.id);
  });
  atualizarContadorSelecionados();
  mostrarToast(`${linhas.length} cliente(s) selecionado(s) pelo filtro atual.`);
});

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
  ['fNome', 'fWhatsapp', 'fEmail', 'fServidor', 'fPlano', 'fValor', 'fVencimento', 'fUsuario', 'fSenha'].forEach(id => {
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
  document.getElementById('fPlano').value = c.plano || '';
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
  const plano = document.getElementById('fPlano').value.trim();
  const valorPlano = document.getElementById('fValor').value.trim();
  const vencimento = document.getElementById('fVencimento').value;
  const usuarioIptv = document.getElementById('fUsuario').value.trim();
  const senhaIptv = document.getElementById('fSenha').value.trim();
  let id = document.getElementById('clienteId').value;

  if (!nome || !whatsapp || !vencimento) {
    mostrarToast('Preencha ao menos nome, WhatsApp e vencimento.', true);
    return;
  }

  const dadosCliente = { nome, whatsapp, email, servidor, plano, valorPlano, vencimento, usuarioIptv, senhaIptv };

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
    selecionadosMassa.delete(id);
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
  modalServidor.classList.remove('hidden');
}

document.getElementById('btnSalvarServidor').addEventListener('click', async () => {
  const nome = document.getElementById('fServidorNome').value.trim();
  let id = document.getElementById('servidorId').value;

  if (!nome) {
    mostrarToast('Informe o nome do servidor.', true);
    return;
  }

  const dados = { nome };
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
// PLANOS — CRUD
// ============================================
const modalPlano = document.getElementById('modalPlano');

document.getElementById('btnNovoPlano').addEventListener('click', () => {
  document.getElementById('modalPlanoTitulo').textContent = 'Novo Plano';
  document.getElementById('planoId').value = '';
  document.getElementById('fPlanoNome').value = '';
  document.getElementById('fPlanoValor').value = '';
  modalPlano.classList.remove('hidden');
});

document.getElementById('btnCancelarModalPlano').addEventListener('click', () => {
  modalPlano.classList.add('hidden');
});

function abrirEdicaoPlano(id) {
  const p = planos[id];
  if (!p) return;
  document.getElementById('modalPlanoTitulo').textContent = 'Editar Plano';
  document.getElementById('planoId').value = id;
  document.getElementById('fPlanoNome').value = p.nome || '';
  document.getElementById('fPlanoValor').value = p.valor || '';
  modalPlano.classList.remove('hidden');
}

document.getElementById('btnSalvarPlano').addEventListener('click', async () => {
  const nome = document.getElementById('fPlanoNome').value.trim();
  const valor = document.getElementById('fPlanoValor').value.trim();
  let id = document.getElementById('planoId').value;

  if (!nome) {
    mostrarToast('Informe o nome do plano.', true);
    return;
  }

  const dados = { nome, valor };
  if (!id) id = gerarId('pln');

  try {
    await firebasePatch(`planos/${id}`, dados);
    planos[id] = dados;
    modalPlano.classList.add('hidden');
    renderizarTudo();
    mostrarToast('Plano salvo com sucesso.');
  } catch (err) {
    mostrarToast('Erro ao salvar plano.', true);
    console.error(err);
  }
});

async function excluirPlano(id) {
  const p = planos[id];
  if (!p) return;
  if (!confirm(`Excluir o plano "${p.nome}"? Isso não afeta clientes já cadastrados com esse plano.`)) return;

  try {
    await firebaseDelete(`planos/${id}`);
    delete planos[id];
    renderizarTudo();
    mostrarToast('Plano excluído.');
  } catch (err) {
    mostrarToast('Erro ao excluir plano.', true);
    console.error(err);
  }
}

function renderizarTabelaPlanos() {
  const tbody = document.getElementById('tabelaPlanos');
  const empty = document.getElementById('emptyPlanos');
  tbody.innerHTML = '';

  const entradas = Object.entries(planos);
  if (entradas.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  entradas.forEach(([id, p]) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${p.nome}</td>
      <td>${formatarValor(p.valor)}</td>
      <td>
        <div class="row-actions">
          <button class="icon-btn" onclick="abrirEdicaoPlano('${id}')">Editar</button>
          <button class="icon-btn" onclick="excluirPlano('${id}')">Excluir</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ============================================
// RESUMO POR SERVIDOR — RECOLHÍVEL
// ============================================
document.getElementById('toggleResumoServidor').addEventListener('click', () => {
  const conteudo = document.getElementById('conteudoResumoServidor');
  const seta = document.getElementById('setaResumoServidor');
  conteudo.classList.toggle('hidden');
  seta.classList.toggle('open');
});

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
  document.getElementById('msgRenovacao').value = templates.renovacao || TEMPLATE_RENOVACAO_PADRAO;
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
    },
    renovacao: document.getElementById('msgRenovacao').value.trim()
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

function substituirVariaveisCliente(template, c) {
  const dias = calcularDiasRestantes(c.vencimento);
  return (template || '')
    .replace(/{nome}/g, c.nome || '')
    .replace(/{data_vencimento}/g, formatarData(c.vencimento))
    .replace(/{valor_plano}/g, c.valorPlano || '')
    .replace(/{servidor}/g, c.servidor || '')
    .replace(/{dias_restantes}/g, Math.abs(dias))
    .replace(/{status}/g, dias < 0 ? 'vencido' : dias === 0 ? 'vence hoje' : 'vencendo');
}

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
// WHATSAPP RÁPIDO — mensagens por status
// ============================================
const modalWhatsappRapido = document.getElementById('modalWhatsappRapido');
let clienteWhatsappAtual = null;

function abrirWhatsappRapido(id) {
  const c = clientes[id];
  if (!c) return;
  if (!c.whatsapp) {
    mostrarToast('Esse cliente não tem WhatsApp cadastrado.', true);
    return;
  }
  clienteWhatsappAtual = id;
  document.getElementById('whatsappNomeCliente').textContent = c.nome;
  document.getElementById('whatsappMensagemCustom').value = '';
  modalWhatsappRapido.classList.remove('hidden');
}

document.getElementById('btnFecharWhatsappRapido').addEventListener('click', () => {
  modalWhatsappRapido.classList.add('hidden');
});

function enviarWhatsappRapido(tipo) {
  const c = clientes[clienteWhatsappAtual];
  if (!c) return;

  let textoBase;
  if (tipo === 'vencendo') {
    textoBase = (templates.aviso_3_dias && templates.aviso_3_dias.whatsapp) || TEMPLATES_PADRAO.aviso_3_dias.whatsapp;
  } else if (tipo === 'hoje') {
    textoBase = (templates.aviso_hoje && templates.aviso_hoje.whatsapp) || TEMPLATES_PADRAO.aviso_hoje.whatsapp;
  } else if (tipo === 'vencido') {
    textoBase = (templates.aviso_vencido && templates.aviso_vencido.whatsapp) || TEMPLATES_PADRAO.aviso_vencido.whatsapp;
  } else if (tipo === 'renovacao') {
    textoBase = templates.renovacao || TEMPLATE_RENOVACAO_PADRAO;
  } else {
    textoBase = document.getElementById('whatsappMensagemCustom').value.trim();
    if (!textoBase) {
      mostrarToast('Digite uma mensagem antes de enviar.', true);
      return;
    }
  }

  const mensagem = substituirVariaveisCliente(textoBase, c);
  const numero = normalizarWhatsapp(c.whatsapp);
  const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
  window.open(url, '_blank');
  modalWhatsappRapido.classList.add('hidden');
}

// ============================================
// RENOVAÇÃO DE CLIENTE
// ============================================
const modalRenovar = document.getElementById('modalRenovar');

function abrirRenovacao(id) {
  const c = clientes[id];
  if (!c) return;
  document.getElementById('renovarClienteId').value = id;
  document.getElementById('renovarNomeCliente').textContent = c.nome;
  document.getElementById('renovarVencimentoAtual').textContent = formatarData(c.vencimento);
  document.getElementById('renovarNovaData').value = c.vencimento || '';
  modalRenovar.classList.remove('hidden');
}

document.getElementById('btnCancelarRenovar').addEventListener('click', () => {
  modalRenovar.classList.add('hidden');
});

function aplicarPeriodoRenovacao(dias) {
  const id = document.getElementById('renovarClienteId').value;
  const c = clientes[id];
  if (!c) return;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const vencimentoAtual = new Date(c.vencimento + 'T00:00:00');
  const base = vencimentoAtual > hoje ? vencimentoAtual : hoje;
  base.setDate(base.getDate() + dias);

  const novaDataStr = base.toISOString().split('T')[0];
  document.getElementById('renovarNovaData').value = novaDataStr;
}

document.getElementById('btnConfirmarRenovacao').addEventListener('click', async () => {
  const id = document.getElementById('renovarClienteId').value;
  const novaData = document.getElementById('renovarNovaData').value;
  const c = clientes[id];
  if (!c || !novaData) {
    mostrarToast('Selecione a nova data de vencimento.', true);
    return;
  }

  const btn = document.getElementById('btnConfirmarRenovacao');
  btn.disabled = true;
  btn.textContent = 'Renovando...';

  try {
    await firebasePatch(`clientes/${id}`, { vencimento: novaData, ultimaNotificacao: null });
    clientes[id] = { ...c, vencimento: novaData, ultimaNotificacao: null };

    const res = await fetch('/api/notificar-renovacao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    const resultado = await res.json();
    if (!res.ok || !resultado.ok) throw new Error(resultado.erro || 'Falha ao notificar');

    modalRenovar.classList.add('hidden');
    renderizarTudo();
    mostrarToast('Cliente renovado e notificado com sucesso!');
  } catch (err) {
    mostrarToast('Renovação salva, mas houve erro ao notificar o cliente.', true);
    console.error(err);
    renderizarTudo();
  } finally {
    btn.disabled = false;
    btn.textContent = 'Confirmar Renovação';
  }
});

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
// NOTIFICAÇÃO EM MASSA — aba separada
// ============================================
function atualizarFiltroServidoresMassa() {
  const select = document.getElementById('filtroServidorMassa');
  const atual = select.value;
  const nomes = Object.values(servidores).map(s => s.nome).filter(Boolean);
  select.innerHTML = '<option value="">Todos os servidores</option>' +
    nomes.map(n => `<option value="${n}">${n}</option>`).join('');
  select.value = atual;
}

function getClientesFiltradosMassa() {
  const filtroServidor = document.getElementById('filtroServidorMassa').value;
  const filtroStatus = document.getElementById('filtroStatusMassa').value;
  return Object.entries(clientes).filter(([id, c]) => {
    if (!c.nome) return false;
    const status = statusCliente(c.vencimento);
    if (filtroServidor && c.servidor !== filtroServidor) return false;
    if (filtroStatus && status !== filtroStatus) return false;
    return true;
  });
}

function renderizarTabelaMassa() {
  const filtrados = getClientesFiltradosMassa();
  const tbody = document.getElementById('tabelaClientesMassa');
  const empty = document.getElementById('emptyMassa');
  tbody.innerHTML = '';

  if (filtrados.length === 0) {
    empty.style.display = 'block';
  } else {
    empty.style.display = 'none';
  }

  filtrados.forEach(([id, c]) => {
    const status = statusCliente(c.vencimento);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="checkbox" class="check-cliente-massa" data-id="${id}" ${selecionadosMassa.has(id) ? 'checked' : ''}></td>
      <td>${c.nome}</td>
      <td>${c.servidor || '-'}</td>
      <td>${formatarData(c.vencimento)}</td>
      <td>${badgeHtml(status)}</td>
    `;
    tbody.appendChild(tr);
  });

  document.querySelectorAll('.check-cliente-massa').forEach(chk => {
    chk.addEventListener('change', (e) => {
      const id = e.target.dataset.id;
      if (e.target.checked) selecionadosMassa.add(id); else selecionadosMassa.delete(id);
      atualizarContadorMassa();
    });
  });
}

function atualizarContadorMassa() {
  document.getElementById('contadorSelecionadosMassa').textContent = `${selecionadosMassa.size} cliente(s) selecionado(s)`;
  document.getElementById('btnDispararMassa').disabled = selecionadosMassa.size === 0;
}

function atualizarPreviewMassa() {
  const filtrados = getClientesFiltradosMassa();
  const idsSelecionados = [...selecionadosMassa];
  const [, clienteExemplo] = Object.entries(clientes).find(([id]) => id === idsSelecionados[0])
    || filtrados[0]
    || [null, null];

  const mensagem = document.getElementById('mensagemMassa').value || 'Sua mensagem aparece aqui.';
  const corpo = clienteExemplo ? substituirVariaveisCliente(mensagem, clienteExemplo) : mensagem;

  document.getElementById('previewTituloMassa').textContent = 'Aviso do seu plano IPTV';
  document.getElementById('previewCorpoMassa').textContent = corpo;

  const icone = document.getElementById('iconeMassa').value.trim();
  const imagem = document.getElementById('imagemMassa').value.trim();
  const previewIcone = document.getElementById('previewIconeMassa');
  const previewImagem = document.getElementById('previewImagemMassa');
  const hint = document.getElementById('hintSemImagemMassa');

  previewIcone.src = icone || 'https://via.placeholder.com/64/2dd4bf/04201d?text=IPTV';

  if (imagem) {
    previewImagem.src = imagem;
    previewImagem.style.display = 'block';
    hint.style.display = 'none';
  } else {
    previewImagem.style.display = 'none';
    hint.style.display = 'block';
  }
}

document.getElementById('filtroServidorMassa').addEventListener('change', () => { renderizarTabelaMassa(); atualizarPreviewMassa(); });
document.getElementById('filtroStatusMassa').addEventListener('change', () => { renderizarTabelaMassa(); atualizarPreviewMassa(); });

document.getElementById('btnSelecionarFiltradosMassa').addEventListener('click', () => {
  const filtrados = getClientesFiltradosMassa();
  if (filtrados.length === 0) {
    mostrarToast('Nenhum cliente corresponde ao filtro atual.', true);
    return;
  }
  filtrados.forEach(([id]) => selecionadosMassa.add(id));
  renderizarTabelaMassa();
  atualizarContadorMassa();
  atualizarPreviewMassa();
  mostrarToast(`${filtrados.length} cliente(s) selecionado(s) pelo filtro atual.`);
});

document.getElementById('btnLimparSelecaoMassa').addEventListener('click', () => {
  selecionadosMassa.clear();
  renderizarTabelaMassa();
  atualizarContadorMassa();
  atualizarPreviewMassa();
});

['mensagemMassa', 'iconeMassa', 'imagemMassa'].forEach(id => {
  document.getElementById(id).addEventListener('input', atualizarPreviewMassa);
});

document.getElementById('btnDispararMassa').addEventListener('click', async () => {
  const canal = document.getElementById('canalMassa').value;
  const mensagem = document.getElementById('mensagemMassa').value.trim();
  const assunto = document.getElementById('assuntoMassa').value.trim() || 'Aviso do seu plano IPTV';
  const icone = document.getElementById('iconeMassa').value.trim() || null;
  const imagem = document.getElementById('imagemMassa').value.trim() || null;

  if (!mensagem) {
    mostrarToast('Escreva uma mensagem antes de enviar.', true);
    return;
  }

  const btn = document.getElementById('btnDispararMassa');
  btn.disabled = true;
  btn.textContent = 'Enviando...';

  try {
    const res = await fetch('/api/enviar-manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ids: [...selecionadosMassa],
        canal,
        mensagem,
        assunto,
        icone,
        imagem
      })
    });
    const resultado = await res.json();
    if (!res.ok || !resultado.ok) throw new Error(resultado.erro || 'Falha no envio');

    mostrarToast(`Enviado para ${resultado.enviados} cliente(s).`);
  } catch (err) {
    mostrarToast('Erro ao disparar notificação em massa.', true);
    console.error(err);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Disparar Notificação';
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
