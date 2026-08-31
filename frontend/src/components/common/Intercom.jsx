import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import API from "../../services/api";

const APP_ID = import.meta.env.VITE_INTERCOM_APP_ID;

function loadIntercomScript(appId) {
  if (window.Intercom) return;

  const w = window;
  const ic = w.Intercom;
  if (typeof ic === "function") {
    ic("reattach_activator");
    ic("update", w.intercomSettings);
  } else {
    const i = function () {
      i.c(arguments);
    };
    i.q = [];
    i.c = function (args) {
      i.q.push(args);
    };
    w.Intercom = i;
    const load = () => {
      const s = document.createElement("script");
      s.type = "text/javascript";
      s.async = true;
      s.src = `https://widget.intercom.io/widget/${appId}`;
      document.head.appendChild(s);
    };
    if (document.readyState === "complete") {
      load();
    } else {
      w.addEventListener("load", load);
    }
  }
}

/**
 * Boots the Intercom Messenger for the signed-in user. Waits for both the
 * profile (/auth/me) and the server-signed JWT (/auth/intercom-jwt) before
 * booting — this workspace has Messenger JWT security enforced, so a boot
 * without intercom_user_jwt is rejected outright.
 */
export default function Intercom({ isAuthenticated, isSetupComplete }) {
  const location = useLocation();
  const bootedRef = useRef(false);

  useEffect(() => {
    if (!APP_ID) return;

    if (!isAuthenticated || !isSetupComplete) {
      if (bootedRef.current && window.Intercom) {
        window.Intercom("shutdown");
        bootedRef.current = false;
      }
      return;
    }

    let cancelled = false;

    const boot = async () => {
      try {
        const [{ data: me }, { data: jwtRes }] = await Promise.all([
          API.get("/auth/me"),
          API.get("/auth/intercom-jwt"),
        ]);
        if (cancelled) return;

        const user = me.user;
        loadIntercomScript(APP_ID);

        window.intercomSettings = {
          api_base: "https://api-iam.intercom.io",
          app_id: APP_ID,
          intercom_user_jwt: jwtRes.token,
          name: user.name,
          created_at: user.createdAt
            ? Math.floor(new Date(user.createdAt).getTime() / 1000)
            : undefined,
        };

        window.Intercom?.("boot", window.intercomSettings);
        bootedRef.current = true;
      } catch (err) {
        // Intercom being unreachable/misconfigured shouldn't break the app.
        console.error("Intercom boot failed:", err);
      }
    };

    boot();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isSetupComplete]);

  // Let the Messenger re-check unread counts / launcher position on route change.
  useEffect(() => {
    if (bootedRef.current && window.Intercom) {
      window.Intercom("update");
    }
  }, [location.pathname]);

  useEffect(() => {
    return () => {
      if (bootedRef.current && window.Intercom) {
        window.Intercom("shutdown");
      }
    };
  }, []);

  return null;
}
