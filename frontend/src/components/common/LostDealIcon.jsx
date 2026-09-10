/*
 * The product's "lost deal" glyph (thumbs down), from the design system.
 * It's a 21x20 viewBox, so sizing it with the usual `w-4 h-4` keeps it
 * centred inside a square icon slot without stretching; the path is
 * filled with `currentColor`, so colour comes from a `text-*` class.
 */
const LostDealIcon = ({ className = "w-4 h-4", ...props }) => (
  <svg
    viewBox="0 0 21 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
    focusable="false"
    {...props}
  >
    <path
      d="M2 13C1.46667 13 1 12.8 0.6 12.4C0.2 12 0 11.5333 0 11V9C0 8.88333 0.0166667 8.75833 0.05 8.625C0.0833333 8.49167 0.116667 8.36667 0.15 8.25L3.15 1.2C3.3 0.866667 3.55 0.583333 3.9 0.35C4.25 0.116667 4.61667 0 5 0H16V13L10 18.95C9.75 19.2 9.45417 19.3458 9.1125 19.3875C8.77083 19.4292 8.44167 19.3667 8.125 19.2C7.80833 19.0333 7.575 18.8 7.425 18.5C7.275 18.2 7.24167 17.8917 7.325 17.575L8.45 13H2ZM14 12.15V2H5L2 9V11H11L9.65 16.5L14 12.15ZM19 0C19.55 0 20.0208 0.195833 20.4125 0.5875C20.8042 0.979167 21 1.45 21 2V11C21 11.55 20.8042 12.0208 20.4125 12.4125C20.0208 12.8042 19.55 13 19 13H16V11H19V2H16V0H19Z"
      fill="currentColor"
    />
  </svg>
);

export default LostDealIcon;
