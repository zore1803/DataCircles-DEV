import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

const TopLoadingBarContext = createContext(null);

/**
 * Lets a page report its own real loading/skeleton state so the top-edge
 * progress bar starts the instant the skeleton appears and completes the
 * instant it disappears — a direct 1:1 mapping, not a simulated timeline.
 *
 * Usage: useTopLoadingSignal(showLoadingSkeleton);
 */
export function useTopLoadingSignal(isLoading) {
  const ctx = useContext(TopLoadingBarContext);
  const idRef = useRef(Symbol("topLoadingSignal"));

  useEffect(() => {
    if (!ctx) return undefined;
    if (isLoading) {
      ctx.start(idRef.current);
    } else {
      ctx.done(idRef.current);
    }
    return () => ctx.done(idRef.current);
  }, [ctx, isLoading]);
}

/**
 * Mounted once at the app root, inside <Router>. Renders the thin top-edge
 * progress bar. Any number of pages/components can report themselves as
 * loading via useTopLoadingSignal — the bar appears the moment the first one
 * starts and completes the moment the last one finishes.
 */
export function TopLoadingBarProvider({ children }) {
  const location = useLocation();
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);

  const activeIdsRef = useRef(new Set());
  const timersRef = useRef([]);

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  const start = useCallback((id) => {
    const wasEmpty = activeIdsRef.current.size === 0;
    activeIdsRef.current.add(id);
    if (wasEmpty) {
      clearTimers();
      setVisible(true);
      setWidth(85);
    }
  }, []);

  const done = useCallback((id) => {
    if (!activeIdsRef.current.has(id)) return;
    activeIdsRef.current.delete(id);
    if (activeIdsRef.current.size !== 0) return;

    clearTimers();
    setWidth(100);
    timersRef.current.push(setTimeout(() => setVisible(false), 250));
    timersRef.current.push(setTimeout(() => setWidth(0), 500));
  }, []);

  // A route change means whatever the previous page was tracking is now
  // stale — reset so a new page starts from a clean bar.
  useEffect(() => {
    clearTimers();
    activeIdsRef.current.clear();
    setVisible(false);
    setWidth(0);
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);

  // Stable across re-renders (start/done are themselves useCallback-stable) —
  // without this, a fresh object identity on every provider render would give
  // every consumer's effect a new `ctx`, causing spurious re-registration.
  const ctxValue = useMemo(() => ({ start, done }), [start, done]);

  return (
    <TopLoadingBarContext.Provider value={ctxValue}>
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: 5,
          zIndex: 100020,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${width}%`,
            background: "linear-gradient(90deg, #0C4FCD, #34C759)",
            opacity: visible ? 1 : 0,
            transition: "width 600ms ease-out, opacity 250ms ease-out",
          }}
        />
      </div>
      {children}
    </TopLoadingBarContext.Provider>
  );
}
