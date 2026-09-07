import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

// Persistent banner while the browser has no network connection. Without
// this, going offline was invisible until some unrelated request failed —
// api.js's retry logic would quietly retry twice and give up, and whatever
// called it either showed its own toast or (like Profile) sat on a loading
// skeleton forever with no explanation.
const OfflineBanner = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="bg-red-600 text-white px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium relative z-[100010]">
      <WifiOff className="w-4 h-4 flex-shrink-0" />
      <span>You're offline. Changes may not be saved until you're back online.</span>
    </div>
  );
};

export default OfflineBanner;
