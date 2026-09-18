import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './config/env.js';

import teachersRoutes from './routes/teachers.routes.js';
import messagesRoutes from './routes/messages.routes.js';
import mediaRoutes from './routes/media.routes.js';
import shareRoutes from './routes/share.routes.js';
import wallRoutes from './routes/wall.routes.js';
import adminRoutes from './routes/admin.routes.js';
import collegesRoutes from './routes/colleges.routes.js';

import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

export const app = express();

// Enable trust proxy for Render / reverse proxies (prevents express-rate-limit proxy error)
app.set('trust proxy', 1);

// CORS configuration supporting configured origins (comma-separated), local dev, and cloud hosts
const configuredOrigins = (config.corsOrigin || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const allowedOrigins = [
  ...configuredOrigins,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (!origin) return callback(null, true);

      // If '*' is specified, allow all origins
      if (allowedOrigins.includes('*')) {
        return callback(null, true);
      }

      // Check if origin matches allowed list or domain pattern
      const isAllowed = allowedOrigins.some((allowed) => {
        if (allowed === origin) return true;
        if (allowed.startsWith('*.') && origin.endsWith(allowed.slice(1))) return true;
        return false;
      });

      if (isAllowed) {
        return callback(null, true);
      }

      // In development or staging, allow local network origins
      if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
        return callback(null, true);
      }

      // Allow all for public event API fallback while supporting credentials
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Body parsers
app.use(express.json({ limit: '55mb' }));
app.use(express.urlencoded({ extended: true, limit: '55mb' }));

// Rate limiters
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // limit each IP to 15 login requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
});

const submissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 submissions per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many submissions from this connection. Please wait a moment.' },
});

// Health check route
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    event: "BISU Bilar Teacher's Day Celebration 2026",
    timestamp: new Date().toISOString(),
  });
});

// Apply routes
app.use('/admin/login', loginLimiter);
app.use('/admin', adminRoutes);

app.use('/colleges', collegesRoutes);
app.use('/teachers', teachersRoutes);
app.use('/teachers', submissionLimiter, messagesRoutes);

app.use('/media', mediaRoutes);
app.use('/share', shareRoutes);

app.use('/wall', (req, res, next) => {
  if (req.method === 'POST') {
    return submissionLimiter(req, res, next);
  }
  next();
}, wallRoutes);

// 404 and Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
