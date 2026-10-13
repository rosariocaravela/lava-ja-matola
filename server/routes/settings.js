const express = require('express');
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Public: Get business settings & location
router.get('/', (req, res) => {
  try {
    const settings = db.prepare('SELECT * FROM business_settings WHERE id = 1').get();
    res.json(settings);
  } catch (error) {
    console.error('Erro ao obter configurações:', error);
    res.status(500).json({ error: 'Erro ao carregar dados do estabelecimento.' });
  }
});

// Admin: Update settings
router.put('/', authenticateToken, requireRole(['admin']), (req, res) => {
  const {
    name, address, phone, email, google_maps_url, coordinates,
    open_time, close_time, slot_interval_minutes, simultaneous_capacity,
    points_per_mzn, is_demo_mode
  } = req.body;

  try {
    const stmt = db.prepare(`
      UPDATE business_settings SET
        name = COALESCE(?, name),
        address = COALESCE(?, address),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        google_maps_url = COALESCE(?, google_maps_url),
        coordinates = COALESCE(?, coordinates),
        open_time = COALESCE(?, open_time),
        close_time = COALESCE(?, close_time),
        slot_interval_minutes = COALESCE(?, slot_interval_minutes),
        simultaneous_capacity = COALESCE(?, simultaneous_capacity),
        points_per_mzn = COALESCE(?, points_per_mzn),
        is_demo_mode = COALESCE(?, is_demo_mode),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `);

    stmt.run(
      name, address, phone, email, google_maps_url, coordinates,
      open_time, close_time, slot_interval_minutes, simultaneous_capacity,
      points_per_mzn, is_demo_mode !== undefined ? (is_demo_mode ? 1 : 0) : undefined
    );

    const updated = db.prepare('SELECT * FROM business_settings WHERE id = 1').get();
    res.json({ message: 'Configurações atualizadas com sucesso!', settings: updated });
  } catch (error) {
    console.error('Erro ao atualizar configurações:', error);
    res.status(500).json({ error: 'Erro ao atualizar dados do estabelecimento.' });
  }
});

module.exports = router;
