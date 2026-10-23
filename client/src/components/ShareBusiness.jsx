import React, { useState } from 'react';
import { Check, Copy, MessageCircle, Send, Share2 } from 'lucide-react';

export default function ShareBusiness() {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const shareUrl = window.location.origin;
  const shareText = 'Conheça o Lava Já Matola — lavagem rápida e de confiança. Marque a sua lavagem online.';
  const isLocalAddress = ['localhost', '127.0.0.1', '0.0.0.0'].includes(window.location.hostname);
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent(shareText);
  const shareLinks = [
    {
      label: 'WhatsApp',
      href: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
      Icon: MessageCircle,
      className: 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
    },
    {
      label: 'Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      Icon: Share2,
      className: 'border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100'
    },
    {
      label: 'Telegram',
      href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
      Icon: Send,
      className: 'border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100'
    }
  ];

  async function handleShare() {
    setError('');
    if (isLocalAddress) {
      setIsOpen(open => !open);
      return;
    }
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Lava Já Matola',
          text: shareText,
          url: shareUrl
        });
      } catch (shareError) {
        if (shareError.name !== 'AbortError') {
          console.error('Erro ao partilhar o Lava Já:', shareError);
          setError('Não foi possível abrir a partilha. Escolha uma rede abaixo.');
          setIsOpen(true);
        }
      }
      return;
    }
    setIsOpen(open => !open);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setError('');
      window.setTimeout(() => setCopied(false), 2500);
    } catch (copyError) {
      console.error('Erro ao copiar o link para partilha:', copyError);
      setError('Não foi possível copiar automaticamente. Selecione e copie o endereço abaixo.');
    }
  }

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={handleShare}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className="inline-flex min-h-[52px] max-w-full items-center justify-center gap-2 whitespace-normal rounded-xl border border-white/25 bg-white/10 px-4 py-3.5 text-center text-sm font-bold text-white shadow-lg shadow-slate-950/10 backdrop-blur-sm transition duration-200 hover:-translate-y-0.5 hover:border-white/40 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 active:translate-y-0 select-none sm:whitespace-nowrap sm:px-6"
      >
        <Share2 className="h-4 w-4" />
        Partilhar e ganhar 5% de desconto
      </button>
      {isOpen && (
        <div className="absolute left-0 top-[calc(100%+0.75rem)] z-30 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-xl shadow-slate-950/20">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-slate-900">Partilhe o Lava Já</p>
              <p className="mt-0.5 text-xs text-slate-500">Escolha onde quer enviar o convite.</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {shareLinks.map(link => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className={`inline-flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-xl border text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${link.className}`}
              >
                <link.Icon className="h-5 w-5" />
                <span>{link.label}</span>
              </a>
            ))}
          </div>
          <button
            type="button"
            onClick={copyLink}
            className="mt-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Link copiado' : 'Copiar link'}
          </button>
          <input
            aria-label="Link para partilhar"
            readOnly
            value={shareUrl}
            onFocus={event => event.target.select()}
            className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 focus:border-blue-400 focus:outline-none"
          />
          {isLocalAddress && (
            <p className="mt-2 text-[11px] leading-relaxed text-amber-800">
              Estás a usar localhost: este link só abre neste computador. Para os clientes acederem, usa o endereço público do ngrok ou um domínio.
            </p>
          )}
          {error && <p role="alert" className="mt-2 text-[11px] text-red-700">{error}</p>}
        </div>
      )}
    </div>
  );
}
