import React, { useState, useEffect } from 'react';
import { Award, Gift, Sparkles, CheckCircle2, Clock, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { apiRequest } from '../api';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

export default function LoyaltyPage() {
  const { user, refreshProfile } = useAuth();
  const [loyaltyData, setLoyaltyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [redeemSuccess, setRedeemSuccess] = useState(null);
  const [redeemError, setRedeemError] = useState('');
  const [redeemingId, setRedeemingId] = useState(null);

  useEffect(() => {
    loadLoyaltyData();
  }, [user]);

  async function loadLoyaltyData() {
    try {
      setLoading(true);
      if (user) {
        const data = await apiRequest('/loyalty/me');
        setLoyaltyData(data);
      } else {
        const rewards = await apiRequest('/loyalty/rewards');
        setLoyaltyData({ availableRewards: rewards, balance_points: 0, lifetime_points: 0, transactions: [], redemptions: [] });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRedeem(reward) {
    if (!user) {
      alert('Por favor entre na sua conta para resgatar recompensas.');
      return;
    }

    if (!window.confirm(`Deseja resgatar "${reward.title}" por ${reward.points_cost} pontos?`)) {
      return;
    }

    setRedeemError('');
    setRedeemSuccess(null);
    setRedeemingId(reward.id);

    try {
      const res = await apiRequest('/loyalty/redeem', {
        method: 'POST',
        body: JSON.stringify({ reward_id: reward.id })
      });

      setRedeemSuccess({
        rewardTitle: reward.title,
        code: res.redemptionCode,
        newBalance: res.newBalance
      });

      await loadLoyaltyData();
      await refreshProfile();
    } catch (err) {
      setRedeemError(err.message);
    } finally {
      setRedeemingId(null);
    }
  }

  const balance = loyaltyData?.balance_points || 0;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-8 sm:p-10 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-xs font-bold border border-amber-400/30">
            <Award className="w-3.5 h-3.5" />
            <span>Passaporte Lava Já VIP</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
            As suas lavagens geram recompensas reais
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Receba 10 pontos ao criar a conta, ganhe 10 a 40 por lavagem e mais 10 pontos a cada 3 semanas após a primeira lavagem concluída. As recompensas começam nos 50 pontos.
          </p>
        </div>

        {/* User points widget */}
        <div className="mt-6 pt-6 border-t border-slate-700/80 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black text-xl shadow-lg">
              ★
            </div>
            <div>
              <div className="text-xs text-slate-400 uppercase font-semibold">Saldo Atual de Pontos</div>
              <div className="text-3xl font-black text-amber-300 tracking-tight">
                {balance} <span className="text-sm font-semibold text-white">pontos</span>
              </div>
            </div>
          </div>

          {!user ? (
            <Link
              to="/login"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-all shadow-md"
            >
              Iniciar Sessão para Acumular
            </Link>
          ) : (
            <div className="text-xs text-slate-300 bg-white/10 px-4 py-2 rounded-xl backdrop-blur-xs border border-white/10">
              Pontos Acumulados na Vida: <strong>{loyaltyData?.lifetime_points || 0} pts</strong>
            </div>
          )}
        </div>
      </div>

      {/* Success notification after redemption */}
      {redeemSuccess && (
        <div className="p-5 bg-emerald-50 border border-emerald-300 rounded-2xl text-emerald-900 shadow-md space-y-2 animate-in fade-in">
          <div className="flex items-center gap-2 font-black text-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>Recompensa Resgatada com Sucesso!</span>
          </div>
          <p className="text-xs text-emerald-800">
            Resgatou <strong>{redeemSuccess.rewardTitle}</strong>. O seu novo saldo é de <strong>{redeemSuccess.newBalance} pontos</strong>.
          </p>
          <div className="p-3 bg-white border border-emerald-200 rounded-xl inline-block mt-2">
            <div className="text-[10px] text-slate-500 uppercase font-semibold">Código do Voucher</div>
            <div className="text-xl font-mono font-black text-emerald-700 tracking-widest">{redeemSuccess.code}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Apresente este código no car wash ao pagar.</div>
          </div>
        </div>
      )}

      {redeemError && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-2xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{redeemError}</span>
        </div>
      )}

      {/* Available Rewards Grid */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Catálogo de Benefícios Disponíveis</h2>
            <p className="text-xs text-slate-500">Selecione uma recompensa para resgatar com os seus pontos.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {loyaltyData?.availableRewards?.map((reward) => {
            const hasEnough = balance >= reward.points_cost;
            const pointsNeeded = reward.points_cost - balance;

            return (
              <div
                key={reward.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow"
              >
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <span className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs">
                      <Gift className="w-4 h-4" />
                    </span>
                    <span className="font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full text-xs font-mono">
                      {reward.points_cost} pts
                    </span>
                  </div>

                  <h3 className="font-bold text-sm text-slate-900 mb-1.5 leading-snug">
                    {reward.title}
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed mb-4">
                    {reward.description || 'Benefício exclusivo para clientes do Passaporte Lava Já.'}
                  </p>
                </div>

                <div>
                  <button
                    onClick={() => handleRedeem(reward)}
                    disabled={!hasEnough || redeemingId === reward.id}
                    className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      hasEnough
                        ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-xs'
                        : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                    }`}
                  >
                    {hasEnough ? (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Resgatar Recompensa</span>
                      </>
                    ) : (
                      <span>Faltam {pointsNeeded} pts</span>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* User's Redeemed Vouchers */}
      {user && loyaltyData?.redemptions && loyaltyData.redemptions.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
            Meus Vouchers Resgatados
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {loyaltyData.redemptions.map((red) => (
              <div
                key={red.id}
                className={`p-4 rounded-xl border text-xs ${
                  red.status === 'disponivel'
                    ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
                    : 'bg-slate-50 border-slate-200 text-slate-500 opacity-70'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold text-slate-900">{red.reward_title}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    red.status === 'disponivel' ? 'bg-emerald-200 text-emerald-800' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {red.status}
                  </span>
                </div>
                <div className="text-lg font-mono font-black text-slate-900 my-1">
                  {red.redemption_code}
                </div>
                <div className="text-[10px] text-slate-500">
                  Resgatado em {new Date(red.created_at).toLocaleDateString('pt-PT')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Points Transactions History */}
      {user && loyaltyData?.transactions && loyaltyData.transactions.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
            Histórico de Movimentos de Pontos
          </h2>
          <div className="divide-y divide-slate-100 text-xs">
            {loyaltyData.transactions.map((tx) => (
              <div key={tx.id} className="py-2.5 flex justify-between items-center">
                <div>
                  <div className="font-semibold text-slate-800">{tx.description}</div>
                  <div className="text-[10px] text-slate-400">
                    {new Date(tx.created_at).toLocaleString('pt-PT')}
                  </div>
                </div>
                <span className={`font-mono font-bold text-sm ${
                  tx.type === 'earn' ? 'text-emerald-600' : 'text-red-500'
                }`}>
                  {tx.type === 'earn' ? `+${tx.points}` : `-${tx.points}`} pts
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
