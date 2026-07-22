const { inicializarFirebase } = require('./lib/mensagens');
const admin = inicializarFirebase();
const db = admin.database();

// Importa as funções DEPOIS de inicializar
const { substituirVariaveis, enviarPush, enviarEmail, gerarLinkRedirecionamento } = require('./lib/mensagens');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, erro: 'Método não permitido' });
  }

  try {
    const { ids, canal, mensagem, assunto, imagem } = req.body;

    console.log('🟦 Envio manual recebido:', { ids: ids.length, canal });

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ ok: false, erro: 'Nenhum cliente selecionado' });
    }
    if (!mensagem) {
      return res.status(400).json({ ok: false, erro: 'Mensagem vazia' });
    }

    // Carrega config
    const snapshotConfig = await db.ref('config/templates').once('value');
    const config = snapshotConfig.val() || {};

    let enviados = 0;

    for (const id of ids) {
      try {
        const snapshot = await db.ref(`clientes/${id}`).once('value');
        const cliente = snapshot.val();
        
        if (!cliente) {
          console.log(`❌ Cliente ${id} não encontrado`);
          continue;
        }

        console.log(`\n✅ Processando: ${cliente.nome}`);
        console.log(`   fcmToken: ${cliente.fcmToken ? 'SIM' : 'NÃO'}`);
        console.log(`   email: ${cliente.email || 'vazio'}`);

        const corpo = substituirVariaveis(mensagem, cliente);
        const tituloAssunto = substituirVariaveis(assunto || 'Aviso do seu plano IPTV', cliente);
        const linkClick = gerarLinkRedirecionamento(config, corpo, cliente);

        let algumEnvio = false;

        // PUSH
        if ((canal === 'push' || canal === 'ambos') && cliente.fcmToken) {
          console.log(`📤 Enviando PUSH...`);
          const ok = await enviarPush(cliente.fcmToken, tituloAssunto, corpo, linkClick, imagem);
          if (ok) {
            console.log(`✅ PUSH enviado!`);
            algumEnvio = true;
          } else {
            console.log(`❌ PUSH falhou!`);
          }
        }

        // EMAIL
        if ((canal === 'email' || canal === 'ambos') && cliente.email) {
          console.log(`📧 Enviando EMAIL...`);
          const ok = await enviarEmail(cliente.email, tituloAssunto, corpo);
          if (ok) {
            console.log(`✅ EMAIL enviado!`);
            algumEnvio = true;
          }
        }

        if (algumEnvio) {
          enviados++;
          console.log(`✅ ${cliente.nome}: NOTIFICADO`);
        } else {
          console.log(`⚠️ ${cliente.nome}: NÃO notificado`);
        }

      } catch (clientErr) {
        console.error(`❌ Erro processando cliente ${id}:`, clientErr.message);
      }
    }

    console.log(`\n📊 RESUMO FINAL: ${enviados}/${ids.length} clientes notificados\n`);
    res.status(200).json({ ok: true, enviados });

  } catch (err) {
    console.error('❌ ERRO GERAL:', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
};
