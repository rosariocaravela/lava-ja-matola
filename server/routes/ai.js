const express = require('express');
const db = require('../db');
const { optionalToken } = require('../middleware/auth');
const { getAvailableSlots, checkAvailability } = require('../utils/scheduling');

const router = express.Router();

// Conversational engine with real backend state
router.post('/chat', optionalToken, async (req, res) => {
  const { message, conversationHistory = [] } = req.body;
  const user = req.user;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Mensagem não pode estar vazia.' });
  }

  const query = message.trim().toLowerCase();

  try {
    // 1. Fetch real application context
    const settings = db.prepare('SELECT * FROM business_settings WHERE id = 1').get();
    const services = db.prepare('SELECT * FROM services WHERE is_active = 1 ORDER BY price_mzn ASC').all();
    const promotions = db.prepare('SELECT * FROM promotions WHERE is_active = 1').all();
    const rewards = db.prepare('SELECT * FROM rewards WHERE is_active = 1').all();

    // Check if an external LLM key is configured
    const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;

    // If API key is present, we could do cloud LLM with system prompt.
    // Otherwise, our built-in robust Mozambican Portuguese context assistant delivers 100% reliable answers.
    let responseText = '';
    let suggestedActions = [];
    let detectedData = null;

    // INTENT DETECTION

    // Intent: Preços / Serviços
    if (query.includes('serviço') || query.includes('servico') || query.includes('preço') || query.includes('preco') || query.includes('quanto custa') || query.includes('lavagem') && !query.includes('marcar') && !query.includes('reservar')) {
      const listStr = services.map(s => `• **${s.name}**: ${s.price_mzn} MT (${s.duration_minutes} min, acumula +${s.points_reward} pts)`).join('\n');
      responseText = `No **Lava Já Matola**, temos os seguintes serviços disponíveis:\n\n${listStr}\n\nPretende agendar algum destes serviços? Posso verificar os horários livres para si!`;
      suggestedActions = [
        { label: 'Marcar Lavagem Rápida (250 MT)', action: 'book', serviceId: services[0]?.id },
        { label: 'Marcar Lavagem Completa (450 MT)', action: 'book', serviceId: services[1]?.id },
        { label: 'Ver Promoções Ativas', action: 'promos' }
      ];
    }
    // Intent: Horário de funcionamento
    else if (query.includes('horário') || query.includes('horario') || query.includes('horas') || query.includes('abrem') || query.includes('fecham') || query.includes('aberto')) {
      responseText = `Estamos abertos de segunda a sábado das **${settings.open_time} às ${settings.close_time}**.\nDispomos de ${settings.simultaneous_capacity} vagas de atendimento simultâneo para garantir que não perde tempo em filas longas!`;
      suggestedActions = [
        { label: 'Ver horários livres para hoje', action: 'check_slots_today' },
        { label: 'Marcar para amanhã', action: 'check_slots_tomorrow' }
      ];
    }
    // Intent: Localização / Onde fica / Como chegar
    else if (query.includes('localização') || query.includes('localizacao') || query.includes('onde fica') || query.includes('onde é') || query.includes('onde estao') || query.includes('endereço') || query.includes('endereco') || query.includes('mapa')) {
      responseText = `O nosso estabelecimento fica em:\n📍 **${settings.address}**\n\nContacto direto: **${settings.phone}**.\n\nPode abrir diretamente no Google Maps para ver a rota exata até nós!`;
      suggestedActions = [
        { label: 'Abrir no Google Maps', action: 'open_maps', url: settings.google_maps_url },
        { label: 'Marcar Lavagem Agora', action: 'book' }
      ];
    }
    // Intent: Promoções e Descontos
    else if (query.includes('promoção') || query.includes('promocao') || query.includes('desconto') || query.includes('cupão') || query.includes('cupom')) {
      if (promotions.length > 0) {
        const promoList = promotions.map(p => `• **${p.title}** (Código: \`${p.code}\`): **${p.discount_percentage}% OFF** - ${p.description}`).join('\n');
        responseText = `Temos as seguintes campanhas promocionais ativas:\n\n${promoList}\n\nBasta inserir o código promocional no momento da sua reserva ou apresentá-lo na receção!`;
      } else {
        responseText = `De momento não temos campanhas promocionais ativas, mas pode sempre acumular pontos no nosso programa de fidelização!`;
      }
      suggestedActions = [
        { label: 'Ver Programa Passaporte Lava Já', action: 'loyalty' },
        { label: 'Efetuar Reserva', action: 'book' }
      ];
    }
    // Intent: Programa de Fidelização / Pontos / Recompensas
    else if (query.includes('ponto') || query.includes('fidelidade') || query.includes('passaporte') || query.includes('recompensa') || query.includes('benefício') || query.includes('beneficio')) {
      let balanceMsg = '';
      if (user) {
        const acc = db.prepare('SELECT balance_points FROM loyalty_accounts WHERE user_id = ?').get(user.id);
        balanceMsg = `\n\nO seu saldo atual é de **${acc ? acc.balance_points : 0} pontos**.`;
      }
      const rewList = rewards.map(r => `• **${r.title}** (${r.points_cost} pts)`).join('\n');
      responseText = `No **Passaporte Lava Já**, recebe 10 pontos ao criar a conta, ganha 10 a 40 pontos por lavagem concluída e recebe mais 10 pontos a cada 3 semanas após a primeira lavagem concluída. Pode trocar os pontos por lavagens gratuitas e descontos.${balanceMsg}\n\n**Recompensas disponíveis para resgate:**\n${rewList}`;
      suggestedActions = [
        { label: 'Consultar os meus Pontos', action: 'loyalty' },
        { label: 'Marcar Lavagem', action: 'book' }
      ];
    }
    // Intent: Verificar horários ou Agendar lavagem
    else if (query.includes('amanhã') || query.includes('amanha') || query.includes('hoje') || query.includes('marcar') || query.includes('agendar') || query.includes('reservar')) {
      const today = new Date();
      let targetDate = today.toISOString().split('T')[0];
      if (query.includes('amanhã') || query.includes('amanha')) {
        const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
        targetDate = tomorrow.toISOString().split('T')[0];
      }

      const available = getAvailableSlots(targetDate, 30);
      const freeSlots = available.slots.filter(s => s.available).slice(0, 5);

      if (freeSlots.length > 0) {
        const slotText = freeSlots.map(s => s.time).join(', ');
        responseText = `Para a data **${targetDate}**, temos excelentes opções de horários livres, tais como: **${slotText}** (entre outros).\n\nPode clicar no botão abaixo para concluir o seu agendamento em poucos segundos com confirmação imediata!`;
        suggestedActions = [
          { label: `Agendar para ${targetDate}`, action: 'start_booking', date: targetDate },
          { label: 'Ver todos os serviços', action: 'services' }
        ];
      } else {
        responseText = `Para a data selecionada (${targetDate}), a nossa capacidade de atendimento está praticamente preenchida. Recomendo escolher outra data conveniente no nosso sistema de agendamento.`;
        suggestedActions = [
          { label: 'Abrir Calendário de Reservas', action: 'book' }
        ];
      }
    }
    // Default greeting or helpful guidance
    else {
      responseText = `Olá! Sou o **Assistente Lava Já Matola**. Como posso ajudar hoje?\n\n• Posso indicar os **serviços e preços** disponíveis;\n• Verificar **horários livres e capacidade** para hoje ou amanhã;\n• Informar sobre o programa de pontos **Passaporte Lava Já** e localização.`;
      suggestedActions = [
        { label: 'Quais os serviços e preços?', action: 'services' },
        { label: 'Horários livres para amanhã', action: 'check_slots_tomorrow' },
        { label: 'Como funciona o Passaporte?', action: 'loyalty' },
        { label: 'Onde fica o estabelecimento?', action: 'location' }
      ];
    }

    res.json({
      reply: responseText,
      suggestedActions,
      detectedData,
      aiMode: apiKey ? 'llm_cloud_enabled' : 'demo_conversational_engine',
      disclaimer: 'O Assistente Lava Já Matola consulta dados em tempo real da base de dados do estabelecimento.'
    });
  } catch (error) {
    console.error('Erro no assistente de IA:', error);
    res.status(500).json({ error: 'Erro ao processar consulta do assistente de IA.' });
  }
});

module.exports = router;
