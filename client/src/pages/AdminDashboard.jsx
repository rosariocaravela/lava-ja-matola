import React, { useState, useEffect } from 'react';
import { 
  Users, DollarSign, Calendar, TrendingUp, Award, Settings, 
  Tag, Shield, Plus, Edit2, Trash2, Check, X, RotateCcw, 
  AlertCircle, CheckCircle2, Car, Clock
} from 'lucide-react';
import { apiRequest } from '../api';
import { useAuth } from '../context/AuthContext';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [services, setServices] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [settings, setSettings] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  // Form states
  const [editingService, setEditingService] = useState(null);
  const [newPromo, setNewPromo] = useState({
    title: '', code: '', discount_percentage: 15,
    start_date: '2026-01-01', end_date: '2026-12-31'
  });
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    loadAllData();
  }, []);

  async function loadAllData() {
    try {
      setLoading(true);
      const [sData, srvData, pData, settData] = await Promise.all([
        apiRequest('/dashboard/stats'),
        apiRequest('/services/all'),
        apiRequest('/promotions/all'),
        apiRequest('/settings')
      ]);

      setStats(sData);
      setServices(srvData);
      setPromotions(pData);
      setSettings(settData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function showMessage(msg) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  }

  async function handleUpdateServicePrice(serviceId, newPrice) {
    try {
      await apiRequest(`/services/${serviceId}`, {
        method: 'PUT',
        body: JSON.stringify({ price_mzn: parseFloat(newPrice) })
      });
      showMessage('Preço atualizado com sucesso!');
      setEditingService(null);
      loadAllData();
    } catch (err) {
      alert('Erro ao atualizar: ' + err.message);
    }
  }

  async function handleTogglePromotion(promoId) {
    try {
      await apiRequest(`/promotions/${promoId}/toggle`, { method: 'PATCH' });
      showMessage('Estado da promoção alterado!');
      loadAllData();
    } catch (err) {
      alert('Erro: ' + err.message);
    }
  }

  async function handleCreatePromo(e) {
    e.preventDefault();
    try {
      await apiRequest('/promotions', {
        method: 'POST',
        body: JSON.stringify(newPromo)
      });
      showMessage('Nova promoção criada com sucesso!');
      setNewPromo({ title: '', code: '', discount_percentage: 15, start_date: '2026-01-01', end_date: '2026-12-31' });
      loadAllData();
    } catch (err) {
      alert('Erro ao criar promoção: ' + err.message);
    }
  }

  async function handleUpdateSettings(e) {
    e.preventDefault();
    try {
      await apiRequest('/settings', {
        method: 'PUT',
        body: JSON.stringify(settings)
      });
      showMessage('Configurações do estabelecimento guardadas com sucesso!');
      loadAllData();
    } catch (err) {
      alert('Erro ao guardar configurações: ' + err.message);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-slate-950 via-purple-950 to-slate-900 p-6 sm:p-8 rounded-3xl text-white shadow-xl">
        <div>
          <span className="text-xs bg-purple-500/30 text-purple-300 font-bold px-2.5 py-0.5 rounded-full border border-purple-400/20">
            Painel Geral do Administrador / Gestor
          </span>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-2">
            Gestão Estratégica Lava Já Matola
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Controlo de preços, fidelização, horários e indicadores de desempenho.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'overview', label: 'Visão Geral & KPIs' },
            { id: 'services', label: 'Serviços & Preços' },
            { id: 'promotions', label: 'Promoções' },
            { id: 'settings', label: 'Configurações' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white/10 hover:bg-white/20 text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* TAB 1: OVERVIEW & KPIS */}
      {activeTab === 'overview' && stats && (
        <div className="space-y-8 animate-in fade-in">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-xs text-slate-500 font-semibold uppercase">Marcações Hoje</div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
                {stats.todayStats.total}
              </div>
              <div className="text-[11px] text-blue-600 font-medium mt-1">
                {stats.todayStats.concluido} concluídas • {stats.todayStats.em_atendimento} em lavagem
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-xs text-slate-500 font-semibold uppercase">Faturação Prevista Hoje</div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-600 mt-1">
                {stats.todayStats.revenueMzn} <span className="text-sm font-semibold">MT</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Serviços concluídos</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-xs text-slate-500 font-semibold uppercase">Clientes Registados</div>
              <div className="text-2xl sm:text-3xl font-black text-blue-600 mt-1">
                {stats.users?.total_customers || 2}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Recorrentes: <strong>{stats.customerRetention.recurringCustomers}</strong>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-xs text-slate-500 font-semibold uppercase">Passaporte VIP (Pontos)</div>
              <div className="text-2xl sm:text-3xl font-black text-amber-500 mt-1">
                {stats.loyalty.pointsEarned} <span className="text-sm font-semibold">pts</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Resgatados: <strong>{stats.loyalty.pointsRedeemed} pts</strong>
              </div>
            </div>
          </div>

          {/* Service Popularity & Audit Log */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="font-bold text-sm text-slate-900 uppercase tracking-wider">
                Serviços Mais Procurados
              </h3>
              <div className="space-y-3">
                {stats.topServices?.map(serv => (
                  <div key={serv.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl text-xs">
                    <div>
                      <div className="font-bold text-slate-900">{serv.name}</div>
                      <div className="text-slate-500">{serv.price_mzn} MT</div>
                    </div>
                    <span className="font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">
                      {serv.booking_count} marcações
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="font-bold text-sm text-slate-900 uppercase tracking-wider">
                Histórico Recente de Atendimentos
              </h3>
              <div className="space-y-2 text-xs">
                {stats.recentActivity?.map((act, i) => (
                  <div key={i} className="flex justify-between items-center p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <span className="font-mono font-bold text-blue-600">{act.reference_code}</span> ({act.vehicle_plate})
                      <span className="text-slate-600 ml-1.5 font-medium">→ {act.new_status.replace('_', ' ')}</span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {new Date(act.created_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SERVICES & PRICING */}
      {activeTab === 'services' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6 animate-in fade-in">
          <div>
            <h2 className="text-lg font-black text-slate-900">Tabela de Serviços & Preços</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Altere os preços em tempo real para testar o impacto imediato nas reservas e catálogo público.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Serviço</th>
                  <th className="p-3">Duração</th>
                  <th className="p-3">Preço Atual (MT)</th>
                  <th className="p-3">Pontos Atribuídos</th>
                  <th className="p-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {services.map(s => {
                  const isEditing = editingService?.id === s.id;
                  return (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-900">
                        {s.name}
                        <div className="text-[11px] text-slate-500 font-normal">{s.description}</div>
                      </td>
                      <td className="p-3 text-slate-600">{s.duration_minutes} min</td>
                      <td className="p-3 font-bold text-slate-900">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editingService.price_mzn}
                            onChange={(e) => setEditingService({ ...editingService, price_mzn: e.target.value })}
                            className="w-24 px-2 py-1 border border-blue-500 rounded bg-white"
                          />
                        ) : (
                          <span>{s.price_mzn} MT</span>
                        )}
                      </td>
                      <td className="p-3 text-amber-600 font-semibold">+{s.points_reward} pts</td>
                      <td className="p-3 text-right">
                        {isEditing ? (
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => handleUpdateServicePrice(s.id, editingService.price_mzn)}
                              className="p-1.5 bg-emerald-600 text-white rounded cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingService(null)}
                              className="p-1.5 bg-slate-200 text-slate-700 rounded cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingService(s)}
                            className="px-3 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg font-semibold cursor-pointer"
                          >
                            Editar Preço
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: PROMOTIONS */}
      {activeTab === 'promotions' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in">
          {/* Create Promo Form */}
          <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900 uppercase tracking-wider">Criar Nova Campanha</h3>
            <form onSubmit={handleCreatePromo} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-600 font-semibold mb-1 block">Título da Campanha</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Campanha de Fim-de-Semana"
                  value={newPromo.title}
                  onChange={(e) => setNewPromo({ ...newPromo, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="text-slate-600 font-semibold mb-1 block">Código do Cupão</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: WEEKEND25"
                  value={newPromo.code}
                  onChange={(e) => setNewPromo({ ...newPromo, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono uppercase"
                />
              </div>

              <div>
                <label className="text-slate-600 font-semibold mb-1 block">Desconto (%)</label>
                <input
                  type="number"
                  min="5"
                  max="50"
                  required
                  value={newPromo.discount_percentage}
                  onChange={(e) => setNewPromo({ ...newPromo, discount_percentage: parseInt(e.target.value, 10) })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-600 font-semibold mb-1 block">Data Início</label>
                  <input
                    type="date"
                    required
                    value={newPromo.start_date}
                    onChange={(e) => setNewPromo({ ...newPromo, start_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-slate-600 font-semibold mb-1 block">Data Fim</label>
                  <input
                    type="date"
                    required
                    value={newPromo.end_date}
                    onChange={(e) => setNewPromo({ ...newPromo, end_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl cursor-pointer shadow-xs"
              >
                Registar Promoção
              </button>
            </form>
          </div>

          {/* Promo list */}
          <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900 uppercase tracking-wider">Campanhas Registadas</h3>
            <div className="space-y-3">
              {promotions.map(p => (
                <div key={p.id} className="p-4 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                        {p.code}
                      </span>
                      <span className="font-bold text-slate-900">{p.title}</span>
                      <span className="text-emerald-600 font-bold">-{p.discount_percentage}%</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Válido de {p.start_date} até {p.end_date}
                    </div>
                  </div>

                  <button
                    onClick={() => handleTogglePromotion(p.id)}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs cursor-pointer transition-colors ${
                      p.is_active
                        ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {p.is_active ? 'Ativa' : 'Inativa'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SETTINGS */}
      {activeTab === 'settings' && settings && (
        <div className="max-w-2xl bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6 animate-in fade-in">
          <div>
            <h2 className="text-lg font-black text-slate-900">Configurações Gerais do Estabelecimento</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Edite as regras de capacidade de vagas, horário de funcionamento e contacto.
            </p>
          </div>

          <form onSubmit={handleUpdateSettings} className="space-y-4 text-xs">
            <div>
              <label className="text-slate-600 font-semibold mb-1 block">Nome Comercial</label>
              <input
                type="text"
                value={settings.name}
                onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>

            <div>
              <label className="text-slate-600 font-semibold mb-1 block">Endereço Físico</label>
              <input
                type="text"
                value={settings.address}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-600 font-semibold mb-1 block">Horário de Abertura</label>
                <input
                  type="text"
                  value={settings.open_time}
                  onChange={(e) => setSettings({ ...settings, open_time: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="text-slate-600 font-semibold mb-1 block">Horário de Fecho</label>
                <input
                  type="text"
                  value={settings.close_time}
                  onChange={(e) => setSettings({ ...settings, close_time: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-600 font-semibold mb-1 block">Vagas Simultâneas (Capacidade)</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={settings.simultaneous_capacity}
                  onChange={(e) => setSettings({ ...settings, simultaneous_capacity: parseInt(e.target.value, 10) })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="text-slate-600 font-semibold mb-1 block">Intervalo de Slots (minutos)</label>
                <input
                  type="number"
                  value={settings.slot_interval_minutes}
                  onChange={(e) => setSettings({ ...settings, slot_interval_minutes: parseInt(e.target.value, 10) })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-600 font-semibold mb-1 block">Telefone de Contacto</label>
              <input
                type="text"
                value={settings.phone}
                onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl cursor-pointer shadow-md"
            >
              Guardar Configurações
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
