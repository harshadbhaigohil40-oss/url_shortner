const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs/promises');
const fileType = require('file-type');

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const uploadRoot = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '..', 'private-uploads'));
const allowedTypes = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp']
]);

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE, files: 1, fields: 2, parts: 3 },
  fileFilter: (req, file, callback) => {
    if (!allowedTypes.has(file.mimetype)) return callback(new Error('Unsupported file type'));
    callback(null, true);
  }
});

const scanFile = async (buffer) => {
  const requireScan = process.env.REQUIRE_UPLOAD_SCAN === 'true';
  const scannerUrl = process.env.CLAMAV_SCANNER_URL;

  if (scannerUrl) {
    try {
      const axios = require('axios');
      const response = await axios.post(`${scannerUrl}/scan`, buffer, {
        headers: { 'Content-Type': 'application/octet-stream' },
        timeout: 5000,
        maxBodyLength: MAX_FILE_SIZE
      });
      if (response.data && response.data.malwareDetected) {
        throw new Error('Malicious content detected in uploaded file');
      }
    } catch (err) {
      if (err.message && err.message.includes('Malicious content')) throw err;
      if (requireScan) {
        throw new Error(`Upload malware scanner failed: ${err.message}`);
      }
      console.warn('Optional ClamAV scanner unavailable, proceeding with verified image format:', err.message);
    }
    return;
  }

  if (requireScan) {
    throw new Error('Upload malware scanner is required by configuration but CLAMAV_SCANNER_URL is not set');
  }
};

const secureUpload = async (req, res, next) => {
  upload.single('avatar')(req, res, async (error) => {
    if (error) return res.status(400).json({ message: error.code === 'LIMIT_FILE_SIZE' ? 'File exceeds 2 MB limit' : error.message });
    if (!req.file) return res.status(400).json({ message: 'An avatar file is required' });

    try {
      let detected;
      try {
        detected = await fileType.fromBuffer(req.file.buffer);
      } catch {
        return res.status(400).json({ message: 'Corrupt or unreadable image file' });
      }
      const expectedExtension = detected && allowedTypes.get(detected.mime);
      if (!expectedExtension || expectedExtension !== allowedTypes.get(req.file.mimetype)) {
        return res.status(400).json({ message: 'File content does not match an allowed image type' });
      }

      await scanFile(req.file.buffer);
      await fs.mkdir(uploadRoot, { recursive: true });
      const filename = `${crypto.randomUUID()}${expectedExtension}`;
      const destination = path.join(uploadRoot, filename);
      await fs.writeFile(destination, req.file.buffer, { flag: 'wx', mode: 0o600 });
      req.uploadedFile = { filename, path: destination, mime: detected.mime, size: req.file.size };
      return next();
    } catch (scanOrStorageError) {
      return next(scanOrStorageError);
    }
  });
};

module.exports = { secureUpload, uploadRoot, MAX_FILE_SIZE };
