const express = require('express');
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/promotions - Public active promotions
router.get('/', (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  try {
    const promos = db.prepare(`
      SELECT p.*, s.name as service_name
      FROM promotions p
      LEFT JOIN services s ON p.service_id = s.id
      WHERE p.is_active = 1
        AND p.start_date <= ?
        AND p.end_date >= ?
      ORDER BY p.discount_percentage DESC
    `).all(today, today);

    res.json(promos);
  } catch (error) {
    console.error('Erro ao listar promoções:', error);
    res.status(500).json({ error: 'Erro ao carregar promoções.' });
  }
});

// POST /api/promotions/validate - Validate promo code
router.post('/validate', (req, res) => {
  const { code, service_id } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'Código promocional é obrigatório.' });
  }

  const today = new Date().toISOString().split('T')[0];

  try {
    const promo = db.prepare(`
      SELECT * FROM promotions 
      WHERE UPPER(code) = ?
    `).get(code.trim().toUpperCase());

    if (!promo) {
      return res.status(404).json({ error: 'Código promocional não encontrado.' });
    }

    if (!promo.is_active) {
      return res.status(400).json({ error: 'Este código promocional está inativo no momento.' });
    }

    if (promo.start_date > today || promo.end_date < today) {
      return res.status(400).json({ error: 'Este código promocional expirou ou ainda não iniciou.' });
    }

    if (promo.service_id && service_id && promo.service_id !== parseInt(service_id, 10)) {
      const serv = db.prepare('SELECT name FROM services WHERE id = ?').get(promo.service_id);
      return res.status(400).json({ error: `Esta promoção é válida apenas para o serviço: ${serv ? serv.name : 'específico'}.` });
    }

    res.json({
      valid: true,
      code: promo.code,
      title: promo.title,
      discount_percentage: promo.discount_percentage,
      service_id: promo.service_id
    });
  } catch (error) {
    console.error('Erro ao validar promoção:', error);
    res.status(500).json({ error: 'Erro ao validar promoção.' });
  }
});

// Admin: Get all promotions
router.get('/all', authenticateToken, requireRole(['admin']), (req, res) => {
  try {
    const promos = db.prepare(`
      SELECT p.*, s.name as service_name
      FROM promotions p
      LEFT JOIN services s ON p.service_id = s.id
      ORDER BY p.created_at DESC
    `).all();

    res.json(promos);
  } catch (error) {
    console.error('Erro ao obter todas as promoções:', error);
    res.status(500).json({ error: 'Erro ao carregar lista de promoções.' });
  }
});

// Admin: Create promotion
router.post('/', authenticateToken, requireRole(['admin']), (req, res) => {
  const { title, description, code, discount_percentage, service_id, start_date, end_date } = req.body;

  if (!title || !code || !discount_percentage || !start_date || !end_date) {
    return res.status(400).json({ error: 'Título, código, percentagem e datas são obrigatórios.' });
  }

  try {
    const existing = db.prepare('SELECT id FROM promotions WHERE UPPER(code) = ?').get(code.trim().toUpperCase());
    if (existing) {
      return res.status(409).json({ error: 'Já existe uma promoção com este código.' });
    }

    const stmt = db.prepare(`
      INSERT INTO promotions (title, description, code, discount_percentage, service_id, start_date, end_date, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `);

    const result = stmt.run(
      title.trim(),
      description ? description.trim() : null,
      code.trim().toUpperCase(),
      parseInt(discount_percentage, 10),
      service_id ? parseInt(service_id, 10) : null,
      start_date,
      end_date
    );

    const created = db.prepare('SELECT * FROM promotions WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (error) {
    console.error('Erro ao criar promoção:', error);
    res.status(500).json({ error: 'Erro ao registar promoção.' });
  }
});

// Admin: Toggle active status
router.patch('/:id/toggle', authenticateToken, requireRole(['admin']), (req, res) => {
  const { id } = req.params;

  try {
    const promo = db.prepare('SELECT is_active FROM promotions WHERE id = ?').get(id);
    if (!promo) {
      return res.status(404).json({ error: 'Promoção não encontrada.' });
    }

    const newStatus = promo.is_active ? 0 : 1;
    db.prepare('UPDATE promotions SET is_active = ? WHERE id = ?').run(newStatus, id);

    res.json({ message: `Promoção ${newStatus ? 'ativada' : 'desativada'} com sucesso.`, is_active: newStatus });
  } catch (error) {
    console.error('Erro ao alternar estado da promoção:', error);
    res.status(500).json({ error: 'Erro ao atualizar promoção.' });
  }
});

module.exports = router;
