const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const { requireAuth } = require('../middleware/auth');
const { loginRateLimiter, passwordResetRateLimiter } = require('../middleware/rateLimiter');

// POST /api/v1/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, firstName, lastName } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || '';

    const result = await authService.register({
      email,
      password,
      firstName,
      lastName,
      ipAddress,
      userAgent
    });

    res.status(201).json({
      success: true,
      message: 'Account created successfully. A verification link has been generated.',
      user: {
        id: result.userId,
        email: result.email,
        firstName: result.firstName,
        lastName: result.lastName,
        emailVerified: result.emailVerified
      },
      verificationToken: result.verificationToken // Provided in demo/test environments
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/login
router.post('/login', loginRateLimiter, async (req, res, next) => {
  try {
    const { email, password, mfaCode, isAdminLogin } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || '';

    const result = await authService.login({
      email,
      password,
      mfaCode,
      ipAddress,
      userAgent,
      isAdminLogin: Boolean(isAdminLogin)
    });

    // Set HTTP-Only, Secure, SameSite Cookie
    if (result.token) {
      res.cookie('auth_token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });
    }

    res.status(200).json({
      success: true,
      ...result
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/logout
router.post('/logout', requireAuth, (req, res, next) => {
  try {
    authService.logout(req.token, req.user.id);
    res.clearCookie('auth_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });
    res.status(200).json({
      success: true,
      message: 'Logged out successfully.'
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/forgot-password
router.post('/forgot-password', passwordResetRateLimiter, async (req, res, next) => {
  try {
    const { email } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const result = await authService.forgotPassword(email, ipAddress);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/reset-password
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const result = await authService.resetPassword({ token, newPassword, ipAddress });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/verify-email
router.post('/verify-email', async (req, res, next) => {
  try {
    const { token } = req.body;
    const result = await authService.verifyEmail(token);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/auth/me
router.get('/me', requireAuth, (req, res, next) => {
  try {
    const profile = authService.getUserProfile(req.user.id);
    res.status(200).json({
      success: true,
      user: profile
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/auth/profile
router.patch('/profile', requireAuth, (req, res, next) => {
  try {
    const { firstName, lastName } = req.body;
    const updated = authService.updateUserProfile(req.user.id, { firstName, lastName });
    res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      user: updated
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/auth/change-password
router.patch('/change-password', requireAuth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const result = await authService.changePassword(req.user.id, { currentPassword, newPassword });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/auth/sessions
router.get('/sessions', requireAuth, (req, res, next) => {
  try {
    const sessions = authService.getUserSessions(req.user.id);
    res.status(200).json({
      success: true,
      currentSessionId: req.user.sessionId,
      sessions
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/auth/sessions/:sessionId
router.delete('/sessions/:sessionId', requireAuth, (req, res, next) => {
  try {
    const result = authService.revokeSession(req.user.id, req.params.sessionId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/auth/delete-account
router.delete('/delete-account', requireAuth, (req, res, next) => {
  try {
    const { reason } = req.body || {};
    const result = authService.deleteAccount(req.user.id, req.user, reason);
    res.clearCookie('auth_token');
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
