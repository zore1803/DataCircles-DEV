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
  (req, res, next) => {
    uploadMiddlewareS3().array('files', 10)(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ error: 'Each file must be 100MB or smaller.', code: 'FILE_TOO_LARGE' });
        }
        console.error('Upload middleware error:', err);
        return res.status(400).json({ error: 'Failed to upload file(s).' });
      }
      next();
    });
  },
  restrictByPlan('folders', 'write'),
  folderController.uploadFiles
);

// NEW: Add hyperlink to folder
router.post('/add-link',
  requireAuth,
  subscriptionGate,
  restrictByPlan('folders', 'write'),
  folderController.addLink
);

// PUT update a hyperlink in a folder
router.put('/:folderId/links/:fileId',
  requireAuth,
  restrictByPlan('folders', 'write'),
  folderController.updateLink
);

// PATCH rename an uploaded file without replacing its stored object
router.patch('/:folderId/files/:fileId',
  requireAuth,
  subscriptionGate,
  restrictByPlan('folders', 'write'),
  folderController.renameFile
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

// Org-wide storage consumption (Data Administration settings card)
router.get('/org-storage-info',
  requireAuth,
  subscriptionGate,
  folderController.getOrgStorageInfo
);

module.exports = router;
