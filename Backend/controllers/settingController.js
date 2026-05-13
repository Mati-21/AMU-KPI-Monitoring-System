const { SystemSetting } = require('../models');
const { logActivity } = require('../utils/auditLogger');

const getSettings = async (req, res) => {
  try {
    const settings = await SystemSetting.findAll();
    const settingsMap = {};
    settings.forEach(s => {
      settingsMap[s.Key] = s.Type === 'boolean' ? s.Value === 'true' : s.Value;
    });
    res.json({ success: true, data: settingsMap });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateSetting = async (req, res) => {
  try {
    const settings = Array.isArray(req.body) ? req.body : [req.body];
    console.log(`[SETTINGS] Bulk update started for ${settings.length} keys`);
    
    for (const s of settings) {
      const { key, value, type } = s;
      const [setting, created] = await SystemSetting.findOrCreate({
        where: { Key: key },
        defaults: {
          Value: String(value),
          Type: type || 'string'
        }
      });

      if (!created) {
        setting.Value = String(value);
        setting.Type = type || 'string';
        await setting.save();
      }
    }
    
    await logActivity({
      userId: req.user.Id,
      action: 'UPDATE_SETTINGS',
      resource: 'SystemSetting',
      description: `Updated ${settings.length} system configuration keys`,
      ipAddress: req.ip
    });
    
    res.json({ success: true, message: 'Settings updated successfully' });
  } catch (error) {
    console.error('[SETTINGS] Update error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getSystemStatus = async (req, res) => {
  try {
    const keys = ['maintenance_mode', 'displayName', 'orgName', 'system_logo'];
    const settings = await SystemSetting.findAll({
      where: {
        Key: keys
      }
    });

    const status = {
      maintenanceMode: false,
      displayName: 'AMU KPI Monitoring System',
      orgName: 'ArbaMinch University',
      systemLogo: null
    };

    settings.forEach(s => {
      if (s.Key === 'maintenance_mode') status.maintenanceMode = s.Value === 'true';
      if (s.Key === 'displayName') status.displayName = s.Value;
      if (s.Key === 'orgName') status.orgName = s.Value;
      if (s.Key === 'system_logo') status.systemLogo = s.Value;
    });

    res.json({ 
      success: true, 
      ...status
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const uploadLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const logoPath = req.file.path;
    
    const [setting, created] = await SystemSetting.findOrCreate({
      where: { Key: 'system_logo' },
      defaults: {
        Value: logoPath,
        Type: 'string'
      }
    });

    if (!created) {
      setting.Value = logoPath;
      await setting.save();
    }

    await logActivity({
      userId: req.user.Id,
      action: 'UPLOAD_LOGO',
      resource: 'SystemSetting',
      description: 'Uploaded new system logo',
      ipAddress: req.ip
    });

    res.json({ success: true, logoPath, message: 'Logo uploaded successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getSettings, updateSetting, getSystemStatus, uploadLogo };
