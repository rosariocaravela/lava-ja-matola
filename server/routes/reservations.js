const express = require('express');
const db = require('../db');
const { authenticateToken, optionalToken, requireRole } = require('../middleware/auth');
const { checkAvailability } = require('../utils/scheduling');
const { getPromotion, roundMzn } = require('../utils/billing');

const router = express.Router();

// Generate reference code LJ-XXXX
function generateRefCode() {
  const chars = '0123456789';
  let num = '';
  for (let i = 0; i < 4; i++) {
    num += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `LJ-${num}`;
}

// GET /api/reservations - List reservations
// Customers: own reservations only
// Admin/Employee: all reservations with query filters
router.get('/', authenticateToken, (req, res) => {
  const { status, date, from_date, search } = req.query;
  const user = req.user;

  try {
    let query = `
      SELECT r.*, s.name as service_name, COALESCE(p.original_amount_mzn, s.price_mzn) as price_mzn,
             s.points_reward, p.promotion_code, p.promotion_discount_mzn,
             p.reward_discount_mzn, p.total_discount_mzn, p.amount_paid_mzn,
             p.method as payment_method, p.status as payment_status, p.simulated as payment_simulated,
             p.transaction_reference as payment_reference, p.paid_at as payment_paid_at,
             u.name as registered_user_name, u.email as registered_user_email,
             receiver.name as vehicle_received_by_name
      FROM reservations r
      JOIN services s ON r.service_id = s.id
      LEFT JOIN reservation_payments p ON p.reservation_id = r.id
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN users receiver ON receiver.id = r.vehicle_received_by_user_id
      WHERE 1=1
    `;
    const params = [];

    // Isolation: Customer only sees their own
    if (user.role === 'customer') {
      query += ' AND r.user_id = ?';
      params.push(user.id);
    } else {
      // Employee / Admin filters
      if (status) {
        query += ' AND r.status = ?';
        params.push(status);
      }
      if (date) {
        query += ' AND r.scheduled_date = ?';
        params.push(date);
      }
      if (from_date) {
        query += ' AND r.scheduled_date >= ?';
        params.push(from_date);
      }
      if (search) {
        query += ' AND (r.reference_code LIKE ? OR r.customer_name LIKE ? OR r.vehicle_plate LIKE ?)';
        const term = `%${search.trim()}%`;
        params.push(term, term, term);
      }
    }

    query += ' ORDER BY r.scheduled_date DESC, r.scheduled_time DESC';

    const reservations = db.prepare(query).all(...params);
    res.json(reservations);
  } catch (error) {
    console.error('Erro ao listar reservas:', error);
    res.status(500).json({ error: 'Erro ao listar reservas.' });
  }
});

// GET /api/reservations/:id - Get details with history
router.get('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const user = req.user;

  try {
    const reservation = db.prepare(`
      SELECT r.*, s.name as service_name, COALESCE(p.original_amount_mzn, s.price_mzn) as price_mzn,
             s.points_reward, p.promotion_code, p.promotion_discount_mzn,
             p.reward_discount_mzn, p.total_discount_mzn, p.amount_paid_mzn,
             p.method as payment_method, p.status as payment_status, p.simulated as payment_simulated,
             p.transaction_reference as payment_reference, p.paid_at as payment_paid_at,
             receiver.name as vehicle_received_by_name
      FROM reservations r
      JOIN services s ON r.service_id = s.id
      LEFT JOIN reservation_payments p ON p.reservation_id = r.id
      LEFT JOIN users receiver ON receiver.id = r.vehicle_received_by_user_id
      WHERE r.id = ?
    `).get(id);

    if (!reservation) {
      return res.status(404).json({ error: 'Reserva não encontrada.' });
    }
    // Data isolation check: Customers can only see their own
    if (user.role === 'customer' && reservation.user_id !== user.id) {
      return res.status(403).json({ error: 'Acesso negado aos dados desta reserva.' });
    }

    const history = db.prepare(`
      SELECT h.*, u.name as changed_by_name
      FROM reservation_status_history h
      LEFT JOIN users u ON h.changed_by_user_id = u.id
      WHERE h.reservation_id = ?
      ORDER BY h.created_at ASC
    `).all(id);

    res.json({ reservation, history });
  } catch (error) {
    console.error('Erro ao obter reserva:', error);
    res.status(500).json({ error: 'Erro ao consultar detalhes da reserva.' });
  }
});

