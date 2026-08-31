import logo from "/DC Circle Logo.png";

// Shown during PrivateRoute's initial auth check (once per hard refresh /
// fresh login) instead of a generic skeleton — a fixed, centred logo that
// blinks for as long as the check takes (dc-splash-blink in index.css).
// Deliberately not a timed one-shot animation: the wait is however long the
// auth call takes, so the motion has to loop rather than end on its own.
export default function SplashLoader() {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center overflow-hidden bg-white"
      style={{ zIndex: 2147483647 }}
    >
      <img
        src={logo}
        alt="DataCircles"
        className="dc-splash-logo w-36 h-36 object-contain"
      />
    </div>
  );
}
