import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AdminModel } from '../models/admin.model.js';
import { config } from '../config/env.js';

export const AuthService = {
  async login(username, password) {
    if (!username || !password) {
      const err = new Error('Username and password are required');
      err.status = 400;
      throw err;
    }

    const admin = await AdminModel.findByUsername(username.trim());
    if (!admin) {
      const err = new Error('Invalid username or password');
      err.status = 401;
      throw err;
    }

    const match = await bcrypt.compare(password, admin.password_hash);
    if (!match) {
      const err = new Error('Invalid username or password');
      err.status = 401;
      throw err;
    }

    const token = jwt.sign(
      { id: admin.id, username: admin.username },
      config.jwtSecret,
      { expiresIn: '8h' }
    );

    return {
      token,
      admin: {
        id: admin.id,
        username: admin.username,
      },
    };
  },
};
