import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Sparkles, X, User, CornerDownRight, ExternalLink, Calendar, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../api';

export default function AiAssistantModal({ isOpen, onClose }) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([
    {
      sender: 'ai',
      text: 'Olá! Sou o **Assistente Lava Já Matola**.\nComo posso ajudar? Posso consultar serviços, preços e disponibilidade de horários.',
      actions: [
        { label: 'Ver Serviços e Preços', prompt: 'Quais são os serviços e preços?' },
        { label: 'Horários para amanhã', prompt: 'Quais os horários livres para amanhã?' },
        { label: 'Onde fica o estabelecimento?', prompt: 'Onde fica a vossa localização?' }
      ]
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiMode, setAiMode] = useState('demo_conversational_engine');
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  async function sendMessage(textToSend) {
    const text = textToSend || input;
    if (!text.trim() || loading) return;

    const userMessage = { sender: 'user', text };
    setMessages(prev => [...prev, userMessage]);
    if (!textToSend) setInput('');
    setLoading(true);

    try {
      const data = await apiRequest('/ai-assistant/chat', {
        method: 'POST',
        body: JSON.stringify({ message: text }),
      });

      if (data.aiMode) setAiMode(data.aiMode);

      setMessages(prev => [
        ...prev,
        {
          sender: 'ai',
          text: data.reply,
          actions: data.suggestedActions?.map(act => ({
            label: act.label,
            action: act.action,
            date: act.date,
            url: act.url,
            serviceId: act.serviceId,
            prompt: act.action === 'book' ? 'Quero agendar uma lavagem' : act.label
          }))
        }
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          sender: 'ai',
          text: 'Desculpe, ocorreu um erro ao consultar o sistema. Por favor tente novamente ou dirija-se à receção.',
        }
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleActionClick(act) {
    if (act.action === 'open_maps' && act.url) {
      window.open(act.url, '_blank');
    } else if (act.action === 'start_booking' || act.action === 'book') {
      onClose();
      navigate('/reservar' + (act.date ? `?date=${act.date}` : '') + (act.serviceId ? `?serviceId=${act.serviceId}` : ''));
    } else if (act.action === 'loyalty') {
      onClose();
      navigate('/fidelizacao');
    } else if (act.action === 'dashboard') {
      onClose();
      navigate('/cliente');
    } else if (act.prompt) {
      sendMessage(act.prompt);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col h-[600px] max-h-[90vh] overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 p-4 text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-white backdrop-blur-md shadow-inner">
              <Bot className="w-6 h-6 text-blue-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base">Assistente Lava Já Matola</h3>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1 animate-pulse"></span>
                  Online
                </span>
              </div>
              <p className="text-xs text-blue-100/80">Conectado aos dados em tempo real da oficina</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 text-blue-100 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.sender === 'ai' && (
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                  <Sparkles className="w-4 h-4 text-amber-300" />
                </div>
              )}
              <div className={`max-w-[85%] rounded-2xl p-3.5 text-sm shadow-xs ${
                msg.sender === 'user'
                  ? 'bg-blue-600 text-white rounded-tr-xs'
                  : 'bg-white text-slate-800 border border-slate-200/80 rounded-tl-xs'
              }`}>
                <div className="whitespace-pre-line leading-relaxed">
                  {msg.text}
                </div>

                {/* Suggested Action Chips */}
                {msg.actions && msg.actions.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap gap-1.5">
                    {msg.actions.map((act, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleActionClick(act)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800 border border-blue-200 transition-colors cursor-pointer text-left"
                      >
                        <CornerDownRight className="w-3 h-3 text-blue-500 shrink-0" />
                        <span>{act.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {msg.sender === 'user' && (
                <div className="w-8 h-8 rounded-lg bg-slate-800 text-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 items-center text-slate-400 text-xs py-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 animate-pulse">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 flex items-center gap-2 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce"></span>
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce [animation-delay:0.4s]"></span>
                <span className="text-slate-500 font-medium">A consultar horários e dados do sistema...</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Footer */}
        <div className="p-3 border-t border-slate-200 bg-white">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte sobre preços, horários ou ref. LJ-XXXX..."
              className="flex-1 px-4 py-2.5 text-sm bg-slate-100 rounded-xl border border-transparent focus:border-blue-500 focus:bg-white focus:outline-none transition-all"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="p-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl transition-all cursor-pointer shadow-xs shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <div className="mt-2 text-[10px] text-slate-400 text-center flex items-center justify-center gap-1.5">
            <span>🛡️ Respostas fundamentadas nas regras oficiais e vagas reais do Lava Já Matola.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
