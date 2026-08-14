/**
 * Shared shadow treatment for pinned (sticky) table columns — a soft
 * depth edge instead of a flat border or a solid background tint, so a
 * pinned column reads as "floating" above the scrollable content behind
 * it (the same visual language as Linear/Notion/Airtable), without
 * recoloring the whole column.
 *
 * Applied to the BOUNDARY CELL OF THE PINNED BLOCK ITSELF — the last
 * left-pinned column, or the first right-pinned one — as a fixed-width
 * strip hugging the edge that faces the scrollable columns. Two earlier
 * approaches were tried and rejected:
 *   - box-shadow: its blur/spread radius softens all four sides of the
 *     cell's box, not just the vertical boundary — stacked down a column
 *     of rows that shows up as visible shading on every horizontal row
 *     border too.
 *   - a gradient sized to 100% of the cell's own width: on a wide column
 *     (e.g. a name column) that reads as the whole column being tinted,
 *     not a thin edge shadow.
 * A gradient capped at a small fixed pixel width via `backgroundSize`,
 * `backgroundRepeat: no-repeat` and anchored with `backgroundPosition`
 * stays a slim edge regardless of the column's width, and — since every
 * row's cell paints the identical strip — tiles into one seamless line
 * from the header down to the last row.
 *
 * Applied via inline styles (not a CSS class) because which cell needs it
 * is computed per-cell from JS (isLeftBoundary / isRightBoundary), and
 * every table that uses this computes sticky offsets in JS too — a class
 * would still need a JS-driven modifier. Centralizing it here means every
 * table's boundary treatment updates from one place instead of nine
 * duplicated copies. Spread the returned object into the cell's `style`;
 * it layers alongside the cell's existing `background-color` (a separate
 * CSS property) rather than replacing it.
 */

/*
 * Legacy inset box-shadow fragments. The company detail tabs
 * (CompanyContactsTab, CompanyInvoicesTab, CompanyMeetingsTab,
 * CompanyNotesTab, CompanyTasksTab) concatenate these into a larger
 * `box-shadow` string alongside their own 1px inset border lines, so they
 * need string values rather than the style object below. Kept as `inset`
 * because those tables layer them with inset borders in one shorthand.
 */
export const PINNED_LEFT_BOUNDARY_SHADOW =
  "inset -10px 0 12px -6px rgba(0, 0, 0, 0.3)";

export const PINNED_RIGHT_BOUNDARY_SHADOW =
  "inset 10px 0 12px -6px rgba(0, 0, 0, 0.3)";

const STRIP_WIDTH = "16px";

// For the LAST left-pinned column — a strip on its own right edge,
// darkening toward the scrollable columns it sits in front of.
const LEFT_BOUNDARY_STYLE = {
  backgroundImage:
    "linear-gradient(to right, transparent 0%, rgba(0, 0, 0, 0.16) 100%)",
  backgroundSize: `${STRIP_WIDTH} 100%`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right",
};

// For the FIRST right-pinned column — mirrors the above on its left edge.
const RIGHT_BOUNDARY_STYLE = {
  backgroundImage:
    "linear-gradient(to left, transparent 0%, rgba(0, 0, 0, 0.16) 100%)",
  backgroundSize: `${STRIP_WIDTH} 100%`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "left",
};

const NO_STYLE = {
  backgroundImage: undefined,
  backgroundSize: undefined,
  backgroundRepeat: undefined,
  backgroundPosition: undefined,
};

export function getPinnedBoundaryShadow(isLeftBoundary, isRightBoundary) {
  if (isLeftBoundary) return LEFT_BOUNDARY_STYLE;
  if (isRightBoundary) return RIGHT_BOUNDARY_STYLE;
  return NO_STYLE;
}

/*
 * Style for an absolutely-positioned overlay element rendered INSIDE the
 * boundary cell but offset so it hangs entirely OUTSIDE that cell's box
 * (`right: -STRIP_WIDTH` / `left: -STRIP_WIDTH`).
 *
 * This is what lets the shadow fall past the pinned column onto the
 * scrolling area without being painted into any other column's own
 * background — the strip belongs to the pinned cell, it just overflows
 * beyond its edge. That distinction matters because the neighbouring
 * column scrolls underneath: tinting the neighbour's background would
 * scroll the shadow away with it, while this stays welded to the pinned
 * edge.
 *
 * Requirements at the call site:
 *   - the cell must be positioned (`sticky`/`relative`), which the pinned
 *     cells already are, so the overlay anchors to it;
 *   - the cell must NOT set `overflow: hidden`, or the overflowing strip
 *     gets clipped away;
 *   - render it as the cell's last child, e.g.
 *     `{shadowSide && <div style={getPinnedBoundaryOverlayStyle(shadowSide)} />}`.
 */
export function getPinnedBoundaryOverlayStyle(side) {
  const isLeft = side === "left";
  return {
    position: "absolute",
    top: 0,
    bottom: 0,
    [isLeft ? "right" : "left"]: `-${STRIP_WIDTH}`,
    width: STRIP_WIDTH,
    // Gradient runs away from the pinned edge, so it's darkest where it
    // meets the pinned column and fades out over the scrolling content.
    backgroundImage: isLeft
      ? "linear-gradient(to right, rgba(0, 0, 0, 0.16) 0%, transparent 100%)"
      : "linear-gradient(to left, rgba(0, 0, 0, 0.16) 0%, transparent 100%)",
    pointerEvents: "none",
    zIndex: 1,
  };
}
