import { prisma  } from '../../config/database.js';
import { logActivity  } from '../../utils/auditLogger.js';

const getSettings = async (req, res) => {
  try {
    const settings = await prisma.systemSettings.findMany();
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
      const existing = await prisma.systemSettings.findFirst({ where: { Key: key } });

      const now = new Date();
      if (existing) {
        await prisma.systemSettings.update({
          where: { Id: existing.Id },
          data: { Value: String(value), Type: type || 'string', updatedAt: now }
        });
      } else {
        await prisma.systemSettings.create({
          data: { Key: key, Value: String(value), Type: type || 'string', createdAt: now, updatedAt: now }
        });
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
    const settings = await prisma.systemSettings.findMany({
      where: { Key: { in: keys } }
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
    const now = new Date();
    
    const existing = await prisma.systemSettings.findFirst({ where: { Key: 'system_logo' } });

    if (existing) {
      await prisma.systemSettings.update({
        where: { Id: existing.Id },
        data: { Value: logoPath, updatedAt: now }
      });
    } else {
      await prisma.systemSettings.create({
        data: { Key: 'system_logo', Value: logoPath, Type: 'string', createdAt: now, updatedAt: now }
      });
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

export {  getSettings, updateSetting, getSystemStatus, uploadLogo  };
