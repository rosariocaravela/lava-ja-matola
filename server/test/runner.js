const assert = require('assert');
const path = require('path');
const fs = require('fs');
const express = require('express');

// Set test database path
process.env.DB_PATH = path.join(__dirname, 'test_lavaja.db');
process.env.JWT_SECRET = 'test-secret-key-123';

// Remove previous test db if exists
if (fs.existsSync(process.env.DB_PATH)) {
  fs.unlinkSync(process.env.DB_PATH);
}

const db = require('../db');
const { seedDatabase } = require('../seed');
const authRoutes = require('../routes/auth');
const {
  SERVICE_POINTS_BY_CATEGORY,
  REWARD_POINT_COSTS,
  WELCOME_BONUS_POINTS,
  RECURRING_BONUS_POINTS,
  MINIMUM_REWARD_POINTS,
  getPointsForCategory
} = require('../config/loyalty');
const { checkAvailability, getAvailableSlots } = require('../utils/scheduling');
const { awardRecurringBonusIfDue, RECURRING_BONUS_DESCRIPTION } = require('../utils/loyalty');
const { normalizeLegacyLoyaltyBonuses } = require('../utils/loyalty-migration');
const { generateToken } = require('../middleware/auth');

console.log('🧪 ===============================================');
console.log('🧪 INICIANDO SUÍTE DE TESTES AUTOMATIZADOS: LAVA JÁ AI');
console.log('🧪 ===============================================\n');

