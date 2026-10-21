import React, { useState, useEffect } from 'react';
import { Bell, CheckCheck, X, Car, Award, AlertCircle, Info } from 'lucide-react';
import { apiRequest } from '../api';
import { useAuth } from '../context/AuthContext';

export default function NotificationsDrawer({ isOpen, onClose }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      loadNotifications();
      const interval = window.setInterval(loadNotifications, 15000);
      return () => window.clearInterval(interval);
    }
  }, [isOpen, user]);

  async function loadNotifications() {
    try {
      setLoading(true);
      const data = await apiRequest('/notifications');
      setNotifications(data.notifications || []);
    } catch (err) {
      console.error('Erro ao carregar notificações:', err);
    } finally {
      setLoading(false);
    }
  }

  async function markAsRead(id) {
    try {
      await apiRequest(`/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    } catch (err) {
      console.error(err);
    }
  }

  async function markAllAsRead() {
    try {
      await apiRequest('/notifications/read-all', { method: 'POST' });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    } catch (err) {
      console.error(err);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col transform transition-transform duration-300">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-400" />
            <h3 className="font-semibold text-lg">Notificações do Sistema</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center text-xs text-slate-600">
          <span>{notifications.filter(n => !n.is_read).length} por ler</span>
          {notifications.length > 0 && (
            <button 
              onClick={markAllAsRead}
              className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
            >
              <CheckCheck className="w-4 h-4" /> Marcar todas como lidas
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="text-center py-8 text-slate-400 text-sm">A carregar notificações...</div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Bell className="w-10 h-10 mx-auto mb-2 text-slate-300 opacity-60" />
              <p className="text-sm">Sem notificações de momento.</p>
            </div>
          ) : (
            notifications.map((notif) => {
              const isUnread = !notif.is_read;
              return (
                <div
                  key={notif.id}
                  onClick={() => isUnread && markAsRead(notif.id)}
                  className={`p-3.5 rounded-xl border text-sm transition-all cursor-pointer ${
                    isUnread
                      ? 'bg-blue-50/70 border-blue-200 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                      {notif.type === 'success' && <Award className="w-4 h-4 text-emerald-500" />}
                      {notif.type === 'alert' && <AlertCircle className="w-4 h-4 text-amber-500" />}
                      {notif.type === 'info' && <Info className="w-4 h-4 text-blue-500" />}
                      {notif.title}
                    </div>
                    {isUnread && (
                      <span className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 shrink-0"></span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">{notif.message}</p>
                  <div className="mt-2 text-[10px] text-slate-400 flex justify-between items-center">
                    <span>{new Date(notif.created_at).toLocaleString('pt-PT')}</span>
                    {isUnread && <span className="text-blue-600 font-medium">Clique para marcar lida</span>}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
