import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Calendar, Clock, Car, CheckCircle2, AlertCircle, ArrowRight, 
  Tag, Shield, ArrowLeft, Award, Sparkles, User
} from 'lucide-react';
import { apiRequest } from '../api';
import { useAuth } from '../context/AuthContext';

export default function BookingPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [services, setServices] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState(searchParams.get('serviceId') || '');
  
  // Date handling: defaults to today
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(searchParams.get('date') || todayStr);
  const [availableSlotsData, setAvailableSlotsData] = useState(null);
  const [selectedTime, setSelectedTime] = useState('');
  
  // Form fields
  const [customerName, setCustomerName] = useState(user ? user.name : '');
  const [customerPhone, setCustomerPhone] = useState(user ? user.phone || '' : '');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [notes, setNotes] = useState('');

  // Promo code
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoError, setPromoError] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [confirmedReservation, setConfirmedReservation] = useState(null);

  useEffect(() => {
    loadServices();
  }, []);

  useEffect(() => {
    if (user && !customerName) {
      setCustomerName(user.name);
      if (user.phone) {
        setCustomerPhone(user.phone);
      }
    }
  }, [user]);

  useEffect(() => {
    if (selectedDate && selectedServiceId) {
      loadSlots(selectedDate, selectedServiceId);
    }
  }, [selectedDate, selectedServiceId]);

  async function loadServices() {
    try {
      const data = await apiRequest('/services');
      setServices(data);
      if (!selectedServiceId && data.length > 0) {
        setSelectedServiceId(data[0].id.toString());
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function loadSlots(date, serviceId) {
    try {
      setSlotsLoading(true);
      setSelectedTime('');
      const data = await apiRequest(`/availability?date=${date}&serviceId=${serviceId}`);
      setAvailableSlotsData(data);
    } catch (err) {
      console.error('Erro ao carregar horários:', err);
    } finally {
      setSlotsLoading(false);
    }
  }

  async function handleApplyPromo() {
    if (!promoCode.trim()) return;
    setPromoError('');
    try {
      const res = await apiRequest('/promotions/validate', {
        method: 'POST',
        body: JSON.stringify({
          code: promoCode.trim().toUpperCase(),
          service_id: selectedServiceId,
          scheduled_date: selectedDate
        })
      });
      setAppliedPromo(res);
    } catch (err) {
      setPromoError(err.message);
      setAppliedPromo(null);
    }
  }

  async function handleConfirmBooking(e) {
    e.preventDefault();
    setErrorMessage('');

    if (!selectedServiceId || !selectedDate || !selectedTime) {
      setErrorMessage('Por favor selecione o serviço, a data e um horário disponível.');
      return;
    }

    if (!customerName || !customerPhone || !vehiclePlate || !vehicleModel) {
      setErrorMessage('Por favor preencha todos os dados da viatura e contacto.');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        customer_name: customerName,
        customer_phone: customerPhone,
        vehicle_plate: vehiclePlate,
        vehicle_model: vehicleModel,
        service_id: parseInt(selectedServiceId, 10),
        scheduled_date: selectedDate,
        scheduled_time: selectedTime,
        promo_code: appliedPromo?.code || null,
        notes: notes.trim() + (appliedPromo ? ` [Promo: ${appliedPromo.code} - ${appliedPromo.discount_percentage}%]` : '')
      };

      const res = await apiRequest('/reservations', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setConfirmedReservation(res.reservation);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  const selectedService = services.find(s => s.id.toString() === selectedServiceId.toString());
  
  // Price calculations
  let finalPrice = selectedService ? selectedService.price_mzn : 0;
  let discountAmount = 0;
  if (appliedPromo && selectedService) {
    discountAmount = (finalPrice * appliedPromo.discount_percentage) / 100;
    finalPrice = finalPrice - discountAmount;
  }

  // Success view
  if (confirmedReservation) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12">
        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-xl text-center space-y-6 animate-in fade-in zoom-in-95">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-md">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div>
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              Reserva Confirmada com Sucesso
            </span>
            <h2 className="text-2xl font-black text-slate-900 mt-3">
              Obrigado pela sua Reserva!
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Apresente o código de referência ao chegar às nossas instalações.
            </p>
          </div>

          <div className="bg-slate-900 text-white rounded-2xl p-6 space-y-3">
            <div className="text-xs text-slate-400 uppercase tracking-wider">Código de Referência</div>
            <div className="text-4xl font-black font-mono tracking-widest text-blue-400">
              {confirmedReservation.reference_code}
            </div>
            <div className="pt-2 border-t border-slate-800 grid grid-cols-2 gap-2 text-xs text-slate-300 text-left">
              <div>
                <span className="text-slate-500 block">Data & Hora:</span>
                <span className="font-semibold text-white">{confirmedReservation.scheduled_date} às {confirmedReservation.scheduled_time}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Vaga Atribuída:</span>
                <span className="font-semibold text-emerald-400">Vaga {confirmedReservation.bay_number || 1}</span>
              </div>
              <div className="mt-2">
                <span className="text-slate-500 block">Viatura:</span>
                <span className="font-semibold text-white">{confirmedReservation.vehicle_plate}</span>
              </div>
              <div className="mt-2">
                <span className="text-slate-500 block">Serviço:</span>
                <span className="font-semibold text-white">{confirmedReservation.service_name}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-left">
            <h3 className="font-bold text-sm text-blue-950">Sem pagamento antecipado</h3>
            <p className="mt-2 text-xs leading-relaxed text-blue-900">
              O pagamento só fica disponível depois de o funcionário marcar a lavagem como concluída. Nessa altura poderá usar M-Pesa, e-Mola, mKesh, Moza Banco (simulados) ou pagar no balcão.
            </p>
          </div>

          <div className="flex">
            <button
              onClick={() => navigate('/cliente')}
              className="w-full py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs transition-all cursor-pointer"
            >
              Ir para o meu Painel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <div className="text-center max-w-xl mx-auto mb-8">
        <span className="text-xs font-bold text-blue-600 uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
          Agendamento Digital Inteligente
        </span>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight mt-2">
          Marcar Lavagem
        </h1>
        <p className="text-xs text-slate-600 mt-1">
          Selecione o serviço e horário desejados. O sistema aloca as vagas disponíveis em tempo real.
        </p>
      </div>

      {errorMessage && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleConfirmBooking} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Service & Slot Selection */}
        <div className="lg:col-span-7 space-y-6">
          {/* Step 1: Services */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <label className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
              1. Selecione o Serviço
            </label>
            <div className="space-y-2">
              {services.map(s => {
                const isSelected = selectedServiceId.toString() === s.id.toString();
                return (
                  <div
                    key={s.id}
                    onClick={() => setSelectedServiceId(s.id.toString())}
                    className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-blue-50/80 border-blue-600 text-blue-950 ring-1 ring-blue-600'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-sm text-slate-900">{s.name}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{s.duration_minutes} min • Acumula +{s.points_reward} pts</div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-sm text-slate-900">{s.price_mzn} MT</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step 2: Date & Slots */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                2. Data & Horário Disponível
              </label>
              <input
                type="date"
                min={todayStr}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
              />
            </div>

            {slotsLoading ? (
              <div className="text-center py-8 text-xs text-slate-400">
                A calcular capacidade das vagas para {selectedDate}...
              </div>
            ) : availableSlotsData ? (
              <div>
                <div className="text-[11px] text-slate-500 mb-2">
                  Capacidade simultânea: {availableSlotsData.capacity} viaturas por vaga. Selecione o horário pretendido:
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-56 overflow-y-auto p-1">
                  {availableSlotsData.slots.map((slot) => {
                    const isSelected = selectedTime === slot.time;
                    return (
                      <button
                        key={slot.time}
                        type="button"
                        disabled={!slot.available}
                        onClick={() => setSelectedTime(slot.time)}
                        className={`p-2 rounded-xl text-center text-xs font-bold transition-all cursor-pointer ${
                          !slot.available
                            ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
                            : isSelected
                            ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-600 scale-102'
                            : 'bg-white hover:bg-blue-50 text-slate-800 border border-slate-200 hover:border-blue-400'
                        }`}
                        title={slot.available ? `Disponível na Vaga ${slot.assignedBay}` : slot.reason}
                      >
                        {slot.time}
                      </button>
                    );
                  })}
                </div>
                {selectedTime && (
                  <div className="mt-3 p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between">
                    <span>Horário escolhido: <strong>{selectedTime}</strong></span>
                    <span className="font-semibold text-[11px] bg-emerald-200/60 px-2 py-0.5 rounded">Vaga Confirmada</span>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {/* Right Column: Customer Info & Summary */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <label className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
              3. Dados da Viatura & Contacto
            </label>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-600 font-semibold mb-1 block">Nome do Condutor *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Carlos Sitoe"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-slate-600 font-semibold mb-1 block">Contacto Telefónico *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: +258 84 123 4567"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-600 font-semibold mb-1 block">Matrícula *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: ABC 123 MP"
                    value={vehiclePlate}
                    onChange={(e) => setVehiclePlate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-600 font-semibold mb-1 block">Modelo da Viatura *</label>
                  <input
                    type="text"
                    required
                    list="vehicle-model-suggestions"
                    placeholder="Escolha ou escreva o modelo"
                    value={vehicleModel}
                    onChange={(e) => setVehicleModel(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
                  />
                  <datalist id="vehicle-model-suggestions">
                    <option value="Toyota Hilux" />
                    <option value="Toyota Corolla" />
                    <option value="Toyota Fortuner" />
                    <option value="Nissan Navara" />
                    <option value="Nissan X-Trail" />
                    <option value="Mazda Demio" />
                    <option value="Ford Ranger" />
                    <option value="Isuzu D-Max" />
                    <option value="Honda Fit" />
                    <option value="Suzuki Swift" />
                  </datalist>
                </div>
              </div>

              <div>
                <label className="text-slate-600 font-semibold mb-1 block">Observações (Opcional)</label>
                <textarea
                  rows="2"
                  placeholder="Ex: Atenção especial aos tapetes ou jantes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Promo Code Input */}
            <div className="pt-2 border-t border-slate-100">
              <label className="text-[11px] font-bold text-slate-700 uppercase mb-1.5 block">
                Código Promocional
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ex: QUARTA20"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl uppercase font-mono focus:outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={handleApplyPromo}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl cursor-pointer"
                >
                  Aplicar
                </button>
              </div>
              {appliedPromo && (
                <div className="mt-2 text-[11px] text-emerald-600 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Promoção «{appliedPromo.title}» aplicada (-{appliedPromo.discount_percentage}%)</span>
                </div>
              )}
              {promoError && (
                <div className="mt-2 text-[11px] text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{promoError}</span>
                </div>
              )}
            </div>

              {/* Price Summary */}
            <div className="pt-3 border-t border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Serviço Base:</span>
                <span>{selectedService ? selectedService.price_mzn : 0} MT</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Desconto Promocional:</span>
                  <span>-{discountAmount} MT</span>
                </div>
              )}
              <div className="flex justify-between text-slate-900 font-bold text-base pt-2 border-t border-slate-100">
                <span>Total a Pagar:</span>
                <span className="text-blue-600">{finalPrice} MT</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !selectedTime}
              className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <span>A processar reserva...</span>
              ) : (
                <>
                  <span>Confirmar Agendamento</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
