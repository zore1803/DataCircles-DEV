/*
 * The product's dashboard glyph, from the design system.
 *
 * Replaces lucide's <LayoutDashboard /> in the sidebar. Square 18x18 viewBox,
 * so the usual `w-5 h-5` keeps it centred with no optical offset, and the path
 * is filled with `currentColor` so colour comes from a `text-*` class exactly
 * like the lucide icon it replaced.
 */
const DashboardIcon = ({ className = "w-5 h-5", ...props }) => (
  <svg
    viewBox="-1.00 -1.00 20.00 20.00"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
    focusable="false"
    {...props}
  >
    <path
      d="M2 18C1.45 18 0.979167 17.8042 0.5875 17.4125C0.195833 17.0208 0 16.55 0 16V2C0 1.45 0.195833 0.979167 0.5875 0.5875C0.979167 0.195833 1.45 0 2 0H16C16.55 0 17.0208 0.195833 17.4125 0.5875C17.8042 0.979167 18 1.45 18 2V16C18 16.55 17.8042 17.0208 17.4125 17.4125C17.0208 17.8042 16.55 18 16 18H2ZM2 16H8V2H2V16ZM10 16H16V9H10V16ZM10 7H16V2H10V7Z"
      fill="currentColor"
    />
  </svg>
);

export default DashboardIcon;
