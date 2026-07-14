import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { formatNumberToIndian } from "../utils/numberFormatter";
import {
  ArrowLeft,
  Building,
  Users,
  CreditCard,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  TrendingUp,
  Edit,
  Trash2,
  Download,
  Mail,
  IndianRupee,
  Package,
  Activity,
  IndianRupeeIcon,
  Receipt,
  Timer,
  ReceiptIndianRupeeIcon,
  Ban,
} from "lucide-react";
import toast from "react-hot-toast";
import API, { configureAxios } from "../services/api";
import jsPDF from "jspdf";
import "jspdf-autotable";
import autoTable from "jspdf-autotable";

const Shimmer = () => (
  <div className="animate-pulse space-y-6">
    <div className="h-8 bg-gray-200 rounded w-1/4"></div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 h-64"></div>
        <div className="bg-white rounded-xl border border-gray-200 h-96"></div>
      </div>
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 h-48"></div>
        <div className="bg-white rounded-xl border border-gray-200 h-64"></div>
      </div>
    </div>
  </div>
);

const InfoRow = ({ label, value, icon: Icon, highlight = false }) => (
  <div className="flex items-start justify-between py-3 border-b border-gray-100 last:border-0">
    <div className="flex items-center space-x-2">
      {Icon && <Icon className="w-4 h-4 text-gray-400" />}
      <span className="text-sm font-medium text-gray-600">{label}</span>
    </div>
    <span
      className={`text-sm ${
        highlight ? "font-semibold text-gray-900" : "text-gray-900"
      }`}
    >
      {value || "N/A"}
    </span>
  </div>
);

const StatusBadge = ({ status, isTrialActive, size = "md" }) => {
  if (isTrialActive) {
    return (
      <span
        className={`inline-flex items-center ${
          size === "lg" ? "px-4 py-2 text-sm" : "px-3 py-1 text-xs"
        } font-semibold rounded-full bg-blue-100 text-blue-800 border border-blue-200`}
      >
        <Clock className={`${size === "lg" ? "w-4 h-4" : "w-3 h-3"} mr-1.5`} />
        Trial Active
      </span>
    );
  }

  const statusConfig = {
    active: {
      bg: "bg-green-100",
      text: "text-green-800",
      border: "border-green-200",
      icon: CheckCircle2,
      label: "Active",
    },
    authenticated: {
      bg: "bg-blue-100",
      text: "text-blue-800",
      border: "border-blue-200",
      icon: Clock,
      label: "Authenticated",
    },
    created: {
      bg: "bg-gray-100",
      text: "text-gray-800",
      border: "border-gray-200",
      icon: Clock,
      label: "Created",
    },
    paused: {
      bg: "bg-yellow-100",
      text: "text-yellow-800",
      border: "border-yellow-200",
      icon: AlertCircle,
      label: "Paused",
    },
    halted: {
      bg: "bg-orange-100",
      text: "text-orange-800",
      border: "border-orange-200",
      icon: AlertCircle,
      label: "Halted",
    },
    cancelled: {
      bg: "bg-red-100",
      text: "text-red-800",
      border: "border-red-200",
      icon: XCircle,
      label: "Cancelled",
    },
    expired: {
      bg: "bg-red-100",
      text: "text-red-800",
      border: "border-red-200",
      icon: XCircle,
      label: "Expired",
    },
    completed: {
      bg: "bg-purple-100",
      text: "text-purple-800",
      border: "border-purple-200",
      icon: CheckCircle2,
      label: "Completed",
    },
  };

  const config = statusConfig[status] || statusConfig.created;
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center ${
        size === "lg" ? "px-4 py-2 text-sm" : "px-3 py-1 text-xs"
      } font-semibold rounded-full ${config.bg} ${config.text} border ${
        config.border
      }`}
    >
      <Icon className={`${size === "lg" ? "w-4 h-4" : "w-3 h-3"} mr-1.5`} />
      {config.label}
    </span>
  );
};

const PaymentStatusBadge = ({ status, size = "md" }) => {
  const config = {
    captured: {
      bg: "bg-green-100",
      text: "text-green-800",
      icon: CheckCircle2,
      label: "Paid",
    },
    authorized: {
      bg: "bg-blue-100",
      text: "text-blue-800",
      icon: Clock,
      label: "Authorized",
    },
    failed: {
      bg: "bg-red-100",
      text: "text-red-800",
      icon: XCircle,
      label: "Failed",
    },
    refunded: {
      bg: "bg-orange-100",
      text: "text-orange-800",
      icon: AlertCircle,
      label: "Refunded",
    },
    created: {
      bg: "bg-gray-100",
      text: "text-gray-800",
      icon: Clock,
      label: "Pending",
    },
  }[status] || {
    bg: "bg-gray-100",
    text: "text-gray-800",
    icon: Clock,
    label: status,
  };

  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center ${
        size === "lg" ? "px-4 py-2 text-sm" : "px-2.5 py-1 text-xs"
      } font-semibold rounded-full ${config.bg} ${config.text} border`}
    >
      <Icon className={`${size === "lg" ? "w-4 h-4" : "w-3 h-3"} mr-1`} />
      {config.label}
    </span>
  );
};

