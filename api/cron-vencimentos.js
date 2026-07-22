const admin = require('firebase-admin');
const { enviarPush, enviarEmail, htmlEmail } = require('./lib/notificacoes');

const db = admin.database();

function calcularDias(dataStr) {
  const venc = new Date(dataStr);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((venc - hoje) / (1000 * 60 * 60 * 24));
}

module.exports = async (req, res) => {
  try {
    console.log('⏰ Cron iniciado');

    const snap = await db.ref('clientes').once('value');
    const clientes = snap.val() || {};

    let notif = 0;

    for (const [id, c] of Object.entries(clientes)) {
      if (!c.vencimento) continue;

      const dias = calcularDias(c.vencimento);
      const linkAtivar = `https://aviso.fenixsocial.site/ativar-notificacoes.html?id=${id}`;

      let msg = '', assunto = '';

      // 3 dias antes
      if (dias === 3) {
        msg = `Seu plano vence em 3 dias (${c.vencimento})`;
        assunto = 'Seu plano vence em 3 dias';
      }

      // Hoje
      if (dias === 0) {
        msg = `Seu plano vence HOJE!`;
        assunto = 'Seu plano vence HOJE!';
      }

      // Vencido (até 3 dias)
      if (dias < 0 && dias >= -3) {
        msg = `Seu plano está vencido há ${Math.abs(dias)} dia(s)`;
        assunto = 'Seu plano está vencido';
      }

      if (!msg) continue;

      if (c.fcmToken) {
        await enviarPush(c.fcmToken, assunto, msg);
      }

      if (c.email) {
        const html = htmlEmail(assunto, msg, linkAtivar);
        await enviarEmail(c.email, assunto, html);
      }

      notif++;
    }

    console.log(`✅ ${notif} notificações enviadas`);
    res.json({ ok: true, notificacoes: notif });
  } catch (err) {
    console.error('❌ Erro:', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
};
