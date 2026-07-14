const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth');
const uploadMiddlewareS3 = require("../middlewares/uploadMiddlewareS3");
const folderController = require('../controllers/folderController.js');
const restrictByPlan = require('../middlewares/restrictByPlan.js');

const requireAuth = [authMiddleware, require('../middlewares/userSync')];
const subscriptionGate = require('../middlewares/subscriptionGate');

// Create folder
router.post('/',
  requireAuth,
  subscriptionGate,
  restrictByPlan('folders', 'write'),
  folderController.createFolder
);

// Upload files to a folder
router.post('/upload',
  requireAuth,
  subscriptionGate,
  restrictByPlan('folders', 'write'),
  uploadMiddlewareS3().array('files', 10),
  folderController.uploadFiles
);

// NEW: Add hyperlink to folder
router.post('/add-link',
  requireAuth,
  subscriptionGate,
  restrictByPlan('folders', 'write'),
  folderController.addLink
);

// GET all folders (optionally by company)
router.get('/',
  requireAuth,
  subscriptionGate,
  restrictByPlan('folders', 'read'),
  folderController.getAllFolders
);

// GET single folder
router.get('/:id',
  requireAuth,
  subscriptionGate,
  restrictByPlan('folders', 'read'),
  folderController.getFolderById
);

// UPDATE folder (e.g., name or files)
router.put('/:id',
  requireAuth,
  subscriptionGate,
  restrictByPlan('folders', 'write'),
  folderController.updateFolder
);

// NEW: Delete specific file from folder
router.delete('/:id/files',
  requireAuth,
  subscriptionGate,
  restrictByPlan('folders', 'write'),
  folderController.deleteFile
);

// DELETE folder
router.delete('/:id',
  requireAuth,
  subscriptionGate,
  restrictByPlan('folders', 'write'),
  folderController.deleteFolder
);

// Get storage info
router.get('/storage-info',
  requireAuth,
  subscriptionGate,
  restrictByPlan('folders', 'read'),
  folderController.getStorageInfo
);

module.exports = router;