// POST /api/reservations - Create reservation
router.post('/', optionalToken, (req, res) => {
  const {
    customer_name,
    customer_phone,
    vehicle_plate,
    vehicle_model,
    service_id,
    scheduled_date,
    scheduled_time,
    booking_type = 'shop',
    location_address,
    created_for_customer = false,
    notes,
    promo_code
  } = req.body;

  if (!customer_name || !customer_phone || !vehicle_plate || !vehicle_model || !service_id || !scheduled_date || !scheduled_time) {
    return res.status(400).json({ error: 'Por favor preencha todos os campos obrigatórios.' });
  }
  if (!['shop', 'onsite'].includes(booking_type)) {
    return res.status(400).json({ error: 'Selecione uma modalidade de lavagem válida.' });
  }
  if (typeof created_for_customer !== 'boolean') {
    return res.status(400).json({ error: 'O tipo de marcação enviado é inválido.' });
  }
  if (created_for_customer && !['employee', 'admin'].includes(req.user?.role)) {
    return res.status(403).json({ error: 'Só um funcionário pode criar uma marcação em nome de um cliente.' });
  }
  if (booking_type === 'onsite' && (typeof location_address !== 'string' || !location_address.trim())) {
    return res.status(400).json({ error: 'Indique o endereço onde a equipa deverá realizar a lavagem.' });
  }

  try {
    const service = db.prepare('SELECT * FROM services WHERE id = ? AND is_active = 1').get(service_id);
    if (!service) {
      return res.status(404).json({ error: 'Serviço selecionado não existe ou está inativo.' });
    }

    const { promotion, error: promotionError } = getPromotion(db, promo_code, service.id, scheduled_date);
    if (promotionError) {
      return res.status(400).json({ error: promotionError });
    }
    const promotionDiscount = promotion
      ? Math.min(service.price_mzn, roundMzn(service.price_mzn * promotion.discount_percentage / 100))
      : 0;

    // Validate availability and capacity
    const availability = checkAvailability(scheduled_date, scheduled_time, service.duration_minutes, null, booking_type);
    if (!availability.available) {
      return res.status(409).json({
        error: availability.reason || 'O horário selecionado não está disponível.'
      });
    }

    // Generate unique reference code
    let refCode = generateRefCode();
    while (db.prepare('SELECT id FROM reservations WHERE reference_code = ?').get(refCode)) {
      refCode = generateRefCode();
    }

    const userId = created_for_customer
      ? db.prepare("SELECT id FROM users WHERE role = 'customer' AND phone = ? AND is_active = 1").get(customer_phone.trim())?.id || null
      : req.user ? req.user.id : null;
    const actorUserId = req.user ? req.user.id : null;

    // Use transaction for reservation creation and audit log
    const createTx = db.transaction(() => {
      const finalAvailability = checkAvailability(scheduled_date, scheduled_time, service.duration_minutes, null, booking_type);
      if (!finalAvailability.available) {
        const availabilityError = new Error(finalAvailability.reason || 'O horário selecionado já não está disponível.');
        availabilityError.code = 'SLOT_UNAVAILABLE';
        throw availabilityError;
      }

      const stmt = db.prepare(`
        INSERT INTO reservations (
          reference_code, user_id, customer_name, customer_phone, vehicle_plate, 
          vehicle_model, service_id, scheduled_date, scheduled_time, duration_minutes, 
          end_time, bay_number, booking_type, location_address, status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'reservado', ?)
      `);

      const result = stmt.run(
        refCode,
        userId,
        customer_name.trim(),
        customer_phone.trim(),
        vehicle_plate.trim().toUpperCase(),
        vehicle_model.trim(),
        service.id,
        scheduled_date,
        scheduled_time,
        service.duration_minutes,
        finalAvailability.endTime,
        finalAvailability.assignedBay,
        booking_type,
        booking_type === 'onsite' ? location_address.trim() : null,
        notes ? notes.trim() : null
      );

      const reservationId = result.lastInsertRowid;

      db.prepare(`
        INSERT INTO reservation_payments (
          reservation_id, original_amount_mzn, promotion_code, promotion_discount_mzn,
          total_discount_mzn
        ) VALUES (?, ?, ?, ?, ?)
      `).run(
        reservationId,
        service.price_mzn,
        promotion?.code || null,
        promotionDiscount,
        promotionDiscount
      );

      // Status history entry
      db.prepare(`
        INSERT INTO reservation_status_history (reservation_id, old_status, new_status, changed_by_user_id, notes)
        VALUES (?, NULL, 'reservado', ?, 'Reserva criada com sucesso')
      `).run(reservationId, actorUserId);

      // Notification
      if (userId) {
        db.prepare(`
          INSERT INTO notifications (user_id, target_role, title, message, type, reservation_id)
          VALUES (?, 'customer', 'Reserva Confirmada! 📅', ?, 'info', ?)
        `).run(
          userId,
          `A sua reserva ${booking_type === 'onsite' ? 'no local indicado' : 'nas instalações'} para ${service.name} (${refCode}) no dia ${scheduled_date} às ${scheduled_time} foi confirmada.`,
          reservationId
        );
      }

      // Notify employees
      db.prepare(`
        INSERT INTO notifications (target_role, title, message, type, reservation_id)
        VALUES ('employee', 'Nova Reserva Agendada', ?, 'info', ?)
      `).run(
        `Nova reserva ${refCode} (${booking_type === 'onsite' ? 'lavagem no local' : 'nas instalações'}): ${customer_name.trim()} — ${vehicle_plate.trim().toUpperCase()}, ${service.name}, para ${scheduled_date} às ${scheduled_time}.${booking_type === 'onsite' ? ` Endereço: ${location_address.trim()}.` : ''}`,
        reservationId
      );

      return reservationId;
    });

    const newReservationId = createTx();

    const createdReservation = db.prepare(`
      SELECT r.*, s.name as service_name, p.original_amount_mzn as price_mzn,
             s.points_reward, p.promotion_code, p.promotion_discount_mzn,
             p.total_discount_mzn, p.amount_paid_mzn, p.status as payment_status
      FROM reservations r
      JOIN services s ON r.service_id = s.id
      JOIN reservation_payments p ON p.reservation_id = r.id
      WHERE r.id = ?
    `).get(newReservationId);

    res.status(201).json({
      message: 'Reserva confirmada com sucesso!',
      reservation: createdReservation
    });
  } catch (error) {
    if (error.code === 'SLOT_UNAVAILABLE') {
      return res.status(409).json({ error: error.message });
    }
    console.error('Erro ao criar reserva:', error);
    res.status(500).json({ error: 'Erro ao criar reserva.' });
  }
});

