// middlewares/uploadMiddleware.js
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const uploadMiddleware = (folderField = 'folder') => {
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      const folderName = req.body[folderField] || req.query[folderField] || 'General';
      const uploadPath = path.join(__dirname, '..', 'uploads', folderName);

      // Create folder if it doesn't exist
      fs.mkdirSync(uploadPath, { recursive: true });

      cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
  });

  return multer({ storage });
};

module.exports = uploadMiddleware;
