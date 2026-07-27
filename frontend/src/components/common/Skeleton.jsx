/**
 * Shared skeleton-loading primitive. Every loading placeholder in the app
 * should be built from this component — no raw `animate-pulse` divs
 * elsewhere, so all skeletons share one visual language and are easy to
 * find/update in one place.
 *
 * @param {number|string} width  - CSS width (number = px, or any CSS length string). Default "100%".
 * @param {number|string} height - CSS height (number = px, or any CSS length string). Default 14.
 * @param {"rect"|"rounded"|"circle"} shape - corner style. "rounded" (default) = rounded-md,
 *   "circle" = fully round (for avatars), "rect" = square corners (for images/banners).
 * @param {string} className - extra classes (e.g. spacing utilities like "mb-2").
 */
export default function Skeleton({ width = "100%", height = 14, shape = "rounded", className = "", style, ...rest }) {
  const radius = shape === "circle" ? "rounded-full" : shape === "rect" ? "" : "rounded-md";
  return (
    <div
      role="status"
      aria-label="Loading"
      className={`animate-pulse bg-gray-200 ${radius} ${className}`}
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
        ...style,
      }}
      {...rest}
    />
  );
}
