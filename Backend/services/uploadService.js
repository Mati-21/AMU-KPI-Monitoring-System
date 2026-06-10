const multer = require('multer');
const fs = require('fs');
const path = require('path');

// Base uploads directory
const uploadsDir = path.join(__dirname, '../uploads');

// Ensure directories exist
const ensureDirExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

ensureDirExists(uploadsDir);
ensureDirExists(path.join(uploadsDir, 'user-profiles'));
ensureDirExists(path.join(uploadsDir, 'evidence'));
ensureDirExists(path.join(uploadsDir, 'system-assets'));

// Helper to create disk storage
const createDiskStorage = (subfolder) => {
  const destinationDir = path.join(uploadsDir, subfolder);
  return multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, destinationDir);
    },
    filename: (req, file, cb) => {
      const safeName = String(file.originalname || 'file')
        .split('.')[0]
        .replace(/[^a-z0-9_.-]/gi, '_');
      cb(null, `${Date.now()}-${safeName}${path.extname(file.originalname)}`);
    }
  });
};

// Custom storage engine wrapper that returns local URLs
class LocalUrlStorage {
  constructor(diskStorage, subfolder) {
    this.diskStorage = diskStorage;
    this.subfolder = subfolder;
  }

  _handleFile(req, file, cb) {
    this.diskStorage._handleFile(req, file, (err, info) => {
      if (err) {
        return cb(err);
      }
      // Form local static URL
      const baseUrl = req ? `${req.protocol}://${req.get('host')}` : 'http://localhost:5000';
      const fileUrl = `${baseUrl}/uploads/${this.subfolder}/${info.filename}`;
      
      cb(null, {
        path: fileUrl,
        size: info.size,
        filename: info.filename,
      });
    });
  }

  _removeFile(req, file, cb) {
    this.diskStorage._removeFile(req, file, cb);
  }
}

const profileStorage = new LocalUrlStorage(createDiskStorage('user-profiles'), 'user-profiles');
const evidenceStorage = new LocalUrlStorage(createDiskStorage('evidence'), 'evidence');
const systemStorage = new LocalUrlStorage(createDiskStorage('system-assets'), 'system-assets');

module.exports = {
  profileStorage,
  evidenceStorage,
  logoStorage: systemStorage,
  messageStorage: systemStorage,
  systemStorage,
};
