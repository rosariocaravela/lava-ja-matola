import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Car, Calendar, Clock, Award, ShieldCheck, Sparkles, MapPin, 
  ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, Users, Tag, Bot,
  ExternalLink, HelpCircle, ChevronDown, ChevronUp, AlertCircle, Star
} from 'lucide-react';
import { apiRequest } from '../api';
import ShareBusiness from '../components/ShareBusiness';
import GallerySection from '../components/GallerySection';
import imagem1 from '../assets/imagem/imagem1.jpg';
import imagem3 from '../assets/imagem/imagem3.jpg';
import imagem4 from '../assets/imagem/imagem4.jpg';

const heroSlides = [
  { src: '/images.jpg', alt: 'Instalações do Lava Já Matola e uma viatura pronta para lavagem' },
  { src: imagem1, alt: 'Campanha de 10% de desconto ao pagar com Moza Banco' },
  { src: imagem3, alt: 'Cartão digital Lava Já com pontos e recompensas' },
  { src: imagem4, alt: 'Serviço de lavagem automóvel no Lava Já Matola' }
];

export default function HomePage({ onOpenAi }) {
  const navigate = useNavigate();
  const [services, setServices] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [settings, setSettings] = useState(null);
  const [reviewData, setReviewData] = useState({ reviews: [], summary: { count: 0, average_rating: null } });
  const [loading, setLoading] = useState(true);
  const [openFaq, setOpenFaq] = useState(null);
  const [heroSlide, setHeroSlide] = useState(0);

  useEffect(() => {
    loadHomeData();
  }, []);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    const intervalId = window.setInterval(() => {
      setHeroSlide(current => (current + 1) % heroSlides.length);
    }, 6000);

    return () => window.clearInterval(intervalId);
  }, []);

  async function loadHomeData() {
    try {
      setLoading(true);
      const [srvData, promoData, settData, publicReviews] = await Promise.all([
        apiRequest('/services'),
        apiRequest('/promotions'),
        apiRequest('/settings'),
        apiRequest('/reviews')
      ]);

      setServices(srvData);
      setPromotions(promoData);
      setSettings(settData);
      setReviewData(publicReviews);
    } catch (err) {
      console.error('Erro ao carregar dados da página inicial:', err);
    } finally {
      setLoading(false);
    }
  }

  const faqs = [
    {
      q: 'Como funciona o sistema de agendamento por horário?',
      a: 'Pode escolher o serviço desejado, a data e o horário disponível. O sistema valida automaticamente a capacidade das nossas 3 vagas de lavagem simultânea, impedindo sobreposições ou tempos de espera excessivos.'
    },
    {
      q: 'Como acumulo e utilizo pontos no Passaporte Lava Já?',
      a: 'Recebe 10 pontos ao criar a conta, entre 10 e 40 por lavagem concluída e mais 10 pontos a cada 3 semanas após a primeira lavagem. As recompensas começam nos 50 pontos.'
    },
    {
      q: 'Como sei quando o meu carro está pronto?',
      a: 'Recebe uma notificação na plataforma assim que o serviço for concluído e o veículo estiver pronto para levantamento.'
    },
    {
      q: 'O assistente de Inteligência Artificial pode marcar por mim?',
      a: 'Sim! O Assistente Lava Já Matola consulta os serviços, preços e horários livres. Pode conversar com ele em português simples para tirar dúvidas e iniciar o seu agendamento.'
    }
  ];
  return (
    <div className="space-y-16 pb-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white py-10 sm:py-14 lg:py-16">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(59,130,246,0.3),rgba(255,255,255,0))]"></div>
        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-12">
            <div className="space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-400/20 text-blue-300 text-xs font-semibold backdrop-blur-md">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span>Lava Já Matola — Lavagem rápida e de confiança</span>
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight">
                Lavagem de qualidade, <span className="bg-gradient-to-r from-blue-400 via-teal-300 to-blue-200 bg-clip-text text-transparent">sem perder tempo.</span>
              </h1>

              <p className="text-base sm:text-lg text-slate-300 max-w-2xl leading-relaxed">
                Esqueça as filas imprevisíveis. Agende com precisão, receba uma notificação quando a lavagem estiver concluída e ganhe pontos no seu <strong>Passaporte Lava Já</strong>.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start pt-2">
                <Link
                  to="/reservar"
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-600/30 hover:scale-102 transition-all cursor-pointer"
                >
                  <Calendar className="w-4 h-4" />
                  <span>Marcar Lavagem Agora</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <ShareBusiness />
              </div>

              {/* Stats badges */}
              <div className="pt-6 grid grid-cols-2 gap-4 border-t border-slate-800 max-w-lg mx-auto lg:mx-0 text-left">
                <div>
                  <div className="text-2xl font-black text-white">
                    {settings ? `${settings.simultaneous_capacity} Vagas` : '— Vagas'}
                  </div>
                  <div className="text-xs text-slate-400">Atendimento Simultâneo</div>
                </div>
                <div>
                  <div className="text-2xl font-black text-emerald-400">10–40 Pts</div>
                  <div className="text-xs text-slate-400">Por lavagem concluída</div>
                </div>
              </div>
            </div>

            <div
              className="overflow-hidden rounded-3xl border border-white/15 bg-white p-2 shadow-2xl shadow-black/30 sm:p-3"
              role="region"
              aria-label="Imagens do Lava Já Matola"
            >
              <div className="relative aspect-square overflow-hidden rounded-2xl bg-white sm:aspect-[4/3]">
                {heroSlides.map((slide, index) => (
                  <img
                    key={slide.src}
                    src={slide.src}
                    alt={slide.alt}
                    aria-hidden={index !== heroSlide}
                    className={`absolute inset-0 h-full w-full object-contain p-1 transition-opacity duration-700 motion-reduce:transition-none ${
                      index === heroSlide ? 'opacity-100' : 'opacity-0'
                    }`}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between px-1 pt-3 sm:px-2">
                <span className="text-xs font-semibold text-slate-500" aria-live="polite">
                  {heroSlide + 1} / {heroSlides.length}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setHeroSlide(current => (current - 1 + heroSlides.length) % heroSlides.length)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-700 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                    aria-label="Ver imagem anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {heroSlides.map((slide, index) => (
                    <button
                      key={slide.src}
                      type="button"
                      onClick={() => setHeroSlide(index)}
                      className={`h-2.5 rounded-full transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                        index === heroSlide ? 'w-6 bg-blue-600' : 'w-2.5 bg-slate-300 hover:bg-slate-400'
                      }`}
                      aria-label={`Mostrar imagem ${index + 1}: ${slide.alt}`}
                      aria-current={index === heroSlide ? 'true' : undefined}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => setHeroSlide(current => (current + 1) % heroSlides.length)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-700 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                    aria-label="Ver próxima imagem"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Active Promotions Strip */}
      {promotions.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 rounded-2xl p-4 sm:p-5 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Tag className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-sm uppercase tracking-wide">Campanhas Ativas</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-900 font-bold text-[10px]">
                    Descontos Especiais
                  </span>
                </div>
                <p className="text-xs text-blue-100">
                  {promotions[0].title}: use o código <strong className="bg-black/30 px-1.5 py-0.5 rounded font-mono text-amber-300">{promotions[0].code}</strong> para {promotions[0].discount_percentage}% de desconto!
                </p>
              </div>
            </div>
            <Link
              to="/reservar"
              className="px-4 py-2 bg-white text-blue-700 hover:bg-blue-50 rounded-xl text-xs font-bold transition-colors shrink-0 shadow-sm"
            >
              Aproveitar Desconto
            </Link>
          </div>
        </section>
      )}

      {/* Services & Pricing Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-bold text-blue-600 uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
            Tabela de Preços & Serviços
          </span>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight mt-3">
            Escolha o Tratamento Ideal para o seu Veículo
          </h2>
          <p className="text-sm text-slate-600 mt-2">
            Valores transparentes em Meticais (MT), com duração garantida e acúmulo de pontos no Passaporte.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service, index) => {
            const isHighlight = index === 1; // Lavagem Completa
            return (
              <div
                key={service.id}
                className={`rounded-2xl p-6 transition-all duration-200 flex flex-col justify-between ${
                  isHighlight
                    ? 'bg-gradient-to-b from-blue-900 to-slate-900 text-white shadow-xl ring-2 ring-blue-500 scale-102'
                    : 'bg-white border border-slate-200 shadow-xs hover:shadow-md text-slate-900'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full uppercase ${
                      isHighlight ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {service.category || 'Lavagem'}
                    </span>
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${
                      isHighlight ? 'text-amber-300' : 'text-amber-600'
                    }`}>
                      <Award className="w-3.5 h-3.5" /> +{service.points_reward} pts
                    </span>
                  </div>

                  <h3 className="text-xl font-bold tracking-tight mb-2">
                    {service.name}
                  </h3>

                  <p className={`text-xs leading-relaxed mb-6 ${
                    isHighlight ? 'text-blue-100/90' : 'text-slate-600'
                  }`}>
                    {service.description}
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-4 pt-4 border-t border-slate-200/40">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Clock className="w-4 h-4 text-blue-500" />
                      <span className={isHighlight ? 'text-slate-300' : 'text-slate-600'}>
                        Duração: <strong>{service.duration_minutes} min</strong>
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-black">
                        {service.price_mzn} <span className="text-sm font-semibold">MT</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => navigate(`/reservar?serviceId=${service.id}`)}
                    className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      isHighlight
                        ? 'bg-blue-500 hover:bg-blue-400 text-white shadow-md'
                        : 'bg-slate-900 hover:bg-blue-600 text-white'
                    }`}
                  >
                    <span>Marcar Este Serviço</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-blue-600">Experiências reais</span>
            <h2 className="mt-1 text-2xl font-black text-slate-900">Avaliações dos clientes</h2>
          </div>
          {reviewData.summary.count > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-900">
              <span className="inline-flex items-center gap-1">
                <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
                {reviewData.summary.average_rating}/5
              </span>
              <span className="ml-2 text-xs font-medium">({reviewData.summary.count} avaliações)</span>
            </div>
          )}
        </div>
        {reviewData.reviews.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            Ainda não existem avaliações publicadas. Após concluir um serviço, poderá partilhar a sua experiência.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {reviewData.reviews.slice(0, 6).map(review => (
              <article key={review.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex gap-1" aria-label={`${review.rating} de 5 estrelas`}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <Star
                      key={star}
                      className={`h-4 w-4 ${star <= review.rating ? 'fill-amber-400 text-amber-500' : 'text-slate-300'}`}
                    />
                  ))}
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-700">{review.comment}</p>
                <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
                  Serviço: <span className="font-semibold text-slate-700">{review.service_name}</span>
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* How it works Section */}
      <section className="bg-slate-100 py-16 border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
              Fluxo Sem Complicações
            </span>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight mt-3">
              Como Funciona o Lava Já Matola
            </h2>
            <p className="text-sm text-slate-600 mt-2">
              Da chegada do veículo ao levantamento impecável com pontos VIP.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs relative">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-black text-base mb-4">
                1
              </div>
              <h3 className="font-bold text-base text-slate-900 mb-1.5">Deixe o Carro ou Agende</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Traga a viatura diretamente às nossas instalações na Matola ou agende o seu horário conveniente pela plataforma.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs relative">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-black text-base mb-4">
                2
              </div>
              <h3 className="font-bold text-base text-slate-900 mb-1.5">Lavagem Profissional</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                A nossa equipa executa a lavagem e o detalhe selecionado com produtos de alta qualidade e rapidez.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs relative">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-black text-base mb-4">
                3
              </div>
              <h3 className="font-bold text-base text-slate-900 mb-1.5">Registo de Conclusão</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Assim que a lavagem termina, o serviço é registado no sistema e a viatura fica pronta para levantamento.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs relative">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-black text-base mb-4">
                4
              </div>
              <h3 className="font-bold text-base text-slate-900 mb-1.5">Levantamento & Pontos</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Levante o seu veículo impecável e acumule pontos automáticos no Passaporte VIP para descontos futuros.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Loyalty Passaporte Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 rounded-3xl p-8 sm:p-12 text-white shadow-2xl relative overflow-hidden">
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-xs font-semibold border border-amber-400/30">
                <Award className="w-3.5 h-3.5" />
                <span>Programa de Fidelização</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
                Passaporte Lava Já: As suas lavagens valem prémios
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed max-w-xl">
                Ganhe entre 10 e 40 pontos por serviço, conforme o tratamento escolhido. Troque os seus pontos por recompensas a partir de 50 pontos.
              </p>

              <div className="pt-2 flex flex-wrap gap-4">
                <Link
                  to="/fidelizacao"
                  className="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors shadow-lg"
                >
                  Consultar Benefícios & Resgates
                </Link>
                <button
                  onClick={onOpenAi}
                  className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-xs transition-colors border border-white/20 cursor-pointer"
                >
                  Perguntar como acumular
                </button>
              </div>
            </div>

            <div className="lg:col-span-5 bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl p-6 space-y-4">
              <div className="text-xs uppercase font-bold text-amber-300 tracking-wider">Recompensas Mais Procuradas</div>
              <div className="space-y-3">
                <div className="bg-black/30 p-3 rounded-xl border border-white/10 flex justify-between items-center text-xs">
                  <div>
                    <div className="font-semibold text-white">Desconto de 100 MT</div>
                    <div className="text-[11px] text-slate-400">Na Lavagem Completa</div>
                  </div>
                  <span className="font-bold text-amber-300 bg-amber-400/10 px-2 py-1 rounded">150 pts</span>
                </div>
                <div className="bg-black/30 p-3 rounded-xl border border-white/10 flex justify-between items-center text-xs">
                  <div>
                    <div className="font-semibold text-white">Aplicação de Cera Protetora</div>
                    <div className="text-[11px] text-slate-400">Proteção e alto brilho</div>
                  </div>
                  <span className="font-bold text-amber-300 bg-amber-400/10 px-2 py-1 rounded">100 pts</span>
                </div>
                <div className="bg-black/30 p-3 rounded-xl border border-white/10 flex justify-between items-center text-xs">
                  <div>
                    <div className="font-semibold text-white">Lavagem Exterior Grátis</div>
                    <div className="text-[11px] text-slate-400">Serviço sem qualquer custo</div>
                  </div>
                  <span className="font-bold text-amber-300 bg-amber-400/10 px-2 py-1 rounded">200 pts</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Location and Map Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-xs grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-6 space-y-4">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
              Onde nos Encontrar
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Localização de Fácil Acesso na Matola
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              O Lava Já Matola está estrategicamente situado na Avenida da Matola, com estacionamento amplo, sala de espera confortável e acesso direto para viaturas.
            </p>

            <div className="space-y-2.5 text-xs text-slate-700 pt-2">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>{settings?.address || 'Av. da Matola, Paragem Padaria, Matola, Moçambique'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Horário: <strong>{settings?.open_time || '07:30'} às {settings?.close_time || '18:00'}</strong> (Segunda a Sábado)</span>
              </div>
            </div>

            <div className="pt-2">
              <a
                href={settings?.google_maps_url || 'https://maps.google.com/?q=Matola,+Mocambique'}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all shadow-md"
              >
                <MapPin className="w-4 h-4" />
                <span>Abrir Rota no Google Maps</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 p-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center mx-auto shadow-md">
                <MapPin className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-base text-slate-900">Lava Já Matola</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Coordenadas GPS: <span className="font-mono text-slate-800 font-semibold">{settings?.coordinates || '-25.9622, 32.4589'}</span>
              </p>
              <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5 max-w-sm mx-auto">
                💡 Ponto de referência: Av. da Matola, Paragem Padaria, junto à estrada principal.
              </div>
            </div>
          </div>
        </div>
      </section>

      <GallerySection />

      {/* FAQ Section */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <span className="text-xs font-bold text-blue-600 uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
            Dúvidas Frequentes
          </span>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight mt-2">
            Perguntas & Respostas
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div key={idx} className="bg-white border border-slate-200 rounded-2xl overflow-hidden transition-all">
                <button
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full p-4 text-left flex justify-between items-center gap-3 cursor-pointer hover:bg-slate-50"
                >
                  <span className="font-bold text-sm text-slate-800">{faq.q}</span>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
