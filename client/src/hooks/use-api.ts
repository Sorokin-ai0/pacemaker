import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import { toApiError, type ApiError } from "@/api/http";

export interface UseApiResult<T> {
  data: T | null;
  /** Exposed so pages can apply local mutations after PATCH/POST/DELETE. */
  setData: Dispatch<SetStateAction<T | null>>;
  loading: boolean;
  error: ApiError | null;
  reload: () => void;
}

/**
 * Minimal data-fetch hook: runs the fetcher on mount and on reload().
 * The latest fetcher is kept in a ref so callers can pass inline closures.
 */
export function useApi<T>(fetcher: () => Promise<T>): UseApiResult<T> {
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetcherRef.current().then(
      (result) => {
        if (cancelled) return;
        setData(result);
        setLoading(false);
      },
      (err: unknown) => {
        if (cancelled) return;
        setError(toApiError(err));
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  return { data, setData, loading, error, reload };
}
