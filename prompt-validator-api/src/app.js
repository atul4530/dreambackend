const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const promptRoutes = require('./routes/prompt.routes');
const trendRoutes = require('./routes/trend.routes');
const adminTrendRoutes = require('./routes/adminTrend.routes');

const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');
const trendStore = require('./services/trendStore');

const app = express();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      // Allow remote HTTPS images (trend thumbnails on Firebase Storage)
      // and data: URLs (inline upload previews) in the admin dashboard.
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Key'],
}));

// Admin uploads carry base64 thumbnails (up to ~12MB), so the admin prefix
// gets a larger body limit. The 10kb parser below skips bodies that have
// already been parsed (body-parser sets req._body).
app.use('/api/v1/admin', express.json({ limit: '25mb' }));
app.use(express.json({ limit: '10kb' }));

const morganStream = {
  write: (message) => logger.info(message.trim()),
};

app.use(morgan('short', { stream: morganStream }));

const makeLimiter = (max) => rateLimit({
  windowMs: 60 * 1000,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
  },
});

const promptLimiter = makeLimiter(parseInt(process.env.RATE_LIMIT_MAX, 10) || 30);
const trendLimiter = makeLimiter(parseInt(process.env.TREND_RATE_LIMIT_MAX, 10) || 120);
const adminLimiter = makeLimiter(parseInt(process.env.ADMIN_RATE_LIMIT_MAX, 10) || 60);

app.use('/api/v1/prompts', promptLimiter);
app.use('/api/v1/trends', trendLimiter);
app.use('/api/v1/admin', adminLimiter);

app.use('/api/v1/prompts', promptRoutes);
app.use('/api/v1/trends', trendRoutes);
app.use('/api/v1/admin/trends', adminTrendRoutes);

// Private admin dashboard (static, no framework).
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/', (_req, res) => {
  res.redirect('/dashboard/');
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Seed default categories on boot when Firebase is configured. Never blocks
// startup and never crashes the process (Firebase may be absent).
trendStore.seedCategoriesIfNeeded().catch(() => {});

app.use(errorHandler);

module.exports = app;