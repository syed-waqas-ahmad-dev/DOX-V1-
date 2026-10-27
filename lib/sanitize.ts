/**
 * @file lib/sanitize.ts
 * @description Enterprise input sanitization and XSS mitigation utilities.
 * Strips dangerous HTML tags, javascript: links, and malicious payloads from UGC.
 * Strict TypeScript: ZERO `any`.
 */

const HTML_ENTITY_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
};

/**
 * Escapes unsafe HTML characters to prevent XSS in rendered templates or outputs.
 */
export function escapeHtml(input: unknown): string {
  if (typeof input !== 'string') {
    if (input === null || input === undefined) return '';
    return String(input);
  }
  return input.replace(/[&<>"'/`]/g, (char) => HTML_ENTITY_MAP[char] || char);
}

/**
 * Strips all HTML markup from a string (plain-text conversion).
 */
export function stripHtml(input: unknown): string {
  if (typeof input !== 'string') {
    if (input === null || input === undefined) return '';
    return String(input);
  }
  return input.replace(/<\/?[^>]+(>|$)/g, '').trim();
}

/**
 * Sanitizes user review comments, customer notes, or feedback text.
 */
export function sanitizeUserComment(input: unknown): string {
  const stripped = stripHtml(input);
  // Remove dangerous script / javascript protocols
  const clean = stripped
    .replace(/javascript:/gi, '')
    .replace(/data:text\/html/gi, '')
    .replace(/vbscript:/gi, '');
  return clean.slice(0, 2000);
}

/**
 * Validates and normalizes Pakistani phone numbers (03xx-xxxxxxx, +923xxxxxxxxx).
 */
export function sanitizePakistaniPhone(phone: unknown): string {
  if (typeof phone !== 'string') return '';
  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.startsWith('92') && digitsOnly.length === 12) {
    return `+${digitsOnly}`;
  }
  if (digitsOnly.startsWith('03') && digitsOnly.length === 11) {
    return `+92${digitsOnly.slice(1)}`;
  }
  if (digitsOnly.startsWith('3') && digitsOnly.length === 10) {
    return `+92${digitsOnly}`;
  }
  return phone.trim();
}
