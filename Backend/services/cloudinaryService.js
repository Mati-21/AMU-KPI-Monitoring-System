const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const dotenv = require('dotenv');

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Helper for different storage folders
const createStorage = (subfolder) => {
  return new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: `amu-kpi-monitoring-system/${subfolder}`,
      allowed_formats: ['jpg', 'png', 'jpeg', 'pdf', 'doc', 'docx', 'xls', 'xlsx'],
      resource_type: 'auto',
      public_id: (req, file) => {
        const safeName = String(file.originalname || 'file')
          .split('.')[0]
          .replace(/[^a-z0-9_.-]/gi, '_');
        return `${Date.now()}-${safeName}`;
      },
    },
  });
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
