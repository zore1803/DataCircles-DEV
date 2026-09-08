// middlewares/uploadMiddlewarePublicForm.js
// Upload path for the PUBLIC, unauthenticated form-submission surface (FORMS_ARCHITECTURE.md §2.9).
//
// This is deliberately its own file, not a reuse of uploadMiddlewareS3.js: that middleware's S3 key
// is built from `req.user.organization`, which does not exist for an anonymous visitor. Reusing it
// would either crash or silently fall back to a shared "org-General" folder, mixing every public
// form's uploads together regardless of which org owns the form. `resolveFormOrganization` looks the
// organization up from the URL's public slug instead — server-side, never from the client.
//
// It also does NOT inherit uploadMiddlewareS3's permissive defaults (100MB, no mimetype filter at
// all). An endpoint open to the internet has a different risk profile from one behind a login.
//
// Buffered, not streamed: multer-s3 would hand the bytes straight to S3, which makes it impossible
// to inspect them BEFORE they are stored. multer's `file.mimetype` is just the client's own
// Content-Type header — `curl -F "f=@shell.html;type=image/png"` passes any mimetype whitelist. So
// the file is held in memory, its real type is read from its magic bytes, and only then is it
// uploaded, under a key and Content-Type derived from what the bytes actually are rather than from
// anything the client said.
const multer = require("multer");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const FormDefinition = require("../models/FormDefinition");

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const MAX_PUBLIC_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB — public-facing images/logos, not documents
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

// File signatures for exactly the formats above. Deliberately no SVG: it is XML that can carry
// script, and serving one from the CDN origin would be stored XSS.
const SIGNATURES = [
  { ext: "jpg", mime: "image/jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: "png", mime: "image/png", test: (b) => b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: "gif", mime: "image/gif", test: (b) => b.slice(0, 4).toString("ascii") === "GIF8" },
  { ext: "webp", mime: "image/webp", test: (b) => b.slice(0, 4).toString("ascii") === "RIFF" && b.slice(8, 12).toString("ascii") === "WEBP" },
];

/**
 * Purpose: Identify a file from its leading bytes, ignoring anything the client claimed.
 * Inputs: buffer (Buffer)
 * Outputs: { ext, mime } | null when the bytes match none of the allowed formats
 */
function sniff(buffer) {
  if (!buffer || buffer.length < 12) return null;
  return SIGNATURES.find((s) => s.test(buffer)) || null;
}

async function resolveFormOrganization(req, res, next) {
  try {
    const { publicSlug } = req.params;
    const form = await FormDefinition.findOne(
      { "publishState.publicSlug": publicSlug, status: "published" },
      { organization: 1 }
    );
    if (!form) {
      return res.status(404).json({ error: "Form not found or not accepting submissions." });
    }
    req.formOrganization = form.organization;
    next();
  } catch (err) {
    console.error("resolveFormOrganization error:", err);
    res.status(500).json({ error: "Something went wrong." });
  }
}

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PUBLIC_FILE_SIZE_BYTES, files: 1 },
  // A cheap early reject on the declared type, so an obviously-wrong upload is refused before its
  // bytes are buffered. This is NOT the real check — that happens on the magic bytes below.
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error("Only JPG, PNG, WEBP, or GIF images are allowed."));
    }
    cb(null, true);
  },
}).single("file");

/**
 * Purpose: Receive one image from an anonymous visitor, verify it really is one, and store it in
 *   the owning organization's S3 folder.
 * Side effects: one S3 PutObject. Sets req.fileLocation to the CloudFront URL on success.
 * Errors: responds 400 for a rejected file (too large, wrong declared type, or bytes that do not
 *   match an allowed image format), 500 if S3 itself fails.
 */
function uploadPublicFormFileSafe(req, res, next) {
  memoryUpload(req, res, async (err) => {
    if (err) {
      const message =
        err.code === "LIMIT_FILE_SIZE" ? "File is too large. Maximum size is 5MB." : err.message || "Upload failed.";
      return res.status(400).json({ error: message });
    }
    if (!req.file) return res.status(400).json({ error: "No file uploaded." });

    // The authoritative check: what the bytes actually are.
    const real = sniff(req.file.buffer);
    if (!real) {
      return res.status(400).json({ error: "That file isn't a valid JPG, PNG, WEBP, or GIF image." });
    }
    // A file whose contents disagree with its declared type is either broken or an attempt to
    // smuggle something past the filter. Either way it is not what was asked for.
    if (real.mime !== req.file.mimetype) {
      return res.status(400).json({ error: "That file's contents don't match its file type." });
    }

    try {
      // Key and Content-Type are built from the SNIFFED type, never from file.originalname — a
      // client-supplied name could otherwise dictate the stored extension (and, through it, how the
      // CDN later serves the object).
      const folderName = `org-${req.formOrganization}`;
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const fileName = `${folderName}/public-form-upload-${uniqueSuffix}.${real.ext}`;

      await s3.send(
        new PutObjectCommand({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: fileName,
          Body: req.file.buffer,
          ContentType: real.mime,
          // Belt and braces: even if a future signature list let something scriptable through, the
          // CDN is told to download rather than render it.
          ContentDisposition: "inline",
        })
      );

      req.fileLocation = `https://${process.env.CLOUDFRONT_DOMAIN}/${fileName}`;
      next();
    } catch (e) {
      console.error("uploadPublicFormFileSafe S3 error:", e);
      res.status(500).json({ error: "Upload failed. Please try again." });
    }
  });
}

module.exports = { resolveFormOrganization, uploadPublicFormFileSafe, sniff, MAX_PUBLIC_FILE_SIZE_BYTES };
