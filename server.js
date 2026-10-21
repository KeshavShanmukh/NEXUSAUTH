const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const config = require('./config');
const { getDatabase } = require('./db/database');
const { seedDatabase } = require('./db/seed');
const { correlationIdMiddleware, errorHandler } = require('./middleware/errorHandler');
const { requireAuth } = require('./middleware/auth');

// Route modules
const authRoutes = require('./routes/authRoutes');
const usageRoutes = require('./routes/usageRoutes');
const planRoutes = require('./routes/planRoutes');
const adminRoutes = require('./routes/adminRoutes');
const featureRoutes = require('./routes/featureRoutes');
const billingRoutes = require('./routes/billingRoutes');

const app = express();

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(cookieParser(config.cookieSecret));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(correlationIdMiddleware);

// Serve Static Frontend Assets
app.use(express.static(path.join(__dirname, 'public')));

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'platform-auth-usage-engine',
    version: '1.0.0'
  });
});

// Mount Versioned API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/usage', usageRoutes);
app.use('/api/v1/plans', planRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/billing', billingRoutes);
app.use('/api/v1/features', requireAuth, featureRoutes);
app.use('/api/v1', requireAuth, featureRoutes); // Also mount at /api/v1 for /api/v1/resumes, /api/v1/jobs/match, etc.

// Fallback to SPA index.html for client-side navigation
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api/')) {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'API route not found' } });
  }
  next();
});

// Centralized Error Handler
app.use(errorHandler);

// Initialization Helper
function initializeApp() {
  const db = getDatabase();
  // Ensure tables and initial seed data exist
  try {
    const userCount = db.prepare(`SELECT count(*) as count FROM users`).get().count;
    if (userCount === 0) {
      seedDatabase(db);
    }
  } catch (e) {
    seedDatabase(db);
  }
  return app;
}

if (require.main === module) {
  initializeApp();
  const PORT = config.port;
  app.listen(PORT, () => {
    console.log(`================================================================`);
    console.log(`🚀 Authentication & Usage Management Platform running on port ${PORT}`);
    console.log(`🔗 Web Application: http://localhost:${PORT}`);
    console.log(`🛡️  Admin Login: http://localhost:${PORT}#admin-login`);
    console.log(`👤 User Login:  http://localhost:${PORT}#login`);
    console.log(`================================================================`);
  });
}

module.exports = { app, initializeApp };
