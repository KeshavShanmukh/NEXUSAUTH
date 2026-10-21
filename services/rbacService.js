const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../db/database');
const auditService = require('./auditService');

class RbacService {
  constructor(db = null) {
    this.db = db || getDatabase();
  }

  getUserRoles(userId) {
    const stmt = this.db.prepare(`
      SELECT r.id, r.name, r.description, ur.assigned_at
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = ?
    `);
    return stmt.all(userId);
  }

  getUserPermissions(userId) {
    const stmt = this.db.prepare(`
      SELECT DISTINCT p.id, p.name, p.description
      FROM user_roles ur
      JOIN role_permissions rp ON ur.role_id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE ur.user_id = ?
    `);
    return stmt.all(userId);
  }

  hasPermission(userId, permissionName) {
    const permissions = this.getUserPermissions(userId);
    return permissions.some(p => p.name === permissionName);
  }

  hasRole(userId, roleName) {
    const roles = this.getUserRoles(userId);
    return roles.some(r => r.name === roleName);
  }

  isAdmin(userId) {
    const roles = this.getUserRoles(userId);
    const adminRoles = ['super_admin', 'support_admin', 'auditor'];
    return roles.some(r => adminRoles.includes(r.name));
  }

  isSuperAdmin(userId) {
    return this.hasRole(userId, 'super_admin');
  }

  countActiveSuperAdmins() {
    const stmt = this.db.prepare(`
      SELECT COUNT(DISTINCT u.id) as count
      FROM users u
      JOIN user_roles ur ON u.id = ur.user_id
      JOIN roles r ON ur.role_id = r.id
      WHERE r.name = 'super_admin' AND u.status = 'active'
    `);
    const res = stmt.get();
    return res ? res.count : 0;
  }

  listRoles() {
    const stmt = this.db.prepare(`SELECT * FROM roles ORDER BY name ASC`);
    return stmt.all();
  }

  listPermissions() {
    const stmt = this.db.prepare(`SELECT * FROM permissions ORDER BY name ASC`);
    return stmt.all();
  }

  listAdmins() {
    const stmt = this.db.prepare(`
      SELECT DISTINCT u.id, u.email, u.first_name, u.last_name, u.status, u.created_at, u.last_login_at,
             GROUP_CONCAT(r.name) as role_names
      FROM users u
      JOIN user_roles ur ON u.id = ur.user_id
      JOIN roles r ON ur.role_id = r.id
      WHERE r.name IN ('super_admin', 'support_admin', 'auditor')
      GROUP BY u.id
      ORDER BY u.created_at ASC
    `);
    const rows = stmt.all();
    return rows.map(r => ({
      ...r,
      roles: r.role_names ? r.role_names.split(',') : []
    }));
  }

  assignRole(userId, roleNameOrId, assignedBy = 'system') {
    // Resolve role ID
    const roleStmt = this.db.prepare(`SELECT * FROM roles WHERE id = ? OR name = ?`);
    const role = roleStmt.get(roleNameOrId, roleNameOrId);
    if (!role) {
      throw new Error(`Role "${roleNameOrId}" not found`);
    }

    const now = new Date().toISOString();
    const insertStmt = this.db.prepare(`
      INSERT OR REPLACE INTO user_roles (user_id, role_id, assigned_by, assigned_at)
      VALUES (?, ?, ?, ?)
    `);
    insertStmt.run(userId, role.id, assignedBy, now);
    return true;
  }

  revokeRole(userId, roleNameOrId, revokedByAdmin) {
    const roleStmt = this.db.prepare(`SELECT * FROM roles WHERE id = ? OR name = ?`);
    const role = roleStmt.get(roleNameOrId, roleNameOrId);
    if (!role) {
      throw new Error(`Role "${roleNameOrId}" not found`);
    }

    // Safety guard: Cannot demote or remove the last active super admin!
    if (role.name === 'super_admin') {
      const activeSuperAdmins = this.countActiveSuperAdmins();
      if (activeSuperAdmins <= 1 && this.isSuperAdmin(userId)) {
        throw new Error('Cannot revoke super_admin role: Platform must have at least one active Super Administrator.');
      }
    }

    const deleteStmt = this.db.prepare(`
      DELETE FROM user_roles WHERE user_id = ? AND role_id = ?
    `);
    deleteStmt.run(userId, role.id);

    return true;
  }

  updateAdminRole(targetUserId, newRoleName, actorAdmin) {
    // Check if target user is super admin and being demoted
    if (this.isSuperAdmin(targetUserId) && newRoleName !== 'super_admin') {
      const activeCount = this.countActiveSuperAdmins();
      if (activeCount <= 1) {
        throw new Error('Cannot demote the last active Super Administrator.');
      }
    }

    const roleStmt = this.db.prepare(`SELECT * FROM roles WHERE name = ?`);
    const targetRole = roleStmt.get(newRoleName);
    if (!targetRole) {
      throw new Error(`Target role "${newRoleName}" is invalid.`);
    }

    this.db.transaction(() => {
      // Remove all admin roles first
      const deleteRoles = this.db.prepare(`
        DELETE FROM user_roles
        WHERE user_id = ? AND role_id IN (SELECT id FROM roles WHERE name IN ('super_admin', 'support_admin', 'auditor'))
      `);
      deleteRoles.run(targetUserId);

      // Assign new role
      const now = new Date().toISOString();
      const insertRole = this.db.prepare(`
        INSERT INTO user_roles (user_id, role_id, assigned_by, assigned_at)
        VALUES (?, ?, ?, ?)
      `);
      insertRole.run(targetUserId, targetRole.id, actorAdmin.id, now);
    })();

    auditService.logAdminAction({
      actorId: actorAdmin.id,
      actorEmail: actorAdmin.email,
      actionType: 'admin.role_change',
      targetResource: 'admin_user',
      targetId: targetUserId,
      outcome: 'success',
      details: { newRole: newRoleName }
    });

    return true;
  }
}

module.exports = new RbacService();
