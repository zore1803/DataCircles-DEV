import { useState, useEffect, useRef } from "react";

/**
 * useMinDelay
 *
 * Returns `true` while `condition` is true, but keeps it `true` for at least
 * `minMs` milliseconds after `condition` first becomes false. This prevents
 * skeleton/loading UI from flashing for very fast data fetches.
 *
 * @param {boolean} condition  - The "is loading" boolean from the caller.
 * @param {number}  minMs      - Minimum time (ms) to stay true after condition
 *                               goes false. Default 300ms.
 * @returns {boolean}
 */
export default function useMinDelay(condition, minMs = 300) {
  const [delayed, setDelayed] = useState(condition);
  const timerRef = useRef(null);

  useEffect(() => {
    if (condition) {
      // While condition is true, stay true immediately (cancel any pending off-timer).
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setDelayed(true);
    } else {
      // Condition went false — wait minMs before turning off.
      timerRef.current = setTimeout(() => {
        setDelayed(false);
        timerRef.current = null;
      }, minMs);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [condition, minMs]);

  return delayed;
}
