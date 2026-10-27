/**
 * @file lib/formatters/currency.ts
 * @description Format Pakistani Rupee currency with commas and symbols.
 * Strict TypeScript: ZERO `any`.
 */

/**
 * Formats a number to Pakistani Rupee representation.
 * Example: 4500 -> "PKR 4,500" or "Rs. 4,500"
 */
export function formatPKR(amount: number, prefix: 'PKR' | 'Rs.' = 'PKR'): string {
  const rounded = Math.round(amount || 0);
  const formatted = rounded.toLocaleString('en-PK');
  return `${prefix} ${formatted}`;
}

/**
 * Formats price in Urdu script: "روپے ۴,۵۰۰"
 */
export function formatPKRUrdu(amount: number): string {
  const rounded = Math.round(amount || 0);
  return `روپے ${rounded.toLocaleString('en-PK')}`;
}
