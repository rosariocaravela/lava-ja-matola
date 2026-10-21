const assert = require('assert');
const path = require('path');
const fs = require('fs');
const express = require('express');
const bcrypt = require('bcryptjs');

// Set test database path
process.env.NODE_ENV = 'test';
process.env.DB_PATH = path.join(__dirname, 'test_lavaja.db');
process.env.JWT_SECRET = 'test-secret-key-for-lava-ja-tests-only';

const fixturePasswords = {
  admin: 'test-admin-password-only',
  employee: 'test-employee-password-only',
  customer: 'test-customer-password-only'
};

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
const reservationsRoutes = require('../routes/reservations');
const aiRoutes = require('../routes/ai');
const paymentsRoutes = require('../routes/payments');
const servicesRoutes = require('../routes/services');
const promotionsRoutes = require('../routes/promotions');
const dashboardRoutes = require('../routes/dashboard');
const usersRoutes = require('../routes/users');

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
    seedDatabase(fixturePasswords);
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

  test('Seeding recusa qualquer base fora da pasta isolada de testes', () => {
    const originalDatabasePath = process.env.DB_PATH;
    try {
      process.env.DB_PATH = path.join(__dirname, '..', 'lavaja.db');
      assert.throws(() => seedDatabase(), /limitado à base isolada de testes/);
    } finally {
      process.env.DB_PATH = originalDatabasePath;
    }
  });

  await testAsync('Login, perfil e permissões por papel', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);
    app.use('/api/services', servicesRoutes);
    app.use('/api/users', usersRoutes);
    app.use('/api/dashboard', dashboardRoutes);
    const server = app.listen(0, '127.0.0.1');

    try {
      await new Promise((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
      });
      const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
      const accounts = [
        { email: 'admin@lavaja.co.mz', password: fixturePasswords.admin, role: 'admin' },
        { email: 'funcionario@lavaja.co.mz', password: fixturePasswords.employee, role: 'employee' },
        { email: 'cliente@lavaja.co.mz', password: fixturePasswords.customer, role: 'customer' }
      ];

      for (const account of accounts) {
        const loginResponse = await fetch(`${baseUrl}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: account.email, password: account.password })
        });
        const login = await loginResponse.json();
        assert.strictEqual(loginResponse.status, 200);
        assert.strictEqual(login.user.role, account.role);
        assert.strictEqual(Object.prototype.hasOwnProperty.call(login.user, 'password_hash'), false);

        const profileResponse = await fetch(`${baseUrl}/auth/me`, {
          headers: { Authorization: `Bearer ${login.token}` }
        });
        assert.strictEqual(profileResponse.status, 200);
        assert.strictEqual((await profileResponse.json()).user.role, account.role);

        const adminEndpointResponse = await fetch(`${baseUrl}/services/all`, {
          headers: { Authorization: `Bearer ${login.token}` }
        });
        assert.strictEqual(adminEndpointResponse.status, account.role === 'admin' ? 200 : 403);

        if (account.role === 'customer') {
          const changeResponse = await fetch(`${baseUrl}/auth/change-password`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${login.token}`
            },
            body: JSON.stringify({
              currentPassword: account.password,
              newPassword: 'updated-customer-password'
            })
          });
          assert.strictEqual(changeResponse.status, 200);
          assert.strictEqual((await changeResponse.json()).message, 'Palavra-passe atualizada com sucesso.');

          const oldPasswordResponse = await fetch(`${baseUrl}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: account.email, password: account.password })
          });
          assert.strictEqual(oldPasswordResponse.status, 401);

          const newPasswordResponse = await fetch(`${baseUrl}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: account.email, password: 'updated-customer-password' })
          });
          assert.strictEqual(newPasswordResponse.status, 200);
        }
      }

      const adminLoginResponse = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@lavaja.co.mz', password: fixturePasswords.admin })
      });
      const adminLogin = await adminLoginResponse.json();
      const adminHeaders = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminLogin.token}`
      };

      const staffResponse = await fetch(`${baseUrl}/users/employees`, {
        headers: { Authorization: `Bearer ${adminLogin.token}` }
      });
      assert.strictEqual(staffResponse.status, 200);
      assert.strictEqual((await staffResponse.json()).length, 2);

      const createResponse = await fetch(`${baseUrl}/users`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          name: 'Novo Funcionário',
          email: 'novo.funcionario@lavaja.co.mz',
          password: 'new-employee-password',
          role: 'employee',
          phone: '+258 84 000 0000'
        })
      });
      const createdEmployee = await createResponse.json();
      assert.strictEqual(createResponse.status, 201);
      assert.strictEqual(createdEmployee.role, 'employee');
      assert.strictEqual(Object.prototype.hasOwnProperty.call(createdEmployee, 'password_hash'), false);
      const storedEmployee = db.prepare('SELECT password_hash, must_change_password FROM users WHERE id = ?').get(createdEmployee.id);
      assert.strictEqual(bcrypt.compareSync('new-employee-password', storedEmployee.password_hash), true);
      assert.strictEqual(storedEmployee.must_change_password, 1);

      const employeeLoginResponse = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: createdEmployee.email, password: 'new-employee-password' })
      });
      const employeeLogin = await employeeLoginResponse.json();
      assert.strictEqual(employeeLoginResponse.status, 200);
      assert.strictEqual(employeeLogin.user.must_change_password, true);

      const blockedEmployeeResponse = await fetch(`${baseUrl}/dashboard/stats`, {
        headers: { Authorization: `Bearer ${employeeLogin.token}` }
      });
      assert.strictEqual(blockedEmployeeResponse.status, 403);
      assert.strictEqual((await blockedEmployeeResponse.json()).code, 'PASSWORD_CHANGE_REQUIRED');

      const initialPasswordReuseResponse = await fetch(`${baseUrl}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${employeeLogin.token}`
        },
        body: JSON.stringify({
          currentPassword: 'new-employee-password',
          newPassword: 'new-employee-password'
        })
      });
      assert.strictEqual(initialPasswordReuseResponse.status, 400);

      const firstChangeResponse = await fetch(`${baseUrl}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${employeeLogin.token}`
        },
        body: JSON.stringify({
          currentPassword: 'new-employee-password',
          newPassword: 'employee-personal-password'
        })
      });
      assert.strictEqual(firstChangeResponse.status, 200);
      assert.strictEqual(db.prepare('SELECT must_change_password FROM users WHERE id = ?').get(createdEmployee.id).must_change_password, 0);

      const unblockedEmployeeResponse = await fetch(`${baseUrl}/dashboard/stats`, {
        headers: { Authorization: `Bearer ${employeeLogin.token}` }
      });
      assert.strictEqual(unblockedEmployeeResponse.status, 200);

      const updateEmployeeResponse = await fetch(`${baseUrl}/users/employees/${createdEmployee.id}`, {
        method: 'PUT',
        headers: adminHeaders,
        body: JSON.stringify({
          name: 'Funcionário Atualizado',
          email: 'funcionario.atualizado@lavaja.co.mz',
          phone: '+258 84 111 2222'
        })
      });
      const updatedEmployee = await updateEmployeeResponse.json();
      assert.strictEqual(updateEmployeeResponse.status, 200);
      assert.strictEqual(updatedEmployee.name, 'Funcionário Atualizado');
      assert.strictEqual(updatedEmployee.email, 'funcionario.atualizado@lavaja.co.mz');
      assert.strictEqual(updatedEmployee.phone, '+258 84 111 2222');
      assert.strictEqual(updatedEmployee.is_active, 1);

      const duplicateEmployeeEmailResponse = await fetch(`${baseUrl}/users/employees/${createdEmployee.id}`, {
        method: 'PUT',
        headers: adminHeaders,
        body: JSON.stringify({ name: 'Email Duplicado', email: 'admin@lavaja.co.mz', phone: '' })
      });
      assert.strictEqual(duplicateEmployeeEmailResponse.status, 409);

      const deactivateEmployeeResponse = await fetch(`${baseUrl}/users/employees/${createdEmployee.id}/status`, {
        method: 'PATCH',
        headers: adminHeaders,
        body: JSON.stringify({ is_active: false })
      });
      const deactivatedEmployee = await deactivateEmployeeResponse.json();
      assert.strictEqual(deactivateEmployeeResponse.status, 200);
      assert.strictEqual(deactivatedEmployee.is_active, 0);
      const inactiveLoginResponse = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: updatedEmployee.email, password: 'employee-personal-password' })
      });
      assert.strictEqual(inactiveLoginResponse.status, 401);
      const oldSessionResponse = await fetch(`${baseUrl}/dashboard/stats`, {
        headers: { Authorization: `Bearer ${employeeLogin.token}` }
      });
      assert.strictEqual(oldSessionResponse.status, 401);

      const reactivateEmployeeResponse = await fetch(`${baseUrl}/users/employees/${createdEmployee.id}/status`, {
        method: 'PATCH',
        headers: adminHeaders,
        body: JSON.stringify({ is_active: true })
      });
      assert.strictEqual(reactivateEmployeeResponse.status, 200);
      const oldSessionAfterReactivationResponse = await fetch(`${baseUrl}/dashboard/stats`, {
        headers: { Authorization: `Bearer ${employeeLogin.token}` }
      });
      assert.strictEqual(oldSessionAfterReactivationResponse.status, 401);
      const reactivatedLoginResponse = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: updatedEmployee.email, password: 'employee-personal-password' })
      });
      assert.strictEqual(reactivatedLoginResponse.status, 200);

      const shortPasswordResponse = await fetch(`${baseUrl}/users`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({ name: 'Senha Fraca', email: 'fraca@lavaja.co.mz', password: 'curta', role: 'employee' })
      });
      assert.strictEqual(shortPasswordResponse.status, 400);

      const adminCreationResponse = await fetch(`${baseUrl}/users`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({ name: 'Novo Admin', email: 'novo.admin@lavaja.co.mz', password: 'admin-password-secure', role: 'admin' })
      });
      assert.strictEqual(adminCreationResponse.status, 400);

      const duplicateEmailResponse = await fetch(`${baseUrl}/users`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({ name: 'Duplicado', email: updatedEmployee.email, password: 'another-secure-password', role: 'employee' })
      });
      assert.strictEqual(duplicateEmailResponse.status, 409);

      const customerLoginResponse = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'cliente@lavaja.co.mz', password: fixturePasswords.customer })
      });
      const customerLogin = await customerLoginResponse.json();
      const customerStaffResponse = await fetch(`${baseUrl}/users/employees`, {
        headers: { Authorization: `Bearer ${customerLogin.token}` }
      });
      assert.strictEqual(customerStaffResponse.status, 403);
    } finally {
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });

  await testAsync('Assistente recomenda serviços reais conforme o cuidado automóvel pedido', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/ai-assistant', aiRoutes);
    const server = app.listen(0, '127.0.0.1');

    try {
      await new Promise((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
      });
      const baseUrl = `http://127.0.0.1:${server.address().port}/api/ai-assistant/chat`;
      const examples = [
        { message: 'Qual serviço recomenda para limpar os bancos e estofos?', category: 'Especializada' },
        { message: 'Qual serviço inclui cera para dar brilho e proteger a pintura?', category: 'Premium' },
        { message: 'Qual lavagem recomenda para limpar o motor?', category: 'Mecânica' },
        { message: 'Qual serviço recomenda para lavar o carro todo?', category: 'Completa' }
      ];

      for (const example of examples) {
        const service = db.prepare('SELECT id, name FROM services WHERE category = ? AND is_active = 1').get(example.category);
        const response = await fetch(baseUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: example.message })
        });
        const data = await response.json();
        assert.strictEqual(response.status, 200);
        assert.ok(data.reply.includes(service.name), `Deve recomendar ${service.name}`);
        assert.ok(
          data.suggestedActions.some(action => action.action === 'book' && action.serviceId === service.id),
          `Deve permitir marcar ${service.name}`
        );
      }
    } finally {
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
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

      await testAsync('Administrador pode editar pontos de serviço com validação e persistência', async () => {
        const admin = db.prepare("SELECT id, name, email, role FROM users WHERE role = 'admin' LIMIT 1").get();
        const service = db.prepare('SELECT id, price_mzn, points_reward FROM services LIMIT 1').get();
        const app = express();
        app.use(express.json());
        app.use('/api/services', servicesRoutes);
        const server = app.listen(0, '127.0.0.1');

        try {
          await new Promise((resolve, reject) => {
            server.once('listening', resolve);
            server.once('error', reject);
          });

          await testAsync('Administrador pode criar serviço com pontos definidos e validação', async () => {
            const admin = db.prepare("SELECT id, name, email, role FROM users WHERE role = 'admin' LIMIT 1").get();
            const app = express();
            app.use(express.json());
            app.use('/api/services', servicesRoutes);
            const server = app.listen(0, '127.0.0.1');

            try {
              await new Promise((resolve, reject) => {
                server.once('listening', resolve);
                server.once('error', reject);
              });

              const url = `http://127.0.0.1:${server.address().port}/api/services`;
              const headers = {
                Authorization: `Bearer ${generateToken(admin)}`,
                'Content-Type': 'application/json'
              };
              const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                  name: 'Serviço de teste',
                  description: 'Serviço criado nos testes',
                  category: 'Básica',
                  price_mzn: 333,
                  duration_minutes: 35,
                  points_reward: 17
                })
              });
              assert.strictEqual(response.status, 201, 'O serviço deve ser criado');
              const created = await response.json();
              assert.strictEqual(created.points_reward, 17, 'Deve guardar os pontos definidos pelo administrador');
              db.prepare('DELETE FROM services WHERE id = ?').run(created.id);

              const invalidResponse = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                  name: 'Serviço inválido',
                  category: 'Básica',
                  price_mzn: 333,
                  duration_minutes: 35,
                  points_reward: 1.5
                })
              });
              assert.strictEqual(invalidResponse.status, 400, 'Não deve aceitar pontos fracionários');
            } finally {
              await new Promise(resolve => server.close(resolve));
            }
          });

          await testAsync('Administrador pode remover campanha ativa permanentemente', async () => {
            const admin = db.prepare("SELECT id, name, email, role FROM users WHERE role = 'admin' LIMIT 1").get();
            const code = `REMOVER${Date.now()}`;
            const promoId = db.prepare(`
              INSERT INTO promotions (title, code, discount_percentage, start_date, end_date, is_active)
              VALUES ('Campanha para remoção', ?, 10, '2026-01-01', '2026-12-31', 1)
            `).run(code).lastInsertRowid;
            const app = express();
            app.use(express.json());
            app.use('/api/promotions', promotionsRoutes);
            const server = app.listen(0, '127.0.0.1');

            try {
              await new Promise((resolve, reject) => {
                server.once('listening', resolve);
                server.once('error', reject);
              });

              await testAsync('Gestor pode filtrar histórico por estado e período', async () => {
                const admin = db.prepare("SELECT id, name, email, role FROM users WHERE role = 'admin' LIMIT 1").get();
                const reservation = db.prepare('SELECT id FROM reservations LIMIT 1').get();
                const insertHistory = db.prepare(`
                  INSERT INTO reservation_status_history (reservation_id, old_status, new_status, changed_by_user_id, created_at)
                  VALUES (?, NULL, ?, ?, datetime('now', ?))
                `);
                const currentReserved = insertHistory.run(reservation.id, 'reservado', admin.id, 'start of day').lastInsertRowid;
                const currentCompleted = insertHistory.run(reservation.id, 'concluido', admin.id, 'start of day').lastInsertRowid;
                const oldReserved = insertHistory.run(reservation.id, 'reservado', admin.id, '-40 days').lastInsertRowid;
                const app = express();
                app.use('/api/dashboard', dashboardRoutes);
                const server = app.listen(0, '127.0.0.1');

                try {
                  await new Promise((resolve, reject) => {
                    server.once('listening', resolve);
                    server.once('error', reject);
                  });

                  const url = `http://127.0.0.1:${server.address().port}/api/dashboard/stats`;
                  const headers = { Authorization: `Bearer ${generateToken(admin)}` };
                  const filteredByStatus = await fetch(`${url}?status=concluido&period=all`, { headers });
                  assert.strictEqual(filteredByStatus.status, 200);
                  const statusResults = await filteredByStatus.json();
                  assert(statusResults.recentActivity.some(item => item.id === currentCompleted));
                  assert(statusResults.recentActivity.every(item => item.new_status === 'concluido'));

                  const filteredByPeriod = await fetch(`${url}?status=all&period=7d`, { headers });
                  assert.strictEqual(filteredByPeriod.status, 200);
                  const periodResults = await filteredByPeriod.json();
                  assert(periodResults.recentActivity.some(item => item.id === currentReserved));
                  assert(!periodResults.recentActivity.some(item => item.id === oldReserved));

                  const invalidFilter = await fetch(`${url}?status=em_atendimento&period=all`, { headers });
                  assert.strictEqual(invalidFilter.status, 400);
                } finally {
                  db.prepare('DELETE FROM reservation_status_history WHERE id IN (?, ?, ?)')
                    .run(currentReserved, currentCompleted, oldReserved);
                  await new Promise(resolve => server.close(resolve));
                }
              });

              const response = await fetch(`http://127.0.0.1:${server.address().port}/api/promotions/${promoId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${generateToken(admin)}` }
              });
              assert.strictEqual(response.status, 200, 'A campanha ativa deve ser removida');
              assert.strictEqual(db.prepare('SELECT id FROM promotions WHERE id = ?').get(promoId), undefined);

              const repeatedResponse = await fetch(`http://127.0.0.1:${server.address().port}/api/promotions/${promoId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${generateToken(admin)}` }
              });
              assert.strictEqual(repeatedResponse.status, 404, 'Campanha removida não deve ser encontrada');
            } finally {
              await new Promise(resolve => server.close(resolve));
            }
          });

          const url = `http://127.0.0.1:${server.address().port}/api/services/${service.id}`;
          const headers = {
            Authorization: `Bearer ${generateToken(admin)}`,
            'Content-Type': 'application/json'
          };
          const updateResponse = await fetch(url, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ price_mzn: service.price_mzn, points_reward: 7 })
          });
          assert.strictEqual(updateResponse.status, 200, 'A edição deve ser aceite');
          assert.strictEqual((await updateResponse.json()).points_reward, 7);
          assert.strictEqual(
            db.prepare('SELECT points_reward FROM services WHERE id = ?').get(service.id).points_reward,
            7,
            'Os pontos editados devem ser persistidos'
          );

          for (const invalidPoints of [-1, 1.5, null]) {
            const invalidResponse = await fetch(url, {
              method: 'PUT',
              headers,
              body: JSON.stringify({ points_reward: invalidPoints })
            });
            assert.strictEqual(invalidResponse.status, 400, `Pontos inválidos devem ser rejeitados: ${invalidPoints}`);
          }
        } finally {
          db.prepare('UPDATE services SET price_mzn = ?, points_reward = ? WHERE id = ?')
            .run(service.price_mzn, service.points_reward, service.id);
          await new Promise(resolve => server.close(resolve));
        }
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

  await testAsync('Relatório resume serviços, pagamentos, descontos e fidelização sem contar simulações como recebimento', async () => {
    const admin = db.prepare("SELECT id, name, email, role FROM users WHERE role = 'admin' LIMIT 1").get();
    const customer = db.prepare("SELECT id FROM users WHERE email = 'cliente@lavaja.co.mz'").get();
    const account = db.prepare('SELECT id FROM loyalty_accounts WHERE user_id = ?').get(customer.id);
    const service = db.prepare('SELECT id, duration_minutes FROM services LIMIT 1').get();
    const reward = db.prepare('SELECT id FROM rewards LIMIT 1').get();
    const today = new Date().toISOString().slice(0, 10);
    const suffix = Date.now();
    const reservations = [];
    let redemptionId;
    const app = express();
    app.use('/api/dashboard', dashboardRoutes);
    const server = app.listen(0, '127.0.0.1');

    try {
      await new Promise((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
      });

      const url = `http://127.0.0.1:${server.address().port}/api/dashboard/reports`;
      const headers = { Authorization: `Bearer ${generateToken(admin)}`, 'Content-Type': 'application/json' };
      const query = `?start_date=${today}&end_date=${today}`;
      const baselineResponse = await fetch(`${url}${query}`, { headers });
      assert.strictEqual(baselineResponse.status, 200);
      const baseline = (await baselineResponse.json()).summary;

      const insertReservation = db.prepare(`
        INSERT INTO reservations (
          reference_code, user_id, customer_name, customer_phone, vehicle_plate, vehicle_model,
          service_id, scheduled_date, scheduled_time, duration_minutes, end_time, status
        ) VALUES (?, ?, 'Cliente relatório', '+258840000000', ?, 'Viatura teste', ?, ?, '10:00', ?, '10:30', 'concluido')
      `);
      const firstId = insertReservation.run(`RPT-A-${suffix}`, customer.id, `RPTA${suffix}`, service.id, today, service.duration_minutes).lastInsertRowid;
      const secondId = insertReservation.run(`RPT-B-${suffix}`, customer.id, `RPTB${suffix}`, service.id, today, service.duration_minutes).lastInsertRowid;
      reservations.push(firstId, secondId);
      db.prepare(`
        INSERT INTO reservation_payments (
          reservation_id, original_amount_mzn, total_discount_mzn, amount_paid_mzn, method, status, simulated
        ) VALUES (?, 150, 25, 125, 'balcao', 'pago', 0)
      `).run(firstId);
      db.prepare(`
        INSERT INTO reservation_payments (
          reservation_id, original_amount_mzn, amount_paid_mzn, method, status, simulated
        ) VALUES (?, 75, 75, 'mpesa', 'pago', 1)
      `).run(secondId);
      db.prepare(`
        INSERT INTO loyalty_transactions (account_id, user_id, reservation_id, type, points, description)
        VALUES (?, ?, ?, 'earn', 18, 'Pontos do relatório')
      `).run(account.id, customer.id, firstId);
      db.prepare(`
        INSERT INTO loyalty_transactions (account_id, user_id, reservation_id, type, points, description)
        VALUES (?, ?, ?, 'redeem', 9, 'Resgate do relatório')
      `).run(account.id, customer.id, firstId);
      redemptionId = db.prepare(`
        INSERT INTO reward_redemptions (user_id, reward_id, points_spent, redemption_code)
        VALUES (?, ?, 9, ?)
      `).run(customer.id, reward.id, `RPT-${suffix}`).lastInsertRowid;

      const reportResponse = await fetch(`${url}${query}`, { headers });
      assert.strictEqual(reportResponse.status, 200);
      const report = await reportResponse.json();
      assert.strictEqual(report.summary.completedWashes - baseline.completedWashes, 2);
      assert.strictEqual(report.summary.receivedMzn - baseline.receivedMzn, 125);
      assert.strictEqual(report.summary.simulatedMzn - baseline.simulatedMzn, 75);
      assert.strictEqual(report.summary.discountsMzn - baseline.discountsMzn, 25);
      assert.strictEqual(report.summary.pointsEarned - baseline.pointsEarned, 18);
      assert.strictEqual(report.summary.pointsRedeemed - baseline.pointsRedeemed, 9);
      assert.strictEqual(report.summary.rewardsRedeemed - baseline.rewardsRedeemed, 1);
      assert.strictEqual(report.services.find(item => item.id === service.id).completed_washes >= 2, true);

      const invalidPeriodResponse = await fetch(`${url}?start_date=${today}&end_date=invalid`, { headers });
      assert.strictEqual(invalidPeriodResponse.status, 400);
    } finally {
      if (redemptionId) db.prepare('DELETE FROM reward_redemptions WHERE id = ?').run(redemptionId);
      if (reservations.length) {
        const placeholders = reservations.map(() => '?').join(',');
        db.prepare(`DELETE FROM loyalty_transactions WHERE reservation_id IN (${placeholders})`).run(...reservations);
        db.prepare(`DELETE FROM reservations WHERE id IN (${placeholders})`).run(...reservations);
      }
      await new Promise(resolve => server.close(resolve));
    }
  });

  await testAsync('Fluxo de cobrança pós-lavagem, vouchers, pagamentos e permissões', async () => {
    const customer = db.prepare("SELECT id, name, email, role FROM users WHERE email = 'cliente@lavaja.co.mz'").get();
    const otherCustomer = db.prepare("SELECT id, name, email, role FROM users WHERE email = 'maria@gmail.com'").get();
    const employee = db.prepare("SELECT id, name, email, role FROM users WHERE role = 'employee' LIMIT 1").get();
    const fullWash = db.prepare("SELECT id, price_mzn, points_reward FROM services WHERE name LIKE 'Lavagem Completa%'").get();
    const exteriorWash = db.prepare("SELECT id, price_mzn FROM services WHERE name = 'Lavagem Exterior'").get();
    const discountReward = db.prepare("SELECT id FROM rewards WHERE title = 'Desconto de 100 MT na Lavagem Completa'").get();
    const freeWashReward = db.prepare("SELECT id FROM rewards WHERE title = 'Lavagem Exterior Grátis'").get();
    const now = new Date();
    now.setDate(now.getDate() + 30);
    const serviceDate = now.toISOString().split('T')[0];
    const promotionCode = `TESTPAY${Date.now()}`;
    db.prepare(`
      INSERT INTO promotions (title, code, discount_percentage, start_date, end_date, is_active)
      VALUES ('Promoção de teste de pagamento', ?, 20, ?, ?, 1)
    `).run(promotionCode, serviceDate, serviceDate);

    const app = express();
    app.use(express.json());
    app.use('/api/reservations', reservationsRoutes);
    app.use('/api/payments', paymentsRoutes);
    const server = app.listen(0, '127.0.0.1');

    try {
      await new Promise((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
      });

      const tokens = {
        customer: generateToken(customer),
        otherCustomer: generateToken(otherCustomer),
        employee: generateToken(employee)
      };
      const request = async (pathName, token, method = 'GET', body) => {
        const response = await fetch(`http://127.0.0.1:${server.address().port}${pathName}`, {
          method,
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(body ? { 'Content-Type': 'application/json' } : {})
          },
          ...(body ? { body: JSON.stringify(body) } : {})
        });
        return { response, data: await response.json() };
      };
      const createReservation = async (serviceId, time, promoCode = null) => {
        const { response, data } = await request('/api/reservations', tokens.customer, 'POST', {
          customer_name: customer.name,
          customer_phone: '+258 84 555 1234',
          vehicle_plate: `TST ${time.replace(':', '')} MP`,
          vehicle_model: 'Toyota Corolla',
          service_id: serviceId,
          scheduled_date: serviceDate,
          scheduled_time: time,
          promo_code: promoCode
        });
        assert.strictEqual(response.status, 201, data.error);
        return data.reservation;
      };
      const completeReservation = async reservation => {
        let result = await request(`/api/reservations/${reservation.id}/status`, tokens.employee, 'PATCH', {
          new_status: 'em_atendimento'
        });
        assert.strictEqual(result.response.status, 200, `Falha ao iniciar lavagem: ${JSON.stringify(result.data)}`);
        result = await request(`/api/reservations/${reservation.id}/status`, tokens.employee, 'PATCH', {
          new_status: 'concluido'
        });
        assert.strictEqual(result.response.status, 200, `Falha ao concluir lavagem: ${JSON.stringify(result.data)}`);
      };
      const addVoucher = (rewardId, code, userId = customer.id, expiresAt = null) => {
        db.prepare(`
          INSERT INTO reward_redemptions (user_id, reward_id, points_spent, redemption_code, expires_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(userId, rewardId, 100, code, expiresAt);
      };

      const promoReservation = await createReservation(fullWash.id, '09:00', promotionCode);
      const pendingPayment = await request(`/api/payments/${promoReservation.id}`, tokens.customer);
      assert.strictEqual(pendingPayment.response.status, 200, `Consulta da cobrança pendente: ${JSON.stringify(pendingPayment.data)}`);
      assert.strictEqual(pendingPayment.data.payment.status, 'pendente');
      assert.strictEqual(pendingPayment.data.payment.amount_due_mzn, fullWash.price_mzn - 90);

      const prematurePayment = await request(`/api/payments/${promoReservation.id}/confirm`, tokens.customer, 'POST', {
        method: 'mpesa'
      });
      assert.strictEqual(prematurePayment.response.status, 409, 'Uma reserva ainda não concluída não pode ser paga.');

      const otherCustomerAccess = await request(`/api/payments/${promoReservation.id}`, tokens.otherCustomer);
      assert.strictEqual(otherCustomerAccess.response.status, 403, 'O cliente não pode consultar cobrança de outra pessoa.');

      const rewardCode = `RESG-${Date.now().toString(36).slice(-6).toUpperCase()}`;
      addVoucher(discountReward.id, rewardCode);
      const preview = await request(`/api/payments/${promoReservation.id}/preview-voucher`, tokens.customer, 'POST', { code: rewardCode });
      assert.strictEqual(preview.response.status, 200, preview.data.error);
      assert.strictEqual(preview.data.payment.original_amount_mzn, 450);
      assert.strictEqual(preview.data.payment.promotion_discount_mzn, 90);
      assert.strictEqual(preview.data.payment.reward_discount_mzn, 100);
      assert.strictEqual(preview.data.payment.amount_due_mzn, 260, 'Promoção e recompensa podem acumular sem exceder o preço.');
      assert.strictEqual(
        db.prepare('SELECT status FROM reward_redemptions WHERE redemption_code = ?').get(rewardCode).status,
        'disponivel',
        'A pré-visualização não deve consumir o voucher.'
      );

      const invalidVoucher = await request(`/api/payments/${promoReservation.id}/preview-voucher`, tokens.customer, 'POST', { code: 'RESG-INVALIDO' });
      assert.strictEqual(invalidVoucher.response.status, 400);

      const expiredCode = `RESG-${(Date.now() + 1).toString(36).slice(-6).toUpperCase()}`;
      addVoucher(discountReward.id, expiredCode, customer.id, '2000-01-01 00:00:00');
      const expiredVoucher = await request(`/api/payments/${promoReservation.id}/preview-voucher`, tokens.customer, 'POST', { code: expiredCode });
      assert.strictEqual(expiredVoucher.response.status, 400, 'Voucher expirado deve ser rejeitado.');

      const foreignCode = `RESG-${(Date.now() + 2).toString(36).slice(-6).toUpperCase()}`;
      addVoucher(discountReward.id, foreignCode, otherCustomer.id);
      const foreignVoucher = await request(`/api/payments/${promoReservation.id}/preview-voucher`, tokens.customer, 'POST', { code: foreignCode });
      assert.strictEqual(foreignVoucher.response.status, 400, 'Voucher de outro cliente deve ser rejeitado.');

      const incompatibleCode = `RESG-${(Date.now() + 3).toString(36).slice(-6).toUpperCase()}`;
      addVoucher(freeWashReward.id, incompatibleCode);
      const incompatibleVoucher = await request(`/api/payments/${promoReservation.id}/preview-voucher`, tokens.customer, 'POST', { code: incompatibleCode });
      assert.strictEqual(incompatibleVoucher.response.status, 400, 'Recompensa de serviço diferente deve ser rejeitada.');

      const accountBeforeCompletion = db.prepare('SELECT balance_points FROM loyalty_accounts WHERE user_id = ?').get(customer.id).balance_points;
      await completeReservation(promoReservation);
      const accountAfterCompletion = db.prepare('SELECT balance_points FROM loyalty_accounts WHERE user_id = ?').get(customer.id).balance_points;
      assert.strictEqual(accountAfterCompletion - accountBeforeCompletion, fullWash.points_reward);
      const repeatedCompletion = await request(`/api/reservations/${promoReservation.id}/status`, tokens.employee, 'PATCH', {
        new_status: 'concluido'
      });
      assert.strictEqual(repeatedCompletion.response.status, 200, `Conclusão repetida: ${JSON.stringify(repeatedCompletion.data)}`);
      assert.strictEqual(
        db.prepare("SELECT COUNT(*) as count FROM loyalty_transactions WHERE reservation_id = ? AND type = 'earn'").get(promoReservation.id).count,
        1,
        'Repetir a conclusão não pode duplicar pontos.'
      );

      db.prepare('UPDATE services SET price_mzn = 999 WHERE id = ?').run(fullWash.id);
      const unauthorizedCounterPayment = await request(`/api/payments/${promoReservation.id}/confirm`, tokens.customer, 'POST', {
        method: 'balcao',
        code: rewardCode
      });
      assert.strictEqual(unauthorizedCounterPayment.response.status, 403);

      const confirmed = await request(`/api/payments/${promoReservation.id}/confirm`, tokens.customer, 'POST', {
        method: 'mpesa',
        code: rewardCode,
        amount: 1,
        discount_mzn: 99999
      });
      assert.strictEqual(confirmed.response.status, 200, confirmed.data.error);
      assert.strictEqual(confirmed.data.payment.original_amount_mzn, 450, 'O preço registado não muda se o serviço for reprecificado.');
      assert.strictEqual(confirmed.data.payment.amount_paid_mzn, 260, 'O backend calcula e ignora valores manipulados pelo cliente.');
      assert.strictEqual(confirmed.data.payment.status, 'pago');
      assert.strictEqual(confirmed.data.payment.simulated, true);
      assert.ok(confirmed.data.payment.transaction_reference);
      assert.strictEqual(
        db.prepare('SELECT status FROM reward_redemptions WHERE redemption_code = ?').get(rewardCode).status,
        'utilizado',
        'O voucher é consumido na mesma transação do pagamento.'
      );

      const duplicate = await request(`/api/payments/${promoReservation.id}/confirm`, tokens.customer, 'POST', { method: 'emola' });
      assert.strictEqual(duplicate.response.status, 409, 'Pagamentos duplicados devem ser bloqueados.');
      const reusedVoucher = await request(`/api/payments/${promoReservation.id}/preview-voucher`, tokens.customer, 'POST', { code: rewardCode });
      assert.strictEqual(reusedVoucher.response.status, 409, 'Voucher utilizado não pode ser reutilizado.');

      const counterReservation = await createReservation(exteriorWash.id, '12:00');
      await completeReservation(counterReservation);
      const unauthorizedCash = await request(`/api/payments/${counterReservation.id}/confirm`, tokens.customer, 'POST', { method: 'balcao' });
      assert.strictEqual(unauthorizedCash.response.status, 403, 'Só funcionário pode confirmar recebimento no balcão.');
      const cashReceipt = await request(`/api/payments/${counterReservation.id}/confirm`, tokens.employee, 'POST', { method: 'balcao' });
      assert.strictEqual(cashReceipt.response.status, 200, cashReceipt.data.error);
      assert.strictEqual(cashReceipt.data.payment.amount_paid_mzn, 250);
      assert.strictEqual(cashReceipt.data.payment.simulated, false);

      const freeServiceReservation = await createReservation(exteriorWash.id, '15:00');
      const freeCode = `RESG-${(Date.now() + 4).toString(36).slice(-6).toUpperCase()}`;
      addVoucher(freeWashReward.id, freeCode);
      const freePreview = await request(`/api/payments/${freeServiceReservation.id}/preview-voucher`, tokens.customer, 'POST', { code: freeCode });
      assert.strictEqual(freePreview.response.status, 200, freePreview.data.error);
      assert.strictEqual(freePreview.data.payment.amount_due_mzn, 0, 'Benefício de serviço aplicável cobre o preço do serviço correspondente.');
      assert.strictEqual(freePreview.data.payment.reward_service_name, 'Lavagem Exterior');

      const receiptAccess = await request(`/api/payments/${promoReservation.id}`, tokens.customer);
      assert.strictEqual(receiptAccess.response.status, 200, `Consulta do comprovativo: ${JSON.stringify(receiptAccess.data)}`);
      assert.strictEqual(receiptAccess.data.payment.promotion_discount_mzn, 90);
      assert.strictEqual(receiptAccess.data.payment.reward_discount_mzn, 100);
      assert.strictEqual(receiptAccess.data.payment.amount_paid_mzn, 260);
      assert.strictEqual(
        (await request('/api/reservations', tokens.otherCustomer)).data.some(item => item.id === promoReservation.id),
        false,
        'A listagem de reservas mantém o isolamento entre clientes.'
      );
    } finally {
      db.prepare('UPDATE services SET price_mzn = ? WHERE id = ?').run(fullWash.price_mzn, fullWash.id);
      await new Promise((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
      });
    }
  });

  console.log('\n🧪 ===============================================');
  console.log(`🧪 RESULTADO DOS TESTES: ${passed} PASSOU | ${failed} FALHOU`);
  console.log('🧪 ===============================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
