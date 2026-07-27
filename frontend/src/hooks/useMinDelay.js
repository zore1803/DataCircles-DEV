import { useEffect, useRef, useState } from "react";

/**
 * Keeps a loading flag `true` for at least `minMs`, even if the underlying
 * fetch resolves faster — prevents a skeleton from flashing on/off in a
 * single frame when the API responds quickly (e.g. Companies/Contacts list
 * fetches typically land well under 300ms).
 *
 * Usage: const showSkeleton = useMinDelay(loading && rows.length === 0, 300);
 */
export default function useMinDelay(isLoading, minMs = 300) {
  const [shown, setShown] = useState(isLoading);
  const startRef = useRef(isLoading ? Date.now() : null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (isLoading) {
      startRef.current = Date.now();
      if (timerRef.current) clearTimeout(timerRef.current);
      setShown(true);
      return;
    }

    const elapsed = startRef.current ? Date.now() - startRef.current : minMs;
    const remaining = Math.max(0, minMs - elapsed);

    if (remaining === 0) {
      setShown(false);
      return;
    }

    timerRef.current = setTimeout(() => setShown(false), remaining);
    return () => clearTimeout(timerRef.current);
  }, [isLoading, minMs]);

  return shown;
}
