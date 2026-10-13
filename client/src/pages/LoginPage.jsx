import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Car, Lock, Mail, User, Phone, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login, register, quickSwitchDemo } = useAuth();
  const navigate = useNavigate();

  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        await register(name, email, password, phone);
        navigate('/cliente');
      } else {
        const u = await login(email, password);
        if (u.role === 'admin') navigate('/admin');
        else if (u.role === 'employee') navigate('/funcionario');
        else navigate('/cliente');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDemoLogin(role) {
    setLoading(true);
    setError('');
    try {
      const u = await quickSwitchDemo(role);
      if (role === 'admin') navigate('/admin');
      else if (role === 'employee') navigate('/funcionario');
      else navigate('/cliente');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-12 space-y-6">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white mx-auto shadow-md">
          <Car className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          {isRegister ? 'Criar Conta no Lava Já AI' : 'Iniciar Sessão'}
        </h1>
        <p className="text-xs text-slate-500">
          {isRegister
            ? 'Ao criar a conta, recebe 10 pontos. Ganhe mais 10 a cada 3 semanas depois da primeira lavagem concluída.'
            : 'Aceda ao seu histórico de lavagens e ao Passaporte de Fidelização.'}
        </p>
      </div>

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Auth Form */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xl space-y-5">
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {isRegister && (
            <div>
              <label className="text-slate-700 font-semibold mb-1 block">Nome Completo</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  placeholder="Ex: Armando Sitoe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-slate-700 font-semibold mb-1 block">Endereço de Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="email"
                required
                placeholder="Ex: cliente@lavaja.co.mz"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="text-slate-700 font-semibold mb-1 block">Palavra-passe</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="password"
                required
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {isRegister && (
            <div>
              <label className="text-slate-700 font-semibold mb-1 block">Contacto Telefónico</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="+258 84..."
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>{isRegister ? 'Criar Conta (ganhe 10 a 40 pts por serviço)' : 'Entrar na Plataforma'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="text-center pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setIsRegister(!isRegister)}
            className="text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
          >
            {isRegister ? 'Já tem conta? Entrar aqui' : 'Não tem conta? Criar conta gratuita'}
          </button>
        </div>
      </div>

      {/* Quick Demo Access */}
      <div className="bg-slate-100/90 rounded-2xl p-5 border border-slate-200 space-y-3">
        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">
          Acesso Rápido de Demonstração (Lava Já Matola)
        </div>
        <div className="grid grid-cols-1 gap-2 text-xs">
          <button
            type="button"
            onClick={() => handleDemoLogin('customer')}
            className="w-full p-2.5 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-xl font-medium text-slate-800 flex justify-between items-center transition-colors cursor-pointer"
          >
            <span>👤 Cliente Demo (Inácio Cumbane)</span>
            <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-mono font-bold">Demo</span>
          </button>

          <button
            type="button"
            onClick={() => handleDemoLogin('employee')}
            className="w-full p-2.5 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-xl font-medium text-slate-800 flex justify-between items-center transition-colors cursor-pointer"
          >
            <span>🔧 Funcionário Demo (Carlos Matsinhe)</span>
            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-mono font-bold">Operador</span>
          </button>

          <button
            type="button"
            onClick={() => handleDemoLogin('admin')}
            className="w-full p-2.5 bg-white hover:bg-purple-50 border border-slate-200 hover:border-purple-300 rounded-xl font-medium text-slate-800 flex justify-between items-center transition-colors cursor-pointer"
          >
            <span>👑 Gestor / Administrador Demo</span>
            <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-mono font-bold">Gestor</span>
          </button>
        </div>
      </div>
    </div>
  );
}
