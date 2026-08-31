import React from "react";

/*
 * The product's kanban/board-view glyph, from the design system.
 *
 * Pairs with TableViewIcon in every table/kanban switcher. Same conventions:
 * `size` drives both dimensions, `currentColor` fills the path, default colour
 * #1F1F1F, and the artwork's 14x18 box is padded to a 20-unit square so it
 * matches the slack the filter and sidebar glyphs carry.
 */
const KanbanViewIcon = ({ size = 16, className = "", style, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="-3 -1 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    // Attribute rather than inline style, so a caller's `text-*` class still
    // wins - see FilterIcon.
    color="#1F1F1F"
    style={style}
    aria-hidden="true"
    focusable="false"
    {...props}
  >
    <path
      d="M12 1C12 0.716667 12.0958 0.479167 12.2875 0.2875C12.4792 0.0958333 12.7167 0 13 0C13.2833 0 13.5208 0.0958333 13.7125 0.2875C13.9042 0.479167 14 0.716667 14 1V17C14 17.2833 13.9042 17.5208 13.7125 17.7125C13.5208 17.9042 13.2833 18 13 18C12.7167 18 12.4792 17.9042 12.2875 17.7125C12.0958 17.5208 12 17.2833 12 17V1ZM0 1C0 0.716667 0.0958328 0.479167 0.287499 0.2875C0.479166 0.0958333 0.716666 0 1 0C1.28333 0 1.52083 0.0958333 1.7125 0.2875C1.90417 0.479167 2 0.716667 2 1V17C2 17.2833 1.90417 17.5208 1.7125 17.7125C1.52083 17.9042 1.28333 18 1 18C0.716666 18 0.479166 17.9042 0.287499 17.7125C0.0958328 17.5208 0 17.2833 0 17V1ZM6 1C6 0.716667 6.09583 0.479167 6.2875 0.2875C6.47917 0.0958333 6.71667 0 7 0C7.28333 0 7.52083 0.0958333 7.7125 0.2875C7.90417 0.479167 8 0.716667 8 1V17C8 17.2833 7.90417 17.5208 7.7125 17.7125C7.52083 17.9042 7.28333 18 7 18C6.71667 18 6.47917 17.9042 6.2875 17.7125C6.09583 17.5208 6 17.2833 6 17V1Z"
      fill="currentColor"
    />
  </svg>
);

export default KanbanViewIcon;
