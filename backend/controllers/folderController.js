// controllers/folderController.js
const Folder = require('../models/Folder');
const StorageUsage = require('../models/StorageUsage');
const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// Helper function to delete file from S3
const deleteFromS3 = async (fileUrl) => {
  try {
    const url = new URL(fileUrl);
    const key = url.pathname.substring(1);

    await s3Client.send(new DeleteObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key
    }));
    
    console.log(`Deleted from S3: ${key}`);
    return true;
  } catch (error) {
    console.error('S3 deletion error:', error);
    return false;
  }
};

// Create folder
exports.createFolder = async (req, res) => {
  try {
    const { name, company } = req.body;
    await Folder.create({ name, company, user: req.user._id });
    res.json({
      message: "folder created successfully"
    });
  } catch (err) {
    res.status(400).json({ error: 'Failed to create folder' });
  }
};

// Upload files to a folder
exports.uploadFiles = async (req, res) => {
  try {
    const { folder, folderId } = req.body;
    const files = req.files.map(file => ({
      fileName: file.originalname,
      fileType: file.mimetype,
      fileUrl: req.fileLocation,
      isLink: false,
      uploadedAt: new Date()
    }));

    const updatedFolder = await Folder.findByIdAndUpdate(
      folderId,
      { $push: { files: { $each: files } } },
      { new: true }
    );

    res.status(200).json({ message: 'Files uploaded successfully', folder: updatedFolder });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'File upload failed' });
  }
};

// NEW: Add hyperlink to folder
exports.addLink = async (req, res) => {
  try {
    const { folderId, fileName, fileUrl } = req.body;

    if (!fileName || !fileUrl) {
      return res.status(400).json({ error: 'fileName and fileUrl are required' });
    }

    // Validate URL format
    try {
      new URL(fileUrl);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    const linkFile = {
      fileName,
      fileUrl,
      isLink: true,
      fileType: 'link',
      uploadedAt: new Date()
    };

    const updatedFolder = await Folder.findByIdAndUpdate(
      folderId,
      { $push: { files: linkFile } },
      { new: true }
    );

    if (!updatedFolder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    res.status(200).json({ message: 'Link added successfully', folder: updatedFolder });
  } catch (err) {
    console.error('Add link error:', err);
    res.status(500).json({ error: 'Failed to add link' });
  }
};



// GET all folders (optionally by company)
exports.getAllFolders = async (req, res) => {
  try {
    const { companyId } = req.query;
    const folders = companyId
      ? await Folder.find({ company: companyId }).populate('company user')
      : await Folder.find().populate('company user');
    res.json(folders);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch folders' });
  }
};

// GET single folder
exports.getFolderById = async (req, res) => {
  try {
    const folder = await Folder.findById(req.params.id).populate('company user');
    res.json(folder);
  } catch (err) {
    res.status(404).json({ error: 'Folder not found' });
  }
};

// UPDATE folder (e.g., name or files)
exports.updateFolder = async (req, res) => {
  try {
    const updated = await Folder.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: 'Failed to update folder' });
  }
};

// Helper function to get file size from S3
const getFileSizeFromUrl = async (fileUrl) => {
  try {
    const response = await fetch(fileUrl, { method: 'HEAD' });
    const contentLength = response.headers.get('content-length');
    return parseInt(contentLength) || 0;
  } catch (error) {
    console.error('Error getting file size:', error);
    return 0;
  }
};

// Upload files with storage tracking
exports.uploadFiles = async (req, res) => {
  try {
    const { folderId } = req.body;
    const uploadedSize = req.uploadSize; // Set by middleware

    const files = req.files.map(file => ({
      fileName: file.originalname,
      fileType: file.mimetype,
      fileUrl: req.fileLocation || file.location,
      fileSize: file.size,
      isLink: false,
      uploadedAt: new Date()
    }));

    const updatedFolder = await Folder.findByIdAndUpdate(
      folderId,
      { $push: { files: { $each: files } } },
      { new: true }
    );

    // Update storage usage
    await StorageUsage.findOneAndUpdate(
      { organization: req.user.organization },
      { 
        $inc: { currentUsage: uploadedSize },
        lastUpdated: new Date()
      }
    );

    const storageInfo = await StorageUsage.findOne({ 
      organization: req.user.organization 
    });

    res.status(200).json({ 
      message: 'Files uploaded successfully', 
      folder: updatedFolder,
      storage: {
        currentUsage: `${(storageInfo.currentUsage / (1024 * 1024 * 1024)).toFixed(2)} GB`,
        storageLimit: `${(storageInfo.storageLimit / (1024 * 1024 * 1024)).toFixed(2)} GB`,
        usagePercentage: storageInfo.getUsagePercentage()
      }
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'File upload failed' });
  }
};

