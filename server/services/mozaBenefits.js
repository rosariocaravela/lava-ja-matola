const crypto = require('crypto');
const db = require('../db');
const { getMozaBenefitsConfig } = require('../config/moza-benefits');

function generateBenefitCode() {
  return `MOZA-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

function createActiveCycle(userId) {
  const config = getMozaBenefitsConfig();
  db.prepare(`
    UPDATE moza_benefit_cycles
    SET status = 'expired', updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ? AND status = 'unlocked'
      AND expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP
  `).run(userId);

  let cycle = db.prepare(`
    SELECT * FROM moza_benefit_cycles
    WHERE user_id = ? AND status IN ('in_progress', 'unlocked')
    ORDER BY cycle_number DESC LIMIT 1
  `).get(userId);

  if (!cycle) {
    const previousCycle = db.prepare(
      'SELECT COALESCE(MAX(cycle_number), 0) AS cycle_number FROM moza_benefit_cycles WHERE user_id = ?'
    ).get(userId);
    const result = db.prepare(`
      INSERT INTO moza_benefit_cycles (user_id, cycle_number, status)
      VALUES (?, ?, 'in_progress')
    `).run(userId, previousCycle.cycle_number + 1);
    cycle = db.prepare('SELECT * FROM moza_benefit_cycles WHERE id = ?').get(result.lastInsertRowid);
  }

  const confirmedCount = db.prepare(`
    SELECT COUNT(*) AS count FROM moza_transactions
    WHERE cycle_id = ? AND status = 'confirmed' AND amount_mzn >= ?
  `).get(cycle.id, config.minimumTransactionMzn).count;

  if (confirmedCount >= config.targetTransactions && cycle.status === 'in_progress') {
    const expiresAt = config.validityDays
      ? new Date(Date.now() + config.validityDays * 86400000).toISOString().replace('T', ' ').slice(0, 19)
      : null;
    db.prepare(`
      UPDATE moza_benefit_cycles
      SET status = 'unlocked', unlocked_at = CURRENT_TIMESTAMP, expires_at = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(expiresAt, cycle.id);
  } else if (confirmedCount < config.targetTransactions && cycle.status === 'unlocked') {
    db.prepare(`
      UPDATE moza_benefit_cycles
      SET status = 'in_progress', unlocked_at = NULL, expires_at = NULL,
          redemption_code = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(cycle.id);
  }

  cycle = db.prepare('SELECT * FROM moza_benefit_cycles WHERE id = ?').get(cycle.id);
  return { cycle, confirmedCount, config };
}

function getMozaBenefits(userId) {
  const { cycle, confirmedCount, config } = db.transaction(() => createActiveCycle(userId))();
  const transactions = db.prepare(`
    SELECT provider_transaction_id, amount_mzn, currency, status, occurred_at, created_at
    FROM moza_transactions
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 20
  `).all(userId).map(transaction => ({
    ...transaction,
    provider_transaction_id: `...${transaction.provider_transaction_id.slice(-4)}`
  }));
  const history = db.prepare(`
    SELECT cycle_number, status, unlocked_at, used_at, expires_at
    FROM moza_benefit_cycles
    WHERE user_id = ? AND id != ?
    ORDER BY cycle_number DESC LIMIT 10
  `).all(userId, cycle.id);

  return {
    campaign: config,
    cycle: {
      id: cycle.id,
      number: cycle.cycle_number,
      status: cycle.status,
      confirmedTransactions: confirmedCount,
      remainingTransactions: Math.max(0, config.targetTransactions - confirmedCount),
      unlockedAt: cycle.unlocked_at,
      expiresAt: cycle.expires_at,
      redemptionCode: cycle.redemption_code
    },
    transactions,
    history
  };
}

function recordTransactionEvent(event, payloadHash) {
  const config = getMozaBenefitsConfig();
  const existingEvent = db.prepare('SELECT id, payload_hash FROM moza_transaction_events WHERE event_id = ?').get(event.event_id);
  if (existingEvent) {
    if (existingEvent.payload_hash !== payloadHash) {
      const error = new Error('O identificador do evento já foi utilizado com dados diferentes.');
      error.statusCode = 409;
      throw error;
    }
    return { duplicate: true };
  }

  const customer = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'customer' AND is_active = 1").get(event.user_id);
  if (!customer) {
    const error = new Error('A conta de cliente associada à transação não existe ou está inativa.');
    error.statusCode = 404;
    throw error;
  }

  const existingTransaction = db.prepare(
    'SELECT * FROM moza_transactions WHERE provider_transaction_id = ?'
  ).get(event.provider_transaction_id);
  if (existingTransaction && (
    existingTransaction.user_id !== event.user_id ||
    existingTransaction.amount_mzn !== event.amount_mzn ||
    existingTransaction.currency !== event.currency
  )) {
    const error = new Error('A referência da transação já foi registada com dados diferentes.');
    error.statusCode = 409;
    throw error;
  }
  if (existingTransaction &&
      existingTransaction.status !== event.status &&
      existingTransaction.status !== 'confirmed') {
    const error = new Error('Uma transação cancelada ou revertida não pode voltar a ser elegível.');
    error.statusCode = 409;
    throw error;
  }

  const { cycle } = createActiveCycle(customer.id);
  const nowStatus = existingTransaction?.status || null;
  const transaction = db.transaction(() => {
    let transactionId = existingTransaction?.id;
    if (existingTransaction) {
      db.prepare(`
        UPDATE moza_transactions
        SET status = ?, occurred_at = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(event.status, event.occurred_at, existingTransaction.id);
    } else {
      const result = db.prepare(`
        INSERT INTO moza_transactions (
          user_id, cycle_id, provider_transaction_id, amount_mzn, currency, status, occurred_at, source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'moza_authorized_adapter')
      `).run(
        customer.id,
        cycle.id,
        event.provider_transaction_id,
        event.amount_mzn,
        event.currency,
        event.status,
        event.occurred_at
      );
      transactionId = result.lastInsertRowid;
    }

    db.prepare(`
      INSERT INTO moza_transaction_events (
        event_id, provider_transaction_id, previous_status, new_status, payload_hash
      ) VALUES (?, ?, ?, ?, ?)
    `).run(event.event_id, event.provider_transaction_id, nowStatus, event.status, payloadHash);

    db.prepare(`
      INSERT INTO audit_logs (action, entity, entity_id, details)
      VALUES ('moza_transaction_event', 'moza_transaction', ?, ?)
    `).run(String(transactionId), JSON.stringify({
      event_id: event.event_id,
      previous_status: nowStatus,
      new_status: event.status,
      source: 'moza_authorized_adapter'
    }));
  });
  transaction();

  const current = createActiveCycle(customer.id);
  return {
    duplicate: false,
    status: current.cycle.status,
    confirmedTransactions: current.confirmedCount,
    remainingTransactions: Math.max(0, config.targetTransactions - current.confirmedCount)
  };
}

function claimMozaBenefit(userId) {
  const { cycle, config } = db.transaction(() => createActiveCycle(userId))();
  if (cycle.status !== 'unlocked') {
    const error = new Error('Complete as transações elegíveis para desbloquear o desconto.');
    error.statusCode = 409;
    throw error;
  }

  if (cycle.redemption_code) {
    return {
      code: cycle.redemption_code,
      expiresAt: cycle.expires_at,
      discountPercentage: config.discountPercentage
    };
  }

  let code = generateBenefitCode();
  while (db.prepare('SELECT id FROM moza_benefit_cycles WHERE redemption_code = ?').get(code)) {
    code = generateBenefitCode();
  }

  db.prepare(`
    UPDATE moza_benefit_cycles
    SET redemption_code = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status = 'unlocked' AND redemption_code IS NULL
  `).run(code, cycle.id);

  return {
    code,
    expiresAt: cycle.expires_at,
    discountPercentage: config.discountPercentage
  };
}

module.exports = {
  getMozaBenefits,
  recordTransactionEvent,
  claimMozaBenefit,
  createActiveCycle
};
