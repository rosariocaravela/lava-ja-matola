const {
  SERVICE_POINTS_BY_CATEGORY,
  WELCOME_BONUS_POINTS
} = require('../config/loyalty');

function normalizeLegacyLoyaltyBonuses(db) {
  const legacyTransactions = db.prepare(`
    SELECT id, user_id, points, description
    FROM loyalty_transactions
    WHERE type = 'earn'
      AND (
        lower(description) LIKE '%boas-vindas%'
        OR lower(description) LIKE '%boas vindas%'
        OR lower(description) LIKE '%quinzenal%'
        OR lower(description) LIKE '%lavagem completa%'
      )
  `).all();

  const pointsToRemoveByUser = new Map();
  for (const transaction of legacyTransactions) {
    const expectedPoints = /lavagem completa/i.test(transaction.description)
      ? SERVICE_POINTS_BY_CATEGORY.COMPLETA
      : WELCOME_BONUS_POINTS;
    const pointsToRemove = Math.max(0, transaction.points - expectedPoints);
    if (pointsToRemove > 0) {
      pointsToRemoveByUser.set(
        transaction.user_id,
        (pointsToRemoveByUser.get(transaction.user_id) || 0) + pointsToRemove
      );
    }
  }

  const migrate = db.transaction(() => {
    const updateAccount = db.prepare(`
      UPDATE loyalty_accounts
      SET balance_points = MAX(0, balance_points - ?),
          lifetime_points = MAX(0, lifetime_points - ?),
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `);
    for (const [userId, pointsToRemove] of pointsToRemoveByUser) {
      updateAccount.run(pointsToRemove, pointsToRemove, userId);
    }

    const updateTransaction = db.prepare(`
      UPDATE loyalty_transactions
      SET points = ?, description = ?
      WHERE id = ?
    `);
    for (const transaction of legacyTransactions) {
      const isQuarterlyBonus = /quinzenal/i.test(transaction.description);
      const expectedPoints = /lavagem completa/i.test(transaction.description)
        ? SERVICE_POINTS_BY_CATEGORY.COMPLETA
        : WELCOME_BONUS_POINTS;
      const description = isQuarterlyBonus
        ? 'Bónus de fidelização do Passaporte Lava Já'
        : transaction.description;
      const points = Math.min(transaction.points, expectedPoints);
      if (points !== transaction.points || description !== transaction.description) {
        updateTransaction.run(points, description, transaction.id);
      }
    }

    const notifyCustomer = db.prepare(`
      INSERT INTO notifications (user_id, target_role, title, message, type)
      VALUES (?, 'customer', 'Atualização do Passaporte VIP', ?, 'info')
    `);
    for (const [userId, pointsToRemove] of pointsToRemoveByUser) {
      const account = db.prepare('SELECT id FROM loyalty_accounts WHERE user_id = ?').get(userId);
      if (account) {
        notifyCustomer.run(
          userId,
          `Os movimentos antigos do Passaporte foram ajustados às regras atuais. Foram retirados ${pointsToRemove} pontos do saldo.`
        );
      }
    }
  });

  migrate();
  return {
    updatedTransactions: legacyTransactions.filter(transaction => {
      const expectedPoints = /lavagem completa/i.test(transaction.description)
        ? SERVICE_POINTS_BY_CATEGORY.COMPLETA
        : WELCOME_BONUS_POINTS;
      return transaction.points > expectedPoints || /quinzenal/i.test(transaction.description);
    }).length,
    pointsRemoved: [...pointsToRemoveByUser.values()].reduce((sum, points) => sum + points, 0)
  };
}

module.exports = { normalizeLegacyLoyaltyBonuses };
