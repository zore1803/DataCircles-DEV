/*
 * The product's "select all" checkbox glyph (checkmark drawn outside a
 * rounded square), from the design system. Used in the bulk-selection strip
 * (BulkActionBar) rather than the plain row-checkbox pair. It's a 19x18
 * viewBox, so sizing it with the usual `w-4 h-4` keeps it centred inside a
 * square icon slot without stretching; the path is filled with
 * `currentColor`, so colour comes from a `text-*` class.
 */
const SelectAllIcon = ({ className = "w-4 h-4", ...props }) => (
  <svg
    viewBox="0 0 19 18"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
    focusable="false"
    {...props}
  >
    <path
      d="M2 18C1.45 18 0.979167 17.8042 0.5875 17.4125C0.195833 17.0208 0 16.55 0 16V2C0 1.45 0.195833 0.979167 0.5875 0.5875C0.979167 0.195833 1.45 0 2 0H14.475C14.7583 0 14.9958 0.0958333 15.1875 0.2875C15.3792 0.479167 15.475 0.716667 15.475 1C15.475 1.28333 15.3792 1.52083 15.1875 1.7125C14.9958 1.90417 14.7583 2 14.475 2H2V16H16V9.5C16 9.21667 16.0958 8.97917 16.2875 8.7875C16.4792 8.59583 16.7167 8.5 17 8.5C17.2833 8.5 17.5208 8.59583 17.7125 8.7875C17.9042 8.97917 18 9.21667 18 9.5V16C18 16.55 17.8042 17.0208 17.4125 17.4125C17.0208 17.8042 16.55 18 16 18H2ZM8.525 11.2L17.025 2.7C17.2083 2.51667 17.4333 2.425 17.7 2.425C17.9667 2.425 18.2 2.51667 18.4 2.7C18.6 2.88333 18.7 3.11667 18.7 3.4C18.7 3.68333 18.6 3.925 18.4 4.125L9.225 13.3C9.025 13.5 8.79167 13.6 8.525 13.6C8.25833 13.6 8.025 13.5 7.825 13.3L3.575 9.05C3.39167 8.86667 3.3 8.63333 3.3 8.35C3.3 8.06667 3.39167 7.83333 3.575 7.65C3.75833 7.46667 3.99167 7.375 4.275 7.375C4.55833 7.375 4.79167 7.46667 4.975 7.65L8.525 11.2Z"
      fill="currentColor"
    />
  </svg>
);

export default SelectAllIcon;
