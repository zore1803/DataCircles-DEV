import React, { useState } from "react";
import { Link } from "react-router-dom";
import API from "../services/api";
import toast, { Toaster } from "react-hot-toast";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    try {
      // Stub API call
      await API.post("/auth/forgot-password", { email });
      setSubmitted(true);
      toast.success("Reset link sent to your email");
    } catch (error) {
      console.error("Forgot password error:", error);
      toast.error("Failed to send reset link. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4 font-inter">
        <div className="w-full max-w-md text-center space-y-6">
          <img
            src="/DataCircles.png"
            alt="DataCircles"
            className="h-8 mx-auto"
          />

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-gray-900">
              Check your email
            </h1>
            <p className="text-gray-500">
              We have sent a password reset link to{" "}
              <span className="font-semibold text-gray-900">{email}</span>.
            </p>
          </div>

          <div className="pt-4">
            <p className="text-sm text-gray-500">
              Did not receive the email? Check your spam filter or{" "}
              <button
                onClick={() => setSubmitted(false)}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                try another email address
              </button>
            </p>
          </div>

          <div className="pt-8">
            <Link
              to="/login"
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4 font-inter relative">
      <Toaster position="top-center" />

      {/* Header Logo */}
      <div className="absolute top-8 left-8 flex items-center gap-2">
        <img src="/DataCircles.png" alt="DataCircles" className="h-8 w-auto" />
        <span className="text-3xl font-bold font-inter text-[#0F172A] tracking-tight">
          DataCircles
        </span>
      </div>

      <div className="absolute top-8 right-8">
        <p className="text-sm text-gray-500">
          Don't have an account?{" "}
          <Link
            to="/login"
            className="text-blue-600 font-medium hover:underline"
          >
            Sign up
          </Link>
        </p>
      </div>

      <div className="w-full max-w-[480px] space-y-8 text-center bg-white">
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 bg-white border border-gray-100 rounded-2xl flex items-center justify-center shadow-sm">
            <svg
              className="w-6 h-6 text-gray-700"
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
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl font-bold text-[#1e293b] tracking-tight">
            Reset your password
          </h1>
          <p className="text-[#64748b] text-[15px] leading-relaxed max-w-sm mx-auto">
            Enter your email address and we'll send you password reset
            instructions.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 text-left mt-8">
          <div className="space-y-2">
            <label className="text-xs font-bold text-[#64748b] uppercase tracking-wider">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all placeholder:text-gray-300 text-gray-900"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || !email}
            className="w-full bg-[#818CF8] hover:bg-[#6366F1] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-all shadow-sm shadow-indigo-200 mt-2 text-[15px]"
          >
            {loading ? "Sending..." : "Reset password"}
          </button>
        </form>

        <div className="pt-6">
          <p className="text-sm text-[#64748b]">
            Don't have access anymore? <br />
            <Link
              to="/support"
              className="text-[#3B82F6] hover:text-[#2563EB] font-medium mt-1 inline-block transition-colors"
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

export default ForgotPassword;
