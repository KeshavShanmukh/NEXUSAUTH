const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { requireAdmin, requireSuperAdmin, requirePermission } = require('../middleware/rbac');
const auditService = require('../services/auditService');
const rbacService = require('../services/rbacService');
const usageService = require('../services/usageService');
const quotaService = require('../services/quotaService');
const billingService = require('../services/billingService');

// All admin routes require authentication and admin role
router.use(requireAuth, requireAdmin);

// GET /api/v1/admin/dashboard
router.get('/dashboard', requirePermission('analytics:read'), (req, res, next) => {
  try {
    const analytics = usageService.getAdminPlatformAnalytics();
    const recentAudit = auditService.getAuditLogs({ limit: 5, offset: 0 });
    const recentEvents = usageService.getAdminUsageEvents({ limit: 5, offset: 0 });

    res.status(200).json({
      success: true,
      analytics,
      recentAudit: recentAudit.logs,
      recentEvents: recentEvents.events
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/admin/users
router.get('/users', requirePermission('users:read'), (req, res, next) => {
  try {
    const db = getDatabase();
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = parseInt(req.query.offset, 10) || 0;
    const search = req.query.search || '';
    const status = req.query.status || '';
    const plan = req.query.plan || '';

    let sql = `
      SELECT u.id, u.email, u.first_name, u.last_name, u.status, u.email_verified,
             u.created_at, u.last_login_at,
             sp.id as plan_id, sp.name as plan_name,
             GROUP_CONCAT(r.name) as roles
      FROM users u
      LEFT JOIN user_subscriptions us ON u.id = us.user_id
      LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      sql += ` AND (u.email LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (status) {
      sql += ` AND u.status = ?`;
      params.push(status);
    }
    if (plan) {
      sql += ` AND sp.id = ?`;
      params.push(plan);
    }

    sql += ` GROUP BY u.id ORDER BY u.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const users = db.prepare(sql).all(...params);

    // Get total count
    let countSql = `SELECT COUNT(DISTINCT u.id) as total FROM users u WHERE 1=1`;
    const countParams = [];
    if (search) {
      countSql += ` AND (u.email LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ?)`;
      countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (status) {
      countSql += ` AND u.status = ?`;
      countParams.push(status);
    }
    const { total } = db.prepare(countSql).get(...countParams);

    res.status(200).json({
      success: true,
      total,
      limit,
      offset,
      users: users.map(u => ({
        id: u.id,
        email: u.email,
        firstName: u.first_name,
        lastName: u.last_name,
        status: u.status,
        emailVerified: Boolean(u.email_verified),
        plan: { id: u.plan_id || 'free', name: u.plan_name || 'Free Tier' },
        roles: u.roles ? u.roles.split(',') : ['user'],
        createdAt: u.created_at,
        lastLoginAt: u.last_login_at
      }))
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/admin/users/:userId
router.get('/users/:userId', requirePermission('users:read'), (req, res, next) => {
  try {
    const db = getDatabase();
    const user = db.prepare(`
      SELECT id, email, first_name, last_name, status, email_verified, mfa_enabled, created_at, updated_at, last_login_at
      FROM users WHERE id = ?
    `).get(req.params.userId);

    if (!user) {
      return res.status(404).json({ error: { message: 'User not found' } });
    }

    const roles = rbacService.getUserRoles(user.id);
    const quotas = quotaService.getUserQuotas(user.id);
    const usageHistory = usageService.getUserUsageHistory(user.id, { limit: 10 });
    const resumesCount = db.prepare(`SELECT COUNT(*) as count FROM resumes WHERE user_id = ?`).get(user.id).count;

    res.status(200).json({
      success: true,
      user: {
        ...user,
        emailVerified: Boolean(user.email_verified),
        mfaEnabled: Boolean(user.mfa_enabled),
        roles: roles.map(r => r.name),
        quotas,
        resumesCount,
        recentUsage: usageHistory.events
      }
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/admin/users/:userId/status
router.patch('/users/:userId/status', requirePermission('users:manage'), (req, res, next) => {
  try {
    const { status, reason } = req.body;
    const targetUserId = req.params.userId;

    if (!['active', 'suspended', 'deactivated'].includes(status)) {
      return res.status(400).json({ error: { message: 'Invalid status. Must be active, suspended, or deactivated.' } });
    }

    // Safety guard: cannot suspend or deactivate the last active super admin!
    if (status !== 'active' && rbacService.isSuperAdmin(targetUserId)) {
      const activeSuperAdmins = rbacService.countActiveSuperAdmins();
      if (activeSuperAdmins <= 1) {
        return res.status(400).json({
          error: { message: 'Cannot suspend or deactivate the last active Super Administrator.' }
        });
      }
    }

    const db = getDatabase();
    const user = db.prepare(`SELECT email, status FROM users WHERE id = ?`).get(targetUserId);
    if (!user) {
      return res.status(404).json({ error: { message: 'User not found' } });
    }

    const now = new Date().toISOString();
    db.prepare(`UPDATE users SET status = ?, updated_at = ? WHERE id = ?`).run(status, now, targetUserId);

    // If suspended or deactivated, revoke all active sessions immediately
    if (status !== 'active') {
      db.prepare(`UPDATE user_sessions SET is_revoked = 1 WHERE user_id = ?`).run(targetUserId);
    }

    // Record audit event
    auditService.logAdminAction({
      actorId: req.user.id,
      actorEmail: req.user.email,
      actionType: 'user.status_change',
      targetResource: 'user',
      targetId: targetUserId,
      correlationId: req.correlationId,
      outcome: 'success',
      ipAddress: req.ip,
      details: {
        targetEmail: user.email,
        previousStatus: user.status,
        newStatus: status,
        reason: reason || 'Administrative action'
      }
    });

    res.status(200).json({
      success: true,
      message: `User status changed to ${status}.`,
      status
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/admin/users/:userId
router.delete('/users/:userId', requirePermission('users:delete'), (req, res, next) => {
  try {
    const targetUserId = req.params.userId;
    const { reason } = req.body || {};

    const authService = require('../services/authService');
    const result = authService.deleteAccount(targetUserId, req.user, reason || 'Administrative account deletion');
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/admin/usage/summary
router.get('/usage/summary', requirePermission('analytics:read'), (req, res, next) => {
  try {
    const analytics = usageService.getAdminPlatformAnalytics();
    res.status(200).json({
      success: true,
      analytics
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/admin/usage/users/:userId
router.get('/usage/users/:userId', requirePermission('analytics:read'), (req, res, next) => {
  try {
    const summary = usageService.getUserUsageSummary(req.params.userId);
    res.status(200).json({
      success: true,
      ...summary
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/admin/usage/events
router.get('/usage/events', requirePermission('analytics:read'), (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const offset = parseInt(req.query.offset, 10) || 0;
    const featureName = req.query.feature || null;
    const status = req.query.status || null;
    const userId = req.query.userId || null;

    const events = usageService.getAdminUsageEvents({ limit, offset, featureName, status, userId });
    res.status(200).json({
      success: true,
      ...events
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/admin/audit-logs
router.get('/audit-logs', requirePermission('audit:read'), (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const offset = parseInt(req.query.offset, 10) || 0;
    const actorId = req.query.actorId || null;
    const actionType = req.query.actionType || null;
    const outcome = req.query.outcome || null;
    const search = req.query.search || null;

    const logs = auditService.getAuditLogs({ limit, offset, actorId, actionType, outcome, search });
    res.status(200).json({
      success: true,
      ...logs
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/admin/plans
router.get('/plans', requirePermission('plans:manage'), (req, res, next) => {
  try {
    const plans = billingService.getPlans();
    res.status(200).json({
      success: true,
      plans
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/admin/plans/:planId
router.patch('/plans/:planId', requirePermission('plans:manage'), (req, res, next) => {
  try {
    const { name, description, priceMonthlyCents, entitlements } = req.body;
    const updated = billingService.updatePlan(
      req.params.planId,
      { name, description, priceMonthlyCents, entitlements },
      req.user
    );
    res.status(200).json({
      success: true,
      plan: updated
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/admin/users/:userId/quotas
router.patch('/users/:userId/quotas', requirePermission('quotas:manage'), (req, res, next) => {
  try {
    const { featureName, newLimit, reason } = req.body;
    const targetUserId = req.params.userId;

    const result = quotaService.overrideUserQuota({
      userId: targetUserId,
      featureName,
      newLimit: parseInt(newLimit, 10),
      reason,
      adminUser: req.user
    });

    res.status(200).json({
      success: true,
      ...result
    });
  } catch (err) {
    next(err);
  }
});

// Admin Account Management:
// GET /api/v1/admin/admins
router.get('/admins', requirePermission('admins:manage'), (req, res, next) => {
  try {
    const admins = rbacService.listAdmins();
    res.status(200).json({
      success: true,
      admins
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/admin/admins
router.post('/admins', requireSuperAdmin, async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, role } = req.body;
    if (!email || !password || !role) {
      return res.status(400).json({ error: { message: 'Email, password, and role are required.' } });
    }

    if (!['super_admin', 'support_admin', 'auditor'].includes(role)) {
      return res.status(400).json({ error: { message: 'Invalid admin role.' } });
    }

    const db = getDatabase();
    const existing = db.prepare(`SELECT id FROM users WHERE lower(email) = ?`).get(email.toLowerCase());
    if (existing) {
      return res.status(409).json({ error: { message: 'An account with this email already exists.' } });
    }

    const adminId = `usr_${uuidv4()}`;
    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();

    db.transaction(() => {
      db.prepare(`
        INSERT INTO users (id, email, password_hash, first_name, last_name, status, email_verified, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'active', 1, ?, ?)
      `).run(adminId, email.toLowerCase(), passwordHash, firstName || '', lastName || '', now, now);

      const roleRecord = db.prepare(`SELECT id FROM roles WHERE name = ?`).get(role);
      db.prepare(`
        INSERT INTO user_roles (user_id, role_id, assigned_by, assigned_at)
        VALUES (?, ?, ?, ?)
      `).run(adminId, roleRecord.id, req.user.id, now);
    })();

    auditService.logAdminAction({
      actorId: req.user.id,
      actorEmail: req.user.email,
      actionType: 'admin.create',
      targetResource: 'admin_user',
      targetId: adminId,
      outcome: 'success',
      details: { email, role, firstName, lastName }
    });

    res.status(201).json({
      success: true,
      message: `Administrator ${email} created with role ${role}.`,
      admin: { id: adminId, email, role, firstName, lastName }
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/admin/admins/:userId/role
router.patch('/admins/:userId/role', requireSuperAdmin, (req, res, next) => {
  try {
    const { role } = req.body;
    const targetUserId = req.params.userId;

    if (!['super_admin', 'support_admin', 'auditor'].includes(role)) {
      return res.status(400).json({ error: { message: 'Invalid admin role specified.' } });
    }

    rbacService.updateAdminRole(targetUserId, role, req.user);

    res.status(200).json({
      success: true,
      message: `Administrator role updated to ${role}.`
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/admin/admins/:userId
router.delete('/admins/:userId', requireSuperAdmin, (req, res, next) => {
  try {
    const targetUserId = req.params.userId;
    // Revoke admin roles
    rbacService.revokeRole(targetUserId, 'super_admin', req.user);
    rbacService.revokeRole(targetUserId, 'support_admin', req.user);
    rbacService.revokeRole(targetUserId, 'auditor', req.user);

    // Assign standard user role
    rbacService.assignRole(targetUserId, 'user', req.user.id);

    auditService.logAdminAction({
      actorId: req.user.id,
      actorEmail: req.user.email,
      actionType: 'admin.revoke',
      targetResource: 'admin_user',
      targetId: targetUserId,
      outcome: 'success',
      details: { message: 'All administrative privileges revoked' }
    });

    res.status(200).json({
      success: true,
      message: 'Administrative privileges revoked successfully.'
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
