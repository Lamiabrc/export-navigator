import type { PostgrestError } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PostgrestFilterBuilderLike<T> = any;

export async function fetchAllWithPagination<T>(
  buildQuery: (from: number, to: number) => PostgrestFilterBuilderLike<T>,
  pageSize = 1000
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await buildQuery(from, to);

    if (error) {
      const wrapped = new Error(
        `Supabase pagination query failed: ${error.message}`
      ) as Error & { status?: number; details?: string; hint?: string; code?: string };
      wrapped.status = (error as PostgrestError).code ? (error as any).status : (error as any).status;
      wrapped.details = (error as any).details;
      wrapped.hint = (error as any).hint;
      wrapped.code = (error as any).code;
      throw wrapped;
    }

    const batch = (data ?? []) as T[];
    all.push(...batch);

    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return all;
}
