import React, { useState, useEffect } from 'react';
import { Award, Gift, Sparkles, CheckCircle2, AlertCircle, TicketCheck } from 'lucide-react';
import { apiRequest } from '../api';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

const REDEMPTION_STATUS_LABELS = {
  disponivel: 'Disponível',
  utilizado: 'Utilizado',
  expirado: 'Expirado'
};

const REDEMPTION_STATUS_STYLES = {
  disponivel: 'bg-emerald-50 border-emerald-300 text-emerald-950',
  utilizado: 'bg-slate-50 border-slate-200 text-slate-600',
  expirado: 'bg-rose-50 border-rose-200 text-rose-800'
};

export default function LoyaltyPage() {
  const { user, refreshProfile } = useAuth();
  const isCustomer = user?.role === 'customer';
  const [loyaltyData, setLoyaltyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [redeemSuccess, setRedeemSuccess] = useState(null);
  const [redeemError, setRedeemError] = useState('');
  const [redeemingId, setRedeemingId] = useState(null);

  useEffect(() => {
    loadLoyaltyData();
  }, [isCustomer]);

  async function loadLoyaltyData() {
    try {
      setLoading(true);
      if (isCustomer) {
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
    if (!isCustomer) {
      alert(user
        ? 'O resgate de recompensas está disponível apenas para contas de cliente.'
        : 'Por favor entre na sua conta de cliente para resgatar recompensas.');
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

  const balance = isCustomer ? loyaltyData?.balance_points || 0 : 0;

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
            Cada lavagem aproxima-o de uma recompensa
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Junte pontos com as suas lavagens e troque-os por serviços ou descontos. Cada cartão mostra o benefício e quantos pontos são necessários.
          </p>
        </div>

        {/* User points widget */}
        <div className="mt-6 pt-6 border-t border-slate-700/80 flex flex-wrap items-center justify-between gap-4">
          {isCustomer ? (
            <>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black text-xl shadow-lg">
                  ★
                </div>
                <div>
                  <div className="text-xs text-slate-400 uppercase font-semibold">Os seus pontos disponíveis</div>
                  <div className="text-3xl font-black text-amber-300 tracking-tight">
                    {balance} <span className="text-sm font-semibold text-white">pontos</span>
                  </div>
                </div>
              </div>
              <div className="text-xs text-slate-300 bg-white/10 px-4 py-2 rounded-xl backdrop-blur-xs border border-white/10">
                Total acumulado: <strong>{loyaltyData?.lifetime_points || 0} pts</strong>
              </div>
            </>
          ) : !user ? (
            <Link
              to="/login"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-all shadow-md"
            >
              Entre como cliente para acumular pontos
            </Link>
          ) : (
            <div className="text-xs text-slate-200 bg-white/10 px-4 py-3 rounded-xl border border-white/10">
              Este catálogo é para clientes. Os pontos são acumulados na conta do cliente após cada lavagem concluída.
            </div>
          )}
        </div>
      </div>

      {/* Success notification after redemption */}
      {isCustomer && redeemSuccess && (
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
            <div className="text-[10px] text-slate-500 mt-1">Apresente-o no balcão antes do pagamento. O voucher só pode ser utilizado uma vez.</div>
          </div>
        </div>
      )}

      {isCustomer && redeemError && (
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
            <p className="text-xs text-slate-500">Veja o benefício incluído e o custo em pontos antes de resgatar.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {loyaltyData?.availableRewards?.map((reward) => {
            const hasEnough = isCustomer && balance >= reward.points_cost;
            const pointsNeeded = reward.points_cost - balance;
            const progress = isCustomer
              ? Math.min(100, Math.round((balance / reward.points_cost) * 100))
              : 0;
            const isServiceBenefit = reward.benefit_type === 'service';

            return (
              <div
                key={reward.id}
                className="group bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden hover:-translate-y-0.5 hover:shadow-lg transition-all"
              >
                <div className={`h-1.5 ${isServiceBenefit ? 'bg-amber-400' : 'bg-emerald-500'}`} />
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                      isServiceBenefit ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'
                    }`}>
                      {isServiceBenefit ? <Gift className="h-3.5 w-3.5" /> : <Award className="h-3.5 w-3.5" />}
                      {isServiceBenefit ? 'Serviço incluído' : 'Desconto em dinheiro'}
                    </span>
                    <span className="shrink-0 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-black text-white">
                      {reward.points_cost} <span className="font-semibold text-amber-300">pts</span>
                    </span>
                  </div>

                  <h3 className="mt-4 font-black text-base leading-snug text-slate-900">
                    {reward.title}
                  </h3>
                  <p className="mt-2 min-h-10 text-xs leading-relaxed text-slate-600">
                    {reward.description || 'Benefício exclusivo para clientes do Passaporte Lava Já.'}
                  </p>

                  <div className={`mt-4 rounded-xl border p-3 ${
                    isServiceBenefit ? 'border-amber-200 bg-amber-50/70' : 'border-emerald-200 bg-emerald-50/70'
                  }`}>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      {isServiceBenefit ? 'O que recebe' : 'Desconto aplicado'}
                    </div>
                    <div className={`mt-1 text-sm font-black ${
                      isServiceBenefit ? 'text-amber-950' : 'text-emerald-900'
                    }`}>
                      {isServiceBenefit
                        ? reward.service_name || reward.title
                        : `Até ${Number(reward.discount_mzn).toLocaleString('pt-MZ')} MT`}
                    </div>
                    {isServiceBenefit && reward.service_name && (
                      <div className="mt-1 text-[11px] text-slate-600">Válido para: {reward.service_name}</div>
                    )}
                    {isServiceBenefit && reward.discount_mzn > 0 && (
                      <div className="mt-1 text-[10px] leading-relaxed text-slate-500">
                        Valor de referência: {Number(reward.discount_mzn).toLocaleString('pt-MZ')} MT — não é dinheiro nem desconto.
                      </div>
                    )}
                  </div>

                  <div className="mt-auto pt-5">
                  <button
                    onClick={() => handleRedeem(reward)}
                    disabled={!isCustomer || !hasEnough || redeemingId === reward.id}
                    className={`w-full rounded-xl px-3 py-3 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
                      hasEnough && isCustomer
                        ? 'bg-amber-400 text-slate-950 shadow-sm hover:bg-amber-300 cursor-pointer'
                        : 'bg-slate-100 text-slate-500 border border-slate-200 cursor-not-allowed'
                    }`}
                  >
                    {isCustomer && hasEnough ? (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{redeemingId === reward.id ? 'A resgatar...' : `Resgatar por ${reward.points_cost} pontos`}</span>
                      </>
                    ) : !user ? (
                      <span>Entre para resgatar</span>
                    ) : !isCustomer ? (
                      <span>Exclusivo para clientes</span>
                    ) : (
                      <span>Faltam {pointsNeeded} pontos</span>
                    )}
                  </button>

                  {isCustomer && (
                    <div className="mt-3">
                      <div className="mb-1.5 flex justify-between text-[10px] font-semibold text-slate-500">
                        <span>Seu progresso</span>
                        <span>{Math.min(balance, reward.points_cost)} / {reward.points_cost} pts</span>
                      </div>
                      <div
                        role="progressbar"
                        aria-label={`Progresso para ${reward.title}`}
                        aria-valuemin="0"
                        aria-valuemax={reward.points_cost}
                        aria-valuenow={Math.min(balance, reward.points_cost)}
                        className="h-2 overflow-hidden rounded-full bg-slate-100"
                      >
                        <div
                          className="h-full rounded-full bg-amber-400 transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* User's Redeemed Vouchers */}
      {isCustomer && loyaltyData?.redemptions && loyaltyData.redemptions.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <TicketCheck className="h-4 w-4 text-emerald-600" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
              Meus Vouchers Resgatados
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {loyaltyData.redemptions.map((red) => (
              <div
                key={red.id}
                className={`p-4 rounded-xl border text-xs ${REDEMPTION_STATUS_STYLES[red.status] || REDEMPTION_STATUS_STYLES.utilizado}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold text-slate-900">{red.reward_title}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/80">
                    {REDEMPTION_STATUS_LABELS[red.status] || red.status}
                  </span>
                </div>
                {red.reward_description && (
                  <p className="text-[11px] leading-relaxed text-slate-600">{red.reward_description}</p>
                )}
                {red.reward_service_name && (
                  <div className="mt-2 text-[11px] font-semibold text-blue-800">
                    Válido para: {red.reward_service_name}
                  </div>
                )}
                {red.discount_mzn > 0 && (
                  <div className="mt-2 font-semibold text-emerald-800">
                    {red.benefit_type === 'service'
                      ? `Benefício de serviço • referência ${red.discount_mzn} MT`
                      : `Desconto até ${red.discount_mzn} MT`}
                  </div>
                )}
                <div className="text-lg font-mono font-black text-slate-900 my-1">
                  {red.redemption_code}
                </div>
                <div className="text-[10px] text-slate-500">
                  {red.points_spent} pontos utilizados
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Resgatado em {new Date(red.created_at).toLocaleDateString('pt-PT')}
                </div>
                {red.used_at && (
                  <div className="text-[10px] text-slate-500">
                    Utilizado em {new Date(red.used_at).toLocaleDateString('pt-PT')}
                  </div>
                )}
                {red.status === 'disponivel' && (
                  <div className="mt-3 border-t border-current/10 pt-2 text-[10px] font-medium">
                    Apresente o código no balcão antes de pagar.
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Points Transactions History */}
      {isCustomer && loyaltyData?.transactions && loyaltyData.transactions.length > 0 && (
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
