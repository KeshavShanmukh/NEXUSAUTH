/**
 * Main Application Orchestrator & Router
 */

const App = {
  personas: [
    { label: '👑 Super Admin', email: 'admin@platform.local', pass: 'SuperAdmin@2026Secure!', role: 'super_admin', isAdmin: true },
    { label: '🛠️ Support Admin', email: 'support@platform.local', pass: 'SuperAdmin@2026Secure!', role: 'support_admin', isAdmin: true },
    { label: '📋 Auditor', email: 'auditor@platform.local', pass: 'SuperAdmin@2026Secure!', role: 'auditor', isAdmin: true },
    { label: '👤 Free User', email: 'freeuser@example.com', pass: 'UserPassword123!', role: 'user', isAdmin: false },
    { label: '💎 Premium User', email: 'premiumuser@example.com', pass: 'UserPassword123!', role: 'user', isAdmin: false },
    { label: '🚫 Suspended User', email: 'suspendeduser@example.com', pass: 'UserPassword123!', role: 'user', isAdmin: false }
  ],

  async init() {
    this.renderPersonaSwitcher();
    this.setupListeners();

    // Check if token already exists
    if (API.token) {
      try {
        const res = await API.getProfile();
        State.setUser(res.user);
        if (State.isAdmin) {
          State.setView('admin');
        } else {
          State.setView('user');
        }
      } catch {
        API.setToken('');
        State.setView('auth');
      }
    } else {
      State.setView('auth');
    }

    this.renderCurrentView();
  },

  setupListeners() {
    State.subscribe((state, eventType) => {
      this.renderNav();
      this.highlightActivePersonaChip();
      // Only re-render root view if authentication or primary view changed
      if (eventType === 'auth_change' || eventType === 'view_change') {
        this.renderCurrentView();
      }
    });

    window.addEventListener('auth:expired', () => {
      this.showToast('Your session has expired. Please sign in again.', 'warning');
      State.clearUser();
      State.setView('auth');
    });

    window.addEventListener('hashchange', () => {
      this.handleHashChange();
    });

    // Close modal on escape
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeModal();
    });
  },

  handleHashChange() {
    const hash = window.location.hash;
    if (hash === '#admin-login') {
      State.setView('auth');
      AuthView.setMode('admin-login');
    } else if (hash === '#register') {
      State.setView('auth');
      AuthView.setMode('register');
    } else if (hash === '#login') {
      State.setView('auth');
      AuthView.setMode('login');
    } else if (hash === '#admin' && State.isAdmin) {
      State.setView('admin');
    } else if (hash === '#user' && State.isAuthenticated) {
      State.setView('user');
    }
  },

  renderPersonaSwitcher() {
    const bar = document.getElementById('persona-switcher-bar');
    if (!bar) return;

    bar.innerHTML = `
      <div class="persona-title">
        <span>⚡ Quick Persona Switcher:</span>
      </div>
      <div class="persona-chips">
        ${this.personas.map((p, idx) => `
          <button class="persona-chip" id="persona-chip-${idx}" onclick="App.switchToPersona(${idx})">
            ${p.label}
          </button>
        `).join('')}
      </div>
    `;
  },

  highlightActivePersonaChip() {
    const userEmail = State.user?.email;
    this.personas.forEach((p, idx) => {
      const chip = document.getElementById(`persona-chip-${idx}`);
      if (chip) {
        if (userEmail && userEmail.toLowerCase() === p.email.toLowerCase()) {
          chip.classList.add('active');
        } else {
          chip.classList.remove('active');
        }
      }
    });
  },

  async switchToPersona(personaIndex) {
    const p = this.personas[personaIndex];
    if (!p) return;

    this.showToast(`Switching to persona ${p.label}...`, 'info');

    try {
      const res = await API.login({
        email: p.email,
        password: p.pass,
        isAdminLogin: p.isAdmin
      });

      API.setToken(res.token);
      State.setUser(res.user);

      this.showToast(`Logged in as ${p.label}`, 'success');

      if (p.isAdmin) {
        State.setView('admin');
      } else {
        State.setView('user');
      }
    } catch (err) {
      this.showToast(`Persona switch failed: ${err.message}`, 'error');
    }
  },

  renderNav() {
    const navRight = document.getElementById('nav-right');
    if (!navRight) return;

    if (!State.isAuthenticated) {
      navRight.innerHTML = `
        <button class="btn btn-secondary btn-sm" onclick="AuthView.setMode('login'); State.setView('auth');">User Sign In</button>
        <button class="btn btn-primary btn-sm" onclick="AuthView.setMode('admin-login'); State.setView('auth');">Admin Portal</button>
      `;
    } else {
      const user = State.user;
      navRight.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <div style="text-align: right;">
            <div style="font-size: 0.85rem; font-weight: 600;">${user.firstName || user.email}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${user.roles.join(', ')}</div>
          </div>
          ${State.isAdmin ? `
            <button class="btn btn-secondary btn-sm" onclick="State.setView(State.currentView === 'admin' ? 'user' : 'admin')">
              ${State.currentView === 'admin' ? '👤 Switch to User View' : '🛡️ Switch to Admin View'}
            </button>
          ` : ''}
          <button class="btn btn-danger btn-sm" onclick="App.handleLogout()">Logout</button>
        </div>
      `;
    }
  },

  currentRenderedView: null,

  renderCurrentView(force = false) {
    const container = document.getElementById('main-content');
    if (!container) return;

    let targetView = 'auth';
    if (State.isAuthenticated) {
      targetView = (State.currentView === 'admin' && State.isAdmin) ? 'admin' : 'user';
    }

    if (!force && this.currentRenderedView === targetView) {
      return;
    }
    this.currentRenderedView = targetView;

    if (targetView === 'auth') {
      AuthView.render(container);
    } else if (targetView === 'admin') {
      AdminView.render(container);
    } else {
      UserView.render(container);
    }
  },

  async handleLogout() {
    try {
      await API.logout();
    } catch {
      // ignore
    }
    API.setToken('');
    this.currentRenderedView = null;
    State.clearUser();
    this.showToast('You have been logged out safely.', 'info');
    State.setView('auth');
    AuthView.setMode('login');
    this.renderCurrentView(true);
  },

  closeModal() {
    const modal = document.getElementById('app-modal');
    if (modal) modal.classList.remove('active');
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icons = { success: '✔', error: '✖', warning: '⚠️', info: 'ℹ️' };
    toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span> <span>${message}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
};

window.addEventListener('DOMContentLoaded', () => {
  App.init();
});
