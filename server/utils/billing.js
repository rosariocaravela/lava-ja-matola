const { getMozaBenefitsConfig } = require('../config/moza-benefits');

class BillingError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'BillingError';
    this.statusCode = statusCode;
  }
}

function roundMzn(amount) {
  return Math.round((Number(amount) + Number.EPSILON) * 100) / 100;
}

function getPromotion(db, code, serviceId, applicableDate) {
  if (!code) {
    return { promotion: null, error: null };
  }

  const normalizedCode = String(code).trim().toUpperCase();
  if (!normalizedCode) {
    return { promotion: null, error: null };
  }

  const promotion = db.prepare(`
    SELECT id, code, title, discount_percentage, service_id, start_date, end_date, is_active
    FROM promotions
    WHERE UPPER(code) = ?
  `).get(normalizedCode);

  if (!promotion) {
    return { promotion: null, error: 'Código promocional não encontrado.' };
  }
  if (!promotion.is_active) {
    return { promotion: null, error: 'Este código promocional está inativo.' };
  }
  if (!Number.isInteger(promotion.discount_percentage) ||
      promotion.discount_percentage < 1 ||
      promotion.discount_percentage > 100) {
    return { promotion: null, error: 'A percentagem deste código promocional é inválida.' };
  }
  if (promotion.start_date > applicableDate || promotion.end_date < applicableDate) {
    return { promotion: null, error: 'Este código promocional não é válido na data do serviço.' };
  }
  if (promotion.service_id && promotion.service_id !== Number(serviceId)) {
    const service = db.prepare('SELECT name FROM services WHERE id = ?').get(promotion.service_id);
    return {
      promotion: null,
      error: `Esta promoção é válida apenas para o serviço: ${service ? service.name : 'específico'}.`
    };
  }

  return { promotion, error: null };
}

function getRewardVoucher(db, reservation, code) {
  const voucher = db.prepare(`
    SELECT rr.id, rr.user_id, rr.status, rr.expires_at, rr.redemption_code,
           reward.id as reward_id, reward.title, reward.description,
           reward.discount_mzn, reward.benefit_type, reward.service_id as reward_service_id,
           reward.is_active,
           service.name as reward_service_name
    FROM reward_redemptions rr
    JOIN rewards reward ON reward.id = rr.reward_id
    LEFT JOIN services service ON service.id = reward.service_id
    WHERE UPPER(rr.redemption_code) = ?
  `).get(String(code).trim().toUpperCase());

  const mozaBenefit = voucher ? null : db.prepare(`
    SELECT id, user_id, status, expires_at, redemption_code
    FROM moza_benefit_cycles
    WHERE UPPER(redemption_code) = ?
  `).get(String(code).trim().toUpperCase());
  const selectedVoucher = voucher || (mozaBenefit ? {
    ...mozaBenefit,
    reward_id: null,
    title: 'Benefício Moza Banco',
    description: 'Desconto do programa Lava Já Matola × Moza Banco',
    discount_mzn: 0,
    benefit_type: 'percentage',
    benefit_percentage: getMozaBenefitsConfig().discountPercentage,
    benefit_source: 'moza',
    reward_service_id: null,
    is_active: 1,
    reward_service_name: null
  } : null);

  if (!selectedVoucher) throw new BillingError('Código de voucher ou recompensa não encontrado.');
  if (!selectedVoucher.user_id || selectedVoucher.user_id !== reservation.user_id) {
    throw new BillingError('Este voucher não pertence ao cliente desta marcação.');
  }
  if (selectedVoucher.status !== 'disponivel' && selectedVoucher.status !== 'unlocked') {
    if (selectedVoucher.status === 'expirado' || selectedVoucher.status === 'expired') {
      throw new BillingError('Este benefício expirou.', 409);
    }
    throw new BillingError('Este benefício já foi utilizado.', 409);
  }
  if (selectedVoucher.expires_at && new Date(selectedVoucher.expires_at) < new Date()) {
    throw new BillingError('Este benefício expirou.');
  }
  if (!selectedVoucher.is_active) {
    throw new BillingError('A recompensa associada a este voucher está inativa.');
  }
  if (selectedVoucher.reward_service_id && selectedVoucher.reward_service_id !== reservation.service_id) {
    throw new BillingError(`Este benefício só pode ser utilizado no serviço ${selectedVoucher.reward_service_name}.`);
  }

  return {
    ...selectedVoucher,
    benefit_source: selectedVoucher.benefit_source || 'passaporte'
  };
}

function calculatePayment(originalAmount, promotionDiscount, voucher, options = {}) {
  const original = Math.max(0, roundMzn(originalAmount));
  const promo = Math.max(0, Math.min(original, roundMzn(promotionDiscount || 0)));
  let rewardDiscount = 0;

  if (voucher?.benefit_type === 'discount') {
    rewardDiscount = Math.min(
      Math.max(0, roundMzn(voucher.discount_mzn || 0)),
      roundMzn(original - promo)
    );
  } else if (voucher?.benefit_type === 'service' && voucher.reward_service_id) {
    rewardDiscount = roundMzn(original - promo);
  } else if (voucher?.benefit_type === 'percentage') {
    rewardDiscount = Math.min(
      roundMzn(original - promo),
      roundMzn((original - promo) * Number(voucher.benefit_percentage) / 100)
    );
  }

  const mozabancoDiscountEnabled = Boolean(options.mozabancoDiscountEnabled);
  const mozabancoDiscountPercentage = Number(options.mozabancoDiscountPercentage || 10);
  const eligibleAmount = Math.max(0, roundMzn(original - promo - rewardDiscount));
  const mozabancoDiscount = options.method === 'mozabanco' && mozabancoDiscountEnabled
    ? Math.min(eligibleAmount, roundMzn(eligibleAmount * mozabancoDiscountPercentage / 100))
    : 0;
  const totalDiscount = Math.min(original, roundMzn(promo + rewardDiscount + mozabancoDiscount));
  return {
    original_amount_mzn: original,
    promotion_discount_mzn: promo,
    reward_discount_mzn: rewardDiscount,
    mozabanco_discount_mzn: mozabancoDiscount,
    mozabanco_discount_percentage: options.method === 'mozabanco' && mozabancoDiscountEnabled
      ? mozabancoDiscountPercentage
      : 0,
    total_discount_mzn: totalDiscount,
    amount_due_mzn: Math.max(0, roundMzn(original - totalDiscount)),
    reward_code: voucher?.redemption_code || null,
    reward_title: voucher?.title || null,
    reward_description: voucher?.description || null,
    reward_service_name: voucher?.reward_service_name || null,
    voucher_redemption_id: voucher?.benefit_source === 'moza' ? null : voucher?.id || null,
    voucher_source: voucher?.benefit_source || null,
    moza_benefit_cycle_id: voucher?.benefit_source === 'moza' ? voucher.id : null
  };
}

module.exports = {
  calculatePayment,
  getPromotion,
  getRewardVoucher,
  roundMzn,
  BillingError
};