// Delete file with S3 cleanup and storage reduction
exports.deleteFile = async (req, res) => {
  try {
    const { id } = req.params;
    const { fileName, fileUrl, isLink } = req.body;

    const folder = await Folder.findById(id);
    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    const fileToDelete = folder.files.find(
      f => f.fileName === fileName && f.fileUrl === fileUrl
    );

    if (!fileToDelete) {
      return res.status(404).json({ error: 'File not found' });
    }

    let fileSize = fileToDelete.fileSize || 0;

    // Delete from S3 if not a link
    if (!isLink && !fileToDelete.isLink) {
      await deleteFromS3(fileUrl);
    }

    // Remove from folder
    const updatedFolder = await Folder.findByIdAndUpdate(
      id,
      { $pull: { files: { fileName, fileUrl } } },
      { new: true }
    );

    // Reduce storage usage (ensure it never goes negative)
    if (fileSize > 0) {
      const storageUsage = await StorageUsage.findOne({
        organization: req.user.organization,
        user: req.user._id
      });

      if (storageUsage) {
        // Calculate new usage, ensure it's not negative
        const newUsage = Math.max(0, (storageUsage.currentUsage || 0) - fileSize);
        
        await StorageUsage.findOneAndUpdate(
          { organization: req.user.organization, user: req.user._id },
          { 
            currentUsage: newUsage,
            lastUpdated: new Date()
          }
        );

        console.log(`📉 Storage reduced: ${fileSize} bytes. New usage: ${newUsage} bytes`);
      }
    }

    res.json({ 
      message: 'File deleted successfully', 
      folder: updatedFolder 
    });
  } catch (err) {
    console.error('Delete file error:', err);
    res.status(500).json({ error: 'Failed to delete file' });
  }
};

// Delete entire folder with S3 cleanup
exports.deleteFolder = async (req, res) => {
  try {
    const folder = await Folder.findById(req.params.id);
    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    let totalSize = 0;

    // Delete all files from S3
    for (const file of folder.files) {
      if (!file.isLink) {
        totalSize += file.fileSize || 0;
        await deleteFromS3(file.fileUrl);
      }
    }

    await Folder.findByIdAndDelete(req.params.id);

    // Reduce storage (ensure it never goes negative)
    if (totalSize > 0) {
      const storageUsage = await StorageUsage.findOne({
        organization: req.user.organization,
        user: req.user._id
      });

      if (storageUsage) {
        // Calculate new usage, ensure it's not negative
        const newUsage = Math.max(0, (storageUsage.currentUsage || 0) - totalSize);
        
        await StorageUsage.findOneAndUpdate(
          { organization: req.user.organization, user: req.user._id },
          { 
            currentUsage: newUsage,
            lastUpdated: new Date()
          }
        );

        console.log(`📉 Folder storage reduced: ${totalSize} bytes. New usage: ${newUsage} bytes`);
      }
    }

    res.json({ message: 'Folder deleted successfully' });
  } catch (err) {
    console.error('Delete folder error:', err);
    res.status(500).json({ error: 'Failed to delete folder' });
  }
};

// Get storage usage info
exports.getStorageInfo = async (req, res) => {
  try {
    const storageInfo = await StorageUsage.findOne({ user: req.user._id });
    
    if (!storageInfo) {
      return res.status(404).json({ error: 'Storage info not found' });
    }

    res.json({
      currentUsage: storageInfo.currentUsage,
      storageLimit: storageInfo.storageLimit,
      remainingSpace: storageInfo.getRemainingSpace(),
      usagePercentage: storageInfo.getUsagePercentage(),
      plan: storageInfo.plan,
      // Human-readable formats
      currentUsageFormatted: `${(storageInfo.currentUsage / (1024 * 1024 * 1024)).toFixed(2)} GB`,
      storageLimitFormatted: `${(storageInfo.storageLimit / (1024 * 1024 * 1024)).toFixed(2)} GB`,
      remainingSpaceFormatted: `${(storageInfo.getRemainingSpace() / (1024 * 1024 * 1024)).toFixed(2)} GB`
    });
  } catch (err) {
    console.error('Get storage info error:', err);
    res.status(500).json({ error: 'Failed to get storage info' });
  }
};
