/*
 * The product's plain phone-handset glyph ("call, cellphone only" — no
 * plus/arrow badge), from the design system. Replaces lucide's plain
 * <Phone /> everywhere it's used as a generic call/phone-number icon. It's
 * a square 18x18 viewBox, so sizing it with the usual `w-4 h-4` keeps it
 * centred inside its box with no optical offset; the path is filled with
 * `currentColor`, so colour comes from a `text-*` class.
 */
const CellphoneIcon = ({ className = "w-4 h-4", ...props }) => (
  <svg
    viewBox="0 0 18 18"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
    focusable="false"
    {...props}
  >
    <path
      d="M16.95 18C17.25 18 17.5 17.9 17.7 17.7C17.9 17.5 18 17.25 18 16.95V12.9C18 12.6833 17.925 12.4875 17.775 12.3125C17.625 12.1375 17.4333 12.0167 17.2 11.95L13.75 11.25C13.5167 11.2167 13.2792 11.2375 13.0375 11.3125C12.7958 11.3875 12.6 11.5 12.45 11.65L10.1 14C9.46667 13.6333 8.86667 13.2292 8.3 12.7875C7.73333 12.3458 7.19167 11.8667 6.675 11.35C6.125 10.8167 5.62083 10.2625 5.1625 9.6875C4.70417 9.1125 4.30833 8.51667 3.975 7.9L6.4 5.45C6.53333 5.31667 6.625 5.15833 6.675 4.975C6.725 4.79167 6.73333 4.56667 6.7 4.3L6.05 0.8C6.01667 0.583333 5.90833 0.395833 5.725 0.2375C5.54167 0.0791667 5.33333 0 5.1 0H1.05C0.75 0 0.5 0.1 0.299999 0.3C0.1 0.5 0 0.75 0 1.05C0 3.13333 0.454166 5.19167 1.3625 7.225C2.27083 9.25833 3.55833 11.1083 5.225 12.775C6.89167 14.4417 8.74167 15.7292 10.775 16.6375C12.8083 17.5458 14.8667 18 16.95 18ZM3.05 6C2.76667 5.35 2.55 4.69167 2.4 4.025C2.25 3.35833 2.13333 2.68333 2.05 2H4.25L4.7 4.35L3.05 6ZM12 14.9L13.65 13.25L16 13.75V15.95C15.3167 15.9 14.6417 15.7833 13.975 15.6C13.3083 15.4167 12.65 15.1833 12 14.9Z"
      fill="currentColor"
    />
  </svg>
);

export default CellphoneIcon;
