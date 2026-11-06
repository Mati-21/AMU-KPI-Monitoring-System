import 'dotenv/config';

import http from 'http';
import app, { allowedOrigins } from './app.js';
import { connectDB } from './config/database.js';
import { initSocket } from './realtime/socket.js';
import { seedPermissions } from './scripts/seedPermissions.js';
import { seedSettings } from './scripts/seedSettings.js';
import { startReminderJob } from './modules/09-notifications/reminder.job.js';
import { startMonitoring } from './modules/14-system-monitoring/monitoring.sampler.js';
import { ensureUploadFolders } from './modules/08-evidence-documents/file.storage.js';

/**
 * Runs the app built in app.js: connects to the database, syncs the registries, starts sockets, opens the port and
 * starts the reminder job.
 */
const PORT = process.env.PORT || 8058;

const startServer = async () => {
  try {
    await connectDB();
    await ensureUploadFolders();

    // Keep the permission catalog and system settings in step with config/*.json
    const permissions = await seedPermissions({ quiet: true });
    const settings = await seedSettings({ quiet: true });
    console.log(
      `Registries synced: permissions +${permissions.added}/-${permissions.removed}, ` +
        `settings +${settings.added}/~${settings.updated}/-${settings.removed}`
    );

    const server = http.createServer(app);
    initSocket(server, { allowedOrigins });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`⚠️ Port ${PORT} temporarily occupied. Retrying in 1s...`);
        setTimeout(() => {
          server.close();
          server.listen(PORT);
        }, 1000);
      } else {
        console.error('Server error:', err);
      }
    });

    process.once('SIGUSR2', () => {
      server.close(() => {
        process.kill(process.pid, 'SIGUSR2');
      });
    });

    server.listen(PORT, () => {
      console.log(`🚀 API running on http://localhost:${PORT} (${process.env.NODE_ENV || 'development'})`);
      startReminderJob();
      startMonitoring().catch((error) => console.warn('[Monitoring] Could not start:', error.message));
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
