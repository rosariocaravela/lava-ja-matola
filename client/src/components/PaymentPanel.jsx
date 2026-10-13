import React, { useEffect, useState } from 'react';
import { AlertCircle, Building2, CheckCircle2, LoaderCircle, Smartphone, X } from 'lucide-react';
import { apiRequest } from '../api';

const PAYMENT_METHODS = [
  { id: 'mpesa', label: 'M-Pesa', simulated: true, icon: Smartphone },
  { id: 'emola', label: 'e-Mola', simulated: true, icon: Smartphone },
  { id: 'mkesh', label: 'mKesh', simulated: true, icon: Smartphone },
  { id: 'mozabanco', label: 'Moza Banco', simulated: true, icon: Building2 },
  { id: 'balcao', label: 'Pagamento no balcão', simulated: false, icon: CheckCircle2 }
];

const METHOD_LABELS = Object.fromEntries(PAYMENT_METHODS.map(method => [method.id, method.label]));

function formatMoney(amount) {
  return `${Number(amount || 0).toLocaleString('pt-MZ')} MT`;
}

export default function PaymentPanel({ reservationId, userRole, onClose, onPaid }) {
  const [summary, setSummary] = useState(null);
  const [voucherCode, setVoucherCode] = useState('');
  const [appliedCode, setAppliedCode] = useState('');
  const [method, setMethod] = useState('mpesa');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const isStaff = ['employee', 'admin'].includes(userRole);

  useEffect(() => {
    let active = true;
    apiRequest(`/payments/${reservationId}`)
      .then(data => {
        if (active) setSummary(data);
      })
      .catch(err => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reservationId]);

  async function previewVoucher(code) {
    setError('');
    setMessage('');
    try {
      const data = await apiRequest(`/payments/${reservationId}/preview-voucher`, {
        method: 'POST',
        body: JSON.stringify({ code })
      });
      setSummary(data);
      setAppliedCode(code);
      setMessage(code
        ? 'Voucher validado. O desconto será aplicado ao confirmar o pagamento.'
        : 'Voucher removido. A promoção da marcação continua aplicada, se existir.');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleConfirm() {
    setProcessing(true);
    setError('');
    setMessage('');
    try {
      const data = await apiRequest(`/payments/${reservationId}/confirm`, {
        method: 'POST',
        body: JSON.stringify({ method, code: appliedCode })
      });
      setSummary(data);
      setVoucherCode('');
      setAppliedCode('');
      setMessage(data.message);
      onPaid?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  }

  const payment = summary?.payment;
  const reservation = summary?.reservation;
  const isPaid = payment?.status === 'pago';
  const selectedMethod = PAYMENT_METHODS.find(option => option.id === method);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-dialog-title"
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600">Lava Já Matola</span>
            <h2 id="payment-dialog-title" className="mt-1 text-xl font-black text-slate-900">
              {isPaid ? 'Comprovativo de pagamento' : 'Resumo do pagamento'}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
            <LoaderCircle className="h-4 w-4 animate-spin" /> A carregar cobrança...
          </div>
        ) : error && !summary ? (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        ) : (
          <>
            <div className="mt-5 grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-4 text-xs">
              <div><span className="block text-slate-500">Referência</span><strong className="font-mono text-slate-900">{reservation.reference_code}</strong></div>
              <div><span className="block text-slate-500">Estado do serviço</span><strong className="text-slate-900">{reservation.service_status.replace('_', ' ')}</strong></div>
              <div><span className="block text-slate-500">Cliente</span><strong className="text-slate-900">{reservation.customer_name}</strong></div>
              <div><span className="block text-slate-500">Matrícula</span><strong className="font-mono text-slate-900">{reservation.vehicle_plate}</strong></div>
              <div className="col-span-2"><span className="block text-slate-500">Serviço</span><strong className="text-slate-900">{reservation.service_name}</strong></div>
            </div>

            <div className="mt-5 space-y-3 rounded-2xl border border-slate-200 p-4 text-sm">
              <div className="flex justify-between gap-4 text-slate-600">
                <span>Preço original</span><span>{formatMoney(payment.original_amount_mzn)}</span>
              </div>
              {payment.promotion_discount_mzn > 0 && (
                <div className="flex justify-between gap-4 text-emerald-700">
                  <span>Promoção {payment.promotion_code && `(${payment.promotion_code})`}</span>
                  <span>−{formatMoney(payment.promotion_discount_mzn)}</span>
                </div>
              )}
              {payment.reward_discount_mzn > 0 && (
                <div className="flex justify-between gap-4 text-emerald-700">
                  <span>Desconto do Passaporte ({payment.reward_title})</span>
                  <span>−{formatMoney(payment.reward_discount_mzn)}</span>
                </div>
              )}
              {payment.reward_title && payment.reward_service_name && (
                <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
                  Benefício incluído: <strong>{payment.reward_title}</strong>
                  <span className="block mt-1">Serviço associado: {payment.reward_service_name}</span>
                </div>
              )}
              {payment.reward_title && !payment.reward_service_name && payment.reward_discount_mzn === 0 && (
                <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
                  Benefício incluído: <strong>{payment.reward_title}</strong>
                  {payment.reward_description && <span className="block mt-1">{payment.reward_description}</span>}
                </div>
              )}
              <div className="flex justify-between gap-4 border-t border-slate-200 pt-3 text-base font-black text-slate-950">
                <span>{isPaid ? 'Total pago' : 'Total a pagar'}</span>
                <span>{formatMoney(isPaid ? payment.amount_paid_mzn : payment.amount_due_mzn)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>Estado do pagamento</span>
                <strong className={isPaid ? 'text-emerald-700' : 'text-amber-700'}>
                  {isPaid ? payment.simulated ? 'Pago (simulação)' : 'Pago' : 'Pendente'}
                </strong>
              </div>
            </div>

            {isPaid ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-950">
                <div className="flex items-center gap-2 font-bold">
                  <CheckCircle2 className="h-4 w-4" />
                  {payment.simulated
                    ? 'Comprovativo demonstrativo — nenhum dinheiro foi movimentado.'
                    : 'Pagamento recebido.'}
                </div>
                <div className="mt-2">Método: <strong>{METHOD_LABELS[payment.method] || payment.method}</strong></div>
                <div className="mt-1">Referência da transação: <strong className="font-mono">{payment.transaction_reference}</strong></div>
                {payment.paid_at && <div className="mt-1">Data: {new Date(payment.paid_at).toLocaleString('pt-MZ')}</div>}
              </div>
            ) : (
              <>
                {reservation.service_status !== 'concluido' ? (
                  <div className="mt-4 rounded-xl bg-amber-50 p-4 text-xs text-amber-900">
                    O pagamento só fica disponível depois de a lavagem ser marcada como concluída.
                  </div>
                ) : (
                  <>
                    <div className="mt-5 space-y-2">
                      <label htmlFor="payment-voucher" className="text-xs font-bold text-slate-800">
                        Tens um voucher ou recompensa? Introduz o teu código.
                      </label>
                      <div className="flex gap-2">
                        <input
                          id="payment-voucher"
                          value={voucherCode}
                          onChange={event => setVoucherCode(event.target.value.toUpperCase())}
                          placeholder="RESG-XXXXXX"
                          className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 font-mono text-xs uppercase focus:border-blue-500 focus:outline-none"
                        />
                        {appliedCode ? (
                          <button type="button" onClick={() => {
                            setVoucherCode('');
                            previewVoucher('');
                          }} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700">
                            Remover
                          </button>
                        ) : (
                          <button type="button" disabled={!voucherCode.trim()} onClick={() => previewVoucher(voucherCode.trim())} className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
                            Aplicar
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mt-5">
                      <h3 className="text-xs font-bold text-slate-800">Método de pagamento</h3>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {PAYMENT_METHODS.filter(option => option.id !== 'balcao' || isStaff).map(option => {
                          const Icon = option.icon;
                          const selected = method === option.id;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              aria-pressed={selected}
                              onClick={() => setMethod(option.id)}
                              className={`flex items-center gap-2 rounded-xl border p-3 text-left text-xs ${
                                selected ? 'border-blue-600 bg-blue-50 text-blue-950' : 'border-slate-200 text-slate-700'
                              }`}
                            >
                              <Icon className="h-4 w-4 shrink-0" />
                              <span className="font-bold">{option.label}</span>
                            </button>
                          );
                        })}
                      </div>
                      {selectedMethod.simulated ? (
                        <p className="mt-2 text-[11px] leading-relaxed text-amber-800">
                          Simulação demonstrativa: não contacta o fornecedor nem movimenta dinheiro. Não introduza PIN ou palavra-passe.
                        </p>
                      ) : (
                        <p className="mt-2 text-[11px] text-slate-500">
                          Ao confirmar, declara que recebeu o valor no balcão.
                        </p>
                      )}
                    </div>

                    {isStaff && payment.amount_due_mzn === 0 && (
                      <p className="mt-3 text-[11px] text-emerald-800">O benefício cobre o valor integral do serviço. Confirme para emitir o comprovativo.</p>
                    )}
                    <button
                      type="button"
                      disabled={processing}
                      onClick={handleConfirm}
                      className="mt-5 w-full rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-50"
                    >
                      {processing ? 'A registar...' : method === 'balcao' ? 'Confirmar valor recebido no balcão' : 'Confirmar pagamento demonstrativo'}
                    </button>
                  </>
                )}
              </>
            )}
          </>
        )}

        {(error || message) && (
          <div className={`mt-4 flex items-start gap-2 rounded-xl p-3 text-xs ${
            error ? 'border border-red-200 bg-red-50 text-red-700' : 'border border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}>
            {error && <AlertCircle className="h-4 w-4 shrink-0" />}
            <span>{error || message}</span>
          </div>
        )}
      </section>
    </div>
  );
}
