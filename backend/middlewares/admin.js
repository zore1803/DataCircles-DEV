// middlewares/admin.js
function adminMiddleware(req, res, next) {
  if (req.superAdmin) {
    return next();
  }

  // 2. Check if req.user exists safely
  if (!req.user) {
    return res.status(401).json({ error: 'User context not found. Please authenticate.' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied: Admins only' });
  }
  next();
}

module.exports = adminMiddleware;