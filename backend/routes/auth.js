const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth");
const userSyncMiddleware = require("../middlewares/userSync");
const adminMiddleware = require("../middlewares/admin");
const uploadMiddlewareS3 = require("../middlewares/uploadMiddlewareS3");
const authController = require("../controllers/authController");
const {
  globalOtpLimiter,
  sendOtpLimiter,
  verifyOtpLimiter,
  phoneOtpLimiter,
} = require("../utils/RateLimiter");

const requireAuth = [authMiddleware, userSyncMiddleware];

// Get current user
router.get("/me", requireAuth, authController.getCurrentUser);

// Delete user
router.delete(
  "/delete/:id",
  requireAuth,
  adminMiddleware,
  authController.deleteUser,
);

// Get all users
router.get("/all-user", requireAuth, authController.getAllUsers);

// Get all users
router.get(
  "/all-user-admin",
  requireAuth,
  adminMiddleware,
  authController.getAllUsersAdmin,
);

// Update profile
router.post(
  "/profile",
  requireAuth,
  uploadMiddlewareS3().single("profile"),
  authController.updateProfile,
);

// Get profile
router.get("/profile", requireAuth, authController.getProfile);

// Update permissions
router.put(
  "/permissions/:id",
  requireAuth,
  adminMiddleware,
  authController.updatePermissions,
);

// Invite user
router.post("/invite", requireAuth, adminMiddleware, authController.inviteUser);

// Get invites
router.get("/invites", requireAuth, adminMiddleware, authController.getInvites);

// Delete invite
router.delete(
  "/invites/:id",
  requireAuth,
  adminMiddleware,
  authController.deleteInvite,
);

// Send OTP
router.post(
  "/send-otp",
  globalOtpLimiter,
  sendOtpLimiter,
  phoneOtpLimiter,
  authController.sendOtp,
);

// Verify OTP
router.post(
  "/verify-otp",
  globalOtpLimiter,
  verifyOtpLimiter,
  authController.verifyOtp,
);

// Send Email OTP (for email verification)
router.post(
  "/send-email-otp",
  globalOtpLimiter,
  sendOtpLimiter,
  authController.sendEmailOtp,
);

// Verify Email OTP
router.post(
  "/verify-email-otp",
  globalOtpLimiter,
  verifyOtpLimiter,
  authController.verifyEmailOtp,
);

// Complete registration
router.post("/complete-registration", authMiddleware, authController.completeRegistration);

// Password Reset Routes
router.post(
  "/forgot-password",
  globalOtpLimiter,
  sendOtpLimiter,
  authController.forgotPassword,
);

router.post(
  "/reset-password",
  globalOtpLimiter,
  verifyOtpLimiter,
  authController.resetPassword,
);

// Setup Workspace
router.post(
  "/setup-workspace",
  requireAuth,
  uploadMiddlewareS3().single("workspaceImage"),
  authController.setupWorkspace,
);

module.exports = router;
