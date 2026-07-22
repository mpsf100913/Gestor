// ============================================
// ENVIO MANUAL — push e/ou e-mail para clientes selecionados no painel admin
// ============================================

const { inicializarFirebase, substituirVariaveis, enviarPush, enviarEmail, linkWhatsappSuporte, gerarLinkRedirecionamento } = require('./lib/mensagens');

const admin = inicializarFirebase();
const db = admin.database();

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, erro: 'Método não permitido' });
  }

  try {
    const { ids, canal, mensagem, assunto, imagem } = req.body;

    console.log('Envio manual recebido:', { ids: ids.length, canal, mensagem: mensagem.substring(0, 50), assunto, imagem });

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ ok: false, erro: 'Nenhum cliente selecionado' });
    }
    if (!mensagem) {
      return res.status(400).json({ ok: false, erro: 'Mensagem vazia' });
    }

    // Carrega a configuração de redirecionamento
    const snapshotConfig = await db.ref('config/templates').once('value');
    const config = snapshotConfig.val() || {};

    let enviados = 0;

    for (const id of ids) {
      const snapshot = await db.ref(`clientes/${id}`).once('value');
      const cliente = snapshot.val();
      if (!cliente) {
        console.log(`❌ Cliente ${id} não encontrado`);
        continue;
      }

      console.log(`✅ Cliente encontrado: ${cliente.nome}`, {
        temFcmToken: !!cliente.fcmToken,
        fcmToken: cliente.fcmToken ? cliente.fcmToken.substring(0, 30) + '...' : 'VAZIO',
        temEmail: !!cliente.email,
        email: cliente.email
      });

      const corpo = substituirVariaveis(mensagem, cliente);
      const tituloAssunto = substituirVariaveis(assunto || 'Aviso do seu plano IPTV', cliente);
      const linkClick = gerarLinkRedirecionamento(config, corpo, cliente);

      console.log(`Enviando para ${cliente.nome}:`, { imagem, linkClick: linkClick.substring(0, 50) });

      let algumEnvio = false;

      if (canal === 'push' || canal === 'ambos') {
        if (!cliente.fcmToken) {
          console.log(`⚠️ ${cliente.nome}: Sem FCM Token, push não enviado`);
        } else {
          console.log(`📤 Enviando PUSH para ${cliente.nome}...`);
          const ok = await enviarPush(cliente.fcmToken, tituloAssunto, corpo, linkClick, imagem);
          console.log(`Push resultado: ${ok ? '✅ Sucesso' : '❌ Falhou'}`);
          if (ok) algumEnvio = true;
        }
      }
      if (canal === 'email' || canal === 'ambos') {
        if (!cliente.email) {
          console.log(`⚠️ ${cliente.nome}: Sem email, email não enviado`);
        } else {
          console.log(`📧 Enviando EMAIL para ${cliente.email}...`);
          const ok = await enviarEmail(cliente.email, tituloAssunto, corpo);
          console.log(`Email resultado: ${ok ? '✅ Sucesso' : '❌ Falhou'}`);
          if (ok) algumEnvio = true;
          // Se cliente registrou um email customizado, envia também lá
          if (cliente.emailNotificacao && cliente.emailNotificacao !== cliente.email) {
            console.log(`📧 Enviando também para EMAIL CUSTOMIZADO: ${cliente.emailNotificacao}...`);
            const ok2 = await enviarEmail(cliente.emailNotificacao, tituloAssunto, corpo);
            console.log(`Email customizado resultado: ${ok2 ? '✅ Sucesso' : '❌ Falhou'}`);
            if (ok2) algumEnvio = true;
          }
        }
      }

      console.log(`Resultado final para ${cliente.nome}: ${algumEnvio ? '✅ NOTIFICADO' : '❌ NÃO notificado'}`);
      if (algumEnvio) enviados++;
    }

    console.log(`\n📊 RESUMO: ${enviados} cliente(s) notificado(s) de ${ids.length}`);
    res.status(200).json({ ok: true, enviados });
  } catch (err) {
    console.error('Erro no envio manual:', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
};
