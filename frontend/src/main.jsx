import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AppWrapper from './App.jsx'

// Capture a referral code from a shared link (?ref=CODE) HERE — before React
// mounts, before any router, before any redirect, before the Auth0 login
// round-trip. This is the only point guaranteed to still see the original
// URL's query string: an unauthenticated visitor hitting /?ref=CODE gets
// redirected to /login by PrivateRoute (which strips the query), and Auth0's
// redirect_uri is window.location.origin (also no query) — so capturing this
// any later (e.g. in an App useEffect) loses it. Persisted to localStorage;
// consumed by Login.jsx at registration. See PROJECT_STATE.md §11.
(function captureReferralCode() {
  try {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) localStorage.setItem("referralCode", ref.trim().toUpperCase());
  } catch (_) { /* non-fatal */ }
})();

createRoot(document.getElementById('root')).render(

    <AppWrapper />

)
