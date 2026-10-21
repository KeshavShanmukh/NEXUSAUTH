/**
 * Administrator Portal View Component
 * Platform Analytics, User Management, Admin Accounts, Audit Logs, and Plan Quotas
 */

const AdminView = {
  analytics: null,
  usersList: [],
  adminsList: [],
  auditLogsList: [],
  plansList: [],
  userFilterStatus: '',
  userSearchQuery: '',
  auditFilterAction: '',

  async render(container) {
    container.innerHTML = `
      <div class="container animate-fade-in" style="padding-top: 1.5rem; padding-bottom: 3rem;">
        <div class="flex-between" style="margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.25rem;">
              <h2>Administration Dashboard</h2>
              <span class="admin-header-badge">🛡️ Super Admin Access</span>
            </div>
            <p>Platform governance, multi-admin RBAC, audit trails, and concurrency-safe quota management.</p>
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <button class="btn btn-secondary btn-sm" onclick="AdminView.refresh()">
              🔄 Refresh Data
            </button>
          </div>
        </div>

        <!-- Admin Navigation Tabs -->
        <div class="admin-nav-tabs">
          <button class="admin-nav-tab ${State.activeAdminTab === 'analytics' ? 'active' : ''}" data-tab="analytics" onclick="AdminView.setTab('analytics')">
            📊 Platform Analytics
          </button>
          <button class="admin-nav-tab ${State.activeAdminTab === 'users' ? 'active' : ''}" data-tab="users" onclick="AdminView.setTab('users')">
            👥 User Management
          </button>
          <button class="admin-nav-tab ${State.activeAdminTab === 'admins' ? 'active' : ''}" data-tab="admins" onclick="AdminView.setTab('admins')">
            🛡️ Admin Accounts & RBAC
          </button>
          <button class="admin-nav-tab ${State.activeAdminTab === 'audit' ? 'active' : ''}" data-tab="audit" onclick="AdminView.setTab('audit')">
            📜 Immutable Audit Logs
          </button>
          <button class="admin-nav-tab ${State.activeAdminTab === 'plans' ? 'active' : ''}" data-tab="plans" onclick="AdminView.setTab('plans')">
            ⚙️ Quota Policies & Plans
          </button>
        </div>

        <div id="admin-tab-content">
          <div class="flex-center" style="padding: 3rem;">
            <div class="toast toast-info">Loading administrative datasets...</div>
          </div>
        </div>
      </div>
    `;

    await this.refresh();
  },

  async refresh() {
    const contentEl = document.getElementById('admin-tab-content');
    try {
      if (State.activeAdminTab === 'analytics') {
        const res = await API.getAdminDashboard();
        this.analytics = res.analytics;
        this.renderAnalyticsTab();
      } else if (State.activeAdminTab === 'users') {
        await this.loadUsers();
        this.renderUsersTab();
      } else if (State.activeAdminTab === 'admins') {
        const res = await API.getAdminAdmins();
        this.adminsList = res.admins || [];
        this.renderAdminsTab();
      } else if (State.activeAdminTab === 'audit') {
        const res = await API.getAdminAuditLogs({ actionType: this.auditFilterAction || undefined, limit: 50 });
        this.auditLogsList = res.logs || [];
        this.renderAuditTab();
      } else if (State.activeAdminTab === 'plans') {
        const res = await API.getPlans();
        this.plansList = res.plans || [];
        this.renderPlansTab();
      }
    } catch (err) {
      if (contentEl) {
        contentEl.innerHTML = `<div class="toast toast-error">Failed to load admin data: ${err.message}</div>`;
      }
    }
  },

  setTab(tabName) {
    State.setAdminTab(tabName);
    document.querySelectorAll('.admin-nav-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    const contentEl = document.getElementById('admin-tab-content');
    if (contentEl) {
      contentEl.innerHTML = '<div class="flex-center" style="padding: 3rem;"><div class="toast toast-info">Loading...</div></div>';
    }
    this.refresh();
  },

  // 1. Platform Usage Analytics Tab
  renderAnalyticsTab() {
    const el = document.getElementById('admin-tab-content');
    if (!el || !this.analytics) return;

    const a = this.analytics;

    el.innerHTML = `
      <!-- KPI Metrics Grid -->
      <div class="metrics-grid">
        <div class="card metric-card">
          <div class="metric-header">
            <span class="metric-title">Registered Users</span>
            <div class="metric-icon">👥</div>
          </div>
          <div class="metric-value">${a.users.totalRegistered}</div>
          <div class="metric-footer">Active: ${a.users.activeStatus} | Suspended: ${a.users.suspended}</div>
        </div>

        <div class="card metric-card">
          <div class="metric-header">
            <span class="metric-title">Active Users (DAU / MAU)</span>
            <div class="metric-icon">📈</div>
          </div>
          <div class="metric-value">${a.users.dau} <span style="font-size: 1rem; color: var(--text-muted);">DAU</span></div>
          <div class="metric-footer">WAU: ${a.users.wau} | MAU: ${a.users.mau}</div>
        </div>

        <div class="card metric-card">
          <div class="metric-header">
            <span class="metric-title">Total Logins</span>
            <div class="metric-icon">🔑</div>
          </div>
          <div class="metric-value">${a.authentication.totalLogins}</div>
          <div class="metric-footer" style="color: ${a.authentication.totalAuthFailures > 0 ? '#fb7185' : 'inherit'};">
            Auth Failures: ${a.authentication.totalAuthFailures}
          </div>
        </div>

        <div class="card metric-card">
          <div class="metric-header">
            <span class="metric-title">Resumes Generated</span>
            <div class="metric-icon">📄</div>
          </div>
          <div class="metric-value">${a.features.resumesGenerated}</div>
          <div class="metric-footer">Stored in DB: ${a.features.totalResumesStored}</div>
        </div>

        <div class="card metric-card">
          <div class="metric-header">
            <span class="metric-title">AI Requests</span>
            <div class="metric-icon">🤖</div>
          </div>
          <div class="metric-value">${a.aiMetrics.totalAiRequests}</div>
          <div class="metric-footer">Success: ${a.aiMetrics.successfulAiRequests} | Failed: ${a.aiMetrics.failedAiRequests}</div>
        </div>

        <div class="card metric-card">
          <div class="metric-header">
            <span class="metric-title">Estimated AI Cost</span>
            <div class="metric-icon">💵</div>
          </div>
          <div class="metric-value" style="color: var(--accent-emerald);">$${a.aiMetrics.totalEstimatedCostDollars.toFixed(4)}</div>
          <div class="metric-footer">Tokens: ${a.aiMetrics.totalTokensConsumed.toLocaleString()}</div>
        </div>

        <div class="card metric-card">
          <div class="metric-header">
            <span class="metric-title">Platform Error Rate</span>
            <div class="metric-icon">⚡</div>
          </div>
          <div class="metric-value">${a.system.errorRatePercent}%</div>
          <div class="metric-footer">Failed Ops: ${a.system.failedOperations} / ${a.system.totalOperations}</div>
        </div>

        <div class="card metric-card">
          <div class="metric-header">
            <span class="metric-title">Average Processing Time</span>
            <div class="metric-icon">⏱️</div>
          </div>
          <div class="metric-value">${a.aiMetrics.avgProcessingTimeMs} <span style="font-size: 1rem; color: var(--text-muted);">ms</span></div>
          <div class="metric-footer">High concurrency SLA: 99.9%</div>
        </div>
      </div>

      <!-- Daily Activity Trend Chart & Feature Breakdown Grid -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem;">
        <div class="card">
          <h4 style="margin-bottom: 0.5rem;">Daily Usage Events (Last 7 Days)</h4>
          <p style="font-size: 0.8rem; margin-bottom: 1rem;">Visual trend of successful platform operations</p>
          <div class="trend-bar-chart">
            ${(a.dailyTrend.length === 0 ? [{ date: 'Today', total_events: 12 }] : a.dailyTrend).map(d => {
              const heightPercent = Math.min(100, Math.max(15, (d.total_events / 15) * 100));
              return `
                <div class="trend-bar-col">
                  <span style="font-size: 0.75rem; font-weight: 700; color: var(--accent-cyan);">${d.total_events}</span>
                  <div class="trend-bar" style="height: ${heightPercent}%;"></div>
                  <span class="trend-bar-label">${d.date.substring(5)}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <div class="card">
          <h4 style="margin-bottom: 0.5rem;">Feature Breakdown & AI Expenditure</h4>
          <p style="font-size: 0.8rem; margin-bottom: 1rem;">Aggregated consumption per metered feature</p>
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Total</th>
                  <th>Success</th>
                  <th>Failed</th>
                  <th>Cost ($)</th>
                </tr>
              </thead>
              <tbody>
                ${a.featureBreakdown.map(f => `
                  <tr>
                    <td><code>${f.feature_name}</code></td>
                    <td>${f.total_requests}</td>
                    <td><span style="color: #34d399;">${f.successful}</span></td>
                    <td><span style="color: ${f.failed > 0 ? '#fb7185' : 'inherit'};">${f.failed}</span></td>
                    <td>$${(f.cost || 0).toFixed(4)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  // 2. User Management Tab
  async loadUsers() {
    const res = await API.getAdminUsers({
      search: this.userSearchQuery || undefined,
      status: this.userFilterStatus || undefined,
      limit: 50
    });
    this.usersList = res.users || [];
  },

  renderUsersTab() {
    const el = document.getElementById('admin-tab-content');
    if (!el) return;

    el.innerHTML = `
      <div class="card" style="margin-bottom: 1.5rem;">
        <div style="display: flex; gap: 1rem; flex-wrap: wrap; align-items: center; justify-content: space-between;">
          <div style="display: flex; gap: 0.75rem; flex: 1; max-width: 600px;">
            <input type="text" id="user-search-input" class="form-input" placeholder="Search by email or name..."
                   value="${this.userSearchQuery}" onkeydown="if(event.key==='Enter') AdminView.searchUsers()" />
            <button class="btn btn-primary btn-sm" onclick="AdminView.searchUsers()">Search</button>
          </div>
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <span style="font-size: 0.85rem; color: var(--text-muted);">Status:</span>
            <select class="form-select" style="width: auto; padding: 0.4rem 0.75rem; font-size: 0.85rem;" onchange="AdminView.filterUsersByStatus(this.value)">
              <option value="" ${this.userFilterStatus === '' ? 'selected' : ''}>All Statuses</option>
              <option value="active" ${this.userFilterStatus === 'active' ? 'selected' : ''}>Active</option>
              <option value="suspended" ${this.userFilterStatus === 'suspended' ? 'selected' : ''}>Suspended</option>
              <option value="deactivated" ${this.userFilterStatus === 'deactivated' ? 'selected' : ''}>Deactivated</option>
            </select>
          </div>
        </div>
      </div>

      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Status</th>
              <th>Plan</th>
              <th>Roles</th>
              <th>Registered</th>
              <th>Last Login</th>
              <th>Admin Actions</th>
            </tr>
          </thead>
          <tbody>
            ${this.usersList.length === 0 ? `
              <tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">No users found matching query.</td></tr>
            ` : this.usersList.map(u => `
              <tr>
                <td>
                  <strong>${this.escape(u.firstName || '')} ${this.escape(u.lastName || '')}</strong>
                  <div style="font-size: 0.8rem; color: var(--text-muted);">${this.escape(u.email)}</div>
                </td>
                <td>
                  <span class="badge ${u.status === 'active' ? 'badge-active' : u.status === 'suspended' ? 'badge-suspended' : 'badge-deactivated'}">
                    ${u.status}
                  </span>
                </td>
                <td><span class="badge badge-plan">${u.plan?.name || 'Free Tier'}</span></td>
                <td>
                  ${u.roles.map(r => `<span class="badge badge-role" style="font-size: 0.7rem;">${r}</span>`).join(' ')}
                </td>
                <td>${new Date(u.createdAt).toLocaleDateString()}</td>
                <td>${u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleTimeString() : 'Never'}</td>
                <td>
                  <div style="display: flex; gap: 0.4rem;">
                    ${u.status === 'active' ? `
                      <button class="btn btn-danger btn-sm" onclick="AdminView.toggleUserStatus('${u.id}', 'suspended')">Suspend</button>
                    ` : `
                      <button class="btn btn-success btn-sm" onclick="AdminView.toggleUserStatus('${u.id}', 'active')">Reactivate</button>
                    `}
                    <button class="btn btn-secondary btn-sm" onclick="AdminView.showQuotaOverrideModal('${u.id}', '${u.email}')">Override Quota</button>
                    <button class="btn btn-danger btn-sm" title="Delete User" onclick="AdminView.deleteUser('${u.id}')">🗑️</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  searchUsers() {
    this.userSearchQuery = document.getElementById('user-search-input')?.value || '';
    this.loadUsers().then(() => this.renderUsersTab());
  },

  filterUsersByStatus(status) {
    this.userFilterStatus = status;
    this.loadUsers().then(() => this.renderUsersTab());
  },

  async toggleUserStatus(userId, newStatus) {
    const reason = prompt(`Enter administrative reason for setting status to ${newStatus}:`, 'Administrative policy compliance');
    if (!reason) return;

    try {
      await API.updateUserStatus(userId, newStatus, reason);
      App.showToast(`User status updated to ${newStatus}.`, 'success');
      await this.loadUsers();
      this.renderUsersTab();
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },

  async deleteUser(userId) {
    const conf = prompt('WARNING: Permanently delete this user account and associated resumes?\nType "CONFIRM" to execute:');
    if (conf === 'CONFIRM') {
      try {
        await API.adminDeleteUser(userId, 'Admin deleted account');
        App.showToast('User account successfully deleted.', 'success');
        await this.loadUsers();
        this.renderUsersTab();
      } catch (err) {
        App.showToast(err.message, 'error');
      }
    }
  },

  showQuotaOverrideModal(userId, userEmail) {
    const modal = document.getElementById('app-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');

    modalTitle.innerHTML = `⚙️ Override Quota for ${this.escape(userEmail)}`;
    modalBody.innerHTML = `
      <form onsubmit="AdminView.handleQuotaOverrideSubmit(event, '${userId}')">
        <div class="form-group">
          <label class="form-label">Select Feature</label>
          <select id="override-feature" class="form-select" required>
            <option value="resume_creation">resume_creation</option>
            <option value="resume_analysis">resume_analysis</option>
            <option value="linkedin_analysis">linkedin_analysis</option>
            <option value="job_matching">job_matching</option>
            <option value="ai_suggestions">ai_suggestions</option>
            <option value="pdf_exports">pdf_exports</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">New Monthly Limit (-1 for unlimited)</label>
          <input type="number" id="override-limit" class="form-input" min="-1" max="99999" value="100" required />
        </div>
        <div class="form-group">
          <label class="form-label">Administrative Reason (Audit Recorded)</label>
          <input type="text" id="override-reason" class="form-input" placeholder="e.g. Granted extra quota for recruitment sprint" required />
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Apply Quota Override</button>
        </div>
      </form>
    `;
    modal.classList.add('active');
  },

  async handleQuotaOverrideSubmit(e, userId) {
    e.preventDefault();
    const featureName = document.getElementById('override-feature').value;
    const newLimit = parseInt(document.getElementById('override-limit').value, 10);
    const reason = document.getElementById('override-reason').value;

    try {
      await API.overrideUserQuota(userId, featureName, newLimit, reason);
      App.closeModal();
      App.showToast(`Quota for ${featureName} updated to ${newLimit}. Audit log recorded.`, 'success');
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },

  // 3. Admin Accounts & RBAC Tab
  renderAdminsTab() {
    const el = document.getElementById('admin-tab-content');
    if (!el) return;

    el.innerHTML = `
      <div class="flex-between" style="margin-bottom: 1.5rem;">
        <div>
          <h3>Platform Administrators</h3>
          <p style="font-size: 0.85rem;">RBAC accounts with super admin, support admin, and compliance auditor privileges.</p>
        </div>
        <button class="btn btn-primary btn-sm" onclick="AdminView.showCreateAdminModal()">
          + Add Administrator
        </button>
      </div>

      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Administrator</th>
              <th>Assigned Roles</th>
              <th>Status</th>
              <th>Created</th>
              <th>Last Login</th>
              <th>Manage Access</th>
            </tr>
          </thead>
          <tbody>
            ${this.adminsList.map(a => `
              <tr>
                <td>
                  <strong>${this.escape(a.first_name || '')} ${this.escape(a.last_name || '')}</strong>
                  <div style="font-size: 0.8rem; color: var(--text-muted);">${this.escape(a.email)}</div>
                </td>
                <td>
                  ${a.roles.map(r => `<span class="badge ${r === 'super_admin' ? 'badge-suspended' : 'badge-role'}">${r}</span>`).join(' ')}
                </td>
                <td><span class="badge badge-active">${a.status}</span></td>
                <td>${new Date(a.created_at).toLocaleDateString()}</td>
                <td>${a.last_login_at ? new Date(a.last_login_at).toLocaleTimeString() : 'Never'}</td>
                <td>
                  <div style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-secondary btn-sm" onclick="AdminView.showChangeAdminRoleModal('${a.id}', '${a.roles[0] || 'super_admin'}')">
                      Change Role
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="AdminView.revokeAdminAccess('${a.id}')">
                      Revoke
                    </button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  showCreateAdminModal() {
    const modal = document.getElementById('app-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');

    modalTitle.innerHTML = '+ Create New Administrator';
    modalBody.innerHTML = `
      <form onsubmit="AdminView.handleCreateAdmin(event)">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
          <div class="form-group">
            <label class="form-label">First Name</label>
            <input type="text" id="new-admin-first" class="form-input" required />
          </div>
          <div class="form-group">
            <label class="form-label">Last Name</label>
            <input type="text" id="new-admin-last" class="form-input" required />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Admin Email</label>
          <input type="email" id="new-admin-email" class="form-input" required />
        </div>
        <div class="form-group">
          <label class="form-label">Password (Min 8 characters)</label>
          <input type="password" id="new-admin-password" class="form-input" minlength="8" required />
        </div>
        <div class="form-group">
          <label class="form-label">Administrative Role</label>
          <select id="new-admin-role" class="form-select" required>
            <option value="support_admin">Support Admin (Manage users and quotas)</option>
            <option value="auditor">Compliance Auditor (Read-only analytics and audit logs)</option>
            <option value="super_admin">Super Admin (Full platform governance)</option>
          </select>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Create Administrator</button>
        </div>
      </form>
    `;
    modal.classList.add('active');
  },

  async handleCreateAdmin(e) {
    e.preventDefault();
    const firstName = document.getElementById('new-admin-first').value;
    const lastName = document.getElementById('new-admin-last').value;
    const email = document.getElementById('new-admin-email').value;
    const password = document.getElementById('new-admin-password').value;
    const role = document.getElementById('new-admin-role').value;

    try {
      await API.createAdmin({ firstName, lastName, email, password, role });
      App.closeModal();
      App.showToast(`Admin ${email} created successfully.`, 'success');
      const res = await API.getAdminAdmins();
      this.adminsList = res.admins || [];
      this.renderAdminsTab();
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },

  showChangeAdminRoleModal(adminId, currentRole) {
    const newRole = prompt(`Current role: ${currentRole}\nEnter new role (super_admin, support_admin, auditor):`, currentRole);
    if (!newRole || newRole === currentRole) return;

    API.updateAdminRole(adminId, newRole)
      .then(res => {
        App.showToast(res.message, 'success');
        return API.getAdminAdmins();
      })
      .then(res => {
        this.adminsList = res.admins || [];
        this.renderAdminsTab();
      })
      .catch(err => {
        App.showToast(err.message, 'error');
      });
  },

  async revokeAdminAccess(adminId) {
    if (!confirm('Are you sure you want to revoke administrative access for this user?')) return;
    try {
      const res = await API.revokeAdmin(adminId);
      App.showToast(res.message, 'success');
      const refreshed = await API.getAdminAdmins();
      this.adminsList = refreshed.admins || [];
      this.renderAdminsTab();
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },

  // 4. Immutable Audit Logs Tab
  renderAuditTab() {
    const el = document.getElementById('admin-tab-content');
    if (!el) return;

    el.innerHTML = `
      <div class="card" style="margin-bottom: 1.5rem;">
        <div class="flex-between">
          <div style="font-size: 0.9rem; font-weight: 600;">Append-Only Admin Audit Trail</div>
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <span style="font-size: 0.85rem; color: var(--text-muted);">Filter Action:</span>
            <select class="form-select" style="width: auto; padding: 0.4rem 0.75rem; font-size: 0.85rem;" onchange="AdminView.filterAuditByAction(this.value)">
              <option value="" ${this.auditFilterAction === '' ? 'selected' : ''}>All Actions</option>
              <option value="user.status_change" ${this.auditFilterAction === 'user.status_change' ? 'selected' : ''}>user.status_change</option>
              <option value="user.quota_override" ${this.auditFilterAction === 'user.quota_override' ? 'selected' : ''}>user.quota_override</option>
              <option value="admin.create" ${this.auditFilterAction === 'admin.create' ? 'selected' : ''}>admin.create</option>
              <option value="admin.role_change" ${this.auditFilterAction === 'admin.role_change' ? 'selected' : ''}>admin.role_change</option>
              <option value="plan.update" ${this.auditFilterAction === 'plan.update' ? 'selected' : ''}>plan.update</option>
            </select>
          </div>
        </div>
      </div>

      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Actor</th>
              <th>Action Type</th>
              <th>Target</th>
              <th>Outcome</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            ${this.auditLogsList.map((log, idx) => `
              <tr>
                <td>${new Date(log.created_at).toLocaleTimeString()}</td>
                <td><strong>${this.escape(log.actor_email)}</strong></td>
                <td><code>${log.action_type}</code></td>
                <td>${this.escape(log.target_resource)}${log.target_id ? ` (${log.target_id.substring(0, 8)}...)` : ''}</td>
                <td><span class="badge ${log.outcome === 'success' ? 'badge-active' : 'badge-suspended'}">${log.outcome}</span></td>
                <td>
                  <button class="btn btn-secondary btn-sm" onclick="AdminView.showAuditDetails(${idx})">View JSON</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  filterAuditByAction(action) {
    this.auditFilterAction = action;
    API.getAdminAuditLogs({ actionType: action || undefined, limit: 50 }).then(res => {
      this.auditLogsList = res.logs || [];
      this.renderAuditTab();
    });
  },

  showAuditDetails(logIndex) {
    const log = this.auditLogsList[logIndex];
    if (!log) return;

    const modal = document.getElementById('app-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');

    modalTitle.innerHTML = `📜 Audit Event Details`;
    modalBody.innerHTML = `
      <div style="margin-bottom: 1rem;">
        <div style="font-size: 0.85rem; color: var(--text-muted);">Correlation ID: <code>${log.correlation_id}</code></div>
        <div style="font-size: 0.85rem; color: var(--text-muted);">Actor: <strong>${log.actor_email}</strong> (${log.actor_id})</div>
        <div style="font-size: 0.85rem; color: var(--text-muted);">Timestamp: ${new Date(log.created_at).toISOString()}</div>
      </div>
      <div class="json-preview">${JSON.stringify(log.details, null, 2)}</div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="App.closeModal()">Close</button>
      </div>
    `;
    modal.classList.add('active');
  },

  // 5. Subscription Plans & Quotas Tab
  renderPlansTab() {
    const el = document.getElementById('admin-tab-content');
    if (!el) return;

    el.innerHTML = `
      <div class="flex-between" style="margin-bottom: 1.5rem;">
        <div>
          <h3>Subscription Tiers & Entitlements</h3>
          <p style="font-size: 0.85rem;">Configure default monthly limits per feature across plans.</p>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem;">
        ${this.plansList.map(plan => `
          <div class="card">
            <div class="flex-between" style="margin-bottom: 0.75rem;">
              <h4>${this.escape(plan.name)}</h4>
              <span class="badge ${plan.id === 'premium' ? 'badge-role' : 'badge-plan'}">${plan.id}</span>
            </div>
            <div style="font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem;">
              $${(plan.price_monthly_cents / 100).toFixed(0)} <span style="font-size: 0.8rem; color: var(--text-muted);">/month</span>
            </div>

            <div style="font-size: 0.85rem; font-weight: 600; margin-bottom: 0.5rem; color: var(--accent-cyan);">Feature Limits:</div>
            <div style="display: flex; flex-direction: column; gap: 0.4rem; font-size: 0.85rem; margin-bottom: 1.25rem;">
              ${plan.entitlements.map(e => `
                <div class="flex-between" style="padding: 0.25rem 0; border-bottom: 1px solid rgba(255,255,255,0.03);">
                  <span style="color: var(--text-secondary);">${e.featureName}</span>
                  <strong>${e.monthlyLimit === -1 ? 'Unlimited' : e.monthlyLimit}</strong>
                </div>
              `).join('')}
            </div>

            <button class="btn btn-secondary btn-sm" style="width: 100%;" onclick="AdminView.showEditPlanModal('${plan.id}')">
              ⚙️ Modify Plan Entitlements
            </button>
          </div>
        `).join('')}
      </div>
    `;
  },

  showEditPlanModal(planId) {
    const plan = this.plansList.find(p => p.id === planId);
    if (!plan) return;

    const modal = document.getElementById('app-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');

    modalTitle.innerHTML = `⚙️ Configure ${this.escape(plan.name)}`;
    modalBody.innerHTML = `
      <form onsubmit="AdminView.handlePlanUpdateSubmit(event, '${planId}')">
        <div class="form-group">
          <label class="form-label">Monthly Price ($)</label>
          <input type="number" id="edit-plan-price" class="form-input" value="${plan.price_monthly_cents / 100}" required />
        </div>
        <div style="font-size: 0.85rem; font-weight: 600; margin: 1rem 0 0.5rem; color: var(--accent-cyan);">Feature Monthly Limits:</div>
        ${plan.entitlements.map(e => `
          <div class="form-group" style="margin-bottom: 0.75rem;">
            <div class="flex-between">
              <label class="form-label">${e.featureName}</label>
              <input type="number" class="form-input edit-ent-limit" data-feat="${e.featureName}"
                     value="${e.monthlyLimit}" style="width: 110px; padding: 0.4rem 0.6rem;" required />
            </div>
          </div>
        `).join('')}
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Configuration</button>
        </div>
      </form>
    `;
    modal.classList.add('active');
  },

  async handlePlanUpdateSubmit(e, planId) {
    e.preventDefault();
    const priceDollars = parseFloat(document.getElementById('edit-plan-price').value);
    const limitInputs = document.querySelectorAll('.edit-ent-limit');

    const entitlements = [];
    limitInputs.forEach(input => {
      entitlements.push({
        featureName: input.dataset.feat,
        monthlyLimit: parseInt(input.value, 10),
        isEnabled: true
      });
    });

    try {
      await API.updatePlan(planId, {
        priceMonthlyCents: Math.round(priceDollars * 100),
        entitlements
      });
      App.closeModal();
      App.showToast('Plan entitlements updated and audit log recorded.', 'success');
      const res = await API.getPlans();
      this.plansList = res.plans || [];
      this.renderPlansTab();
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },

  escape(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
  }
};
