const admin = require('firebase-admin');
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const WHATSAPP_NUMERO = process.env.WHATSAPP_NUMERO || '21987214698';
const EMAIL_REMETENTE = process.env.EMAIL_REMETENTE || 'avisos@fenixsocial.site';

async function enviarPush(fcmToken, titulo, corpo) {
  if (!fcmToken) return false;
  try {
    const messaging = admin.messaging();
    await messaging.send({
      token: fcmToken,
      notification: { title: titulo, body: corpo },
      webpush: { fcmOptions: { link: 'https://aviso.fenixsocial.site' } }
    });
    return true;
  } catch (err) {
    console.error('Erro push:', err.message);
    return false;
  }
}

async function enviarEmail(destino, assunto, corpo) {
  if (!destino) return false;
  try {
    await resend.emails.send({
      from: EMAIL_REMETENTE,
      to: destino,
      subject: assunto,
      html: corpo
    });
    return true;
  } catch (err) {
    console.error('Erro email:', err.message);
    return false;
  }
}

function linkWhatsapp(telefone, mensagem) {
  return `https://wa.me/${telefone}?text=${encodeURIComponent(mensagem)}`;
}

function htmlEmail(titulo, corpo, linkAtivar) {
  return `
    <h2>${titulo}</h2>
    <p>${corpo}</p>
    <p><a href="${linkAtivar}" style="display: inline-block; padding: 10px 20px; background: #667eea; color: white; text-decoration: none; border-radius: 5px;">
      🔔 Ativar Notificações
    </a></p>
    <p style="font-size: 12px; color: #999; margin-top: 20px;">
      © 2024 Gestor IPTV
    </p>
  `;
}

module.exports = {
  enviarPush,
  enviarEmail,
  linkWhatsapp,
  htmlEmail,
  WHATSAPP_NUMERO
};
