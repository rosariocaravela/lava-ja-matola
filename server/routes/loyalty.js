const express = require('express');
const db = require('../db');
const { MINIMUM_REWARD_POINTS } = require('../config/loyalty');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { awardRecurringBonusIfDue } = require('../utils/loyalty');

const router = express.Router();

function generateRedemptionCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'RESG-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// GET /api/loyalty/me - Get customer points balance, history & redemptions
router.get('/me', authenticateToken, (req, res) => {
  const userId = req.user.id;

  try {
    let account = db.prepare('SELECT * FROM loyalty_accounts WHERE user_id = ?').get(userId);
    if (!account) {
      const newAcc = db.prepare('INSERT INTO loyalty_accounts (user_id, balance_points, lifetime_points) VALUES (?, 0, 0)').run(userId);
      account = { id: newAcc.lastInsertRowid, user_id: userId, balance_points: 0, lifetime_points: 0 };
    }

    awardRecurringBonusIfDue(userId);
    account = db.prepare('SELECT * FROM loyalty_accounts WHERE user_id = ?').get(userId);

    // Transactions history
    const transactions = db.prepare(`
      SELECT * FROM loyalty_transactions
      WHERE account_id = ?
      ORDER BY created_at DESC
    `).all(account.id);

    // Active & used redemptions
    const redemptions = db.prepare(`
      SELECT r.*, rew.title as reward_title, rew.description as reward_description,
             rew.discount_mzn, rew.benefit_type, s.name as reward_service_name
      FROM reward_redemptions r
      JOIN rewards rew ON r.reward_id = rew.id
      LEFT JOIN services s ON rew.service_id = s.id
      WHERE r.user_id = ?
      ORDER BY r.created_at DESC
    `).all(userId);

    // Available rewards to redeem
    const availableRewards = db.prepare(`
      SELECT rewards.*, services.name as service_name
      FROM rewards
      LEFT JOIN services ON rewards.service_id = services.id
      WHERE rewards.is_active = 1
      ORDER BY rewards.points_cost ASC
    `).all();

    res.json({
      balance_points: account.balance_points,
      lifetime_points: account.lifetime_points,
      transactions,
      redemptions,
      availableRewards
    });
  } catch (error) {
    console.error('Erro ao consultar passaporte de fidelização:', error);
    res.status(500).json({ error: 'Erro ao carregar dados de fidelização.' });
  }
});

// GET /api/loyalty/rewards - Public list of available rewards
router.get('/rewards', (req, res) => {
  try {
    const rewards = db.prepare(`
      SELECT rewards.*, services.name as service_name
      FROM rewards
      LEFT JOIN services ON rewards.service_id = services.id
      WHERE rewards.is_active = 1
      ORDER BY rewards.points_cost ASC
    `).all();
    res.json(rewards);
  } catch (error) {
    console.error('Erro ao obter recompensas:', error);
    res.status(500).json({ error: 'Erro ao listar recompensas.' });
  }
});

