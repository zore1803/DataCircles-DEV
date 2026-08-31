const express = require('express');
const router = express.Router();
const systemSettingsController = require('../controllers/systemSettingsController');
const sessionAuth = require('../middlewares/sessionAuth');
const csrfCheck = require('../middlewares/csrfCheck');

// All routes require authentication
router.use(sessionAuth, csrfCheck);

router.get('/', systemSettingsController.getSystemSettings);
router.put('/task-statuses', systemSettingsController.updateTaskStatuses);
router.put('/note-types', systemSettingsController.updateNoteTypes);
router.put('/meeting-types', systemSettingsController.updateMeetingTypes);

module.exports = router;
