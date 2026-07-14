// middlewares/uploadMiddlewareS3.js
const multer = require('multer');
const multerS3 = require('multer-s3');
const { S3Client } = require('@aws-sdk/client-s3');

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const uploadMiddlewareS3 = (bucketName = process.env.AWS_BUCKET_NAME, orgField = 'organizationId') => {
  return multer({
    storage: multerS3({
      s3,
      bucket: bucketName,
      contentType: multerS3.AUTO_CONTENT_TYPE,
      key: (req, file, cb) => {
        const orgId = req.user?.organization || 'General';
        const folderName = `org-${orgId}`; // Use organization slug or name if preferred
        const ext = file.originalname ? file.originalname.split('.').pop() : '';
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const fileName = `${folderName}/${file.fieldname}-${uniqueSuffix}${ext ? `.${ext}` : ''}`;
        req.fileLocation = `https://${process.env.CLOUDFRONT_DOMAIN}/${fileName}`;
        cb(null, fileName);
      }
    })
  });
};


module.exports = uploadMiddlewareS3;
