const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config');
const { getDatabase } = require('../db/database');
const rbacService = require('../services/rbacService');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function extractToken(req) {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    return req.headers.authorization.substring(7);
  }
  if (req.cookies && (req.cookies.token || req.cookies.auth_token)) {
    return req.cookies.token || req.cookies.auth_token;
  }
  return null;
}

function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication credentials are required to access this resource.',
        correlationId: req.correlationId
      }
    });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    const db = getDatabase();

    // Check session validity in user_sessions table
    const tokenH = hashToken(token);
    const session = db.prepare(`
      SELECT * FROM user_sessions
      WHERE token_hash = ? AND is_revoked = 0
    `).get(tokenH);

    if (!session) {
      return res.status(401).json({
        error: {
          code: 'SESSION_REVOKED',
          message: 'Your session has expired or has been revoked. Please log in again.',
          correlationId: req.correlationId
        }
      });
    }

    if (new Date(session.expires_at) < new Date()) {
      return res.status(401).json({
        error: {
          code: 'SESSION_EXPIRED',
          message: 'Session has expired. Please log in again.',
          correlationId: req.correlationId
        }
      });
    }

    // Verify user status in database
    const user = db.prepare(`SELECT id, email, status, email_verified FROM users WHERE id = ?`).get(decoded.userId);
    if (!user) {
      return res.status(401).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User account no longer exists.',
          correlationId: req.correlationId
        }
      });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({
        error: {
          code: 'ACCOUNT_SUSPENDED',
          message: 'Your account has been suspended by an administrator.',
          correlationId: req.correlationId
        }
      });
    }

    if (user.status === 'deactivated') {
      return res.status(403).json({
        error: {
          code: 'ACCOUNT_DEACTIVATED',
          message: 'This account has been deactivated.',
          correlationId: req.correlationId
        }
      });
    }

    // Update session last_active_at
    const now = new Date().toISOString();
    db.prepare(`UPDATE user_sessions SET last_active_at = ? WHERE id = ?`).run(now, session.id);

    // Dynamic role and permission resolution from DB to avoid stale JWT claims
    const roles = rbacService.getUserRoles(user.id).map(r => r.name);
    const permissions = rbacService.getUserPermissions(user.id).map(p => p.name);

    req.user = {
      id: user.id,
      email: user.email,
      emailVerified: Boolean(user.email_verified),
      status: user.status,
      roles,
      permissions,
      sessionId: session.id
    };
    req.token = token;

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Authentication token has expired. Please log in again.',
          correlationId: req.correlationId
        }
      });
    }
    return res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid authentication credentials provided.',
        correlationId: req.correlationId
      }
    });
  }
}

function optionalAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) return next();

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    const db = getDatabase();
    const tokenH = hashToken(token);
    const session = db.prepare(`SELECT * FROM user_sessions WHERE token_hash = ? AND is_revoked = 0`).get(tokenH);
    if (session && new Date(session.expires_at) >= new Date()) {
      const user = db.prepare(`SELECT id, email, status FROM users WHERE id = ?`).get(decoded.userId);
      if (user && user.status === 'active') {
        const roles = rbacService.getUserRoles(user.id).map(r => r.name);
        const permissions = rbacService.getUserPermissions(user.id).map(p => p.name);
        req.user = {
          id: user.id,
          email: user.email,
          roles,
          permissions,
          sessionId: session.id
        };
        req.token = token;
      }
    }
  } catch {
    // Ignore invalid token in optional auth
  }
  next();
}

module.exports = {
  requireAuth,
  optionalAuth
};