// POST /api/reservations/register-completed - Staff registers a wash that is already finished!
router.post('/register-completed', authenticateToken, requireRole(['employee', 'admin']), (req, res) => {
  const {
    customer_name,
    customer_phone,
    vehicle_plate,
    vehicle_model,
    service_id,
    notes
  } = req.body;

  if (!customer_name || !vehicle_plate || !service_id) {
    return res.status(400).json({ error: 'Nome do cliente, matrícula e serviço são obrigatórios.' });
  }

  try {
    const service = db.prepare('SELECT * FROM services WHERE id = ?').get(service_id);
    if (!service) {
      return res.status(404).json({ error: 'Serviço não encontrado.' });
    }

    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    let refCode = generateRefCode();
    while (db.prepare('SELECT id FROM reservations WHERE reference_code = ?').get(refCode)) {
      refCode = generateRefCode();
    }

    // Check if customer user exists by phone
    let customerUser = null;
    if (customer_phone) {
      customerUser = db.prepare("SELECT id FROM users WHERE role = 'customer' AND is_active = 1 AND phone = ?").get(customer_phone.trim());
    }

    const tx = db.transaction(() => {
      const stmt = db.prepare(`
        INSERT INTO reservations (
          reference_code, user_id, customer_name, customer_phone, vehicle_plate,
          vehicle_model, service_id, scheduled_date, scheduled_time, duration_minutes,
          end_time, bay_number, status, notes, points_awarded, vehicle_received_at,
          vehicle_received_by_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'concluido', ?, 1, CURRENT_TIMESTAMP, ?)
      `);

      const result = stmt.run(
        refCode,
        customerUser ? customerUser.id : null,
        customer_name.trim(),
        customer_phone ? customer_phone.trim() : 'Presencial',
        vehicle_plate.trim().toUpperCase(),
        vehicle_model ? vehicle_model.trim() : 'Viatura',
        service.id,
        today,
        timeStr,
        service.duration_minutes,
        timeStr,
        notes ? notes.trim() : 'Lavagem concluída registada no balcão',
        req.user.id
      );

      const reservationId = result.lastInsertRowid;

      db.prepare(`
        INSERT INTO reservation_payments (reservation_id, original_amount_mzn)
        VALUES (?, ?)
      `).run(reservationId, service.price_mzn);

      // History
      db.prepare(`
        INSERT INTO reservation_status_history (reservation_id, old_status, new_status, changed_by_user_id, notes)
        VALUES (?, NULL, 'concluido', ?, 'Registo imediato de lavagem concluída')
      `).run(reservationId, req.user.id);

      // Award points if customer is registered
      if (customerUser) {
        let loyalty = db.prepare('SELECT id FROM loyalty_accounts WHERE user_id = ?').get(customerUser.id);
        if (!loyalty) {
          const newAcc = db.prepare('INSERT INTO loyalty_accounts (user_id, balance_points, lifetime_points) VALUES (?, 0, 0)').run(customerUser.id);
          loyalty = { id: newAcc.lastInsertRowid };
        }

        const pts = service.points_reward;
        db.prepare('UPDATE loyalty_accounts SET balance_points = balance_points + ?, lifetime_points = lifetime_points + ? WHERE id = ?').run(pts, pts, loyalty.id);
        db.prepare(`
          INSERT INTO loyalty_transactions (account_id, user_id, reservation_id, type, points, description)
          VALUES (?, ?, ?, 'earn', ?, ?)
        `).run(loyalty.id, customerUser.id, reservationId, pts, `Pontos da lavagem: ${service.name} (${refCode})`);

        db.prepare(`
          INSERT INTO notifications (user_id, target_role, title, message, type, reservation_id)
          VALUES (?, 'customer', 'Lavagem Concluída & Pontos Ganhos! 🚗✨', ?, 'success', ?)
        `).run(customerUser.id, `A sua lavagem (${vehicle_plate}) foi concluída e creditou +${pts} pontos no seu Passaporte!`, reservationId);
      }

      return reservationId;
    });

    const newId = tx();

    const created = db.prepare(`
      SELECT r.*, s.name as service_name, receiver.name as vehicle_received_by_name,
             p.original_amount_mzn as price_mzn,
             s.points_reward, p.total_discount_mzn, p.amount_paid_mzn, p.status as payment_status
      FROM reservations r
      JOIN services s ON r.service_id = s.id
      JOIN reservation_payments p ON p.reservation_id = r.id
      LEFT JOIN users receiver ON receiver.id = r.vehicle_received_by_user_id
      WHERE r.id = ?
    `).get(newId);

    res.status(201).json({
      message: 'Lavagem concluída registada com sucesso!',
      reservation: created
    });
  } catch (error) {
    console.error('Erro ao registar lavagem concluída:', error);
    res.status(500).json({ error: 'Erro ao registar lavagem.' });
  }
});

