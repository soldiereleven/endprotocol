import { useState, useEffect, useCallback, useRef } from "react";
import { logDebug, logError } from "@/utils/logger";

interface UseCardDataOptions<T> {
  fetchData: () => Promise<T>;
  defaultValue?: T;
  lazy?: boolean;  // 是否懒加载
  concurrent?: boolean; // 是否支持并发请求（默认false）
}

export function useCardData<T>({
  fetchData,
  defaultValue,
  lazy = false,
}: UseCardDataOptions<T>) {
  const [data, setData] = useState<T | null>(defaultValue || null);
  const [isLoading, setIsLoading] = useState(!lazy);
  const [error, setError] = useState<Error | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const hasLoadedRef = useRef(hasLoaded);
  hasLoadedRef.current = hasLoaded;

  const fetchDataRef = useRef(fetchData);
  fetchDataRef.current = fetchData;

  const loadData = useCallback(async () => {
    if (hasLoadedRef.current && !lazy) return;

    try {
      setIsLoading(true);
      setError(null);
      logDebug("Loading card data...");
      const result = await fetchDataRef.current();
      setData(result);
      setHasLoaded(true);
      logDebug("Card data loaded successfully");
    } catch (err) {
      logError("Card data load failed:", err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [lazy]);

  useEffect(() => {
    if (!lazy) {
      loadData();
    }
  }, [loadData, lazy]);

  return { data, isLoading, error, refetch: loadData };
}
