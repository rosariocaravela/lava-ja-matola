const express = require('express');
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { getPromotion } = require('../utils/billing');

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
  const { code, service_id, scheduled_date } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'Código promocional é obrigatório.' });
  }

  const applicableDate = scheduled_date || new Date().toISOString().split('T')[0];

  try {
    const { promotion, error } = getPromotion(db, code, service_id, applicableDate);
    if (error) {
      return res.status(error.includes('não encontrado') ? 404 : 400).json({ error });
    }

    res.json({
      valid: true,
      code: promotion.code,
      title: promotion.title,
      discount_percentage: promotion.discount_percentage,
      service_id: promotion.service_id
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
  const discountPercentage = Number(discount_percentage);

  if (!title || !code || !start_date || !end_date ||
      !Number.isInteger(discountPercentage) || discountPercentage < 1 || discountPercentage > 100) {
    return res.status(400).json({ error: 'Título, código, percentagem entre 1 e 100 e datas válidas são obrigatórios.' });
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
      discountPercentage,
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

// Admin: Permanently remove a promotion
router.delete('/:id', authenticateToken, requireRole(['admin']), (req, res) => {
  const { id } = req.params;

  try {
    const result = db.prepare('DELETE FROM promotions WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Campanha não encontrada.' });
    }

    res.json({ message: 'Campanha removida com sucesso.' });
  } catch (error) {
    console.error('Erro ao remover campanha:', error);
    res.status(500).json({ error: 'Erro ao remover campanha.' });
  }
});

module.exports = router;
