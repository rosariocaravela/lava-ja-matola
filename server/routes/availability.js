const express = require('express');
const db = require('../db');
const { getAvailableSlots, checkAvailability } = require('../utils/scheduling');

const router = express.Router();

// GET /api/availability?date=YYYY-MM-DD&serviceId=1
router.get('/', (req, res) => {
  const { date, serviceId, duration } = req.query;

  if (!date) {
    return res.status(400).json({ error: 'A data (date=YYYY-MM-DD) é obrigatória.' });
  }

  let durationMinutes = 30;
  if (serviceId) {
    const service = db.prepare('SELECT duration_minutes FROM services WHERE id = ?').get(serviceId);
    if (service) {
      durationMinutes = service.duration_minutes;
    }
  } else if (duration) {
    durationMinutes = parseInt(duration, 10);
  }

  try {
    const slotsData = getAvailableSlots(date, durationMinutes);
    res.json(slotsData);
  } catch (error) {
    console.error('Erro ao verificar disponibilidade:', error);
    res.status(500).json({ error: 'Erro ao calcular horários disponíveis.' });
  }
});

module.exports = router;
