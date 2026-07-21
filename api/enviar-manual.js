// ============================================
// ENVIO MANUAL — push e/ou e-mail para clientes selecionados no painel admin
// ============================================

const { inicializarFirebase, substituirVariaveis, enviarPush, enviarEmail } = require('./lib/mensagens');

const admin = inicializarFirebase();
const db = admin.database();

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, erro: 'Método não permitido' });
  }

  try {
    const { ids, canal, mensagem, assunto } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ ok: false, erro: 'Nenhum cliente selecionado' });
    }
    if (!mensagem) {
      return res.status(400).json({ ok: false, erro: 'Mensagem vazia' });
    }

    let enviados = 0;

    for (const id of ids) {
      const snapshot = await db.ref(`clientes/${id}`).once('value');
      const cliente = snapshot.val();
      if (!cliente) continue;

      const corpo = substituirVariaveis(mensagem, cliente);
      const tituloAssunto = substituirVariaveis(assunto || 'Aviso do seu plano IPTV', cliente);

      let algumEnvio = false;

      if (canal === 'push' || canal === 'ambos') {
        const ok = await enviarPush(cliente.fcmToken, tituloAssunto, corpo);
        if (ok) algumEnvio = true;
      }
      if (canal === 'email' || canal === 'ambos') {
        const ok = await enviarEmail(cliente.email, tituloAssunto, corpo);
        if (ok) algumEnvio = true;
      }

      if (algumEnvio) enviados++;
    }

    res.status(200).json({ ok: true, enviados });
  } catch (err) {
    console.error('Erro no envio manual:', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
};
