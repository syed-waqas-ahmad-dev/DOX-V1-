/**
 * @file lib/slugify.ts
 * @description URL-friendly slug generation with unique fallback suffix.
 * Strict TypeScript: ZERO `any`.
 */

export function slugify(text: string): string {
  const base = text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^\w-]+/g, '') // Remove all non-word chars
    .replace(/--+/g, '-') // Replace multiple - with single -
    .replace(/^-+/, '') // Trim - from start
    .replace(/-+$/, ''); // Trim - from end

  return base || `item-${Date.now().toString(36)}`;
}
