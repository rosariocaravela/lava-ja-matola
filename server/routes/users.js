const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Admin: List all users
router.get('/', authenticateToken, requireRole(['admin']), (req, res) => {
  try {
    const users = db.prepare(`
      SELECT u.id, u.name, u.email, u.role, u.phone, u.created_at,
             la.balance_points, la.lifetime_points
      FROM users u
      LEFT JOIN loyalty_accounts la ON u.id = la.user_id
      ORDER BY u.created_at DESC
    `).all();

    res.json(users);
  } catch (error) {
    console.error('Erro ao listar utilizadores:', error);
    res.status(500).json({ error: 'Erro ao carregar utilizadores.' });
  }
});

// Admin: Create employee or admin
router.post('/', authenticateToken, requireRole(['admin']), (req, res) => {
  const { name, email, password, role, phone } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Nome, email, senha e perfil são obrigatórios.' });
  }

  if (!['admin', 'employee', 'customer'].includes(role)) {
    return res.status(400).json({ error: 'Perfil inválido.' });
  }

  try {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim().toLowerCase());
    if (existing) {
      return res.status(409).json({ error: 'Este email já está em utilização.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const password_hash = bcrypt.hashSync(password, salt);

    const result = db.prepare(`
      INSERT INTO users (name, email, password_hash, role, phone)
      VALUES (?, ?, ?, ?, ?)
    `).run(name.trim(), email.trim().toLowerCase(), password_hash, role, phone || null);

    const created = db.prepare('SELECT id, name, email, role, phone, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (error) {
    console.error('Erro ao criar utilizador:', error);
    res.status(500).json({ error: 'Erro ao registar utilizador.' });
  }
});

module.exports = router;
