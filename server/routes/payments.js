const crypto = require('crypto');
const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { calculatePayment, getRewardVoucher, roundMzn, BillingError } = require('../utils/billing');

const router = express.Router();
const PAYMENT_METHODS = ['mpesa', 'emola', 'mkesh', 'mozabanco', 'balcao'];

function getReservationPayment(reservationId) {
  return db.prepare(`
    SELECT r.id as reservation_id, r.user_id, r.reference_code, r.customer_name,
           r.customer_phone, r.vehicle_plate, r.vehicle_model, r.service_id,
           r.status as service_status, r.scheduled_date, r.scheduled_time,
           s.name as service_name, p.original_amount_mzn, p.promotion_code,
           p.promotion_discount_mzn, p.reward_code, p.reward_discount_mzn,
           p.reward_title, p.reward_description, p.reward_service_name,
           p.total_discount_mzn, p.amount_paid_mzn, p.method, p.status as payment_status,
           p.simulated, p.transaction_reference, p.created_at, p.paid_at
    FROM reservations r
    JOIN services s ON s.id = r.service_id
    JOIN reservation_payments p ON p.reservation_id = r.id
    WHERE r.id = ?
  `).get(reservationId);
}

function canAccessPayment(user, reservation) {
  return ['employee', 'admin'].includes(user.role) || reservation.user_id === user.id;
}

function paymentSummary(record, calculation = null) {
  const due = calculation?.amount_due_mzn
    ?? Math.max(0, roundMzn(record.original_amount_mzn - record.total_discount_mzn));

  return {
    reservation: {
      id: record.reservation_id,
      reference_code: record.reference_code,
      customer_name: record.customer_name,
      customer_phone: record.customer_phone,
      vehicle_plate: record.vehicle_plate,
      vehicle_model: record.vehicle_model,
      service_name: record.service_name,
      service_status: record.service_status,
      scheduled_date: record.scheduled_date,
      scheduled_time: record.scheduled_time
    },
    payment: {
      original_amount_mzn: calculation?.original_amount_mzn ?? record.original_amount_mzn,
      promotion_code: record.promotion_code,
      promotion_discount_mzn: calculation?.promotion_discount_mzn ?? record.promotion_discount_mzn,
      reward_code: calculation?.reward_code ?? record.reward_code,
      reward_title: calculation?.reward_title ?? record.reward_title,
      reward_description: calculation?.reward_description ?? record.reward_description,
      reward_service_name: calculation?.reward_service_name ?? record.reward_service_name,
      reward_discount_mzn: calculation?.reward_discount_mzn ?? record.reward_discount_mzn,
      total_discount_mzn: calculation?.total_discount_mzn ?? record.total_discount_mzn,
      amount_due_mzn: due,
      amount_paid_mzn: record.amount_paid_mzn,
      method: record.method,
      status: record.payment_status,
      simulated: Boolean(record.simulated),
      transaction_reference: record.transaction_reference,
      created_at: record.created_at,
      paid_at: record.paid_at
    }
  };
}

function loadAuthorizedReservation(req, res, reservationId) {
  const reservation = getReservationPayment(reservationId);
  if (!reservation) {
    res.status(404).json({ error: 'Marcação ou cobrança não encontrada.' });
    return null;
  }
  if (!canAccessPayment(req.user, reservation)) {
    res.status(403).json({ error: 'Não tem permissão para consultar esta cobrança.' });
    return null;
  }
  return reservation;
}

function calculateForCode(reservation, record, code) {
  const voucher = code ? getRewardVoucher(db, reservation, code) : null;
  return calculatePayment(
    record.original_amount_mzn,
    record.promotion_discount_mzn,
    voucher
  );
}

router.get('/:reservationId', authenticateToken, (req, res) => {
  const reservationId = Number(req.params.reservationId);
  if (!Number.isInteger(reservationId) || reservationId <= 0) {
    return res.status(400).json({ error: 'Referência de marcação inválida.' });
  }

  try {
    const record = loadAuthorizedReservation(req, res, reservationId);
    if (!record) return;
    return res.json(paymentSummary(record));
  } catch (error) {
    console.error('Erro ao consultar cobrança:', error);
    return res.status(500).json({ error: 'Erro ao consultar a cobrança.' });
  }
});

