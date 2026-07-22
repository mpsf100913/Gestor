const admin = require('firebase-admin');
const { enviarPush, enviarEmail, linkWhatsapp, htmlEmail } = require('./lib/notificacoes');

const db = admin.database();

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false });
  }

  try {
    const { ids, canal, mensagem } = req.body;

    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ ok: false, erro: 'IDs vazios' });
    }

    let enviados = 0;

    for (const id of ids) {
      const snap = await db.ref(`clientes/${id}`).once('value');
      const cliente = snap.val();

      if (!cliente) continue;

      if (canal === 'push' && cliente.fcmToken) {
        await enviarPush(cliente.fcmToken, 'Cobrança', mensagem);
        enviados++;
      }

      if (canal === 'email' && cliente.email) {
        const linkAtivar = `https://aviso.fenixsocial.site/ativar-notificacoes.html?id=${id}`;
        const html = htmlEmail('Cobrança', mensagem, linkAtivar);
        await enviarEmail(cliente.email, 'Cobrança - ' + cliente.nome, html);
        enviados++;
      }

      if (canal === 'whatsapp' && cliente.whatsapp) {
        const link = linkWhatsapp(cliente.whatsapp, mensagem);
        // Retornar link para o admin clicar
        console.log(`WhatsApp para ${cliente.nome}: ${link}`);
      }

      if (canal === 'todos') {
        if (cliente.fcmToken) await enviarPush(cliente.fcmToken, 'Cobrança', mensagem);
        if (cliente.email) {
          const linkAtivar = `https://aviso.fenixsocial.site/ativar-notificacoes.html?id=${id}`;
          const html = htmlEmail('Cobrança', mensagem, linkAtivar);
          await enviarEmail(cliente.email, 'Cobrança - ' + cliente.nome, html);
        }
        enviados++;
      }
    }

    res.json({ ok: true, enviados });
  } catch (err) {
    console.error('Erro:', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
};
