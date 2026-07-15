import React, { useState, useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { Link, useNavigate } from "react-router-dom";
import API from "../services/api";
import toast from "react-hot-toast";
import { User, Upload, Check, ChevronRight, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import onboardingBg from "../assets/onboarding-bg.png";
import AppToaster from "../components/AppToaster";

const Onboarding = () => {
  const { user } = useAuth0();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Direction for animation (1 for next, -1 for prev)
  const [direction, setDirection] = useState(1);

  const [formData, setFormData] = useState({
    // Step 1: Personal Info
    firstName: user?.given_name || "",
    lastName: user?.family_name || "",
    email: user?.email || "",

    // Step 2: Workspace Info
    workspaceName: "",
    workspaceAddress: "",
    workspaceState: "",
    workspaceImage: null,
    workspaceImagePreview: null,

    // Step 3: Intent
    usage: "",
    mainGoal: "",
    source: "",
  });

  useEffect(() => {
    if (user) {
      setFormData((prev) => ({
        ...prev,
        firstName: prev.firstName || user.given_name || "",
        lastName: prev.lastName || user.family_name || "",
        email: prev.email || user.email || "",
      }));
    }
  }, [user]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData((prev) => ({
        ...prev,
        workspaceImage: file,
        workspaceImagePreview: URL.createObjectURL(file),
      }));
    }
  };

  const handleOptionSelect = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Validation Logic
  const isStep1Valid = () => {
    return (
      formData.firstName.trim() &&
      formData.lastName.trim() &&
      formData.email.trim()
    );
  };

  const isStep2Valid = () => {
    return (
      formData.workspaceName.trim() &&
      formData.workspaceAddress.trim() &&
      formData.workspaceState.trim()
    );
  };

  const isStep3Valid = () => {
    return formData.usage && formData.mainGoal && formData.source;
  };

  const nextStep = () => {
    if (step === 1 && !isStep1Valid()) return;
    if (step === 2 && !isStep2Valid()) return;

    setDirection(1);
    setStep((prev) => prev + 1);
  };

  const prevStep = () => {
    setDirection(-1);
    setStep((prev) => prev - 1);
  };

  const handleSubmit = async () => {
    if (!isStep3Valid()) return;

    setLoading(true);
    const loadingToast = toast.loading("Setting up your workspace...");

    try {
      const data = new FormData();
      const fullName = `${formData.firstName} ${formData.lastName}`.trim();

      data.append("name", fullName);
      data.append("firstName", formData.firstName);
      data.append("lastName", formData.lastName);
      data.append("email", formData.email);
      data.append("workspaceName", formData.workspaceName);
      data.append("workspaceAddress", formData.workspaceAddress);
      data.append("workspaceState", formData.workspaceState);
      data.append("usage", formData.usage);
      data.append("mainGoal", formData.mainGoal);
      data.append("source", formData.source);

      if (formData.workspaceImage) {
        data.append("workspaceImage", formData.workspaceImage);
      }

      await API.post("/auth/setup-workspace", data, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      toast.success("Setup complete!", { id: loadingToast });

      // Navigate to dashboard
      setTimeout(() => {
        navigate("/");
      }, 1000);
    } catch (error) {
      console.error("Onboarding error:", error);
      toast.error("Something went wrong. Please try again.", {
        id: loadingToast,
      });
    } finally {
      setLoading(false);
    }
  };

  // Animation Variants
  const variants = {
    enter: (direction) => ({
      x: direction > 0 ? 50 : -50,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction) => ({
      x: direction < 0 ? 50 : -50,
      opacity: 0,
    }),
  };

  // --- Render Functions for Each Step ---

  const renderStep1 = () => (
    <motion.div
      key="step1"
      custom={direction}
      variants={variants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="space-y-5"
    >
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-gray-900 font-sf">
          Getting to know you
        </h1>
        <p className="text-sm text-gray-500">
          Knowing you better helps us tailor your experience.
        </p>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              First name
            </label>
            <input
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={handleInputChange}
              placeholder="Alexander"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all bg-gray-50/50 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              Last Name
            </label>
            <input
              type="text"
              name="lastName"
              value={formData.lastName}
              onChange={handleInputChange}
              placeholder="Jhoe"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all bg-gray-50/50 text-sm"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
            Email
          </label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            placeholder="alexanderjhoe@mail.com"
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all bg-gray-50/50 text-sm"
          />
        </div>
      </div>

      <button
        onClick={nextStep}
        disabled={!isStep1Valid()}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-all duration-200 shadow-md flex items-center justify-center gap-2 text-sm"
      >
        Continue
      </button>
    </motion.div>
  );

  const renderStep2 = () => (
    <motion.div
      key="step2"
      custom={direction}
      variants={variants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="space-y-5"
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2 mb-1">
          <button
            onClick={prevStep}
            className="p-1 -ml-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ChevronRight className="w-5 h-5 rotate-180" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900 font-sf">
            Create your space
          </h1>
        </div>
        <p className="text-sm text-gray-500">
          Organize your tools, tasks, and teams—all in one place.
        </p>
      </div>

      <div className="flex justify-start py-2">
        <div className="relative group cursor-pointer">
          <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center border-2 border-dashed border-gray-300 hover:border-blue-500 transition-colors overflow-hidden">
            {formData.workspaceImagePreview ? (
              <img
                src={formData.workspaceImagePreview}
                alt="Preview"
                className="w-full h-full object-fit"
              />
            ) : (
              <User className="w-6 h-6 text-gray-400" />
            )}
          </div>
          <label className="absolute bottom-0 right-0 bg-white shadow-sm border border-gray-200 rounded-full p-1.5 cursor-pointer hover:bg-gray-50">
            <Upload className="w-3 h-3 text-gray-600" />
            <input
              type="file"
              className="hidden"
              accept="image/*"
              onChange={handleImageUpload}
            />
          </label>
          <span className="absolute left-20 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-600 whitespace-nowrap">
            <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 border-dashed border-gray-200 text-xs font-semibold hover:border-blue-400 hover:text-blue-600 transition-all cursor-pointer">
              <Upload className="w-3.5 h-3.5" /> Upload Logo
            </span>
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
            Workspace Name
          </label>
          <input
            type="text"
            name="workspaceName"
            value={formData.workspaceName}
            onChange={handleInputChange}
            placeholder="DataCircles Workspace"
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all bg-gray-50/50 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
            Address
          </label>
          <input
            type="text"
            name="workspaceAddress"
            value={formData.workspaceAddress}
            onChange={handleInputChange}
            placeholder="Enter Address"
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all bg-gray-50/50 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
            State
          </label>
          <input
            type="text"
            name="workspaceState"
            value={formData.workspaceState}
            onChange={handleInputChange}
            placeholder="Enter State"
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all bg-gray-50/50 text-sm"
          />
        </div>
      </div>

      <button
        onClick={nextStep}
        disabled={!isStep2Valid()}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-all duration-200 shadow-md flex items-center justify-center gap-2 text-sm"
      >
        Continue
      </button>
    </motion.div>
  );

  const renderStep3 = () => (
    <motion.div
      key="step3"
      custom={direction}
      variants={variants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="space-y-5"
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2 mb-1">
          <button
            onClick={prevStep}
            className="p-1 -ml-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ChevronRight className="w-5 h-5 rotate-180" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900 font-sf">
            One last thing
          </h1>
        </div>
        <p className="text-sm text-gray-500">
          Tailor DataCircles to your exact needs.
        </p>
      </div>

      <div className="space-y-4">
        {/* Question 1 */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-700">
            What will you be using DataCircles for?
          </label>
          <div className="flex flex-wrap gap-2">
            {["CRM", "Project Management", "Invoicing", "HR"].map((opt) => (
              <button
                key={opt}
                onClick={() => handleOptionSelect("usage", opt)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                  formData.usage === opt
                    ? "bg-blue-50 border-blue-500 text-blue-700"
                    : "bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                {formData.usage === opt && (
                  <Check className="w-3 h-3 inline mr-1.5" />
                )}
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Question 2 */}
        <div className="space-y-2">
          {/* Fixed Typo: "what would be your" -> "What is your" for brevity */}
          <label className="text-xs font-semibold text-gray-700">
            What is your main goal?
          </label>
          <div className="flex flex-wrap gap-2">
            {["Increase Sales", "Organization", "Team Collab", "Others"].map(
              (opt) => (
                <button
                  key={opt}
                  onClick={() => handleOptionSelect("mainGoal", opt)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                    formData.mainGoal === opt
                      ? "bg-blue-50 border-blue-500 text-blue-700"
                      : "bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {formData.mainGoal === opt && (
                    <Check className="w-3 h-3 inline mr-1.5" />
                  )}
                  {opt}
                </button>
              ),
            )}
          </div>
        </div>

        {/* Question 3 */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-700">
            Where did you hear about us?
          </label>
          <div className="flex flex-wrap gap-2">
            {["Google", "LinkedIn", "Friend", "Others"].map((opt) => (
              <button
                key={opt}
                onClick={() => handleOptionSelect("source", opt)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                  formData.source === opt
                    ? "bg-blue-50 border-blue-500 text-blue-700"
                    : "bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                {formData.source === opt && (
                  <Check className="w-3 h-3 inline mr-1.5" />
                )}
                {opt}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading || !isStep3Valid()}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-all duration-200 shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
      >
        {loading ? "Setting up..." : "Finish Setup"}
      </button>
    </motion.div>
  );

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-white font-inter">
      <AppToaster />

      {/* Left Side - Hero Image */}
      <div className="hidden lg:block lg:w-1/2 relative bg-gray-900 h-[90%]">
        <img
          src={onboardingBg}
          alt="Dashboard Preview"
          className="absolute inset-0 w-full h-full object-cover opacity-50 mix-blend-overlay"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/40 to-purple-900/40" />

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-white/20 text-9xl font-bold tracking-tighter select-none blur-sm">
            DC
          </span>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center h-full relative">
        <div className="w-full max-w-[420px] px-8 py-10 flex flex-col justify-center h-full max-h-[800px]">
          {/* Header Logo & Progress */}
          <div className="mb-10">
            <div className="flex items-center gap-2.5 mb-8">
              <img
                src="/DataCircles.png"
                alt="DataCircles Logo"
                className="h-10 w-auto object-contain"
              />
              <span className="text-3xl font-bold font-inter text-[#0F172A] tracking-tight">
                DataCircles
              </span>
            </div>

            {/* Progress Indicator */}
            <div className="flex items-center gap-3">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center">
                  <div
                    className={`
                                            w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500 border
                                            ${
                                              step === s
                                                ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-200 scale-100"
                                                : step > s
                                                  ? "bg-green-500 text-white border-green-500"
                                                  : "bg-white text-gray-300 border-gray-200"
                                            }
                                        `}
                  >
                    {step > s ? <Check className="w-3.5 h-3.5" /> : s}
                  </div>
                  {s < 3 && (
                    <div
                      className={`w-10 h-0.5 mx-2 transition-colors duration-500 ease-in-out
                                            ${step > s ? "bg-green-500" : "bg-gray-100"}`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Animated Form Content */}
          <div className="relative min-h-[400px]">
            <AnimatePresence mode="wait" custom={direction}>
              {step === 1 && renderStep1()}
              {step === 2 && renderStep2()}
              {step === 3 && renderStep3()}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
