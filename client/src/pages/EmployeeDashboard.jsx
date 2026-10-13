import React, { useState, useEffect } from 'react';
import { 
  Car, CheckCircle2, Clock, Search, ShieldCheck, 
  AlertCircle, Tag, Award, ArrowRight, PlusCircle, Sparkles, ReceiptText
} from 'lucide-react';
import { apiRequest } from '../api';
import { useAuth } from '../context/AuthContext';
import PaymentPanel from '../components/PaymentPanel';

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [reservations, setReservations] = useState([]);
  const [services, setServices] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

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
  }, []);

  async function loadDashboardData() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const [resData, servData] = await Promise.all([
        apiRequest(`/reservations?date=${today}`),
        apiRequest('/services')
      ]);
      setReservations(resData);
      setServices(servData);
      if (servData.length > 0 && !quickServiceId) {
        setQuickServiceId(servData[0].id.toString());
      }
    } catch (err) {
      console.error(err);
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
    try {
      await apiRequest(`/reservations/${reservationId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          new_status: newStatus,
          notes: `${newStatus === 'concluido' ? 'Lavagem concluída' : 'Lavagem iniciada'} pelo operador ${user.name}`
        })
      });
      loadDashboardData();
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
            Registo de lavagens concluídas, atribuição direta de pontos e validação de benefícios no car wash.
          </p>
        </div>

      </div>

      {/* Quick Wash Registration Form (Highlight Section) */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
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
          <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-emerald-900 text-xs flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <strong>Lavagem concluída registada com sucesso!</strong> Ref: <span className="font-mono font-black text-blue-700">{quickSuccess.reference_code}</span> • Viatura: <strong>{quickSuccess.vehicle_plate}</strong> ({quickSuccess.service_name})
              </div>
            </div>
            <span className="text-emerald-700 font-bold bg-emerald-100 px-2 py-1 rounded">Pronto para Levantamento</span>
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
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Atendimentos & Marcações de Hoje ({reservations.length})
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
                  Nenhum atendimento correspondente encontrado para hoje.
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
                      className={`p-4 rounded-xl border transition-all shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${
                        isDone ? 'bg-emerald-50/40 border-emerald-200' : 'bg-white border-slate-200'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
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
                            isDone ? 'bg-emerald-100 text-emerald-800' : r.status === 'em_atendimento' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {isDone ? r.payment_status === 'pago' ? 'Pago' : 'Lavagem concluída — pagamento pendente' : r.status.replace('_', ' ')}
                          </span>
                        </div>

                        <div className="text-xs text-slate-600 mt-1.5 flex flex-wrap gap-x-3">
                          <span>Serviço: <strong>{r.service_name}</strong> ({r.price_mzn} MT)</span>
                          {isDone && (
                            <span>Pagamento: <strong className={r.payment_status === 'pago' ? 'text-emerald-700' : 'text-amber-700'}>
                              {r.payment_status === 'pago'
                                ? `${r.payment_simulated ? 'Simulação paga' : 'Pago'} — ${r.amount_paid_mzn} MT`
                                : `${Math.max(0, r.price_mzn - (r.total_discount_mzn || 0))} MT pendentes`}
                            </strong></span>
                          )}
                          <span>Condutor: <strong>{r.customer_name}</strong></span>
                          <span>Horário: <strong>{r.scheduled_time}</strong></span>
                        </div>

                        {r.notes && (
                          <div className="text-[11px] text-slate-500 bg-slate-100 rounded px-2 py-0.5 mt-1.5 inline-block">
                            Obs: {r.notes}
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 shrink-0">
                        {nextAction && (
                          <button
                            onClick={() => updateStatus(r.id, nextAction.status)}
                            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>{nextAction.label}</span>
                          </button>
                        )}

                        {isDone && (
                          <button
                            onClick={() => setPaymentReservationId(r.id)}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm ${
                              r.payment_status === 'pago'
                                ? 'border border-emerald-300 bg-emerald-50 text-emerald-800'
                                : 'bg-blue-700 text-white hover:bg-blue-800'
                            }`}
                          >
                            <ReceiptText className="h-4 w-4" />
                            <span>{r.payment_status === 'pago' ? 'Ver comprovativo' : 'Proceder ao Pagamento'}</span>
                          </button>
                        )}
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
