/*
 * The product's video-call glyph, from the design system. Replaces
 * lucide's <Video /> everywhere. It's a 20x16 viewBox, so sizing it with
 * the usual `w-4 h-4` keeps it centred inside a square icon slot without
 * stretching; the path is filled with `currentColor`, so colour comes from
 * a `text-*` class exactly like the lucide icon it replaced.
 */
const VideoIcon = ({ className = "w-4 h-4", ...props }) => (
  <svg
    viewBox="0 0 20 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
    focusable="false"
    {...props}
  >
    <path
      d="M2 16C1.45 16 0.979167 15.8042 0.5875 15.4125C0.195833 15.0208 0 14.55 0 14V2C0 1.45 0.195833 0.979167 0.5875 0.5875C0.979167 0.195833 1.45 0 2 0H14C14.55 0 15.0208 0.195833 15.4125 0.5875C15.8042 0.979167 16 1.45 16 2V6.5L19.15 3.35C19.3167 3.18333 19.5 3.14167 19.7 3.225C19.9 3.30833 20 3.46667 20 3.7V12.3C20 12.5333 19.9 12.6917 19.7 12.775C19.5 12.8583 19.3167 12.8167 19.15 12.65L16 9.5V14C16 14.55 15.8042 15.0208 15.4125 15.4125C15.0208 15.8042 14.55 16 14 16H2ZM2 14H14V2H2V14Z"
      fill="currentColor"
    />
  </svg>
);

export default VideoIcon;
