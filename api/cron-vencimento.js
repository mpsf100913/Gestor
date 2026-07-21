// ============================================
// CRON DE VENCIMENTO — roda 1x por dia (configurado no vercel.json)
// ============================================

const {
  inicializarFirebase,
  substituirVariaveis,
  enviarPush,
  enviarEmail,
  linkWhatsappSuporte
} = require('./lib/mensagens');

const admin = inicializarFirebase();
const db = admin.database();

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

function hojeStr() {
  return new Date().toISOString().split('T')[0];
}

function diasRestantes(vencimentoStr) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const vencimento = new Date(vencimentoStr + 'T00:00:00');
  return Math.round((vencimento - hoje) / (1000 * 60 * 60 * 24));
}

function tipoAviso(dias) {
  if (dias === 3) return 'aviso_3_dias';
  if (dias === 0) return 'aviso_hoje';
  if (dias === -1 || dias === -2 || dias === -3) return 'aviso_vencido';
  return null;
}

module.exports = async (req, res) => {
  try {
    const [snapshotClientes, snapshotTemplates] = await Promise.all([
      db.ref('clientes').once('value'),
      db.ref('config/templates').once('value')
    ]);

    const clientes = snapshotClientes.val() || {};
    const templatesSalvos = snapshotTemplates.val() || {};
    const hoje = hojeStr();

    let processados = 0;
    let notificados = 0;

    for (const [id, cliente] of Object.entries(clientes)) {
      if (!cliente.vencimento || !cliente.nome) continue;
      processados++;

      const dias = diasRestantes(cliente.vencimento);
      const tipo = tipoAviso(dias);
      if (!tipo) continue;

      if (cliente.ultimaNotificacao === hoje) continue;

      const template = templatesSalvos[tipo] || TEMPLATES_PADRAO[tipo];
      const linkWhatsapp = linkWhatsappSuporte(substituirVariaveis(template.whatsapp, cliente, dias));
      const corpoPush = substituirVariaveis(template.push, cliente, dias);
      const tituloPush = 'Seu plano IPTV';

      await enviarPush(cliente.fcmToken, tituloPush, corpoPush, linkWhatsapp);
      await enviarEmail(cliente.email, tituloPush, corpoPush);

      await db.ref(`clientes/${id}`).update({ ultimaNotificacao: hoje });
      notificados++;
    }

    res.status(200).json({ ok: true, processados, notificados });
  } catch (err) {
    console.error('Erro no cron de vencimento:', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
};
