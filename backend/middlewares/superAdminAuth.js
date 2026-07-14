const jwt = require('jsonwebtoken');
const SuperAdmin = require('../models/SuperAdmin');

module.exports = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No authentication token' });
    }

    const decoded = jwt.verify(token, process.env.SUPER_ADMIN_JWT_SECRET);
    
    const superAdmin = await SuperAdmin.findOne({
      _id: decoded._id,
    });

    if (!superAdmin) {
      return res.status(401).json({ message: 'Invalid authentication' });
    }

    req.superAdmin = superAdmin;
    req.token = token;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Authentication failed' });
  }
};