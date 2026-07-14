// utils/logger.js
const UserAuditLog = require('../models/UserAuditLog');

const logUserAction = async ({
  organization,
  performedBy,
  action,
  targetEmail,
  targetPermissions = [],
  details = {},
  req,
}) => {
  try {
    const log = new UserAuditLog({
      organization,
      performedBy,
      action,
      targetEmail,
      targetPermissions: targetPermissions.map(p => `${p.name}:${p.permission}`),
      details,
      ipAddress: req?.ip || req?.headers['x-forwarded-for']?.split(',')[0] || 'unknown',
      userAgent: req?.headers['user-agent'] || 'unknown',
    });
    await log.save();
  } catch (err) {
    console.error('Failed to log user action:', err);
  }
};

module.exports = { logUserAction };