const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../db/database');
const config = require('../config');
const rbacService = require('./rbacService');
const auditService = require('./auditService');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

class AuthService {
  constructor(db = null) {
    this.db = db || getDatabase();
  }

  recordAuthEvent({ userId = null, email, eventType, ipAddress = '', userAgent = '', details = {} }) {
    const id = `aev_${uuidv4()}`;
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO auth_events (id, user_id, email, event_type, ip_address, user_agent, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, userId, email.toLowerCase(), eventType, ipAddress, userAgent, JSON.stringify(details), now);
  }

  async register({ email, password, firstName = '', lastName = '', ipAddress = '', userAgent = '' }) {
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    const cleanEmail = email.trim().toLowerCase();
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    // Check if email already exists
    const existing = this.db.prepare(`SELECT id FROM users WHERE lower(email) = ?`).get(cleanEmail);
    if (existing) {
      const err = new Error('An account with this email address already exists');
      err.statusCode = 409;
      throw err;
    }

    const userId = `usr_${uuidv4()}`;
    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59, 999).toISOString();

    // Verification token
    const verificationRawToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenHash = hashToken(verificationRawToken);
    const verifyExpiresAt = new Date(Date.now() + config.security.emailVerificationExpiryHours * 3600 * 1000).toISOString();

    this.db.transaction(() => {
      // 1. Insert user
      const insertUser = this.db.prepare(`
        INSERT INTO users (id, email, password_hash, first_name, last_name, status, email_verified, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'active', 0, ?, ?)
      `);
      insertUser.run(userId, cleanEmail, passwordHash, firstName.trim(), lastName.trim(), now, now);

      // 2. Assign standard user role
      const insertRole = this.db.prepare(`
        INSERT INTO user_roles (user_id, role_id, assigned_by, assigned_at)
        VALUES (?, 'role_user', 'system', ?)
      `);
      insertRole.run(userId, now);

      // 3. Assign default Free subscription
      const insertSub = this.db.prepare(`
        INSERT INTO user_subscriptions (id, user_id, plan_id, status, current_period_start, current_period_end, created_at, updated_at)
        VALUES (?, ?, 'free', 'active', ?, ?, ?, ?)
      `);
      insertSub.run(`sub_${uuidv4()}`, userId, startOfMonth, endOfMonth, now, now);

      // 4. Create initial quota period
      const insertQuotaPeriod = this.db.prepare(`
        INSERT INTO quota_periods (id, user_id, start_date, end_date, status, created_at)
        VALUES (?, ?, ?, ?, 'active', ?)
      `);
      insertQuotaPeriod.run(`qp_${userId}_${startOfMonth.substring(0, 10)}`, userId, startOfMonth, endOfMonth, now);

      // 5. Store email verification token
      const insertVerifyToken = this.db.prepare(`
        INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?)
      `);
      insertVerifyToken.run(`evt_${uuidv4()}`, userId, verificationTokenHash, verifyExpiresAt, now);
    })();

    this.recordAuthEvent({
      userId,
      email: cleanEmail,
      eventType: 'register_success',
      ipAddress,
      userAgent
    });

