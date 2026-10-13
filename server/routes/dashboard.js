const express = require('express');
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// GET /api/dashboard/stats - Admin & Employee dashboard metrics
router.get('/stats', authenticateToken, requireRole(['admin', 'employee']), (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const activityStatus = req.query.status || 'all';
  const activityPeriod = req.query.period || 'all';
  const validActivityStatuses = ['all', 'reservado', 'aguardando', 'concluido', 'cancelado'];
  const activityPeriodModifiers = {
    today: 'start of day',
    '7d': '-7 days',
    '30d': '-30 days'
  };

  if (!validActivityStatuses.includes(activityStatus)) {
    return res.status(400).json({ error: 'Filtro de estado inválido.' });
  }
  if (activityPeriod !== 'all' && !Object.hasOwn(activityPeriodModifiers, activityPeriod)) {
    return res.status(400).json({ error: 'Filtro de período inválido.' });
  }

  try {
    // Today reservations breakdown
    const todayStats = db.prepare(`
      SELECT 
        COUNT(*) as total_today,
        SUM(CASE WHEN status = 'reservado' THEN 1 ELSE 0 END) as reservado_today,
        SUM(CASE WHEN status = 'aguardando' THEN 1 ELSE 0 END) as aguardando_today,
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
    let recentActivityQuery = `
      SELECT h.*, r.reference_code, r.vehicle_plate, u.name as user_name
      FROM reservation_status_history h
      JOIN reservations r ON h.reservation_id = r.id
      LEFT JOIN users u ON h.changed_by_user_id = u.id
      WHERE h.new_status != 'em_atendimento'
    `;
    const activityParams = [];
    if (activityStatus !== 'all') {
      recentActivityQuery += ' AND h.new_status = ?';
      activityParams.push(activityStatus);
    }
    if (activityPeriod !== 'all') {
      recentActivityQuery += " AND h.created_at >= datetime('now', ?)";
      activityParams.push(activityPeriodModifiers[activityPeriod]);
    }
    recentActivityQuery += ' ORDER BY h.created_at DESC LIMIT 50';
    const recentActivity = db.prepare(recentActivityQuery).all(...activityParams);

    res.json({
      todayStats: {
        total: todayStats.total_today || 0,
        reservado: todayStats.reservado_today || 0,
        aguardando: todayStats.aguardando_today || 0,
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

// GET /api/dashboard/reports - Admin reporting data for a date range
router.get('/reports', authenticateToken, requireRole(['admin']), (req, res) => {
  const { start_date: startDate, end_date: endDate } = req.query;
  if (!isValidDate(startDate) || !isValidDate(endDate) || startDate > endDate) {
    return res.status(400).json({ error: 'Indique um intervalo de datas válido.' });
  }

  try {
    const serviceSummary = db.prepare(`
      SELECT
        COUNT(*) as total_reservations,
        SUM(CASE WHEN r.status = 'concluido' THEN 1 ELSE 0 END) as completed_washes,
        SUM(CASE WHEN r.status = 'cancelado' THEN 1 ELSE 0 END) as cancelled_reservations
      FROM reservations r
      WHERE r.scheduled_date BETWEEN ? AND ?
    `).get(startDate, endDate);

    const paymentSummary = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN p.status = 'pago' AND p.simulated = 0 THEN p.amount_paid_mzn ELSE 0 END), 0) as received_mzn,
        COALESCE(SUM(CASE WHEN p.status = 'pago' AND p.simulated = 1 THEN p.amount_paid_mzn ELSE 0 END), 0) as simulated_mzn,
        COALESCE(SUM(CASE WHEN r.status = 'concluido' THEN p.total_discount_mzn ELSE 0 END), 0) as discounts_mzn
      FROM reservations r
      LEFT JOIN reservation_payments p ON p.reservation_id = r.id
      WHERE r.scheduled_date BETWEEN ? AND ?
    `).get(startDate, endDate);

    const serviceBreakdown = db.prepare(`
      SELECT
        s.id,
        s.name,
        COUNT(r.id) as completed_washes,
        COALESCE(SUM(p.original_amount_mzn), 0) as gross_mzn,
        COALESCE(SUM(p.total_discount_mzn), 0) as discounts_mzn,
        COALESCE(SUM(CASE WHEN p.status = 'pago' AND p.simulated = 0 THEN p.amount_paid_mzn ELSE 0 END), 0) as received_mzn
      FROM services s
      LEFT JOIN reservations r
        ON r.service_id = s.id
        AND r.status = 'concluido'
        AND r.scheduled_date BETWEEN ? AND ?
      LEFT JOIN reservation_payments p ON p.reservation_id = r.id
      GROUP BY s.id
      HAVING COUNT(r.id) > 0
      ORDER BY completed_washes DESC, s.name ASC
    `).all(startDate, endDate);

    const loyaltySummary = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'earn' THEN points ELSE 0 END), 0) as points_earned,
        COALESCE(SUM(CASE WHEN type = 'redeem' THEN points ELSE 0 END), 0) as points_redeemed
      FROM loyalty_transactions
      WHERE date(created_at) BETWEEN ? AND ?
    `).get(startDate, endDate);

    const redemptionSummary = db.prepare(`
      SELECT COUNT(*) as rewards_redeemed
      FROM reward_redemptions
      WHERE date(created_at) BETWEEN ? AND ?
    `).get(startDate, endDate);

    res.json({
      period: { start_date: startDate, end_date: endDate },
      summary: {
        totalReservations: serviceSummary.total_reservations || 0,
        completedWashes: serviceSummary.completed_washes || 0,
        cancelledReservations: serviceSummary.cancelled_reservations || 0,
        receivedMzn: paymentSummary.received_mzn,
        simulatedMzn: paymentSummary.simulated_mzn,
        discountsMzn: paymentSummary.discounts_mzn,
        pointsEarned: loyaltySummary.points_earned,
        pointsRedeemed: loyaltySummary.points_redeemed,
        rewardsRedeemed: redemptionSummary.rewards_redeemed
      },
      services: serviceBreakdown
    });
  } catch (error) {
    console.error('Erro ao gerar relatório:', error);
    res.status(500).json({ error: 'Erro ao gerar relatório.' });
  }
});

module.exports = router;
