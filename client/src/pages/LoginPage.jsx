import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Car, Lock, Mail, User, Phone, ArrowRight, AlertCircle, Eye, EyeOff, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
        if (u.must_change_password) navigate('/seguranca');
        else if (u.role === 'admin') navigate('/admin');
        else if (u.role === 'employee') navigate('/funcionario');
        else navigate('/cliente');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 px-4 py-6 sm:px-8 lg:px-12">
      <div className="pointer-events-none absolute -left-40 top-[-12rem] h-[34rem] w-[34rem] rounded-full bg-blue-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 bottom-[-14rem] h-[38rem] w-[38rem] rounded-full bg-indigo-600/20 blur-3xl" />

      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl flex-col">
        <header className="flex items-center justify-between py-3">
          <Link to="/" className="group inline-flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-950/40 transition-transform group-hover:-rotate-6">
              <Car className="h-6 w-6" />
            </span>
            <span>
              <span className="block text-lg font-black tracking-tight text-white">Lava Já <span className="text-blue-400">Matola</span></span>
              <span className="block text-xs text-slate-400">Lavagem rápida e de confiança</span>
            </span>
          </Link>
          <Link to="/" className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-white/25 hover:bg-white/5 hover:text-white">
            Voltar ao início
          </Link>
        </header>

        <div className="grid flex-1 items-center gap-10 py-8 lg:grid-cols-[1fr_0.9fr] lg:gap-20 lg:py-12">
          <section className="hidden text-white lg:block">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1.5 text-xs font-semibold text-blue-200">
              <Sparkles className="h-3.5 w-3.5" />
              A sua experiência Lava Já
            </div>
            <h1 className="max-w-xl text-5xl font-black leading-[1.08] tracking-tight xl:text-6xl">
              Mais tempo para si. <span className="bg-gradient-to-r from-blue-400 to-indigo-300 bg-clip-text text-transparent">O seu carro tratado com cuidado.</span>
            </h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-slate-400">
              Entre na sua conta para acompanhar as marcações, consultar o histórico e gerir os benefícios do Passaporte VIP.
            </p>

            <div className="mt-10 grid max-w-lg grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300">
                  <Car className="h-4 w-4" />
                </div>
                <p className="text-sm font-bold">Acompanhe as lavagens</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">Consulte o estado dos seus agendamentos.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-300">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <p className="text-sm font-bold">Conta protegida</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">Aceda com as suas credenciais pessoais.</p>
              </div>
            </div>
          </section>

          <section className="mx-auto w-full max-w-md">
            <div className="rounded-[2rem] border border-white/70 bg-white p-6 shadow-[0_30px_100px_-35px_rgba(37,99,235,0.45)] sm:p-9">
              <div className="mb-7">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
                  {isRegister ? 'Junte-se a nós' : 'Bem-vindo de volta'}
                </p>
                <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
                  {isRegister ? 'Criar conta' : 'Iniciar sessão'}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {isRegister
                    ? 'Crie a sua conta de cliente para marcar serviços e acompanhar os seus pontos.'
                    : 'Aceda à sua conta com o email e a palavra-passe.'}
                </p>
              </div>

              {error && (
                <div role="alert" className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {isRegister && (
                  <div>
                    <label htmlFor="login-name" className="mb-1.5 block text-sm font-semibold text-slate-700">Nome completo</label>
                    <div className="relative">
                      <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        id="login-name"
                        type="text"
                        autoComplete="name"
                        required
                        placeholder="Ex.: Armando Sitoe"
                        value={name}
                        onChange={event => setName(event.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="login-email" className="mb-1.5 block text-sm font-semibold text-slate-700">Endereço de email</label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      required
                      placeholder="nome@exemplo.com"
                      value={email}
                      onChange={event => setEmail(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-1.5">
                    <label htmlFor="login-password" className="block text-sm font-semibold text-slate-700">Palavra-passe</label>
                  </div>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={isRegister ? 'new-password' : 'current-password'}
                      minLength={isRegister ? 6 : undefined}
                      required
                      placeholder={isRegister ? 'Pelo menos 6 caracteres' : 'Introduza a sua palavra-passe'}
                      value={password}
                      onChange={event => setPassword(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(value => !value)}
                      aria-label={showPassword ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {isRegister && (
                  <div>
                    <label htmlFor="login-phone" className="mb-1.5 block text-sm font-semibold text-slate-700">Contacto telefónico <span className="font-normal text-slate-400">(opcional)</span></label>
                    <div className="relative">
                      <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        id="login-phone"
                        type="tel"
                        autoComplete="tel"
                        placeholder="+258 84..."
                        value={phone}
                        onChange={event => setPhone(event.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="group mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 hover:from-blue-500 hover:to-indigo-500 hover:shadow-blue-600/30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/30 disabled:translate-y-0 disabled:cursor-wait disabled:opacity-60"
                >
                  <span>{loading ? 'A processar...' : isRegister ? 'Criar conta de cliente' : 'Entrar na minha conta'}</span>
                  {!loading && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}
                </button>
              </form>

              <div className="mt-6 border-t border-slate-100 pt-5 text-center">
                <p className="text-sm text-slate-500">
                  {isRegister ? 'Já tem uma conta?' : 'Ainda não tem conta?'}{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegister(value => !value);
                      setError('');
                    }}
                    className="font-bold text-blue-600 transition hover:text-blue-800"
                  >
                    {isRegister ? 'Iniciar sessão' : 'Criar conta gratuita'}
                  </button>
                </p>
              </div>
            </div>
            <p className="mt-5 text-center text-xs text-slate-500">
              Ao continuar, os seus dados são tratados de acordo com a segurança da sua conta.
            </p>
          </section>
        </div>

        <footer className="py-4 text-center text-xs text-slate-500">
          © 2026 Lava Já Matola · Matola, Moçambique
        </footer>
      </div>
    </div>
  );
}
