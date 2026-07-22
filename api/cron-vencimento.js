// ============================================
// CRON AUTOMÁTICO — Notificações de vencimento a cada 12h
// ============================================

const { enviarPush, enviarEmail, substituirVariaveis, calcularDiasRestantes, inicializarFirebase } = require('./lib/mensagens');
const admin = inicializarFirebase();
const db = admin.database();

module.exports = async (req, res) => {
  console.log('\n' + '='.repeat(70));
  console.log('⏰ CRON INICIADO — Verificando vencimentos');
  console.log('='.repeat(70));

  try {
    // Carrega templates
    const snapshotConfig = await db.ref('config/templates').once('value');
    const config = snapshotConfig.val() || {};

    const templates = {
      aviso_3_dias: config.aviso_3_dias?.push || 'Olá {nome}! Seu plano vence em {dias_restantes} dias ({data_vencimento}). Renove agora!',
      aviso_hoje: config.aviso_hoje?.push || 'Olá {nome}! Seu plano vence HOJE. Renove agora para não perder o acesso!',
      aviso_vencido: config.aviso_vencido?.push || 'Olá {nome}, seu plano está vencido há {dias_restantes} dia(s). Renove para reativar.',
      email_3_dias: config.aviso_3_dias?.whatsapp || 'Seu plano vence em {dias_restantes} dias.',
      email_hoje: config.aviso_hoje?.whatsapp || 'Seu plano vence hoje!',
      email_vencido: config.aviso_vencido?.whatsapp || 'Seu plano está vencido.'
    };

    // Carrega todos os clientes
    const snapshotClientes = await db.ref('clientes').once('value');
    const clientes = snapshotClientes.val() || {};

    let notificadasVencendo = 0;
    let notificadasHoje = 0;
    let notificadasVencidas = 0;

    for (const [clienteId, cliente] of Object.entries(clientes)) {
      if (!cliente.nome || !cliente.vencimento) continue;

      const dias = calcularDiasRestantes(cliente.vencimento);
      const ultimaNotificacao = cliente.ultimaNotificacao || {};

      console.log(`\n📊 ${cliente.nome}: ${dias} dias`);

      // Aviso 3 dias antes
      if (dias === 3 && !ultimaNotificacao.aviso_3_dias) {
        console.log(`  → Enviando: Aviso 3 dias`);
        
        const titulo = `Sua assinatura vence em 3 dias`;
        const corpo = substituirVariaveis(templates.aviso_3_dias, cliente);

        if (cliente.fcmToken) {
          await enviarPush(cliente.fcmToken, titulo, corpo);
        }
        if (cliente.email) {
          await enviarEmail(cliente.email, titulo, corpo);
        }

        await db.ref(`clientes/${clienteId}/ultimaNotificacao/aviso_3_dias`).set(new Date().toISOString());
        notificadasVencendo++;
      }

      // Aviso no dia do vencimento
      if (dias === 0 && !ultimaNotificacao.aviso_hoje) {
        console.log(`  → Enviando: Aviso Hoje`);
        
        const titulo = `Sua assinatura vence HOJE!`;
        const corpo = substituirVariaveis(templates.aviso_hoje, cliente);

        if (cliente.fcmToken) {
          await enviarPush(cliente.fcmToken, titulo, corpo);
        }
        if (cliente.email) {
          await enviarEmail(cliente.email, titulo, corpo);
        }

        await db.ref(`clientes/${clienteId}/ultimaNotificacao/aviso_hoje`).set(new Date().toISOString());
        notificadasHoje++;
      }

      // Avisos após vencimento (1, 2, 3 dias)
      if (dias < 0 && dias >= -3 && !ultimaNotificacao[`aviso_vencido_${Math.abs(dias)}`]) {
        console.log(`  → Enviando: Aviso Vencido (${Math.abs(dias)} dia(s))`);
        
        const titulo = `Sua assinatura está VENCIDA!`;
        const corpoTemplate = templates.aviso_vencido.replace('{dias_restantes}', Math.abs(dias));
        const corpo = substituirVariaveis(corpoTemplate, cliente);

        if (cliente.fcmToken) {
          await enviarPush(cliente.fcmToken, titulo, corpo);
        }
        if (cliente.email) {
          await enviarEmail(cliente.email, titulo, corpo);
        }

        await db.ref(`clientes/${clienteId}/ultimaNotificacao/aviso_vencido_${Math.abs(dias)}`).set(new Date().toISOString());
        notificadasVencidas++;
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('📊 RESUMO:');
    console.log(`   ✅ Aviso 3 dias: ${notificadasVencendo} cliente(s)`);
    console.log(`   ✅ Aviso Hoje: ${notificadasHoje} cliente(s)`);
    console.log(`   ✅ Aviso Vencido: ${notificadasVencidas} cliente(s)`);
    console.log('='.repeat(70) + '\n');

    res.status(200).json({ 
      ok: true, 
      aviso_3_dias: notificadasVencendo,
      aviso_hoje: notificadasHoje,
      aviso_vencido: notificadasVencidas
    });

  } catch (err) {
    console.error('❌ ERRO NO CRON:', err.message);
    res.status(500).json({ ok: false, erro: err.message });
  }
};