// POST /api/loyalty/redeem - Redeem a reward using points
router.post('/redeem', authenticateToken, (req, res) => {
  const { reward_id } = req.body;
  const userId = req.user.id;

  if (!reward_id) {
    return res.status(400).json({ error: 'O ID da recompensa é obrigatório.' });
  }

  try {
    const reward = db.prepare('SELECT * FROM rewards WHERE id = ? AND is_active = 1').get(reward_id);
    if (!reward) {
      return res.status(404).json({ error: 'Recompensa não encontrada ou inativa.' });
    }

    // Atomic transaction for balance check and points deduction
    const redeemTx = db.transaction(() => {
      let account = db.prepare('SELECT * FROM loyalty_accounts WHERE user_id = ?').get(userId);
      if (!account || account.balance_points < reward.points_cost) {
        throw new Error('Pontos insuficientes para resgatar esta recompensa.');
      }

      const newBalance = account.balance_points - reward.points_cost;

      // Deduct points
      db.prepare(`
        UPDATE loyalty_accounts
        SET balance_points = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newBalance, account.id);

      // Unique redemption voucher code
      let code = generateRedemptionCode();
      while (db.prepare('SELECT id FROM reward_redemptions WHERE redemption_code = ?').get(code)) {
        code = generateRedemptionCode();
      }

      // Record redemption voucher
      const redResult = db.prepare(`
        INSERT INTO reward_redemptions (user_id, reward_id, points_spent, redemption_code, status)
        VALUES (?, ?, ?, ?, 'disponivel')
      `).run(userId, reward.id, reward.points_cost, code);

      // Record transaction
      db.prepare(`
        INSERT INTO loyalty_transactions (account_id, user_id, type, points, description)
        VALUES (?, ?, 'redeem', ?, ?)
      `).run(account.id, userId, reward.points_cost, `Resgate de recompensa: ${reward.title} (Código: ${code})`);

      // Notification to customer
      db.prepare(`
        INSERT INTO notifications (user_id, target_role, title, message, type)
        VALUES (?, 'customer', 'Recompensa Resgatada! 🎁', ?, 'success')
      `).run(
        userId,
        `Resgatou com sucesso "${reward.title}". Apresente o código ${code} no momento do pagamento.`
      );

      return {
        redemptionId: redResult.lastInsertRowid,
        redemptionCode: code,
        newBalance
      };
    });

    const result = redeemTx();

    res.json({
      message: 'Recompensa resgatada com sucesso!',
      redemptionCode: result.redemptionCode,
      newBalance: result.newBalance,
      reward
    });
  } catch (error) {
    console.error('Erro no resgate:', error.message);
    res.status(400).json({ error: error.message || 'Erro ao processar resgate de recompensa.' });
  }
});

// PATCH /api/loyalty/validate-voucher - Employee/Admin validates and uses voucher
router.patch('/validate-voucher', authenticateToken, requireRole(['employee', 'admin']), (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'Código de resgate é obrigatório.' });
  }

  try {
    const voucher = db.prepare(`
      SELECT r.*, rew.title as reward_title, rew.description as reward_description,
             rew.discount_mzn, rew.benefit_type, s.name as service_name,
             u.name as customer_name
      FROM reward_redemptions r
      JOIN rewards rew ON r.reward_id = rew.id
      JOIN users u ON r.user_id = u.id
      LEFT JOIN services s ON rew.service_id = s.id
      WHERE r.redemption_code = ?
    `).get(code.trim().toUpperCase());

    if (!voucher) {
      return res.status(404).json({ error: 'Código de resgate não encontrado.' });
    }

    if (voucher.status === 'utilizado') {
      return res.status(400).json({ error: `Este benefício já foi utilizado em ${voucher.used_at}.` });
    }
    if (voucher.status === 'expirado' || (voucher.expires_at && new Date(voucher.expires_at) < new Date())) {
      return res.status(400).json({ error: 'Este benefício expirou.' });
    }

    res.json({
      message: 'Benefício válido. Só será utilizado quando o pagamento associado for confirmado.',
      voucher: {
        ...voucher,
        status: 'disponivel'
      }
    });
  } catch (error) {
    console.error('Erro ao validar voucher:', error);
    res.status(500).json({ error: 'Erro ao validar benefício.' });
  }
});

// Admin: Rewards CRUD
router.post('/rewards', authenticateToken, requireRole(['admin']), (req, res) => {
  const { title, description, points_cost, discount_mzn, benefit_type, service_id } = req.body;
  const pointsCost = Number(points_cost);
  const discountAmount = Number(discount_mzn || 0);
  const benefitType = benefit_type || 'discount';

  if (!title || !Number.isInteger(pointsCost) || pointsCost < MINIMUM_REWARD_POINTS) {
    return res.status(400).json({
      error: `Título obrigatório e custo mínimo de ${MINIMUM_REWARD_POINTS} pontos.`
    });
  }
  if (!Number.isFinite(discountAmount) || discountAmount < 0 ||
      !['discount', 'service'].includes(benefitType)) {
    return res.status(400).json({ error: 'Tipo de benefício ou valor de referência inválido.' });
  }

  try {
    const result = db.prepare(`
      INSERT INTO rewards (title, description, points_cost, discount_mzn, benefit_type, service_id, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `).run(title.trim(), description ? description.trim() : null, pointsCost, discountAmount, benefitType, service_id || null);

    const created = db.prepare('SELECT * FROM rewards WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (error) {
    console.error('Erro ao criar recompensa:', error);
    res.status(500).json({ error: 'Erro ao criar recompensa.' });
  }
});

module.exports = router;
