'use client';

/**
 * @file components/layout/WhatsAppWidget.tsx
 * @description Floating WhatsApp Concierge widget for Pakistani shoppers.
 * Connects directly to Lahore atelier stylists for instant sizing advice and delivery tracking.
 * Strict TypeScript: ZERO `any`.
 */

import { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { generateWhatsAppChatUrl } from '@/lib/whatsapp';

export function WhatsAppWidget() {
  const [isOpen, setIsOpen] = useState(false);

  const handleOpenWhatsApp = () => {
    const url = generateWhatsAppChatUrl(
      '+923000914546',
      'Assalam-o-Alaikum Bajaur OX Shoes! I need sizing guidance and delivery updates.'
    );
    window.open(url, '_blank');
  };

  return (
    <div className="fixed bottom-6 right-6 z-40 print:hidden flex flex-col items-end">
      {isOpen && (
        <div className="mb-3 w-72 bg-white rounded-2xl shadow-2xl border border-neutral-200 p-4 space-y-3 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-bold text-xs text-neutral-900">Bajaur OX Shoes Online</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-neutral-400 hover:text-neutral-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="text-xs text-neutral-600 leading-relaxed">
            Need urgent help with <strong>Peshawari Chappal sizing</strong> or <strong>courier delivery status</strong>? Chat live with our team on WhatsApp.
          </p>

          <a
            href={generateWhatsAppChatUrl(
              '+923000914546',
              'Assalam-o-Alaikum Bajaur OX Shoes! I need sizing guidance and delivery updates.'
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            <MessageCircle className="h-4 w-4" />
            <span>Open WhatsApp Chat</span>
          </a>
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="h-13 w-13 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95 border-2 border-white"
        aria-label="WhatsApp Concierge"
        title="WhatsApp Support"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    </div>
  );
}
