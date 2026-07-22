// ============================================
// ENVIO MANUAL — Push e Email para clientes selecionados
// ============================================

const { enviarPush, enviarEmail, substituirVariaveis, inicializarFirebase } = require('./lib/mensagens');
const admin = inicializarFirebase();
const db = admin.database();

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, erro: 'Método não permitido' });
  }

  try {
    const { ids, canal, mensagem, assunto } = req.body;

    console.log('\n' + '='.repeat(60));
    console.log('📤 ENVIANDO NOTIFICAÇÕES MANUAIS');
    console.log('='.repeat(60));
    console.log(`📊 Clientes: ${ids.length}`);
    console.log(`📢 Canal: ${canal}`);

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ ok: false, erro: 'Nenhum cliente selecionado' });
    }

    if (!mensagem) {
      return res.status(400).json({ ok: false, erro: 'Mensagem vazia' });
    }

    let enviados = 0;

    for (const id of ids) {
      try {
        const snapshot = await db.ref(`clientes/${id}`).once('value');
        const cliente = snapshot.val();

        if (!cliente) {
          console.log(`⚠️ Cliente ${id} não encontrado`);
          continue;
        }

        console.log(`\n✅ ${cliente.nome}`);

        const corpo = substituirVariaveis(mensagem, cliente);
        const tituloAssunto = substituirVariaveis(assunto || 'Aviso do seu plano IPTV', cliente);

        let enviouAlgo = false;

        // PUSH
        if ((canal === 'push' || canal === 'ambos') && cliente.fcmToken) {
          const ok = await enviarPush(cliente.fcmToken, tituloAssunto, corpo);
          if (ok) enviouAlgo = true;
        }

        // EMAIL
        if ((canal === 'email' || canal === 'ambos') && cliente.email) {
          const ok = await enviarEmail(cliente.email, tituloAssunto, corpo);
          if (ok) enviouAlgo = true;
        }

        if (enviouAlgo) {
          enviados++;
          console.log(`✅ ${cliente.nome}: NOTIFICADO`);
        }

      } catch (clientErr) {
        console.error(`❌ Erro processando ${id}:`, clientErr.message);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`📊 RESULTADO: ${enviados}/${ids.length} notificados`);
    console.log('='.repeat(60) + '\n');

    res.status(200).json({ ok: true, enviados });

  } catch (err) {
    console.error('❌ ERRO:', err.message);
    res.status(500).json({ ok: false, erro: err.message });
  }
};
