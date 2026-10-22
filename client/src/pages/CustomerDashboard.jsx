import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Car, Calendar, Award, ArrowRight, CheckCircle2, ReceiptText, Download, Star
} from 'lucide-react';
import { apiRequest } from '../api';
import { useAuth } from '../context/AuthContext';
import PaymentPanel from '../components/PaymentPanel';
import { downloadVehicleReceipt } from '../utils/vehicleReceipt';

export default function CustomerDashboard() {
  const { user, loyalty, refreshProfile } = useAuth();

  const [reservations, setReservations] = useState([]);
  const [reservationFilter, setReservationFilter] = useState('all');
  const [expandedReservationId, setExpandedReservationId] = useState(null);
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paymentReservationId, setPaymentReservationId] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [reviewingReservationId, setReviewingReservationId] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [reviewMessage, setReviewMessage] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [mozaBenefits, setMozaBenefits] = useState(null);
  const [mozaError, setMozaError] = useState('');
  const [mozaMessage, setMozaMessage] = useState('');
  const [claimingMozaBenefit, setClaimingMozaBenefit] = useState(false);

  useEffect(() => {
    if (!user) return undefined;
    loadReservations();
    loadMozaBenefits();
    const interval = window.setInterval(() => {
      refreshReservations();
      loadMozaBenefits();
    }, 15000);
    return () => window.clearInterval(interval);
  }, [user]);

  async function loadMozaBenefits() {
    try {
      const data = await apiRequest('/loyalty/moza-benefits');
      setMozaBenefits(data);
      setMozaError('');
    } catch (err) {
      setMozaError(err.message);
    }
  }

  async function claimMozaBenefit() {
    setClaimingMozaBenefit(true);
    setMozaError('');
    setMozaMessage('');
    try {
      const result = await apiRequest('/loyalty/moza-benefits/claim', { method: 'POST' });
      setMozaBenefits(current => current ? {
        ...current,
        cycle: { ...current.cycle, redemptionCode: result.benefit.code }
      } : current);
      setMozaMessage(result.message);
    } catch (err) {
      setMozaError(err.message);
    } finally {
      setClaimingMozaBenefit(false);
    }
  }

  async function loadReservations() {
    try {
      setLoading(true);
      const [data, loyaltyData, myReviews] = await Promise.all([
        apiRequest('/reservations'),
        apiRequest('/loyalty/me'),
        apiRequest('/reviews/mine')
      ]);
      setReservations(data);
      setVouchers(loyaltyData.redemptions || []);
      setReviews(myReviews);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function refreshReservations() {
    try {
      const data = await apiRequest('/reservations');
      setReservations(data);
    } catch (err) {
      console.error('Erro ao atualizar as reservas do cliente:', err);
    }
  }

  async function handleCancel(reservationId) {
    if (!window.confirm('Tem a certeza que deseja cancelar este agendamento?')) return;

    try {
      await apiRequest(`/reservations/${reservationId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          new_status: 'cancelado',
          notes: 'Cancelamento solicitado pelo cliente via painel'
        })
      });
      alert('Reserva cancelada com sucesso.');
      loadReservations();
      refreshProfile();
    } catch (err) {
      alert('Erro ao cancelar: ' + err.message);
    }
  }

  async function submitReview(event) {
    event.preventDefault();
    if (!reviewingReservationId) return;
    setReviewSubmitting(true);
    setReviewError('');
    setReviewMessage('');
    try {
      const result = await apiRequest('/reviews', {
        method: 'POST',
        body: JSON.stringify({
          reservation_id: reviewingReservationId,
          rating: reviewRating,
          comment: reviewComment
        })
      });
      setReviews(current => [result.review, ...current]);
      setReviewingReservationId(null);
      setReviewComment('');
      setReviewRating(5);
      setReviewMessage('Obrigado. A sua avaliação foi registada.');
    } catch (err) {
      setReviewError(err.message);
    } finally {
      setReviewSubmitting(false);
    }
  }

  const activeWash = reservations.find(r => r.status === 'em_atendimento');
  const nextReservation = reservations.find(r => r.status === 'reservado');
  const visibleReservations = reservations.filter(reservation => {
    if (reservationFilter === 'scheduled') {
      return ['reservado', 'aguardando', 'em_atendimento'].includes(reservation.status);
    }
    if (reservationFilter === 'completed') return reservation.status === 'concluido';
    if (reservationFilter === 'cancelled') return reservation.status === 'cancelado';
    return true;
  });
  const justUsedMozaBenefit = mozaBenefits?.history?.[0]?.status === 'used' &&
    mozaBenefits.cycle.confirmedTransactions === 0;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header Greeting */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-blue-900 to-slate-900 p-6 sm:p-8 rounded-3xl text-white shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-blue-500/30 text-blue-300 font-bold px-2.5 py-0.5 rounded-full border border-blue-400/20">
              Painel do Cliente
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-2">
            Olá, {user?.name || 'Cliente'}!
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Acompanhe as suas viaturas, histórico de agendamentos e pontos do Passaporte Lava Já.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/reservar"
            className="px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-2"
          >
            <Calendar className="w-4 h-4" />
            <span>Nova Marcação</span>
          </Link>
        </div>
      </div>

      {vouchers.some(voucher => voucher.status === 'disponivel') && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-black text-amber-950">Vouchers disponíveis do Passaporte</h2>
              <p className="mt-1 text-xs text-amber-900">Apresente o código no pagamento depois de a lavagem ser concluída.</p>
            </div>
            <Link to="/fidelizacao" className="text-xs font-bold text-blue-700 hover:underline">Ver Passaporte VIP</Link>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {vouchers.filter(voucher => voucher.status === 'disponivel').map(voucher => (
              <div key={voucher.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-white p-3 text-xs">
                <div>
                  <div className="font-bold text-slate-900">{voucher.reward_title}</div>
                  <div className="mt-1 font-mono font-black tracking-wider text-emerald-800">{voucher.redemption_code}</div>
                </div>
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-800">Disponível</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="w-full">
        <div className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-5 text-white shadow-xl shadow-slate-900/15 sm:p-7 lg:p-8">
          <div className="pointer-events-none absolute -left-24 -top-32 -z-10 h-80 w-80 rounded-full bg-fuchsia-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-40 right-1/4 -z-10 h-80 w-80 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -right-16 -top-20 -z-10 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl" />

          <div className="relative grid gap-7 lg:grid-cols-[minmax(0,1fr)_230px] lg:items-center lg:gap-10">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xl font-black tracking-tight sm:text-2xl">
                    Lava Já <span className="text-emerald-300">×</span> Moza Banco
                  </div>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">
                    Programa de benefícios
                  </p>
                </div>
                {mozaBenefits && (
                  <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${
                    mozaBenefits.cycle.status === 'unlocked'
                      ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-200'
                      : justUsedMozaBenefit
                        ? 'border-white/15 bg-white/5 text-white/70'
                        : 'border-blue-300/25 bg-blue-300/10 text-blue-100'
                  }`}>
                    {mozaBenefits.cycle.status === 'unlocked'
                      ? 'Desconto disponível'
                      : justUsedMozaBenefit ? 'Desconto utilizado' : 'Em progresso'}
                  </span>
                )}
              </div>

              {mozaBenefits ? (
                <div className="mt-8">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-white/60">Transações confirmadas</p>
                      <p className="mt-1 text-4xl font-black tracking-tight sm:text-5xl">
                        {mozaBenefits.cycle.confirmedTransactions}
                        <span className="px-2 text-2xl text-white/35 sm:text-3xl">/</span>
                        <span className="text-white/75">{mozaBenefits.campaign.targetTransactions}</span>
                      </p>
                    </div>
                    <p className="text-xs font-medium text-white/60">
                      {mozaBenefits.cycle.remainingTransactions > 0
                        ? `Faltam ${mozaBenefits.cycle.remainingTransactions} para desbloquear`
                        : 'Objetivo concluído'}
                    </p>
                  </div>
                  <div
                    className="mt-4 flex gap-2"
                    role="progressbar"
                    aria-label="Progresso das transações Moza"
                    aria-valuemin={0}
                    aria-valuemax={mozaBenefits.campaign.targetTransactions}
                    aria-valuenow={mozaBenefits.cycle.confirmedTransactions}
                  >
                    {Array.from({ length: mozaBenefits.campaign.targetTransactions }, (_, index) => (
                      <span
                        key={index}
                        className={`h-2 flex-1 rounded-full transition-colors ${
                          index < mozaBenefits.cycle.confirmedTransactions
                            ? 'bg-emerald-300 shadow-sm shadow-emerald-300/40'
                            : 'bg-white/15'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-4">
                    <p className="max-w-full truncate text-xs font-semibold uppercase tracking-wide text-white/75">
                      {user?.name || 'Titular'}
                    </p>
                    {mozaBenefits.cycle.redemptionCode ? (
                      <span className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 font-mono text-xs font-black tracking-widest text-emerald-200">
                        {mozaBenefits.cycle.redemptionCode}
                      </span>
                    ) : mozaBenefits.cycle.expiresAt ? (
                      <span className="text-[11px] text-white/55">
                        Válido até {new Date(`${mozaBenefits.cycle.expiresAt}Z`).toLocaleDateString('pt-MZ')}
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="py-10 text-sm font-semibold text-white/75">A carregar benefícios...</div>
              )}
            </div>

            {mozaBenefits && (
              <div className="flex flex-row items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.06] p-4 sm:p-5 lg:min-h-48 lg:flex-col lg:items-start lg:justify-center">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">Desconto na lavagem</p>
                  <p className="mt-1 text-5xl font-black tracking-tight text-emerald-300 sm:text-6xl">
                    {mozaBenefits.campaign.discountPercentage}<span className="text-3xl">%</span>
                  </p>
                </div>
                {mozaBenefits.cycle.status === 'unlocked' && !mozaBenefits.cycle.redemptionCode && (
                  <button
                    type="button"
                    onClick={claimMozaBenefit}
                    disabled={claimingMozaBenefit}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-950/30 transition hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {claimingMozaBenefit ? 'A preparar...' : 'Obter código'}
                  </button>
                )}
                {mozaBenefits.cycle.status === 'unlocked' && mozaBenefits.cycle.redemptionCode && (
                  <p className="text-[11px] font-medium text-emerald-100/80">
                    Apresente o código ao pagar no balcão.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {mozaError && <p role="alert" className="mt-2 text-xs font-semibold text-red-700">{mozaError}</p>}
        {mozaMessage && <p className="mt-2 text-xs font-semibold text-emerald-700">{mozaMessage}</p>}
        {mozaBenefits && !mozaBenefits.campaign.webhookConfigured && (
          <p className="mt-2 text-xs text-slate-500">
            Campanha pendente de integração oficial. Pagamentos de teste não contam.
          </p>
        )}
      </section>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Points Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 uppercase font-bold">Saldo do Passaporte</div>
            <div className="text-2xl font-black text-amber-500 mt-1">
              {loyalty?.balance_points || 0} <span className="text-xs font-semibold text-slate-400">pts</span>
            </div>
            <Link to="/fidelizacao" className="text-[11px] text-blue-600 font-semibold hover:underline mt-1 block">
              Ver recompensas para resgate →
            </Link>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center font-bold">
            <Award className="w-6 h-6" />
          </div>
        </div>

        {/* Current Active Service */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 uppercase font-bold">Lavagem Ativa Hoje</div>
            <div className="text-sm font-bold text-slate-900 mt-1">
              {activeWash ? (
                <span className="text-blue-600 font-mono">{activeWash.vehicle_plate} ({activeWash.status.replace('_', ' ')})</span>
              ) : (
                <span className="text-slate-400">Nenhuma em atendimento</span>
              )}
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Car className="w-6 h-6" />
          </div>
        </div>

        {/* Total services completed */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 uppercase font-bold">Serviços Concluídos</div>
            <div className="text-2xl font-black text-emerald-600 mt-1">
              {reservations.filter(r => r.status === 'concluido').length}
            </div>
            <span className="text-[11px] text-slate-400 block mt-1">
              {loyalty?.lifetime_points || 0} pts acumulados na vida
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Next Upcoming Booking Alert */}
      {nextReservation && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-blue-600 font-bold uppercase">Próximo Agendamento</div>
              <div className="text-base font-black text-slate-900 mt-0.5">
                {nextReservation.service_name} • Ref. <span className="font-mono text-blue-600">{nextReservation.reference_code}</span>
              </div>
              <div className="text-xs text-slate-600">
                Marcado para <strong>{nextReservation.scheduled_date} às {nextReservation.scheduled_time}</strong>
                {nextReservation.booking_type === 'onsite'
                  ? <> no local indicado: <strong>{nextReservation.location_address}</strong></>
                  : <> na <strong>Vaga {nextReservation.bay_number || 1}</strong></>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCancel(nextReservation.id)}
              className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Reservation history */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="border-b border-blue-900/10 bg-gradient-to-r from-slate-900 via-blue-950 to-blue-900 p-4 text-white sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-sm text-white">Histórico de Marcações</h3>
              <p className="mt-1 text-xs text-blue-100">Consulte e acompanhe os seus serviços de lavagem.</p>
            </div>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-blue-50">Total: {reservations.length}</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filtrar marcações">
            {[
              { id: 'all', label: 'Todas' },
              { id: 'scheduled', label: 'Agendadas' },
              { id: 'completed', label: 'Concluídas' },
              { id: 'cancelled', label: 'Canceladas' }
            ].map(filter => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setReservationFilter(filter.id)}
                aria-pressed={reservationFilter === filter.id}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                  reservationFilter === filter.id
                    ? 'border-white bg-white text-blue-800 shadow-sm'
                    : 'border-white/20 bg-white/10 text-blue-50 hover:border-white/50 hover:bg-white/20'
                }`}
              >
                {filter.label}
                <span className="ml-1.5 opacity-75">
                  {filter.id === 'all'
                    ? reservations.length
                    : filter.id === 'scheduled'
                      ? reservations.filter(r => ['reservado', 'aguardando', 'em_atendimento'].includes(r.status)).length
                      : reservations.filter(r => r.status === (filter.id === 'completed' ? 'concluido' : 'cancelado')).length}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 bg-gradient-to-b from-slate-100 to-blue-50/70 p-4 sm:p-5">
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-500">A carregar as suas marcações...</p>
          ) : reservations.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
              <p className="text-sm font-semibold text-slate-700">Ainda não possui marcações registadas.</p>
              <Link to="/reservar" className="mt-2 inline-flex text-xs font-bold text-blue-700 hover:underline">
                Marcar uma lavagem
              </Link>
            </div>
          ) : visibleReservations.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">Não há marcações nesta categoria.</p>
          ) : (
            visibleReservations.map(r => {
              const isExpanded = expandedReservationId === r.id;
              const status = {
                reservado: { label: 'Agendada', color: 'bg-blue-100 text-blue-800 ring-blue-300', surface: 'border-blue-200 bg-blue-50/80' },
                aguardando: { label: 'Agendada', color: 'bg-blue-100 text-blue-800 ring-blue-300', surface: 'border-blue-200 bg-blue-50/80' },
                em_atendimento: { label: 'Em andamento', color: 'bg-indigo-100 text-indigo-800 ring-indigo-300', surface: 'border-indigo-200 bg-indigo-50/80' },
                concluido: { label: 'Concluída', color: 'bg-emerald-100 text-emerald-800 ring-emerald-300', surface: 'border-emerald-200 bg-emerald-50/80' },
                cancelado: { label: 'Cancelada', color: 'bg-red-100 text-red-800 ring-red-300', surface: 'border-red-200 bg-red-50/80' }
              }[r.status] || { label: r.status, color: 'bg-slate-200 text-slate-800 ring-slate-300', surface: 'border-slate-200 bg-slate-50' };
              const scheduledDate = new Date(`${r.scheduled_date}T00:00:00`).toLocaleDateString('pt-MZ', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
              });
              const price = r.payment_status === 'pago'
                ? `${r.amount_paid_mzn} MT pago`
                : `${Math.max(0, r.price_mzn - (r.total_discount_mzn || 0))} MT`;

              return (
                <article key={r.id} className={`overflow-hidden rounded-2xl border shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${status.surface}`}>
                  <div className="p-4 sm:p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-base font-bold text-slate-900">{r.vehicle_model}</h4>
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ${status.color}`}>
                            {status.label}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {r.vehicle_plate} <span className="mx-1">·</span> Ref. {r.reference_code}
                        </p>
                        <p className="mt-2 text-sm font-medium text-slate-700">{r.service_name}</p>
                      </div>
                      <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                        <p className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
                          <Calendar className="h-3.5 w-3.5" />
                          {scheduledDate} · {r.scheduled_time}
                        </p>
                        <p className="text-base font-black text-slate-900">{price}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setExpandedReservationId(isExpanded ? null : r.id)}
                      aria-expanded={isExpanded}
                      className="mt-4 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                    >
                      {isExpanded ? 'Ocultar detalhes' : 'Ver detalhes'}
                      <ArrowRight className={`h-3.5 w-3.5 transition-transform ${isExpanded ? '-rotate-90' : 'rotate-90'}`} />
                    </button>

                    {isExpanded && (
                      <div className="mt-4 grid gap-3 rounded-xl border border-white/80 bg-white/75 p-4 text-xs shadow-sm sm:grid-cols-2">
                        <p className="text-slate-500">Modalidade: <strong className="text-slate-800">{r.booking_type === 'onsite' ? 'Lavagem no local' : 'Nas instalações Lava Já'}</strong></p>
                        <p className="text-slate-500">Pagamento: <strong className={r.payment_status === 'pago' ? 'text-emerald-700' : 'text-amber-700'}>
                          {r.payment_status === 'pago'
                            ? r.payment_simulated ? 'Pago (simulação)' : 'Pago'
                            : r.status === 'concluido' ? 'Pendente' : 'A aguardar conclusão'}
                        </strong></p>
                        {r.booking_type === 'onsite' && (
                          <p className="break-words text-slate-500 sm:col-span-2">Endereço: <strong className="text-slate-800">{r.location_address}</strong></p>
                        )}
                        {r.vehicle_received_at && (
                          <p className="text-slate-500 sm:col-span-2">Viatura recebida por: <strong className="text-slate-800">{r.vehicle_received_by_name || 'funcionário'}</strong></p>
                        )}
                        {r.notes && (
                          <p className="break-words text-slate-500 sm:col-span-2">Observações: <strong className="text-slate-800">{r.notes}</strong></p>
                        )}
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap justify-end gap-2">
                      {r.vehicle_received_at && (
                        <button
                          onClick={() => downloadVehicleReceipt(r)}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Recibo de receção
                        </button>
                      )}
                      {['reservado', 'aguardando'].includes(r.status) &&
                        !r.vehicle_received_at &&
                        r.payment_status !== 'pago' && (
                        <button
                          onClick={() => handleCancel(r.id)}
                          className="inline-flex min-h-9 items-center justify-center rounded-lg border border-red-200 bg-white px-3 py-2 text-[11px] font-bold text-red-700 transition-colors hover:bg-red-50"
                        >
                          Cancelar
                        </button>
                      )}
                      {r.status === 'concluido' && (
                        <>
                          {!reviews.some(review => review.reservation_id === r.id) && (
                            <button
                              type="button"
                              onClick={() => {
                                setReviewingReservationId(r.id);
                                setReviewError('');
                                setReviewMessage('');
                              }}
                              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-xs font-bold text-blue-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                            >
                              <Star className="h-3.5 w-3.5" />
                              Avaliar
                            </button>
                          )}
                          <button
                            onClick={() => setPaymentReservationId(r.id)}
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-blue-700 bg-blue-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:border-blue-800 hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                          >
                            <ReceiptText className="h-3.5 w-3.5" />
                            {r.payment_status === 'pago' ? 'Ver comprovativo' : 'Proceder ao pagamento'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
        {paymentReservationId && (
          <PaymentPanel
            reservationId={paymentReservationId}
            userRole={user?.role}
            onClose={() => setPaymentReservationId(null)}
            onPaid={loadReservations}
          />
        )}
        {reviewMessage && (
          <p role="status" className="border-t border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {reviewMessage}
          </p>
        )}
      </div>
      {reviewingReservationId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <form
            onSubmit={submitReview}
            className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div>
              <h2 className="text-lg font-black text-slate-900">Avaliar o serviço</h2>
              <p className="mt-1 text-xs text-slate-500">A avaliação fica associada a esta lavagem concluída.</p>
            </div>
            <fieldset>
              <legend className="mb-2 text-xs font-bold text-slate-700">Classificação</legend>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(value => (
                  <button
                    key={value}
                    type="button"
                    aria-label={`${value} ${value === 1 ? 'estrela' : 'estrelas'}`}
                    aria-pressed={reviewRating === value}
                    onClick={() => setReviewRating(value)}
                    className="rounded-lg p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                  >
                    <Star className={`h-7 w-7 ${value <= reviewRating ? 'fill-amber-400 text-amber-500' : 'text-slate-300'}`} />
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="block text-xs font-bold text-slate-700">
              Comentário
              <textarea
                required
                maxLength={1000}
                rows={4}
                value={reviewComment}
                onChange={event => setReviewComment(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm font-normal text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                placeholder="Conte-nos como foi o atendimento."
              />
            </label>
            {reviewError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{reviewError}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReviewingReservationId(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={reviewSubmitting || !reviewComment.trim()}
                className="rounded-xl bg-blue-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                {reviewSubmitting ? 'A enviar...' : 'Enviar avaliação'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
