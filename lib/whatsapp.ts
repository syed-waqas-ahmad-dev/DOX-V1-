/**
 * @file lib/whatsapp.ts
 * @description Free WhatsApp click-to-chat integration for Pakistani customers (wa.me link).
 * 100% Free Stack: Pure wa.me link generation without external APIs.
 * Strict TypeScript: ZERO `any`.
 */

export const OX_DEFAULT_WHATSAPP_PHONE = '923000914546';

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
 * Normalizes a customer's Pakistani mobile number strictly for WhatsApp outreach.
 * Validates Pakistani mobile patterns:
 * - 03XXXXXXXXX (11 digits starting with 03 -> 923XXXXXXXXX)
 * - 923XXXXXXXXX or +923XXXXXXXXX (12 digits starting with 923)
 * - 00923XXXXXXXXX (14 digits starting with 00923 -> 923XXXXXXXXX)
 * - 3XXXXXXXXX (10 digits starting with 3 -> 923XXXXXXXXX)
 * Returns normalized 12-digit string (e.g. '923000914546') or null if invalid/missing.
 * NEVER falls back to business numbers or sample numbers.
 */
export function normalizeCustomerPakistaniPhone(rawPhone?: string | null): string | null {
  if (!rawPhone || typeof rawPhone !== 'string') return null;
  const digits = rawPhone.replace(/\D/g, '');

  if (digits.startsWith('00923') && digits.length === 14) {
    return digits.slice(2);
  }
  if (digits.startsWith('923') && digits.length === 12) {
    return digits;
  }
  if (digits.startsWith('03') && digits.length === 11) {
    return `92${digits.slice(1)}`;
  }
  if (digits.startsWith('3') && digits.length === 10) {
    return `92${digits}`;
  }

  return null;
}

/**
 * Generates customer WhatsApp URL only if the customer's phone is valid.
 * Returns null if the phone is missing or invalid so the UI can disable/suppress the button.
 */
export function generateCustomerWhatsAppUrl(
  customerPhone?: string | null,
  text: string = ''
): string | null {
  const normalized = normalizeCustomerPakistaniPhone(customerPhone);
  if (!normalized) return null;
  const encodedText = text ? encodeURIComponent(text) : '';
  return `https://wa.me/${normalized}${encodedText ? `?text=${encodedText}` : ''}`;
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
