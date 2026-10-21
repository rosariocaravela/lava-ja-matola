import React, { useState, useEffect } from 'react';
import { 
  Car, CheckCircle2, Clock, Search, ShieldCheck, 
  AlertCircle, Tag, Award, ArrowRight, PlusCircle, Sparkles, ReceiptText, Download, XCircle
} from 'lucide-react';
import { apiRequest } from '../api';
import { useAuth } from '../context/AuthContext';
import PaymentPanel from '../components/PaymentPanel';
import { downloadVehicleReceipt } from '../utils/vehicleReceipt';

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [reservations, setReservations] = useState([]);
  const [services, setServices] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');

  // Quick completed wash registration form
  const [quickPlate, setQuickPlate] = useState('');
  const [quickName, setQuickName] = useState('');
  const [quickPhone, setQuickPhone] = useState('');
  const [quickModel, setQuickModel] = useState('');
  const [quickServiceId, setQuickServiceId] = useState('');
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickSuccess, setQuickSuccess] = useState(null);
  const [quickError, setQuickError] = useState('');

  const [paymentReservationId, setPaymentReservationId] = useState(null);

  useEffect(() => {
    loadDashboardData();
    const interval = window.setInterval(loadDashboardData, 15000);
    return () => window.clearInterval(interval);
  }, []);

  async function loadDashboardData() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const [resData, servData] = await Promise.all([
        apiRequest(`/reservations?from_date=${today}`),
        apiRequest('/services')
      ]);
      setReservations(resData);
      setServices(servData);
      if (servData.length > 0) {
        setQuickServiceId(current => current || servData[0].id.toString());
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function confirmVehicleReceived(reservationId) {
    try {
      await apiRequest(`/reservations/${reservationId}/receive`, { method: 'POST' });
      await loadDashboardData();
    } catch (err) {
      alert('Erro ao confirmar a receção: ' + err.message);
    }
  }

  async function handleQuickRegister(e) {
    e.preventDefault();
    setQuickError('');
    setQuickSuccess(null);

    if (!quickPlate.trim() || !quickName.trim() || !quickServiceId) {
      setQuickError('Preencha a matrícula, nome do cliente e serviço.');
      return;
    }

    try {
      setQuickLoading(true);
      const res = await apiRequest('/reservations/register-completed', {
        method: 'POST',
        body: JSON.stringify({
          customer_name: quickName.trim(),
          customer_phone: quickPhone.trim() || null,
          vehicle_plate: quickPlate.trim().toUpperCase(),
          vehicle_model: quickModel.trim() || 'Viatura',
          service_id: parseInt(quickServiceId, 10),
          notes: 'Lavagem concluída registada diretamente no balcão'
        })
      });

      setQuickSuccess(res.reservation);
      setPaymentReservationId(res.reservation.id);
      setQuickPlate('');
      setQuickName('');
      setQuickPhone('');
      setQuickModel('');
      loadDashboardData();
    } catch (err) {
      setQuickError(err.message);
    } finally {
      setQuickLoading(false);
    }
  }

  async function updateStatus(reservationId, newStatus) {
    if (newStatus === 'cancelado' && !window.confirm('Tem a certeza de que deseja cancelar esta reserva?')) {
      return;
    }

    try {
      await apiRequest(`/reservations/${reservationId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          new_status: newStatus,
          notes: `${newStatus === 'concluido'
            ? 'Lavagem concluída'
            : newStatus === 'cancelado'
              ? 'Reserva cancelada'
              : 'Lavagem iniciada'} pelo operador ${user.name}`
        })
      });
      await loadDashboardData();
    } catch (err) {
      alert('Erro ao atualizar estado: ' + err.message);
    }
  }

  const filtered = reservations.filter(r => {
    const matchesSearch = 
      r.reference_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.vehicle_plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.customer_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (statusFilter === 'all') return matchesSearch;
    if (statusFilter === 'active') return matchesSearch && r.status !== 'cancelado';
    return matchesSearch && r.status === statusFilter;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-slate-900 to-blue-950 p-6 rounded-3xl text-white shadow-xl">
        <div>
          <span className="text-xs bg-emerald-500/30 text-emerald-300 font-bold px-2.5 py-0.5 rounded-full border border-emerald-400/20">
            Painel Operacional • Balcão Lava Já Matola
          </span>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-2">
            Operador: {user?.name || 'Funcionário'}
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Consulte reservas, registe lavagens e acompanhe o atendimento.
          </p>
        </div>
        <nav aria-label="Atalhos do painel operacional" className="flex flex-wrap gap-2">
          <a
            href="#reservas"
            className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-blue-500"
          >
            Reservas
          </a>
          <a
            href="#registar-lavagem"
            className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold text-white transition hover:bg-white/20"
          >
            Registar lavagem
          </a>
        </nav>
      </div>

      {/* Quick Wash Registration Form (Highlight Section) */}
      <div id="registar-lavagem" className="scroll-mt-24 bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-slate-900">
          <PlusCircle className="w-5 h-5 text-blue-600" />
          <h2 className="text-base font-black">Registar Lavagem Concluída no Balcão</h2>
          <span className="text-[11px] bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full font-semibold border border-blue-200">
            Registo Imediato
          </span>
        </div>
        <p className="text-xs text-slate-500">
          O veículo terminou de ser lavado? Registe aqui na hora para emitir a referência e atribuir os pontos ao cliente:
        </p>

        {quickSuccess && (
          <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-emerald-900 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <strong>Lavagem concluída registada com sucesso!</strong> Ref: <span className="font-mono font-black text-blue-700">{quickSuccess.reference_code}</span> • Viatura: <strong>{quickSuccess.vehicle_plate}</strong> ({quickSuccess.service_name})
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => downloadVehicleReceipt(quickSuccess)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-2.5 py-1.5 font-bold text-emerald-800 hover:bg-emerald-100"
              >
                <Download className="h-3.5 w-3.5" />
                Recibo de receção
              </button>
              <span className="text-emerald-700 font-bold bg-emerald-100 px-2 py-1 rounded">Pronto para Levantamento</span>
            </div>
          </div>
        )}

        {quickError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{quickError}</span>
          </div>
        )}

        <form onSubmit={handleQuickRegister} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <div>
            <label className="text-slate-600 font-semibold mb-1 block">Matrícula *</label>
            <input
              type="text"
              required
              placeholder="Ex: AEL 789 MP"
              value={quickPlate}
              onChange={(e) => setQuickPlate(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono uppercase font-bold focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-slate-600 font-semibold mb-1 block">Nome do Cliente *</label>
            <input
              type="text"
              required
              placeholder="Ex: Carlos Sitoe"
              value={quickName}
              onChange={(e) => setQuickName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-slate-600 font-semibold mb-1 block">Telefone (Passaporte VIP)</label>
            <input
              type="text"
              placeholder="+258 84..."
              value={quickPhone}
              onChange={(e) => setQuickPhone(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-slate-600 font-semibold mb-1 block">Serviço Realizado *</label>
            <select
              value={quickServiceId}
              onChange={(e) => setQuickServiceId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-blue-500"
            >
              {services.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.price_mzn} MT)
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={quickLoading}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-md cursor-pointer transition-all flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{quickLoading ? 'A registar...' : 'Gravar Conclusão'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Operator Tools Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Reservations Management Board */}
        <div className="lg:col-span-8 space-y-4">
          <div id="reservas" className="scroll-mt-24 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Reservas e atendimentos futuros ({filtered.length})
              </h2>

              {/* Search & Filter */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-48">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Matrícula / Ref..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
                >
                  <option value="active">Ativos</option>
                  <option value="all">Todos</option>
                  <option value="reservado">Reservados</option>
                  <option value="aguardando">Aguardando</option>
                  <option value="concluido">Concluídos</option>
                  <option value="cancelado">Cancelados</option>
                </select>
              </div>
            </div>

            {/* List */}
            <div className="space-y-3">
              {filtered.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  Nenhuma reserva ou atendimento correspondente encontrado.
                </div>
              ) : (
                filtered.map((r) => {
                  const isDone = r.status === 'concluido';
                  const nextAction = r.status === 'reservado' || r.status === 'aguardando'
                    ? { label: 'Iniciar lavagem', status: 'em_atendimento' }
                    : r.status === 'em_atendimento'
                      ? { label: 'Concluir Lavagem', status: 'concluido' }
                      : null;

                  return (
                    <div
                      key={r.id}
                      className={`p-4 rounded-xl border transition-all shadow-xs space-y-3 ${
                        isDone ? 'bg-emerald-50/40 border-emerald-200' : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-bold text-sm text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                            {r.reference_code}
                          </span>
                          <span className="font-black text-slate-900 text-sm font-mono">
                            {r.vehicle_plate}
                          </span>
                          <span className="text-xs text-slate-500">
                            ({r.vehicle_model})
                          </span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                            isDone ? 'bg-emerald-100 text-emerald-800' : r.status === 'em_atendimento' ? 'bg-blue-100 text-blue-800' : r.status === 'cancelado' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {isDone
                              ? r.payment_status === 'pago' ? 'Concluída — paga' : 'Concluída — pagamento pendente'
                              : r.status === 'em_atendimento' ? 'Em atendimento'
                                : r.status === 'aguardando' ? 'À espera'
                                  : r.status === 'cancelado' ? 'Cancelada'
                                    : 'Agendada'}
                          </span>
                        </div>

                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                            <span>Serviço: <strong>{r.service_name}</strong></span>
                            <span>Cliente: <strong>{r.customer_name}</strong></span>
                            <span>Data: <strong>{r.scheduled_date} às {r.scheduled_time}</strong></span>
                          </div>
                        </div>

                        <details className="group shrink-0">
                          <summary className="cursor-pointer list-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-center text-xs font-bold text-blue-700 transition hover:bg-blue-50">
                            Ver detalhes
                          </summary>
                          <div className="mt-3 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-700 sm:grid-cols-2 lg:grid-cols-3">
                            <p>Referência: <strong>{r.reference_code}</strong></p>
                            <p>Cliente: <strong>{r.customer_name}</strong></p>
                            <p>Contacto: <strong>{r.customer_phone || 'Não indicado'}</strong></p>
                            <p>Viatura: <strong>{r.vehicle_model} · {r.vehicle_plate}</strong></p>
                            <p>Serviço: <strong>{r.service_name}</strong></p>
                            <p>Preço: <strong>{r.price_mzn} MT</strong></p>
                            <p>Data e hora: <strong>{r.scheduled_date} às {r.scheduled_time}</strong></p>
                            <p>Pagamento: <strong className={r.payment_status === 'pago' ? 'text-emerald-700' : 'text-amber-700'}>
                              {r.payment_status === 'pago'
                                ? `${r.payment_simulated ? 'Simulado' : 'Pago'} · ${r.amount_paid_mzn} MT`
                                : `${Math.max(0, r.price_mzn - (r.total_discount_mzn || 0))} MT por pagar`}
                            </strong></p>
                            {r.vehicle_received_at && (
                              <p>Recebida por: <strong>{r.vehicle_received_by_name || 'Funcionário'}</strong></p>
                            )}
                            {r.notes && (
                              <p className="sm:col-span-2 lg:col-span-3 break-words">
                                Observações: <strong>{r.notes}</strong>
                              </p>
                            )}
                          </div>
                        </details>
                      </div>

                      <div className="flex flex-col gap-2 border-t border-slate-200 pt-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                        <div className="flex flex-wrap gap-2">
                          {!isDone && !r.vehicle_received_at && ['reservado', 'aguardando', 'em_atendimento'].includes(r.status) && (
                            <button
                              onClick={() => confirmVehicleReceived(r.id)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800 transition hover:bg-blue-100"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Confirmar receção
                            </button>
                          )}
                          {r.vehicle_received_at && (
                            <button
                              onClick={() => downloadVehicleReceipt(r)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100"
                            >
                              <Download className="h-4 w-4" />
                              Recibo de receção
                            </button>
                          )}
                          {['reservado', 'aguardando'].includes(r.status) && !r.vehicle_received_at && (
                            <button
                              onClick={() => updateStatus(r.id, 'cancelado')}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100"
                            >
                              <XCircle className="h-4 w-4" />
                              Cancelar reserva
                            </button>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 sm:justify-end">
                          {nextAction && (
                            <button
                              onClick={() => updateStatus(r.id, nextAction.status)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              {nextAction.label}
                            </button>
                          )}
                          {isDone && (
                            <button
                              onClick={() => setPaymentReservationId(r.id)}
                              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold shadow-sm transition ${
                                r.payment_status === 'pago'
                                  ? 'border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                                  : 'bg-blue-700 text-white hover:bg-blue-800'
                              }`}
                            >
                              <ReceiptText className="h-4 w-4" />
                              {r.payment_status === 'pago' ? 'Ver pagamento' : 'Registar pagamento'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right: Payment and cashier information */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <ReceiptText className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-sm text-slate-900">Cobranças e comprovativos</h3>
            </div>
            <p className="text-xs leading-relaxed text-slate-600">
              Ao concluir uma lavagem, abra o pagamento correspondente. O voucher só é consumido junto com a confirmação atómica da cobrança.
            </p>
            <p className="text-[11px] leading-relaxed text-amber-800">
              M-Pesa, e-Mola, mKesh e Moza Banco continuam simulados. Para dinheiro/POS, confirme apenas depois de receber o valor no balcão.
            </p>
          </div>

          {/* Practical Note */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-xs text-blue-900 space-y-2">
            <div className="font-bold">Atendimento no balcão:</div>
            <ul className="list-disc pl-4 space-y-1 text-slate-700">
              <li>Confirme o benefício mostrado antes de o aplicar à conta.</li>
              <li>O voucher é abatido uma única vez ao validar. Confirme o serviço e o valor restante com o cliente.</li>
              <li>Registe a lavagem concluída para creditar os pontos na conta associada ao telefone do cliente.</li>
            </ul>
          </div>
          {paymentReservationId && (
            <PaymentPanel
              reservationId={paymentReservationId}
              userRole={user?.role}
              onClose={() => setPaymentReservationId(null)}
              onPaid={loadDashboardData}
            />
          )}
        </div>
      </div>
    </div>
  );
}
