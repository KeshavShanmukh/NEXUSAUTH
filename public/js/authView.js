/**
 * Authentication View Component
 * Handles User Login, Admin Login, Registration, Password Reset, and MFA Verification
 */

const AuthView = {
  activeMode: 'login', // 'login', 'admin-login', 'register', 'forgot-password'

  render(container) {
    container.innerHTML = `
      <div class="auth-wrapper animate-fade-in">
        <div class="auth-card">
          <div class="auth-header">
            <div class="flex-center" style="margin-bottom: 1rem;">
              <div class="brand-icon" style="width: 48px; height: 48px; font-size: 1.5rem;">
                ${this.activeMode === 'admin-login' ? '🛡️' : '✨'}
              </div>
            </div>
            <h2>${this.getHeaderTitle()}</h2>
            <p>${this.getHeaderSubtitle()}</p>
          </div>

          <div class="auth-tabs">
            <button class="auth-tab ${this.activeMode === 'login' ? 'active' : ''}" onclick="AuthView.setMode('login')">
              User Login
            </button>
            <button class="auth-tab ${this.activeMode === 'register' ? 'active' : ''}" onclick="AuthView.setMode('register')">
              Register
            </button>
            <button class="auth-tab ${this.activeMode === 'admin-login' ? 'active' : ''}" style="grid-column: span 2; margin-top: 0.25rem;" onclick="AuthView.setMode('admin-login')">
              🛡️ Dedicated Admin Portal
            </button>
          </div>

          <div id="auth-alert" style="display: none; margin-bottom: 1.25rem;" class="toast toast-error"></div>

          ${this.renderForm()}

          <div style="margin-top: 1.5rem; text-align: center; font-size: 0.85rem; color: var(--text-muted);">
            ${this.renderFooterLinks()}
          </div>
        </div>
      </div>
    `;
  },

  getHeaderTitle() {
    switch (this.activeMode) {
      case 'admin-login': return 'Administrative Console';
      case 'register': return 'Create Your Account';
      case 'forgot-password': return 'Password Recovery';
      default: return 'Welcome Back';
    }
  },

  getHeaderSubtitle() {
    switch (this.activeMode) {
      case 'admin-login': return 'Authorized personnel only. RBAC protected access.';
      case 'register': return 'Join now for resume builder and AI career analytics.';
      case 'forgot-password': return 'Enter your verified email to receive a recovery token.';
      default: return 'Sign in to access your resumes and usage metrics.';
    }
  },

  renderForm() {
    if (this.activeMode === 'register') {
      return `
        <form id="auth-form" onsubmit="AuthView.handleRegister(event)">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
            <div class="form-group">
              <label class="form-label">First Name</label>
              <input type="text" id="reg-first-name" class="form-input" placeholder="Alex" required />
            </div>
            <div class="form-group">
              <label class="form-label">Last Name</label>
              <input type="text" id="reg-last-name" class="form-input" placeholder="Taylor" required />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Email Address</label>
            <input type="email" id="reg-email" class="form-input" placeholder="name@example.com" required />
          </div>
          <div class="form-group">
            <label class="form-label">Password (Min 8 Characters)</label>
            <input type="password" id="reg-password" class="form-input" placeholder="••••••••" minlength="8" required />
          </div>
          <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 0.5rem;" id="auth-submit-btn">
            Create Free Account
          </button>
        </form>
      `;
    }

    if (this.activeMode === 'forgot-password') {
      return `
        <form id="auth-form" onsubmit="AuthView.handleForgotPassword(event)">
          <div class="form-group">
            <label class="form-label">Registered Email Address</label>
            <input type="email" id="forgot-email" class="form-input" placeholder="name@example.com" required />
          </div>
          <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 0.5rem;" id="auth-submit-btn">
            Send Reset Token
          </button>
        </form>
      `;
    }

    const isAdmin = this.activeMode === 'admin-login';
    return `
      <form id="auth-form" onsubmit="AuthView.handleLogin(event, ${isAdmin})">
        <div class="form-group">
          <label class="form-label">${isAdmin ? 'Admin Email' : 'Email Address'}</label>
          <input type="email" id="login-email" class="form-input"
                 placeholder="${isAdmin ? 'admin@platform.local' : 'user@example.com'}" required />
        </div>
        <div class="form-group">
          <div class="flex-between">
            <label class="form-label">Password</label>
            ${!isAdmin ? '<a href="javascript:void(0)" onclick="AuthView.setMode(\'forgot-password\')" style="font-size: 0.75rem;">Forgot password?</a>' : ''}
          </div>
          <input type="password" id="login-password" class="form-input" placeholder="••••••••" required />
        </div>
        ${isAdmin ? `
          <div class="form-group">
            <label class="form-label">MFA Security Code (Optional/Mock)</label>
            <input type="text" id="login-mfa" class="form-input" placeholder="123456 (or leave empty)" />
          </div>
        ` : ''}
        <button type="submit" class="btn ${isAdmin ? 'btn-danger' : 'btn-primary'}" style="width: 100%; margin-top: 0.5rem;" id="auth-submit-btn">
          ${isAdmin ? '🛡️ Authenticate as Administrator' : 'Sign In to Workspace'}
        </button>
      </form>
    `;
  },

  renderFooterLinks() {
    if (this.activeMode === 'forgot-password') {
      return `<a href="javascript:void(0)" onclick="AuthView.setMode('login')">← Back to Sign In</a>`;
    }
    if (this.activeMode === 'admin-login') {
      return `Need regular user access? <a href="javascript:void(0)" onclick="AuthView.setMode('login')">Switch to User Login</a>`;
    }
    return `Demo Quick-Switchers available in top navigation bar 👆`;
  },

  setMode(mode) {
    this.activeMode = mode;
    const container = document.getElementById('main-content');
    if (container) this.render(container);
  },

  showAlert(message, isError = true) {
    const el = document.getElementById('auth-alert');
    if (el) {
      el.className = `toast ${isError ? 'toast-error' : 'toast-success'}`;
      el.textContent = message;
      el.style.display = 'flex';
    }
  },

  async handleLogin(e, isAdminLogin) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const mfaCode = document.getElementById('login-mfa')?.value || null;
    const btn = document.getElementById('auth-submit-btn');

    btn.disabled = true;
    btn.textContent = 'Authenticating...';

    try {
      const res = await API.login({ email, password, mfaCode, isAdminLogin });
      API.setToken(res.token);
      State.setUser(res.user);

      App.showToast(`Welcome back, ${res.user.firstName || res.user.email}!`, 'success');
      if (res.user.roles.some(r => ['super_admin', 'support_admin', 'auditor'].includes(r))) {
        State.setView('admin');
      } else {
        State.setView('user');
      }
    } catch (err) {
      this.showAlert(err.message, true);
    } finally {
      btn.disabled = false;
      btn.textContent = isAdminLogin ? '🛡️ Authenticate as Administrator' : 'Sign In to Workspace';
    }
  },

  async handleRegister(e) {
    e.preventDefault();
    const firstName = document.getElementById('reg-first-name').value;
    const lastName = document.getElementById('reg-last-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const btn = document.getElementById('auth-submit-btn');

    btn.disabled = true;
    btn.textContent = 'Creating Account...';

    try {
      const res = await API.register({ email, password, firstName, lastName });
      this.showAlert('Account created! Auto-verifying email...', false);

      // In demo mode, automatically verify email using returned token
      if (res.verificationToken) {
        await API.verifyEmail(res.verificationToken);
      }

      // Auto login
      const loginRes = await API.login({ email, password });
      API.setToken(loginRes.token);
      State.setUser(loginRes.user);

      App.showToast('Account registered and email verified successfully!', 'success');
      State.setView('user');
    } catch (err) {
      this.showAlert(err.message, true);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Create Free Account';
    }
  },

  async handleForgotPassword(e) {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value;
    const btn = document.getElementById('auth-submit-btn');

    btn.disabled = true;
    btn.textContent = 'Sending...';

    try {
      const res = await API.forgotPassword(email);
      if (res.resetToken) {
        // Show demo reset modal
        this.promptResetPassword(res.resetToken);
      } else {
        this.showAlert(res.message, false);
      }
    } catch (err) {
      this.showAlert(err.message, true);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Send Reset Token';
    }
  },

  promptResetPassword(resetToken) {
    const newPass = prompt(`[Demo Simulator] Password reset token generated:\n${resetToken}\n\nEnter your new password (min 8 chars):`);
    if (newPass) {
      API.resetPassword({ token: resetToken, newPassword: newPass })
        .then(res => {
          App.showToast(res.message, 'success');
          this.setMode('login');
        })
        .catch(err => {
          App.showToast(err.message, 'error');
        });
    }
  }
};
