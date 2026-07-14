import { useEffect, useState } from "react";
import API, { configureAxios } from "../services/api";
import { useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { useSubscription } from "../contexts/SubscriptionContext";
import useRazorpay from "../hooks/useRazorpay";
import { waitForSettlement } from "../utils/waitForSettlement";
import toast, { Toaster } from "react-hot-toast";
import {
  Users,
  UserPlus,
  Mail,
  Shield,
  Trash2,
  Edit,
  Copy,
  RefreshCw,
  X,
  CheckCircle2,
  AlertCircle,
  Key,
  Settings,
  Eye,
  EyeOff,
  Crown,
  Loader2,
} from "lucide-react";

function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  type = "default",
}) {
  if (!isOpen) return null;

  const getTypeStyles = () => {
    switch (type) {
      case "danger":
        return {
          icon: <AlertCircle className="w-6 h-6 text-red-600" />,
          buttonClass: "bg-red-600 hover:bg-red-700",
          iconBg: "bg-red-100",
        };
      case "warning":
        return {
          icon: <AlertCircle className="w-6 h-6 text-yellow-600" />,
          buttonClass: "bg-yellow-600 hover:bg-yellow-700",
          iconBg: "bg-yellow-100",
        };
      default:
        return {
          icon: <CheckCircle2 className="w-6 h-6 text-blue-600" />,
          buttonClass: "bg-blue-600 hover:bg-blue-700",
          iconBg: "bg-blue-100",
        };
    }
  };

  const styles = getTypeStyles();

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border-2 border-gray-200 animate-fade-in">
        <div className="flex items-start gap-4 mb-4">
          <div className={`p-3 rounded-xl ${styles.iconBg}`}>{styles.icon}</div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
            <p className="text-gray-600 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-semibold"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-5 py-2.5 text-white rounded-xl transition-colors font-semibold shadow-lg ${styles.buttonClass}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

function UserManagement() {
  const { getAccessTokenSilently, user: auth0User } = useAuth0();
  const [formVisible, setFormVisible] = useState(false);
  const [form, setForm] = useState({ email: "", permissions: {} });
  const [users, setUsers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [selectedUser, setSelectedUser] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [orgCode, setOrgCode] = useState("");
  const { subscription, seatStatus, fetchSeatStatus } = useSubscription();
  const { razorpayLoaded, openCheckout } = useRazorpay();
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
    confirmText: "Confirm",
    cancelText: "Cancel",
    type: "default",
  });

  const permissionOptions = ["no", "readonly", "read-write"];
  const resources = [
    "Companies",
    "Deals",
    "Contacts",
    "Tasks",
    "Invoices",
    "Vendors",
    "purchases",
    "purchase-orders",
    "Items",
    "Meetings",
    "Emails",
    "Quotations",
    "Delivery-Challans",
    "Forms",
  ];

  const getInitialPermissions = (user) => {
    const perms = {};
    resources.forEach((res) => {
      const found = user.permissions?.find(
        (p) => p.name.toLowerCase() === res.toLowerCase()
      );
      perms[res] = found?.permission || "no";
    });
    return perms;
  };

  const savePermissions = async () => {
    const formattedPermissions = Object.entries(permissions)
      .filter(([_, perm]) => perm !== "no")
      .map(([name, permission]) => ({ name, permission }));

    try {
      await API.put(`/auth/permissions/${selectedUser._id}`, {
        permissions: formattedPermissions,
      });
      setShowModal(false);
      toast.success("Permissions updated successfully");
      fetchUsers();
    } catch (err) {
      if (err.response?.status === 402) {
        toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        toast.error(err.response?.data?.error || "Failed to update permissions");
      }
      console.error(err);
    }
  };

  useEffect(() => {
    configureAxios(getAccessTokenSilently);
    if (auth0User) {
      const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
      if (storedUser.role !== "admin") {
        navigate("/login");
      } else {
        fetchOrgCode();
        fetchUsers();
      }
    }
  }, [navigate, auth0User, getAccessTokenSilently]);

  const resetOrgCode = async () => {
    setConfirmModal({
      isOpen: true,
      title: "Reset Organization Code",
      message:
        "This will invalidate the current code. All existing users will remain, but new invitations will require the new code.",
      type: "warning",
      onConfirm: async () => {
        try {
          const user = JSON.parse(localStorage.getItem("user") || "{}");
          if (!user.organization) return;
          const res = await API.post(
            `/organisation/${user.organization}/reset-code`
          );
          setOrgCode(res.data.code);
          toast.success("Secret code has been reset!");
        } catch (err) {
          if (err.response?.status === 402) {
            toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
          } else {
            toast.error(err.response?.data?.error || "Failed to reset code");
          }
          console.error(err);
        }
        setConfirmModal({ isOpen: false });
      },
      confirmText: "Reset Code",
      cancelText: "Cancel",
    });
  };

  const fetchOrgCode = async () => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      if (!user.organization) return;
      const res = await API.get(`/organisation/${user.organization}`);
      setOrgCode(res.data.code);
    } catch (err) {
      console.error("Failed to fetch organization code", err);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const [usersRes, invitesRes] = await Promise.all([
        API.get("/auth/all-user-admin"),
        API.get("/auth/invites"),
      ]);
      setUsers(usersRes.data.allUsers);
      setInvites(invitesRes.data.invites);
    } catch (err) {
      toast.error("Failed to fetch users or invites");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    try {
      const formattedPermissions = Object.entries(form.permissions)
        .filter(([_, perm]) => perm !== "no")
        .map(([name, permission]) => ({ name, permission }));

      const response = await API.post("/auth/invite", {
        email: form.email,
        permissions: formattedPermissions,
      });

      setForm({ email: "", permissions: {} });
      fetchUsers();
      setFormVisible(false);
      toast.success(response.data.message || "User invited successfully");
    } catch (err) {
      if (err.response?.status === 402) {
        const { paymentDetails, message } = err.response.data;
        setConfirmModal({
          isOpen: true,
          title: "Additional Seat Required",
          message: `${message} Proceed with payment?`,
          type: "default",
          onConfirm: () =>
            handleSeatPayment(paymentDetails, form.email, form.permissions),
          confirmText: "Proceed to Payment",
          cancelText: "Cancel",
        });
      } else {
        console.log(err)
        toast.error(err.response?.data?.message || "Failed to send invite");
      }
      console.error(err);
    }
  };

  const handleSeatPayment = (paymentDetails, email, permissions) => {
    if (!razorpayLoaded) {
      toast.error("Payment system not loaded. Please try again.");
      setConfirmModal({ isOpen: false });
      return;
    }

    setPaymentProcessing(true);
    setConfirmModal({ isOpen: false });

    const checkoutOptions = {
      ...paymentDetails,
      handler: async function () {
        toast.success("Payment received! Sending invitation...");
        // The webhook settles the seat purchase and finalizes the invite
        // (sends the email, clears pendingPayment) — wait until it's done.
        try {
          const result = await waitForSettlement({
            fetchLatest: async () => (await API.get("/auth/invites")).data.invites,
            isSettled: (invites) =>
              !!invites && !invites.some((inv) => inv.email === email && inv.pendingPayment),
            intervalMs: 3000,
            timeoutMs: 30000,
          });
          if (result.settled) {
            toast.success("Invitation sent!");
            setForm({ email: "", permissions: {} });
            setFormVisible(false);
          } else {
            toast("Payment confirmed. Invitation will be sent shortly — refresh if it doesn't appear.", { icon: "⏳" });
          }
          fetchUsers();
          fetchSeatStatus(); // seat count just changed — refresh the shared context copy
        } finally {
          setPaymentProcessing(false);
        }
      },
      modal: {
        ondismiss: function () {
          setPaymentProcessing(false);
          toast.error("Payment cancelled. Invitation not sent.");
        },
      },
    };

    openCheckout(checkoutOptions);
  };

  const deleteUser = async (id) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete User",
      message:
        "Are you sure you want to delete this user? This action cannot be undone.",
      type: "danger",
      onConfirm: async () => {
        try {
          await API.delete(`/auth/delete/${id}`);
          toast.success("User deleted successfully");
          fetchUsers();
        } catch (err) {
          if (err.response?.status === 402) {
            toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
          } else {
            toast.error(err.response?.data?.error || "Failed to delete user");
          }
          console.error(err);
        }
        setConfirmModal({ isOpen: false });
      },
      confirmText: "Delete",
      cancelText: "Cancel",
    });
  };

  const revokeInvite = async (id) => {
    setConfirmModal({
      isOpen: true,
      title: "Revoke Invitation",
      message: "Are you sure you want to revoke this invitation?",
      type: "warning",
      onConfirm: async () => {
        try {
          await API.delete(`/auth/invites/${id}`);
          toast.success("Invitation revoked successfully");
          fetchUsers();
        } catch (err) {
          if (err.response?.status === 402) {
            toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
          } else {
            toast.error(err.response?.data?.error || "Failed to revoke invite");
          }
          console.error(err);
        }
        setConfirmModal({ isOpen: false });
      },
      confirmText: "Revoke",
      cancelText: "Cancel",
    });
  };

  const renderSeatInfo = () => {
    if (!subscription?.subscription) return null;

    // Prefer seatStatus (includes extra_seat add-ons) over subscription.userCount
    const userCount = seatStatus?.totalSeats ?? subscription.subscription.userCount;
    const seatsUsed = seatStatus?.occupiedSeats ?? (users.length + invites.length);
    const isAtLimit = seatsUsed >= userCount;
    const percentage = Math.min(100, (seatsUsed / userCount) * 100);

    return (
      <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-300 rounded-2xl p-6 mb-8 shadow-lg">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-start gap-4">
            <div className="bg-blue-600 p-3 rounded-xl shadow-md">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-blue-900 mb-1">
                Seat Usage
              </h3>
              <p className="text-blue-700 text-sm">
                {seatsUsed} of {userCount} seats used
                {isAtLimit && (
                  <span className="text-red-600 font-semibold ml-2">
                    (At limit - payment required)
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-blue-700">
              {seatsUsed}/{userCount}
            </div>
            <p className="text-xs text-blue-600 mt-1">
              {userCount - seatsUsed} available
            </p>
          </div>
        </div>
        <div className="mt-4 bg-blue-200 rounded-full h-3 overflow-hidden shadow-inner">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${
              percentage >= 90 ? "bg-red-500" : "bg-blue-600"
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  };

  const handleInvitePresetChange = (e) => {
    const value = e.target.value;
    let newPerms = {};
    if (value === "view-only") {
      resources.forEach((res) => (newPerms[res] = "readonly"));
    } else if (value === "full-access") {
      resources.forEach((res) => (newPerms[res] = "read-write"));
    }
    setForm({ ...form, permissions: newPerms });
  };

  const handleModalPresetChange = (e) => {
    const value = e.target.value;
    let newPerms = {};
    if (value === "view-only") {
      resources.forEach((res) => (newPerms[res] = "readonly"));
    } else if (value === "full-access") {
      resources.forEach((res) => (newPerms[res] = "read-write"));
    }
    setPermissions(newPerms);
  };

  const getPermissionBadge = (permission) => {
    switch (permission) {
      case "read-write":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-md text-xs font-semibold">
            <Edit className="w-3 h-3" />
            Edit
          </span>
        );
      case "readonly":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md text-xs font-semibold">
            <Eye className="w-3 h-3" />
            View
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md text-xs font-semibold">
            <EyeOff className="w-3 h-3" />
            None
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <Toaster position="top-right" toastOptions={{ duration: 5000 }} />
      {/* Seat Info */}
      {renderSeatInfo()}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-3xl font-bold text-gray-900"></h2>
            <p className="text-sm text-gray-600 mt-1"></p>
          </div>
        </div>
        {seatStatus && (
          <div className={`text-xs px-3 py-1.5 rounded-lg font-medium ${
            seatStatus.occupiedSeats >= seatStatus.totalSeats
              ? "bg-red-50 text-red-700"
              : "bg-gray-100 text-gray-600"
          }`}>
            {seatStatus.occupiedSeats} / {seatStatus.totalSeats} seats used
          </div>
        )}
        <button
          onClick={() => setFormVisible(!formVisible)}
          disabled={
            paymentProcessing
            // ||
            // (subscription?.subscription &&
            //   users.length + invites.length >=
            //     subscription.subscription.userCount)
          }
          className={`flex items-center gap-2 font-semibold px-6 py-3 rounded-xl cursor-pointer border-2 transition-all shadow-md ${
            formVisible
              ? "bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200"
              : "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white border-blue-600 shadow-lg"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {paymentProcessing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Processing...
            </>
          ) : formVisible ? (
            <>
              <X className="w-5 h-5" />
              Cancel
            </>
          ) : (
            <>
              <UserPlus className="w-5 h-5" />
              Invite User
            </>
          )}
        </button>
      </div>

      {/* Invite Form */}
      {formVisible && (
        <div className="bg-white border-2 border-gray-200 rounded-2xl p-8 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-purple-100 p-2.5 rounded-xl">
              <UserPlus className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">Invite New User</h3>
          </div>

          <form onSubmit={handleInvite} className="space-y-6">
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <Mail className="w-4 h-4" />
                Email Address
              </label>
              <input
                className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                type="email"
                placeholder="colleague@company.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                <Shield className="w-4 h-4" />
                Permissions
              </label>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-600 mb-2">
                  Quick Preset
                </label>
                <select
                  onChange={handleInvitePresetChange}
                  className="w-full border-2 border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Custom (Manual Selection)</option>
                  <option value="view-only">
                    👁️ View Only - Read-only access
                  </option>
                  <option value="full-access">
                    🔓 Full Access - Edit everything
                  </option>
                </select>
              </div>

              <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                <div className="grid md:grid-cols-2 gap-4">
                  {resources.map((resource) => (
                    <div
                      key={resource}
                      className="flex justify-between items-center bg-white p-3 rounded-lg border border-gray-200"
                    >
                      <span className="font-medium text-gray-700">
                        {resource}
                      </span>
                      <select
                        value={form.permissions[resource] || "no"}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            permissions: {
                              ...form.permissions,
                              [resource]: e.target.value,
                            },
                          })
                        }
                        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        {permissionOptions.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt === "no"
                              ? "None"
                              : opt === "readonly"
                              ? "View"
                              : "Edit"}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => setFormVisible(false)}
                className="px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={paymentProcessing}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-xl transition-all disabled:opacity-50 shadow-lg"
              >
                <Mail className="w-4 h-4" />
                Send Invite
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Organization Code */}
      <div className="bg-white border-2 border-gray-200 rounded-2xl p-6 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-amber-100 p-2.5 rounded-xl">
            <Key className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              Organization Code
            </h3>
            <p className="text-sm text-gray-600">
              Share this code with team members to join
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex-1 bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3">
            <span className="font-mono text-xl font-bold text-gray-900">
              {orgCode || "Loading..."}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                navigator.clipboard.writeText(orgCode);
                toast.success("Code copied to clipboard!");
              }}
              disabled={!orgCode}
              className="flex items-center gap-2 px-4 py-3 bg-blue-100 text-blue-700 rounded-xl hover:bg-blue-200 font-semibold disabled:opacity-50 transition-colors"
            >
              <Copy className="w-4 h-4" />
              Copy
            </button>
            <button
              onClick={resetOrgCode}
              className="flex items-center gap-2 px-4 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 font-semibold transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Existing Users */}
      <div className="bg-white border-2 border-gray-200 rounded-2xl shadow-lg overflow-hidden">
        <div className="px-6 py-5 border-b-2 border-gray-100 bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="bg-green-100 p-2 rounded-lg">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Active Users</h3>
            <span className="ml-auto bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-bold">
              {users.length}
            </span>
          </div>
        </div>
        {loading ? (
          <div className="px-6 py-12 text-center">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
            <p className="text-gray-500">Loading users...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500">
            No users found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u) => {
                  const storedUser = JSON.parse(
                    localStorage.getItem("user") || "{}"
                  );
                  const isSelf = u._id === storedUser._id;
                  return (
                    <tr
                      key={u._id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">
                              {u.name}
                              {isSelf && (
                                <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-600">
                              {u.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold ${
                            u.role === "admin"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {u.role === "admin" && <Crown className="w-3 h-3" />}
                          {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setSelectedUser(u);
                              setPermissions(getInitialPermissions(u));
                              setShowModal(true);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-sm font-semibold transition-colors"
                          >
                            <Shield className="w-4 h-4" />
                            Permissions
                          </button>
                          <button
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={isSelf}
                            onClick={() => !isSelf && deleteUser(u._id)}
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pending Invitations */}
      <div className="bg-white border-2 border-gray-200 rounded-2xl shadow-lg overflow-hidden">
        <div className="px-6 py-5 border-b-2 border-gray-100 bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="bg-yellow-100 p-2 rounded-lg">
              <Mail className="w-5 h-5 text-yellow-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">
              Pending Invitations
            </h3>
            <span className="ml-auto bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-sm font-bold">
              {invites.length}
            </span>
          </div>
        </div>
        {loading ? (
          <div className="px-6 py-12 text-center">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
            <p className="text-gray-500">Loading invites...</p>
          </div>
        ) : invites.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500">
            No pending invites.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invites.map((invite) => (
                  <tr
                    key={invite._id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                          <Mail className="w-5 h-5 text-gray-500" />
                        </div>
                        <span className="font-medium text-gray-700">
                          {invite.email}
                        </span>
                        {invite.pendingPayment && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-md text-xs font-semibold">
                            <Loader2 className="w-3 h-3" />
                            Awaiting seat payment
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm font-semibold transition-colors"
                        onClick={() => revokeInvite(invite._id)}
                      >
                        <X className="w-4 h-4" />
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Permissions Modal */}
      {showModal && selectedUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-[100009] p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border-2 border-gray-200 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b-2 border-gray-100 px-6 py-5 z-10">
              <div className="flex items-center gap-3">
                <div className="bg-purple-100 p-2.5 rounded-xl">
                  <Shield className="w-6 h-6 text-purple-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900">
                    Manage Permissions
                  </h3>
                  <p className="text-sm text-gray-600">
                    for {selectedUser.name}
                  </p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Quick Preset
                </label>
                <select
                  onChange={handleModalPresetChange}
                  className="w-full border-2 border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Custom (Manual Selection)</option>
                  <option value="view-only">
                    👁️ View Only - Read-only access
                  </option>
                  <option value="full-access">
                    🔓 Full Access - Edit everything
                  </option>
                </select>
              </div>

              <div className="space-y-3">
                {resources.map((resource) => (
                  <div
                    key={resource}
                    className="flex justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-200"
                  >
                    <span className="font-semibold text-gray-700">
                      {resource}
                    </span>
                    <select
                      value={permissions[resource] || "no"}
                      onChange={(e) =>
                        setPermissions((prev) => ({
                          ...prev,
                          [resource]: e.target.value,
                        }))
                      }
                      className="border-2 border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium"
                    >
                      {permissionOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt === "no"
                            ? "None"
                            : opt === "readonly"
                            ? "View Only"
                            : "Edit Access"}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t-2 border-gray-100 px-6 py-5 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={savePermissions}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl transition-all font-semibold shadow-lg"
              >
                <CheckCircle2 className="w-4 h-4" />
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        cancelText={confirmModal.cancelText}
        type={confirmModal.type}
      />
    </div>
  );
}

export default UserManagement;
