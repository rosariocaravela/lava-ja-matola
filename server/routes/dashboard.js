const express = require('express');
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/dashboard/stats - Admin & Employee dashboard metrics
router.get('/stats', authenticateToken, requireRole(['admin', 'employee']), (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  try {
    // Today reservations breakdown
    const todayStats = db.prepare(`
      SELECT 
        COUNT(*) as total_today,
        SUM(CASE WHEN status = 'reservado' THEN 1 ELSE 0 END) as reservado_today,
        SUM(CASE WHEN status = 'aguardando' THEN 1 ELSE 0 END) as aguardando_today,
        SUM(CASE WHEN status = 'em_atendimento' THEN 1 ELSE 0 END) as em_atendimento_today,
        SUM(CASE WHEN status = 'concluido' THEN 1 ELSE 0 END) as concluido_today,
        SUM(CASE WHEN status = 'cancelado' THEN 1 ELSE 0 END) as cancelado_today,
        COALESCE(SUM(CASE WHEN status = 'concluido' THEN s.price_mzn ELSE 0 END), 0) as faturacao_today_mzn
      FROM reservations r
      JOIN services s ON r.service_id = s.id
      WHERE r.scheduled_date = ?
    `).get(today);

    // Global counts
    const globalUsers = db.prepare(`
      SELECT 
        COUNT(*) as total_users,
        SUM(CASE WHEN role = 'customer' THEN 1 ELSE 0 END) as total_customers,
        SUM(CASE WHEN role = 'employee' THEN 1 ELSE 0 END) as total_employees
      FROM users
    `).get();

    // Customers: new vs recurring
    const customerRetention = db.prepare(`
      SELECT 
        COUNT(DISTINCT user_id) as total_served_customers,
        SUM(CASE WHEN res_count > 1 THEN 1 ELSE 0 END) as recurring_customers,
        SUM(CASE WHEN res_count = 1 THEN 1 ELSE 0 END) as new_customers
      FROM (
        SELECT user_id, COUNT(*) as res_count 
        FROM reservations 
        WHERE user_id IS NOT NULL AND status = 'concluido'
        GROUP BY user_id
      )
    `).get() || { total_served_customers: 0, recurring_customers: 0, new_customers: 0 };

    // Points stats
    const pointsStats = db.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'earn' THEN points ELSE 0 END), 0) as total_points_earned,
        COALESCE(SUM(CASE WHEN type = 'redeem' THEN points ELSE 0 END), 0) as total_points_redeemed
      FROM loyalty_transactions
    `).get();

    // Top services
    const topServices = db.prepare(`
      SELECT s.id, s.name, s.price_mzn, COUNT(r.id) as booking_count
      FROM services s
      LEFT JOIN reservations r ON s.id = r.service_id
      GROUP BY s.id
      ORDER BY booking_count DESC
      LIMIT 5
    `).all();

    // Hourly demand distribution
    const hourlyDemand = db.prepare(`
      SELECT scheduled_time, COUNT(*) as count
      FROM reservations
      GROUP BY scheduled_time
      ORDER BY scheduled_time ASC
    `).all();

    // Active promotions count
    const activePromos = db.prepare(`
      SELECT COUNT(*) as count FROM promotions WHERE is_active = 1 AND start_date <= ? AND end_date >= ?
    `).get(today, today);

    // Recent activity audit
    const recentActivity = db.prepare(`
      SELECT h.*, r.reference_code, r.vehicle_plate, u.name as user_name
      FROM reservation_status_history h
      JOIN reservations r ON h.reservation_id = r.id
      LEFT JOIN users u ON h.changed_by_user_id = u.id
      ORDER BY h.created_at DESC
      LIMIT 10
    `).all();

    res.json({
      todayStats: {
        total: todayStats.total_today || 0,
        reservado: todayStats.reservado_today || 0,
        aguardando: todayStats.aguardando_today || 0,
        em_atendimento: todayStats.em_atendimento_today || 0,
        concluido: todayStats.concluido_today || 0,
        cancelado: todayStats.cancelado_today || 0,
        revenueMzn: todayStats.faturacao_today_mzn || 0
      },
      users: globalUsers,
      customerRetention: {
        newCustomers: customerRetention.new_customers || 1,
        recurringCustomers: customerRetention.recurring_customers || 1,
        totalServed: customerRetention.total_served_customers || 2
      },
      loyalty: {
        pointsEarned: pointsStats.total_points_earned || 0,
        pointsRedeemed: pointsStats.total_points_redeemed || 0
      },
      topServices,
      hourlyDemand,
      activePromotionsCount: activePromos.count || 0,
      recentActivity,
      isDemonstrationData: true
    });
  } catch (error) {
    console.error('Erro ao gerar estatísticas:', error);
    res.status(500).json({ error: 'Erro ao gerar dados do painel.' });
  }
});

module.exports = router;
