import React from "react";

/*
 * The product's filter glyph, from the design system.
 *
 * The one filter mark in the app - every filter button, panel header and
 * empty state renders this, so they can't drift apart. `size` sets both
 * dimensions and the path is filled with `currentColor`, so colour comes from
 * a `text-*` class or an inline style.
 *
 * The viewBox is the artwork's own 16x16 box padded to a 17.78-unit square,
 * which centres the funnel and leaves the same 10% slack the sidebar glyphs
 * carry - so at a given `size` it reads at the same weight as they do.
 */
const FilterIcon = ({ size = 16, className = "", style, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="-0.89 -0.89 17.78 17.78"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    // Presentation *attribute*, not an inline style: the path is filled with
    // currentColor, and an attribute loses to any CSS, so a caller's `text-*`
    // class (e.g. the active-filter blue) still wins while bare usages get
    // #1F1F1F.
    color="#1F1F1F"
    style={style}
    aria-hidden="true"
    focusable="false"
    {...props}
  >
    <path
      d="M7.02059 16C6.73725 16 6.49975 15.9042 6.30809 15.7125C6.11642 15.5208 6.02059 15.2833 6.02059 15V9L0.220588 1.6C-0.0294118 1.26667 -0.0669118 0.916667 0.108088 0.55C0.283088 0.183333 0.587255 0 1.02059 0H15.0206C15.4539 0 15.7581 0.183333 15.9331 0.55C16.1081 0.916667 16.0706 1.26667 15.8206 1.6L10.0206 9V15C10.0206 15.2833 9.92476 15.5208 9.73309 15.7125C9.54142 15.9042 9.30392 16 9.02059 16H7.02059ZM8.02059 8.3L12.9706 2H3.07059L8.02059 8.3Z"
      fill="currentColor"
    />
  </svg>
);

export default FilterIcon;
