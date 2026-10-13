const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Admin: List employees without exposing customer data.
router.get('/employees', authenticateToken, requireRole(['admin']), (req, res) => {
  try {
    const employees = db.prepare(`
      SELECT id, name, email, role, phone, created_at, is_active
      FROM users
      WHERE role = 'employee'
      ORDER BY created_at DESC
    `).all();

    res.json(employees);
  } catch (error) {
    console.error('Erro ao listar funcionários:', error);
    res.status(500).json({ error: 'Erro ao carregar funcionários.' });
  }
});

router.put('/employees/:id', authenticateToken, requireRole(['admin']), (req, res) => {
  const employeeId = Number(req.params.id);
  const { name, email, phone } = req.body;

  if (!Number.isSafeInteger(employeeId) || employeeId < 1) {
    return res.status(400).json({ error: 'Identificador de funcionário inválido.' });
  }
  if (
    typeof name !== 'string' ||
    typeof email !== 'string' ||
    !name.trim() ||
    !email.trim()
  ) {
    return res.status(400).json({ error: 'Nome e email são obrigatórios.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ error: 'Introduza um endereço de email válido.' });
  }

  try {
    const employee = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'employee'").get(employeeId);
    if (!employee) {
      return res.status(404).json({ error: 'Funcionário não encontrado.' });
    }
    const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(normalizedEmail, employeeId);
    if (existing) {
      return res.status(409).json({ error: 'Este email já está em utilização.' });
    }

    db.prepare(`
      UPDATE users
      SET name = ?, email = ?, phone = ?
      WHERE id = ? AND role = 'employee'
    `).run(
      name.trim(),
      normalizedEmail,
      typeof phone === 'string' && phone.trim() ? phone.trim() : null,
      employeeId
    );

    const updated = db.prepare(`
      SELECT id, name, email, role, phone, created_at, is_active
      FROM users WHERE id = ?
    `).get(employeeId);
    res.json(updated);
  } catch (error) {
    console.error('Erro ao editar funcionário:', error);
    res.status(500).json({ error: 'Erro ao atualizar funcionário.' });
  }
});

router.patch('/employees/:id/status', authenticateToken, requireRole(['admin']), (req, res) => {
  const employeeId = Number(req.params.id);
  const { is_active: isActive } = req.body;

  if (!Number.isSafeInteger(employeeId) || employeeId < 1) {
    return res.status(400).json({ error: 'Identificador de funcionário inválido.' });
  }
  if (typeof isActive !== 'boolean') {
    return res.status(400).json({ error: 'O estado da conta deve ser ativo ou inativo.' });
  }

  try {
    const result = db.prepare(`
      UPDATE users
      SET is_active = ?, auth_version = auth_version + 1
      WHERE id = ? AND role = 'employee'
    `).run(isActive ? 1 : 0, employeeId);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Funcionário não encontrado.' });
    }

    const updated = db.prepare(`
      SELECT id, name, email, role, phone, created_at, is_active
      FROM users WHERE id = ?
    `).get(employeeId);
    res.json(updated);
  } catch (error) {
    console.error('Erro ao alterar estado do funcionário:', error);
    res.status(500).json({ error: 'Erro ao atualizar estado do funcionário.' });
  }
});

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

// Admin: Create an employee account
router.post('/', authenticateToken, requireRole(['admin']), (req, res) => {
  const { name, email, password, role, phone } = req.body;

  if (
    typeof name !== 'string' ||
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    !name.trim() ||
    !email.trim() ||
    !password ||
    !role
  ) {
    return res.status(400).json({ error: 'Nome, email, palavra-passe e perfil são obrigatórios.' });
  }

  if (role !== 'employee') {
    return res.status(400).json({ error: 'Esta operação só permite criar contas de funcionário.' });
  }

  if (password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
    return res.status(400).json({ error: 'A palavra-passe deve ter pelo menos 12 caracteres e no máximo 72 bytes.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ error: 'Introduza um endereço de email válido.' });
  }

  try {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
    if (existing) {
      return res.status(409).json({ error: 'Este email já está em utilização.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    const result = db.prepare(`
      INSERT INTO users (name, email, password_hash, role, phone, must_change_password)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run(name.trim(), normalizedEmail, passwordHash, role, typeof phone === 'string' && phone.trim() ? phone.trim() : null);

    const created = db.prepare('SELECT id, name, email, role, phone, created_at, is_active FROM users WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (error) {
    console.error('Erro ao criar utilizador:', error);
    res.status(500).json({ error: 'Erro ao registar utilizador.' });
  }
});

module.exports = router;
