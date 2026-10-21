const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('./database');
const { runMigrations } = require('./migrate');
const config = require('../config');

function seedDatabase(dbInstance = null) {
  const db = dbInstance || getDatabase();
  runMigrations(db);

  const now = new Date().toISOString();
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59, 999).toISOString();

  const insertRole = db.prepare(`
    INSERT OR IGNORE INTO roles (id, name, description, is_system, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertPerm = db.prepare(`
    INSERT OR IGNORE INTO permissions (id, name, description, created_at)
    VALUES (?, ?, ?, ?)
  `);

  const insertRolePerm = db.prepare(`
    INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
    VALUES (?, ?)
  `);

  const insertPlan = db.prepare(`
    INSERT OR IGNORE INTO subscription_plans (id, name, description, price_monthly_cents, billing_cycle, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertEntitlement = db.prepare(`
    INSERT OR IGNORE INTO feature_entitlements (id, plan_id, feature_name, monthly_limit, daily_limit, is_enabled)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertPolicy = db.prepare(`
    INSERT OR IGNORE INTO usage_policies (id, version, feature_name, unit_name, allow_overage, overage_unit_cost_cents, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    // 1. Roles
    insertRole.run('role_super_admin', 'super_admin', 'Full access to all administrative features and configurations', 1, now);
    insertRole.run('role_support_admin', 'support_admin', 'Customer support admin: manage user accounts, status, and quotas', 1, now);
    insertRole.run('role_auditor', 'auditor', 'Read-only access to logs, reports, and platform analytics', 1, now);
    insertRole.run('role_user', 'user', 'Standard end-user access to personal resumes and quota features', 1, now);

    // 2. Permissions
    const permissions = [
      { id: 'perm_users_read', name: 'users:read', desc: 'View registered users list and profiles' },
      { id: 'perm_users_manage', name: 'users:manage', desc: 'Enable, suspend, or reactivate user accounts' },
      { id: 'perm_users_delete', name: 'users:delete', desc: 'Delete user accounts and purge data' },
      { id: 'perm_admins_manage', name: 'admins:manage', desc: 'Create, modify, and revoke administrator privileges' },
      { id: 'perm_quotas_manage', name: 'quotas:manage', desc: 'Modify and override user usage quotas' },
      { id: 'perm_plans_manage', name: 'plans:manage', desc: 'Configure subscription tiers and feature limits' },
      { id: 'perm_audit_read', name: 'audit:read', desc: 'View system and administrative audit logs' },
      { id: 'perm_analytics_read', name: 'analytics:read', desc: 'View aggregated usage analytics and trends' },
      { id: 'perm_features_use', name: 'features:use', desc: 'Consume platform features (resume, AI, etc.)' }
    ];

    for (const p of permissions) {
      insertPerm.run(p.id, p.name, p.desc, now);
    }

    // 3. Assign Role Permissions
    // Super Admin: all permissions
    for (const p of permissions) {
      insertRolePerm.run('role_super_admin', p.id);
    }
    // Support Admin: users read/manage, quotas manage, audit read, analytics read
    const supportPerms = ['perm_users_read', 'perm_users_manage', 'perm_quotas_manage', 'perm_audit_read', 'perm_analytics_read'];
    for (const sp of supportPerms) {
      insertRolePerm.run('role_support_admin', sp);
    }
    // Auditor: audit read, analytics read, users read
    const auditorPerms = ['perm_users_read', 'perm_audit_read', 'perm_analytics_read'];
    for (const ap of auditorPerms) {
      insertRolePerm.run('role_auditor', ap);
    }
    // Normal User: features:use
    insertRolePerm.run('role_user', 'perm_features_use');

    // 4. Subscription Plans
    insertPlan.run('free', 'Free Tier', 'Essential resume builder and core analysis features', 0, 'monthly', 1, now, now);
    insertPlan.run('premium', 'Premium Pro', 'Enhanced limits, AI optimization, and priority matching', 2900, 'monthly', 1, now, now);
    insertPlan.run('enterprise', 'Enterprise Unlimited', 'Unlimited AI requests, team access, and dedicated support', 9900, 'monthly', 1, now, now);

    // 5. Feature Entitlements (Exact examples from Section D)
    const planEntitlements = [
      // Free Plan
      { plan: 'free', feature: 'resume_creation', monthly: 3 },
      { plan: 'free', feature: 'resume_analysis', monthly: 5 },
      { plan: 'free', feature: 'linkedin_analysis', monthly: 3 },
      { plan: 'free', feature: 'job_matching', monthly: 5 },
      { plan: 'free', feature: 'ai_suggestions', monthly: 20 },
      { plan: 'free', feature: 'pdf_exports', monthly: 5 },
      { plan: 'free', feature: 'docx_exports', monthly: 2 },
      { plan: 'free', feature: 'interview_practice', monthly: 1 },

      // Premium Plan
      { plan: 'premium', feature: 'resume_creation', monthly: 50 },
      { plan: 'premium', feature: 'resume_analysis', monthly: 100 },
      { plan: 'premium', feature: 'linkedin_analysis', monthly: 50 },
      { plan: 'premium', feature: 'job_matching', monthly: 100 },
      { plan: 'premium', feature: 'ai_suggestions', monthly: 500 },
      { plan: 'premium', feature: 'pdf_exports', monthly: 100 },
      { plan: 'premium', feature: 'docx_exports', monthly: 50 },
      { plan: 'premium', feature: 'interview_practice', monthly: 20 },

      // Enterprise Plan (Unlimited = -1)
      { plan: 'enterprise', feature: 'resume_creation', monthly: -1 },
      { plan: 'enterprise', feature: 'resume_analysis', monthly: -1 },
      { plan: 'enterprise', feature: 'linkedin_analysis', monthly: -1 },
      { plan: 'enterprise', feature: 'job_matching', monthly: -1 },
      { plan: 'enterprise', feature: 'ai_suggestions', monthly: -1 },
      { plan: 'enterprise', feature: 'pdf_exports', monthly: -1 },
      { plan: 'enterprise', feature: 'docx_exports', monthly: -1 },
      { plan: 'enterprise', feature: 'interview_practice', monthly: -1 }
    ];

    for (const pe of planEntitlements) {
      insertEntitlement.run(
        `ent_${pe.plan}_${pe.feature}`,
        pe.plan,
        pe.feature,
        pe.monthly,
        -1,
        1
      );
    }

    // 6. Usage Policies
    const features = [
      'resume_creation', 'resume_analysis', 'linkedin_analysis', 'job_matching',
      'ai_suggestions', 'pdf_exports', 'docx_exports', 'interview_practice'
    ];

    for (const feat of features) {
      insertPolicy.run(
        `policy_${feat}`,
        'v1',
        feat,
        'operation',
        0,
        0,
        1,
        now
      );
    }

    // 7. Seed Users & Administrators
    const saltRounds = 10;
    const adminHash = bcrypt.hashSync(config.adminInitialPassword, saltRounds);
    const userHash = bcrypt.hashSync('UserPassword123!', saltRounds);

    const insertUser = db.prepare(`
      INSERT OR IGNORE INTO users (id, email, password_hash, first_name, last_name, status, email_verified, created_at, updated_at, last_login_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertUserRole = db.prepare(`
      INSERT OR IGNORE INTO user_roles (user_id, role_id, assigned_by, assigned_at)
      VALUES (?, ?, ?, ?)
    `);

    const insertSubscription = db.prepare(`
      INSERT OR IGNORE INTO user_subscriptions (id, user_id, plan_id, status, current_period_start, current_period_end, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertQuotaPeriod = db.prepare(`
      INSERT OR IGNORE INTO quota_periods (id, user_id, start_date, end_date, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    // A) Super Admin
    const superAdminId = 'usr_super_admin_001';
    insertUser.run(
      superAdminId,
      config.adminInitialEmail,
      adminHash,
      'System',
      'Administrator',
      'active',
      1,
      now,
      now,
      now
    );
    insertUserRole.run(superAdminId, 'role_super_admin', 'system', now);

    // B) Support Admin
    const supportAdminId = 'usr_support_admin_002';
    insertUser.run(
      supportAdminId,
      'support@platform.local',
      adminHash,
      'Support',
      'Lead',
      'active',
      1,
      now,
      now,
      now
    );
    insertUserRole.run(supportAdminId, 'role_support_admin', superAdminId, now);

    // C) Auditor
    const auditorId = 'usr_auditor_003';
    insertUser.run(
      auditorId,
      'auditor@platform.local',
      adminHash,
      'Compliance',
      'Auditor',
      'active',
      1,
      now,
      now,
      now
    );
    insertUserRole.run(auditorId, 'role_auditor', superAdminId, now);

    // D) Free User
    const freeUserId = 'usr_demo_free_user_101';
    insertUser.run(
      freeUserId,
      'freeuser@example.com',
      userHash,
      'Alex',
      'Taylor',
      'active',
      1,
      now,
      now,
      now
    );
    insertUserRole.run(freeUserId, 'role_user', 'system', now);
    insertSubscription.run('sub_free_101', freeUserId, 'free', 'active', startOfMonth, endOfMonth, now, now);
    const freePeriodId = `qp_${freeUserId}_${startOfMonth.substring(0, 10)}`;
    insertQuotaPeriod.run(freePeriodId, freeUserId, startOfMonth, endOfMonth, 'active', now);

    // D.1 Seed some initial usage for Free User (e.g. 1 resume created, 1 analysis, 1 export)
    const insertSummary = db.prepare(`
      INSERT OR IGNORE INTO usage_summaries (id, user_id, quota_period_id, feature_name, units_used, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertSummary.run(`us_${freeUserId}_resume_creation`, freeUserId, freePeriodId, 'resume_creation', 1, now, now);
    insertSummary.run(`us_${freeUserId}_resume_analysis`, freeUserId, freePeriodId, 'resume_analysis', 1, now, now);
    insertSummary.run(`us_${freeUserId}_pdf_exports`, freeUserId, freePeriodId, 'pdf_exports', 1, now, now);

    // E) Premium User
    const premiumUserId = 'usr_demo_premium_user_102';
    insertUser.run(
      premiumUserId,
      'premiumuser@example.com',
      userHash,
      'Elena',
      'Rostova',
      'active',
      1,
      now,
      now,
      now
    );
    insertUserRole.run(premiumUserId, 'role_user', 'system', now);
    insertSubscription.run('sub_prem_102', premiumUserId, 'premium', 'active', startOfMonth, endOfMonth, now, now);
    const premPeriodId = `qp_${premiumUserId}_${startOfMonth.substring(0, 10)}`;
    insertQuotaPeriod.run(premPeriodId, premiumUserId, startOfMonth, endOfMonth, 'active', now);

    // F) Suspended User
    const suspendedUserId = 'usr_demo_suspended_user_103';
    insertUser.run(
      suspendedUserId,
      'suspendeduser@example.com',
      userHash,
      'Jordan',
      'Belfort',
      'suspended',
      1,
      now,
      now,
      null
    );
    insertUserRole.run(suspendedUserId, 'role_user', 'system', now);
    insertSubscription.run('sub_susp_103', suspendedUserId, 'free', 'active', startOfMonth, endOfMonth, now, now);

    // 8. Seed Sample Resumes for Free User
    const insertResume = db.prepare(`
      INSERT OR IGNORE INTO resumes (id, user_id, title, target_role, content, status, pdf_exports_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const sampleResumeId = 'res_sample_alex_001';
    insertResume.run(
      sampleResumeId,
      freeUserId,
      'Full Stack Software Engineer 2026',
      'Senior Full Stack Engineer',
      JSON.stringify({
        summary: 'Experienced full stack engineer specializing in Node.js, TypeScript, microservices, and AI integrations.',
        skills: ['JavaScript', 'Node.js', 'React', 'Docker', 'PostgreSQL', 'System Architecture'],
        experience: [
          { company: 'CloudScale Inc', role: 'Staff Engineer', duration: '2023 - Present', highlights: ['Led backend revamp with 99.99% uptime'] }
        ]
      }),
      'published',
      1,
      now,
      now
    );

    // 9. Seed Sample Resume Analysis
    const insertAnalysis = db.prepare(`
      INSERT OR IGNORE INTO resume_analyses (id, resume_id, user_id, overall_score, ats_compatibility, strengths, improvements, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertAnalysis.run(
      'ana_sample_alex_001',
      sampleResumeId,
      freeUserId,
      88,
      94,
      JSON.stringify(['Strong action verbs', 'Quantifiable metrics in experience', 'Clear technical skill grouping']),
      JSON.stringify(['Add specific cloud certifications', 'Elaborate on open source contributions']),
      now
    );

    // 10. Seed Sample Usage Events to power platform analytics charts
    const insertUsageEvent = db.prepare(`
      INSERT OR IGNORE INTO usage_events (id, user_id, feature_name, status, correlation_id, units_consumed, ai_provider, ai_model, prompt_tokens, completion_tokens, total_tokens, estimated_cost, policy_version, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Sample events over the current week
    const sampleEvents = [
      { feat: 'resume_creation', status: 'success', prov: null, model: null, inTok: 0, outTok: 0, cost: 0.0, user: freeUserId },
      { feat: 'resume_analysis', status: 'success', prov: 'OpenAI', model: 'gpt-4o', inTok: 1250, outTok: 420, cost: 0.00835, user: freeUserId },
      { feat: 'pdf_exports', status: 'success', prov: null, model: null, inTok: 0, outTok: 0, cost: 0.0, user: freeUserId },
      { feat: 'job_matching', status: 'success', prov: 'Anthropic', model: 'claude-3-5-sonnet', inTok: 1800, outTok: 600, cost: 0.0144, user: premiumUserId },
      { feat: 'ai_suggestions', status: 'success', prov: 'Google', model: 'gemini-1.5-pro', inTok: 800, outTok: 350, cost: 0.00345, user: premiumUserId },
      { feat: 'resume_analysis', status: 'failed', prov: 'OpenAI', model: 'gpt-4o', inTok: 1200, outTok: 0, cost: 0.0, user: premiumUserId }
    ];

    for (let i = 0; i < sampleEvents.length; i++) {
      const ev = sampleEvents[i];
      insertUsageEvent.run(
        `ev_sample_${i + 1}`,
        ev.user,
        ev.feat,
        ev.status,
        `corr_${uuidv4()}`,
        ev.status === 'success' ? 1 : 0,
        ev.prov,
        ev.model,
        ev.inTok,
        ev.outTok,
        ev.inTok + ev.outTok,
        ev.cost,
        'v1',
        JSON.stringify({ simulated: true }),
        now
      );
    }

    // 11. Seed Admin Audit Log Event
    const insertAudit = db.prepare(`
      INSERT OR IGNORE INTO admin_audit_events (id, actor_id, actor_email, action_type, target_resource, target_id, correlation_id, outcome, ip_address, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertAudit.run(
      'aud_initial_provisioning',
      superAdminId,
      config.adminInitialEmail,
      'admin.system_init',
      'system',
      'init',
      `corr_${uuidv4()}`,
      'success',
      '127.0.0.1',
      JSON.stringify({ message: 'Initial platform administrator and default quota policies provisioned' }),
      now
    );
  })();

  return true;
}

if (require.main === module) {
  console.log('Seeding database with roles, permissions, policies, admins, and initial demo data...');
  seedDatabase();
  console.log('Database seeded successfully.');
  console.log('--------------------------------------------------');
  console.log(`Super Admin: ${config.adminInitialEmail} / ${config.adminInitialPassword}`);
  console.log('Support Admin: support@platform.local / SuperAdmin@2026Secure!');
  console.log('Auditor: auditor@platform.local / SuperAdmin@2026Secure!');
  console.log('Free User: freeuser@example.com / UserPassword123!');
  console.log('Premium User: premiumuser@example.com / UserPassword123!');
  console.log('Suspended User: suspendeduser@example.com / UserPassword123!');
  console.log('--------------------------------------------------');
}

module.exports = { seedDatabase };
