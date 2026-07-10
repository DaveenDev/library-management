import { useCallback, useEffect, useState } from "react";
import type { Paginated } from "@lumen/shared";
import type { ListParams } from "./api.ts";

export function usePaginated<T>(
  fetcher: (p: ListParams) => Promise<Paginated<T>>,
  params: ListParams,
  deps: unknown[],
) {
  const [data, setData] = useState<Paginated<T>>({ items: [], total: 0, page: 1, pageSize: params.pageSize ?? 20 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetcher(params)
      .then((res) => { if (!cancelled) { setData(res); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { data, loading, error, refresh };
}

export function useAsync<T>(fetcher: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetcher()
      .then((res) => { if (!cancelled) { setData(res); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { data, loading, error, refresh };
}

export function paginationProps(total: number, page: number, pageSize: number, setPage: (n: number) => void, setPageSize: (n: number) => void) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return {
    from, to, total, pageSize,
    disablePrev: page <= 1,
    disableNext: page >= totalPages,
    onPrev: () => setPage(Math.max(1, page - 1)),
    onNext: () => setPage(Math.min(totalPages, page + 1)),
    onPageSize: (n: number) => { setPageSize(n); setPage(1); },
  };
}
