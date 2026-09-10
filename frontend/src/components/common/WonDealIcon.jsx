/*
 * The product's "won deal" glyph (thumbs up), from the design system.
 * Pairs with LostDealIcon. It's a 21x20 viewBox, so sizing it with the
 * usual `w-4 h-4` keeps it centred inside a square icon slot without
 * stretching; the path is filled with `currentColor`, so colour comes
 * from a `text-*` class.
 */
const WonDealIcon = ({ className = "w-4 h-4", ...props }) => (
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
      d="M19 6.4C19.5333 6.4 20 6.6 20.4 7C20.8 7.4 21 7.86667 21 8.4V10.4C21 10.5167 20.9833 10.6417 20.95 10.775C20.9167 10.9083 20.8833 11.0333 20.85 11.15L17.85 18.2C17.7 18.5333 17.45 18.8167 17.1 19.05C16.75 19.2833 16.3833 19.4 16 19.4H5V6.4L11 0.45C11.25 0.2 11.5458 0.0541667 11.8875 0.0125C12.2292 -0.0291667 12.5583 0.0333333 12.875 0.2C13.1917 0.366667 13.425 0.6 13.575 0.9C13.725 1.2 13.7583 1.50833 13.675 1.825L12.55 6.4H19ZM7 7.25V17.4H16L19 10.4V8.4H10L11.35 2.9L7 7.25ZM2 19.4C1.45 19.4 0.979167 19.2042 0.5875 18.8125C0.195833 18.4208 0 17.95 0 17.4V8.4C0 7.85 0.195833 7.37917 0.5875 6.9875C0.979167 6.59583 1.45 6.4 2 6.4H5V8.4H2V17.4H5V19.4H2Z"
      fill="currentColor"
    />
  </svg>
);

export default WonDealIcon;
