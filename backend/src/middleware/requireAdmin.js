import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

export function requireAdmin(req, res, next) {
  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized: Missing or malformed authorization token',
    });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.admin = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Unauthorized: Session expired. Please log in again.',
      });
    }
    return res.status(401).json({
      error: 'Unauthorized: Invalid token',
    });
  }
}

export default requireAdmin;
