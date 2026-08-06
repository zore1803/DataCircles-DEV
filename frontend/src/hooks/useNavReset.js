import { useEffect, useRef } from "react";

/*
 * Runs `handler` when the user clicks the sidebar entry for the page they're
 * already on.
 *
 * React Router can't help here: the path doesn't change, so there's no
 * navigation to react to. But panels, drawers and modals are component state
 * layered *over* a page, so from the user's point of view they're inside a
 * sub-view and clicking the nav item should take them back out. The Navbar
 * emits `app:nav-reset` for that case; pages that stack overlays listen and
 * close them.
 */
export const NAV_RESET_EVENT = "app:nav-reset";

export default function useNavReset(handler) {
  // Kept in a ref so a handler that closes over changing state doesn't need to
  // be memoised at every call site to avoid re-subscribing.
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const onReset = (e) => handlerRef.current?.(e.detail);
    window.addEventListener(NAV_RESET_EVENT, onReset);
    return () => window.removeEventListener(NAV_RESET_EVENT, onReset);
  }, []);
}
