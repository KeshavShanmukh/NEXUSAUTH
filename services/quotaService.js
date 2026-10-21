const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../db/database');
const auditService = require('./auditService');

class QuotaService {
  constructor(db = null) {
    this.db = db || getDatabase();
  }

  getCurrentPeriod(userId) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();

    let period = this.db.prepare(`
      SELECT * FROM quota_periods
      WHERE user_id = ? AND start_date = ?
    `).get(userId, startOfMonth);

    if (!period) {
      const periodId = `qp_${userId}_${startOfMonth.substring(0, 10)}`;
      this.db.prepare(`
        INSERT OR IGNORE INTO quota_periods (id, user_id, start_date, end_date, status, created_at)
        VALUES (?, ?, ?, ?, 'active', ?)
      `).run(periodId, userId, startOfMonth, endOfMonth, now.toISOString());

      period = this.db.prepare(`SELECT * FROM quota_periods WHERE id = ?`).get(periodId);
    }

    return period;
  }

  getUserPlan(userId) {
    const sub = this.db.prepare(`
      SELECT us.*, sp.name as plan_name
      FROM user_subscriptions us
      JOIN subscription_plans sp ON us.plan_id = sp.id
      WHERE us.user_id = ?
    `).get(userId);

    if (!sub) {
      return { plan_id: 'free', plan_name: 'Free Tier' };
    }
    return sub;
  }

  getFeatureLimit(userId, featureName) {
    const plan = this.getUserPlan(userId);
    const planId = plan.plan_id || 'free';

    const ent = this.db.prepare(`
      SELECT monthly_limit, daily_limit, is_enabled
      FROM feature_entitlements
      WHERE plan_id = ? AND feature_name = ?
    `).get(planId, featureName);

    if (!ent) {
      // Default fallback
      return { monthlyLimit: 5, dailyLimit: -1, isEnabled: true };
    }

    return {
      monthlyLimit: ent.monthly_limit,
      dailyLimit: ent.daily_limit,
      isEnabled: Boolean(ent.is_enabled)
    };
  }

  /**
   * Concurrency-Safe Check and Consume
   * Executed within an atomic SQLite transaction so race conditions cannot bypass limits.
   */
  checkAndConsumeQuota(userId, featureName, units = 1) {
    const now = new Date().toISOString();
    const period = this.getCurrentPeriod(userId);
    const ent = this.getFeatureLimit(userId, featureName);

    if (!ent.isEnabled) {
      return {
        allowed: false,
        reason: 'feature_disabled',
        message: `Feature ${featureName} is not available on your current plan. Please upgrade to access it.`
      };
    }

    // Execute atomic check and consume
    const executeAtomicConsume = this.db.transaction(() => {
      // Fetch or insert summary
      let summary = this.db.prepare(`
        SELECT * FROM usage_summaries
        WHERE user_id = ? AND quota_period_id = ? AND feature_name = ?
      `).get(userId, period.id, featureName);

      if (!summary) {
        const summaryId = `us_${uuidv4()}`;
        this.db.prepare(`
          INSERT INTO usage_summaries (id, user_id, quota_period_id, feature_name, units_used, created_at, updated_at)
          VALUES (?, ?, ?, ?, 0, ?, ?)
        `).run(summaryId, userId, period.id, featureName, now, now);

        summary = this.db.prepare(`SELECT * FROM usage_summaries WHERE id = ?`).get(summaryId);
      }

      // Check effective limit (admin override limit takes precedence if set)
      const effectiveLimit = summary.override_limit !== null ? summary.override_limit : ent.monthlyLimit;
      const currentUsed = summary.units_used;

      // -1 represents unlimited
      if (effectiveLimit !== -1 && (currentUsed + units) > effectiveLimit) {
        return {
          allowed: false,
          reason: 'quota_exhausted',
          featureName,
          used: currentUsed,
          limit: effectiveLimit,
          remaining: Math.max(0, effectiveLimit - currentUsed),
          resetDate: period.end_date,
          message: `Monthly quota exceeded for ${featureName}. Used ${currentUsed}/${effectiveLimit}. Quota resets on ${new Date(period.end_date).toLocaleDateString()}.`
        };
      }

      // Increment quota used
      const newUsed = currentUsed + units;
      this.db.prepare(`
        UPDATE usage_summaries
        SET units_used = ?, updated_at = ?
        WHERE id = ?
      `).run(newUsed, now, summary.id);

      return {
        allowed: true,
        featureName,
        used: newUsed,
        limit: effectiveLimit,
        remaining: effectiveLimit === -1 ? -1 : Math.max(0, effectiveLimit - newUsed),
        resetDate: period.end_date
      };
    });

    return executeAtomicConsume();
  }

  /**
   * Refunds quota if an operation failed after quota consumption
   */
  refundQuota(userId, featureName, units = 1) {
    const period = this.getCurrentPeriod(userId);
    const now = new Date().toISOString();

    this.db.prepare(`
      UPDATE usage_summaries
      SET units_used = MAX(0, units_used - ?), updated_at = ?
      WHERE user_id = ? AND quota_period_id = ? AND feature_name = ?
    `).run(units, now, userId, period.id, featureName);
  }

  getUserQuotas(userId) {
    const period = this.getCurrentPeriod(userId);
    const plan = this.getUserPlan(userId);
    const planId = plan.plan_id || 'free';

    // Fetch all entitlements for user's plan
    const entitlements = this.db.prepare(`
      SELECT feature_name, monthly_limit, daily_limit, is_enabled
      FROM feature_entitlements
      WHERE plan_id = ?
    `).all(planId);

    // Fetch user's actual summaries for current period
    const summaries = this.db.prepare(`
      SELECT feature_name, units_used, override_limit
      FROM usage_summaries
      WHERE user_id = ? AND quota_period_id = ?
    `).all(userId, period.id);

    const summaryMap = new Map();
    for (const s of summaries) {
      summaryMap.set(s.feature_name, s);
    }

    const quotas = entitlements.map(e => {
      const s = summaryMap.get(e.feature_name);
      const used = s ? s.units_used : 0;
      const effectiveLimit = (s && s.override_limit !== null) ? s.override_limit : e.monthly_limit;
      const remaining = effectiveLimit === -1 ? -1 : Math.max(0, effectiveLimit - used);
      const percentUsed = effectiveLimit === -1 ? 0 : Math.min(100, Math.round((used / effectiveLimit) * 100));

      return {
        featureName: e.feature_name,
        used,
        limit: effectiveLimit,
        isOverride: Boolean(s && s.override_limit !== null),
        remaining,
        percentUsed,
        isEnabled: Boolean(e.is_enabled)
      };
    });

    return {
      userId,
      plan: {
        id: plan.plan_id || 'free',
        name: plan.plan_name || 'Free Tier',
        status: plan.status || 'active'
      },
      period: {
        startDate: period.start_date,
        endDate: period.end_date
      },
      quotas
    };
  }

  overrideUserQuota({ userId, featureName, newLimit, reason, adminUser }) {
    if (newLimit === undefined || newLimit === null || !featureName || !reason) {
      throw new Error('featureName, newLimit, and reason are required');
    }

    const period = this.getCurrentPeriod(userId);
    const now = new Date().toISOString();

    let prevLimit = null;
    let summary = this.db.prepare(`
      SELECT * FROM usage_summaries
      WHERE user_id = ? AND quota_period_id = ? AND feature_name = ?
    `).get(userId, period.id, featureName);

    if (summary) {
      prevLimit = summary.override_limit !== null ? summary.override_limit : this.getFeatureLimit(userId, featureName).monthlyLimit;
    } else {
      prevLimit = this.getFeatureLimit(userId, featureName).monthlyLimit;
    }

    this.db.transaction(() => {
      if (summary) {
        this.db.prepare(`
          UPDATE usage_summaries
          SET override_limit = ?, updated_at = ?
          WHERE id = ?
        `).run(newLimit, now, summary.id);
      } else {
        const summaryId = `us_${uuidv4()}`;
        this.db.prepare(`
          INSERT INTO usage_summaries (id, user_id, quota_period_id, feature_name, units_used, override_limit, created_at, updated_at)
          VALUES (?, ?, ?, ?, 0, ?, ?, ?)
        `).run(summaryId, userId, period.id, featureName, newLimit, now, now);
      }

      // Record quota adjustment record
      const adjId = `qadj_${uuidv4()}`;
      this.db.prepare(`
        INSERT INTO quota_adjustments (id, user_id, feature_name, previous_limit, new_limit, reason, adjusted_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(adjId, userId, featureName, prevLimit, newLimit, reason, adminUser.id, now);
    })();

    // Audit log
    auditService.logAdminAction({
      actorId: adminUser.id,
      actorEmail: adminUser.email,
      actionType: 'user.quota_override',
      targetResource: 'user_quota',
      targetId: userId,
      outcome: 'success',
      details: {
        featureName,
        previousLimit: prevLimit,
        newLimit,
        reason
      }
    });

    return {
      success: true,
      featureName,
      previousLimit: prevLimit,
      newLimit,
      reason
    };
  }
}

module.exports = new QuotaService();
