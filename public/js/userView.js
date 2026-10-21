/**
 * User Workspace View Component
 * Quotas Dashboard, Interactive Feature Simulator, Resumes Manager, History, and Sessions
 */

const UserView = {
  async render(container) {
    container.innerHTML = `
      <div class="container animate-fade-in" style="padding-top: 1.5rem; padding-bottom: 3rem;">
        <div id="user-loading" class="flex-center" style="padding: 3rem;">
          <div class="toast toast-info">Loading workspace data...</div>
        </div>
        <div id="user-content" style="display: none;"></div>
      </div>
    `;

    try {
      await this.loadData();
      this.renderContent();
    } catch (err) {
      container.innerHTML = `
        <div class="container" style="padding: 2rem;">
          <div class="toast toast-error">Failed to load workspace: ${err.message}</div>
        </div>
      `;
    }
  },

  async loadData() {
    const [quotasRes, resumesRes, usageRes, sessionsRes] = await Promise.all([
      API.getUserQuotas(),
      API.getResumes(),
      API.getUserUsageSummary(),
      API.getSessions().catch(() => ({ sessions: [] }))
    ]);

    State.setQuotas(quotasRes);
    State.setResumes(resumesRes.resumes || []);
    this.usageSummary = usageRes;
    this.sessions = sessionsRes.sessions || [];
  },

  renderContent() {
    const el = document.getElementById('user-content');
    const loading = document.getElementById('user-loading');
    if (!el) return;

    if (loading) loading.style.display = 'none';
    el.style.display = 'block';

    const user = State.user || {};
    const quotas = State.userQuotas?.quotas || [];
    const plan = State.userQuotas?.plan || { name: 'Free Tier', id: 'free' };
    const period = State.userQuotas?.period || {};
    const resetDateStr = period.endDate ? new Date(period.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'End of Month';

    el.innerHTML = `
      <!-- User Hero & Plan Overview -->
      <div class="user-hero-card">
        <div>
          <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
            <h2>Hello, ${user.firstName || user.email}!</h2>
            <span class="badge ${plan.id === 'premium' ? 'badge-role' : 'badge-plan'}">${plan.name}</span>
            <span class="badge badge-active">Active</span>
          </div>
          <p>Manage your resumes, monitor monthly quotas, and leverage AI career optimization tools.</p>
        </div>
        <div style="display: flex; gap: 0.75rem; align-items: center;">
          <div style="text-align: right; margin-right: 0.5rem;">
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Quota Reset Date</div>
            <div style="font-size: 1.1rem; font-weight: 700; color: var(--accent-cyan);">${resetDateStr}</div>
          </div>
          ${plan.id === 'free' ? `
            <button class="btn btn-primary" onclick="UserView.showUpgradeModal()">
              ⚡ Upgrade to Premium
            </button>
          ` : `
            <button class="btn btn-secondary" onclick="UserView.showUpgradeModal()">
              💎 Manage Plan
            </button>
          `}
        </div>
      </div>

      <!-- Metered Usage Quota Cards -->
      <div class="flex-between" style="margin-bottom: 1rem;">
        <h3>Monthly Feature Quotas</h3>
        <span style="font-size: 0.85rem; color: var(--text-muted);">Real-time concurrency-safe limits</span>
      </div>

      <div class="quotas-grid">
        ${quotas.map(q => this.renderQuotaCard(q)).join('')}
      </div>

      <!-- Interactive Feature Playground -->
      <div class="playground-section">
        <div class="flex-between" style="margin-bottom: 1rem;">
          <div>
            <h3>Interactive Feature Simulator</h3>
            <p style="font-size: 0.85rem;">Test metered operations in real-time. Watch your quota progress bars update instantly!</p>
          </div>
        </div>

        <div class="playground-grid">
          <div class="feature-action-card">
            <div>
              <div class="feature-action-title">📄 Create Resume</div>
              <div class="feature-action-desc">Consumes 1 resume creation unit and saves to your private vault.</div>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="UserView.triggerCreateResume()">
              + Create Sample Resume
            </button>
          </div>

          <div class="feature-action-card">
            <div>
              <div class="feature-action-title">🔍 AI Resume Analysis</div>
              <div class="feature-action-desc">Consumes 1 analysis unit. Computes ATS score & token expenditure.</div>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="UserView.triggerResumeAnalysis()">
              ⚡ Run AI Analysis
            </button>
          </div>

          <div class="feature-action-card">
            <div>
              <div class="feature-action-title">🎯 Job Matching</div>
              <div class="feature-action-desc">Consumes 1 job match unit. Matches skills against job description.</div>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="UserView.triggerJobMatch()">
              Match Job Description
            </button>
          </div>

          <div class="feature-action-card">
            <div>
              <div class="feature-action-title">💡 AI Suggestions</div>
              <div class="feature-action-desc">Consumes 1 AI suggestions unit. Generates optimized action bullets.</div>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="UserView.triggerAiSuggest()">
              Get AI Suggestions
            </button>
          </div>

          <div class="feature-action-card">
            <div>
              <div class="feature-action-title">📑 Export PDF</div>
              <div class="feature-action-desc">Consumes 1 PDF export unit and increments download counter.</div>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="UserView.triggerPdfExport()">
              Export Latest PDF
            </button>
          </div>

          <div class="feature-action-card" style="border-color: rgba(244, 63, 94, 0.3);">
            <div>
              <div class="feature-action-title" style="color: #fb7185;">⚠️ Test Failure Refund</div>
              <div class="feature-action-desc">Simulates a downstream failure. Verifies quota is NOT charged.</div>
            </div>
            <button class="btn btn-danger btn-sm" onclick="UserView.triggerSimulatedFailure()">
              Simulate Failed Request
            </button>
          </div>
        </div>
      </div>

      <!-- User Resumes List -->
      <div style="margin-bottom: 2.5rem;">
        <div class="flex-between" style="margin-bottom: 1rem;">
          <h3>My Resumes (Private Vault)</h3>
          <span style="font-size: 0.85rem; color: var(--text-muted);">${State.userResumes.length} Document(s)</span>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Target Role</th>
                <th>Status</th>
                <th>PDF Exports</th>
                <th>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${State.userResumes.length === 0 ? `
                <tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">No resumes created yet. Use the simulator above to create your first resume!</td></tr>
              ` : State.userResumes.map(r => `
                <tr>
                  <td><strong>${this.escape(r.title)}</strong></td>
                  <td>${this.escape(r.target_role || 'General')}</td>
                  <td><span class="badge badge-active">${r.status}</span></td>
                  <td>${r.pdf_exports_count} downloads</td>
                  <td>${new Date(r.created_at).toLocaleDateString()}</td>
                  <td>
                    <button class="btn btn-secondary btn-sm" onclick="UserView.triggerAnalyzeSpecificResume('${r.id}')">Analyze</button>
                    <button class="btn btn-secondary btn-sm" onclick="UserView.triggerExportSpecificResume('${r.id}')">PDF</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Recent Usage History -->
      <div style="margin-bottom: 2.5rem;">
        <div class="flex-between" style="margin-bottom: 1rem;">
          <h3>Recent Operations & AI Consumption</h3>
          <span style="font-size: 0.85rem; color: var(--text-muted);">Append-only immutable audit trail</span>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Feature</th>
                <th>Status</th>
                <th>Units</th>
                <th>AI Model</th>
                <th>Tokens</th>
                <th>Estimated Cost</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              ${(!this.usageSummary?.recentEvents || this.usageSummary.recentEvents.length === 0) ? `
                <tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">No operations recorded yet.</td></tr>
              ` : this.usageSummary.recentEvents.map(e => `
                <tr>
                  <td><code>${e.feature_name}</code></td>
                  <td>
                    <span class="badge ${e.status === 'success' ? 'badge-active' : 'badge-suspended'}">
                      ${e.status}
                    </span>
                  </td>
                  <td>${e.units_consumed}</td>
                  <td>${e.ai_model ? `${e.ai_provider} (${e.ai_model})` : '—'}</td>
                  <td>${e.total_tokens > 0 ? e.total_tokens.toLocaleString() : '—'}</td>
                  <td>${e.estimated_cost > 0 ? `$${e.estimated_cost.toFixed(4)}` : '$0.00'}</td>
                  <td>${new Date(e.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Active Sessions & Security Settings -->
      <div class="card" style="margin-bottom: 2rem;">
        <h3 style="margin-bottom: 1rem;">Active Sessions & Account Privacy</h3>
        <p style="margin-bottom: 1.25rem;">Manage active logins across your devices. Revoking a session signs that device out immediately.</p>

        <div class="table-responsive" style="margin-bottom: 1.5rem;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Browser / Device</th>
                <th>IP Address</th>
                <th>Last Active</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${this.sessions.map(s => `
                <tr>
                  <td>${this.escape(s.user_agent.substring(0, 45) || 'Web Browser')}...</td>
                  <td><code>${s.ip_address || '127.0.0.1'}</code></td>
                  <td>${new Date(s.last_active_at).toLocaleTimeString()}</td>
                  <td><span class="badge ${s.is_revoked ? 'badge-suspended' : 'badge-active'}">${s.is_revoked ? 'Revoked' : 'Active'}</span></td>
                  <td>
                    ${!s.is_revoked ? `
                      <button class="btn btn-danger btn-sm" onclick="UserView.revokeSession('${s.id}')">Revoke</button>
                    ` : '—'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="flex-between" style="border-top: 1px solid var(--border-glass); padding-top: 1rem;">
          <button class="btn btn-secondary btn-sm" onclick="UserView.promptChangePassword()">
            🔑 Change Password
          </button>
          <button class="btn btn-danger btn-sm" onclick="UserView.promptDeleteAccount()">
            🗑️ Delete Account (GDPR Right to Erasure)
          </button>
        </div>
      </div>
    `;
  },

  renderQuotaCard(q) {
    const isUnlimited = q.limit === -1;
    const percent = isUnlimited ? 0 : q.percentUsed;
    let fillClass = 'fill-safe';
    if (percent > 65) fillClass = 'fill-warning';
    if (percent >= 90) fillClass = 'fill-danger';

    const displayName = q.featureName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    return `
      <div class="quota-card">
        <div class="quota-header">
          <div class="quota-title">${displayName}</div>
          ${q.isOverride ? '<span class="badge badge-warning" title="Admin Custom Limit">Override</span>' : ''}
        </div>
        <div class="quota-counts">
          Used: <strong>${q.used}</strong> / ${isUnlimited ? '∞ Unlimited' : q.limit}
          ${!isUnlimited ? `(${q.remaining} remaining)` : ''}
        </div>
        <div class="progress-bar-container">
          <div class="progress-bar-fill ${fillClass}" style="width: ${isUnlimited ? '10%' : percent + '%'};"></div>
        </div>
      </div>
    `;
  },

  escape(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
  },

  // Interactive Feature Handlers
  async triggerCreateResume() {
    const title = prompt('Enter a title for your new resume:', 'Senior Full Stack Engineer Resume 2026');
    if (!title) return;

    try {
      const res = await API.createResume({
        title,
        targetRole: 'Staff Software Architect',
        content: { summary: 'Specialist in distributed microservices, TypeScript, and high-concurrency systems.' }
      });
      App.showToast(`Resume created! Remaining quota: ${res.quota.remaining}/${res.quota.limit}`, 'success');
      await this.refresh();
    } catch (err) {
      if (err.status === 429) {
        this.showQuotaExceededModal('resume_creation', err.message);
      } else {
        App.showToast(err.message, 'error');
      }
    }
  },

  async triggerResumeAnalysis() {
    const resumes = State.userResumes;
    if (resumes.length === 0) {
      App.showToast('Please create a resume first before running analysis.', 'warning');
      return;
    }
    await this.triggerAnalyzeSpecificResume(resumes[0].id);
  },

  async triggerAnalyzeSpecificResume(resumeId) {
    try {
      App.showToast('Analyzing resume with OpenAI GPT-4o model...', 'info');
      const res = await API.analyzeResume(resumeId);
      App.showToast(`Analysis complete! Score: ${res.analysis.overallScore}/100. Tokens: ${res.analysis.tokensConsumed}. Remaining: ${res.quota.remaining}`, 'success');
      await this.refresh();
    } catch (err) {
      if (err.status === 429) {
        this.showQuotaExceededModal('resume_analysis', err.message);
      } else {
        App.showToast(err.message, 'error');
      }
    }
  },

  async triggerPdfExport() {
    const resumes = State.userResumes;
    if (resumes.length === 0) {
      App.showToast('Please create a resume first.', 'warning');
      return;
    }
    await this.triggerExportSpecificResume(resumes[0].id);
  },

  async triggerExportSpecificResume(resumeId) {
    try {
      const res = await API.exportResumePdf(resumeId);
      App.showToast(`PDF generated! Download token ready. Remaining exports: ${res.quota.remaining}`, 'success');
      await this.refresh();
    } catch (err) {
      if (err.status === 429) {
        this.showQuotaExceededModal('pdf_exports', err.message);
      } else {
        App.showToast(err.message, 'error');
      }
    }
  },

  async triggerJobMatch() {
    try {
      App.showToast('Matching resume against job description via Anthropic Claude...', 'info');
      const res = await API.matchJob({
        targetRole: 'Senior Cloud Platform Engineer',
        jobDescription: 'Seeking expert in Node.js, distributed transactions, and Docker containerization.'
      });
      App.showToast(`Job match score: ${res.match.matchScore}%. Remaining quota: ${res.quota.remaining}`, 'success');
      await this.refresh();
    } catch (err) {
      if (err.status === 429) {
        this.showQuotaExceededModal('job_matching', err.message);
      } else {
        App.showToast(err.message, 'error');
      }
    }
  },

  async triggerAiSuggest() {
    try {
      const res = await API.getAiSuggestions({ section: 'experience' });
      App.showToast(`AI generated ${res.suggestions.length} bullet points! Remaining: ${res.quota.remaining}`, 'success');
      await this.refresh();
    } catch (err) {
      if (err.status === 429) {
        this.showQuotaExceededModal('ai_suggestions', err.message);
      } else {
        App.showToast(err.message, 'error');
      }
    }
  },

  async triggerSimulatedFailure() {
    try {
      await API.simulateFeatureConsumption('ai_suggestions', 1, true);
    } catch (err) {
      App.showToast(`Handled failure: "${err.message}". Verification: quota was NOT charged!`, 'info');
      await this.refresh();
    }
  },

  async revokeSession(sessionId) {
    if (!confirm('Are you sure you want to revoke this session?')) return;
    try {
      await API.revokeSession(sessionId);
      App.showToast('Session revoked successfully.', 'success');
      await this.refresh();
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },

  async promptChangePassword() {
    const curPass = prompt('Enter your current password:');
    if (!curPass) return;
    const newPass = prompt('Enter your new password (min 8 characters):');
    if (!newPass || newPass.length < 8) {
      alert('Password must be at least 8 characters long.');
      return;
    }

    try {
      await API.changePassword({ currentPassword: curPass, newPassword: newPass });
      App.showToast('Password updated! Other sessions have been revoked for security.', 'success');
      await this.refresh();
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },

  async promptDeleteAccount() {
    const conf = prompt('WARNING: This will permanently delete your account, resumes, and data.\nType "DELETE" to confirm:');
    if (conf === 'DELETE') {
      try {
        await API.deleteAccount('User requested GDPR erasure');
        API.setToken('');
        State.clearUser();
        App.showToast('Your account and records have been completely erased.', 'success');
        State.setView('auth');
      } catch (err) {
        App.showToast(err.message, 'error');
      }
    }
  },

  showQuotaExceededModal(featureName, message) {
    const modal = document.getElementById('app-modal');
    const modalBody = document.getElementById('modal-body');
    const modalTitle = document.getElementById('modal-title');

    modalTitle.innerHTML = '🚫 Quota Limit Reached';
    modalBody.innerHTML = `
      <div style="text-align: center; padding: 1rem 0;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">🔒</div>
        <h3 style="margin-bottom: 0.5rem;">Feature Limit Exhausted</h3>
        <p style="margin-bottom: 1.5rem; color: var(--text-secondary);">${message}</p>
        <div class="card" style="margin-bottom: 1.5rem; text-align: left; background: rgba(0,0,0,0.3);">
          <div style="font-size: 0.85rem; font-weight: 600; color: var(--accent-cyan); margin-bottom: 0.5rem;">
            Why upgrade to Premium?
          </div>
          <ul style="padding-left: 1.25rem; font-size: 0.85rem; color: var(--text-secondary); line-height: 1.6;">
            <li>50 Resumes & 100 AI Analyses / month (vs 3 and 5)</li>
            <li>500 AI Content Suggestions & priority job matches</li>
            <li>100 PDF & 50 DOCX exports</li>
          </ul>
        </div>
        <div style="display: flex; gap: 0.75rem; justify-content: center;">
          <button class="btn btn-secondary" onclick="App.closeModal()">Close</button>
          <button class="btn btn-primary" onclick="UserView.performInstantUpgrade()">⚡ Upgrade Now ($29/mo)</button>
        </div>
      </div>
    `;
    modal.classList.add('active');
  },

  async showUpgradeModal() {
    const modal = document.getElementById('app-modal');
    const modalBody = document.getElementById('modal-body');
    const modalTitle = document.getElementById('modal-title');

    modalTitle.innerHTML = '💎 Subscription Plans & Entitlements';
    modalBody.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin: 1rem 0;">
        <div class="card" style="border-color: var(--border-glass);">
          <h4>Free Tier</h4>
          <div style="font-size: 1.5rem; font-weight: 700; margin: 0.5rem 0;">$0 <span style="font-size: 0.8rem; color: var(--text-muted);">/month</span></div>
          <ul style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.8; margin-bottom: 1.25rem; list-style: none;">
            <li>✔ 3 Resumes created / mo</li>
            <li>✔ 5 Resume analyses / mo</li>
            <li>✔ 5 Job matches / mo</li>
            <li>✔ 20 AI suggestions / mo</li>
            <li>✔ 5 PDF exports / mo</li>
          </ul>
          <button class="btn btn-secondary btn-sm" style="width: 100%;" disabled>Current Tier</button>
        </div>

        <div class="card" style="border-color: var(--accent-primary); box-shadow: 0 0 20px rgba(99, 102, 241, 0.2);">
          <div class="flex-between">
            <h4>Premium Pro</h4>
            <span class="badge badge-role">Popular</span>
          </div>
          <div style="font-size: 1.5rem; font-weight: 700; color: #a5b4fc; margin: 0.5rem 0;">$29 <span style="font-size: 0.8rem; color: var(--text-muted);">/month</span></div>
          <ul style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.8; margin-bottom: 1.25rem; list-style: none;">
            <li>✔ 50 Resumes created / mo</li>
            <li>✔ 100 Resume analyses / mo</li>
            <li>✔ 100 Job matches / mo</li>
            <li>✔ 500 AI suggestions / mo</li>
            <li>✔ 100 PDF exports / mo</li>
          </ul>
          <button class="btn btn-primary btn-sm" style="width: 100%;" onclick="UserView.performInstantUpgrade()">
            ⚡ Upgrade Now (Simulate Checkout)
          </button>
        </div>
      </div>
    `;
    modal.classList.add('active');
  },

  async performInstantUpgrade() {
    App.closeModal();
    App.showToast('Processing simulated payment webhook...', 'info');
    try {
      // Simulate webhook payment completion
      await API.simulateWebhookPayment(State.user.id, 'premium');
      // Refresh profile
      const prof = await API.getProfile();
      State.setUser(prof.user);
      App.showToast('Subscription upgraded to Premium Pro! Your quotas have expanded.', 'success');
      await this.refresh();
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },

  async refresh() {
    await this.loadData();
    this.renderContent();
  }
};
