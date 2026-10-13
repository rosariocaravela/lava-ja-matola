const express = require('express');
const db = require('../db');
const { getPointsForCategory } = require('../config/loyalty');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Public: Get all active services
router.get('/', (req, res) => {
  try {
    const services = db.prepare('SELECT * FROM services WHERE is_active = 1 ORDER BY price_mzn ASC').all();
    res.json(services);
  } catch (error) {
    console.error('Erro ao listar serviços:', error);
    res.status(500).json({ error: 'Erro ao carregar serviços.' });
  }
});

// Admin: Get all services (including inactive)
router.get('/all', authenticateToken, requireRole(['admin']), (req, res) => {
  try {
    const services = db.prepare('SELECT * FROM services ORDER BY created_at DESC').all();
    res.json(services);
  } catch (error) {
    console.error('Erro ao listar todos os serviços:', error);
    res.status(500).json({ error: 'Erro ao carregar serviços.' });
  }
});

// Admin: Create service
router.post('/', authenticateToken, requireRole(['admin']), (req, res) => {
  const { name, description, category, price_mzn, duration_minutes } = req.body;

  if (!name || !price_mzn || !duration_minutes) {
    return res.status(400).json({ error: 'Nome, preço e duração são obrigatórios.' });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO services (name, description, category, price_mzn, duration_minutes, points_reward, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `);

    const result = stmt.run(
      name.trim(),
      description ? description.trim() : '',
      category || 'Geral',
      parseFloat(price_mzn),
      parseInt(duration_minutes, 10),
      getPointsForCategory(category || 'Geral')
    );

    const newService = db.prepare('SELECT * FROM services WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newService);
  } catch (error) {
    console.error('Erro ao criar serviço:', error);
    res.status(500).json({ error: 'Erro ao salvar serviço.' });
  }
});

// Admin: Update service
router.put('/:id', authenticateToken, requireRole(['admin']), (req, res) => {
  const { id } = req.params;
  const { name, description, category, price_mzn, duration_minutes, is_active } = req.body;

  try {
    const existing = db.prepare('SELECT * FROM services WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Serviço não encontrado.' });
    }

    const stmt = db.prepare(`
      UPDATE services 
      SET name = ?, description = ?, category = ?, price_mzn = ?, duration_minutes = ?, points_reward = ?, is_active = ?
      WHERE id = ?
    `);

    stmt.run(
      name !== undefined ? name.trim() : existing.name,
      description !== undefined ? description.trim() : existing.description,
      category !== undefined ? category : existing.category,
      price_mzn !== undefined ? parseFloat(price_mzn) : existing.price_mzn,
      duration_minutes !== undefined ? parseInt(duration_minutes, 10) : existing.duration_minutes,
      getPointsForCategory(category !== undefined ? category : existing.category),
      is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
      id
    );

    const updated = db.prepare('SELECT * FROM services WHERE id = ?').get(id);
    res.json(updated);
  } catch (error) {
    console.error('Erro ao atualizar serviço:', error);
    res.status(500).json({ error: 'Erro ao atualizar serviço.' });
  }
});

// Admin: Delete service (toggle inactive)
router.delete('/:id', authenticateToken, requireRole(['admin']), (req, res) => {
  const { id } = req.params;
  try {
    db.prepare('UPDATE services SET is_active = 0 WHERE id = ?').run(id);
    res.json({ message: 'Serviço desativado com sucesso.' });
  } catch (error) {
    console.error('Erro ao desativar serviço:', error);
    res.status(500).json({ error: 'Erro ao desativar serviço.' });
  }
});

module.exports = router;