const AlertBanner = ({ type, title, message, icon: Icon }) => {
  const styles = {
    warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
    danger: "bg-red-50 border-red-200 text-red-800",
    info: "bg-blue-50 border-blue-200 text-blue-800",
    success: "bg-green-50 border-green-200 text-green-800",
  };

  return (
    <div
      className={`${styles[type]} border rounded-lg p-4 flex items-start space-x-3`}
    >
      {Icon && <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />}
      <div className="flex-1">
        {title && <h4 className="font-semibold mb-1">{title}</h4>}
        <p className="text-sm">{message}</p>
      </div>
    </div>
  );
};

// Adjust trial days — full flexibility to increase or decrease. Decreasing
// (or any adjustment that would end the trial immediately) requires typed
// confirmation, matching the severity of Delete Organization, since it
// immediately reduces a customer's access.
const AdjustTrialModal = ({ isOpen, onClose, onConfirm, currentTrialEnd }) => {
  const [adjustmentDays, setAdjustmentDays] = useState(7);
  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const newTrialEnd = new Date(
    new Date(currentTrialEnd).getTime() + adjustmentDays * 24 * 60 * 60 * 1000
  );
  const resultsInExpiry = newTrialEnd <= new Date();
  const isReduction = adjustmentDays < 0;
  const requiresTypedConfirm = isReduction || resultsInExpiry;

  const handleSubmit = async () => {
    if (requiresTypedConfirm && confirmText !== "CONFIRM") {
      toast.error('Please type "CONFIRM" to proceed');
      return;
    }
    setSubmitting(true);
    try {
      await onConfirm(adjustmentDays);
      onClose();
      setConfirmText("");
    } catch (error) {
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-[100002]">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Timer className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900">
            Adjust Trial Period
          </h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Adjustment (Days)
            </label>
            <input
              type="number"
              min="-60"
              max="60"
              value={adjustmentDays}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setAdjustmentDays(
                  Number.isNaN(val) ? 0 : Math.max(-60, Math.min(60, val))
                );
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Between -60 and 60 days. Positive extends the trial, negative
              reduces it.
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-2">
              <Clock className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900">
                  Current Trial Ends
                </p>
                <p className="text-sm text-blue-700">
                  {new Date(currentTrialEnd).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-2 mt-3">
              {resultsInExpiry ? (
                <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
              )}
              <div className="flex-1">
                <p
                  className={`text-sm font-medium ${
                    resultsInExpiry ? "text-red-900" : "text-green-900"
                  }`}
                >
                  New Trial End Date
                </p>
                <p
                  className={`text-sm ${
                    resultsInExpiry ? "text-red-700" : "text-green-700"
                  }`}
                >
                  {newTrialEnd.toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>
          </div>

          {requiresTypedConfirm && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800 font-medium mb-1">
                ⚠️{" "}
                {resultsInExpiry
                  ? "This will end the trial immediately and cut off access."
                  : "This reduces the customer's remaining trial time."}
              </p>
              <p className="text-xs text-yellow-700 mb-3">
                Type{" "}
                <span className="font-mono font-bold text-gray-900">
                  CONFIRM
                </span>{" "}
                to proceed.
              </p>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type CONFIRM"
                className="w-full px-4 py-2 border border-yellow-300 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>
          )}

          <div className="flex space-x-3">
            <button
              onClick={() => {
                onClose();
                setConfirmText("");
              }}
              disabled={submitting}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Timer className="w-4 h-4" />
                  <span>Apply Adjustment</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// End trial immediately — same severity tier as Delete Organization since
// it instantly cuts off a paying-soon customer's access. Typed confirmation
// required.
const EndTrialModal = ({ isOpen, onClose, onConfirm, orgName }) => {
  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (confirmText !== "END TRIAL") {
      toast.error('Please type "END TRIAL" to confirm');
      return;
    }
    setSubmitting(true);
    try {
      await onConfirm();
      onClose();
      setConfirmText("");
    } catch (error) {
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100003] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl p-6 max-w-lg w-full shadow-2xl mx-4">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-red-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              End Trial Now
            </h3>
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800 font-medium mb-1">
                ⚠️ Warning: This takes effect immediately!
              </p>
              <p className="text-xs text-yellow-700">
                {orgName || "This organization"}'s trial will end right now
                and access will be cut off, regardless of days remaining.
              </p>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Type{" "}
              <span className="font-mono font-bold text-gray-900">
                END TRIAL
              </span>{" "}
              to confirm:
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type END TRIAL to confirm"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 mb-4"
            />
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  onClose();
                  setConfirmText("");
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={submitting}
              >
                {submitting ? (
                  <span className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Ending...
                  </span>
                ) : (
                  "End Trial Now"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Start a trial for an org with no live paid subscription. The hard block
// (live paid subscription exists) is enforced server-side with no override —
// this modal only ever offers a simple confirm because the dangerous case
// can never reach it; the dangerous case is instead shown as a disabled
// state with an explanation, before the modal would even open.
const StartTrialModal = ({ isOpen, onClose, onConfirm }) => {
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-[100002]">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Timer className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900">
            Start Free Trial
          </h3>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          This will start a 7-day free trial for this organization's admin
          user. This is only possible because the organization currently has
          no live paid subscription.
        </p>
        <div className="flex space-x-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Starting...</span>
              </>
            ) : (
              <>
                <Timer className="w-4 h-4" />
                <span>Start Trial</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// Cancel the org's subscription via the SAME cancelSubscription logic a
// real user's Cancel button uses — trial cancellation if mid-trial,
// schedule-at-period-end via Razorpay if paid. Typed confirmation since
// this immediately schedules the end of a customer's paid access, the same
// severity tier as Delete Organization / End Trial Now.
const CancelSubscriptionModal = ({ isOpen, onClose, onConfirm, orgName, isTrial }) => {
  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (confirmText !== "CANCEL") {
      toast.error('Please type "CANCEL" to confirm');
      return;
    }
    setSubmitting(true);
    try {
      await onConfirm();
      onClose();
      setConfirmText("");
    } catch (error) {
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100003] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl p-6 max-w-lg w-full shadow-2xl mx-4">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
            <Ban className="w-6 h-6 text-red-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Cancel Subscription
            </h3>
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800 font-medium mb-1">
                ⚠️ Warning: This affects {orgName || "this organization"}'s real access!
              </p>
              <p className="text-xs text-yellow-700">
                {isTrial
                  ? "This will cancel the trial immediately — same as the organization's own Cancel button during a trial."
                  : "This schedules cancellation at the end of the current billing period via Razorpay — same as the organization's own Cancel button."}
              </p>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Type{" "}
              <span className="font-mono font-bold text-gray-900">
                CANCEL
              </span>{" "}
              to confirm:
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type CANCEL to confirm"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 mb-4"
            />
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  onClose();
                  setConfirmText("");
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={submitting}
              >
                {submitting ? (
                  <span className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Cancelling...
                  </span>
                ) : (
                  "Cancel Subscription"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const BillingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showEndTrialModal, setShowEndTrialModal] = useState(false);
  const [showStartTrialModal, setShowStartTrialModal] = useState(false);
  const [showCancelSubModal, setShowCancelSubModal] = useState(false);

  // Fetch subscription
  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        setLoading(true);
        configureAxios();

        const response = await API.get("/super-admin/billing", {
          params: { page: 1, limit: 1000 },
        });

        const found = response.data.subscriptions?.find((s) => s._id === id);
        if (!found) throw new Error("Subscription not found");
        setSubscription(found);
      } catch (err) {
        setError(err.response?.data?.error || "Failed to load subscription");
        toast.error(err.response?.data?.error || "Failed to load");
      } finally {
        setLoading(false);
      }
    };

    fetchSubscription();
  }, [id]);

  // Fetch payment history
  useEffect(() => {
    if (!subscription?.organization?._id) return;

    const fetchPayments = async () => {
      try {
        setPaymentsLoading(true);
        const response = await API.get(
          `/super-admin/organizations/${subscription.organization._id}/payments`
        );
        setPayments(response.data.payments || []);
      } catch (err) {
        toast.error("Failed to load payment history");
      } finally {
        setPaymentsLoading(false);
      }
    };

    fetchPayments();
  }, [subscription?.organization?._id]);

  const handleAdjustTrial = async (adjustmentDays) => {
    try {
      const response = await API.post(
        `/super-admin/subscriptions/${id}/adjust-trial`,
        {
          adjustmentDays,
        }
      );

      if (response.data.success) {
        toast.success(response.data.message);

        setSubscription((prev) => ({
          ...prev,
          isTrialActive: response.data.subscription.isTrialActive,
          appStatus: response.data.subscription.appStatus,
          trialEnd: response.data.subscription.trialEnd,
          currentPeriodEnd: response.data.subscription.trialEnd,
        }));
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to adjust trial");
      throw err;
    }
  };

  const handleEndTrialNow = async () => {
    try {
      const response = await API.post(
        `/super-admin/subscriptions/${id}/end-trial`
      );

      if (response.data.success) {
        toast.success(response.data.message);

        setSubscription((prev) => ({
          ...prev,
          isTrialActive: false,
          appStatus: response.data.subscription.appStatus,
          trialEnd: response.data.subscription.trialEnd,
          currentPeriodEnd: response.data.subscription.trialEnd,
        }));
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to end trial");
      throw err;
    }
  };

  const handleStartTrial = async () => {
    try {
      const organizationId = subscription?.organization?._id;
      const response = await API.post(
        `/super-admin/organizations/${organizationId}/start-trial`
      );

      if (response.data.success) {
        toast.success(response.data.message || "Trial started");
        // Never spread the raw subscription doc wholesale — its
        // `organization` field is an unpopulated ObjectId, and clobbering
        // the populated {_id, name, email} object we loaded the page with
        // breaks every subsequent action on this page that reads
        // subscription.organization._id (Change Plan, Cancel, etc.).
        const { organization, ...rest } = response.data.subscription || {};
        setSubscription((prev) => ({ ...prev, ...rest }));
      }
    } catch (err) {
      if (err.response?.data?.code === "PAID_SUBSCRIPTION_ACTIVE") {
        toast.error(
          "Cannot start a trial — this organization has a live paid subscription. Cancel it first and wait for it to take effect."
        );
      } else {
        toast.error(err.response?.data?.error || "Failed to start trial");
      }
      throw err;
    }
  };

  const handleCancelSubscription = async () => {
    try {
      const organizationId = subscription?.organization?._id;
      const response = await API.post(
        `/super-admin/organizations/${organizationId}/cancel-subscription`
      );

      if (response.data.success) {
        toast.success(response.data.message || "Subscription cancelled");
        setSubscription((prev) => ({
          ...prev,
          cancelAtPeriodEnd: true,
        }));
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to cancel subscription");
      throw err;
    }
  };

  // Invoice download helper functions
  const getPaymentForLabel = (paymentFor) => {
    const labels = {
      subscription: "Subscription Renewal",
      upgrade: "Plan Upgrade",
      additional_users: "Additional Users",
      initial: "Initial Subscription",
      upgrade_proration: "Upgrade (Prorated)",
      seat_addition: "Additional Seats",
    };
    return labels[paymentFor] || paymentFor || "Subscription Payment";
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const formatAmount = (amount, currency = "INR") => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency,
    }).format(amount);
  };

  const handleDownloadInvoice = (payment) => {
    const doc = new jsPDF();

    // Define color palette
    const primaryColor = [51, 51, 51];
    const accentColor = [37, 99, 235];
    const lightGray = [245, 245, 245];
    const mediumGray = [156, 163, 175];

    const formatCurrency = (amount, currency = "INR") => {
      const value = amount.toFixed(2);
      return `${currency} ${value}`;
    };

    const loadImageAndGeneratePDF = () => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.src = "/image.png";

      img.onload = function () {
        // Header with logo
        const logoWidth = 55;
        const logoHeight = 25;
        doc.addImage(img, "PNG", 20, 12, logoWidth, logoHeight);

        // doc.setFontSize(11);
        // doc.setTextColor(...primaryColor);
        // doc.setFont("helvetica", "bold");
        // doc.text("DataCircles CRM", 50, 20);

        // doc.setFontSize(9);
        // doc.setFont("helvetica", "normal");
        // doc.setTextColor(...mediumGray);
        // doc.text("Mumbai, India", 50, 26);

        doc.setFontSize(28);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...accentColor);
        doc.text("INVOICE", 190, 25, { align: "right" });

        doc.setDrawColor(...mediumGray);
        doc.setLineWidth(0.5);
        doc.line(20, 40, 190, 40);

        // Invoice details
        const detailsStartY = 50;
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");

        doc.setTextColor(...mediumGray);
        doc.text("BILL TO", 20, detailsStartY);

        doc.setTextColor(...primaryColor);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(
          subscription?.organization?.name || "Customer",
          20,
          detailsStartY + 6
        );

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...mediumGray);
        doc.text(
          subscription?.organization?.email || "",
          20,
          detailsStartY + 12
        );

        const rightColX = 120;
        doc.setFontSize(9);
        doc.setTextColor(...mediumGray);

        doc.text("Invoice Number:", rightColX, detailsStartY);
        doc.text("Invoice Date:", rightColX, detailsStartY + 6);
        doc.text("Payment Status:", rightColX, detailsStartY + 12);

        if (payment.razorpayOrderId) {
          doc.text("Order ID:", rightColX, detailsStartY + 18);
        }

        doc.setTextColor(...primaryColor);
        doc.setFont("helvetica", "normal");

        const invoiceNum = payment.razorpayPaymentId || payment._id;
        doc.text(invoiceNum.substring(0, 25), 190, detailsStartY, {
          align: "right",
        });
        doc.text(formatDate(payment.createdAt), 190, detailsStartY + 6, {
          align: "right",
        });

        const statusUpper = payment.status.toUpperCase();
        if (payment.status === "captured") {
          doc.setTextColor(34, 197, 94);
        } else if (payment.status === "refunded") {
          doc.setTextColor(168, 85, 247);
        }
        doc.setFont("helvetica", "bold");
        doc.text(statusUpper, 190, detailsStartY + 12, { align: "right" });

        if (payment.razorpayOrderId) {
          doc.setFont("helvetica", "normal");
          doc.setTextColor(...primaryColor);
          doc.text(
            payment.razorpayOrderId.substring(0, 20),
            190,
            detailsStartY + 18,
            { align: "right" }
          );
        }

        // Table
        const tableStartY = payment.razorpayOrderId ? 80 : 74;

        autoTable(doc, {
          startY: tableStartY,
          head: [["Description", "Payment Method", "Amount"]],
          body: [
            [
              getPaymentForLabel(payment.paymentFor),
              (payment.method || "Online").toUpperCase(),
              formatCurrency(payment.amount, payment.currency),
            ],
          ],
          theme: "plain",
          headStyles: {
            fillColor: lightGray,
            textColor: primaryColor,
            fontSize: 9,
            fontStyle: "bold",
            cellPadding: { top: 5, right: 8, bottom: 5, left: 8 },
            lineWidth: 0,
          },
          bodyStyles: {
            textColor: primaryColor,
            fontSize: 9,
            cellPadding: { top: 8, right: 8, bottom: 8, left: 8 },
          },
          columnStyles: {
            0: { cellWidth: 80 },
            1: { cellWidth: 50 },
            2: { halign: "right", fontStyle: "bold" },
          },
          styles: {
            lineColor: [229, 231, 235],
            lineWidth: 0.1,
          },
          margin: { left: 20, right: 20 },
        });

        // Total
        const finalY = doc.lastAutoTable.finalY + 10;

        doc.setFillColor(...lightGray);
        doc.rect(110, finalY - 5, 80, 15, "F");

        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...primaryColor);
        doc.text("Total Amount:", 115, finalY + 3);

        doc.setFontSize(12);
        doc.setTextColor(...accentColor);
        doc.text(
          formatCurrency(payment.amount, payment.currency),
          185,
          finalY + 3,
          {
            align: "right",
          }
        );

        // Transaction details
        if (payment.razorpayPaymentId || payment.razorpayOrderId) {
          const metaStartY = finalY + 25;

          doc.setFontSize(8);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(...mediumGray);
          doc.text("TRANSACTION DETAILS", 20, metaStartY);

          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);

          if (payment.razorpayPaymentId) {
            doc.text(
              `Payment ID: ${payment.razorpayPaymentId}`,
              20,
              metaStartY + 5
            );
          }
          if (payment.razorpayOrderId) {
            doc.text(
              `Order ID: ${payment.razorpayOrderId}`,
              20,
              metaStartY + 10
            );
          }
        }

        // Footer
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...mediumGray);
        doc.text("Thank you for your business!", 105, 275, { align: "center" });

        doc.setDrawColor(...mediumGray);
        doc.setLineWidth(0.3);
        doc.line(20, 280, 190, 280);

        const fileName = `Invoice_${
          payment.razorpayPaymentId?.substring(0, 10) || payment._id
        }_${new Date(payment.createdAt).getFullYear()}.pdf`;
        doc.save(fileName);
      };

      img.onerror = function () {
        console.error("Failed to load logo");
        toast.error("Failed to generate invoice");
      };
    };

    loadImageAndGeneratePDF();
  };

  if (loading) return <Shimmer />;
  if (error || !subscription) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Error</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate("/super-admin/billing")}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Billing
          </button>
        </div>
      </div>
    );
  }

  const sub = subscription;
  const daysUntilNextBilling = sub.nextBillingDate
    ? Math.ceil(
        (new Date(sub.nextBillingDate) - new Date()) / (1000 * 60 * 60 * 24)
      )
    : null;
  const trialDaysRemaining =
    sub.isTrialActive && sub.trialEnd
      ? Math.ceil((new Date(sub.trialEnd) - new Date()) / (1000 * 60 * 60 * 24))
      : null;

  // A "live paid subscription" — confirmed payment AND an active/past_due
  // appStatus. While this is true, starting a new trial is hard-blocked
  // server-side with no override; the UI mirrors that by disabling the
  // action entirely rather than offering a button that would just 409.
  const hasLivePaidSubscription =
    sub.isPaymentConfirmed && ["active", "past_due"].includes(sub.appStatus);

  const isInTrial = sub.appStatus === "trial" || sub.isTrialActive;

  // Adjusting (extend/reduce) trial days only makes sense once a trial
  // exists or has existed — same precondition as before, just renamed.
  const canAdjustTrial =
    !hasLivePaidSubscription &&
    (sub.isTrialActive || (!sub.isTrialActive && sub.trialUsed));

  const canEndTrial = !hasLivePaidSubscription && isInTrial;

  const canStartTrial = !hasLivePaidSubscription && !isInTrial;

  // Cancel must mirror the real user's Plans page EXACTLY (SubscriptionPlans.jsx):
  // it only ever shows "Cancel Subscription" when isPaymentConfirmed is true AND
  // isTrialActive is false — a real user has no cancel option during a trial at
  // all (trial-cancellation is intentionally a super-admin-only flexibility via
  // End Trial Now / Adjust Trial, not exposed to users). The button also
  // disappears once cancellation is already scheduled (cancelAtPeriodEnd).
  const canCancelSubscription =
    sub.isPaymentConfirmed && !sub.isTrialActive && !sub.cancelAtPeriodEnd;

  return (
    <div className="">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate("/super-admin/billing")}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Subscription Details
            </h1>
            <p className="text-gray-500 mt-1">
              {sub.organization?.name || "Unknown"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canStartTrial && (
            <button
              onClick={() => setShowStartTrialModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Timer className="w-4 h-4" />
              <span className="hidden sm:inline">Start Trial</span>
            </button>
          )}
          {hasLivePaidSubscription && (
            <button
              disabled
              title="This organization has a live paid subscription. Cancel it first and wait for it to take effect before starting a trial."
              className="flex items-center space-x-2 px-4 py-2 bg-gray-200 text-gray-500 rounded-lg cursor-not-allowed"
            >
              <Timer className="w-4 h-4" />
              <span className="hidden sm:inline">Start Trial</span>
            </button>
          )}
          {canAdjustTrial && (
            <button
              onClick={() => setShowAdjustModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Timer className="w-4 h-4" />
              <span className="hidden sm:inline">Adjust Trial</span>
            </button>
          )}
          {canEndTrial && (
            <button
              onClick={() => setShowEndTrialModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <XCircle className="w-4 h-4" />
              <span className="hidden sm:inline">End Trial Now</span>
            </button>
          )}
          {canCancelSubscription && (
            <button
              onClick={() => setShowCancelSubModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <Ban className="w-4 h-4" />
              <span className="hidden sm:inline">Cancel Subscription</span>
            </button>
          )}
        </div>
      </div>

      <StartTrialModal
        isOpen={showStartTrialModal}
        onClose={() => setShowStartTrialModal(false)}
        onConfirm={handleStartTrial}
      />

      <CancelSubscriptionModal
        isOpen={showCancelSubModal}
        onClose={() => setShowCancelSubModal(false)}
        onConfirm={handleCancelSubscription}
        orgName={sub.organization?.name}
        isTrial={isInTrial}
      />

      <AdjustTrialModal
        isOpen={showAdjustModal}
        onClose={() => setShowAdjustModal(false)}
        onConfirm={handleAdjustTrial}
        currentTrialEnd={sub.trialEnd || new Date()}
      />

      <EndTrialModal
        isOpen={showEndTrialModal}
        onClose={() => setShowEndTrialModal(false)}
        onConfirm={handleEndTrialNow}
        orgName={sub.organization?.name}
      />

      {/* Alerts */}
      <div className="space-y-4 mb-4">
        {hasLivePaidSubscription && (
          <AlertBanner
            type="warning"
            icon={AlertCircle}
            title="Trial Actions Unavailable — Live Paid Subscription"
            message="This organization has a confirmed, active paid subscription. A trial cannot be started while a paid subscription is live. Cancel the subscription first and wait for it to take effect (immediately if outside a paid period, or at period end if still within one) — only then will starting a trial become available."
          />
        )}
        {sub.isTrialActive && trialDaysRemaining !== null && (
          <AlertBanner
            type={trialDaysRemaining <= 3 ? "warning" : "info"}
            icon={Clock}
            title="Trial Active"
            message={`Ends in ${trialDaysRemaining} days on ${new Date(
              sub.trialEnd
            ).toLocaleDateString()}.`}
          />
        )}
        {sub.cancelAtPeriodEnd && (
          <AlertBanner
            type="danger"
            icon={XCircle}
            title="Cancellation Scheduled"
            message={`Cancels on ${new Date(
              sub.currentPeriodEnd
            ).toLocaleDateString()}.`}
          />
        )}
        {!sub.isPaymentConfirmed && sub.paymentStatus === "pending_payment" && (
          <AlertBanner
            type="warning"
            icon={AlertCircle}
            title="Payment Pending"
            message="Payment not confirmed yet."
          />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Subscription Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Overview */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold">Overview</h2>
                <p className="text-sm text-gray-500">Plan & Status</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <StatusBadge
                  status={sub.status}
                  isTrialActive={sub.isTrialActive}
                  size="lg"
                />
                <PaymentStatusBadge
                  status={sub.lastPaymentAttempt?.status || sub.paymentStatus}
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">
                  Plan
                </p>
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-100">
                  <div className="flex justify-between mb-1">
                    <span className="font-bold capitalize">{sub.planName}</span>
                    <Package className="w-5 h-5 text-blue-600" />
                  </div>
                  <p className="text-sm text-gray-600 capitalize">
                    {sub.billingCycle} Billing
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">
                  Amount
                </p>
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-lg border border-green-100">
                  <div className="flex justify-between mb-1">
                    <h6 className="text-2xl font-bold">
                      ₹{formatNumberToIndian(sub.totalAmount || 0)}
                    </h6>
                    <IndianRupee className="w-5 h-5 text-green-600" />
                  </div>
                  <p className="text-sm text-gray-600">
                    {sub.userCount} × ₹{sub.pricePerUser}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Payment History */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center space-x-2 mb-6">
              <ReceiptIndianRupeeIcon className="w-5 h-5 text-purple-600" />
              <h2 className="text-xl font-semibold">Payment History</h2>
            </div>

            {paymentsLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="h-16 bg-gray-100 rounded animate-pulse"
                  ></div>
                ))}
              </div>
            ) : payments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <CreditCard className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No payment records found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">
                        Date
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">
                        Type
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">
                        Amount
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">
                        Method
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">
                        Status
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">
                        ID
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">
                        Invoice
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {payments.map((p) => (
                      <tr key={p._id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {new Date(p.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-4 py-3 text-xs capitalize text-gray-600">
                          {p.paymentFor.replace(/_/g, " ")}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          <h6>₹{formatNumberToIndian(p.amount)}</h6>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 capitalize">
                          {p.method || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <PaymentStatusBadge status={p.status} />
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-gray-500">
                          {p.razorpayPaymentId?.slice(-8) || "—"}
                        </td>
                        <td className="px-4 py-3">
                          {(p.status === "captured" ||
                            p.status === "refunded") && (
                            <button
                              onClick={() => handleDownloadInvoice(p)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-all text-xs font-medium border border-blue-200 hover:border-blue-300"
                              title="Download Invoice"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Download</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Org Info */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center space-x-2 mb-4">
              <Building className="w-5 h-5 text-indigo-600" />
              <h3 className="font-semibold">Organization</h3>
            </div>
            <p className="font-medium">{sub.organization?.name}</p>
            {sub.organization?.email && (
              <p className="text-sm text-gray-600 break-all">
                {sub.organization.email}
              </p>
            )}
          </div>

          {/* Stats */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center space-x-2 mb-4">
              <Activity className="w-5 h-5 text-green-600" />
              <h3 className="font-semibold">Quick Stats</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between p-2 bg-blue-50 rounded">
                <span className="text-sm">Users</span>
                <span className="font-bold">{sub.userCount}</span>
              </div>
              <div className="flex justify-between p-2 bg-green-50 rounded">
                <span className="text-sm">Per User</span>
                <span className="font-bold">₹{sub.pricePerUser}</span>
              </div>
              <div className="flex justify-between p-2 bg-purple-50 rounded">
                <span className="text-sm">Total</span>
                <h6 className="font-bold">
                  ₹{formatNumberToIndian(sub.totalAmount || 0)}
                </h6>
              </div>
              {daysUntilNextBilling !== null && (
                <div className="flex justify-between p-2 bg-orange-50 rounded">
                  <span className="text-sm">Next Bill</span>
                  <span className="font-bold">{daysUntilNextBilling} days</span>
                </div>
              )}
            </div>
          </div>

          {/* System IDs */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-xs">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <CreditCard className="w-4 h-4" /> System IDs
            </h3>
            {sub.razorpaySubscriptionId && (
              <div className="mb-2">
                <p className="text-gray-500">Razorpay Sub ID</p>
                <p className="font-mono bg-gray-50 p-1 rounded break-all">
                  {sub.razorpaySubscriptionId}
                </p>
              </div>
            )}
            <div>
              <p className="text-gray-500">Subscription ID</p>
              <p className="font-mono bg-gray-50 p-1 rounded break-all">
                {sub._id}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillingDetail;
