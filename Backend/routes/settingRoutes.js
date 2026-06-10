const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { getSettings, updateSetting, getSystemStatus, uploadLogo } = require('../controllers/settingController');
const { protect, admin } = require('../middleware/authMiddleware');

const { logoStorage } = require('../services/uploadService');

const upload = multer({ storage: logoStorage });

router.get('/status', getSystemStatus);
router.get('/', protect, admin, getSettings);
router.post('/', protect, admin, updateSetting);
router.post('/logo', protect, admin, upload.single('logo'), uploadLogo);

module.exports = router;
