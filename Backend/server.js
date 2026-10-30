import 'dotenv/config';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import compression from 'compression';
import path from 'path';
import http from 'http';
import { connectDB } from './config/database.js';
import errorHandler from './middleware/errorMiddleware.js';
import { initSocket } from './realtime/socket.js';
import { swaggerSpec, swaggerUi, swaggerUiOptions } from './config/swagger.js';
import apiV1Routes from './modules/index.js';
import { seedPermissions } from './scripts/seedPermissions.js';
import { seedSettings } from './scripts/seedSettings.js';

const app = express();
const httpLogMode = (process.env.HTTP_LOG_MODE || 'dev').toLowerCase();

const defaultAllowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:8058',
];
const envOrigins = (process.env.CLIENT_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = [...new Set([...defaultAllowedOrigins, ...envOrigins])];

app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'http://localhost:8058', 'blob:'],
        connectSrc: ["'self'", 'http://localhost:8058', 'ws://localhost:8058'],
      },
    },
  })
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);

app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

if (httpLogMode !== 'off') {
  app.use(morgan(httpLogMode === 'dev' ? 'dev' : 'tiny'));
}

// Swagger Documentation
app.use(
  '/api-docs',
  (req, res, next) => {
    res.removeHeader('Content-Security-Policy');
    next();
  },
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, swaggerUiOptions)
);
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});
app.get('/docs', (req, res) => res.redirect('/api-docs'));

// API v1 (all modules)
app.use('/api/v1', apiV1Routes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'AMU KPI Monitoring System API',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ status: 'error', message: `Route ${req.method} ${req.originalUrl} not found` });
});

// Global Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 8058;

const startServer = async () => {
  try {
    await connectDB();

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
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
