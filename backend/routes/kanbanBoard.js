// routes/kanbanBoardRoutes.js (updated with organization filtering)
const express = require('express');
const router = express.Router();
const kanbanBoardController = require('../controllers/kanbanBoardController');
const authMiddleware = require('../middlewares/auth');
const userSync = require('../middlewares/userSync');
const checkPermission = require('../middlewares/checkPermission');

const requireAuth = [authMiddleware, userSync];
const subscriptionGate = require('../middlewares/subscriptionGate');

// CREATE kanban board
router.post('/',
  requireAuth,
  subscriptionGate,
  kanbanBoardController.createKanbanBoard
);

// READ latest kanban board
router.get('/',
  requireAuth,
  subscriptionGate,
  kanbanBoardController.getLatestKanbanBoard
);

// READ all kanban boards
router.get('/all',
  requireAuth,
  subscriptionGate,
  kanbanBoardController.getAllKanbanBoards
);

// READ kanban board by ID
router.get('/:id',
  requireAuth,
  subscriptionGate,
  kanbanBoardController.getKanbanBoardById
);

// UPDATE kanban board (supports reorder and status renaming)
router.put('/:id',
  requireAuth,
  subscriptionGate,
  kanbanBoardController.updateKanbanBoard
);

// DELETE kanban board
router.delete('/:id',
  requireAuth,
  subscriptionGate,
  kanbanBoardController.deleteKanbanBoard
);

module.exports = router;
