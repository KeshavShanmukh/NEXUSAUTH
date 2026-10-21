const express = require('express');
const router = express.Router();
const billingService = require('../services/billingService');

// GET /api/v1/plans
router.get('/', (req, res, next) => {
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

module.exports = router;
