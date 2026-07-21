// ============================================
// NOTIFICAÇÃO DE RENOVAÇÃO — dispara push + e-mail quando o admin renova um cliente
// ============================================

const { inicializarFirebase, substituirVariaveis, enviarPush, enviarEmail } = require('./lib/mensagens');

const admin = inicializarFirebase();
const db = admin.database();

const TEMPLATE_PADRAO = 'Boa notícia, {nome}! Sua renovação foi confirmada. Novo vencimento: {data_vencimento}.';

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, erro: 'Método não permitido' });
  }

  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ ok: false, erro: 'ID do cliente não informado' });

    const [snapshotCliente, snapshotTemplates] = await Promise.all([
      db.ref(`clientes/${id}`).once('value'),
      db.ref('config/templates').once('value')
    ]);

    const cliente = snapshotCliente.val();
    if (!cliente) return res.status(404).json({ ok: false, erro: 'Cliente não encontrado' });

    const templates = snapshotTemplates.val() || {};
    const textoTemplate = templates.renovacao || TEMPLATE_PADRAO;
    const imagemTemplate = templates.imagemRenovacao || '';
    const mensagem = substituirVariaveis(textoTemplate, cliente);
    const titulo = 'Renovação confirmada';

    await enviarPush(cliente.fcmToken, titulo, mensagem, undefined, imagemTemplate);
    await enviarEmail(cliente.email, titulo, mensagem);

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Erro ao notificar renovação:', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
};
