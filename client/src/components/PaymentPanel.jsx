import React, { useEffect, useState } from 'react';
import { AlertCircle, Building2, CheckCircle2, Download, LoaderCircle, Smartphone, X } from 'lucide-react';
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

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
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

  function handleDownloadReceipt() {
    const receiptDate = payment.paid_at
      ? new Date(payment.paid_at).toLocaleString('pt-MZ')
      : '';
    const amountRows = [
      `<div class="row"><span>Preço original</span><strong>${escapeHtml(formatMoney(payment.original_amount_mzn))}</strong></div>`,
      payment.promotion_discount_mzn > 0
        ? `<div class="row discount"><span>Promoção ${escapeHtml(payment.promotion_code ? `(${payment.promotion_code})` : '')}</span><strong>−${escapeHtml(formatMoney(payment.promotion_discount_mzn))}</strong></div>`
        : '',
      payment.reward_discount_mzn > 0
        ? `<div class="row discount"><span>Desconto do Passaporte${payment.reward_title ? ` (${escapeHtml(payment.reward_title)})` : ''}</span><strong>−${escapeHtml(formatMoney(payment.reward_discount_mzn))}</strong></div>`
        : '',
      `<div class="row total"><span>Total pago</span><strong>${escapeHtml(formatMoney(payment.amount_paid_mzn))}</strong></div>`
    ].join('');
    const simulationNotice = payment.simulated
      ? '<p class="notice">Comprovativo demonstrativo — nenhum dinheiro foi movimentado.</p>'
      : '<p class="notice">Pagamento recebido.</p>';
    const html = `<!doctype html>
<html lang="pt">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Comprovativo ${escapeHtml(reservation.reference_code)} — Lava Já Matola</title>
    <style>
      body { margin: 0; padding: 32px 16px; background: #f1f5f9; color: #0f172a; font: 15px/1.5 Arial, sans-serif; }
      main { box-sizing: border-box; max-width: 680px; margin: 0 auto; padding: 32px; border: 1px solid #e2e8f0; border-radius: 18px; background: white; }
      h1 { margin: 4px 0 24px; font-size: 25px; }
      .brand { color: #2563eb; font-size: 12px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; }
      .details { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 18px; border-radius: 14px; background: #f8fafc; }
      .field span, .label { display: block; color: #64748b; font-size: 13px; }
      .field strong { display: block; overflow-wrap: anywhere; }
      .amounts { margin-top: 20px; padding: 18px; border: 1px solid #e2e8f0; border-radius: 14px; }
      .row { display: flex; justify-content: space-between; gap: 16px; margin: 8px 0; }
      .discount { color: #047857; }
      .total { margin-top: 16px; padding-top: 14px; border-top: 1px solid #e2e8f0; font-size: 19px; font-weight: 700; }
      .notice { margin: 18px 0 0; padding: 16px; border: 1px solid #a7f3d0; border-radius: 14px; background: #ecfdf5; color: #064e3b; font-weight: 700; }
      .meta { margin-top: 10px; color: #334155; font-size: 13px; }
      .print { display: block; margin: 22px auto 0; padding: 12px 20px; border: 0; border-radius: 10px; background: #2563eb; color: white; font-size: 15px; font-weight: 700; cursor: pointer; }
      @media (max-width: 480px) { .details { grid-template-columns: 1fr; } main { padding: 22px; } }
      @media print { body { padding: 0; background: white; } main { max-width: none; border: 0; } .print { display: none; } }
    </style>
  </head>
  <body>
    <main>
      <div class="brand">Lava Já Matola</div>
      <h1>Comprovativo de pagamento</h1>
      <section class="details">
        <div class="field"><span>Referência</span><strong>${escapeHtml(reservation.reference_code)}</strong></div>
        <div class="field"><span>Estado do serviço</span><strong>${escapeHtml(reservation.service_status.replace('_', ' '))}</strong></div>
        <div class="field"><span>Cliente</span><strong>${escapeHtml(reservation.customer_name)}</strong></div>
        <div class="field"><span>Matrícula</span><strong>${escapeHtml(reservation.vehicle_plate)}</strong></div>
        <div class="field"><span>Serviço</span><strong>${escapeHtml(reservation.service_name)}</strong></div>
      </section>
      <section class="amounts">${amountRows}</section>
      ${simulationNotice}
      <div class="meta">Método: <strong>${escapeHtml(METHOD_LABELS[payment.method] || payment.method)}</strong></div>
      <div class="meta">Referência da transação: <strong>${escapeHtml(payment.transaction_reference)}</strong></div>
      ${receiptDate ? `<div class="meta">Data: <strong>${escapeHtml(receiptDate)}</strong></div>` : ''}
      <button class="print" onclick="window.print()">Imprimir / Guardar como PDF</button>
    </main>
  </body>
</html>`;
    const file = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    const safeReference = String(reservation.reference_code).replace(/[^a-z0-9-]/gi, '-');
    link.href = url;
    link.download = `comprovativo-${safeReference}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

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
                <button
                  type="button"
                  onClick={handleDownloadReceipt}
                  className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                >
                  <Download className="h-4 w-4" />
                  Baixar comprovativo
                </button>
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
