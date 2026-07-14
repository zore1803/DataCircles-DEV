const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth');
const userSync = require('../middlewares/userSync');
const subscriptionGate = require('../middlewares/subscriptionGate');
const kanbanNameController = require('../controllers/kanbanNameController');

const requireAuth = [authMiddleware, userSync];

// Create kanban name
router.post('/',
  requireAuth,
  subscriptionGate,
  kanbanNameController.createKanbanName
);

// Get kanban name
router.get('/',
  requireAuth,
  subscriptionGate,
  kanbanNameController.getKanbanName
);

// Update kanban name
router.put('/:id',
  requireAuth,
  subscriptionGate,
  kanbanNameController.updateKanbanName
);

module.exports = router;
