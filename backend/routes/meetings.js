// routes/meetingRoutes.js
const express = require("express");
const router = express.Router();
const meetingController = require("../controllers/meetingController");
const authMiddleware = require("../middlewares/auth");
const userSync = require("../middlewares/userSync");
const checkPermission = require("../middlewares/checkPermission");

const requireAuth = [authMiddleware, userSync];
const subscriptionGate = require('../middlewares/subscriptionGate');
const restrictByPlan = require('../middlewares/restrictByPlan');

// GET /meetings - Get all meetings (staff: their own or where they are participants)
router.get(
  "/",
  requireAuth,
  subscriptionGate,
  restrictByPlan("meetings", "read"),
  checkPermission("meetings", "readonly"),
  meetingController.getMeetings
);

router.get(
  "/dashboard",
  requireAuth,
  subscriptionGate,
  restrictByPlan("meetings", "read"),
  checkPermission("meetings", "readonly"),
  meetingController.getMeetingsDashboard
);

// GET /meetings/all-meetings - Admin: get all meetings
router.get(
  "/all-meetings",
  requireAuth,
  subscriptionGate,
  restrictByPlan("meetings", "read"),
  checkPermission("meetings", "readonly"),
  meetingController.getAllMeetings
);

// GET /meetings/upcoming - Upcoming meetings
router.get(
  "/upcoming",
  requireAuth,
  subscriptionGate,
  restrictByPlan("meetings", "read"),
  checkPermission("meetings", "readonly"),
  meetingController.getUpcomingMeetings
);

// POST /meetings - Create a new meeting
router.post(
  "/",
  requireAuth,
  subscriptionGate,
  restrictByPlan("meetings", "write"),
  // checkPermission("meetings", "read-write"),
  meetingController.createMeeting
);

// GET /meetings/pagination - Paginated meetings
router.get(
  "/pagination",
  requireAuth,
  subscriptionGate,
  restrictByPlan("meetings", "read"),
  checkPermission("meetings", "readonly"),
  meetingController.getMeetingsPaginated
);

// GET /meetings/:id - Get meeting by ID
router.get(
  "/:id",
  requireAuth,
  subscriptionGate,
  restrictByPlan("meetings", "read"),
  checkPermission("meetings", "readonly"),
  meetingController.getMeetingById
);

// PUT /meetings/:id - Update meeting
router.put(
  "/:id",
  requireAuth,
  subscriptionGate,
  restrictByPlan("meetings", "write"),
  checkPermission("meetings", "read-write"),
  meetingController.updateMeeting
);

// DELETE /meetings/:id - Delete meeting
router.delete(
  "/:id",
  requireAuth,
  subscriptionGate,
  restrictByPlan("meetings", "write"),
  checkPermission("meetings", "read-write"),
  meetingController.deleteMeeting
);

// PATCH /meetings/:id/complete - Mark meeting as completed
router.patch(
  "/:id/complete",
  requireAuth,
  subscriptionGate,
  restrictByPlan("meetings", "write"),
  checkPermission("meetings", "read-write"),
  meetingController.completeMeeting
);

// GET /meetings/participant/:participantId - Meetings by participant
router.get(
  "/participant/:participantId",
  requireAuth,
  subscriptionGate,
  restrictByPlan("meetings", "read"),
  checkPermission("meetings", "readonly"),
  meetingController.getMeetingsByParticipant
);

// POST /meetings/send-reminders - Send meeting reminders
router.post(
  "/send-reminders",
  requireAuth,
  subscriptionGate,
  restrictByPlan("meetings", "write"),
  checkPermission("meetings", "read-write"),
  meetingController.sendMeetingReminders
);

// router.post(
//   "/generate-link",
//   requireAuth,
//   meetingController.generateMeetingLink,
// );

module.exports = router;
