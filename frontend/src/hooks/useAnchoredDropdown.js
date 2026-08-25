import { useLayoutEffect, useRef, useState } from "react";
import { getAncestorZoom } from "../utils/domUtils";

// Every form panel that uses this hook is the same fixed-inset card
// (.dc-panel-card, see index.css: bottom: 1.5rem) with a ~56px sticky
// footer at its very bottom holding Cancel/Save. Reserving that much space
// off the panel's own (always-findable) bottom edge is far more reliable
// than looking up the footer element itself and trusting its measured
// height/position to be current at the exact moment the dropdown opens.
const FOOTER_RESERVE = 64;

/*
 * Positions a portal'd dropdown popup against its trigger button using real
 * viewport coordinates (so it's never clipped by a scrollable modal body),
 * clamps its height so it never renders over the form's sticky footer, and
 * flips it above the trigger if even that clamped space is too cramped.
 *
 * Usage:
 *   const { pos, btnRef, popupRef } = useAnchoredDropdown(isOpen);
 *   <button ref={btnRef} onClick={...}>...</button>
 *   {isOpen && pos && createPortal(
 *     <div ref={popupRef} style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }}>...</div>,
 *     document.body
 *   )}
 */
export default function useAnchoredDropdown(isOpen) {
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const popupRef = useRef(null);
  const hasFlippedRef = useRef(false);

  // Phase 1: place below the trigger as soon as it opens, clamped against
  // the panel's bottom edge (minus the reserved footer strip).
  useLayoutEffect(() => {
    if (!isOpen) {
      setPos(null);
      hasFlippedRef.current = false;
      return;
    }
    if (!btnRef.current) return;
    const zoom = getAncestorZoom(document.body);
    const MARGIN = 8;
    const rect = btnRef.current.getBoundingClientRect();
    const panel = btnRef.current.closest(".dc-panel-card");
    const boundaryTop = panel
      ? panel.getBoundingClientRect().bottom / zoom - FOOTER_RESERVE
      : window.innerHeight / zoom - MARGIN;

    const top = rect.bottom / zoom + 4;
    setPos({
      top,
      left: rect.left / zoom,
      width: rect.width / zoom,
      maxHeight: Math.max(80, boundaryTop - top),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Phase 2: once the popup has actually rendered, check whether even the
  // clamped space was too cramped (menu still tight against maxHeight with
  // basically nothing to show) and flip above the trigger instead.
  useLayoutEffect(() => {
    if (!isOpen || !pos || hasFlippedRef.current) return;
    if (!popupRef.current || !btnRef.current) return;
    if (pos.maxHeight >= 120) return; // plenty of room, no need to flip

    const zoom = getAncestorZoom(document.body);
    const MARGIN = 8;
    const menuHeight = popupRef.current.getBoundingClientRect().height / zoom;
    const btnRect = btnRef.current.getBoundingClientRect();
    const flippedTop = btnRect.top / zoom - menuHeight - 4;
    hasFlippedRef.current = true;
    if (flippedTop > MARGIN) {
      setPos((p) => ({ ...p, top: flippedTop, maxHeight: btnRect.top / zoom - MARGIN - 4 }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, pos]);

  return { pos, btnRef, popupRef };
}
