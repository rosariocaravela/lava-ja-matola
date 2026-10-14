import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

import Navbar from './components/Navbar';
import Footer from './components/Footer';
import AiAssistantModal from './components/AiAssistantModal';
import NotificationsDrawer from './components/NotificationsDrawer';

import HomePage from './pages/HomePage';
import BookingPage from './pages/BookingPage';
import QueuePage from './pages/QueuePage';
import LoyaltyPage from './pages/LoyaltyPage';
import CustomerDashboard from './pages/CustomerDashboard';
import EmployeeDashboard from './pages/EmployeeDashboard';
import AdminDashboard from './pages/AdminDashboard';
import LoginPage from './pages/LoginPage';
import AccountSecurityPage from './pages/AccountSecurityPage';
import { Bot, Sparkles } from 'lucide-react';

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="text-center py-20 text-slate-400 text-sm">A carregar perfil...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="max-w-md mx-auto my-20 p-6 bg-red-50 border border-red-200 rounded-2xl text-center space-y-2">
        <h2 className="font-bold text-base text-red-800">Acesso Não Autorizado</h2>
        <p className="text-xs text-red-600">
          O seu perfil ({user.role}) não tem permissão para aceder a este módulo.
        </p>
      </div>
    );
  }

  return children;
}

function MainLayout() {
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const location = useLocation();
  const { user, loading } = useAuth();

  if (location.pathname === '/login') {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-900 selection:bg-blue-600 selection:text-white">
        <LoginPage />
      </main>
    );
  }

  if (!loading && user?.must_change_password && location.pathname !== '/seguranca') {
    return <Navigate to="/seguranca" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-blue-600 selection:text-white">
      <Navbar 
        onOpenAi={() => setIsAiOpen(true)} 
        onOpenNotifications={() => setIsNotifOpen(true)} 
      />

      <main className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage onOpenAi={() => setIsAiOpen(true)} />} />
          <Route path="/reservar" element={<BookingPage />} />
          <Route path="/fila" element={<QueuePage />} />
          <Route path="/fidelizacao" element={<LoyaltyPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/seguranca"
            element={
              <ProtectedRoute>
                <AccountSecurityPage />
              </ProtectedRoute>
            }
          />

          {/* Protected Dashboards */}
          <Route
            path="/cliente"
            element={
              <ProtectedRoute allowedRoles={['customer']}>
                <CustomerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/funcionario"
            element={
              <ProtectedRoute allowedRoles={['employee', 'admin']}>
                <EmployeeDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <Footer />

      {/* Floating AI Bubble in Bottom Right */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setIsAiOpen(true)}
          className="group relative flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer border border-white/20"
          title="Assistente Lava Já Matola"
        >
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400"></span>
          </span>
          <Bot className="w-5 h-5 text-blue-100" />
          <span className="text-xs font-bold hidden sm:inline">Assistente Lava Já Matola</span>
          <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full font-bold">IA</span>
        </button>
      </div>

      {/* Modals & Drawers */}
      <AiAssistantModal isOpen={isAiOpen} onClose={() => setIsAiOpen(false)} />
      <NotificationsDrawer isOpen={isNotifOpen} onClose={() => setIsNotifOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <MainLayout />
      </AuthProvider>
    </BrowserRouter>
  );
}
