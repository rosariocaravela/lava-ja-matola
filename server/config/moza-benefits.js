function positiveInteger(value, fallback, maximum) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= maximum ? parsed : fallback;
}

function nonNegativeInteger(value, fallback, maximum) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= maximum ? parsed : fallback;
}

function getMozaBenefitsConfig() {
  const minimumAmount = Number(process.env.MOZA_BENEFIT_MIN_TRANSACTION_MZN);
  return {
    targetTransactions: positiveInteger(process.env.MOZA_BENEFIT_TRANSACTION_TARGET, 5, 100),
    discountPercentage: positiveInteger(process.env.MOZA_BENEFIT_DISCOUNT_PERCENTAGE, 10, 100),
    minimumTransactionMzn: Number.isFinite(minimumAmount) && minimumAmount > 0 && minimumAmount <= 10000000
      ? minimumAmount
      : 1,
    validityDays: nonNegativeInteger(process.env.MOZA_BENEFIT_VALIDITY_DAYS, 0, 3650),
    currency: 'MZN',
    terms: 'Contam apenas transações Moza confirmadas por uma integração autorizada. Transações canceladas ou revertidas não contam. O desconto é válido numa lavagem e só é consumido após confirmação do pagamento no balcão.',
    webhookConfigured: Boolean(process.env.MOZA_TRANSACTION_WEBHOOK_SECRET)
  };
}

module.exports = { getMozaBenefitsConfig };
