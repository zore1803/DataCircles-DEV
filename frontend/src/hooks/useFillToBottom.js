import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

// Minimum height the container will ever be given, so a mis-measurement (or a
// very short window) can never collapse the table to nothing.
const MIN_HEIGHT = 180;

/**
 * Sizes a container to fill exactly the remaining viewport space, with an
 * optional element (e.g. a pagination bar) reserved below it — matching how
 * Companies.jsx/Deals.jsx/Tasks.jsx behave via their own position:fixed +
 * top/bottom anchoring: the box is always the same height regardless of how
 * many rows it holds, and a short list leaves empty space inside the box
 * rather than shrinking it.
 *
 * This is an EXACT height, not a cap — deliberately, to match those pages.
 * (An earlier version of this hook used max-height instead, so a short list
 * would shrink the box and let the pagination bar sit right under the last
 * row. That was a real, intentional design — it was reverted specifically so
 * these tabs read as consistent with the rest of the app, not because it was
 * wrong on its own terms.)
 *
 * Why this measures instead of using a `calc(100vh - <constant>)`:
 * the height of everything above the container is not knowable as a constant
 * here. It changes with the KPI row toggle, with a wrapped company address,
 * with the admin-notice banner, and — because the KPI grid reflows from 6
 * columns to 3 below 1024px — with the viewport width itself. A constant would
 * need a different value per breakpoint per state, and would still be wrong
 * whenever the banner appears.
 *
 * Zoom handling: this app stacks two CSS `zoom` layers (#root at 0.75 and the
 * dynamic <html> zoom from App.jsx), both only active >=1024px. `zoom` is read
 * directly off the elements rather than inferred, so no breakpoint logic is
 * needed here — below 1024px both read 1 and the math collapses to the plain
 * case.
 *
 * Usage:
 *   const { containerRef, footerRef, style } = useFillToBottom();
 *   <div ref={containerRef} style={style} className="overflow-y-auto">…</div>
 *   <div ref={footerRef}>…pagination…</div>
 *
 * `footerRef` is optional — omit it if nothing needs to stay visible below.
 */
export default function useFillToBottom() {
  const containerRef = useRef(null);
  const footerRef = useRef(null);
  const [height, setHeight] = useState(null);

  const measure = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    // Exact total zoom: walk the ancestor chain multiplying every `zoom`.
    // Same approach as getAncestorZoom() in pages/Companies.jsx.
    let scale = 1;
    for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
      const z = parseFloat(getComputedStyle(node).zoom);
      if (z && !Number.isNaN(z)) scale *= z;
    }

    const rect = el.getBoundingClientRect();

    // Browsers disagree on whether getBoundingClientRect() reports visual
    // (zoom-scaled) or layout coordinates — this codebase carries contradictory
    // comments about it, from either side of the change that standardised
    // `zoom`. Rather than assume, work out which one this browser is doing by
    // comparing the measured height against the computed (always CSS px) one.
    // When scale === 1 both branches agree, so this is a no-op without zoom.
    const cssHeight = parseFloat(getComputedStyle(el).height) || rect.height || 1;
    const rectToVisual =
      Math.abs(rect.height - cssHeight * scale) <= Math.abs(rect.height - cssHeight)
        ? 1
        : scale;

    // The footer sits OUTSIDE the container, so both its height and the gap
    // between the two (its top margin) have to be reserved. The gap is a fixed
    // margin — it doesn't move when the container's height changes — so reading
    // it here is stable rather than circular.
    let footerReserve = 0;
    if (footerRef.current) {
      const footerRect = footerRef.current.getBoundingClientRect();
      const gap = Math.max(0, footerRect.top - rect.bottom);
      footerReserve = (footerRect.height + gap) * rectToVisual;
    }

    // Space left on screen below the container's top edge, in visual px...
    const availableVisual =
      window.innerHeight - rect.top * rectToVisual - footerReserve;
    // ...converted back into the CSS px that `height` is expressed in.
    setHeight(Math.max(MIN_HEIGHT, availableVisual / scale));
  }, []);

  useLayoutEffect(() => {
    measure();

    // Observing <body> catches everything that shifts the container's top
    // without a window resize: the KPI toggle, the admin-notice banner, a
    // wrapped address, fonts finishing loading.
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    if (containerRef.current?.parentElement) {
      observer.observe(containerRef.current.parentElement);
    }
    window.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  // The zoom in App.jsx is applied from its own effect, which may land after
  // this one on first paint. Re-measure once on the next frame so the initial
  // height isn't computed against a stale zoom.
  useEffect(() => {
    const raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, [measure]);

  return {
    containerRef,
    footerRef,
    style: height == null ? undefined : { height: `${height}px` },
  };
}
