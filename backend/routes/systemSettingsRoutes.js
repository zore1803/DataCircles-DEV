const express = require('express');
const router = express.Router();
const systemSettingsController = require('../controllers/systemSettingsController');
const protect = require('../middlewares/auth');
const userSync = require('../middlewares/userSync');

// All routes require authentication
router.use(protect, userSync);

router.get('/', systemSettingsController.getSystemSettings);
router.put('/task-statuses', systemSettingsController.updateTaskStatuses);
router.put('/note-types', systemSettingsController.updateNoteTypes);

module.exports = router;
