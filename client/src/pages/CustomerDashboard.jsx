import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Car, Calendar, Award, Clock, ArrowRight, XCircle, 
  CheckCircle2, Bot, Bell, Shield, Sparkles 
} from 'lucide-react';
import { apiRequest } from '../api';
import { useAuth } from '../context/AuthContext';

export default function CustomerDashboard({ onOpenAi }) {
  const { user, loyalty, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadReservations();
    }
  }, [user]);

  async function loadReservations() {
    try {
      setLoading(true);
      const data = await apiRequest('/reservations');
      setReservations(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
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

  const activeWash = reservations.find(r => ['em_atendimento', 'aguardando'].includes(r.status));
  const nextReservation = reservations.find(r => r.status === 'reservado');

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
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
          <button
            onClick={onOpenAi}
            className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all border border-white/20 cursor-pointer flex items-center gap-2"
          >
            <Bot className="w-4 h-4 text-blue-300" />
            <span>Falar com IA</span>
          </button>
        </div>
      </div>

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
                Marcado para <strong>{nextReservation.scheduled_date} às {nextReservation.scheduled_time}</strong> na <strong>Vaga {nextReservation.bay_number || 1}</strong>
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

      {/* Reservations Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-sm text-slate-900">Histórico de Marcações</h3>
          <span className="text-xs text-slate-500 font-medium">Total: {reservations.length}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/70 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3.5">Ref.</th>
                <th className="p-3.5">Viatura</th>
                <th className="p-3.5">Serviço</th>
                <th className="p-3.5">Data & Hora</th>
                <th className="p-3.5">Valor</th>
                <th className="p-3.5">Estado</th>
                <th className="p-3.5 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reservations.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-slate-400">
                    Ainda não possui marcações registadas.
                  </td>
                </tr>
              ) : (
                reservations.map((r) => {
                  const statusColors = {
                    reservado: 'bg-indigo-100 text-indigo-800 border-indigo-200',
                    aguardando: 'bg-amber-100 text-amber-800 border-amber-200',
                    em_atendimento: 'bg-blue-100 text-blue-800 border-blue-200',
                    concluido: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                    cancelado: 'bg-red-100 text-red-800 border-red-200',
                  };

                  return (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3.5 font-mono font-bold text-blue-600">
                        {r.reference_code}
                      </td>
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900 font-mono">{r.vehicle_plate}</div>
                        <div className="text-[11px] text-slate-500">{r.vehicle_model}</div>
                      </td>
                      <td className="p-3.5 font-medium text-slate-800">
                        {r.service_name}
                      </td>
                      <td className="p-3.5 text-slate-700">
                        {r.scheduled_date} às {r.scheduled_time}
                      </td>
                      <td className="p-3.5 font-bold text-slate-900">
                        {r.price_mzn} MT
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase ${statusColors[r.status] || 'bg-slate-100'}`}>
                          {r.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        {r.status === 'reservado' && (
                          <button
                            onClick={() => handleCancel(r.id)}
                            className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                          >
                            Cancelar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
