const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const dotenv = require('dotenv');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Ensure local uploads directory exists under Backend/uploads
const localUploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(localUploadsDir)) {
  fs.mkdirSync(localUploadsDir, { recursive: true });
}

// Local disk storage engine
const localDiskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, localUploadsDir);
  },
  filename: (req, file, cb) => {
    const safeName = String(file.originalname || 'file')
      .split('.')[0]
      .replace(/[^a-z0-9_.-]/gi, '_');
    cb(null, `${Date.now()}-${safeName}${path.extname(file.originalname)}`);
  }
});

// Fallback Multer Storage Engine that falls back to local storage if Cloudinary is offline or fails
class FallbackStorage {
  constructor(cloudinaryStorage, localStorage) {
    this.cloudinaryStorage = cloudinaryStorage;
    this.localStorage = localStorage;
  }

  _handleFile(req, file, cb) {
    // Try Cloudinary upload first
    this.cloudinaryStorage._handleFile(req, file, (err, info) => {
      if (err) {
        console.warn('[CLOUDINARY] Upload failed or offline, falling back to local storage:', err.message);
        
        // Use local disk storage instead
        this.localStorage._handleFile(req, file, (localErr, localInfo) => {
          if (localErr) {
            return cb(localErr);
          }
          
          // Form local static URL
          const baseUrl = req ? `${req.protocol}://${req.get('host')}` : 'http://localhost:5000';
          const fileUrl = `${baseUrl}/uploads/${localInfo.filename}`;
          
          cb(null, {
            path: fileUrl,
            size: localInfo.size,
            filename: localInfo.filename,
            isLocal: true,
          });
        });
      } else {
        cb(null, info);
      }
    });
  }

  _removeFile(req, file, cb) {
    if (file.isLocal) {
      this.localStorage._removeFile(req, file, cb);
    } else {
      this.cloudinaryStorage._removeFile(req, file, cb);
    }
  }
}

// Helper for different storage folders with offline fallback support
const createStorage = (subfolder) => {
  const cloudinaryStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: `amu-kpi-monitoring-system/${subfolder}`,
      resource_type: 'auto',
      public_id: (req, file) => {
        const safeName = String(file.originalname || 'file')
          .split('.')[0]
          .replace(/[^a-z0-9_.-]/gi, '_');
        return `${Date.now()}-${safeName}`;
      },
    },
  });

  return new FallbackStorage(cloudinaryStorage, localDiskStorage);
};

// 1. One for user profile upload
const profileStorage = createStorage('user-profiles');

// 2. One for evidence upload
const evidenceStorage = createStorage('evidence');

// 3. One for logo and system related things
const systemStorage = createStorage('system-assets');

module.exports = {
  cloudinary,
  profileStorage,
  evidenceStorage,
  logoStorage: systemStorage, // Re-export as logoStorage for settings
  messageStorage: systemStorage, // Re-export as messageStorage for messages
  systemStorage,
};
