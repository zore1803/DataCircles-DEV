const express = require("express");
const router = express.Router();
const taskController = require("../controllers/taskController");
const authMiddleware = require("../middlewares/auth");
const adminMiddleware = require("../middlewares/admin");
const userSync = require("../middlewares/userSync");
const checkPermission = require("../middlewares/checkPermission");

const requireAuth = [authMiddleware, userSync];
const subscriptionGate = require('../middlewares/subscriptionGate');
const restrictByPlan = require('../middlewares/restrictByPlan');
const { getDashboardTasks } = require("../controllers/taskController");

router.get(
  "/dashboard-tasks",
  requireAuth,
  subscriptionGate,
  restrictByPlan("tasks", "read"),
  checkPermission("tasks", "readonly"),
  getDashboardTasks
);

// Create task
router.post(
  "/",
  requireAuth,
  subscriptionGate,
  restrictByPlan("tasks", "write"),
  checkPermission("tasks", "read-write"),
  taskController.createTask
);

// Get all tasks (admin only)
router.get(
  "/admin",
  requireAuth,
  subscriptionGate,
  restrictByPlan("tasks", "read"),
  adminMiddleware,
  checkPermission("tasks", "readonly"),
  taskController.getAllTask
);

// Get my tasks
router.get(
  "/",
  requireAuth,
  subscriptionGate,
  restrictByPlan("tasks", "read"),
  checkPermission("tasks", "readonly"),
  taskController.getMyTask
);

// Get all tasks with pagination
router.get(
  "/pagination",
  requireAuth,
  subscriptionGate,
  restrictByPlan("tasks", "read"),
  checkPermission("tasks", "readonly"),
  taskController.getAllTasksPaginated
);

// Update task
router.put(
  "/:id",
  requireAuth,
  subscriptionGate,
  restrictByPlan("tasks", "write"),
  checkPermission("tasks", "read-write"),
  taskController.updateTask
);

// Update task status
router.put(
  "/:id/status",
  requireAuth,
  subscriptionGate,
  restrictByPlan("tasks", "write"),
  checkPermission("tasks", "read-write"),
  taskController.updateTaskStatus
);

// Delete task
router.delete(
  "/:id",
  requireAuth,
  subscriptionGate,
  restrictByPlan("tasks", "write"),
  checkPermission("tasks", "read-write"),
  taskController.deleteTask
);

// Get tasks by related entities
router.get(
  "/vendor/:id",
  requireAuth,
  subscriptionGate,
  restrictByPlan("tasks", "read"),
  checkPermission("tasks", "readonly"),
  taskController.getTasksByVendor
);

router.get(
  "/contact/:id",
  requireAuth,
  subscriptionGate,
  restrictByPlan("tasks", "read"),
  checkPermission("tasks", "readonly"),
  taskController.getTasksByContact
);

router.get(
  "/company/:id",
  requireAuth,
  subscriptionGate,
  restrictByPlan("tasks", "read"),
  checkPermission("tasks", "readonly"),
  taskController.getTasksByCompany
);

router.get(
  "/deal/:id",
  requireAuth,
  subscriptionGate,
  restrictByPlan("tasks", "read"),
  checkPermission("tasks", "readonly"),
  taskController.getTasksByDeal
);

module.exports = router;