router.post('/:reservationId/preview-voucher', authenticateToken, (req, res) => {
  const reservationId = Number(req.params.reservationId);
  if (!Number.isInteger(reservationId) || reservationId <= 0) {
    return res.status(400).json({ error: 'Referência de marcação inválida.' });
  }

  try {
    const record = loadAuthorizedReservation(req, res, reservationId);
    if (!record) return;
    if (record.payment_status !== 'pendente') {
      return res.status(409).json({ error: 'Esta cobrança já não está pendente.' });
    }

    const code = String(req.body.code || '').trim();
    const calculation = calculateForCode(record, record, code);
    return res.json(paymentSummary(record, calculation));
  } catch (error) {
    if (error instanceof BillingError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Erro ao validar voucher para cobrança:', error);
    return res.status(500).json({ error: 'Erro ao validar o voucher.' });
  }
});

router.post('/:reservationId/confirm', authenticateToken, (req, res) => {
  const reservationId = Number(req.params.reservationId);
  const method = String(req.body.method || '').trim().toLowerCase();
  const code = String(req.body.code || '').trim();

  if (!Number.isInteger(reservationId) || reservationId <= 0) {
    return res.status(400).json({ error: 'Referência de marcação inválida.' });
  }
  if (!PAYMENT_METHODS.includes(method)) {
    return res.status(400).json({ error: 'Selecione um método de pagamento válido.' });
  }
  if (method === 'balcao' && !['employee', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'O pagamento no balcão só pode ser confirmado por um funcionário autorizado.' });
  }

  try {
    const initialRecord = loadAuthorizedReservation(req, res, reservationId);
    if (!initialRecord) return;
    if (initialRecord.service_status !== 'concluido') {
      return res.status(409).json({ error: 'A lavagem deve estar concluída antes de confirmar o pagamento.' });
    }
    if (initialRecord.payment_status !== 'pendente') {
      return res.status(409).json({ error: 'Esta cobrança já foi processada.' });
    }

    const confirmPayment = db.transaction(() => {
      const record = getReservationPayment(reservationId);
      if (record.service_status !== 'concluido') {
        throw new BillingError('A lavagem deve estar concluída antes de confirmar o pagamento.', 409);
      }
      if (record.payment_status !== 'pendente') {
        throw new BillingError('Esta cobrança já foi processada.', 409);
      }

      const calculation = calculateForCode(record, record, code);
      if (calculation.voucher_redemption_id) {
        const consumed = db.prepare(`
          UPDATE reward_redemptions
          SET status = 'utilizado', used_at = CURRENT_TIMESTAMP
          WHERE id = ? AND status = 'disponivel'
            AND (expires_at IS NULL OR expires_at >= CURRENT_TIMESTAMP)
        `).run(calculation.voucher_redemption_id);
        if (consumed.changes !== 1) {
          throw new BillingError('Este voucher foi utilizado ou expirou. Atualize a cobrança e tente novamente.', 409);
        }
      }

      const transactionReference = `LJ-PAG-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
      const isSimulated = method !== 'balcao' ? 1 : 0;

      db.prepare(`
        UPDATE reservation_payments
        SET reward_code = ?, reward_discount_mzn = ?, reward_title = ?,
            reward_description = ?, reward_service_name = ?, total_discount_mzn = ?,
            amount_paid_mzn = ?, method = ?, status = 'pago', simulated = ?,
            transaction_reference = ?, paid_at = CURRENT_TIMESTAMP
        WHERE reservation_id = ? AND status = 'pendente'
      `).run(
        calculation.reward_code,
        calculation.reward_discount_mzn,
        calculation.reward_title,
        calculation.reward_description,
        calculation.reward_service_name,
        calculation.total_discount_mzn,
        calculation.amount_due_mzn,
        method,
        isSimulated,
        transactionReference,
        reservationId
      );

      if (record.user_id) {
        db.prepare(`
          INSERT INTO notifications (user_id, target_role, title, message, type, reservation_id)
          VALUES (?, 'customer', ?, ?, 'success', ?)
        `).run(
          record.user_id,
          isSimulated ? 'Pagamento demonstrativo registado' : 'Pagamento recebido',
          `A cobrança da marcação ${record.reference_code} foi ${isSimulated ? 'simulada' : 'recebida'}: ${calculation.amount_due_mzn} MT.`,
          reservationId
        );
      }

      return transactionReference;
    });

    confirmPayment();
    const record = getReservationPayment(reservationId);
    return res.json({
      message: record.simulated
        ? 'Pagamento demonstrativo confirmado. Nenhum valor foi movimentado.'
        : 'Pagamento recebido e registado com sucesso.',
      ...paymentSummary(record)
    });
  } catch (error) {
    if (error instanceof BillingError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Erro ao confirmar pagamento:', error);
    return res.status(500).json({ error: 'Erro ao registar o pagamento.' });
  }
});

module.exports = router;
