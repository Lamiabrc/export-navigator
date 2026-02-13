import type { PostgrestError } from "@supabase/supabase-js";

type PostgrestFilterBuilderLike = PromiseLike<{
  data: unknown[] | null;
  error: PostgrestError | null;
}>;

export async function fetchAllWithPagination<T>(
  buildQuery: (from: number, to: number) => PostgrestFilterBuilderLike,
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
      const errorWithStatus = error as PostgrestError & { status?: number };
      wrapped.status = errorWithStatus.status;
      wrapped.details = error.details ?? undefined;
      wrapped.hint = error.hint ?? undefined;
      wrapped.code = error.code ?? undefined;
      throw wrapped;
    }

    const batch = (data ?? []) as T[];
    all.push(...batch);

    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return all;
}
