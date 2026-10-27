/**
 * @file lib/db/pagination.ts
 * @description Enterprise pagination helper with type-safe lean queries,
 * metadata calculation, and cursor support for OX Shoes.
 * Strict TypeScript: ZERO `any`.
 */

import type { Model, Query } from 'mongoose';
import type { Filter } from 'mongodb';
import type { IPaginatedResult, IPaginationOptions } from '@/types';

/**
 * Paginates a Mongoose model query with strict typing and lean performance optimization.
 *
 * @template T - Interface type of the document
 * @param model - Mongoose Model instance
 * @param filter - Filter query matching documents
 * @param options - Pagination options (page, limit, sort, select, populate, lean)
 * @returns Standardized pagination result with docs and metadata
 */
export async function paginateQuery<T>(
  model: Model<T>,
  filter: Filter<T> = {},
  options: IPaginationOptions = {}
): Promise<IPaginatedResult<T>> {
  const page = Math.max(1, Number(options.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(options.limit) || 10)); // Cap limit to 100 for safety
  const skip = (page - 1) * limit;

  // Execute count and query concurrently
  const countPromise = model.countDocuments(filter).exec();

  let query: Query<unknown, unknown> = model.find(filter);

  if (options.select) {
    query = query.select(options.select);
  }

  if (options.sort) {
    query = query.sort(options.sort);
  } else {
    // Default descending by createdAt if not specified
    query = query.sort({ createdAt: -1 });
  }

  query = query.skip(skip).limit(limit);

  if (options.populate) {
    if (typeof options.populate === 'string') {
      query = query.populate(options.populate);
    } else {
      query = query.populate(options.populate);
    }
  }

  if (options.lean !== false) {
    query = query.lean();
  }

  const [totalDocs, rawDocs] = await Promise.all([countPromise, query.exec()]);

  const totalPages = Math.ceil(totalDocs / limit) || 1;
  const hasPrevPage = page > 1;
  const hasNextPage = page < totalPages;
  const prevPage = hasPrevPage ? page - 1 : null;
  const nextPage = hasNextPage ? page + 1 : null;

  return {
    docs: (rawDocs as unknown) as T[],
    totalDocs,
    limit,
    page,
    totalPages,
    hasPrevPage,
    hasNextPage,
    prevPage,
    nextPage,
  };
}