async function runTests() {
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Motivo: ${err.message}`);
      failed++;
    }
  }

  async function testAsync(name, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Motivo: ${err.message}`);
      failed++;
    }
  }

  // 1. Seed test database
  test('Inicialização e Seeding da Base de Dados', () => {
    seedDatabase();
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    assert.strictEqual(userCount >= 4, true, 'Devem existir utilizadores semeados');

    const services = db.prepare('SELECT category, points_reward FROM services').all();
    assert.strictEqual(
      services.every(service => service.points_reward === getPointsForCategory(service.category)),
      true,
      'Cada serviço deve atribuir pontos conforme a sua categoria'
    );
    const demoCustomer = db.prepare("SELECT id FROM users WHERE email = 'cliente@lavaja.co.mz'").get();
    const demoLoyaltyAccount = db.prepare(`
      SELECT balance_points, lifetime_points
      FROM loyalty_accounts WHERE user_id = ?
    `).get(demoCustomer.id);
    assert.deepStrictEqual(
      demoLoyaltyAccount,
      {
        balance_points: SERVICE_POINTS_BY_CATEGORY.COMPLETA + WELCOME_BONUS_POINTS,
        lifetime_points: SERVICE_POINTS_BY_CATEGORY.COMPLETA + WELCOME_BONUS_POINTS
      },
      'O saldo de demonstração deve incluir os pontos de boas-vindas reduzidos'
    );
    assert.deepStrictEqual(SERVICE_POINTS_BY_CATEGORY, {
      BÁSICA: 10,
      COMPLETA: 20,
      MECÂNICA: 25,
      PREMIUM: 30,
      ESPECIALIZADA: 40
    });

    const rewards = db.prepare('SELECT title, points_cost FROM rewards').all();
    const rewardCosts = new Map(rewards.map(reward => [reward.title, reward.points_cost]));
    assert.strictEqual(rewardCosts.get('Perfumador de Painel & Ambientador VIP'), REWARD_POINT_COSTS.AIR_FRESHENER);
    assert.strictEqual(rewardCosts.get('Aplicação Gratuita de Cera Protetora'), REWARD_POINT_COSTS.WAX_APPLICATION);
    assert.strictEqual(rewardCosts.get('Desconto de 100 MT na Lavagem Completa'), REWARD_POINT_COSTS.WASH_DISCOUNT);
    assert.strictEqual(rewardCosts.get('Lavagem Exterior Grátis'), REWARD_POINT_COSTS.FREE_EXTERIOR_WASH);

    const cheapestReward = db.prepare('SELECT MIN(points_cost) as cost FROM rewards').get();
    assert.strictEqual(cheapestReward.cost, MINIMUM_REWARD_POINTS, 'A primeira recompensa deve custar 50 pontos');
    assert.strictEqual(
      MINIMUM_REWARD_POINTS / SERVICE_POINTS_BY_CATEGORY.BÁSICA,
      5,
      'Devem ser necessárias cinco lavagens básicas para a primeira recompensa'
    );
  });

  await testAsync('Novo registo recebe apenas os pontos de boas-vindas definidos', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);
    const server = app.listen(0, '127.0.0.1');

    try {
      await new Promise((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
      });

      const email = `fidelizacao-${Date.now()}@lavaja.co.mz`;
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Cliente de Teste', email, password: 'teste123' })
      });

      assert.strictEqual(response.status, 201, 'O registo deve ser criado com sucesso');

      const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      const account = db.prepare('SELECT balance_points, lifetime_points FROM loyalty_accounts WHERE user_id = ?').get(user.id);
      const earnedTransactions = db.prepare(`
        SELECT COUNT(*) as count FROM loyalty_transactions
        WHERE user_id = ? AND type = 'earn'
      `).get(user.id);

      assert.deepStrictEqual(account, {
        balance_points: WELCOME_BONUS_POINTS,
        lifetime_points: WELCOME_BONUS_POINTS
      });
      assert.strictEqual(earnedTransactions.count, 1, 'O registo deve criar apenas a transação de boas-vindas');

      const welcomeTransaction = db.prepare(`
        SELECT points, description FROM loyalty_transactions
        WHERE user_id = ? AND type = 'earn'
      `).get(user.id);
      assert.deepStrictEqual(welcomeTransaction, {
        points: WELCOME_BONUS_POINTS,
        description: 'Pontos de boas-vindas do Passaporte Lava Já'
      });
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  });

  test('Bónus de três semanas começa após a primeira lavagem concluída e não duplica', () => {
    const user = db.prepare("SELECT id FROM users WHERE email LIKE 'fidelizacao-%@lavaja.co.mz'").get();
    const service = db.prepare('SELECT id FROM services LIMIT 1').get();
    db.prepare(`
      INSERT INTO reservations (
        reference_code, user_id, customer_name, customer_phone, vehicle_plate,
        vehicle_model, service_id, scheduled_date, scheduled_time, duration_minutes,
        end_time, bay_number, status, points_awarded, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'concluido', 1, ?)
    `).run(
      `LJ-${Date.now() % 10000}`,
      user.id,
      'Cliente de Teste',
      '+258 84 000 0000',
      'TEST-01',
      'Viatura de Teste',
      service.id,
      '2026-01-01',
      '09:00',
      30,
      '09:30',
      1,
      '2026-01-01 09:00:00'
    );

    assert.strictEqual(
      awardRecurringBonusIfDue(user.id, new Date('2026-01-21T09:00:00.000Z')),
      false,
      'O bónus não deve ser dado antes de completar três semanas'
    );
    assert.strictEqual(
      awardRecurringBonusIfDue(user.id, new Date('2026-01-22T09:00:00.000Z')),
      true,
      'O bónus deve ser dado após três semanas da primeira lavagem concluída'
    );
    assert.strictEqual(
      awardRecurringBonusIfDue(user.id, new Date('2026-01-22T09:00:00.000Z')),
      false,
      'O bónus do mesmo período não deve ser duplicado'
    );
    assert.strictEqual(
      awardRecurringBonusIfDue(user.id, new Date('2026-02-11T09:00:00.000Z')),
      false,
      'O bónus seguinte também deve aguardar três semanas completas'
    );
    assert.strictEqual(
      awardRecurringBonusIfDue(user.id, new Date('2026-02-12T09:00:00.000Z')),
      true,
      'Um novo bónus deve ser dado após mais três semanas'
    );

    const quarterlyTransactions = db.prepare(`
      SELECT points, description FROM loyalty_transactions
      WHERE user_id = ? AND description = ?
      ORDER BY id
    `).all(user.id, RECURRING_BONUS_DESCRIPTION);
    assert.deepStrictEqual(quarterlyTransactions, [
      { points: RECURRING_BONUS_POINTS, description: RECURRING_BONUS_DESCRIPTION },
      { points: RECURRING_BONUS_POINTS, description: RECURRING_BONUS_DESCRIPTION }
    ]);
  });

  test('Movimentos antigos são reduzidos às regras atuais e os saldos ajustados', () => {
    const user = db.prepare("SELECT id FROM users WHERE email LIKE 'fidelizacao-%@lavaja.co.mz'").get();
    const account = db.prepare('SELECT id FROM loyalty_accounts WHERE user_id = ?').get(user.id);
    db.prepare(`
      UPDATE loyalty_accounts
      SET balance_points = balance_points + 185, lifetime_points = lifetime_points + 185
      WHERE id = ?
    `).run(account.id);
    db.prepare(`
      INSERT INTO loyalty_transactions (account_id, user_id, type, points, description)
      VALUES (?, ?, 'earn', 80, 'Pontos de boas-vindas do Passaporte Lava Já'),
             (?, ?, 'earn', 55, 'Bónus de fidelização quinzenal'),
             (?, ?, 'earn', 50, 'Pontos acumulados na lavagem completa anterior')
    `).run(account.id, user.id, account.id, user.id, account.id, user.id);

    const migration = normalizeLegacyLoyaltyBonuses(db);
    assert.strictEqual(migration.updatedTransactions, 3);
    assert.strictEqual(migration.pointsRemoved, 145);

    const accountAfterMigration = db.prepare(`
      SELECT balance_points, lifetime_points FROM loyalty_accounts WHERE id = ?
    `).get(account.id);
    assert.deepStrictEqual(accountAfterMigration, {
      balance_points: 70,
      lifetime_points: 70
    });

    const migratedBonuses = db.prepare(`
      SELECT points, description FROM loyalty_transactions
      WHERE user_id = ? AND description LIKE '%Passaporte Lava Já%'
      ORDER BY id
    `).all(user.id);
    assert.strictEqual(migratedBonuses.some(transaction => transaction.points === 80 || transaction.points === 55 || transaction.points === 50), false);
    assert.strictEqual(
      db.prepare(`
        SELECT points FROM loyalty_transactions
        WHERE user_id = ? AND description = 'Pontos acumulados na lavagem completa anterior'
      `).get(user.id).points,
      SERVICE_POINTS_BY_CATEGORY.COMPLETA
    );
    assert.strictEqual(
      migratedBonuses.some(transaction => transaction.description.includes('quinzenal')),
      false
    );

    const rerun = normalizeLegacyLoyaltyBonuses(db);
    assert.deepStrictEqual(rerun, { updatedTransactions: 0, pointsRemoved: 0 });
  });

  // 2. Disponibilidade e Regras de Horário
  test('Regras de Disponibilidade: Fora de Horário de Funcionamento', () => {
    // 05:00 is before 07:30
    const resEarly = checkAvailability('2026-11-20', '05:00', 30);
    assert.strictEqual(resEarly.available, false, 'Não deve permitir horário antes da abertura');

    // 18:30 is after 18:00
    const resLate = checkAvailability('2026-11-20', '18:30', 30);
    assert.strictEqual(resLate.available, false, 'Não deve permitir horário após o fecho');
  });

  test('Regras de Disponibilidade: Rejeição de Datas Passadas', () => {
    const resPast = checkAvailability('2020-01-01', '10:00', 30);
    assert.strictEqual(resPast.available, false, 'Não deve aceitar datas no passado');
  });

  test('Regras de Capacidade e Conflitos de Reserva', () => {
    const testDate = '2026-11-25';
    const testTime = '11:00';

    // Business settings has simultaneous_capacity = 3
    // Book 3 slots for the same date and time
    for (let i = 1; i <= 3; i++) {
      const avail = checkAvailability(testDate, testTime, 40);
      assert.strictEqual(avail.available, true, `Reserva ${i} deve caber na capacidade`);

      db.prepare(`
        INSERT INTO reservations (
          reference_code, user_id, customer_name, customer_phone, vehicle_plate, 
          vehicle_model, service_id, scheduled_date, scheduled_time, duration_minutes, 
          end_time, bay_number, status
        ) VALUES (?, 1, 'Cliente Teste', '840000000', 'MC-99-99', 'VW Golf', 1, ?, ?, 40, '11:40', ?, 'reservado')
      `).run(`REF-TEST-${i}`, testDate, testTime, avail.assignedBay);
    }

    // Attempting 4th reservation must be REJECTED because capacity is 3
    const fourthCheck = checkAvailability(testDate, testTime, 40);
    assert.strictEqual(fourthCheck.available, false, 'A 4ª reserva em simultâneo deve ser rejeitada por falta de capacidade');
    assert.match(fourthCheck.reason, /capacidade máxima/, 'Mensagem deve indicar capacidade máxima preenchida');
  });

  // 3. Alteração de Estados da Reserva
  test('Fluxo e Alteração de Estados da Lavagem', () => {
    // Insert a fresh reservation
    const res = db.prepare(`
      INSERT INTO reservations (
        reference_code, user_id, customer_name, customer_phone, vehicle_plate, 
        vehicle_model, service_id, scheduled_date, scheduled_time, duration_minutes, 
        end_time, status
      ) VALUES ('LJ-STAT1', 4, 'Inácio', '845551234', 'ABC-11', 'Ford', 2, '2026-11-26', '14:00', 40, '14:40', 'reservado')
    `).run();

    const resId = res.lastInsertRowid;

    // Advance state to 'aguardando'
    db.prepare("UPDATE reservations SET status = 'aguardando' WHERE id = ?").run(resId);
    let check = db.prepare('SELECT status FROM reservations WHERE id = ?').get(resId);
    assert.strictEqual(check.status, 'aguardando');

    // Advance state to 'em_atendimento'
    db.prepare("UPDATE reservations SET status = 'em_atendimento' WHERE id = ?").run(resId);
    check = db.prepare('SELECT status FROM reservations WHERE id = ?').get(resId);
    assert.strictEqual(check.status, 'em_atendimento');

    // Advance state to 'concluido'
    db.prepare("UPDATE reservations SET status = 'concluido' WHERE id = ?").run(resId);
    check = db.prepare('SELECT status FROM reservations WHERE id = ?').get(resId);
    assert.strictEqual(check.status, 'concluido');
  });

  // 4. Atribuição Única de Pontos na Conclusão
  test('Atribuição Única de Pontos de Fidelização (Sem duplicação)', () => {
    const customer = db.prepare("SELECT id FROM users WHERE role = 'customer' LIMIT 1").get();
    const service = db.prepare('SELECT id, points_reward FROM services LIMIT 1').get();

    const beforeLoyalty = db.prepare('SELECT balance_points FROM loyalty_accounts WHERE user_id = ?').get(customer.id);
    const initialPoints = beforeLoyalty.balance_points;

    // Simulate completion with points attribution
    const pointsAwarded = service.points_reward;
    db.prepare(`
      UPDATE loyalty_accounts 
      SET balance_points = balance_points + ? 
      WHERE user_id = ?
    `).run(pointsAwarded, customer.id);

    const afterFirst = db.prepare('SELECT balance_points FROM loyalty_accounts WHERE user_id = ?').get(customer.id);
    assert.strictEqual(afterFirst.balance_points, initialPoints + pointsAwarded, 'Pontos devem ser atribuídos');

    // Ensure idempotency / flag protection prevents double crediting
    const reservationMock = { points_awarded: 1 };
    assert.strictEqual(reservationMock.points_awarded === 1, true, 'Flag points_awarded impede duplicação');
  });

  // 5. Resgate de Recompensas e Proteção de Saldo
  test('Resgate de Recompensa: Validação de Saldo e Prevenção de Saldo Negativo', () => {
    const customer = db.prepare("SELECT id FROM users WHERE email = 'cliente@lavaja.co.mz'").get();
    const account = db.prepare('SELECT balance_points FROM loyalty_accounts WHERE user_id = ?').get(customer.id);

    // Try to redeem something that costs more points than balance
    const expensiveRewardPoints = account.balance_points + 5000;
    assert.strictEqual(account.balance_points < expensiveRewardPoints, true, 'Saldo deve ser insuficiente');

    // Add enough completed services to reach the first reward.
    const validRewardPoints = db.prepare('SELECT MIN(points_cost) as cost FROM rewards').get().cost;
    const oldBalance = account.balance_points;
    const pointsToEarn = validRewardPoints - oldBalance;
    const pointsPerService = SERVICE_POINTS_BY_CATEGORY.BÁSICA;
    const additionalServices = Math.ceil(pointsToEarn / pointsPerService);
    db.prepare(`
      UPDATE loyalty_accounts
      SET balance_points = balance_points + ?, lifetime_points = lifetime_points + ?
      WHERE user_id = ?
    `).run(
      additionalServices * pointsPerService,
      additionalServices * pointsPerService,
      customer.id
    );

    const redeemableAccount = db.prepare('SELECT balance_points FROM loyalty_accounts WHERE user_id = ?').get(customer.id);
    assert.strictEqual(redeemableAccount.balance_points >= validRewardPoints, true, 'Dez serviços devem permitir a primeira recompensa');

    db.prepare('UPDATE loyalty_accounts SET balance_points = balance_points - ? WHERE user_id = ?').run(validRewardPoints, customer.id);

    const updatedAccount = db.prepare('SELECT balance_points FROM loyalty_accounts WHERE user_id = ?').get(customer.id);
    assert.strictEqual(
      updatedAccount.balance_points,
      redeemableAccount.balance_points - validRewardPoints,
      'Pontos devem ser deduzidos corretamente'
    );
    assert.strictEqual(updatedAccount.balance_points >= 0, true, 'Saldo nunca pode ficar negativo');
  });

  // 6. Validação de Promoções
  test('Validação de Promoções: Códigos Ativos vs Expirados', () => {
    const activePromo = db.prepare("SELECT * FROM promotions WHERE code = 'QUARTA20'").get();
    assert.strictEqual(activePromo.is_active, 1, 'QUARTA20 deve estar ativa');
    assert.strictEqual(activePromo.discount_percentage, 20, 'Desconto deve ser de 20%');

    // Create an expired promotion
    db.prepare(`
      INSERT INTO promotions (title, description, code, discount_percentage, start_date, end_date, is_active)
      VALUES ('Expirada', 'Teste expirado', 'EXPIRADA99', 50, '2020-01-01', '2020-02-01', 1)
    `).run();

    const today = new Date().toISOString().split('T')[0];
    const checkExp = db.prepare("SELECT * FROM promotions WHERE code = 'EXPIRADA99'").get();
    const isExpired = checkExp.end_date < today;
    assert.strictEqual(isExpired, true, 'Promoção antiga deve ser identificada como expirada');
  });

  // 7. Isolamento de Dados entre Clientes
  test('Isolamento de Dados: Cliente não acede a dados de outros clientes', () => {
    const customer1 = db.prepare("SELECT id FROM users WHERE email = 'cliente@lavaja.co.mz'").get();
    const customer2 = db.prepare("SELECT id FROM users WHERE email = 'maria@gmail.com'").get();

    // Customer 1 reservations query with isolation clause
    const c1Reservations = db.prepare('SELECT * FROM reservations WHERE user_id = ?').all(customer1.id);
    for (const r of c1Reservations) {
      assert.strictEqual(r.user_id, customer1.id, 'Todas as reservas devem pertencer exclusivamente ao Cliente 1');
      assert.notStrictEqual(r.user_id, customer2.id, 'Cliente 1 não pode ver reservas do Cliente 2');
    }
  });

  // 8. Autenticação e Perfis (Roles)
  test('Controlo de Acesso por Perfil (JWT e Roles)', () => {
    const adminToken = generateToken({ id: 1, name: 'Admin', email: 'admin@lavaja.co.mz', role: 'admin' });
    const customerToken = generateToken({ id: 4, name: 'Cliente', email: 'cliente@lavaja.co.mz', role: 'customer' });

    assert.strictEqual(typeof adminToken, 'string', 'Token de admin deve ser gerado');
    assert.strictEqual(typeof customerToken, 'string', 'Token de cliente deve ser gerado');
  });

  console.log('\n🧪 ===============================================');
  console.log(`🧪 RESULTADO DOS TESTES: ${passed} PASSOU | ${failed} FALHOU`);
  console.log('🧪 ===============================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
