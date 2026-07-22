// ============================================
// FUNÇÕES COMPARTILHADAS — Envio de Push e Email
// ============================================

const admin = require('firebase-admin');
const { Resend } = require('resend');

function inicializarFirebase() {
  if (!admin.apps.length) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL
      });
      console.log('✅ Firebase inicializado');
    } catch (err) {
      console.error('❌ Erro ao inicializar Firebase:', err.message);
    }
  }
  return admin;
}

const resend = new Resend(process.env.RESEND_API_KEY);
const WHATSAPP_NUMERO = process.env.WHATSAPP_NUMERO || '21987214698';
const EMAIL_REMETENTE = process.env.EMAIL_REMETENTE || 'avisos@fenixsocial.site';
const DB_URL = process.env.FIREBASE_DATABASE_URL;

// ============================================
// ENVIAR PUSH VIA FIREBASE
// ============================================
async function enviarPush(fcmToken, titulo, corpo) {
  if (!fcmToken || !fcmToken.trim()) {
    console.log('⚠️ FCM Token vazio');
    return false;
  }

  try {
    inicializarFirebase();
    const messaging = admin.messaging();

    const payload = {
      token: fcmToken,
      notification: {
        title: titulo,
        body: corpo
      },
      webpush: {
        fcmOptions: {
          link: 'https://aviso.fenixsocial.site'
        },
        notification: {
          title: titulo,
          body: corpo,
          icon: '/icon-192.png'
        }
      }
    };

    console.log(`📤 Enviando PUSH: "${titulo}"`);
    const msgId = await messaging.send(payload);
    console.log(`✅ PUSH enviado! ID: ${msgId}`);
    return true;

  } catch (err) {
    console.error(`❌ Erro ao enviar PUSH: ${err.message}`);
    return false;
  }
}

// ============================================
// ENVIAR EMAIL VIA RESEND
// ============================================
async function enviarEmail(destino, assunto, corpo) {
  if (!destino || !EMAIL_REMETENTE) {
    console.log('⚠️ Email ou remetente vazio');
    return false;
  }

  try {
    console.log(`📧 Enviando EMAIL para: ${destino}`);
    await resend.emails.send({
      from: EMAIL_REMETENTE,
      to: destino,
      subject: assunto,
      html: `<p>${corpo}</p>`
    });
    console.log(`✅ EMAIL enviado!`);
    return true;

  } catch (err) {
    console.error(`❌ Erro ao enviar EMAIL: ${err.message}`);
    return false;
  }
}

// ============================================
// SUBSTITUIR VARIÁVEIS
// ============================================
function substituirVariaveis(template, cliente) {
  if (!template) return '';
  
  return template
    .replace(/{nome}/g, cliente.nome || 'Cliente')
    .replace(/{data_vencimento}/g, cliente.vencimento || '')
    .replace(/{valor_plano}/g, `R$ ${cliente.valorPlano || '0,00'}`)
    .replace(/{servidor}/g, cliente.servidor || '')
    .replace(/{whatsapp}/g, WHATSAPP_NUMERO);
}

// ============================================
// CALCULAR DIAS RESTANTES
// ============================================
function calcularDiasRestantes(vencimentoStr) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  
  const vencimento = new Date(vencimentoStr + 'T00:00:00');
  const dias = Math.round((vencimento - hoje) / (1000 * 60 * 60 * 24));
  
  return dias;
}

module.exports = {
  inicializarFirebase,
  enviarPush,
  enviarEmail,
  substituirVariaveis,
  calcularDiasRestantes,
  DB_URL,
  WHATSAPP_NUMERO,
  EMAIL_REMETENTE
};
