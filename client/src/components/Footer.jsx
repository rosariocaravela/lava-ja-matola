import React from 'react';
import { Car, MapPin, Phone, Mail, Clock, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const socialNetworks = [
  { name: 'Facebook', image: '/social/facebook.svg', url: 'https://www.facebook.com/share/1c4sZGx9ms/?mibextid=wwXIfr' },
  { name: 'Instagram', image: '/social/instagram.svg', url: '' },
  { name: 'YouTube', image: '/social/youtube.svg', url: '' },
  { name: 'WhatsApp', image: '/social/whatsapp.svg', url: '' }
];

export default function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-300 border-t border-slate-800 text-base">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                <Car className="w-5 h-5" />
              </div>
              <span className="font-black text-xl text-white">Lava Já <span className="text-blue-400">Matola</span></span>
            </div>
            <p className="text-sm text-slate-300 leading-7">
              Agende a lavagem, acompanhe a fila e ganhe pontos no Passaporte VIP.
            </p>
            <div className="text-sm text-blue-300 font-medium leading-6">
              Lava Já Matola — Excelência em Limpeza Automóvel
            </div>
            <div className="flex items-center gap-3 pt-1" aria-label="Redes sociais do Lava Já">
              {socialNetworks.map(network => {
                const icon = (
                  <img
                    src={network.image}
                    alt=""
                    aria-hidden="true"
                    className="h-10 w-10 transition-transform group-hover:scale-110"
                  />
                );

                return network.url ? (
                  <a
                    key={network.name}
                    href={network.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Lava Já no ${network.name}`}
                    className="group rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  >
                    {icon}
                  </a>
                ) : (
                  <span
                    key={network.name}
                    role="img"
                    aria-label={`${network.name}: perfil ainda não configurado`}
                    title={`${network.name}: perfil ainda não configurado`}
                    className="group cursor-default opacity-90"
                  >
                    {icon}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white font-semibold mb-4 text-lg">Navegação</h4>
            <ul className="space-y-3 text-sm">
              <li><Link to="/" className="hover:text-blue-400 transition-colors">Início</Link></li>
              <li><Link to="/reservar" className="hover:text-blue-400 transition-colors">Marcar Lavagem</Link></li>
              <li><Link to="/fila" className="hover:text-blue-400 transition-colors">Fila de Atendimento</Link></li>
              <li><Link to="/fidelizacao" className="hover:text-blue-400 transition-colors">Passaporte Lava Já (Pontos)</Link></li>
            </ul>
          </div>

          {/* Business Info */}
          <div>
            <h4 className="text-white font-semibold mb-4 text-lg">Localização & Horário</h4>
            <ul className="space-y-3 text-sm text-slate-300 leading-6">
              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <span>Av. da Matola, Paragem Padaria, Matola</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-blue-400 shrink-0" />
                <span>+258 84 321 9876</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-400 shrink-0" />
                <span>contacto@lavajamatola.co.mz</span>
              </li>
              <li className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400 shrink-0" />
                <span>Segunda a Sábado: 07:30 – 18:00</span>
              </li>
            </ul>
          </div>

          {/* Maps CTA */}
          <div>
            <h4 className="text-white font-semibold mb-4 text-lg">Como Chegar</h4>
            <p className="text-sm text-slate-300 leading-6 mb-4">
              Estamos localizados na Avenida da Matola, com acesso facilitado e estacionamento amplo.
            </p>
            <a
              href="https://maps.google.com/?q=Matola,+Mocambique"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-blue-300 rounded-xl text-sm font-medium border border-slate-700 transition-all"
            >
              <MapPin className="w-4 h-4 text-blue-400" />
              <span>Abrir no Google Maps</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-center text-sm text-slate-400 gap-4">
          <div>
            © 2026 Lava Já Matola. Todos os direitos reservados.
          </div>
          <div className="flex items-center gap-1 text-xs">
            <span>Criado com tecnologia inteligente para o Lava Já Matola</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
