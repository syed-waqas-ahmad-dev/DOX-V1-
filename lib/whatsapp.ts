/**
 * @file lib/whatsapp.ts
 * @description Free WhatsApp click-to-chat integration for Pakistani customers (wa.me link).
 * 100% Free Stack: Pure wa.me link generation without external APIs.
 * Strict TypeScript: ZERO `any`.
 */

export const OX_DEFAULT_WHATSAPP_PHONE = '923001234567';

/**
 * Generates direct WhatsApp click-to-chat URL using https://wa.me format.
 */
export function generateWhatsAppChatUrl(
  phone: string = OX_DEFAULT_WHATSAPP_PHONE,
  text: string = 'Hello OX Shoes, I need assistance with my order.'
): string {
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const targetPhone = cleanPhone || OX_DEFAULT_WHATSAPP_PHONE;
  const encodedText = encodeURIComponent(text);
  return `https://wa.me/${targetPhone}?text=${encodedText}`;
}

/**
 * Standard concierge URL for live assistance
 */
export function getWhatsAppStoreConciergeUrl(message?: string): string {
  return generateWhatsAppChatUrl(
    OX_DEFAULT_WHATSAPP_PHONE,
    message || 'Hello OX Shoes Pakistan! I would like advice on shoe sizing, bespoke craft, and orders.'
  );
}
