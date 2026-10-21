const express = require('express');
const router = express.Router();
const usageService = require('../services/usageService');
const quotaService = require('../services/quotaService');
const { requireAuth } = require('../middleware/auth');

// GET /api/v1/usage/me
router.get('/me', requireAuth, (req, res, next) => {
  try {
    const summary = usageService.getUserUsageSummary(req.user.id);
    res.status(200).json({
      success: true,
      ...summary
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/usage/me/history
router.get('/me/history', requireAuth, (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = parseInt(req.query.offset, 10) || 0;
    const featureName = req.query.feature || null;
    const status = req.query.status || null;

    const history = usageService.getUserUsageHistory(req.user.id, {
      limit,
      offset,
      featureName,
      status
    });

    res.status(200).json({
      success: true,
      ...history
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/usage/me/quotas
router.get('/me/quotas', requireAuth, (req, res, next) => {
  try {
    const quotaData = quotaService.getUserQuotas(req.user.id);
    res.status(200).json({
      success: true,
      ...quotaData
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
