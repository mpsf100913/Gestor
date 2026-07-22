// ============================================
// NOVO SISTEMA DE ENVIO — SIMPLES E FUNCIONAL
// ============================================

const axios = require('axios');

const DB_URL = process.env.FIREBASE_DATABASE_URL || 'https://gestor-22b13-default-rtdb.firebaseio.com';
const WHATSAPP_NUMERO = process.env.WHATSAPP_NUMERO || '21987214698';
const EMAIL_REMETENTE = process.env.EMAIL_REMETENTE || 'avisos@fenixsocial.site';

// ============================================
// ENVIAR PUSH VIA FCM REST API
// ============================================
async function enviarPushFCM(fcmToken, titulo, corpo) {
  if (!fcmToken || !fcmToken.trim()) {
    console.log('⚠️ FCM Token vazio, pulando push');
    return false;
  }

  try {
    console.log(`📤 Tentando enviar PUSH...`);
    console.log(`   Título: ${titulo}`);
    console.log(`   Token: ${fcmToken.substring(0, 40)}...`);

    // Usa a FCM REST API v1 do Firebase
    const projectId = 'gestor-22b13';
    const accessToken = await obterAccessToken();

    if (!accessToken) {
      console.log('⚠️ Não conseguiu access token, continuando sem push');
      return false;
    }

    const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    const response = await axios.post(url, {
      message: {
        token: fcmToken,
        notification: {
          title: titulo,
          body: corpo
        },
        webpush: {
          fcmOptions: {
            link: 'https://aviso.fenixsocial.site'
          }
        }
      }
    }, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`✅ PUSH ENVIADO! ID: ${response.data.name}`);
    return true;

  } catch (err) {
    console.log(`⚠️ Erro ao enviar push (não crítico): ${err.message}`);
    // Não retorna false, continua com email
    return false;
  }
}

// ============================================
// OBTER ACCESS TOKEN
// ============================================
async function obterAccessToken() {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
    
    if (!serviceAccount.private_key) {
      console.log('⚠️ FIREBASE_SERVICE_ACCOUNT não configurado');
      return null;
    }

    const jwt = require('jsonwebtoken');
    const now = Math.floor(Date.now() / 1000);

    const token = jwt.sign({
      iss: serviceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now
    }, serviceAccount.private_key, {
      algorithm: 'RS256'
    });

    const response = await axios.post('https://oauth2.googleapis.com/token', {
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: token
    });

    return response.data.access_token;

  } catch (err) {
    console.log(`⚠️ Erro ao obter access token: ${err.message}`);
    return null;
  }
}

// ============================================
// ENVIAR EMAIL VIA RESEND
// ============================================
async function enviarEmailResend(destino, assunto, corpo) {
  if (!destino || !EMAIL_REMETENTE) {
    console.log('⚠️ Email ou remetente vazio');
    return false;
  }

  try {
    const { Resend } = require('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);

    console.log(`📧 Enviando EMAIL para: ${destino}`);

    await resend.emails.send({
      from: EMAIL_REMETENTE,
      to: destino,
      subject: assunto,
      html: `<p>${corpo}</p>`
    });

    console.log(`✅ EMAIL ENVIADO!`);
    return true;

  } catch (err) {
    console.log(`⚠️ Erro ao enviar email: ${err.message}`);
    return false;
  }
}

// ============================================
// BUSCAR CLIENTE NO FIREBASE
// ============================================
async function buscarCliente(clienteId) {
  try {
    const url = `${DB_URL}/clientes/${clienteId}.json`;
    const response = await axios.get(url);
    return response.data;
  } catch (err) {
    console.log(`❌ Erro ao buscar cliente: ${err.message}`);
    return null;
  }
}

// ============================================
// API ENDPOINT
// ============================================
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, erro: 'Método não permitido' });
  }

  try {
    const { ids, canal, mensagem, assunto } = req.body;

    console.log('\n' + '='.repeat(60));
    console.log('🟦 ENVIANDO NOTIFICAÇÕES');
    console.log('='.repeat(60));
    console.log(`📊 Clientes: ${ids.length}`);
    console.log(`📢 Canal: ${canal}`);
    console.log(`📝 Mensagem: ${mensagem.substring(0, 50)}...`);

    if (!Array.isArray(ids) || ids.length === 0) {
      console.log('❌ IDs vazios');
      return res.status(400).json({ ok: false, erro: 'Nenhum cliente selecionado' });
    }

    if (!mensagem) {
      console.log('❌ Mensagem vazia');
      return res.status(400).json({ ok: false, erro: 'Mensagem vazia' });
    }

    let enviados = 0;

    for (const id of ids) {
      console.log(`\n🟩 Processando: ${id}`);

      const cliente = await buscarCliente(id);

      if (!cliente) {
        console.log(`⚠️ Cliente não encontrado`);
        continue;
      }

      console.log(`✅ Cliente: ${cliente.nome}`);
      console.log(`   Servidor: ${cliente.servidor}`);
      console.log(`   Email: ${cliente.email || 'sem email'}`);
      console.log(`   FCM Token: ${cliente.fcmToken ? 'SIM' : 'NÃO'}`);

      let enviouAlgo = false;

      // PUSH
      if (canal === 'push' || canal === 'ambos') {
        if (cliente.fcmToken) {
          const ok = await enviarPushFCM(cliente.fcmToken, assunto || 'Aviso', mensagem);
          if (ok) enviouAlgo = true;
        } else {
          console.log(`⚠️ Sem FCM Token para push`);
        }
      }

      // EMAIL
      if (canal === 'email' || canal === 'ambos') {
        if (cliente.email) {
          const ok = await enviarEmailResend(cliente.email, assunto || 'Aviso do seu plano', mensagem);
          if (ok) enviouAlgo = true;
        } else {
          console.log(`⚠️ Sem email registrado`);
        }
      }

      if (enviouAlgo) {
        enviados++;
        console.log(`✅ ${cliente.nome}: NOTIFICADO`);
      } else {
        console.log(`❌ ${cliente.nome}: NÃO notificado`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`📊 RESULTADO: ${enviados}/${ids.length} notificados`);
    console.log('='.repeat(60) + '\n');

    res.status(200).json({ ok: true, enviados });

  } catch (err) {
    console.error('❌ ERRO CRÍTICO:', err.message);
    res.status(500).json({ ok: false, erro: err.message });
  }
};
