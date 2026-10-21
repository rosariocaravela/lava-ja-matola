import React, { useState } from 'react';
import { Check, Copy, Share2 } from 'lucide-react';

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
    { label: 'WhatsApp', href: `https://wa.me/?text=${encodedText}%20${encodedUrl}` },
    { label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}` },
    { label: 'Telegram', href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}` }
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
    <div className="relative inline-flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={handleShare}
        aria-expanded={isOpen}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-bold text-blue-800 shadow-sm transition hover:bg-blue-50"
      >
        <Share2 className="h-4 w-4" />
        Partilhar o Lava Já
      </button>
      {isOpen && (
        <div className="z-20 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <p className="text-xs font-bold text-slate-800">Partilhe o nosso link</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {shareLinks.map(link => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                {link.label}
              </a>
            ))}
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copiado' : 'Copiar link'}
            </button>
          </div>
          <input
            aria-label="Link para partilhar"
            readOnly
            value={shareUrl}
            onFocus={event => event.target.select()}
            className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-600"
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
