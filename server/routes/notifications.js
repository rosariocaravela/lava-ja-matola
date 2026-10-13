const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/notifications - User & role specific notifications
router.get('/', authenticateToken, (req, res) => {
  const user = req.user;

  try {
    const notifications = db.prepare(`
      SELECT * FROM notifications
      WHERE user_id = ? 
         OR target_role = ?
         OR target_role = 'all'
      ORDER BY created_at DESC
      LIMIT 50
    `).all(user.id, user.role);

    const unreadCount = notifications.filter(n => n.is_read === 0).length;

    res.json({
      unreadCount,
      notifications
    });
  } catch (error) {
    console.error('Erro ao listar notificações:', error);
    res.status(500).json({ error: 'Erro ao carregar notificações.' });
  }
});

// PATCH /api/notifications/:id/read - Mark one notification as read
router.patch('/:id/read', authenticateToken, (req, res) => {
  const { id } = req.params;

  try {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao marcar notificação como lida:', error);
    res.status(500).json({ error: 'Erro ao atualizar notificação.' });
  }
});

// POST /api/notifications/read-all - Mark all as read
router.post('/read-all', authenticateToken, (req, res) => {
  const user = req.user;

  try {
    db.prepare(`
      UPDATE notifications 
      SET is_read = 1 
      WHERE user_id = ? OR target_role = ? OR target_role = 'all'
    `).run(user.id, user.role);

    res.json({ success: true, message: 'Todas as notificações foram marcadas como lidas.' });
  } catch (error) {
    console.error('Erro ao marcar todas notificações:', error);
    res.status(500).json({ error: 'Erro ao atualizar notificações.' });
  }
});

module.exports = router;
