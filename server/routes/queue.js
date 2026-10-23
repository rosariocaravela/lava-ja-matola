const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /api/queue - Public, anonymous queue counts for today
router.get('/', (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const settings = db.prepare('SELECT simultaneous_capacity, open_time, close_time FROM business_settings WHERE id = 1').get();
    const capacity = settings.simultaneous_capacity || 3;

    const statusCounts = db.prepare(`
      SELECT status, COUNT(*) as total
      FROM reservations r
      WHERE r.scheduled_date = ?
        AND r.status IN ('em_atendimento', 'aguardando', 'reservado')
      GROUP BY status
    `).all(today);
    const countFor = status => statusCounts.find(item => item.status === status)?.total || 0;
    const totalInService = countFor('em_atendimento');
    const totalInQueue = countFor('aguardando');
    const totalBooked = countFor('reservado');

    res.json({
      date: today,
      capacity,
      availableBays: Math.max(0, capacity - totalInService),
      totalInQueue,
      totalInService,
      totalBooked
    });
  } catch (error) {
    console.error('Erro ao obter fila de atendimento:', error);
    res.status(500).json({ error: 'Erro ao calcular fila de atendimento.' });
  }
});

module.exports = router;
