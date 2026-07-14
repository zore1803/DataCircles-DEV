// import rateLimit from 'express-rate-limit';

const rateLimit = require("express-rate-limit");

// Helper function to extract real IP
const getClientIp = (req) => {
  return (
    req.headers['cf-connecting-ip'] ||
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.connection.remoteAddress ||
    'unknown'
  );
};

// Send OTP rate limiter: 3 requests per minute per IP
exports.sendOtpLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
  handler: (req, res) => {
    res.status(429).json({
      message: 'Too many OTP requests. Please wait before requesting another OTP.',
      retryAfter: req.rateLimit.resetTime,
    });
  },
});

// Verify OTP rate limiter: 5 attempts per 5 minutes per phone+IP
exports.verifyOtpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const ip = getClientIp(req);
    const phone = req.body.phone || 'unknown';
    return `${phone}:${ip}`;
  },
  skipSuccessfulRequests: true, // Don't count successful verifications
  handler: (req, res) => {
    res.status(429).json({
      message: 'Too many verification attempts. Please wait before trying again.',
      retryAfter: req.rateLimit.resetTime,
    });
  },
});

// Phone number specific limiter: 5 OTPs per hour per phone
exports.phoneOtpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  keyGenerator: (req) => req.body.phone || 'unknown',
  handler: (req, res) => {
    res.status(429).json({
      message: 'Maximum OTP limit reached for this number. Try again later.',
    });
  },
});

// Global rate limiter: 20 OTP-related requests per 15 minutes per IP
exports.globalOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => getClientIp(req),
  handler: (req, res) => {
    res.status(429).json({
      message: 'Too many requests. Your IP has been temporarily blocked.',
    });
  },
});