/*
 * The product's "more actions" glyph (three vertical dots), from the design
 * system. Replaces lucide's <MoreVertical /> and <MoreHorizontal /> so every
 * row/kebab menu trigger shows the same mark at the same size. Its natural
 * viewBox is a narrow 4x16 column, so sizing it with the usual `w-4 h-4`
 * centres it inside a square icon slot without stretching; the path is
 * filled with `currentColor`, so colour comes from a `text-*` class.
 */
const MoreIcon = ({ className = "w-4 h-4", ...props }) => (
  <svg
    viewBox="0 0 4 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
    focusable="false"
    {...props}
  >
    <path
      d="M-8.74228e-08 2C-6.33815e-08 1.45 0.195833 0.979167 0.5875 0.5875C0.979167 0.195833 1.45 -1.11464e-07 2 -8.74228e-08C2.55 -6.33815e-08 3.02083 0.195833 3.4125 0.5875C3.80417 0.979167 4 1.45 4 2C4 2.55 3.80417 3.02083 3.4125 3.4125C3.02083 3.80417 2.55 4 2 4C1.45 4 0.979167 3.80417 0.5875 3.4125C0.195833 3.02083 -1.11464e-07 2.55 -8.74228e-08 2ZM-3.49691e-07 8C-3.2565e-07 7.45 0.195833 6.97917 0.5875 6.5875C0.979166 6.19583 1.45 6 2 6C2.55 6 3.02083 6.19583 3.4125 6.5875C3.80417 6.97917 4 7.45 4 8C4 8.55 3.80417 9.02083 3.4125 9.4125C3.02083 9.80417 2.55 10 2 10C1.45 10 0.979166 9.80417 0.587499 9.4125C0.195833 9.02083 -3.73732e-07 8.55 -3.49691e-07 8ZM-6.11959e-07 14C-5.87918e-07 13.45 0.195833 12.9792 0.587499 12.5875C0.979166 12.1958 1.45 12 2 12C2.55 12 3.02083 12.1958 3.4125 12.5875C3.80417 12.9792 4 13.45 4 14C4 14.55 3.80417 15.0208 3.4125 15.4125C3.02083 15.8042 2.55 16 2 16C1.45 16 0.979166 15.8042 0.587499 15.4125C0.195833 15.0208 -6.36001e-07 14.55 -6.11959e-07 14Z"
      fill="currentColor"
    />
  </svg>
);

export default MoreIcon;
