const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const dotenv = require('dotenv');
const { connectDB } = require('./config/database');
const errorHandler = require('./middleware/errorMiddleware');

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

const app = express();

const defaultAllowedOrigins = ['http://localhost:3000', 'http://localhost:5173'];
const envOrigins = (process.env.CLIENT_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = [...new Set([...defaultAllowedOrigins, ...envOrigins])];

app.use(helmet());
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

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
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

    app.listen(PORT, () => {
      console.log(`🚀 KPI Monitoring System API running on port ${PORT}`);
      console.log(`📍 Environment: ${process.env.NODE_ENV}`);
      console.log(`🔗 API URL: http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
