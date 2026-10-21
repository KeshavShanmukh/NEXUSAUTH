function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required.'
      }
    });
  }

  const adminRoles = ['super_admin', 'support_admin', 'auditor'];
  const hasAdminRole = req.user.roles.some(r => adminRoles.includes(r));

  if (!hasAdminRole) {
    return res.status(403).json({
      error: {
        code: 'FORBIDDEN_ADMIN_ONLY',
        message: 'Administrative privileges are required to perform this action.',
        correlationId: req.correlationId
      }
    });
  }

  next();
}

function requireSuperAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required.'
      }
    });
  }

  if (!req.user.roles.includes('super_admin')) {
    return res.status(403).json({
      error: {
        code: 'FORBIDDEN_SUPER_ADMIN_ONLY',
        message: 'Super Administrator privileges are required for this high-risk operation.',
        correlationId: req.correlationId
      }
    });
  }

  next();
}

function requirePermission(permissionName) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required.'
        }
      });
    }

    if (!req.user.permissions.includes(permissionName) && !req.user.roles.includes('super_admin')) {
      return res.status(403).json({
        error: {
          code: 'PERMISSION_DENIED',
          message: `Permission denied: Missing required permission "${permissionName}".`,
          correlationId: req.correlationId
        }
      });
    }

    next();
  };
}

module.exports = {
  requireAdmin,
  requireSuperAdmin,
  requirePermission
};
