import { useCallback, useEffect, useState } from "react";
import type { Paginated } from "@lumen/shared";
import type { ListParams } from "./api.ts";

/**
 * Both hooks below identify a request by a key built from its dependencies,
 * and store that key alongside whatever the request settled to.
 *
 * `loading` is then derived — a request is in flight exactly while the
 * settled result belongs to a different key — instead of being a second piece
 * of state that the effect has to switch on synchronously before fetching.
 * That extra `setLoading(true)` was a render caused by a render.
 */
const requestKey = (deps: unknown[], nonce: number) => JSON.stringify([deps, nonce]);

interface Settled<T> {
  key: string;
  data: T;
  error: string | null;
}

export function usePaginated<T>(
  fetcher: (p: ListParams) => Promise<Paginated<T>>,
  params: ListParams,
  deps: unknown[],
) {
  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);
  const key = requestKey(deps, nonce);

  const [settled, setSettled] = useState<Settled<Paginated<T>>>({
    // No request has settled yet, so the empty key can never match one.
    key: "",
    data: { items: [], total: 0, page: 1, pageSize: params.pageSize ?? 20 },
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    fetcher(params)
      .then((res) => { if (!cancelled) setSettled({ key, data: res, error: null }); })
      // The previous page stays on screen behind the error rather than
      // blanking out, which is what the original did too.
      .catch((e) => { if (!cancelled) setSettled((prev) => ({ key, data: prev.data, error: e.message })); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { data: settled.data, loading: settled.key !== key, error: settled.error, refresh };
}

export function useAsync<T>(fetcher: () => Promise<T>, deps: unknown[]) {
  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);
  const key = requestKey(deps, nonce);

  const [settled, setSettled] = useState<Settled<T | null>>({ key: "", data: null, error: null });

  useEffect(() => {
    let cancelled = false;
    fetcher()
      .then((res) => { if (!cancelled) setSettled({ key, data: res, error: null }); })
      .catch((e) => { if (!cancelled) setSettled((prev) => ({ key, data: prev.data, error: e.message })); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { data: settled.data, loading: settled.key !== key, error: settled.error, refresh };
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
