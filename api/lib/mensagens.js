// ============================================
// FUNÇÕES COMPARTILHADAS — envio de push, e-mail e templates
// ============================================

const admin = require('firebase-admin');
const { Resend } = require('resend');

function inicializarFirebase() {
  if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL
    });
  }
  return admin;
}

const resend = new Resend(process.env.RESEND_API_KEY);
const WHATSAPP_NUMERO = process.env.WHATSAPP_NUMERO;
const EMAIL_REMETENTE = process.env.EMAIL_REMETENTE;

function formatarData(vencimentoStr) {
  if (!vencimentoStr) return '';
  const [ano, mes, dia] = vencimentoStr.split('-');
  return `${dia}/${mes}/${ano}`;
}

function substituirVariaveis(template, cliente, dias) {
  return (template || '')
    .replace(/{nome}/g, cliente.nome || '')
    .replace(/{data_vencimento}/g, formatarData(cliente.vencimento))
    .replace(/{valor_plano}/g, cliente.valorPlano || '')
    .replace(/{servidor}/g, cliente.servidor || '')
    .replace(/{dias_restantes}/g, dias !== undefined ? Math.abs(dias) : '')
    .replace(/{status}/g, dias !== undefined ? (dias < 0 ? 'vencido' : dias === 0 ? 'vence hoje' : 'vencendo') : '');
}

async function enviarPush(fcmToken, titulo, corpo, linkClick, imagemUrl) {
  if (!fcmToken) return false;
  try {
    const payload = {
      token: fcmToken,
      notification: { 
        title: titulo, 
        body: corpo
      },
      data: { 
        click_action: linkClick || '/'
      },
      webpush: { 
        fcmOptions: { link: linkClick || '/' },
        notification: {
          title: titulo,
          body: corpo,
          icon: '/icon-192.png',
          badge: '/icon-192.png'
        }
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: titulo,
              body: corpo
            }
          }
        }
      }
    };

    // Adiciona imagem se fornecida
    if (imagemUrl && imagemUrl.trim()) {
      console.log('Enviando push com imagem:', imagemUrl);
      payload.notification.image = imagemUrl;
      payload.webpush.notification.image = imagemUrl;
      payload.android = {
        notification: {
          imageUrl: imagemUrl
        }
      };
      // Para Apple
      payload.apns.payload.aps.mutableContent = true;
    }

    console.log('Payload enviado:', JSON.stringify(payload, null, 2));
    await admin.messaging().send(payload);
    return true;
  } catch (err) {
    console.error('Erro ao enviar push:', err.message);
    console.error('Stack:', err);
    return false;
  }
}

async function enviarEmail(destino, assunto, corpo) {
  if (!destino || !EMAIL_REMETENTE) return false;
  try {
    await resend.emails.send({
      from: EMAIL_REMETENTE,
      to: destino,
      subject: assunto,
      html: `<p>${corpo}</p>`
    });
    return true;
  } catch (err) {
    console.error('Erro ao enviar e-mail:', err.message);
    return false;
  }
}

function linkWhatsappSuporte(mensagem) {
  return `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(mensagem)}`;
}

function gerarLinkRedirecionamento(config, mensagem, cliente) {
  const tipo = config?.redirecionamento || 'whatsapp';

  if (tipo === 'email') {
    const email = config?.emailCustomizado || '';
    if (email) {
      return `mailto:${email}?subject=${encodeURIComponent('Renovação de Plano IPTV')}&body=${encodeURIComponent(mensagem)}`;
    }
    return linkWhatsappSuporte(mensagem);
  }

  if (tipo === 'url') {
    const url = config?.urlCustomizada || '';
    if (url) {
      // Tenta substituir variáveis na URL se houver
      return url
        .replace('{nome}', cliente?.nome || '')
        .replace('{cliente_id}', cliente?.id || '')
        .replace('{email}', cliente?.email || '');
    }
    return linkWhatsappSuporte(mensagem);
  }

  // Padrão: WhatsApp
  return linkWhatsappSuporte(mensagem);
}

module.exports = {
  inicializarFirebase,
  formatarData,
  substituirVariaveis,
  enviarPush,
  enviarEmail,
  linkWhatsappSuporte,
  gerarLinkRedirecionamento
};
