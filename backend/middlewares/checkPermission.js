// middlewares/checkPermission.js (updated)
const User = require("../models/User");

const checkPermission = (resourceName, requiredPermission = 'readonly') => {
  return async (req, res, next) => {
    try {
      const user = req.user;

      if (!user || !user.organization) {
        return res.status(401).json({ message: 'Unauthorized user' });
      }

      const matchedPermission = user.permissions.find(
        (perm) => perm.name?.toLowerCase() === resourceName?.toLowerCase()
      );

      if (!matchedPermission) {
        return res.status(403).json({ message: 'No access given by admin' });
      }

      const userPerm = matchedPermission.permission;

      if (userPerm === 'read-write') {
        return next();
      }

      if (requiredPermission === 'readonly' && userPerm === 'readonly') {
        return next();
      }

      return res.status(403).json({ message: 'No access given by admin' });

    } catch (err) {
      console.error('Permission check failed:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
  };
};

module.exports = checkPermission;