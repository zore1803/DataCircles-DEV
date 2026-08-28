import logo from "/DC Circle Logo.png";

// Shown during PrivateRoute's initial auth check (once per hard refresh /
// fresh login) instead of a generic skeleton — the logo grows while
// spinning in a full circle for as long as loading takes. Once the app is
// ready, the caller sets `fadeOut` for a brief moment before unmounting it,
// so it dims out smoothly instead of vanishing in one frame.
export default function SplashLoader({ fadeOut = false }) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center overflow-hidden bg-white transition-opacity duration-500 ease-out"
      style={{ zIndex: 2147483647, opacity: fadeOut ? 0 : 1 }}
    >
      <img
        src={logo}
        alt="DataCircles"
        className="dc-splash-logo w-24 h-24 object-contain"
      />
    </div>
  );
}
