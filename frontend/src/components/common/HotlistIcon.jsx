/*
 * The product's hotlist glyph, from the design system.
 *
 * Replaces the ad-hoc inline SVGs that used to sit directly in Companies.jsx
 * and Contacts.jsx (each at a different size — 13px, 14px, 16px) so every
 * "Hotlist" toolbar button/menu item shows the same mark at the same size.
 * It's a 20x20 viewBox, so sizing it with the usual `w-4 h-4` keeps it
 * centred inside its box with no optical offset; the path is filled with
 * `currentColor`, so colour comes from a `text-*` class.
 */
const HotlistIcon = ({ className = "w-4 h-4", size, style, ...props }) => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={size != null ? { width: size, height: size, ...style } : style}
    aria-hidden="true"
    focusable="false"
    {...props}
  >
    <path
      d="M10.616 10.2L12.391 9.125L14.166 10.2C14.266 10.2667 14.3618 10.2667 14.4535 10.2C14.5452 10.1333 14.5743 10.0417 14.541 9.925L14.066 7.9L15.616 6.55C15.6993 6.46667 15.7285 6.37917 15.7035 6.2875C15.6785 6.19583 15.6077 6.14167 15.491 6.125L13.441 5.95L12.616 4.05C12.5827 3.95 12.5077 3.9 12.391 3.9C12.2743 3.9 12.1993 3.95 12.166 4.05L11.341 5.95L9.291 6.125C9.17433 6.14167 9.1035 6.19583 9.0785 6.2875C9.0535 6.37917 9.08267 6.46667 9.166 6.55L10.716 7.9L10.241 9.925C10.2077 10.0417 10.2368 10.1333 10.3285 10.2C10.4202 10.2667 10.516 10.2667 10.616 10.2ZM6.891 15C6.341 15 5.87017 14.8042 5.4785 14.4125C5.08683 14.0208 4.891 13.55 4.891 13V2C4.891 1.45 5.08683 0.979167 5.4785 0.5875C5.87017 0.195833 6.341 0 6.891 0H17.891C18.441 0 18.9118 0.195833 19.3035 0.5875C19.6952 0.979167 19.891 1.45 19.891 2V13C19.891 13.55 19.6952 14.0208 19.3035 14.4125C18.9118 14.8042 18.441 15 17.891 15H6.891ZM6.891 13H17.891V2H6.891V13ZM3.591 19.875C3.041 19.9417 2.54517 19.8083 2.1035 19.475C1.66183 19.1417 1.40767 18.7 1.341 18.15L0.016 7.225C-0.0506667 6.675 0.091 6.18333 0.441 5.75C0.791 5.31667 1.241 5.05833 1.791 4.975H1.841C2.12433 4.925 2.3785 5 2.6035 5.2C2.8285 5.4 2.941 5.65 2.941 5.95C2.941 6.2 2.8535 6.41667 2.6785 6.6C2.5035 6.78333 2.291 6.9 2.041 6.95H2.016L3.366 17.9L15.216 16.45C15.4993 16.4167 15.7493 16.4833 15.966 16.65C16.1827 16.8167 16.3077 17.0417 16.341 17.325C16.3743 17.6083 16.3077 17.8542 16.141 18.0625C15.9743 18.2708 15.7493 18.3917 15.466 18.425L3.591 19.875Z"
      fill="currentColor"
    />
  </svg>
);

export default HotlistIcon;