// POST /api/reservations/:id/receive - Staff confirms the vehicle was handed over
router.post('/:id/receive', authenticateToken, requireRole(['employee', 'admin']), (req, res) => {
  const reservationId = Number(req.params.id);
  if (!Number.isInteger(reservationId) || reservationId <= 0) {
    return res.status(400).json({ error: 'Identificador de reserva inválido.' });
  }

  try {
    const reservation = db.prepare(`
      SELECT r.*, s.name as service_name, receiver.name as vehicle_received_by_name
      FROM reservations r
      JOIN services s ON s.id = r.service_id
      LEFT JOIN users receiver ON receiver.id = r.vehicle_received_by_user_id
      WHERE r.id = ?
    `).get(reservationId);

    if (!reservation) {
      return res.status(404).json({ error: 'Reserva não encontrada.' });
    }
    if (reservation.booking_type === 'onsite') {
      return res.status(400).json({ error: 'A lavagem no local não passa pelo processo de receção de viatura no balcão.' });
    }
    const receivingUser = db.prepare('SELECT name FROM users WHERE id = ?').get(req.user.id);
    if (!receivingUser) {
      return res.status(401).json({ error: 'Conta do funcionário não encontrada.' });
    }
    if (reservation.vehicle_received_at) {
      return res.json({
        message: 'A receção desta viatura já foi confirmada.',
        reservation
      });
    }
    if (!['reservado', 'aguardando', 'em_atendimento'].includes(reservation.status)) {
      return res.status(400).json({
        error: 'Só é possível confirmar a receção antes de a lavagem ser concluída.'
      });
    }
    const receivedStatus = reservation.status === 'reservado' ? 'aguardando' : reservation.status;

    const receiveTx = db.transaction(() => {
      db.prepare(`
        UPDATE reservations
        SET status = ?,
            vehicle_received_at = CURRENT_TIMESTAMP,
            vehicle_received_by_user_id = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND vehicle_received_at IS NULL
      `).run(receivedStatus, req.user.id, reservationId);

      db.prepare(`
        INSERT INTO reservation_status_history (reservation_id, old_status, new_status, changed_by_user_id, notes)
        VALUES (?, ?, ?, ?, 'Receção da viatura confirmada no balcão')
      `).run(reservationId, reservation.status, receivedStatus, req.user.id);

      if (reservation.user_id) {
        db.prepare(`
          INSERT INTO notifications (user_id, target_role, title, message, type, reservation_id)
          VALUES (?, 'customer', 'Viatura recebida', ?, 'success', ?)
        `).run(
          reservation.user_id,
          `A viatura ${reservation.vehicle_plate} foi recebida por ${receivingUser.name}. O comprovativo já está disponível no seu painel.`,
          reservationId
        );
      }
    });
    receiveTx();

    const updated = db.prepare(`
      SELECT r.*, s.name as service_name, receiver.name as vehicle_received_by_name
      FROM reservations r
      JOIN services s ON s.id = r.service_id
      LEFT JOIN users receiver ON receiver.id = r.vehicle_received_by_user_id
      WHERE r.id = ?
    `).get(reservationId);

    res.json({
      message: 'Receção da viatura confirmada. O comprovativo está disponível.',
      reservation: updated
    });
  } catch (error) {
    console.error('Erro ao confirmar receção da viatura:', error);
    res.status(500).json({ error: 'Erro ao confirmar a receção da viatura.' });
  }
});


