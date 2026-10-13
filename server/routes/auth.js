const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { MINIMUM_REWARD_POINTS, WELCOME_BONUS_POINTS } = require('../config/loyalty');
const { generateToken, authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Register new customer
router.post('/register', (req, res) => {
  const { name, email, password, phone } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Nome, email e palavra-passe são obrigatórios.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'A palavra-passe deve ter pelo menos 6 caracteres.' });
  }

  try {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim().toLowerCase());
    if (existing) {
      return res.status(409).json({ error: 'Este endereço de email já está registado.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const password_hash = bcrypt.hashSync(password, salt);

    const insertUser = db.prepare(`
      INSERT INTO users (name, email, password_hash, role, phone)
      VALUES (?, ?, ?, 'customer', ?)
    `);

    const result = insertUser.run(name.trim(), email.trim().toLowerCase(), password_hash, phone || null);
    const userId = result.lastInsertRowid;

    // New customers start with no points; only completed services earn points.
    const createLoyalty = db.prepare(`
      INSERT INTO loyalty_accounts (user_id, balance_points, lifetime_points)
      VALUES (?, ?, ?)
    `);
    const loyaltyResult = createLoyalty.run(userId, WELCOME_BONUS_POINTS, WELCOME_BONUS_POINTS);

    db.prepare(`
      INSERT INTO loyalty_transactions (account_id, user_id, type, points, description)
      VALUES (?, ?, 'earn', ?, 'Pontos de boas-vindas do Passaporte Lava Já')
    `).run(loyaltyResult.lastInsertRowid, userId, WELCOME_BONUS_POINTS);

    // Welcome notification
    db.prepare(`
      INSERT INTO notifications (user_id, target_role, title, message, type)
      VALUES (?, 'customer', 'Bem-vindo ao Lava Já Matola! 🎉', ?, 'success')
    `).run(
      userId,
      `A sua conta foi criada e recebeu ${WELCOME_BONUS_POINTS} pontos de boas-vindas. Ganhe ainda 10 a 40 pontos por lavagem concluída. A primeira recompensa fica disponível aos ${MINIMUM_REWARD_POINTS} pontos.`
    );

    const user = {
      id: userId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role: 'customer',
      phone: phone || null
    };

    const token = generateToken(user);

    res.status(201).json({
      message: 'Conta criada com sucesso!',
      user,
      token
    });
  } catch (error) {
    console.error('Erro no registo:', error);
    res.status(500).json({ error: 'Erro interno ao criar conta.' });
  }
});

// Login
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email e palavra-passe são obrigatórios.' });
  }

  try {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas. Verifique o email ou senha.' });
    }

    const passwordMatch = bcrypt.compareSync(password, user.password_hash);
    if (!passwordMatch || !user.is_active) {
      return res.status(401).json({ error: 'Credenciais inválidas. Verifique o email ou senha.' });
    }

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      must_change_password: Boolean(user.must_change_password),
      auth_version: user.auth_version
    };

    const token = generateToken(safeUser);

    res.json({
      message: 'Autenticado com sucesso!',
      user: safeUser,
      token
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro ao autenticar utilizador.' });
  }
});

router.post('/change-password', authenticateToken, (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
    return res.status(400).json({ error: 'A palavra-passe atual e a nova palavra-passe são obrigatórias.' });
  }

  if (newPassword.length < 12 || Buffer.byteLength(newPassword, 'utf8') > 72) {
    return res.status(400).json({ error: 'A nova palavra-passe deve ter pelo menos 12 caracteres e no máximo 72 bytes.' });
  }

  try {
    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'Utilizador não encontrado.' });
    }

    if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
      return res.status(401).json({ error: 'A palavra-passe atual está incorreta.' });
    }

    if (bcrypt.compareSync(newPassword, user.password_hash)) {
      return res.status(400).json({ error: 'A nova palavra-passe deve ser diferente da atual.' });
    }

    const passwordHash = bcrypt.hashSync(newPassword, bcrypt.genSaltSync(10));
    db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?').run(passwordHash, req.user.id);
    res.json({ message: 'Palavra-passe atualizada com sucesso.' });
  } catch (error) {
    console.error('Erro ao atualizar palavra-passe:', error);
    res.status(500).json({ error: 'Erro interno ao atualizar palavra-passe.' });
  }
});

// Get current user profile
router.get('/me', authenticateToken, (req, res) => {
  try {
    const user = db.prepare('SELECT id, name, email, role, phone, created_at, must_change_password, is_active FROM users WHERE id = ?').get(req.user.id);
    user.must_change_password = Boolean(user.must_change_password);
    user.is_active = Boolean(user.is_active);

    let loyalty = null;
    if (user.role === 'customer') {
      loyalty = db.prepare('SELECT balance_points, lifetime_points FROM loyalty_accounts WHERE user_id = ?').get(user.id);
    }

    res.json({
      user,
      loyalty: loyalty || { balance_points: 0, lifetime_points: 0 }
    });
  } catch (error) {
    console.error('Erro ao obter perfil:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

module.exports = router;
