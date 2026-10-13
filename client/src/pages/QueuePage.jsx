import React, { useState, useEffect } from 'react';
import { CheckCircle2, Clock, Search } from 'lucide-react';
import { apiRequest } from '../api';
import { Link } from 'react-router-dom';

export default function QueuePage() {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [tab, setTab] = useState('prontos'); // 'prontos' | 'todos'

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      const data = await apiRequest(`/reservations?date=${today}`);
      setReservations(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const completedCars = reservations.filter(r => r.status === 'concluido');
  const pendingCars = reservations.filter(r => r.status !== 'concluido' && r.status !== 'cancelado');

  const displayList = (tab === 'prontos' ? completedCars : reservations).filter(r => {
    if (!searchTerm) return true;
    return r.vehicle_plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
           r.reference_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
           r.customer_name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-xs font-bold text-blue-600 uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
            Balcão de Levantamentos
          </span>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight mt-2">
            Veículos Prontos & Atendimentos
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Consulte se a sua viatura já foi concluída e está pronta para recolha no Lava Já Matola.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/reservar"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
          >
            Marcar Lavagem
          </Link>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-5 rounded-2xl shadow-md flex items-center justify-between">
          <div>
            <div className="text-xs text-emerald-100 font-semibold uppercase">Prontos para Levantamento</div>
            <div className="text-3xl font-black mt-1">{completedCars.length}</div>
            <div className="text-xs text-emerald-100 mt-1">Viaturas lavadas e prontas para entrega</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
            <CheckCircle2 className="w-7 h-7 text-white" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 font-semibold uppercase">Agendamentos Marcados para Hoje</div>
            <div className="text-3xl font-black text-slate-900 mt-1">{pendingCars.length}</div>
            <div className="text-xs text-slate-400 mt-1">A aguardar chegada ou atendimento</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap justify-between items-center gap-3 bg-slate-50">
          {/* Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setTab('prontos')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                tab === 'prontos'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              ✓ Prontos para Levantamento ({completedCars.length})
            </button>
            <button
              onClick={() => setTab('todos')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                tab === 'todos'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Todos os Registos do Dia ({reservations.length})
            </button>
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:w-60">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Matrícula ou Ref..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-mono uppercase"
            />
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/70 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3.5">Ref.</th>
                <th className="p-3.5">Matrícula</th>
                <th className="p-3.5">Modelo</th>
                <th className="p-3.5">Serviço Realizado</th>
                <th className="p-3.5">Condutor</th>
                <th className="p-3.5">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayList.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-10 text-center text-slate-400">
                    Nenhuma viatura encontrada nesta secção.
                  </td>
                </tr>
              ) : (
                displayList.map((item) => {
                  const isDone = item.status === 'concluido';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3.5 font-mono font-bold text-blue-600">
                        {item.reference_code}
                      </td>
                      <td className="p-3.5 font-mono font-black text-slate-900 text-sm">
                        {item.vehicle_plate}
                      </td>
                      <td className="p-3.5 text-slate-600">
                        {item.vehicle_model}
                      </td>
                      <td className="p-3.5 font-medium text-slate-800">
                        {item.service_name}
                      </td>
                      <td className="p-3.5 text-slate-600">
                        {item.customer_name}
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${
                          isDone
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-amber-100 text-amber-800 border-amber-300'
                        }`}>
                          {isDone ? 'Pronto para Levantamento' : 'Agendado'}
                        </span>
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