// PATCH /api/reservations/:id/status - Update reservation status
// Allowed for employee and admin (or customer cancelling own booking)
router.patch('/:id/status', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { new_status, notes } = req.body;
  const user = req.user;

  const validStatuses = ['reservado', 'aguardando', 'em_atendimento', 'concluido', 'cancelado'];
  if (!validStatuses.includes(new_status)) {
    return res.status(400).json({ error: 'Estado de reserva inválido.' });
  }

  try {
    const reservation = db.prepare(`
      SELECT r.*, s.name as service_name, s.points_reward
      FROM reservations r
      JOIN services s ON r.service_id = s.id
      WHERE r.id = ?
    `).get(id);

    if (!reservation) {
      return res.status(404).json({ error: 'Reserva não encontrada.' });
    }

    // Role verification:
    // Customers can ONLY cancel their own reservation if not already in progress or completed
    if (user.role === 'customer') {
      if (reservation.user_id !== user.id) {
        return res.status(403).json({ error: 'Não tem permissão para alterar esta reserva.' });
      }
      if (new_status !== 'cancelado') {
        return res.status(403).json({ error: 'Clientes só podem solicitar o cancelamento da reserva.' });
      }
      if (['em_atendimento', 'concluido'].includes(reservation.status)) {
        return res.status(400).json({ error: 'Não é possível cancelar uma lavagem em atendimento ou já concluída.' });
      }
      if (reservation.vehicle_received_at) {
        return res.status(400).json({ error: 'Não é possível cancelar uma reserva depois de a viatura ser recebida.' });
      }
    } else if (!['employee', 'admin'].includes(user.role)) {
      return res.status(403).json({ error: 'Não tem permissão para alterar esta reserva.' });
    }

    if (reservation.status === new_status) {
      return res.json({ message: 'A reserva já se encontra neste estado.', reservation });
    }

    if (['employee', 'admin'].includes(user.role)) {
      const allowedTransitions = {
        reservado: ['aguardando', 'em_atendimento', 'cancelado'],
        aguardando: ['em_atendimento', 'cancelado'],
        em_atendimento: ['concluido', 'cancelado']
      };
      if (!allowedTransitions[reservation.status]?.includes(new_status)) {
        return res.status(400).json({
          error: `Não é possível alterar o estado de "${reservation.status}" para "${new_status}".`
        });
      }
    }

    // Transaction to update status, track history, handle points attribution & notifications atomically
    const updateTx = db.transaction(() => {
      let pointsAwarded = reservation.points_awarded;

      // When marking as 'concluido', award points to customer once
      if (new_status === 'concluido' && reservation.user_id && reservation.points_awarded === 0) {
        const pointsToAdd = reservation.points_reward;

        // Ensure loyalty account exists
        let loyalty = db.prepare('SELECT id, balance_points, lifetime_points FROM loyalty_accounts WHERE user_id = ?').get(reservation.user_id);
        if (!loyalty) {
          const newAcc = db.prepare('INSERT INTO loyalty_accounts (user_id, balance_points, lifetime_points) VALUES (?, 0, 0)').run(reservation.user_id);
          loyalty = { id: newAcc.lastInsertRowid, balance_points: 0, lifetime_points: 0 };
        }

        // Update loyalty account balance
        db.prepare(`
          UPDATE loyalty_accounts 
          SET balance_points = balance_points + ?, lifetime_points = lifetime_points + ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(pointsToAdd, pointsToAdd, loyalty.id);

        // Record loyalty transaction
        db.prepare(`
          INSERT INTO loyalty_transactions (account_id, user_id, reservation_id, type, points, description)
          VALUES (?, ?, ?, 'earn', ?, ?)
        `).run(loyalty.id, reservation.user_id, reservation.id, pointsToAdd, `Pontos ganhos com a lavagem concluída: ${reservation.service_name} (${reservation.reference_code})`);

        pointsAwarded = 1;

        // Notification: Points credited
        db.prepare(`
          INSERT INTO notifications (user_id, target_role, title, message, type, reservation_id)
          VALUES (?, 'customer', 'Passaporte Lava Já: +Pontos!', ?, 'success', ?)
        `).run(
          reservation.user_id,
          `Parabéns! Ganhou ${pointsToAdd} pontos pela lavagem do seu veículo (${reservation.vehicle_plate}).`,
          reservation.id
        );
      }

      // Update reservation status
      db.prepare(`
        UPDATE reservations 
        SET status = ?, points_awarded = ?,
            vehicle_received_at = CASE
              WHEN booking_type = 'shop' AND ? = 'em_atendimento' AND vehicle_received_at IS NULL THEN CURRENT_TIMESTAMP
              ELSE vehicle_received_at
            END,
            vehicle_received_by_user_id = CASE
              WHEN booking_type = 'shop' AND ? = 'em_atendimento' AND vehicle_received_at IS NULL THEN ?
              ELSE vehicle_received_by_user_id
            END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(new_status, pointsAwarded, new_status, new_status, user.id, id);

      // Add to status history
      db.prepare(`
        INSERT INTO reservation_status_history (reservation_id, old_status, new_status, changed_by_user_id, notes)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, reservation.status, new_status, user.id, notes || `Estado alterado para ${new_status}`);

      // Internal notifications based on new status
      if (new_status === 'concluido') {
        if (reservation.user_id) {
          db.prepare(`
            INSERT INTO notifications (user_id, target_role, title, message, type, reservation_id)
            VALUES (?, 'customer', 'Serviço Concluído! 🚗✨', ?, 'success', ?)
          `).run(
            reservation.user_id,
            reservation.booking_type === 'onsite'
              ? `A lavagem da sua viatura (${reservation.vehicle_plate}) foi concluída no local indicado.`
              : `A lavagem do seu ${reservation.vehicle_model} (${reservation.vehicle_plate}) foi concluída com sucesso! O veículo está pronto para levantamento.`,
            id
          );
        }
      } else if (new_status === 'cancelado') {
        const cancellationMessage = `A reserva ${reservation.reference_code} de ${reservation.customer_name} (${reservation.vehicle_plate}) para ${reservation.scheduled_date} às ${reservation.scheduled_time} foi cancelada.`;
        db.prepare(`
          INSERT INTO notifications (target_role, title, message, type, reservation_id)
          VALUES ('employee', 'Agendamento Cancelado', ?, 'warning', ?)
        `).run(cancellationMessage, id);

        if (reservation.user_id) {
          db.prepare(`
            INSERT INTO notifications (user_id, target_role, title, message, type, reservation_id)
            VALUES (?, 'customer', 'Agendamento Cancelado', ?, 'warning', ?)
          `).run(
            reservation.user_id,
            `O agendamento ${reservation.reference_code} para ${reservation.scheduled_date} às ${reservation.scheduled_time} foi cancelado.`,
            id
          );
        }
      } else if (new_status === 'em_atendimento') {
        if (reservation.user_id) {
          db.prepare(`
            INSERT INTO notifications (user_id, target_role, title, message, type, reservation_id)
            VALUES (?, 'customer', 'Lavagem Iniciada 🧼', ?, 'info', ?)
          `).run(
            reservation.user_id,
            `O seu ${reservation.vehicle_model} (${reservation.vehicle_plate}) entrou em atendimento na Vaga ${reservation.bay_number || 1}.`,
            id
          );
        }
      }
    });

    updateTx();

    const updated = db.prepare(`
      SELECT r.*, s.name as service_name, p.original_amount_mzn as price_mzn,
             s.points_reward, p.promotion_code, p.promotion_discount_mzn,
             p.total_discount_mzn, p.amount_paid_mzn, p.method as payment_method,
             p.status as payment_status, p.simulated as payment_simulated,
             p.transaction_reference as payment_reference, p.paid_at as payment_paid_at,
             receiver.name as vehicle_received_by_name
      FROM reservations r
      JOIN services s ON r.service_id = s.id
      LEFT JOIN reservation_payments p ON p.reservation_id = r.id
      LEFT JOIN users receiver ON receiver.id = r.vehicle_received_by_user_id
      WHERE r.id = ?
    `).get(id);

    res.json({
      message: `Estado atualizado para "${new_status}" com sucesso!`,
      reservation: updated
    });
  } catch (error) {
    console.error('Erro ao atualizar estado da reserva:', error);
    res.status(500).json({ error: 'Erro ao atualizar estado da reserva.' });
  }
});

module.exports = router;
