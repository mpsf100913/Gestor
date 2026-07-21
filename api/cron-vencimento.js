// ============================================
// CRON DE VENCIMENTO — roda 1x por dia (configurado no vercel.json)
// Verifica todos os clientes e dispara push + e-mail conforme a regra:
// 3 dias antes / no dia / 1,2,3 dias após vencido
// ============================================

const admin = require('firebase-admin');
const { Resend } = require('resend');

// ---------- INICIALIZAÇÃO (só roda uma vez por instância) ----------
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
}

const db = admin.database();
const resend = new Resend(process.env.RESEND_API_KEY);
const WHATSAPP_NUMERO = process.env.WHATSAPP_NUMERO; // ex: 5521999999999 (sem espaços, sem +)
const EMAIL_REMETENTE = process.env.EMAIL_REMETENTE; // ex: cobranca@seudominio.com (verificado no Resend)

// ---------- HELPERS ----------
function hojeStr() {
  const d = new Date();
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
}

function diasRestantes(vencimentoStr) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const vencimento = new Date(vencimentoStr + 'T00:00:00');
  return Math.round((vencimento - hoje) / (1000 * 60 * 60 * 24));
}

function formatarData(vencimentoStr) {
  const [ano, mes, dia] = vencimentoStr.split('-');
  return `${dia}/${mes}/${ano}`;
}

function substituirVariaveis(template, cliente, dias) {
  return template
    .replace(/{nome}/g, cliente.nome || '')
    .replace(/{data_vencimento}/g, formatarData(cliente.vencimento))
    .replace(/{valor_plano}/g, cliente.valorPlano || '')
    .replace(/{servidor}/g, cliente.servidor || '')
    .replace(/{dias_restantes}/g, Math.abs(dias))
    .replace(/{status}/g, dias < 0 ? 'vencido' : dias === 0 ? 'vence hoje' : 'vencendo');
}

// Templates padrão (a personalização pelo admin será plugada aqui futuramente)
const TEMPLATES = {
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

function tipoAviso(dias) {
  if (dias === 3) return 'aviso_3_dias';
  if (dias === 0) return 'aviso_hoje';
  if (dias === -1 || dias === -2 || dias === -3) return 'aviso_vencido';
  return null;
}

// ---------- ENVIO ----------
async function enviarPush(fcmToken, titulo, corpo, linkClick) {
  if (!fcmToken) return;
  try {
    await admin.messaging().send({
      token: fcmToken,
      notification: { title: titulo, body: corpo },
      data: { click_action: linkClick },
      webpush: { fcmOptions: { link: linkClick } }
    });
  } catch (err) {
    console.error('Erro ao enviar push:', err.message);
  }
}

async function enviarEmail(destino, assunto, corpo) {
  if (!destino || !EMAIL_REMETENTE) return;
  try {
    await resend.emails.send({
      from: EMAIL_REMETENTE,
      to: destino,
      subject: assunto,
      html: `<p>${corpo}</p>`
    });
  } catch (err) {
    console.error('Erro ao enviar e-mail:', err.message);
  }
}

// ---------- HANDLER PRINCIPAL ----------
module.exports = async (req, res) => {
  try {
    const snapshot = await db.ref('clientes').once('value');
    const clientes = snapshot.val() || {};
    const hoje = hojeStr();

    let processados = 0;
    let notificados = 0;

    for (const [id, cliente] of Object.entries(clientes)) {
      if (!cliente.vencimento || !cliente.nome) continue;
      processados++;

      const dias = diasRestantes(cliente.vencimento);
      const tipo = tipoAviso(dias);
      if (!tipo) continue;

      // evita disparar 2x no mesmo dia pro mesmo cliente
      if (cliente.ultimaNotificacao === hoje) continue;

      const template = TEMPLATES[tipo];
      const linkWhatsapp = `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(substituirVariaveis(template.whatsapp, cliente, dias))}`;
      const corpoPush = substituirVariaveis(template.push, cliente, dias);
      const tituloPush = 'Seu plano IPTV';

      await enviarPush(cliente.fcmToken, tituloPush, corpoPush, linkWhatsapp);
      await enviarEmail(cliente.email, tituloPush, corpoPush);

      // marca que já notificou hoje
      await db.ref(`clientes/${id}`).update({ ultimaNotificacao: hoje });
      notificados++;
    }

    res.status(200).json({ ok: true, processados, notificados });
  } catch (err) {
    console.error('Erro no cron de vencimento:', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
};
