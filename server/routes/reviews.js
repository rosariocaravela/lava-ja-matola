const express = require('express');
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const reviews = db.prepare(`
      SELECT reviews.id, reviews.rating, reviews.comment, reviews.created_at,
             services.name AS service_name
      FROM reviews
      JOIN reservations ON reservations.id = reviews.reservation_id
      JOIN services ON services.id = reservations.service_id
      ORDER BY reviews.created_at DESC, reviews.id DESC
      LIMIT 30
    `).all();
    const summary = db.prepare(`
      SELECT COUNT(*) AS count, ROUND(AVG(rating), 1) AS average_rating
      FROM reviews
    `).get();
    return res.json({ reviews, summary });
  } catch (error) {
    console.error('Erro ao consultar avaliações:', error);
    return res.status(500).json({ error: 'Não foi possível carregar as avaliações.' });
  }
});

router.get('/mine', authenticateToken, requireRole(['customer']), (req, res) => {
  try {
    const reviews = db.prepare(`
      SELECT id, reservation_id, rating, comment, created_at
      FROM reviews
      WHERE user_id = ?
      ORDER BY created_at DESC, id DESC
    `).all(req.user.id);
    return res.json(reviews);
  } catch (error) {
    console.error('Erro ao consultar avaliações do cliente:', error);
    return res.status(500).json({ error: 'Não foi possível carregar as suas avaliações.' });
  }
});

router.post('/', authenticateToken, requireRole(['customer']), (req, res) => {
  const reservationId = Number(req.body.reservation_id);
  const rating = Number(req.body.rating);
  const comment = typeof req.body.comment === 'string' ? req.body.comment.trim() : '';

  if (!Number.isInteger(reservationId) || reservationId <= 0) {
    return res.status(400).json({ error: 'Selecione uma marcação válida.' });
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'A avaliação deve ser de 1 a 5 estrelas.' });
  }
  if (!comment || comment.length > 1000) {
    return res.status(400).json({ error: 'O comentário é obrigatório e deve ter até 1000 caracteres.' });
  }

  try {
    const reviewColumns = db.prepare('PRAGMA table_info(reviews)').all();
    const reservationColumns = db.prepare('PRAGMA table_info(reservations)').all();
    const reviewUnitColumn = reviewColumns.find(column => column.name === 'unit_id');
    const reservationsHaveUnitId = reservationColumns.some(column => column.name === 'unit_id');
    const businessUnitsTableExists = Boolean(db.prepare(`
      SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'business_units'
    `).get());
    const reservation = db.prepare(`
      SELECT id, user_id, status${reservationsHaveUnitId ? ', unit_id' : ''}
      FROM reservations WHERE id = ?
    `).get(reservationId);
    if (!reservation || reservation.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Marcação não encontrada.' });
    }
    if (reservation.status !== 'concluido') {
      return res.status(409).json({ error: 'Só pode avaliar um serviço já concluído.' });
    }
    if (db.prepare('SELECT id FROM reviews WHERE reservation_id = ?').get(reservationId)) {
      return res.status(409).json({ error: 'Esta marcação já tem uma avaliação.' });
    }

    const columns = ['reservation_id', 'user_id'];
    const values = [reservationId, req.user.id];
    if (reviewUnitColumn) {
      let unitId = reservationsHaveUnitId ? reservation.unit_id : null;
      if (!unitId && businessUnitsTableExists) {
        const primaryUnit = db.prepare(`
          SELECT id FROM business_units
          WHERE is_active = 1
          ORDER BY is_primary DESC, id ASC
          LIMIT 1
        `).get();
        unitId = primaryUnit?.id;
      }
      if (!unitId && reviewUnitColumn.notnull) {
        return res.status(409).json({ error: 'Não foi possível identificar o estabelecimento desta marcação.' });
      }
      columns.push('unit_id');
      values.push(unitId || null);
    }
    columns.push('rating', 'comment');
    values.push(rating, comment);

    const placeholders = columns.map(() => '?').join(', ');
    const result = db.prepare(`
      INSERT INTO reviews (${columns.join(', ')})
      VALUES (${placeholders})
    `).run(...values);

    return res.status(201).json({
      message: 'A sua avaliação foi registada.',
      review: db.prepare(`
        SELECT id, reservation_id, rating, comment, created_at
        FROM reviews WHERE id = ?
      `).get(result.lastInsertRowid)
    });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Esta marcação já tem uma avaliação.' });
    }
    console.error('Erro ao registar avaliação:', error);
    return res.status(500).json({ error: 'Não foi possível registar a avaliação.' });
  }
});

module.exports = router;
