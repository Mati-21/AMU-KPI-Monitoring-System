import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import compression from 'compression';
import errorHandler from './middleware/errorMiddleware.js';
import { swaggerSpec, swaggerUi, swaggerUiOptions } from './config/swagger.js';
import apiV1Routes from './modules/index.js';

/**
 * Builds the Express app: middleware, routes and error handling. Importing it opens no port and starts nothing,
 * so tests can use it directly. server.js is what runs it.
 */
const app = express();
const httpLogMode = (process.env.HTTP_LOG_MODE || 'dev').toLowerCase();

// How many reverse proxies stand in front of this server, so req.ip is the real client address. Off when not set.
if (process.env.TRUST_PROXY) {
  const proxyCount = Number(process.env.TRUST_PROXY);
  if (!Number.isInteger(proxyCount) || proxyCount < 1) throw new Error('TRUST_PROXY must be a whole number of proxies, such as 1. Leave it out when there is no proxy.');
  app.set('trust proxy', proxyCount);
}

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
export const allowedOrigins = [...new Set([...defaultAllowedOrigins, ...envOrigins])];

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

export default app;
