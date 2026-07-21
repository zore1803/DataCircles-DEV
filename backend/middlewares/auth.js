const { expressjwt: jwt } = require('express-jwt');
const jwksRsa = require('jwks-rsa');
const { jwtDecode } = require('jwt-decode');
const jsonwebtoken = require('jsonwebtoken');

module.exports = (req, res, next) => {
  // Log headers for debugging
  // console.log('Request Headers:', {
  //   authorization: req.headers.authorization,
  //   'x-phone-token': req.headers['x-phone-token'],
  // });

  // Extract token from Authorization header or x-phone-token
  let token = req.headers.authorization?.split(' ')[1];
  if (!token && req.headers['x-phone-token']) {
    token = req.headers['x-phone-token'];
    // console.log('Using x-phone-token:', token);
  }

  if (!token) {
    // console.log('No token provided');
    return res.status(401).json({ message: 'No token provided' });
  }

  // Decode token to check the 'sub' claim
  let decoded;
  try {
    decoded = jwtDecode(token);
    // console.log('Decoded token:', decoded);
    if (decoded._id && !decoded.sub) {
      // SuperAdmin token — verify signature before trusting it
      try {
        const verified = jsonwebtoken.verify(token, process.env.SUPER_ADMIN_JWT_SECRET, { algorithms: ['HS256'] });
        req.auth = verified;
        return next();
      } catch (verifyErr) {
        return res.status(401).json({ message: 'Invalid token' });
      }
    }
  } catch (err) {
    console.error('Token decoding failed:', err);
    return res.status(401).json({ message: 'Invalid token format' });
  }

  // Handle phone-based JWT tokens (sub starts with 'phone|')
  if (decoded.sub &&
    (decoded.sub.startsWith('temp-phone|') || decoded.sub.startsWith('phone|'))) {
    // console.log('Processing phone token');
    try {
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        console.error('JWT_SECRET is not defined');
        return res.status(500).json({ message: 'Server configuration error' });
      }

      jsonwebtoken.verify(token, secret, {
        algorithms: ['HS256'],
      });

      req.auth = decoded;
      // console.log('Phone token validated, req.auth:', req.auth);
      next();
    } catch (err) {
      console.error('Phone token validation failed:', err);
      return res.status(401).json({ message: 'Invalid phone token', error: err.message });
    }
  } else if (decoded.sub && decoded.sub.startsWith('password|')) {
    // Handle local email/password login tokens (sub starts with 'password|')
    try {
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        console.error('JWT_SECRET is not defined');
        return res.status(500).json({ message: 'Server configuration error' });
      }

      jsonwebtoken.verify(token, secret, {
        algorithms: ['HS256'],
      });

      req.auth = decoded;
      next();
    } catch (err) {
      console.error('Password token validation failed:', err);
      return res.status(401).json({ message: 'Invalid token', error: err.message });
    }
  } else {
    // Handle Auth0-based JWT tokens
    // console.log('Processing Auth0 token');
    if (!process.env.AUTH0_DOMAIN || !process.env.AUTH0_AUDIENCE) {
      console.error("Auth0 configuration missing in .env");
      return res.status(500).json({ message: "Auth server configuration error" });
    }
    
    const auth0Jwt = jwt({
      secret: jwksRsa.expressJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
      }),
      audience: process.env.AUTH0_AUDIENCE,
      issuer: `https://${process.env.AUTH0_DOMAIN}/`,
      algorithms: ['RS256'],
    });

    auth0Jwt(req, res, (err) => {
      if (err) {
        console.error('Auth0 token validation failed:', err);
        return res.status(401).json({ message: 'Invalid Auth0 token', error: err.message });
      }
      req.auth = req.auth || decoded;
      // console.log('Auth0 token validated, req.auth:', req.auth);
      next();
    });
  }
};