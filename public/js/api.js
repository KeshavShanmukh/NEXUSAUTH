/**
 * API Client Module with Bearer Token, Correlation Headers, and Error Handling
 */

const API = {
  token: localStorage.getItem('auth_token') || '',

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  },

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'X-Correlation-ID': 'web_' + Math.random().toString(36).substring(2, 10),
      ...(options.headers || {})
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const config = {
      ...options,
      headers
    };

    try {
      const response = await fetch(endpoint, config);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const error = new Error(data.error?.message || response.statusText || 'Request failed');
        error.status = response.status;
        error.code = data.error?.code || 'UNKNOWN_ERROR';
        error.details = data.error?.details;
        error.data = data;

        if (response.status === 401 && !endpoint.includes('/auth/login')) {
          // Token expired or invalid
          this.setToken('');
          window.dispatchEvent(new CustomEvent('auth:expired'));
        }

        throw error;
      }

      return data;
    } catch (err) {
      throw err;
    }
  },

  // Auth Endpoints
  register(userData) {
    return this.request('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  },

  login(credentials) {
    return this.request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
  },

  logout() {
    return this.request('/api/v1/auth/logout', { method: 'POST' }).finally(() => {
      this.setToken('');
    });
  },

  getProfile() {
    return this.request('/api/v1/auth/me');
  },

  updateProfile(profileData) {
    return this.request('/api/v1/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(profileData)
    });
  },

  changePassword(passwords) {
    return this.request('/api/v1/auth/change-password', {
      method: 'PATCH',
      body: JSON.stringify(passwords)
    });
  },

  forgotPassword(email) {
    return this.request('/api/v1/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  },

  resetPassword(payload) {
    return this.request('/api/v1/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  verifyEmail(token) {
    return this.request('/api/v1/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token })
    });
  },

  getSessions() {
    return this.request('/api/v1/auth/sessions');
  },

  revokeSession(sessionId) {
    return this.request(`/api/v1/auth/sessions/${sessionId}`, { method: 'DELETE' });
  },

  deleteAccount(reason = 'User initiated') {
    return this.request('/api/v1/auth/delete-account', {
      method: 'DELETE',
      body: JSON.stringify({ reason })
    });
  },

  // User Usage & Feature Endpoints
  getUserQuotas() {
    return this.request('/api/v1/usage/me/quotas');
  },

  getUserUsageSummary() {
    return this.request('/api/v1/usage/me');
  },

  getUserUsageHistory(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/v1/usage/me/history?${query}`);
  },

  getResumes() {
    return this.request('/api/v1/resumes');
  },

  createResume(resumeData) {
    return this.request('/api/v1/resumes', {
      method: 'POST',
      body: JSON.stringify(resumeData)
    });
  },

  exportResumePdf(resumeId) {
    return this.request(`/api/v1/resumes/${resumeId}/export-pdf`, { method: 'POST' });
  },

  analyzeResume(resumeId) {
    return this.request(`/api/v1/resumes/${resumeId}/analyze`, { method: 'POST' });
  },

  matchJob(jobData) {
    return this.request('/api/v1/jobs/match', {
      method: 'POST',
      body: JSON.stringify(jobData)
    });
  },

  getAiSuggestions(payload) {
    return this.request('/api/v1/ai/suggest', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  simulateFeatureConsumption(featureName, units = 1, simulateFailure = false) {
    return this.request('/api/v1/features/consume', {
      method: 'POST',
      body: JSON.stringify({ featureName, units, simulateFailure })
    });
  },

  // Plans & Billing
  getPlans() {
    return this.request('/api/v1/plans');
  },

  createCheckout(planId) {
    return this.request('/api/v1/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ planId })
    });
  },

  simulateWebhookPayment(userId, planId) {
    return this.request('/api/v1/billing/webhook', {
      method: 'POST',
      body: JSON.stringify({
        id: `evt_sim_${Date.now()}`,
        type: 'checkout.session.completed',
        data: { userId, planId }
      })
    });
  },

  // Admin Endpoints
  getAdminDashboard() {
    return this.request('/api/v1/admin/dashboard');
  },

  getAdminUsers(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/v1/admin/users?${query}`);
  },

  getAdminUserDetail(userId) {
    return this.request(`/api/v1/admin/users/${userId}`);
  },

  updateUserStatus(userId, status, reason = '') {
    return this.request(`/api/v1/admin/users/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reason })
    });
  },

  adminDeleteUser(userId, reason = '') {
    return this.request(`/api/v1/admin/users/${userId}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason })
    });
  },

  overrideUserQuota(userId, featureName, newLimit, reason) {
    return this.request(`/api/v1/admin/users/${userId}/quotas`, {
      method: 'PATCH',
      body: JSON.stringify({ featureName, newLimit, reason })
    });
  },

  getAdminUsageEvents(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/v1/admin/usage/events?${query}`);
  },

  getAdminAuditLogs(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/v1/admin/audit-logs?${query}`);
  },

  getAdminAdmins() {
    return this.request('/api/v1/admin/admins');
  },

  createAdmin(adminData) {
    return this.request('/api/v1/admin/admins', {
      method: 'POST',
      body: JSON.stringify(adminData)
    });
  },

  updateAdminRole(userId, role) {
    return this.request(`/api/v1/admin/admins/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role })
    });
  },

  revokeAdmin(userId) {
    return this.request(`/api/v1/admin/admins/${userId}`, { method: 'DELETE' });
  },

  updatePlan(planId, planData) {
    return this.request(`/api/v1/admin/plans/${planId}`, {
      method: 'PATCH',
      body: JSON.stringify(planData)
    });
  }
};
