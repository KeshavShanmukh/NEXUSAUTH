/**
 * Reactive Client State Management
 */

const State = {
  user: null,
  isAuthenticated: false,
  isAdmin: false,
  currentView: 'auth', // 'auth', 'user', 'admin'
  userQuotas: null,
  userResumes: [],
  userUsageSummary: null,
  adminAnalytics: null,
  activeAdminTab: 'analytics', // 'analytics', 'users', 'admins', 'audit', 'plans'
  listeners: [],

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  },

  notify(eventType = 'general') {
    for (const listener of this.listeners) {
      listener(this, eventType);
    }
  },

  setUser(userData) {
    this.user = userData;
    this.isAuthenticated = !!userData;
    this.isAdmin = userData?.roles?.some(r => ['super_admin', 'support_admin', 'auditor'].includes(r)) || false;
    this.notify('auth_change');
  },

  clearUser() {
    this.user = null;
    this.isAuthenticated = false;
    this.isAdmin = false;
    this.userQuotas = null;
    this.userResumes = [];
    this.userUsageSummary = null;
    this.adminAnalytics = null;
    this.notify('auth_change');
  },

  setView(viewName) {
    if (this.currentView === viewName) return;
    this.currentView = viewName;
    this.notify('view_change');
  },

  setAdminTab(tabName) {
    if (this.activeAdminTab === tabName) return;
    this.activeAdminTab = tabName;
    this.notify('tab_change');
  },

  setQuotas(quotasData) {
    this.userQuotas = quotasData;
    // Do NOT notify full view_change to avoid re-rendering loops
  },

  setResumes(resumesList) {
    this.userResumes = resumesList;
    // Do NOT notify full view_change to avoid re-rendering loops
  },

  setAdminAnalytics(analyticsData) {
    this.adminAnalytics = analyticsData;
  }
};
