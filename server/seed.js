const bcrypt = require('bcryptjs');
const db = require('./db');
const { SERVICE_POINTS_BY_CATEGORY, REWARD_POINT_COSTS, WELCOME_BONUS_POINTS } = require('./config/loyalty');

function seedDatabase() {
  console.log('--- A inicializar Base de Dados com Dados de Demonstração (Lava Já AI) ---');

  // Clear tables in reverse dependency order
  db.exec(`
    DELETE FROM audit_logs;
    DELETE FROM notifications;
    DELETE FROM reward_redemptions;
    DELETE FROM rewards;
    DELETE FROM promotions;
    DELETE FROM loyalty_transactions;
    DELETE FROM loyalty_accounts;
    DELETE FROM reservation_status_history;
    DELETE FROM reservations;
    DELETE FROM services;
    DELETE FROM business_settings;
    DELETE FROM users;
  `);

  // Insert default business settings
  const insertSettings = db.prepare(`
    INSERT INTO business_settings (
      id, name, address, phone, email, google_maps_url, coordinates, 
      open_time, close_time, slot_interval_minutes, simultaneous_capacity, points_per_mzn, is_demo_mode
    ) VALUES (
      1,
      'Lava Já Matola - Lavagem rápida e de confiança',
      'Av. da Matola, Paragem Padaria, Matola, Moçambique',
      '+258 84 321 9876',
      'contacto@lavajamatola.co.mz',
      'https://maps.google.com/?q=Matola,+Mocambique',
      '-25.9622,32.4589',
      '07:30',
      '18:00',
      30,
      3,
      0.1,
      1
    )
  `);
  insertSettings.run();

  // Users
  const salt = bcrypt.genSaltSync(10);
  const adminPass = bcrypt.hashSync('admin123', salt);
  const employeePass = bcrypt.hashSync('func123', salt);
  const customerPass = bcrypt.hashSync('cliente123', salt);

  const insertUser = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, phone)
    VALUES (?, ?, ?, ?, ?)
  `);

  const adminId = insertUser.run('Nelson Mandlate (Administrador)', 'admin@lavaja.co.mz', adminPass, 'admin', '+258 84 999 0001').lastInsertRowid;
  const employee1Id = insertUser.run('Carlos Matsinhe (Operador Chefe)', 'funcionario@lavaja.co.mz', employeePass, 'employee', '+258 82 888 0002').lastInsertRowid;
  const employee2Id = insertUser.run('Armando Sitoe (Técnico de Lavagem)', 'armando@lavaja.co.mz', employeePass, 'employee', '+258 85 777 0003').lastInsertRowid;
  const customer1Id = insertUser.run('Inácio Cumbane (Cliente VIP)', 'cliente@lavaja.co.mz', customerPass, 'customer', '+258 84 555 1234').lastInsertRowid;
  const customer2Id = insertUser.run('Maria Chirindza', 'maria@gmail.com', customerPass, 'customer', '+258 86 444 5678').lastInsertRowid;

  // Services
  const insertService = db.prepare(`
    INSERT INTO services (name, description, category, price_mzn, duration_minutes, points_reward, is_active)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `);

  const s1 = insertService.run('Lavagem Exterior Rápida', 'Lavagem com espuma ativa, secagem com microfibra e limpeza de jantes básicas.', 'Básica', 250, 25, SERVICE_POINTS_BY_CATEGORY.BÁSICA).lastInsertRowid;
  const s2 = insertService.run('Lavagem Completa (Exterior + Interior)', 'Lavagem exterior de alta pressão, aspiração interior aprofundada, higienização do painel e ambientador suave.', 'Completa', 450, 40, SERVICE_POINTS_BY_CATEGORY.COMPLETA).lastInsertRowid;
  const s3 = insertService.run('Lavagem VIP Premium com Cera', 'Lavagem completa com cera carnaúba de alto brilho, hidratação de plásticos exteriores e pretinho nos pneus de longa duração.', 'Premium', 750, 60, SERVICE_POINTS_BY_CATEGORY.PREMIUM).lastInsertRowid;
  const s4 = insertService.run('Higienização de Estofos & Ar Condicionado', 'Lavagem a seco com extração profunda de sujidade dos bancos, teto e oxisanitização dos dutos do A/C.', 'Especializada', 1200, 90, SERVICE_POINTS_BY_CATEGORY.ESPECIALIZADA).lastInsertRowid;
  const s5 = insertService.run('Lavagem Técnica de Motor a Vapor', 'Desengorduramento meticuloso do motor com vapor seco e aplicação de verniz protetor anti-humidade.', 'Mecânica', 600, 45, SERVICE_POINTS_BY_CATEGORY.MECÂNICA).lastInsertRowid;

  // Loyalty Accounts
  const insertLoyalty = db.prepare(`
    INSERT INTO loyalty_accounts (user_id, balance_points, lifetime_points)
    VALUES (?, ?, ?)
  `);
  const demoCustomerPoints = SERVICE_POINTS_BY_CATEGORY.COMPLETA + WELCOME_BONUS_POINTS;
  const lAcc1 = insertLoyalty.run(customer1Id, demoCustomerPoints, demoCustomerPoints).lastInsertRowid;
  const lAcc2 = insertLoyalty.run(customer2Id, 0, 0).lastInsertRowid;

  // Loyalty Transactions
  const insertLTrans = db.prepare(`
    INSERT INTO loyalty_transactions (account_id, user_id, type, points, description)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertLTrans.run(lAcc1, customer1Id, 'earn', WELCOME_BONUS_POINTS, 'Pontos de boas-vindas do Passaporte Lava Já');
  insertLTrans.run(lAcc1, customer1Id, 'earn', SERVICE_POINTS_BY_CATEGORY.COMPLETA, 'Pontos acumulados na lavagem completa anterior');

  // Rewards
  const insertReward = db.prepare(`
    INSERT INTO rewards (title, description, points_cost, discount_mzn, service_id, is_active)
    VALUES (?, ?, ?, ?, ?, 1)
  `);
  insertReward.run('Perfumador de Painel & Ambientador VIP', 'Aplicação de fragrância premium e higienização do tablier.', REWARD_POINT_COSTS.AIR_FRESHENER, 80, null);
  insertReward.run('Aplicação Gratuita de Cera Protetora', 'Cera de carnaúba de alto brilho sem custo adicional.', REWARD_POINT_COSTS.WAX_APPLICATION, 150, null);
  insertReward.run('Desconto de 100 MT na Lavagem Completa', 'Abate 100 MZN no valor final da lavagem completa.', REWARD_POINT_COSTS.WASH_DISCOUNT, 100, s2);
  insertReward.run('Lavagem Exterior Grátis', 'Uma lavagem exterior 100% gratuita por fidelidade.', REWARD_POINT_COSTS.FREE_EXTERIOR_WASH, 250, s1);

  // Promotions
  const insertPromo = db.prepare(`
    INSERT INTO promotions (title, description, code, discount_percentage, service_id, start_date, end_date, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `);
  insertPromo.run('Super Quarta-Feira', '20% de desconto em qualquer serviço todas as quartas-feiras', 'QUARTA20', 20, null, '2026-01-01', '2026-12-31');
  insertPromo.run('Desconto Residentes da Matola', '15% de desconto especial para residentes e empresas da Matola', 'MATOLA15', 15, null, '2026-01-01', '2026-12-31');
  insertPromo.run('Boas-Vindas Lava Já Matola', '10% de desconto na primeira reserva feita pela plataforma', 'LAVAJA10', 10, null, '2026-01-01', '2026-12-31');

  // Reservations (using current date for demonstration)
  const today = new Date().toISOString().split('T')[0];

  const insertRes = db.prepare(`
    INSERT INTO reservations (
      reference_code, user_id, customer_name, customer_phone, vehicle_plate, 
      vehicle_model, service_id, scheduled_date, scheduled_time, duration_minutes, 
      end_time, bay_number, status, notes, points_awarded
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertHistory = db.prepare(`
    INSERT INTO reservation_status_history (reservation_id, old_status, new_status, changed_by_user_id, notes)
    VALUES (?, ?, ?, ?, ?)
  `);

  // Res 1: Concluído hoje mais cedo
  const r1 = insertRes.run(
    'LJ-9821', customer1Id, 'Inácio Cumbane', '+258 84 555 1234', 'AEL 789 MP', 
    'Toyota Hilux D4D', s2, today, '08:30', 40, '09:10', 1, 'concluido', 'Cliente pediu atenção redobrada na caixa traseira', 1
  ).lastInsertRowid;
  insertHistory.run(r1, null, 'reservado', customer1Id, 'Reserva confirmada pelo cliente');
  insertHistory.run(r1, 'reservado', 'aguardando', employee1Id, 'Veículo deu entrada nas instalações');
  insertHistory.run(r1, 'aguardando', 'em_atendimento', employee1Id, 'Lavagem iniciada na Vaga 1');
  insertHistory.run(r1, 'em_atendimento', 'concluido', employee1Id, 'Serviço finalizado com sucesso. Pontos creditados.');

  // Res 2: Em Atendimento agora (Vaga 1)
  const r2 = insertRes.run(
    'LJ-4412', customer2Id, 'Maria Chirindza', '+258 86 444 5678', 'MC-12-34', 
    'Mazda Demio Vermelho', s3, today, '10:00', 60, '11:00', 1, 'em_atendimento', 'Lavagem VIP com cera', 0
  ).lastInsertRowid;
  insertHistory.run(r2, null, 'reservado', customer2Id, 'Criado via plataforma');
  insertHistory.run(r2, 'reservado', 'em_atendimento', employee1Id, 'Iniciado atendimento na Vaga 1');

  // Res 3: A aguardar na fila (Vaga 2)
  const r3 = insertRes.run(
    'LJ-5590', customer1Id, 'Inácio Cumbane', '+258 84 555 1234', 'ABC 456 MP', 
    'Ford Ranger Cinzento', s1, today, '10:30', 25, '10:55', 2, 'aguardando', 'Cliente aguarda na sala VIP de espera', 0
  ).lastInsertRowid;
  insertHistory.run(r3, null, 'reservado', customer1Id, 'Reserva antecipada');
  insertHistory.run(r3, 'reservado', 'aguardando', employee2Id, 'Veículo estacionado na fila de espera');

  // Res 4: Reservado para a tarde
  const r4 = insertRes.run(
    'LJ-7823', null, 'Dr. Arnaldo Langa', '+258 82 111 2233', 'AFG 890 MC', 
    'Mercedes Benz C200 Preto', s4, today, '14:00', 90, '15:30', 3, 'reservado', 'Agendamento corporativo', 0
  ).lastInsertRowid;
  insertHistory.run(r4, null, 'reservado', adminId, 'Reserva criada pela recepção');

  // Notifications
  const insertNotif = db.prepare(`
    INSERT INTO notifications (user_id, target_role, title, message, type, is_read, reservation_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertNotif.run(customer1Id, 'customer', 'Serviço Concluído! 🚗✨', 'A lavagem do seu Toyota Hilux (AEL 789 MP) foi concluída com sucesso! O veículo está pronto para levantamento.', 'success', 0, r1);
  insertNotif.run(customer1Id, 'customer', 'Pontos Creditados no Passaporte', `Parabéns! Ganhou ${SERVICE_POINTS_BY_CATEGORY.COMPLETA} pontos com o seu serviço concluído.`, 'info', 0, r1);
  insertNotif.run(null, 'employee', 'Novo veículo na fila', 'Ford Ranger (ABC 456 MP) deu entrada e está pronto para atendimento na Vaga 2.', 'info', 0, r3);
  insertNotif.run(null, 'admin', 'Resumo matinal', '3 serviços agendados para a manhã de hoje.', 'info', 1, null);

  // Audit Logs
  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (user_id, action, entity, entity_id, details)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertAudit.run(adminId, 'INITIALIZE_SEED', 'system', '1', 'Base de dados inicializada com dados de demonstração');

  console.log('✅ Base de Dados semeada com sucesso com dados realistas do Lava Já AI!');
}

if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };
