import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import API from "../services/api";
import toast from "react-hot-toast";
import AppToaster from "../components/AppToaster";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const location = useLocation();

  // Extract token properly from query params
  const [token, setToken] = useState("");

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const tokenParam = searchParams.get("token");
    if (tokenParam) setToken(tokenParam);
  }, [location]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      // Stub API call
      await API.post("/auth/reset-password", { token, password });
      setSuccess(true);
    } catch (error) {
      console.error("Reset password error:", error);
      toast.error("Failed to reset password. Link may be expired.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 font-inter">
        <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl text-center space-y-6 border border-gray-100">
          <img
            src="/DataCircles.png"
            alt="DataCircles"
            className="h-8 mx-auto mb-4"
          />

          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-green-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-gray-900">Password Reset</h1>
          <p className="text-gray-500">
            Password successfully reset.
            <br />
            Please sign in to continue.
          </p>

          <Link
            to="/login"
            className="w-full block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-all shadow-md mt-6"
          >
            Sign in
          </Link>

          <div className="pt-8 text-xs text-gray-400 flex justify-between w-full mt-4 border-t pt-4">
            <span>© 2025 DataCircles</span>
            <div className="space-x-2">
              <a href="#" className="hover:text-gray-600">
                Privacy
              </a>
              <a href="#" className="hover:text-gray-600">
                Terms
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4 font-inter relative">
      <AppToaster />

      {/* Header Logo */}
      <div className="absolute top-8 left-8 flex items-center gap-2">
        <img src="/DataCircles.png" alt="DataCircles" className="h-8 w-auto" />
        <span className="text-3xl font-bold font-inter text-[#0F172A] tracking-tight">
          DataCircles
        </span>
      </div>

      <div className="w-full max-w-[400px] space-y-8">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-white border border-gray-100 rounded-full flex items-center justify-center shadow-sm mx-auto mb-6">
            <svg
              className="w-8 h-8 text-gray-800"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Reset your password
          </h1>
          <p className="text-sm text-gray-500">
            Create a new password to secure your account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Reset password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-50 outline-none transition-all placeholder:text-gray-300 pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Confirm password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-50 outline-none transition-all placeholder:text-gray-300 pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !password || !confirmPassword}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-all shadow-md mt-4"
          >
            {loading ? "Resetting..." : "Reset password"}
          </button>
        </form>

        <div className="pt-4 text-center">
          <p className="text-sm text-gray-400">
            Don't have access anymore? <br />
            <Link
              to="/support"
              className="text-blue-500 hover:text-blue-600 font-medium"
            >
              Try another method
            </Link>
          </p>
        </div>
      </div>
      <div className="absolute bottom-8 w-full flex justify-between px-8 text-xs text-gray-400">
        <span>© 2025 DataCircles</span>
        <div className="space-x-4">
          <a
            href="https://www.datacircles.in/terms-of-service"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-600"
          >
            Privacy Policy
          </a>
          <a
            href="https://www.datacircles.in/terms-of-service"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-600"
          >
            Terms of Use
          </a>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
