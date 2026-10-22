import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, KeyRound, Mail } from 'lucide-react';
import { apiRequest } from '../api';

export default function PasswordRecoveryPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (token && password !== confirmation) {
      setError('As palavras-passe não coincidem.');
      return;
    }

    setLoading(true);
    try {
      const result = token
        ? await apiRequest('/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({ token, newPassword: password })
        })
        : await apiRequest('/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ email })
        });
      setMessage(result.message);
      if (token) {
        setPassword('');
        setConfirmation('');
      }
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-10">
      <div className="pointer-events-none absolute -left-40 top-[-12rem] h-[34rem] w-[34rem] rounded-full bg-blue-600/20 blur-3xl" />
      <section className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-9">
        <Link to="/login" className="inline-flex items-center gap-2 text-xs font-bold text-blue-700 hover:text-blue-900">
          <ArrowLeft className="h-4 w-4" />
          Voltar ao início de sessão
        </Link>
        <div className="mt-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
          {token ? <KeyRound className="h-6 w-6" /> : <Mail className="h-6 w-6" />}
        </div>
        <h1 className="mt-4 text-2xl font-black text-slate-900">
          {token ? 'Criar nova palavra-passe' : 'Recuperar acesso'}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          {token
            ? 'O link é válido por 30 minutos. Escolha uma palavra-passe com pelo menos 12 caracteres.'
            : 'Introduza o email da sua conta. Se estiver registado, enviaremos um link de redefinição.'}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {!token ? (
            <label className="block text-sm font-semibold text-slate-700">
              Email
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                placeholder="nome@exemplo.com"
              />
            </label>
          ) : (
            <>
              <label className="block text-sm font-semibold text-slate-700">
                Nova palavra-passe
                <input
                  type="password"
                  required
                  minLength={12}
                  maxLength={72}
                  autoComplete="new-password"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Confirmar palavra-passe
                <input
                  type="password"
                  required
                  minLength={12}
                  maxLength={72}
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={event => setConfirmation(event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                />
              </label>
            </>
          )}
          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {message && (
            <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              {message}
              {token && <Link to="/login" className="ml-1 font-bold underline">Iniciar sessão</Link>}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-800 disabled:cursor-wait disabled:opacity-60"
          >
            {loading ? 'A processar...' : token ? 'Redefinir palavra-passe' : 'Enviar link de recuperação'}
          </button>
        </form>
      </section>
    </div>
  );
}
