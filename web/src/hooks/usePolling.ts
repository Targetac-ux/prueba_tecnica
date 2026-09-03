import { useEffect, useRef } from 'react';

export function usePolling(callback: () => void, intervalMs: number, enabled: boolean) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return undefined;

    function tick() {
      if (document.visibilityState === 'visible') {
        savedCallback.current();
      }
    }

    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled]);
}
