import logo from "/DC Circle Logo.png";

// Shown during PrivateRoute's initial auth check (once per hard refresh /
// fresh login) instead of a generic skeleton — the logo grows while
// spinning in a full circle for as long as loading takes, then simply
// unmounts once the app is ready.
export default function SplashLoader() {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center overflow-hidden bg-white"
      style={{ zIndex: 2147483647 }}
    >
      <img
        src={logo}
        alt="DataCircles"
        className="dc-splash-logo w-24 h-24 object-contain"
      />
    </div>
  );
}
