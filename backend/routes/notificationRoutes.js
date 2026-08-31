const express = require("express");
const router = express.Router();
const {
  getMySettings,
  updateMySettings,
  getUserSettings,
  updateUserSettings,
  getFeed,
  getUnreadCount,
  markRead,
  markAllRead,
  clearAll
} = require("../controllers/notificationController");

const sessionAuth = require("../middlewares/sessionAuth");
const csrfCheck = require("../middlewares/csrfCheck");
const adminMiddleware = require("../middlewares/admin");

const requireAuth = [sessionAuth, csrfCheck];
const subscriptionGate = require('../middlewares/subscriptionGate');

// Activity feed (auto-generated create/update/delete notifications).
// Declared before the "/" settings routes so the specific paths match first.
router.get("/feed", requireAuth, getFeed);
router.get("/feed/unread-count", requireAuth, getUnreadCount);
router.put("/feed/read-all", requireAuth, markAllRead);
router.delete("/feed", requireAuth, clearAll);
router.put("/feed/:id/read", requireAuth, markRead);

// Current logged-in user (scoped to their organization)
router.get("/", requireAuth, subscriptionGate, getMySettings);
router.put("/", requireAuth, subscriptionGate, updateMySettings);

// Admin routes (manage users within organization)
router.get("/organization/:orgId/user/:userId", requireAuth, subscriptionGate, adminMiddleware, getUserSettings);
router.put("/organization/:orgId/user/:userId", requireAuth, subscriptionGate, adminMiddleware, updateUserSettings);

module.exports = router;
