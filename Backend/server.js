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
import dotenv from 'dotenv';
import path from 'path';
import http from 'http';
import { connectDB } from './config/database.js';
import errorHandler from './middleware/errorMiddleware.js';
import { initSocket } from './realtime/socket.js';

dotenv.config();

import routes from './routes/index.js';

const app = express();
const httpLogMode = (process.env.HTTP_LOG_MODE || 'errors').toLowerCase();

const defaultAllowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
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
        imgSrc: ["'self'", 'data:', 'http://localhost:5000', 'blob:'],
        connectSrc: ["'self'", 'http://localhost:5000', 'ws://localhost:5000'],
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
  if (httpLogMode === 'dev') {
    app.use(morgan('dev'));
  } else if (httpLogMode === 'tiny') {
    app.use(morgan('tiny'));
  } else {
    app.use(
      morgan('tiny', {
        skip: (req, res) => res.statusCode < 400,
      })
    );
  }
}

app.use('/api', routes);

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'KPI Monitoring System API',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.originalUrl} not found` });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    const { loadCycleYearFromDB } = await import('./utils/kpiCycle.js');
    await loadCycleYearFromDB();

    const server = http.createServer(app);
    initSocket(server, { allowedOrigins });

    server.listen(PORT, () => {
      console.log(`API running on http://localhost:${PORT} (${process.env.NODE_ENV || 'development'})`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
