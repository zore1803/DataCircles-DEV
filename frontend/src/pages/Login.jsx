import React, { useState, useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate, useLocation } from "react-router-dom";
import API, { configureAxios } from "../services/api";
import logo from "/DataCircles.png";

function Login() {
  const {
    loginWithRedirect,
    isAuthenticated,
    isLoading,
    error,
    getAccessTokenSilently,
    user,
    logout,
  } = useAuth0();
  const navigate = useNavigate();
  const location = useLocation();
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [showSetupForm, setShowSetupForm] = useState(false);
  const [showCodeDisplay, setShowCodeDisplay] = useState(false);
  const [showPhoneInput, setShowPhoneInput] = useState(false);
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [showPhoneProfileInput, setShowPhoneProfileInput] = useState(false); // New state
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [userOtp, setUserOtp] = useState("");
  const [facebookUserData, setFacebookUserData] = useState(null);
  const [phoneUserData, setPhoneUserData] = useState(null); // New state
  const [emailError, setEmailError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [setupType, setSetupType] = useState("join");
  const [code, setCode] = useState("");
  const [orgName, setOrgName] = useState("");
  const [companyCode, setCompanyCode] = useState(null);
  const [tempToken, setTempToken] = useState(null);
  const [isPhoneLogin, setIsPhoneLogin] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);

  // Email OTP states
  const [emailOtp, setEmailOtp] = useState("");
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailOtpTimer, setEmailOtpTimer] = useState(0);

  const [showEmailPasswordInput, setShowEmailPasswordInput] = useState(false);
  const [userEmailPassword, setUserEmailPassword] = useState("");
  const [userPassword, setUserPassword] = useState("");

  useEffect(() => {
    configureAxios(getAccessTokenSilently);
  }, [getAccessTokenSilently]);

  useEffect(() => {
    let interval = null;
    if (otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer((timer) => timer - 1);
      }, 1000);
    } else if (otpTimer === 0) {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [otpTimer]);

  // Email OTP timer
  useEffect(() => {
    let interval = null;
    if (emailOtpTimer > 0) {
      interval = setInterval(() => {
        setEmailOtpTimer((timer) => timer - 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [emailOtpTimer]);

  useEffect(() => {
    if (location.state?.requiresEmail) {
      setShowEmailInput(true);
      setFacebookUserData({
        name: location.state.name || "Unknown",
        provider: location.state.provider || "facebook",
        sub: user?.sub,
      });
    } else if (location.state?.requiresSetup) {
      setShowSetupForm(true);
    } else if (isAuthenticated && !showSetupForm && !showEmailInput) {
      checkAuthStatus();
    }
  }, [isAuthenticated, location.state, user]);

  const checkAuthStatus = async () => {
    try {
      const res = await API.get("/auth/me");
      navigate("/");
    } catch (err) {
      const errorData = err.response?.data;
      console.log("Auth error response:", errorData);
      if (errorData?.error === "EMAIL_REQUIRED" && errorData?.requiresEmail) {
        if (errorData?.provider === "phone") {
          setShowPhoneProfileInput(true);
          setPhoneUserData({
            phone: errorData.phone || userPhone,
            provider: "phone",
          });
        } else {
          setShowEmailInput(true);
          setFacebookUserData({
            name: errorData.name || "Unknown",
            provider: errorData.provider || "facebook",
            sub: user?.sub,
          });
        }
      } else if (errorData?.error === "REGISTRATION_REQUIRED") {
        setShowSetupForm(true);
      } else {
        setEmailError(errorData?.message || "Authentication failed");
      }
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handlePhoneSubmission = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setEmailError("");

    if (!userPhone || userPhone.length !== 10) {
      setEmailError("Please enter a valid 10-digit phone number");
      setIsSubmitting(false);
      return;
    }

    try {
      await API.post("/auth/send-otp", { phone: userPhone });
      setShowPhoneInput(false);
      setShowOtpInput(true);
      setOtpTimer(300); // 5 minutes
    } catch (err) {
      setEmailError(err.response?.data?.error || "Failed to send OTP");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtpSubmission = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setEmailError("");

    try {
      const res = await API.post("/auth/verify-otp", {
        phone: userPhone,
        otp: userOtp,
      });
      if (res.data.success) {
        localStorage.setItem("token", res.data.token);
        localStorage.setItem("user", JSON.stringify(res.data.user));
        configureAxios(() => Promise.resolve(localStorage.getItem("token")));
        window.location.href = "/";
      }
    } catch (err) {
      const data = err.response?.data;
      if (data?.error === "REGISTRATION_REQUIRED") {
        setTempToken(data.tempToken);
        setIsPhoneLogin(true);
        setShowOtpInput(false);
        setShowPhoneProfileInput(true);
        setPhoneUserData({
          phone: userPhone,
          provider: "phone",
        });
      } else {
        setEmailError(data?.message || "Invalid OTP");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePhoneProfileSubmission = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setEmailError("");

    try {
      const body = {
        email: userEmail,
        name: userName,
        phone: phoneUserData?.phone || userPhone,
      };

      console.log("Submitting with tempToken:", tempToken ? "Token exists" : "No token");

      const config = tempToken
        ? { headers: { Authorization: `Bearer ${tempToken}` } }
        : {};

      console.log("Request config:", config);

      const res = await API.post("/auth/complete-registration", body, config);

      if (res.data.success) {
        if (res.data.token) {
          localStorage.setItem("token", res.data.token);
          configureAxios(() => Promise.resolve(localStorage.getItem("token")));
        }

        const authRes = await API.get("/auth/me");
        if (authRes.status === 200) {
          navigate("/");
        } else {
          setEmailError("Failed to verify authentication. Please try again.");
        }
      }
    } catch (err) {
      console.error("Registration error:", err.response?.data || err.message);
      const data = err.response?.data;
      if (data?.message === "Provide company code or organization name") {
        setShowPhoneProfileInput(false);
        setShowSetupForm(true);
        setIsPhoneLogin(true);
      } else if (
        data?.message === "User already exists" ||
        data?.message === "This email is already registered"
      ) {
        setEmailError(
          "This email is already registered. Please use a different email or contact support."
        );
      } else if (data?.message === "Invalid session or user ID") {
        setEmailError("Session expired. Please try logging in again.");
      } else {
        setEmailError(data?.message || "Failed to complete registration");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailPasswordSubmission = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setEmailError("");

    try {
      const res = await API.post("/auth/login", {
        email: userEmailPassword,
        password: userPassword,
      });

      if (res.data.success) {
        localStorage.setItem("token", res.data.token);
        localStorage.setItem("user", JSON.stringify(res.data.user));
        configureAxios(() => Promise.resolve(localStorage.getItem("token")));
        window.location.href = "/";
      }
    } catch (err) {
      setEmailError(err.response?.data?.message || "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Send Email OTP
  const handleSendEmailOtp = async () => {
    if (!userEmail) {
      setEmailError("Please enter your email address");
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userEmail)) {
      setEmailError("Please enter a valid email address");
      return;
    }

    setIsSubmitting(true);
    setEmailError("");

    try {
      const res = await API.post("/auth/send-email-otp", { email: userEmail });
      if (res.data.success) {
        setEmailOtpSent(true);
        setEmailOtpTimer(600); // 10 minutes
        setEmailError("");
      }
    } catch (err) {
      setEmailError(err.response?.data?.message || "Failed to send OTP");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Verify Email OTP
  const handleVerifyEmailOtp = async () => {
    if (!emailOtp || emailOtp.length !== 6) {
      setEmailError("Please enter the 6-digit OTP");
      return;
    }

    setIsSubmitting(true);
    setEmailError("");

    try {
      const res = await API.post("/auth/verify-email-otp", {
        email: userEmail,
        otp: emailOtp,
      });

      if (res.data.success) {
        setEmailVerified(true);
        setEmailError("");
        setEmailOtp("");
      }
    } catch (err) {
      setEmailError(err.response?.data?.message || "Invalid OTP");
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleEmailSubmission = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setEmailError("");

    try {
      const res = await API.post("/auth/complete-registration", {
        email: userEmail,
        sub: facebookUserData?.sub || user?.sub,
        name: facebookUserData?.name || user?.name || "Unknown",
      });

      const authRes = await API.get("/auth/me");
      if (authRes.status === 200) {
        navigate("/");
      } else {
        setEmailError("Failed to verify authentication. Please try again.");
      }
    } catch (err) {
      const data = err.response?.data;
      if (data?.message === "Provide company code or organization name") {
        setShowEmailInput(false);
        setShowSetupForm(true);
      } else if (data?.message === "User already exists") {
        setEmailError(
          "This email is already registered. Please use a different email or contact support."
        );
      } else if (data?.message === "Invalid session or user ID") {
        setEmailError("Session expired. Please try logging in again.");
      } else {
        setEmailError(data?.message || "Failed to complete registration");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetupSubmission = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setEmailError("");

    try {
      const body = {
        sub: isPhoneLogin ? null : facebookUserData?.sub || user?.sub,
        name: isPhoneLogin
          ? userName
          : facebookUserData?.name || user?.name || "Unknown",
      };

      if (facebookUserData || isPhoneLogin) {
        body.email = userEmail;
      } else if (user?.email) {
        body.email = user.email;
      }

      if (setupType === "join") {
        if (!code.trim()) {
          setEmailError("Company code is required");
          setIsSubmitting(false);
          return;
        }
        body.code = code;
      } else {
        if (!orgName.trim()) {
          setEmailError("Organization name is required");
          setIsSubmitting(false);
          return;
        }
        body.orgName = orgName;
        // Referral code captured from a shared link's ?ref= param (see
        // App.jsx) — only meaningful for a brand-new organization, which is
        // the only branch the backend records intent on. A code typed
        // manually is applied separately, on the checkout page's own Apply
        // button, since registration has already finished by then.
        const storedReferralCode = localStorage.getItem("referralCode");
        if (storedReferralCode) {
          body.referralCode = storedReferralCode;
        }
      }

      const config = tempToken
        ? { headers: { Authorization: `Bearer ${tempToken}` } }
        : {};
      const res = await API.post("/auth/complete-registration", body, config);
      localStorage.removeItem("referralCode"); // consumed — one-shot, don't reuse on a later signup from this browser

      if (res.data.token) {
        localStorage.setItem("token", res.data.token);
        configureAxios(() => Promise.resolve(localStorage.getItem("token")));
      }

      if (res.data.companyCode) {
        setCompanyCode(res.data.companyCode);
        setShowCodeDisplay(true);
      } else {
        // Check if org has a subscription before entering the app
        try {
          const subRes = await API.get("/subscription/current");
          const sub = subRes.data;
          if (!sub || sub.hasSubscription === false) {
            navigate("/subscription");
          } else {
            navigate("/");
          }
        } catch (subErr) {
          if (subErr.response?.data?.code === "NO_SUBSCRIPTION") {
            navigate("/subscription");
          } else {
            navigate("/");
          }
        }
      }
      setShowSetupForm(false);
    } catch (err) {
      const data = err.response?.data;
      setEmailError(data?.message || "Failed to complete setup");
      setShowEmailInput(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="flex flex-col items-center justify-center">
          <img
            src={logo}
            alt="Loading..."
            className="animate-spin-smooth drop-shadow-lg"
            style={{
              width: "48px",
              height: "48px",
              animationDuration: "1.8s",
              filter: "invert(100%)",
            }}
          />
        </div>
      </div>
    );
  }

  if (showEmailPasswordInput) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8 p-8">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-blue-400 rounded-2xl mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Sign in with Email</h2>
            <p className="text-gray-600">Enter your email and password</p>
          </div>
          <form onSubmit={handleEmailPasswordSubmission} className="space-y-6">
            <div>
              <label htmlFor="email-password" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                id="email-password"
                type="email"
                required
                value={userEmailPassword}
                onChange={(e) => setUserEmailPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your email"
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={userPassword}
                onChange={(e) => setUserPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your password"
                disabled={isSubmitting}
              />
            </div>
            {emailError && <p className="text-sm text-red-600">{emailError}</p>}
            <div className="space-y-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Signing in..." : "Sign In"}
              </button>
              <button
                type="button"
                onClick={() => setShowEmailPasswordInput(false)}
                className="w-full py-3 px-4 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Back to Login
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (showPhoneInput) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8 p-8">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-green-600 to-green-700 rounded-2xl mb-4">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Phone Authentication
            </h2>
            <p className="text-gray-600">
              Enter your phone number to receive an OTP
            </p>
          </div>
          <form onSubmit={handlePhoneSubmission} className="space-y-6">
            <div>
              <label
                htmlFor="phone"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Phone Number
              </label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                  +91
                </span>
                <input
                  id="phone"
                  type="tel"
                  required
                  value={userPhone}
                  onChange={(e) =>
                    setUserPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
                  }
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-r-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="Enter 10-digit number"
                  disabled={isSubmitting}
                />
              </div>
              {emailError && (
                <p className="mt-2 text-sm text-red-600">{emailError}</p>
              )}
            </div>
            <div className="space-y-3">
              <button
                type="submit"
                disabled={isSubmitting || userPhone.length !== 10}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Sending..." : "Send OTP"}
              </button>
              <button
                type="button"
                onClick={() => setShowPhoneInput(false)}
                className="w-full py-3 px-4 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Back to Login
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (showOtpInput) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8 p-8">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-green-600 to-green-700 rounded-2xl mb-4">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Verify OTP
            </h2>
            <p className="text-gray-600 mb-2">
              Enter the 4-digit code sent to +91{userPhone}
            </p>
            {otpTimer > 0 && (
              <p className="text-sm text-green-600">
                Code expires in: {formatTime(otpTimer)}
              </p>
            )}
          </div>
          <form onSubmit={handleOtpSubmission} className="space-y-6">
            <div>
              <label
                htmlFor="otp"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                OTP
              </label>
              <input
                id="otp"
                type="text"
                required
                maxLength={4}
                value={userOtp}
                onChange={(e) =>
                  setUserOtp(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-center text-2xl tracking-widest"
                placeholder="0000"
                disabled={isSubmitting}
              />
              {emailError && (
                <p className="mt-2 text-sm text-red-600">{emailError}</p>
              )}
            </div>
            <div className="space-y-3">
              <button
                type="submit"
                disabled={isSubmitting || userOtp.length !== 4}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Verifying..." : "Verify OTP"}
              </button>
              {otpTimer === 0 && (
                <button
                  type="button"
                  onClick={handlePhoneSubmission}
                  className="w-full py-3 px-4 border border-gray-300 rounded-xl text-sm font-medium text-green-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  Resend OTP
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowOtpInput(false);
                  setShowPhoneInput(true);
                  setUserOtp("");
                  setOtpTimer(0);
                }}
                className="w-full py-3 px-4 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Back to Phone
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (showPhoneProfileInput) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8 p-8">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-green-600 to-green-700 rounded-2xl mb-4">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Complete Your Profile
            </h2>
            <p className="text-gray-600">
              Phone verified successfully! Please provide your details to continue.
            </p>
          </div>
          <form onSubmit={handlePhoneProfileSubmission} className="space-y-6">
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Full Name
              </label>
              <input
                id="name"
                type="text"
                required
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="Enter your full name"
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Email Address {emailVerified && (
                  <span className="text-green-600 text-sm ml-2">✓ Verified</span>
                )}
              </label>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    id="email"
                    type="email"
                    required
                    value={userEmail}
                    onChange={(e) => {
                      setUserEmail(e.target.value);
                      setEmailOtpSent(false);
                      setEmailVerified(false);
                      setEmailOtp("");
                    }}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="Enter your email address"
                    disabled={isSubmitting || emailVerified}
                  />
                  {!emailOtpSent && !emailVerified && (
                    <button
                      type="button"
                      onClick={handleSendEmailOtp}
                      disabled={isSubmitting || !userEmail}
                      className="px-6 py-3 border border-green-600 text-green-600 rounded-xl text-sm font-medium hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      {isSubmitting ? "Sending..." : "Send OTP"}
                    </button>
                  )}
                </div>

                {emailOtpSent && !emailVerified && (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        maxLength={6}
                        value={emailOtp}
                        onChange={(e) =>
                          setEmailOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                        }
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-center text-xl tracking-widest"
                        placeholder="000000"
                        disabled={isSubmitting}
                      />
                      <button
                        type="button"
                        onClick={handleVerifyEmailOtp}
                        disabled={isSubmitting || emailOtp.length !== 6}
                        className="px-6 py-3 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                      >
                        {isSubmitting ? "Verifying..." : "Verify"}
                      </button>
                    </div>
                    {emailOtpTimer > 0 && (
                      <p className="text-sm text-green-600 text-center">
                        Code expires in: {Math.floor(emailOtpTimer / 60)}:{String(emailOtpTimer % 60).padStart(2, '0')}
                      </p>
                    )}
                    {emailOtpTimer === 0 && (
                      <button
                        type="button"
                        onClick={handleSendEmailOtp}
                        className="w-full py-2 text-sm text-green-600 hover:text-green-700 font-medium"
                      >
                        Resend OTP
                      </button>
                    )}
                  </div>
                )}
              </div>
              {emailError && (
                <p className="mt-2 text-sm text-red-600">{emailError}</p>
              )}
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-sm text-gray-600">
                <span className="font-medium">Phone:</span> +91
                {phoneUserData?.phone || userPhone}
              </p>
            </div>
            <div className="space-y-3">
              <button
                type="submit"
                disabled={isSubmitting || !emailVerified}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Processing..." : emailVerified ? "Continue" : "Verify Email First"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPhoneProfileInput(false);
                  setShowPhoneInput(true);
                  setUserName("");
                  setUserEmail("");
                  setTempToken(null);
                  setIsPhoneLogin(false);
                }}
                className="w-full py-3 px-4 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (showEmailInput) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8 p-8">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl mb-4">
              <svg
                className="w-8 h-8 text-white"
                fill="#1877F2"
                viewBox="0 0 24 24"
              >
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Complete Your Profile
            </h2>
            <p className="text-gray-600">
              Hi {facebookUserData?.name || "User"}! Please provide your email address to continue.
            </p>
          </div>
          <form onSubmit={handleEmailSubmission} className="space-y-6">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Email Address {emailVerified && (
                  <span className="text-green-600 text-sm ml-2">✓ Verified</span>
                )}
              </label>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    id="email"
                    type="email"
                    required
                    value={userEmail}
                    onChange={(e) => {
                      setUserEmail(e.target.value);
                      setEmailOtpSent(false);
                      setEmailVerified(false);
                      setEmailOtp("");
                    }}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter your email address"
                    disabled={isSubmitting || emailVerified}
                  />
                  {!emailOtpSent && !emailVerified && (
                    <button
                      type="button"
                      onClick={handleSendEmailOtp}
                      disabled={isSubmitting || !userEmail}
                      className="px-6 py-3 border border-blue-600 text-blue-600 rounded-xl text-sm font-medium hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      {isSubmitting ? "Sending..." : "Send OTP"}
                    </button>
                  )}
                </div>

                {emailOtpSent && !emailVerified && (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        maxLength={6}
                        value={emailOtp}
                        onChange={(e) =>
                          setEmailOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                        }
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center text-xl tracking-widest"
                        placeholder="000000"
                        disabled={isSubmitting}
                      />
                      <button
                        type="button"
                        onClick={handleVerifyEmailOtp}
                        disabled={isSubmitting || emailOtp.length !== 6}
                        className="px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                      >
                        {isSubmitting ? "Verifying..." : "Verify"}
                      </button>
                    </div>
                    {emailOtpTimer > 0 && (
                      <p className="text-sm text-blue-600 text-center">
                        Code expires in: {Math.floor(emailOtpTimer / 60)}:{String(emailOtpTimer % 60).padStart(2, '0')}
                      </p>
                    )}
                    {emailOtpTimer === 0 && (
                      <button
                        type="button"
                        onClick={handleSendEmailOtp}
                        className="w-full py-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Resend OTP
                      </button>
                    )}
                  </div>
                )}
              </div>
              {emailError && (
                <p className="mt-2 text-sm text-red-600">{emailError}</p>
              )}
            </div>
            <div className="space-y-3">
              <button
                type="submit"
                disabled={isSubmitting || !emailVerified}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Processing..." : emailVerified ? "Continue" : "Verify Email First"}
              </button>
              <button
                type="button"
                onClick={() =>
                  logout({ logoutParams: { returnTo: window.location.origin } })
                }
                className="w-full py-3 px-4 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (showSetupForm) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8 p-8">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl overflow-hidden  mb-4">
              <img src="/dc.png" alt="" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Set Up Your Company
            </h2>
            <p className="text-gray-600">
              Join an existing company or create a new one to get started.
            </p>
          </div>
          {isPhoneLogin && (
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Full Name
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your full name"
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your email address"
                  disabled={isSubmitting}
                />
              </div>
            </div>
          )}
          <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
            <button
              onClick={() => setSetupType("join")}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${setupType === "join"
                ? "bg-white shadow-sm text-gray-900"
                : "text-gray-600"
                }`}
            >
              Join Existing
            </button>
            <button
              onClick={() => setSetupType("create")}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${setupType === "create"
                ? "bg-white shadow-sm text-gray-900"
                : "text-gray-600"
                }`}
            >
              Create New
            </button>
          </div>
          <form onSubmit={handleSetupSubmission} className="space-y-6">
            <div>
              <label
                htmlFor="setupInput"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                {setupType === "join" ? "Company Code" : "Organization Name"}
              </label>
              <input
                id="setupInput"
                type="text"
                required
                value={setupType === "join" ? code : orgName}
                onChange={(e) =>
                  setupType === "join"
                    ? setCode(e.target.value)
                    : setOrgName(e.target.value)
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={
                  setupType === "join"
                    ? "Enter company code"
                    : "Enter organization name"
                }
                disabled={isSubmitting}
              />
              {emailError && (
                <p className="mt-2 text-sm text-red-600">{emailError}</p>
              )}
            </div>
            <div className="space-y-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Processing..." : "Continue"}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (tempToken) {
                    setShowSetupForm(false);
                    setShowPhoneProfileInput(true);
                    setIsPhoneLogin(false);
                  } else {
                    logout({
                      logoutParams: { returnTo: window.location.origin },
                    });
                  }
                }}
                className="w-full py-3 px-4 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (showCodeDisplay) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8 p-8">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl mb-4">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Company Created Successfully
            </h2>
            <p className="text-gray-600 mb-4">
              Share this unique code with your team members to invite them to
              join.
            </p>
            <div className="bg-gray-50 p-4 rounded-xl text-center font-mono text-xl text-blue-600 border border-gray-200">
              {companyCode}
            </div>
          </div>
          <button
            onClick={() => (window.location.href = "/")}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex -my-6 -mx-8">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br relative overflow-hidden">
        <img src="/datacircles-login.jpg" alt="" />
      </div>
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-gray-50 px-8 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-blue-400 rounded-2xl mb-4 pl-1">
              <img src="/DataCircles.png" alt="" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Welcome Back
            </h2>
            <p className="text-gray-600">
              Sign in to access your CRM dashboard
            </p>
          </div>
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start space-x-3">
                <svg
                  className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div>
                  <h4 className="text-red-800 font-medium mb-1">
                    Authentication Error
                  </h4>
                  <p className="text-red-600 text-sm">{error.message}</p>
                </div>
              </div>
            )}
            {emailError &&
              !showEmailInput &&
              !showSetupForm &&
              !showPhoneProfileInput && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start space-x-3">
                  <svg
                    className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="text-red-600 text-sm">{emailError}</p>
                </div>
              )}
            <div className="space-y-4">
              <button
                onClick={() =>
                  loginWithRedirect({
                    authorizationParams: { connection: "google-oauth2" },
                  })
                }
                className="w-full bg-white border-2 border-gray-200 text-gray-700 py-3.5 px-6 rounded-xl text-sm font-semibold hover:border-gray-300 hover:shadow-md transition-all duration-200 flex items-center justify-center space-x-3 group cursor-pointer"
              >
                <svg
                  className="w-5 h-5 group-hover:scale-110 transition-transform"
                  viewBox="0 0 24 24"
                >
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>
              <button
                onClick={() =>
                  loginWithRedirect({
                    authorizationParams: {
                      connection: "facebook",
                      scope: "openid profile email",
                    },
                  })
                }
                className="w-full bg-white border-2 border-gray-200 text-gray-700 py-3.5 px-6 rounded-xl text-sm font-semibold hover:border-gray-300 hover:shadow-md transition-all duration-200 flex items-center justify-center space-x-3 group cursor-pointer"
              >
                <svg
                  className="w-5 h-5 group-hover:scale-110 transition-transform"
                  viewBox="0 0 24 24"
                >
                  <path
                    fill="#1877F2"
                    d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
                  />
                </svg>
                <span>Continue with Facebook</span>
              </button>
              <button
                onClick={() =>
                  loginWithRedirect({
                    authorizationParams: { connection: "github" },
                  })
                }
                className="w-full bg-white border-2 border-gray-200 text-gray-700 py-3.5 px-6 rounded-xl text-sm font-semibold hover:border-gray-300 hover:shadow-md transition-all duration-200 flex items-center justify-center space-x-3 group cursor-pointer"
              >
                <svg
                  className="w-5 h-5 group-hover:scale-110 transition-transform"
                  viewBox="0 0 24 24"
                >
                  <path
                    fill="currentColor"
                    d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.333-1.756-1.333-1.756-1.087-.744.083-.729.083-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.807 1.305 3.492.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.694.825 .57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
                  />
                </svg>
                <span>Continue with GitHub</span>
              </button>
              <button
                onClick={() => setShowPhoneInput(true)}
                className="w-full bg-white border-2 border-gray-200 text-gray-700 py-3.5 px-6 rounded-xl text-sm font-semibold hover:border-gray-300 hover:shadow-md transition-all duration-200 flex items-center justify-center space-x-3 group cursor-pointer"
              >
                <svg
                  className="w-5 h-5 group-hover:scale-110 transition-transform text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                  />
                </svg>
                <span>Continue with Phone</span>
              </button>
              <button
                onClick={() => setShowEmailPasswordInput(true)}
                className="w-full bg-white border-2 border-gray-200 text-gray-700 py-3.5 px-6 rounded-xl text-sm font-semibold hover:border-gray-300 hover:shadow-md transition-all duration-200 flex items-center justify-center space-x-3 group cursor-pointer"
              >
                <svg className="w-5 h-5 group-hover:scale-110 transition-transform text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>Continue with Email & Password</span>
              </button>
            </div>
            <div className="flex items-center my-6">
              <div className="flex-1 border-t border-gray-200"></div>
              <span className="px-4 text-sm text-gray-500 bg-white">or</span>
              <div className="flex-1 border-t border-gray-200"></div>
            </div>
            <div className="text-center">
              {/* <p className="text-sm text-gray-600 mb-4">Need help accessing your account?</p> */}
              <button
                onClick={() => {
                  navigate("/super-admin/login");
                }}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors cursor-pointer"
              >
                Login as Super Admin
              </button>

              <p className="text-sm text-gray-600 mt-4">
                Need help accessing your account?
              </p>
              <button
                onClick={() => {
                  navigate("/super-admin/supporrt");
                }}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors cursor-pointer"
              >
                Contact Support
              </button>
            </div>
          </div>
          <div className="text-center mt-8">
            <p className="text-xs text-gray-500">
              By signing in, you agree to our{" "}
              <a href="#" className="text-blue-600 hover:text-blue-700">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="#" className="text-blue-600 hover:text-blue-700">
                Privacy Policy
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
