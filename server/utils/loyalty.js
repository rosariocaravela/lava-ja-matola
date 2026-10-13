const db = require('../db');
const { RECURRING_BONUS_POINTS, RECURRING_BONUS_DAYS } = require('../config/loyalty');

const RECURRING_BONUS_DESCRIPTION = 'Bónus de fidelização do Passaporte Lava Já';

function awardRecurringBonusIfDue(userId, now = new Date()) {
  const nowValue = now.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');

  const awardBonus = db.transaction(() => {
    const account = db.prepare('SELECT id FROM loyalty_accounts WHERE user_id = ?').get(userId);
    if (!account) return false;

    const lastBonus = db.prepare(`
      SELECT created_at
      FROM loyalty_transactions
      WHERE user_id = ?
        AND type = 'earn'
        AND description IN (?, ?, ?)
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `).get(
      userId,
      RECURRING_BONUS_DESCRIPTION,
      'Bónus trimestral do Passaporte Lava Já',
      'Bónus de fidelização quinzenal'
    );

    const firstCompletedWash = db.prepare(`
      SELECT MIN(COALESCE(
        (
          SELECT MIN(loyalty_tx.created_at)
          FROM loyalty_transactions loyalty_tx
          WHERE loyalty_tx.reservation_id = reservation.id AND loyalty_tx.type = 'earn'
        ),
        reservation.updated_at
      )) AS completed_at
      FROM reservations reservation
      WHERE reservation.user_id = ?
        AND reservation.status = 'concluido'
        AND reservation.points_awarded = 1
    `).get(userId);

    const intervalStart = lastBonus?.created_at || firstCompletedWash.completed_at;
    if (!intervalStart) return false;

    const isDue = db.prepare(`
      SELECT datetime(?, ?) <= datetime(?) AS due
    `).get(intervalStart, `+${RECURRING_BONUS_DAYS} days`, nowValue).due;

    if (!isDue) return false;

    db.prepare(`
      UPDATE loyalty_accounts
      SET balance_points = balance_points + ?,
          lifetime_points = lifetime_points + ?,
      updated_at = ?
      WHERE id = ?
    `).run(RECURRING_BONUS_POINTS, RECURRING_BONUS_POINTS, nowValue, account.id);

    db.prepare(`
      INSERT INTO loyalty_transactions (account_id, user_id, type, points, description, created_at)
      VALUES (?, ?, 'earn', ?, ?, ?)
    `).run(account.id, userId, RECURRING_BONUS_POINTS, RECURRING_BONUS_DESCRIPTION, nowValue);

    db.prepare(`
      INSERT INTO notifications (user_id, target_role, title, message, type)
      VALUES (?, 'customer', 'Bónus de Fidelidade do Passaporte!', ?, 'success')
    `).run(userId, `Recebeu ${RECURRING_BONUS_POINTS} pontos por fidelidade. Continue a lavar connosco!`);

    return true;
  });

  return awardBonus();
}

module.exports = { awardRecurringBonusIfDue, RECURRING_BONUS_DESCRIPTION };
