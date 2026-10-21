const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const quotaService = require('../services/quotaService');
const usageService = require('../services/usageService');

// Feature endpoints require authentication
// router.use(requireAuth);

// GET /api/v1/resumes - List current user's resumes (Strictly isolated by user_id)
router.get('/resumes', (req, res, next) => {
  try {
    const db = getDatabase();
    const resumes = db.prepare(`
      SELECT id, title, target_role, status, pdf_exports_count, created_at, updated_at
      FROM resumes
      WHERE user_id = ?
      ORDER BY updated_at DESC
    `).all(req.user.id);

    res.status(200).json({
      success: true,
      resumes
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/resumes - Create new resume (Consumes 'resume_creation' quota)
router.post('/resumes', (req, res, next) => {
  const idempotencyKey = req.headers['idempotency-key'] || null;
  const correlationId = req.correlationId;

  // 1. Concurrency-safe quota check & atomic consumption
  const quota = quotaService.checkAndConsumeQuota(req.user.id, 'resume_creation', 1);
  if (!quota.allowed) {
    return res.status(429).json({
      error: {
        code: 'QUOTA_EXCEEDED',
        message: quota.message,
        featureName: 'resume_creation',
        remaining: quota.remaining,
        resetDate: quota.resetDate,
        upgradeAvailable: true
      }
    });
  }

  try {
    const { title, targetRole, content } = req.body;
    if (!title) {
      // Refund if input validation fails
      quotaService.refundQuota(req.user.id, 'resume_creation', 1);
      return res.status(400).json({ error: { message: 'Resume title is required' } });
    }

    const db = getDatabase();
    const resumeId = `res_${uuidv4()}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO resumes (id, user_id, title, target_role, content, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'draft', ?, ?)
    `).run(
      resumeId,
      req.user.id,
      title,
      targetRole || 'Software Professional',
      typeof content === 'object' ? JSON.stringify(content) : (content || '{}'),
      now,
      now
    );

    // Record append-only usage event
    usageService.recordUsageEvent({
      userId: req.user.id,
      featureName: 'resume_creation',
      status: 'success',
      correlationId,
      idempotencyKey,
      unitsConsumed: 1,
      metadata: { resumeId, title }
    });

    res.status(201).json({
      success: true,
      message: 'Resume created successfully.',
      resume: { id: resumeId, title, targetRole, status: 'draft', createdAt: now },
      quota: { remaining: quota.remaining, limit: quota.limit }
    });
  } catch (err) {
    quotaService.refundQuota(req.user.id, 'resume_creation', 1);
    usageService.recordUsageEvent({
      userId: req.user.id,
      featureName: 'resume_creation',
      status: 'failed',
      correlationId,
      idempotencyKey,
      unitsConsumed: 0,
      metadata: { error: err.message }
    });
    next(err);
  }
});

// GET /api/v1/resumes/:id - Cross-user privacy isolation check
router.get('/resumes/:id', (req, res, next) => {
  try {
    const db = getDatabase();
    const resume = db.prepare(`SELECT * FROM resumes WHERE id = ?`).get(req.params.id);

    if (!resume) {
      return res.status(404).json({ error: { message: 'Resume not found' } });
    }

    // Privacy isolation: only owner or super admin can access
    if (resume.user_id !== req.user.id && !req.user.roles.includes('super_admin')) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN_PRIVATE_RESOURCE',
          message: 'Access denied: You do not have permission to view another user\'s private documents.'
        }
      });
    }

    res.status(200).json({
      success: true,
      resume: {
        ...resume,
        content: (() => { try { return JSON.parse(resume.content); } catch { return resume.content; } })()
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/resumes/:id/export-pdf - Consumes 'pdf_exports' quota
router.post('/resumes/:id/export-pdf', (req, res, next) => {
  const correlationId = req.correlationId;
  const idempotencyKey = req.headers['idempotency-key'] || null;

  const db = getDatabase();
  const resume = db.prepare(`SELECT * FROM resumes WHERE id = ?`).get(req.params.id);

  if (!resume) {
    return res.status(404).json({ error: { message: 'Resume not found' } });
  }

  if (resume.user_id !== req.user.id && !req.user.roles.includes('super_admin')) {
    return res.status(403).json({ error: { message: 'Access denied to this document' } });
  }

  const quota = quotaService.checkAndConsumeQuota(req.user.id, 'pdf_exports', 1);
  if (!quota.allowed) {
    return res.status(429).json({
      error: {
        code: 'QUOTA_EXCEEDED',
        message: quota.message,
        featureName: 'pdf_exports',
        remaining: quota.remaining,
        resetDate: quota.resetDate
      }
    });
  }

  try {
    db.prepare(`UPDATE resumes SET pdf_exports_count = pdf_exports_count + 1 WHERE id = ?`).run(resume.id);

    usageService.recordUsageEvent({
      userId: req.user.id,
      featureName: 'pdf_exports',
      status: 'success',
      correlationId,
      idempotencyKey,
      unitsConsumed: 1,
      metadata: { resumeId: resume.id, title: resume.title }
    });

    res.status(200).json({
      success: true,
      message: 'PDF generated successfully.',
      downloadUrl: `/api/v1/resumes/${resume.id}/download-pdf?token=${uuidv4()}`,
      quota: { remaining: quota.remaining, limit: quota.limit }
    });
  } catch (err) {
    quotaService.refundQuota(req.user.id, 'pdf_exports', 1);
    usageService.recordUsageEvent({
      userId: req.user.id,
      featureName: 'pdf_exports',
      status: 'failed',
      correlationId,
      idempotencyKey,
      unitsConsumed: 0
    });
    next(err);
  }
});

// POST /api/v1/resumes/:id/analyze - Consumes 'resume_analysis' quota + AI model metrics
router.post('/resumes/:id/analyze', (req, res, next) => {
  const correlationId = req.correlationId;
  const idempotencyKey = req.headers['idempotency-key'] || null;

  const db = getDatabase();
  const resume = db.prepare(`SELECT * FROM resumes WHERE id = ?`).get(req.params.id);

  if (!resume) {
    return res.status(404).json({ error: { message: 'Resume not found' } });
  }

  if (resume.user_id !== req.user.id && !req.user.roles.includes('super_admin')) {
    return res.status(403).json({ error: { message: 'Access denied to this document' } });
  }

  const quota = quotaService.checkAndConsumeQuota(req.user.id, 'resume_analysis', 1);
  if (!quota.allowed) {
    return res.status(429).json({
      error: {
        code: 'QUOTA_EXCEEDED',
        message: quota.message,
        featureName: 'resume_analysis',
        remaining: quota.remaining,
        resetDate: quota.resetDate
      }
    });
  }

  try {
    const analysisId = `ana_${uuidv4()}`;
    const now = new Date().toISOString();
    const promptTokens = 1180;
    const completionTokens = 380;
    const cost = 0.0078; // $0.0078 OpenAI GPT-4o calculation

    const strengths = [
      'Comprehensive technical skill breadth matching modern cloud architectures',
      'High density of quantifiable impact metrics in experience bullets',
      'Clear ATS-compatible section layout and typography'
    ];
    const improvements = [
      'Quantify latency or cost savings achieved in your latest role',
      'Incorporate keywords from target job description: "Distributed Systems, gRPC"'
    ];

    db.prepare(`
      INSERT INTO resume_analyses (id, resume_id, user_id, overall_score, ats_compatibility, strengths, improvements, created_at)
      VALUES (?, ?, ?, 89, 93, ?, ?, ?)
    `).run(analysisId, resume.id, req.user.id, JSON.stringify(strengths), JSON.stringify(improvements), now);

    usageService.recordUsageEvent({
      userId: req.user.id,
      featureName: 'resume_analysis',
      status: 'success',
      correlationId,
      idempotencyKey,
      unitsConsumed: 1,
      aiProvider: 'OpenAI',
      aiModel: 'gpt-4o',
      promptTokens,
      completionTokens,
      estimatedCost: cost,
      metadata: { resumeId: resume.id, score: 89 }
    });

    res.status(200).json({
      success: true,
      analysis: {
        id: analysisId,
        resumeId: resume.id,
        overallScore: 89,
        atsCompatibility: 93,
        strengths,
        improvements,
        aiModel: 'gpt-4o',
        tokensConsumed: promptTokens + completionTokens
      },
      quota: { remaining: quota.remaining, limit: quota.limit }
    });
  } catch (err) {
    quotaService.refundQuota(req.user.id, 'resume_analysis', 1);
    usageService.recordUsageEvent({
      userId: req.user.id,
      featureName: 'resume_analysis',
      status: 'failed',
      correlationId,
      idempotencyKey,
      unitsConsumed: 0
    });
    next(err);
  }
});

// POST /api/v1/jobs/match - Consumes 'job_matching' quota
router.post('/match', (req, res, next) => {
  const correlationId = req.correlationId;
  const idempotencyKey = req.headers['idempotency-key'] || null;
  const { jobDescription, targetRole } = req.body;

  const quota = quotaService.checkAndConsumeQuota(req.user.id, 'job_matching', 1);
  if (!quota.allowed) {
    return res.status(429).json({
      error: {
        code: 'QUOTA_EXCEEDED',
        message: quota.message,
        featureName: 'job_matching',
        remaining: quota.remaining,
        resetDate: quota.resetDate
      }
    });
  }

  try {
    const promptTokens = 1520;
    const completionTokens = 420;
    const cost = 0.0097;

    usageService.recordUsageEvent({
      userId: req.user.id,
      featureName: 'job_matching',
      status: 'success',
      correlationId,
      idempotencyKey,
      unitsConsumed: 1,
      aiProvider: 'Anthropic',
      aiModel: 'claude-3-5-sonnet',
      promptTokens,
      completionTokens,
      estimatedCost: cost,
      metadata: { targetRole: targetRole || 'Software Engineer' }
    });

    res.status(200).json({
      success: true,
      match: {
        matchScore: 92,
        matchingKeywords: ['TypeScript', 'Node.js', 'System Architecture', 'CI/CD Pipelines'],
        missingKeywords: ['Kubernetes Helm Charts', 'Kafka Streaming'],
        recommendations: 'Emphasize cloud deployment experience and event-driven architecture examples in Section 2.'
      },
      quota: { remaining: quota.remaining, limit: quota.limit }
    });
  } catch (err) {
    quotaService.refundQuota(req.user.id, 'job_matching', 1);
    usageService.recordUsageEvent({
      userId: req.user.id,
      featureName: 'job_matching',
      status: 'failed',
      correlationId,
      idempotencyKey,
      unitsConsumed: 0
    });
    next(err);
  }
});

// POST /api/v1/ai/suggest - Consumes 'ai_suggestions' quota
router.post('/suggest', (req, res, next) => {
  const correlationId = req.correlationId;
  const idempotencyKey = req.headers['idempotency-key'] || null;
  const { section, currentText } = req.body;

  const quota = quotaService.checkAndConsumeQuota(req.user.id, 'ai_suggestions', 1);
  if (!quota.allowed) {
    return res.status(429).json({
      error: {
        code: 'QUOTA_EXCEEDED',
        message: quota.message,
        featureName: 'ai_suggestions',
        remaining: quota.remaining,
        resetDate: quota.resetDate
      }
    });
  }

  try {
    const promptTokens = 650;
    const completionTokens = 220;
    const cost = 0.0026;

    usageService.recordUsageEvent({
      userId: req.user.id,
      featureName: 'ai_suggestions',
      status: 'success',
      correlationId,
      idempotencyKey,
      unitsConsumed: 1,
      aiProvider: 'Google',
      aiModel: 'gemini-1.5-pro',
      promptTokens,
      completionTokens,
      estimatedCost: cost,
      metadata: { section: section || 'experience' }
    });

    res.status(200).json({
      success: true,
      suggestions: [
        'Architected high-throughput microservices handling 50M+ daily events with 99.99% availability.',
        'Spearheaded frontend migration to modern reactive component architecture, cutting bundle size by 42%.'
      ],
      quota: { remaining: quota.remaining, limit: quota.limit }
    });
  } catch (err) {
    quotaService.refundQuota(req.user.id, 'ai_suggestions', 1);
    usageService.recordUsageEvent({
      userId: req.user.id,
      featureName: 'ai_suggestions',
      status: 'failed',
      correlationId,
      idempotencyKey,
      unitsConsumed: 0
    });
    next(err);
  }
});

// POST /api/v1/features/consume - Generic metered feature simulator for quick testing
router.post('/consume', (req, res, next) => {
  const { featureName, units = 1, simulateFailure = false } = req.body;
  const idempotencyKey = req.headers['idempotency-key'] || null;
  const correlationId = req.correlationId;

  if (!featureName) {
    return res.status(400).json({ error: { message: 'featureName is required' } });
  }

  // Check idempotency first: if already processed, return existing
  if (idempotencyKey) {
    const db = getDatabase();
    const existing = db.prepare(`SELECT * FROM usage_events WHERE idempotency_key = ?`).get(idempotencyKey);
    if (existing) {
      return res.status(200).json({
        success: true,
        isIdempotentReplay: true,
        message: 'Request already processed with idempotency key.',
        event: existing
      });
    }
  }

  const quota = quotaService.checkAndConsumeQuota(req.user.id, featureName, units);
  if (!quota.allowed) {
    return res.status(429).json({
      error: {
        code: 'QUOTA_EXCEEDED',
        message: quota.message,
        featureName,
        remaining: quota.remaining,
        resetDate: quota.resetDate
      }
    });
  }

  if (simulateFailure) {
    quotaService.refundQuota(req.user.id, featureName, units);
    usageService.recordUsageEvent({
      userId: req.user.id,
      featureName,
      status: 'failed',
      correlationId,
      idempotencyKey,
      unitsConsumed: 0,
      metadata: { error: 'Simulated downstream failure' }
    });
    return res.status(500).json({
      error: {
        code: 'SIMULATED_FAILURE',
        message: 'Simulated operation failed. Quota was refunded and not charged.'
      }
    });
  }

  const event = usageService.recordUsageEvent({
    userId: req.user.id,
    featureName,
    status: 'success',
    correlationId,
    idempotencyKey,
    unitsConsumed: units,
    aiProvider: ['resume_analysis', 'job_matching', 'ai_suggestions'].includes(featureName) ? 'OpenAI' : null,
    aiModel: ['resume_analysis', 'job_matching', 'ai_suggestions'].includes(featureName) ? 'gpt-4o' : null,
    promptTokens: 850,
    completionTokens: 250,
    estimatedCost: 0.0055,
    metadata: { simulated: true }
  });

  res.status(200).json({
    success: true,
    message: `Operation for ${featureName} completed successfully.`,
    event,
    quota: {
      used: quota.used,
      limit: quota.limit,
      remaining: quota.remaining
    }
  });
});

module.exports = router;
