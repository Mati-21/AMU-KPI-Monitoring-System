import express from 'express';
const router = express.Router();
import multer from 'multer';
import path from 'path';
import { getSettings, updateSetting, getSystemStatus, uploadLogo  } from '../../controllers/system/settingController.js';
import { protect, admin  } from '../../middleware/authMiddleware.js';

import { logoStorage  } from '../../services/uploadService.js';

const upload = multer({ storage: logoStorage });

router.get('/status', getSystemStatus);
router.get('/', protect, admin, getSettings);
router.post('/', protect, admin, updateSetting);
router.post('/logo', protect, admin, upload.single('logo'), uploadLogo);

export default router;
