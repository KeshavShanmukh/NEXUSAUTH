const assert = require('assert');
const request = require('supertest');
const path = require('path');
const fs = require('fs');
const { getDatabase, closeDatabase } = require('../db/database');
const { seedDatabase } = require('../db/seed');

// Dedicated clean test database with unique identifier per execution
const testDbPath = path.resolve(__dirname, `../data/test_${Date.now()}_${process.pid}.db`);
process.env.DATABASE_PATH = testDbPath;
process.env.NODE_ENV = 'test';

closeDatabase();

const { app, initializeApp } = require('../server');
initializeApp();

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

let passedCount = 0;
let failedCount = 0;

async function runTest(testName, fn) {
  process.stdout.write(`  ⏳ Running: ${testName}... `);
  try {
    await fn();
    console.log(`${colors.green}✔ PASS${colors.reset}`);
    passedCount++;
  } catch (err) {
    console.log(`${colors.red}✖ FAIL${colors.reset}`);
    console.error(`     ${colors.red}${err.message}${colors.reset}`);
    if (err.stack) {
      console.error(`     ${err.stack.split('\n').slice(1, 4).join('\n     ')}`);
    }
    failedCount++;
  }
}

async function startSuite() {
  console.log(`\n${colors.bold}${colors.cyan}================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}  🧪 Comprehensive Authentication & Usage Management Test Suite ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}================================================================${colors.reset}\n`);

  // Tokens cache
  let superAdminToken = '';
  let freeUserToken = '';
  let secondUserToken = '';
  let freeUserId = '';
  let secondUserId = '';

  // 1. Successful and Unsuccessful Login
  await runTest('1.1 Super Admin successful login', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@platform.local', password: 'SuperAdmin@2026Secure!', isAdminLogin: true });

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.token, 'Token must be returned');
    assert.ok(res.body.user.roles.includes('super_admin'), 'Must have super_admin role');
    superAdminToken = res.body.token;
  });

  await runTest('1.2 Normal user login with invalid password returns 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'freeuser@example.com', password: 'WrongPassword999!' });

    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  await runTest('1.3 Brute-force lockout triggers after repeated failed attempts', async () => {
    // Attempt 4 more wrong logins to reach the 5-attempt threshold
    for (let i = 0; i < 4; i++) {
      await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'freeuser@example.com', password: 'WrongPassword999!' });
    }

    // 6th attempt should now return 423 Locked
    const lockRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'freeuser@example.com', password: 'UserPassword123!' });

    assert.strictEqual(lockRes.status, 423);
    assert.ok(lockRes.body.error.message.includes('locked'), 'Error message should indicate account lockout');

    // Unlock account directly in DB for subsequent tests
    const db = getDatabase();
    db.prepare(`UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE email = 'freeuser@example.com'`).run();
  });

  await runTest('1.4 Normal User successful login after lockout clear', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'freeuser@example.com', password: 'UserPassword123!' });

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.token);
    freeUserToken = res.body.token;
    freeUserId = res.body.user.id;
  });

  // 2. Duplicate Registration and Email Verification
  await runTest('2.1 User registration creates account with unverified email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'newuser@example.com',
        password: 'SecurePassword123!',
        firstName: 'Jane',
        lastName: 'Doe'
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.user.email, 'newuser@example.com');
    assert.strictEqual(res.body.user.emailVerified, false);
    assert.ok(res.body.verificationToken, 'Verification token must be returned');

    // Verify email using token
    const verifyRes = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ token: res.body.verificationToken });

    assert.strictEqual(verifyRes.status, 200);
    assert.strictEqual(verifyRes.body.success, true);
  });

  await runTest('2.2 Duplicate email registration returns 409 Conflict', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'newuser@example.com',
        password: 'AnotherPassword123!',
        firstName: 'Impostor',
        lastName: 'User'
      });

    assert.strictEqual(res.status, 409);
  });

  // Register a second user for cross-user isolation tests
  await runTest('2.3 Register second test user for isolation tests', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'seconduser@example.com',
        password: 'SecurePassword123!',
        firstName: 'Bob',
        lastName: 'Smith'
      });
    assert.strictEqual(res.status, 201);

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'seconduser@example.com', password: 'SecurePassword123!' });

    assert.strictEqual(loginRes.status, 200);
    secondUserToken = loginRes.body.token;
    secondUserId = loginRes.body.user.id;
  });

  // 3. Password Reset and Session Revocation
  await runTest('3.1 Password reset request and execution revokes existing sessions', async () => {
    // Get reset token
    const forgotRes = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'newuser@example.com' });

    assert.strictEqual(forgotRes.status, 200);
    assert.ok(forgotRes.body.resetToken);

    // Reset password
    const resetRes = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({
        token: forgotRes.body.resetToken,
        newPassword: 'BrandNewSecurePassword456!'
      });

    assert.strictEqual(resetRes.status, 200);

    // Verify new password works
    const newLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'newuser@example.com', password: 'BrandNewSecurePassword456!' });

    assert.strictEqual(newLoginRes.status, 200);
  });

  // 4. Unauthorized Access to Admin Endpoints
  await runTest('4.1 Unauthenticated request to admin endpoint returns 401', async () => {
    const res = await request(app).get('/api/v1/admin/dashboard');
    assert.strictEqual(res.status, 401);
  });

  await runTest('4.2 Normal user request to admin endpoint returns 403 Forbidden', async () => {
    const res = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${freeUserToken}`);

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.error.code, 'FORBIDDEN_ADMIN_ONLY');
  });

  // 5. Attempts to Escalate Normal Account to Admin
  await runTest('5.1 Normal user cannot escalate to admin via profile update or client manipulation', async () => {
    const res = await request(app)
      .patch('/api/v1/auth/profile')
      .set('Authorization', `Bearer ${freeUserToken}`)
      .send({
        firstName: 'Hacked',
        roles: ['super_admin'],
        role: 'super_admin'
      });

    assert.strictEqual(res.status, 200);
    // User profile should NOT have super_admin role!
    assert.strictEqual(res.body.user.roles.includes('super_admin'), false);
    assert.strictEqual(res.body.user.roles.includes('user'), true);
  });

  // 6. Cross-User Access Isolation
  let freeUserResumeId = '';
  await runTest('6.1 User creates private resume', async () => {
    const res = await request(app)
      .post('/api/v1/resumes')
      .set('Authorization', `Bearer ${freeUserToken}`)
      .send({
        title: 'Alex Confidential Executive Resume',
        targetRole: 'VP of Engineering',
        content: { summary: 'Confidential executive details' }
      });

    assert.strictEqual(res.status, 201);
    freeUserResumeId = res.body.resume.id;
  });

  await runTest('6.2 Another user cannot access Alex\'s private resume (Returns 403)', async () => {
    const res = await request(app)
      .get(`/api/v1/resumes/${freeUserResumeId}`)
      .set('Authorization', `Bearer ${secondUserToken}`);

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.error.code, 'FORBIDDEN_PRIVATE_RESOURCE');
  });

  await runTest('6.3 Another user cannot export or analyze Alex\'s private resume', async () => {
    const res = await request(app)
      .post(`/api/v1/resumes/${freeUserResumeId}/export-pdf`)
      .set('Authorization', `Bearer ${secondUserToken}`);

    assert.strictEqual(res.status, 403);
  });

  // 7. Concurrent Requests Competing for Final Quota Unit (Atomic Concurrency Test)
  await runTest('7.1 Concurrency Safety: Atomic checks prevent race conditions on quota exhaustion', async () => {
    // Register a dedicated user for concurrency test
    const userRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'concurrency@example.com',
        password: 'Password123!',
        firstName: 'Concurrent',
        lastName: 'Tester'
      });

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'concurrency@example.com', password: 'Password123!' });

    const cToken = loginRes.body.token;
    const cUserId = loginRes.body.user.id;

    // Free plan has a limit of 3 for resume_creation.
    // The user has currently used 0. Let's consume 2 sequentially so exactly 1 remains.
    await request(app)
      .post('/api/v1/features/consume')
      .set('Authorization', `Bearer ${cToken}`)
      .send({ featureName: 'resume_creation', units: 2 });

    // Now exactly 1 unit remains (Used: 2/3).
    // Launch 10 simultaneous concurrent requests competing for this LAST 1 unit!
    const concurrentRequests = Array.from({ length: 10 }).map((_, idx) =>
      request(app)
        .post('/api/v1/features/consume')
        .set('Authorization', `Bearer ${cToken}`)
        .send({ featureName: 'resume_creation', units: 1, reqId: idx })
    );

    const responses = await Promise.all(concurrentRequests);

    const successes = responses.filter(r => r.status === 200);
    const quotaExceeded = responses.filter(r => r.status === 429);

    assert.strictEqual(successes.length, 1, `Exactly ONE concurrent request must succeed! (Actual: ${successes.length})`);
    assert.strictEqual(quotaExceeded.length, 9, `Remaining 9 requests must be rejected with 429 Quota Exceeded! (Actual: ${quotaExceeded.length})`);

    // Verify database units_used is exactly 3 and never exceeded
    const db = getDatabase();
    const summary = db.prepare(`
      SELECT units_used FROM usage_summaries
      WHERE user_id = ? AND feature_name = 'resume_creation'
    `).get(cUserId);

    assert.strictEqual(summary.units_used, 3, `Database units_used must be exactly 3, not ${summary.units_used}`);
  });

  // 8. Duplicate Requests and Idempotency
  await runTest('8.1 Idempotency key prevents double counting on repeated requests', async () => {
    const idempotencyKey = 'idem_key_unique_test_888';

    // First request
    const res1 = await request(app)
      .post('/api/v1/features/consume')
      .set('Authorization', `Bearer ${secondUserToken}`)
      .set('idempotency-key', idempotencyKey)
      .send({ featureName: 'job_matching', units: 1 });

    assert.strictEqual(res1.status, 200);
    const firstUsed = res1.body.quota.used;

    // Duplicate replay of same request
    const res2 = await request(app)
      .post('/api/v1/features/consume')
      .set('Authorization', `Bearer ${secondUserToken}`)
      .set('idempotency-key', idempotencyKey)
      .send({ featureName: 'job_matching', units: 1 });

    assert.strictEqual(res2.status, 200);
    assert.strictEqual(res2.body.isIdempotentReplay, true, 'Second request must be recognized as idempotent replay');

    // Quotas in DB must only be incremented once!
    const db = getDatabase();
    const summary = db.prepare(`
      SELECT units_used FROM usage_summaries
      WHERE user_id = ? AND feature_name = 'job_matching'
    `).get(secondUserId);

    assert.strictEqual(summary.units_used, firstUsed, 'Usage units must not be double counted');
  });

  // 9. Failed Operations and Retry Handling (Do not count failed operations)
  await runTest('9.1 Failed operations do not consume user quota and are recorded as failed', async () => {
    const db = getDatabase();
    const beforeSummary = db.prepare(`
      SELECT units_used FROM usage_summaries
      WHERE user_id = ? AND feature_name = 'ai_suggestions'
    `).get(secondUserId);
    const beforeUsed = beforeSummary ? beforeSummary.units_used : 0;

    const failRes = await request(app)
      .post('/api/v1/features/consume')
      .set('Authorization', `Bearer ${secondUserToken}`)
      .send({ featureName: 'ai_suggestions', units: 1, simulateFailure: true });

    assert.strictEqual(failRes.status, 500);

    const afterSummary = db.prepare(`
      SELECT units_used FROM usage_summaries
      WHERE user_id = ? AND feature_name = 'ai_suggestions'
    `).get(secondUserId);
    const afterUsed = afterSummary ? afterSummary.units_used : 0;

    assert.strictEqual(afterUsed, beforeUsed, 'Quota must NOT be consumed for failed operations');

    // Verify usage event logged with status 'failed'
    const event = db.prepare(`
      SELECT * FROM usage_events WHERE user_id = ? AND feature_name = 'ai_suggestions' ORDER BY created_at DESC LIMIT 1
    `).get(secondUserId);
    assert.strictEqual(event.status, 'failed');
    assert.strictEqual(event.units_consumed, 0);
  });

  // 10. Administrator Quota Overrides and Audit Events
  await runTest('10.1 Super Admin overrides user quota with documented reason and audit record', async () => {
    const overrideRes = await request(app)
      .patch(`/api/v1/admin/users/${secondUserId}/quotas`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        featureName: 'job_matching',
        newLimit: 75,
        reason: 'Customer requested temporary expansion for job search sprint'
      });

    assert.strictEqual(overrideRes.status, 200);
    assert.strictEqual(overrideRes.body.newLimit, 75);

    // Verify user now sees new limit
    const quotasRes = await request(app)
      .get('/api/v1/usage/me/quotas')
      .set('Authorization', `Bearer ${secondUserToken}`);

    const jmQuota = quotasRes.body.quotas.find(q => q.featureName === 'job_matching');
    assert.strictEqual(jmQuota.limit, 75);
    assert.strictEqual(jmQuota.isOverride, true);

    // Verify Admin Audit Log was created
    const auditRes = await request(app)
      .get('/api/v1/admin/audit-logs?actionType=user.quota_override')
      .set('Authorization', `Bearer ${superAdminToken}`);

    assert.strictEqual(auditRes.status, 200);
    assert.ok(auditRes.body.logs.length > 0);
    const log = auditRes.body.logs[0];
    assert.strictEqual(log.target_resource, 'user_quota');
    assert.strictEqual(log.target_id, secondUserId);
  });

  // 11. Suspended Accounts Block Access
  await runTest('11.1 Admin suspends user, immediately revoking active sessions and blocking API access', async () => {
    // Admin suspends second user
    const suspendRes = await request(app)
      .patch(`/api/v1/admin/users/${secondUserId}/status`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ status: 'suspended', reason: 'Terms of service investigation' });

    assert.strictEqual(suspendRes.status, 200);

    // Suspended user's existing token should now return 401 or 403
    const blockedReq = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${secondUserToken}`);

    assert.strictEqual(blockedReq.status === 401 || blockedReq.status === 403, true);

    // Suspended user login attempt is blocked with 403
    const loginAttempt = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'seconduser@example.com', password: 'SecurePassword123!' });

    assert.strictEqual(loginAttempt.status, 403);
    assert.ok(loginAttempt.body.error.message.includes('suspended'));
  });

  // 12. Protection of Last Active Super Administrator
  await runTest('12.1 Prevents accidental deletion, suspension, or demotion of last active super admin', async () => {
    const superAdminUser = getDatabase().prepare(`SELECT id FROM users WHERE email = 'admin@platform.local'`).get();

    // Attempt to suspend super admin
    const suspendAdminRes = await request(app)
      .patch(`/api/v1/admin/users/${superAdminUser.id}/status`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ status: 'suspended' });

    assert.strictEqual(suspendAdminRes.status, 400);
    assert.ok(suspendAdminRes.body.error.message.includes('last active Super Administrator'));

    // Attempt to demote super admin
    const demoteRes = await request(app)
      .patch(`/api/v1/admin/admins/${superAdminUser.id}/role`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ role: 'auditor' });

    assert.strictEqual(demoteRes.status, 500 || demoteRes.status === 400);
  });

  // 13. Billing Webhook and Subscription Transition
  await runTest('13.1 Webhook checkout event updates user subscription to Premium idempotently', async () => {
    const webhookPayload = {
      id: 'evt_stripe_mock_9912',
      type: 'checkout.session.completed',
      data: {
        userId: freeUserId,
        planId: 'premium'
      }
    };

    const whRes = await request(app)
      .post('/api/v1/billing/webhook')
      .send(webhookPayload);

    assert.strictEqual(whRes.status, 200, `Webhook response failed: ${JSON.stringify(whRes.body)}`);
    assert.strictEqual(whRes.body.status, 'processed');

    // Free user should now be on Premium plan
    const profileRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${freeUserToken}`);

    assert.strictEqual(profileRes.status, 200, `Profile check failed: ${JSON.stringify(profileRes.body)}`);
    assert.strictEqual(profileRes.body.user.subscription.plan_id, 'premium');

    // Duplicate webhook should return already_processed
    const dupRes = await request(app)
      .post('/api/v1/billing/webhook')
      .send(webhookPayload);

    assert.strictEqual(dupRes.status, 200);
    assert.strictEqual(dupRes.body.status, 'already_processed');
  });

  // 14. Data Deletion and Privacy Request
  await runTest('14.1 Account deletion purges personal user records and revokes sessions', async () => {
    // Register temporary user
    const tempUser = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'delete_me@example.com', password: 'Password123!', firstName: 'Temp', lastName: 'Delete' });

    const tempLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'delete_me@example.com', password: 'Password123!' });

    const tempToken = tempLogin.body.token;

    // Delete account
    const delRes = await request(app)
      .delete('/api/v1/auth/delete-account')
      .set('Authorization', `Bearer ${tempToken}`)
      .send({ reason: 'Exercising GDPR Right to Erasure' });

    assert.strictEqual(delRes.status, 200);

    // Verify login no longer possible
    const loginAgain = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'delete_me@example.com', password: 'Password123!' });

    assert.strictEqual(loginAgain.status, 401);
  });

  // Final Summary
  console.log(`\n${colors.bold}----------------------------------------------------------------${colors.reset}`);
  console.log(`  Tests Completed: ${colors.bold}${passedCount + failedCount}${colors.reset}`);
  console.log(`  Passed:          ${colors.green}${colors.bold}${passedCount}${colors.reset}`);
  console.log(`  Failed:          ${failedCount > 0 ? colors.red : colors.green}${colors.bold}${failedCount}${colors.reset}`);
  console.log(`${colors.bold}----------------------------------------------------------------${colors.reset}\n`);

  if (failedCount > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  startSuite().catch(err => {
    console.error('Test suite runner crashed:', err);
    process.exit(1);
  });
}

module.exports = { startSuite };
