const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../db/database');

/**
 * Sanitizes metadata so passwords, tokens, API keys or secret contents are never stored in audit logs.
 */
function sanitizeAuditPayload(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const sanitized = Array.isArray(obj) ? [] : {};
  const sensitiveKeys = ['password', 'password_hash', 'token', 'secret', 'mfa_secret', 'apiKey', 'authorization'];

  for (const [key, value] of Object.entries(obj)) {
    if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeAuditPayload(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

class AuditService {
  constructor(db = null) {
    this.db = db || getDatabase();
  }

  logAdminAction({
    actorId,
    actorEmail,
    actionType,
    targetResource,
    targetId = null,
    correlationId = null,
    outcome = 'success',
    ipAddress = '',
    details = {}
  }) {
    const id = `aud_${uuidv4()}`;
    const now = new Date().toISOString();
    const corrId = correlationId || `corr_${uuidv4()}`;
    const sanitizedDetails = JSON.stringify(sanitizeAuditPayload(details));

    const stmt = this.db.prepare(`
      INSERT INTO admin_audit_events (
        id, actor_id, actor_email, action_type, target_resource,
        target_id, correlation_id, outcome, ip_address, details, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      actorId || 'system',
      actorEmail || 'system@platform.local',
      actionType,
      targetResource,
      targetId,
      corrId,
      outcome,
      ipAddress || '127.0.0.1',
      sanitizedDetails,
      now
    );

    return {
      id,
      correlationId: corrId,
      createdAt: now
    };
  }

  getAuditLogs({ limit = 50, offset = 0, actorId = null, actionType = null, outcome = null, search = null }) {
    let sql = `SELECT * FROM admin_audit_events WHERE 1=1`;
    const params = [];

    if (actorId) {
      sql += ` AND actor_id = ?`;
      params.push(actorId);
    }
    if (actionType) {
      sql += ` AND action_type = ?`;
      params.push(actionType);
    }
    if (outcome) {
      sql += ` AND outcome = ?`;
      params.push(outcome);
    }
    if (search) {
      sql += ` AND (actor_email LIKE ? OR target_resource LIKE ? OR action_type LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    // Count query
    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
    const countStmt = this.db.prepare(countSql);
    const { total } = countStmt.get(...params);

    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params);

    const logs = rows.map(r => ({
      ...r,
      details: (() => {
        try {
          return JSON.parse(r.details);
        } catch {
          return r.details;
        }
      })()
    }));

    return {
      total,
      limit,
      offset,
      logs
    };
  }
}

module.exports = new AuditService();