    return {
      userId,
      email: cleanEmail,
      firstName,
      lastName,
      emailVerified: false,
      verificationToken: verificationRawToken // In testing/dev, token is returned for instant verification
    };
  }

  async login({ email, password, mfaCode = null, ipAddress = '', userAgent = '', isAdminLogin = false }) {
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = this.db.prepare(`SELECT * FROM users WHERE lower(email) = ?`).get(cleanEmail);

    if (!user) {
      this.recordAuthEvent({
        email: cleanEmail,
        eventType: 'login_failure',
        ipAddress,
        userAgent,
        details: { reason: 'User not found' }
      });
      const err = new Error('Invalid email or password');
      err.statusCode = 401;
      throw err;
    }

    const now = new Date();

    // 1. Check brute-force lockout
    if (user.locked_until) {
      const lockUntilDate = new Date(user.locked_until);
      if (lockUntilDate > now) {
        const remainingMinutes = Math.ceil((lockUntilDate - now) / (60 * 1000));
        this.recordAuthEvent({
          userId: user.id,
          email: cleanEmail,
          eventType: 'lockout_blocked',
          ipAddress,
          userAgent,
          details: { remainingMinutes }
        });
        const err = new Error(`Account is temporarily locked due to multiple failed login attempts. Please try again in ${remainingMinutes} minutes.`);
        err.statusCode = 423; // Locked
        throw err;
      } else {
        // Lock expired, reset lock
        this.db.prepare(`UPDATE users SET locked_until = NULL, failed_login_attempts = 0 WHERE id = ?`).run(user.id);
        user.failed_login_attempts = 0;
        user.locked_until = null;
      }
    }

    // 2. Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      const newAttempts = (user.failed_login_attempts || 0) + 1;
      let newLockUntil = null;

      if (newAttempts >= config.security.maxLoginAttempts) {
        newLockUntil = new Date(Date.now() + config.security.lockoutDurationMinutes * 60 * 1000).toISOString();
      }

      this.db.prepare(`
        UPDATE users
        SET failed_login_attempts = ?, locked_until = ?
        WHERE id = ?
      `).run(newAttempts, newLockUntil, user.id);

      this.recordAuthEvent({
        userId: user.id,
        email: cleanEmail,
        eventType: 'login_failure',
        ipAddress,
        userAgent,
        details: { attempts: newAttempts, locked: !!newLockUntil }
      });

      if (newLockUntil) {
        const err = new Error(`Too many failed login attempts. Account locked for ${config.security.lockoutDurationMinutes} minutes.`);
        err.statusCode = 423;
        throw err;
      }

      const err = new Error('Invalid email or password');
      err.statusCode = 401;
      throw err;
    }

    // 3. Check account status
    if (user.status === 'suspended') {
      this.recordAuthEvent({
        userId: user.id,
        email: cleanEmail,
        eventType: 'login_blocked_suspended',
        ipAddress,
        userAgent
      });
      const err = new Error('Your account has been suspended by an administrator. Please contact support.');
      err.statusCode = 403;
      throw err;
    }

    if (user.status === 'deactivated') {
      const err = new Error('This account has been deactivated.');
      err.statusCode = 403;
      throw err;
    }

    // 4. Role & Admin verification if logging into Admin portal
    const roles = rbacService.getUserRoles(user.id);
    const roleNames = roles.map(r => r.name);
    const isAdmin = roleNames.some(r => ['super_admin', 'support_admin', 'auditor'].includes(r));

    if (isAdminLogin && !isAdmin) {
      this.recordAuthEvent({
        userId: user.id,
        email: cleanEmail,
        eventType: 'admin_login_rejected_non_admin',
        ipAddress,
        userAgent
      });
      const err = new Error('Access denied: Administrator privileges required.');
      err.statusCode = 403;
      throw err;
    }

    // 5. MFA verification (if enabled)
    if (user.mfa_enabled) {
      if (!mfaCode) {
        // Return temp token to prompt for MFA code
        const tempToken = jwt.sign(
          { userId: user.id, isMfaPending: true },
          config.jwtSecret,
          { expiresIn: '5m' }
        );
        return {
          mfaRequired: true,
          tempToken
        };
      } else {
        // Validate mock/TOTP code (Accept '123456' as demo mock code or match secret)
        if (mfaCode !== '123456' && mfaCode !== user.mfa_secret) {
          const err = new Error('Invalid multi-factor authentication code.');
          err.statusCode = 401;
          throw err;
        }
      }
    }

    // 6. Reset failed attempts & update last login
    this.db.prepare(`
      UPDATE users
      SET failed_login_attempts = 0, locked_until = NULL, last_login_at = ?
      WHERE id = ?
    `).run(now.toISOString(), user.id);

    // 7. Generate JWT & Session
    const permissions = rbacService.getUserPermissions(user.id).map(p => p.name);
    const sessionId = `ses_${uuidv4()}`;
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      roles: roleNames,
      permissions,
      sessionId
    };

    const token = jwt.sign(tokenPayload, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn
    });

    const tokenSessionHash = hashToken(token);
    const expiresAt = new Date(Date.now() + config.security.sessionExpiryHours * 3600 * 1000).toISOString();

    const insertSession = this.db.prepare(`
      INSERT INTO user_sessions (id, user_id, token_hash, ip_address, user_agent, is_revoked, expires_at, last_active_at, created_at)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)
    `);
    insertSession.run(sessionId, user.id, tokenSessionHash, ipAddress, userAgent, expiresAt, now.toISOString(), now.toISOString());

    this.recordAuthEvent({
      userId: user.id,
      email: cleanEmail,
      eventType: 'login_success',
      ipAddress,
      userAgent,
      details: { isAdminLogin, roles: roleNames }
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        status: user.status,
        emailVerified: Boolean(user.email_verified),
        mfaEnabled: Boolean(user.mfa_enabled),
        roles: roleNames,
        permissions,
        lastLoginAt: now.toISOString()
      }
    };
  }

  logout(token, userId = null) {
    if (!token) return true;
    try {
      const decoded = jwt.decode(token);
      const tokenHash = hashToken(token);

      const revokeStmt = this.db.prepare(`
        UPDATE user_sessions
        SET is_revoked = 1
        WHERE token_hash = ? OR (id = ? AND user_id = ?)
      `);
      revokeStmt.run(tokenHash, decoded ? decoded.sessionId : '', userId || (decoded ? decoded.userId : ''));

      if (decoded && decoded.email) {
        this.recordAuthEvent({
          userId: decoded.userId,
          email: decoded.email,
          eventType: 'logout'
        });
      }
    } catch {
      // Ignore token decode error during logout
    }
    return true;
  }

  async verifyEmail(rawToken) {
    if (!rawToken) {
      throw new Error('Verification token is required');
    }

    const tokenH = hashToken(rawToken);
    const record = this.db.prepare(`
      SELECT * FROM email_verification_tokens
      WHERE token_hash = ? AND used_at IS NULL
    `).get(tokenH);

    if (!record) {
      const err = new Error('Invalid or already used email verification link.');
      err.statusCode = 400;
      throw err;
    }

    if (new Date(record.expires_at) < new Date()) {
      const err = new Error('Email verification link has expired. Please request a new one.');
      err.statusCode = 400;
      throw err;
    }

    const now = new Date().toISOString();
    this.db.transaction(() => {
      this.db.prepare(`UPDATE email_verification_tokens SET used_at = ? WHERE id = ?`).run(now, record.id);
      this.db.prepare(`UPDATE users SET email_verified = 1, updated_at = ? WHERE id = ?`).run(now, record.user_id);
    })();

    const user = this.db.prepare(`SELECT email FROM users WHERE id = ?`).get(record.user_id);
    this.recordAuthEvent({
      userId: record.user_id,
      email: user ? user.email : '',
      eventType: 'email_verified'
    });

    return { success: true, message: 'Email successfully verified.' };
  }

  async forgotPassword(email, ipAddress = '') {
    if (!email) {
      throw new Error('Email is required');
    }
    const cleanEmail = email.trim().toLowerCase();
    const user = this.db.prepare(`SELECT id, email, status FROM users WHERE lower(email) = ?`).get(cleanEmail);

    if (!user) {
      // For security, don't leak user non-existence, return success message
      return { success: true, message: 'If that email address is in our database, we will send a password reset link.' };
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenH = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + config.security.passwordResetExpiryMinutes * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(`prt_${uuidv4()}`, user.id, tokenH, expiresAt, now);

    this.recordAuthEvent({
      userId: user.id,
      email: user.email,
      eventType: 'password_reset_request',
      ipAddress
    });

    return {
      success: true,
      message: 'Password reset link sent.',
      resetToken: rawToken // Returned for local testing and UI demonstration
    };
  }

  async resetPassword({ token, newPassword, ipAddress = '' }) {
    if (!token || !newPassword) {
      throw new Error('Token and new password are required');
    }

    if (newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters long');
    }

    const tokenH = hashToken(token);
    const record = this.db.prepare(`
      SELECT * FROM password_reset_tokens
      WHERE token_hash = ? AND used_at IS NULL
    `).get(tokenH);

    if (!record) {
      const err = new Error('Invalid or expired password reset link.');
      err.statusCode = 400;
      throw err;
    }

    if (new Date(record.expires_at) < new Date()) {
      const err = new Error('Password reset link has expired. Please request a new one.');
      err.statusCode = 400;
      throw err;
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    const now = new Date().toISOString();

    this.db.transaction(() => {
      // Mark token used
      this.db.prepare(`UPDATE password_reset_tokens SET used_at = ? WHERE id = ?`).run(now, record.id);

      // Update password and clear failed attempts
      this.db.prepare(`
        UPDATE users
        SET password_hash = ?, failed_login_attempts = 0, locked_until = NULL, updated_at = ?
        WHERE id = ?
      `).run(newHash, now, record.user_id);

      // Revoke all existing sessions for security on password change!
      this.db.prepare(`UPDATE user_sessions SET is_revoked = 1 WHERE user_id = ?`).run(record.user_id);
    })();

    const user = this.db.prepare(`SELECT email FROM users WHERE id = ?`).get(record.user_id);
    this.recordAuthEvent({
      userId: record.user_id,
      email: user ? user.email : '',
      eventType: 'password_reset_success',
      ipAddress
    });

    return { success: true, message: 'Password has been reset successfully. Please log in with your new password.' };
  }

  async changePassword(userId, { currentPassword, newPassword }) {
    if (!currentPassword || !newPassword) {
      throw new Error('Current and new password are required');
    }

    if (newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters long');
    }

    const user = this.db.prepare(`SELECT id, password_hash FROM users WHERE id = ?`).get(userId);
    if (!user) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }

    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match) {
      const err = new Error('Incorrect current password');
      err.statusCode = 400;
      throw err;
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    const now = new Date().toISOString();

    this.db.prepare(`
      UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?
    `).run(newHash, now, userId);

    return { success: true, message: 'Password updated successfully.' };
  }

  getUserSessions(userId) {
    const stmt = this.db.prepare(`
      SELECT id, ip_address, user_agent, is_revoked, expires_at, last_active_at, created_at
      FROM user_sessions
      WHERE user_id = ?
      ORDER BY created_at DESC
    `);
    return stmt.all(userId);
  }

  revokeSession(userId, sessionId) {
    const stmt = this.db.prepare(`
      UPDATE user_sessions
      SET is_revoked = 1
      WHERE id = ? AND user_id = ?
    `);
    const res = stmt.run(sessionId, userId);
    if (res.changes === 0) {
      const err = new Error('Session not found or already revoked');
      err.statusCode = 404;
      throw err;
    }
    return { success: true, message: 'Session revoked successfully.' };
  }

  getUserProfile(userId) {
    const user = this.db.prepare(`
      SELECT id, email, first_name, last_name, status, email_verified, mfa_enabled, created_at, last_login_at
      FROM users WHERE id = ?
    `).get(userId);

    if (!user) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }

    const roles = rbacService.getUserRoles(userId).map(r => r.name);
    const permissions = rbacService.getUserPermissions(userId).map(p => p.name);

    // Get current subscription plan
    const sub = this.db.prepare(`
      SELECT us.status as sub_status, us.current_period_start, us.current_period_end, sp.id as plan_id, sp.name as plan_name
      FROM user_subscriptions us
      JOIN subscription_plans sp ON us.plan_id = sp.id
      WHERE us.user_id = ?
    `).get(userId);

    return {
      ...user,
      emailVerified: Boolean(user.email_verified),
      mfaEnabled: Boolean(user.mfa_enabled),
      roles,
      permissions,
      subscription: sub || { plan_id: 'free', plan_name: 'Free Tier', sub_status: 'active' }
    };
  }

  updateUserProfile(userId, { firstName, lastName }) {
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE users
      SET first_name = COALESCE(?, first_name),
          last_name = COALESCE(?, last_name),
          updated_at = ?
      WHERE id = ?
    `).run(firstName !== undefined ? firstName : null, lastName !== undefined ? lastName : null, now, userId);

    return this.getUserProfile(userId);
  }

  deleteAccount(userId, requestingUser, reason = 'User requested account deletion') {
    // Check if requesting user is the account owner or authorized admin
    const isAdmin = rbacService.isAdmin(requestingUser.id);
    if (userId !== requestingUser.id && !isAdmin) {
      const err = new Error('Unauthorized to delete this account');
      err.statusCode = 403;
      throw err;
    }

    // Safety guard: cannot delete the last active super admin!
    if (rbacService.isSuperAdmin(userId)) {
      const activeSuperAdmins = rbacService.countActiveSuperAdmins();
      if (activeSuperAdmins <= 1) {
        const err = new Error('Cannot delete the last active Super Administrator.');
        err.statusCode = 400;
        throw err;
      }
    }

    const targetUser = this.db.prepare(`SELECT email FROM users WHERE id = ?`).get(userId);

    this.db.transaction(() => {
      // Cascade delete takes care of user_roles, user_sessions, quota_periods, usage_summaries, resumes
      this.db.prepare(`DELETE FROM users WHERE id = ?`).run(userId);
    })();

    if (isAdmin) {
      auditService.logAdminAction({
        actorId: requestingUser.id,
        actorEmail: requestingUser.email,
        actionType: 'user.delete',
        targetResource: 'user',
        targetId: userId,
        outcome: 'success',
        details: { targetEmail: targetUser ? targetUser.email : 'unknown', reason }
      });
    }

    return { success: true, message: 'Account and associated personal records deleted successfully.' };
  }
}

module.exports = new AuthService();
