import { useEffect, useState } from "react";

// Shared by OfflineBanner (what to show) and App (how much to push the
// fixed header/sidebar down to make room for the banner) — both need the
// same live value, so it's one hook instead of two separate listeners
// drifting out of sync.
export default function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return isOnline;
}
