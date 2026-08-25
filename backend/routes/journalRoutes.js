// routes/journalRoutes.js
const express = require("express");
const router = express.Router();
const journalController = require("../controllers/journalController");
const authMiddleware = require("../middlewares/auth");
const userSync = require("../middlewares/userSync");
const subscriptionGate = require("../middlewares/subscriptionGate");

const requireAuth = [authMiddleware, userSync];

// No restrictByPlan gate yet — Journals has no PlanConfig module entry on
// any existing plan, and adding one is a separate product/billing decision
// outside this first basic implementation (would 403 every request until
// then). Only auth + subscription-validity are enforced for now.
router.post("/", requireAuth, subscriptionGate, journalController.createJournal);
router.get("/", requireAuth, subscriptionGate, journalController.getJournals);
router.get("/:id", requireAuth, subscriptionGate, journalController.getJournalById);
router.get("/:id/ledger", requireAuth, subscriptionGate, journalController.getJournalLedger);
router.post("/:id/entries", requireAuth, subscriptionGate, journalController.addJournalEntry);
router.delete("/:id/entries/:entryId", requireAuth, subscriptionGate, journalController.deleteJournalEntry);
router.put("/:id", requireAuth, subscriptionGate, journalController.updateJournal);
router.delete("/:id", requireAuth, subscriptionGate, journalController.deleteJournal);

module.exports = router;
