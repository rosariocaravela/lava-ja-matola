import React, { useState } from 'react';
import { KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../api';
import { useAuth } from '../context/AuthContext';

export default function AccountSecurityPage() {
  const { user, refreshProfile } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('A confirmação não corresponde à nova palavra-passe.');
      return;
    }

    setLoading(true);
    try {
      const result = await apiRequest('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword })
      });
      await refreshProfile();
      setSuccess(result.message);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-12">
      <section className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xl space-y-6">
        <div className="space-y-2">
          <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center">
            <KeyRound className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-black text-slate-900">Segurança da conta</h1>
          <p className="text-sm text-slate-500">
            {user?.must_change_password
              ? 'Antes de continuar, defina uma nova palavra-passe pessoal. Utilize pelo menos 12 caracteres.'
              : 'Atualize a sua palavra-passe. Utilize pelo menos 12 caracteres e não a partilhe.'}
          </p>
        </div>

        {error && (
          <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div role="status" className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-semibold text-slate-700">
            Palavra-passe atual
            <input
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={event => setCurrentPassword(event.target.value)}
              className="mt-1 w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Nova palavra-passe
            <input
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
              value={newPassword}
              onChange={event => setNewPassword(event.target.value)}
              className="mt-1 w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Confirmar nova palavra-passe
            <input
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
              value={confirmPassword}
              onChange={event => setConfirmPassword(event.target.value)}
              className="mt-1 w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-colors"
          >
            {loading ? 'A atualizar...' : 'Atualizar palavra-passe'}
          </button>
        </form>
        {success && !user?.must_change_password && (
          <Link
            to={user?.role === 'admin' ? '/admin' : user?.role === 'employee' ? '/funcionario' : '/cliente'}
            className="block w-full rounded-xl bg-blue-600 py-3 text-center text-sm font-bold text-white transition hover:bg-blue-700"
          >
            Continuar para a minha área
          </Link>
        )}
      </section>
    </main>
  );
}
