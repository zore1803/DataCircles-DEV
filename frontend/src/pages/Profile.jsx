import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import API, { configureAxios } from "../services/api";
import { useAuth0 } from "@auth0/auth0-react";
import { User, Mail, Camera, Upload, LogOut, X, Monitor, ShieldCheck, Trash2 } from "lucide-react";
import logo from "/DataCircles.png";
import toast from "react-hot-toast";
import AppToaster from "../components/AppToaster";

const Profile = () => {
  const { user: auth0User, getAccessTokenSilently, logout } = useAuth0();
  const [user, setUser] = useState(null);
  const [profileImage, setProfileImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [profileBase64, setProfileBase64] = useState(null);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sessions, setSessions] = useState(null);
  const [sessionsError, setSessionsError] = useState("");
  const [revokingId, setRevokingId] = useState(null);
  // null during this component's very first render (before anything is
  // committed to the real DOM), then re-checked once after mount — a direct
  // load of /settings/profile mounts the Settings header strip and this
  // component in the same commit, so checking document.getElementById
  // synchronously during render can miss a target that exists a moment
  // later.
  const [headerTarget, setHeaderTarget] = useState(null);
  useEffect(() => {
    setHeaderTarget(document.getElementById('settings-header-actions'));
  }, []);
  const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:5001";

  useEffect(() => {
    configureAxios(getAccessTokenSilently);
    const fetchUser = async () => {
      try {
        const res = await API.get("/auth/me");
        setUser(res.data?.user);
      } catch (err) {
        console.error("Failed to fetch user", err);
      }
    };
    fetchUser();
    fetchSessions();
  }, [getAccessTokenSilently]);

  const fetchSessions = async () => {
    try {
      const res = await API.get("/session");
      setSessions(res.data.sessions);
      setSessionsError("");
    } catch {
      // Non-fatal — no application route enforces sessionAuth yet, so a
      // user who hasn't gone through /session/establish simply has no
      // dc_session cookie and this 401s. Show a quiet, non-alarming state.
      setSessions([]);
      setSessionsError("");
    }
  };

  const handleRevokeSession = async (id) => {
    setRevokingId(id);
    try {
      await API.delete(`/session/${id}`);
      await fetchSessions();
    } catch {
      setSessionsError("Failed to sign out that session. Please try again.");
    } finally {
      setRevokingId(null);
    }
  };

  const handleLogout = async () => {
    // Revoke the DataCircles application session server-side before
    // clearing any client-side state — see backend/controllers/
    // sessionController.js logout.
    try {
      await API.post("/session/logout");
    } catch (err) {
      console.error("Failed to revoke DataCircles session:", err);
    }
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    // Clear browser history to prevent back button access
    window.history.replaceState(null, "", window.location.href);
    logout({ logoutParams: { returnTo: window.location.origin } });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfileImage(file);
      // Create preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
        setProfileBase64(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageUpload = async () => {
    if (!profileImage) return;
    setUploading(true);
    const formData = new FormData();
    // Include base64 if available so backend can store data URL directly
    if (profileBase64) {
      formData.append("profileBase64", profileBase64);
    }
    // Also append raw file as fallback
    formData.append("profile", profileImage);
    try {
      await API.post("/auth/profile", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Profile image updated successfully!");
      window.location.reload();
    } catch (err) {
      console.error(err);
      toast.error("Failed to upload image. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const clearImageSelection = () => {
    setProfileImage(null);
    setImagePreview(null);
    setProfileBase64(null);
  };

  const handleRemovePhoto = async () => {
    if (!window.confirm("Are you sure you want to remove your profile photo?")) return;
    try {
      setUploading(true);
      await API.delete("/auth/profile");
      toast.success("Profile photo removed successfully!");
      window.location.reload();
    } catch (err) {
      console.error(err);
      toast.error("Failed to remove photo. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  if (!user) {
    return (
      <PageSkeleton variant="generic" />
    );
  }

  return (
    <div>
      <AppToaster />

      {/* Lives in the shared Settings header strip (see Settings.jsx's
          #settings-header-actions target) when embedded there — the strip
          already shows "Profile" as the title. Falls back to an inline row
          when rendered standalone (e.g. the bare /profile route), where that
          target doesn't exist, so Logout is never stranded with no way to
          reach it. headerTarget is re-checked after mount (settingsHeaderTick)
          since the target may not exist yet during this component's very
          first render (e.g. a hard refresh straight into /settings/profile,
          where the strip and this component mount in the same commit). */}
      {headerTarget ? (
        createPortal(
          <button
            onClick={() => setIsLogoutModalOpen(true)}
            className="flex items-center gap-2 px-4 h-[38px] text-sm font-medium text-red-600 hover:bg-red-50 rounded-full transition-colors whitespace-nowrap"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>,
          headerTarget
        )
      ) : (
        <div className="flex justify-end mb-6">
          <button
            onClick={() => setIsLogoutModalOpen(true)}
            className="flex items-center gap-2 px-4 h-[38px] text-sm font-medium text-red-600 hover:bg-red-50 rounded-full transition-colors whitespace-nowrap"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      )}

      {/* Profile Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Profile Header with Avatar */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 h-32 relative">
          <div className="absolute -bottom-16 left-8">
            <div className="relative group">
              <div className="w-32 h-32 rounded-full border-4 border-white bg-white shadow-lg overflow-hidden">
                {user.profileUrl || imagePreview ? (
                  <img
                    src={imagePreview || user.profileUrl}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                    <User className="w-16 h-16 text-gray-400" />
                  </div>
                )}
              </div>
              <label
                htmlFor="profile-upload"
                className="absolute bottom-2 right-2 bg-white rounded-full p-2 shadow-lg cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <Camera className="w-4 h-4 text-gray-600" />
                <input
                  id="profile-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </label>
              {user.profileUrl && !imagePreview && (
                <button
                  onClick={handleRemovePhoto}
                  disabled={uploading}
                  className="absolute bottom-2 left-2 bg-white rounded-full p-2 shadow-lg cursor-pointer hover:bg-red-50 transition-colors"
                  title="Remove Photo"
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Profile Content */}
        <div className="pt-20 px-8 pb-8">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">
              {user.name}
            </h2>
            <p className="text-gray-500 text-sm">
              {user.email || user.profileEmail}
            </p>
          </div>

          {/* Profile Information Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <User className="w-4 h-4 text-gray-500" />
                Full Name
              </label>
              <input
                type="text"
                value={user.name}
                readOnly
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <Mail className="w-4 h-4 text-gray-500" />
                Email Address
              </label>
              <input
                type="email"
                value={user.email || user.profileEmail}
                readOnly
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Image Upload Section */}
          {imagePreview && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg overflow-hidden border-2 border-blue-300">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      New profile image selected
                    </p>
                    <p className="text-xs text-gray-500">
                      {profileImage?.name}
                    </p>
                  </div>
                </div>
                <button
                  onClick={clearImageSelection}
                  className="p-1 hover:bg-blue-100 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-gray-600" />
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleImageUpload}
                  disabled={uploading}
                  className="flex items-center gap-2 px-4 h-[38px] bg-[#0085FF] text-white text-sm font-semibold rounded-full hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Upload Image
                    </>
                  )}
                </button>
                <button
                  onClick={clearImageSelection}
                  className="px-4 h-[38px] bg-gray-200 text-gray-700 text-sm font-semibold rounded-full hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Active Sessions */}
      {sessions && sessions.length > 0 && (
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-4 h-4 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-900">Active Sessions</h3>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            You can be signed in on up to 2 devices at once. Sign out of a
            session below to free up a slot for a new one.
          </p>
          {sessionsError && (
            <p className="text-xs text-red-600 mb-3">{sessionsError}</p>
          )}
          <div className="space-y-2">
            {sessions.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Monitor className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {s.deviceLabel || "Unknown device"}
                      {s.current && (
                        <span className="ml-2 text-xs font-semibold text-green-600">
                          This device
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">
                      Last active {new Date(s.lastActiveAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                {!s.current && (
                  <button
                    onClick={() => handleRevokeSession(s.id)}
                    disabled={revokingId === s.id}
                    className="px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {revokingId === s.id ? "Signing out..." : "Sign out"}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10000] flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white max-w-md w-full rounded-2xl shadow-2xl overflow-hidden animate-slideUp">
            <div className="p-6">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <LogOut className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
                Logout Confirmation
              </h3>
              <p className="text-sm text-gray-600 text-center mb-6">
                Are you sure you want to logout? You'll need to sign in again to
                access your account.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsLogoutModalOpen(false)}
                  className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLogout}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors"
                >
                  Yes, Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add animations to your global CSS or Tailwind config */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default Profile;
import PageSkeleton from "../components/common/PageSkeleton";
