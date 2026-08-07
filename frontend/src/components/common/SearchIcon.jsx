/*
 * The product's search glyph, from the design system.
 *
 * Replaces lucide's <Search /> everywhere so every search field and search
 * button shows the same mark. It's a square 17x17 viewBox, so sizing it with
 * the usual `w-4 h-4` keeps it centred inside its box with no optical offset;
 * the path is filled with `currentColor`, so colour comes from a `text-*`
 * class exactly like the lucide icon it replaced.
 */
const SearchIcon = ({ className = "w-4 h-4", ...props }) => (
  <svg
    viewBox="0 0 17 17"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
    focusable="false"
    {...props}
  >
    <path
      d="M7.5 0C11.64 0 15 3.36 15 7.5C15 11.64 11.64 15 7.5 15C3.36 15 0 11.64 0 7.5C0 3.36 3.36 0 7.5 0ZM7.5 13.3333C10.7229 13.3333 13.3333 10.7229 13.3333 7.5C13.3333 4.27708 10.7229 1.66667 7.5 1.66667C4.27708 1.66667 1.66667 4.27708 1.66667 7.5C1.66667 10.7229 4.27708 13.3333 7.5 13.3333ZM14.5711 13.3926L16.9281 15.7496L15.7496 16.9281L13.3926 14.5711L14.5711 13.3926Z"
      fill="currentColor"
    />
  </svg>
);

export default SearchIcon;
