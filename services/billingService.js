const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../db/database');
const config = require('../config');
const auditService = require('./auditService');

class BillingService {
  constructor(db = null) {
    this.db = db || getDatabase();
  }

  getPlans() {
    const plans = this.db.prepare(`
      SELECT * FROM subscription_plans WHERE is_active = 1 ORDER BY price_monthly_cents ASC
    `).all();

    const entitlements = this.db.prepare(`SELECT * FROM feature_entitlements`).all();
    const entMap = {};
    for (const ent of entitlements) {
      if (!entMap[ent.plan_id]) entMap[ent.plan_id] = [];
      entMap[ent.plan_id].push({
        featureName: ent.feature_name,
        monthlyLimit: ent.monthly_limit,
        dailyLimit: ent.daily_limit,
        isEnabled: Boolean(ent.is_enabled)
      });
    }

    return plans.map(p => ({
      ...p,
      entitlements: entMap[p.id] || []
    }));
  }

  getPlan(planId) {
    const plan = this.db.prepare(`SELECT * FROM subscription_plans WHERE id = ?`).get(planId);
    if (!plan) return null;

    const entitlements = this.db.prepare(`
      SELECT * FROM feature_entitlements WHERE plan_id = ?
    `).all(planId);

    return {
      ...plan,
      entitlements
    };
  }

  updatePlan(planId, { name, description, priceMonthlyCents, entitlements }, adminUser) {
    const plan = this.db.prepare(`SELECT * FROM subscription_plans WHERE id = ?`).get(planId);
    if (!plan) {
      const err = new Error('Plan not found');
      err.statusCode = 404;
      throw err;
    }

    const now = new Date().toISOString();

    this.db.transaction(() => {
      this.db.prepare(`
        UPDATE subscription_plans
        SET name = COALESCE(?, name),
            description = COALESCE(?, description),
            price_monthly_cents = COALESCE(?, price_monthly_cents),
            updated_at = ?
        WHERE id = ?
      `).run(
        name !== undefined ? name : null,
        description !== undefined ? description : null,
        priceMonthlyCents !== undefined ? priceMonthlyCents : null,
        now,
        planId
      );

      if (Array.isArray(entitlements)) {
        for (const ent of entitlements) {
          this.db.prepare(`
            UPDATE feature_entitlements
            SET monthly_limit = COALESCE(?, monthly_limit),
                daily_limit = COALESCE(?, daily_limit),
                is_enabled = COALESCE(?, is_enabled)
            WHERE plan_id = ? AND feature_name = ?
          `).run(
            ent.monthlyLimit !== undefined ? ent.monthlyLimit : null,
            ent.dailyLimit !== undefined ? ent.dailyLimit : null,
            ent.isEnabled !== undefined ? (ent.isEnabled ? 1 : 0) : null,
            planId,
            ent.featureName
          );
        }
      }
    })();

    auditService.logAdminAction({
      actorId: adminUser.id,
      actorEmail: adminUser.email,
      actionType: 'plan.update',
      targetResource: 'subscription_plan',
      targetId: planId,
      outcome: 'success',
      details: { planId, name, priceMonthlyCents, entitlementsCount: entitlements ? entitlements.length : 0 }
    });

    return this.getPlan(planId);
  }

  createCheckoutSession(userId, planId) {
    const plan = this.getPlan(planId);
    if (!plan) {
      const err = new Error('Invalid plan selected');
      err.statusCode = 400;
      throw err;
    }

    const sessionId = `cs_${uuidv4()}`;
    return {
      sessionId,
      planId: plan.id,
      planName: plan.name,
      amountCents: plan.price_monthly_cents,
      currency: 'usd',
      checkoutUrl: `/checkout?session_id=${sessionId}&plan=${planId}`,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
    };
  }

  verifyWebhookSignature(rawBody, signatureHeader) {
    if (!signatureHeader || !rawBody) return false;
    const computed = crypto.createHmac('sha256', config.webhookSecret).update(rawBody).digest('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(computed));
    } catch {
      return false;
    }
  }

  processWebhookEvent(eventPayload, signatureHeader = null) {
    const eventId = eventPayload.id || `evt_${uuidv4()}`;
    const eventType = eventPayload.type;

    // 1. Idempotency check: prevent duplicate webhook execution
    const existing = this.db.prepare(`SELECT * FROM processed_webhooks WHERE event_id = ?`).get(eventId);
    if (existing) {
      return { status: 'already_processed', eventId };
    }

    const now = new Date().toISOString();
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59, 999).toISOString();

    this.db.transaction(() => {
      // Record webhook event
      this.db.prepare(`
        INSERT INTO processed_webhooks (id, event_id, event_type, status, payload, created_at)
        VALUES (?, ?, ?, 'processed', ?, ?)
      `).run(`pwh_${uuidv4()}`, eventId, eventType, JSON.stringify(eventPayload), now);

      // Handle specific billing events
      if (eventType === 'checkout.session.completed' || eventType === 'invoice.payment_succeeded') {
        const { userId, planId } = eventPayload.data || {};
        if (userId && planId) {
          this.db.prepare(`
            INSERT INTO user_subscriptions (id, user_id, plan_id, status, current_period_start, current_period_end, created_at, updated_at)
            VALUES (?, ?, ?, 'active', ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
              plan_id = excluded.plan_id,
              status = 'active',
              current_period_start = excluded.current_period_start,
              current_period_end = excluded.current_period_end,
              updated_at = excluded.updated_at
          `).run(`sub_${uuidv4()}`, userId, planId, startOfMonth, endOfMonth, now, now);
        }
      } else if (eventType === 'customer.subscription.deleted') {
        const { userId } = eventPayload.data || {};
        if (userId) {
          // Downgrade to free tier
          this.db.prepare(`
            UPDATE user_subscriptions
            SET plan_id = 'free', status = 'active', updated_at = ?
            WHERE user_id = ?
          `).run(now, userId);
        }
      }
    })();

    return { status: 'processed', eventId };
  }

  cancelSubscription(userId) {
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE user_subscriptions
      SET cancel_at_period_end = 1, updated_at = ?
      WHERE user_id = ?
    `).run(now, userId);

    return { success: true, message: 'Subscription will be canceled at the end of the current billing period.' };
  }
}

module.exports = new BillingService();
