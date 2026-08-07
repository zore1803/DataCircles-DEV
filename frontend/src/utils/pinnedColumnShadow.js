/**
 * Shared shadow treatment for pinned (sticky) table columns — a soft
 * depth shadow instead of a flat border or a solid background tint, so a
 * pinned column reads as "floating" above the scrollable content behind
 * it (the same visual language as Linear/Notion/Airtable), without
 * recoloring the whole column.
 *
 * MUST stay `inset`. A regular (outer) box-shadow surrounds all four
 * edges of the element's box, not just the boundary edge — with blur and
 * no matching negative spread it bled onto the neighboring column (e.g.
 * the checkbox column sitting to the pinned column's left) and into the
 * row above/below, changing cells nothing here is meant to touch.
 * `inset` shadows are clipped to the element's own border box, so they
 * can only ever affect the pinned cell they're applied to.
 *
 * Applied via inline `boxShadow` (not a CSS class) because the two
 * variants are already selected per-cell from JS (isLeftBoundary /
 * isRightBoundary), and every table that uses this computes sticky
 * offsets in JS too — a class would still need a JS-driven modifier.
 * Centralizing the two literal strings here means every table's shadow
 * updates from one place instead of nine duplicated copies.
 */

// Right shadow — for the last column of a LEFT-pinned block. Fades onto
// the scrollable column to its right.
export const PINNED_LEFT_BOUNDARY_SHADOW =
  "inset 8px 0 10px -6px rgba(0, 0, 0, 0.18)";

// Left shadow — for the first column of a RIGHT-pinned block. Mirrors the
// above, fading onto the scrollable column to its left.
export const PINNED_RIGHT_BOUNDARY_SHADOW =
  "inset -8px 0 10px -6px rgba(0, 0, 0, 0.18)";

export function getPinnedBoundaryShadow(isLeftBoundary, isRightBoundary) {
  if (isLeftBoundary) return PINNED_LEFT_BOUNDARY_SHADOW;
  if (isRightBoundary) return PINNED_RIGHT_BOUNDARY_SHADOW;
  return "";
}
