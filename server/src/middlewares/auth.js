import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import ApiError from '../utils/ApiError.js';

export async function protect(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new ApiError(401, 'Not authenticated.');
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      throw new ApiError(401, 'Session expired. Please login again.');
    }
    const User = mongoose.model('User');
    const user = await User.findById(payload.id);
    if (!user || !user.active) throw new ApiError(401, 'Account not found or disabled.');
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

export const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return next(new ApiError(403, 'Only the admin can perform this action.'));
  }
  next();
};

export const staffAllowed = (req, res, next) => {
  if (!['admin', 'staff'].includes(req.user?.role)) {
    return next(new ApiError(403, 'You do not have permission to perform this action.'));
  }
  next();
};