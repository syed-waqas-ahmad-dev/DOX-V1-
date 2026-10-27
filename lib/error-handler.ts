/**
 * @file lib/error-handler.ts
 * @description Central error converter turning exceptions into safe ActionResult payloads.
 * Strict TypeScript: ZERO `any`.
 */

import { ZodError } from 'zod';
import { errorResponse, type ActionResult } from './response';

export function handleActionError<T = never>(error: unknown): ActionResult<T> {
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of error.issues) {
      const path = issue.path.join('.') || 'general';
      if (!fieldErrors[path]) {
        fieldErrors[path] = [];
      }
      fieldErrors[path].push(issue.message);
    }
    return errorResponse<T>('Validation failed. Please correct the highlighted fields.', fieldErrors);
  }

  if (error instanceof Error) {
    return errorResponse<T>(error.message);
  }

  return errorResponse<T>('An unexpected error occurred. Please try again.');
}
