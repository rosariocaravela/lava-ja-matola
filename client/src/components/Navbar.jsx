import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Sparkles, Car, Calendar, Users, Award, Shield, Clock, 
  Bell, LogIn, LogOut, Bot, Menu, X, KeyRound
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api';

export default function Navbar({ onOpenAi, onOpenNotifications }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user) {
      loadUnreadCount();
      const interval = setInterval(loadUnreadCount, 15000);
      return () => clearInterval(interval);
    }
  }, [user]);

  async function loadUnreadCount() {
    try {
      const data = await apiRequest('/notifications');
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      // silent
    }
  }

  function handleLogout() {
    logout();
    setMobileMenuOpen(false);
    navigate('/');
  }

  const navLinks = [
    { to: '/', label: 'Início' },
    { to: '/reservar', label: 'Marcar Lavagem' },
    { to: '/fila', label: 'Veículos Prontos' },
    { to: '/fidelizacao', label: 'Passaporte VIP' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-white">
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 px-4 py-1 text-xs text-white">
        <div className="flex items-center gap-2">
          <span className="font-semibold tracking-wide uppercase text-[10px] bg-white/20 px-2 py-0.5 rounded">Lava Já Matola</span>
          <span className="hidden sm:inline text-blue-100">Lavagem rápida e de confiança • Matola, Moçambique</span>
        </div>
      </div>

      {/* Main Nav */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform">
            <Car className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-black text-xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-blue-300 bg-clip-text text-transparent">
                Lava Já
              </span>
              <span className="px-1.5 py-0.2 bg-blue-500 text-white text-[11px] font-extrabold rounded-md shadow-xs">
                Matola
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium tracking-wide">Lavagem rápida e de confiança</p>
          </div>
        </Link>

        {/* Desktop Links */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => {
            const active = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-blue-600/30 text-blue-400 border border-blue-500/40'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* AI Trigger */}
          <button
            onClick={onOpenAi}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md cursor-pointer transition-all hover:scale-102"
          >
            <Bot className="w-4 h-4 text-blue-200" />
            <span className="hidden sm:inline">Assistente IA</span>
          </button>

          {/* Notifications */}
          {user && (
            <button
              onClick={onOpenNotifications}
              className="relative p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title="Notificações"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>
          )}

          {/* User Session */}
          {user ? (
            <div className="flex items-center gap-2">
              <Link
                to={user.role === 'admin' ? '/admin' : user.role === 'employee' ? '/funcionario' : '/cliente'}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs text-slate-200 transition-colors"
              >
                <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs uppercase">
                  {user.name[0]}
                </div>
                <div className="hidden lg:block text-left">
                  <div className="font-semibold truncate max-w-[110px]">{user.name.split(' ')[0]}</div>
                  <div className="text-[10px] text-blue-400 capitalize">{user.role === 'customer' ? 'Cliente' : user.role === 'employee' ? 'Funcionário' : 'Gestor'}</div>
                </div>
              </Link>
              <Link
                to="/seguranca"
                className="p-2 text-slate-400 hover:text-blue-300 hover:bg-slate-800 rounded-xl transition-colors"
                title="Alterar palavra-passe"
                aria-label="Alterar palavra-passe"
              >
                <KeyRound className="w-4 h-4" />
              </Link>
              <button
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                title="Terminar Sessão"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white text-slate-900 hover:bg-slate-100 rounded-xl text-xs font-bold transition-all shadow-xs"
            >
              <LogIn className="w-4 h-4 text-blue-600" />
              <span>Entrar</span>
            </Link>
          )}

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-slate-950 border-b border-slate-800 px-4 py-3 space-y-2">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-medium text-slate-200 hover:bg-slate-800"
            >
              {link.label}
            </Link>
          ))}
          {user && (
            <Link
              to={user.role === 'admin' ? '/admin' : user.role === 'employee' ? '/funcionario' : '/cliente'}
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-medium text-blue-400 bg-slate-900 border border-slate-800"
            >
              Ir para o meu Painel ({user.role})
            </Link>
          )}
          {user && (
            <Link
              to="/seguranca"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-200 hover:bg-slate-800"
            >
              <KeyRound className="w-4 h-4" />
              Alterar palavra-passe
            </Link>
          )}
          {user ? (
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-red-300 hover:bg-slate-800"
            >
              <LogOut className="w-4 h-4" />
              Terminar Sessão
            </button>
          ) : (
            <Link
              to="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-blue-300 hover:bg-slate-800"
            >
              <LogIn className="w-4 h-4" />
              Entrar
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
