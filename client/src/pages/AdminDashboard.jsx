import React, { useState, useEffect } from 'react';
import { 
  Users, DollarSign, Calendar, TrendingUp, Award, Settings, 
  Tag, Shield, Plus, Edit2, Trash2, Check, X, RotateCcw, 
  AlertCircle, CheckCircle2, Car, Clock, Download, Eye, EyeOff, UserPlus, Power
} from 'lucide-react';
import { apiRequest } from '../api';
import { useAuth } from '../context/AuthContext';

function getLocalDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function escapeCsvCell(value) {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [services, setServices] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [settings, setSettings] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [activityFilters, setActivityFilters] = useState({ status: 'all', period: 'all' });
  const [reportDates, setReportDates] = useState(() => {
    const today = new Date();
    return {
      start_date: getLocalDateString(new Date(today.getFullYear(), today.getMonth(), 1)),
      end_date: getLocalDateString(today)
    };
  });
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employeeSubmitting, setEmployeeSubmitting] = useState(false);
  const [employeeError, setEmployeeError] = useState('');
  const [employeeSuccess, setEmployeeSuccess] = useState('');
  const [showEmployeePassword, setShowEmployeePassword] = useState(false);
  const [newEmployee, setNewEmployee] = useState({ name: '', email: '', phone: '', password: '' });
  const [editingEmployeeId, setEditingEmployeeId] = useState(null);
  const [editingEmployee, setEditingEmployee] = useState({ name: '', email: '', phone: '' });

  // Form states
  const [editingService, setEditingService] = useState(null);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [newService, setNewService] = useState({
    name: '',
    description: '',
    category: 'Básica',
    price_mzn: '',
    duration_minutes: '',
    points_reward: '10'
  });
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

  async function updateActivityFilters(nextFilters) {
    setActivityFilters(nextFilters);
    try {
      const query = new URLSearchParams(nextFilters);
      const filteredStats = await apiRequest(`/dashboard/stats?${query}`);
      setStats(current => current ? { ...current, recentActivity: filteredStats.recentActivity } : current);
    } catch (err) {
      console.error(err);
      alert('Erro ao filtrar histórico: ' + err.message);
    }
  }

  async function loadReport(dates = reportDates) {
    if (!dates.start_date || !dates.end_date || dates.start_date > dates.end_date) {
      alert('Selecione um intervalo de datas válido.');
      return;
    }

    try {
      setReportLoading(true);
      const query = new URLSearchParams(dates);
      const data = await apiRequest(`/dashboard/reports?${query}`);
      setReportData(data);
    } catch (err) {
      console.error(err);
      alert('Erro ao carregar relatório: ' + err.message);
    } finally {
      setReportLoading(false);
    }
  }

  function setReportPreset(preset) {
    const today = new Date();
    const endDate = getLocalDateString(today);
    let startDate = reportDates.start_date;

    if (preset === 'today') {
      startDate = endDate;
    } else if (preset === '7d') {
      const from = new Date(today);
      from.setDate(from.getDate() - 6);
      startDate = getLocalDateString(from);
    } else if (preset === 'month') {
      startDate = getLocalDateString(new Date(today.getFullYear(), today.getMonth(), 1));
    }

    setReportDates({ start_date: startDate, end_date: endDate });
  }

  function exportReportCsv() {
    if (!reportData) return;
    const summaryRows = [
      ['Indicador', 'Valor'],
      ['Período', `${reportData.period.start_date} a ${reportData.period.end_date}`],
      ['Marcações', reportData.summary.totalReservations],
      ['Lavagens concluídas', reportData.summary.completedWashes],
      ['Marcações canceladas', reportData.summary.cancelledReservations],
      ['Valor recebido (MT, não simulado)', reportData.summary.receivedMzn],
      ['Pagamentos simulados (MT, não recebido)', reportData.summary.simulatedMzn],
      ['Descontos aplicados (MT)', reportData.summary.discountsMzn],
      ['Pontos atribuídos', reportData.summary.pointsEarned],
      ['Pontos resgatados', reportData.summary.pointsRedeemed],
      ['Recompensas resgatadas', reportData.summary.rewardsRedeemed]
    ];
    const serviceRows = [
      [],
      ['Serviço', 'Lavagens concluídas', 'Valor bruto (MT)', 'Descontos (MT)', 'Valor recebido (MT, não simulado)'],
      ...reportData.services.map(service => [
        service.name,
        service.completed_washes,
        service.gross_mzn,
        service.discounts_mzn,
        service.received_mzn
      ])
    ];
    const csv = [...summaryRows, ...serviceRows]
      .map(row => row.map(escapeCsvCell).join(','))
      .join('\r\n');
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio-lava-ja-${reportData.period.start_date}-${reportData.period.end_date}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function showMessage(msg) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  }

  async function handleUpdateService(serviceId, newPrice, newPoints) {
    try {
      await apiRequest(`/services/${serviceId}`, {
        method: 'PUT',
        body: JSON.stringify({
          price_mzn: parseFloat(newPrice),
          points_reward: parseInt(newPoints, 10)
        })
      });
      showMessage('Preço e pontos atualizados com sucesso!');
      setEditingService(null);
      loadAllData();
    } catch (err) {
      alert('Erro ao atualizar: ' + err.message);
    }
  }

  async function handleCreateService(e) {
    e.preventDefault();
    try {
      await apiRequest('/services', {
        method: 'POST',
        body: JSON.stringify({
          ...newService,
          price_mzn: Number(newService.price_mzn),
          duration_minutes: Number(newService.duration_minutes),
          points_reward: Number(newService.points_reward)
        })
      });
      showMessage('Novo serviço criado com sucesso!');
      setNewService({
        name: '',
        description: '',
        category: 'Básica',
        price_mzn: '',
        duration_minutes: '',
        points_reward: '10'
      });
      setShowServiceForm(false);
      loadAllData();
    } catch (err) {
      alert('Erro ao criar serviço: ' + err.message);
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

  async function handleDeletePromotion(promotion) {
    if (!window.confirm(`Remover permanentemente a campanha "${promotion.title}"? Esta ação não pode ser desfeita.`)) {
      return;
    }

    try {
      await apiRequest(`/promotions/${promotion.id}`, { method: 'DELETE' });
      showMessage('Campanha removida com sucesso!');
      loadAllData();
    } catch (err) {
      alert('Erro ao remover campanha: ' + err.message);
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

  async function loadEmployees() {
    try {
      setEmployeesLoading(true);
      const data = await apiRequest('/users/employees');
      setEmployees(data);
      setEmployeeError('');
    } catch (err) {
      setEmployeeError('Erro ao carregar funcionários: ' + err.message);
    } finally {
      setEmployeesLoading(false);
    }
  }

  async function handleCreateEmployee(event) {
    event.preventDefault();
    setEmployeeError('');
    setEmployeeSuccess('');
    setEmployeeSubmitting(true);

    try {
      const created = await apiRequest('/users', {
        method: 'POST',
        body: JSON.stringify({ ...newEmployee, role: 'employee' })
      });
      setEmployees(current => [created, ...current]);
      setNewEmployee({ name: '', email: '', phone: '', password: '' });
      setShowEmployeePassword(false);
      setEmployeeSuccess(`Conta de funcionário criada para ${created.name}. Partilhe as credenciais de forma segura.`);
    } catch (err) {
      setEmployeeError(err.message);
    } finally {
      setEmployeeSubmitting(false);
    }
  }

  function startEditingEmployee(employee) {
    setEmployeeError('');
    setEmployeeSuccess('');
    setEditingEmployeeId(employee.id);
    setEditingEmployee({
      name: employee.name,
      email: employee.email,
      phone: employee.phone || ''
    });
  }

  async function handleUpdateEmployee(event) {
    event.preventDefault();
    setEmployeeError('');
    setEmployeeSuccess('');
    setEmployeeSubmitting(true);

    try {
      const updated = await apiRequest(`/users/employees/${editingEmployeeId}`, {
        method: 'PUT',
        body: JSON.stringify(editingEmployee)
      });
      setEmployees(current => current.map(employee => employee.id === updated.id ? updated : employee));
      setEditingEmployeeId(null);
      setEmployeeSuccess(`Perfil de ${updated.name} atualizado.`);
    } catch (err) {
      setEmployeeError(err.message);
    } finally {
      setEmployeeSubmitting(false);
    }
  }

  async function handleToggleEmployeeStatus(employee) {
    const nextActiveState = !employee.is_active;
    if (!nextActiveState && !window.confirm(`Desativar a conta de ${employee.name}? O histórico será preservado e o funcionário deixará de poder iniciar sessão.`)) {
      return;
    }

    setEmployeeError('');
    setEmployeeSuccess('');
    try {
      const updated = await apiRequest(`/users/employees/${employee.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: nextActiveState })
      });
      setEmployees(current => current.map(item => item.id === updated.id ? updated : item));
      setEmployeeSuccess(nextActiveState
        ? `A conta de ${updated.name} foi reativada.`
        : `A conta de ${updated.name} foi desativada; o histórico foi preservado.`);
    } catch (err) {
      setEmployeeError(err.message);
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
            { id: 'reports', label: 'Relatórios' },
            { id: 'promotions', label: 'Promoções' },
            { id: 'settings', label: 'Configurações' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === 'reports') loadReport();
                if (tab.id === 'settings') loadEmployees();
              }}
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
                {stats.todayStats.concluido} lavagens concluídas
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
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h3 className="font-bold text-sm text-slate-900 uppercase tracking-wider">
                  Histórico Recente de Atendimentos
                </h3>
                <div className="flex items-center gap-2">
                  <select
                    aria-label="Filtrar histórico por estado"
                    value={activityFilters.status}
                    onChange={(e) => updateActivityFilters({ ...activityFilters, status: e.target.value })}
                    className="px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
                  >
                    <option value="all">Todos os estados</option>
                    <option value="reservado">Reservado</option>
                    <option value="aguardando">Aguardando</option>
                    <option value="concluido">Concluído</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                  <select
                    aria-label="Filtrar histórico por período"
                    value={activityFilters.period}
                    onChange={(e) => updateActivityFilters({ ...activityFilters, period: e.target.value })}
                    className="px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
                  >
                    <option value="all">Todo o período</option>
                    <option value="today">Hoje</option>
                    <option value="7d">Últimos 7 dias</option>
                    <option value="30d">Últimos 30 dias</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2 text-xs">
                {stats.recentActivity?.map((act, i) => (
                  <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] sm:grid-cols-[5.5rem_8rem_minmax(0,1fr)] items-center gap-x-2">
                      <span className="font-mono font-bold text-blue-600 truncate">{act.reference_code}</span>
                      <span className="text-slate-600 truncate">({act.vehicle_plate})</span>
                      <span className="col-span-2 sm:col-span-1 text-slate-600 font-medium truncate">→ {act.new_status.replace('_', ' ')}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-900">Tabela de Serviços & Preços</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Gerencie os serviços, preços e pontos atribuídos.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowServiceForm(!showServiceForm)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              {showServiceForm ? 'Fechar formulário' : 'Novo Serviço'}
            </button>
          </div>

          {showServiceForm && (
            <form onSubmit={handleCreateService} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs">
              <label className="text-slate-600 font-semibold">
                Nome do serviço
                <input
                  type="text"
                  required
                  maxLength="100"
                  value={newService.name}
                  onChange={(e) => setNewService({ ...newService, name: e.target.value })}
                  className="mt-1 w-full px-3 py-2 bg-white border border-slate-200 rounded-xl"
                />
              </label>
              <label className="text-slate-600 font-semibold">
                Categoria
                <select
                  value={newService.category}
                  onChange={(e) => setNewService({ ...newService, category: e.target.value })}
                  className="mt-1 w-full px-3 py-2 bg-white border border-slate-200 rounded-xl"
                >
                  <option>Básica</option>
                  <option>Completa</option>
                  <option>Premium</option>
                  <option>Mecânica</option>
                  <option>Especializada</option>
                </select>
              </label>
              <label className="text-slate-600 font-semibold">
                Descrição
                <input
                  type="text"
                  maxLength="500"
                  value={newService.description}
                  onChange={(e) => setNewService({ ...newService, description: e.target.value })}
                  className="mt-1 w-full px-3 py-2 bg-white border border-slate-200 rounded-xl"
                />
              </label>
              <label className="text-slate-600 font-semibold">
                Preço (MT)
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={newService.price_mzn}
                  onChange={(e) => setNewService({ ...newService, price_mzn: e.target.value })}
                  className="mt-1 w-full px-3 py-2 bg-white border border-slate-200 rounded-xl"
                />
              </label>
              <label className="text-slate-600 font-semibold">
                Duração (minutos)
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={newService.duration_minutes}
                  onChange={(e) => setNewService({ ...newService, duration_minutes: e.target.value })}
                  className="mt-1 w-full px-3 py-2 bg-white border border-slate-200 rounded-xl"
                />
              </label>
              <label className="text-slate-600 font-semibold">
                Pontos atribuídos
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={newService.points_reward}
                  onChange={(e) => setNewService({ ...newService, points_reward: e.target.value })}
                  className="mt-1 w-full px-3 py-2 bg-white border border-slate-200 rounded-xl"
                />
              </label>
              <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold cursor-pointer"
                >
                  Guardar Serviço
                </button>
              </div>
            </form>
          )}

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
                            min="0.01"
                            step="0.01"
                            value={editingService.price_mzn}
                            onChange={(e) => setEditingService({ ...editingService, price_mzn: e.target.value })}
                            className="w-24 px-2 py-1 border border-blue-500 rounded bg-white"
                          />
                        ) : (
                          <span>{s.price_mzn} MT</span>
                        )}
                      </td>
                      <td className="p-3 text-amber-600 font-semibold">
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={editingService.points_reward}
                            onChange={(e) => setEditingService({ ...editingService, points_reward: e.target.value })}
                            className="w-20 px-2 py-1 border border-blue-500 rounded bg-white text-slate-900"
                          />
                        ) : (
                          <span>+{s.points_reward} pts</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {isEditing ? (
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => handleUpdateService(s.id, editingService.price_mzn, editingService.points_reward)}
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
                            Editar
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

      {/* TAB 3: REPORTS */}
      {activeTab === 'reports' && (
        <div className="space-y-6 animate-in fade-in">
          <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-slate-900">Relatórios do estabelecimento</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Escolha o período. As simulações eletrónicas são apresentadas à parte e não contam como dinheiro recebido.
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-[11px] text-slate-600 font-semibold">
                  De
                  <input
                    type="date"
                    value={reportDates.start_date}
                    onChange={(e) => setReportDates({ ...reportDates, start_date: e.target.value })}
                    className="mt-1 block px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </label>
                <label className="text-[11px] text-slate-600 font-semibold">
                  Até
                  <input
                    type="date"
                    value={reportDates.end_date}
                    onChange={(e) => setReportDates({ ...reportDates, end_date: e.target.value })}
                    className="mt-1 block px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </label>
                <div className="flex gap-1">
                  <button type="button" onClick={() => setReportPreset('today')} className="px-2.5 py-2 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 rounded-lg">Hoje</button>
                  <button type="button" onClick={() => setReportPreset('7d')} className="px-2.5 py-2 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 rounded-lg">7 dias</button>
                  <button type="button" onClick={() => setReportPreset('month')} className="px-2.5 py-2 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 rounded-lg">Este mês</button>
                </div>
                <button
                  type="button"
                  onClick={() => loadReport()}
                  disabled={reportLoading}
                  className="px-4 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg cursor-pointer"
                >
                  {reportLoading ? 'A carregar...' : 'Gerar relatório'}
                </button>
                <button
                  type="button"
                  onClick={exportReportCsv}
                  disabled={!reportData}
                  className="inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 rounded-lg cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Exportar CSV
                </button>
              </div>
            </div>
          </section>

          {!reportData && !reportLoading ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-sm text-slate-500">
              Gere o relatório para consultar os resultados do período selecionado.
            </div>
          ) : reportLoading ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-sm text-slate-500">
              A carregar dados do relatório...
            </div>
          ) : (
            <>
              <div className="text-xs font-semibold text-slate-500">
                Período do relatório: {reportData.period.start_date} a {reportData.period.end_date}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Lavagens concluídas', value: reportData.summary.completedWashes, color: 'text-blue-700' },
                  { label: 'Marcações canceladas', value: reportData.summary.cancelledReservations, color: 'text-red-600' },
                  { label: 'Recebido (MT)', value: reportData.summary.receivedMzn, color: 'text-emerald-700' },
                  { label: 'Simulações (MT)', value: reportData.summary.simulatedMzn, color: 'text-amber-700' },
                  { label: 'Descontos (MT)', value: reportData.summary.discountsMzn, color: 'text-purple-700' },
                  { label: 'Pontos atribuídos', value: reportData.summary.pointsEarned, color: 'text-blue-700' },
                  { label: 'Pontos resgatados', value: reportData.summary.pointsRedeemed, color: 'text-amber-700' },
                  { label: 'Recompensas resgatadas', value: reportData.summary.rewardsRedeemed, color: 'text-slate-800' }
                ].map(metric => (
                  <div key={metric.label} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                    <div className="text-[11px] text-slate-500 font-semibold">{metric.label}</div>
                    <div className={`mt-1 text-2xl font-black ${metric.color}`}>
                      {Number(metric.value).toLocaleString('pt-MZ')}
                    </div>
                  </div>
                ))}
              </div>

              <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Serviços realizados</h3>
                  <p className="text-[11px] text-slate-500 mt-1">Valores agrupados pelas marcações concluídas no período selecionado.</p>
                </div>
                {reportData.services.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500">Não há lavagens concluídas neste período.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[680px] text-left text-xs">
                      <thead className="bg-slate-100 text-slate-600">
                        <tr>
                          <th className="p-3">Serviço</th>
                          <th className="p-3">Lavagens</th>
                          <th className="p-3">Valor bruto (MT)</th>
                          <th className="p-3">Descontos (MT)</th>
                          <th className="p-3">Recebido (MT)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {reportData.services.map(service => (
                          <tr key={service.id}>
                            <td className="p-3 font-semibold text-slate-800">{service.name}</td>
                            <td className="p-3">{service.completed_washes}</td>
                            <td className="p-3">{Number(service.gross_mzn).toLocaleString('pt-MZ')}</td>
                            <td className="p-3">{Number(service.discounts_mzn).toLocaleString('pt-MZ')}</td>
                            <td className="p-3 font-bold text-emerald-700">{Number(service.received_mzn).toLocaleString('pt-MZ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
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

                  <div className="flex items-center gap-2">
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
                    <button
                      onClick={() => handleDeletePromotion(p)}
                      aria-label={`Remover campanha ${p.title}`}
                      title="Remover campanha"
                      className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SETTINGS */}
      {activeTab === 'settings' && settings && (
        <div className="max-w-2xl space-y-6 animate-in fade-in">
          <section className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6">
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
          </section>

          <section className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900">Contas de Funcionários</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Crie acessos individuais. A palavra-passe é armazenada com hash e não poderá ser consultada depois.
                </p>
              </div>
            </div>

            {employeeError && (
              <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {employeeError}
              </div>
            )}
            {employeeSuccess && (
              <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {employeeSuccess}
              </div>
            )}

            <form onSubmit={handleCreateEmployee} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-slate-700">
                  Nome completo
                  <input
                    type="text"
                    autoComplete="name"
                    required
                    maxLength={120}
                    value={newEmployee.name}
                    onChange={event => setNewEmployee({ ...newEmployee, name: event.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                    placeholder="Nome do funcionário"
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Email de acesso
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={254}
                    value={newEmployee.email}
                    onChange={event => setNewEmployee({ ...newEmployee, email: event.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                    placeholder="funcionario@lavaja.co.mz"
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Contacto <span className="font-normal text-slate-400">(opcional)</span>
                  <input
                    type="tel"
                    autoComplete="tel"
                    maxLength={30}
                    value={newEmployee.phone}
                    onChange={event => setNewEmployee({ ...newEmployee, phone: event.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                    placeholder="+258 84..."
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Palavra-passe inicial
                  <span className="relative mt-1.5 block">
                    <input
                      type={showEmployeePassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      minLength={12}
                      maxLength={72}
                      value={newEmployee.password}
                      onChange={event => setNewEmployee({ ...newEmployee, password: event.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 pr-11 font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                      placeholder="Mínimo de 12 caracteres"
                    />
                    <button
                      type="button"
                      onClick={() => setShowEmployeePassword(visible => !visible)}
                      aria-label={showEmployeePassword ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                    >
                      {showEmployeePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </span>
                </label>
              </div>
              <p className="text-xs leading-5 text-slate-500">
                Defina uma palavra-passe única e partilhe-a diretamente com o funcionário. Recomende que a altere após o primeiro acesso.
              </p>
              <button
                type="submit"
                disabled={employeeSubmitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
              >
                <UserPlus className="h-4 w-4" />
                {employeeSubmitting ? 'A criar conta...' : 'Criar conta de funcionário'}
              </button>
            </form>

            <div className="border-t border-slate-100 pt-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">Funcionários registados</h3>
                <button
                  type="button"
                  onClick={loadEmployees}
                  disabled={employeesLoading}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 disabled:opacity-50"
                >
                  {employeesLoading ? 'A carregar...' : 'Atualizar lista'}
                </button>
              </div>
              {employeesLoading && employees.length === 0 ? (
                <p className="text-sm text-slate-500">A carregar funcionários...</p>
              ) : employees.length === 0 ? (
                <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Ainda não existem contas de funcionário.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {employees.map(employee => (
                    <li key={employee.id} className="py-4">
                      {editingEmployeeId === employee.id ? (
                        <form onSubmit={handleUpdateEmployee} className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="block text-xs font-semibold text-slate-700">
                              Nome
                              <input
                                type="text"
                                required
                                maxLength={120}
                                value={editingEmployee.name}
                                onChange={event => setEditingEmployee({ ...editingEmployee, name: event.target.value })}
                                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-blue-500"
                              />
                            </label>
                            <label className="block text-xs font-semibold text-slate-700">
                              Email
                              <input
                                type="email"
                                required
                                maxLength={254}
                                value={editingEmployee.email}
                                onChange={event => setEditingEmployee({ ...editingEmployee, email: event.target.value })}
                                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-blue-500"
                              />
                            </label>
                            <label className="block text-xs font-semibold text-slate-700 sm:col-span-2">
                              Contacto
                              <input
                                type="tel"
                                maxLength={30}
                                value={editingEmployee.phone}
                                onChange={event => setEditingEmployee({ ...editingEmployee, phone: event.target.value })}
                                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-blue-500"
                              />
                            </label>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="submit"
                              disabled={employeeSubmitting}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                            >
                              <Check className="h-3.5 w-3.5" />
                              Guardar
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingEmployeeId(null)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                            >
                              <X className="h-3.5 w-3.5" />
                              Cancelar
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-slate-800">{employee.name}</span>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                employee.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                              }`}>
                                {employee.is_active ? 'Ativo' : 'Desativado'}
                              </span>
                            </div>
                            <p className="mt-1 break-all text-sm text-slate-500">{employee.email}</p>
                            {employee.phone && <p className="mt-0.5 text-xs text-slate-400">{employee.phone}</p>}
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <button
                              type="button"
                              onClick={() => startEditingEmployee(employee)}
                              aria-label={`Editar perfil de ${employee.name}`}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleEmployeeStatus(employee)}
                              aria-label={`${employee.is_active ? 'Desativar' : 'Reativar'} conta de ${employee.name}`}
                              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold ${
                                employee.is_active
                                  ? 'border-red-200 text-red-600 hover:bg-red-50'
                                  : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                              }`}
                            >
                              <Power className="h-3.5 w-3.5" />
                              {employee.is_active ? 'Desativar' : 'Reativar'}
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
