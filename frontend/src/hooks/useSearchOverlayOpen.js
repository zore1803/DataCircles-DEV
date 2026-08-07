import { useEffect, useState } from "react";

/*
 * Whether a full-screen overlay (the global search panel, a create/edit
 * side-panel, ...) is currently open, so the sidebar and each page's own
 * fixed footer can dim/blur themselves to match.
 *
 * Each such overlay owns its own open/closed state locally, but the dim/blur
 * treatment needs to reach the sidebar (Navbar.jsx) and page footers —
 * siblings with no shared parent to lift that state into. A CustomEvent is
 * the same lightweight cross-component signal this app already uses for
 * NAV_RESET_EVENT, rather than introducing a context/store for one boolean.
 * Multiple overlays can dispatch this; it's a last-write-wins boolean, not a
 * counter, so it assumes at most one of them is open at a time.
 */
export const DIM_CHROME_EVENT = "app:dim-chrome";

export default function useSearchOverlayOpen() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onChange = (e) => setOpen(!!e.detail?.open);
    window.addEventListener(DIM_CHROME_EVENT, onChange);
    return () => window.removeEventListener(DIM_CHROME_EVENT, onChange);
  }, []);

  return open;
}
