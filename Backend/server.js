const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const compression = require('compression');
const dotenv = require('dotenv');
const path = require('path');
const http = require('http');
const { connectDB } = require('./config/database');
const errorHandler = require('./middleware/errorMiddleware');
const { initSocket } = require('./realtime/socket');

dotenv.config();

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const roleCategoryRoutes = require('./routes/roleCategoryRoutes');
const roleRoutes = require('./routes/roleRoutes');
const userRoleRoutes = require('./routes/userRoleRoutes');
const unitRoutes = require('./routes/unitRoutes');
const kpiTypeRoutes = require('./routes/kpiTypeRoutes');
const kpiRoutes = require('./routes/kpiRoutes');
const userKpiRoutes = require('./routes/userKpiRoutes');
const userKpiResultRoutes = require('./routes/userKpiResultRoutes');
const kpiDocumentRoutes = require('./routes/kpiDocumentRoutes');
const kpiYearPlanRoutes = require('./routes/kpiYearPlanRoutes');
const adminDashboardRoutes = require('./routes/adminDashboardRoutes');
const settingRoutes = require('./routes/settingRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const messageRoutes = require('./routes/messageRoutes');

const app = express();
const httpLogMode = (process.env.HTTP_LOG_MODE || 'errors').toLowerCase();

const defaultAllowedOrigins = ['http://localhost:3000', 'http://localhost:5173'];
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
        imgSrc: ["'self'", 'data:', 'http://localhost:5000', 'blob:', 'https://res.cloudinary.com'],
        connectSrc: ["'self'", 'http://localhost:5000', 'ws://localhost:5000', 'https://res.cloudinary.com'],
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

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/role-categories', roleCategoryRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/user-roles', userRoleRoutes);
app.use('/api/units', unitRoutes);
app.use('/api/kpi-types', kpiTypeRoutes);
app.use('/api/kpis', kpiRoutes);
app.use('/api/user-kpis', userKpiRoutes);
app.use('/api/user-kpi-results', userKpiResultRoutes);
app.use('/api/kpi-documents', kpiDocumentRoutes);
app.use('/api/kpi-year-plans', kpiYearPlanRoutes);
app.use('/api/admin-dashboard', adminDashboardRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/messages', messageRoutes);

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
