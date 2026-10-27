/**
 * @file lib/formatters/date.ts
 * @description Format timestamps and delivery estimates for Pakistani customers.
 * Deterministic formatting to prevent SSR/client hydration mismatches.
 * Strict TypeScript: ZERO `any`.
 */

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function formatDate(date: string | Date | number): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'N/A';
  const day = d.getUTCDate();
  const month = MONTH_NAMES[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

export function formatDateTime(date: string | Date | number): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'N/A';
  const day = d.getUTCDate();
  const month = MONTH_NAMES[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const mins = String(d.getUTCMinutes()).padStart(2, '0');
  return `${day} ${month} ${year}, ${hours}:${mins} UTC`;
}

export function getEstimatedDeliveryRange(daysMin = 2, daysMax = 4): string {
  const now = new Date();
  const minDate = new Date(now.getTime() + daysMin * 24 * 60 * 60 * 1000);
  const maxDate = new Date(now.getTime() + daysMax * 24 * 60 * 60 * 1000);
  const minDay = minDate.getUTCDate();
  const minMonth = MONTH_NAMES[minDate.getUTCMonth()];
  const maxDay = maxDate.getUTCDate();
  const maxMonth = MONTH_NAMES[maxDate.getUTCMonth()];

  return `${minMonth} ${minDay} – ${maxMonth} ${maxDay}`;
}
