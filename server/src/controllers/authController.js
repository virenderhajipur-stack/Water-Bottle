import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { asyncHandler, ApiError } from '../utils/helpers.js';
import { writeAudit } from '../services/auditService.js';

const User = () => mongoose.model('User');

export const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    throw new ApiError(400, 'Please enter username and password.');
  }
  const user = await User().findOne({ username: String(username).toLowerCase().trim() });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new ApiError(401, 'Invalid username or password.');
  }
  if (!user.active) {
    throw new ApiError(403, 'Your account has been disabled. Contact the admin.');
  }
  user.lastLogin = new Date();
  await user.save();

  const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '12h'
  });
  await writeAudit({ req, action: 'LOGIN', entityType: 'User', entityId: user._id, details: 'User logged in' });
  res.json({ success: true, token, user: user.toPublic() });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.user.toPublic() });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    throw new ApiError(400, 'Please provide current and new password.');
  }
  if (newPassword.length < 4) {
    throw new ApiError(400, 'New password must be at least 4 characters.');
  }
  const user = await User().findById(req.user._id);
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw new ApiError(400, 'Current password is incorrect.');
  }
  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await user.save();
  await writeAudit({ req, action: 'CHANGE_PASSWORD', entityType: 'User', entityId: user._id, details: 'Password changed' });
  res.json({ success: true, message: 'Password updated.' });
});

export const listUsers = asyncHandler(async (req, res) => {
  const users = await User().find().sort({ createdAt: 1 }).lean();
  res.json({ success: true, users: users.map((u) => ({ ...u, passwordHash: undefined })) });
});

export const createUser = asyncHandler(async (req, res) => {
  const { name, username, password, role } = req.body;
  if (!name || !username || !password) throw new ApiError(400, 'Name, username and password are required.');
  const exists = await User().findOne({ username: String(username).toLowerCase().trim() });
  if (exists) throw new ApiError(400, 'Username already exists.');
  const user = await User().create({
    name,
    username: String(username).toLowerCase().trim(),
    passwordHash: await bcrypt.hash(password, 10),
    role: role === 'admin' ? 'admin' : 'staff'
  });
  await writeAudit({ req, action: 'CREATE_USER', entityType: 'User', entityId: user._id, details: `Created ${role} user ${user.username}` });
  res.status(201).json({ success: true, user: user.toPublic() });
});

export const updateUser = asyncHandler(async (req, res) => {
  const user = await User().findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found.');
  const old = user.toPublic();
  if (req.body.name) user.name = req.body.name;
  if (req.body.role) user.role = req.body.role === 'admin' ? 'admin' : 'staff';
  if (typeof req.body.active === 'boolean') user.active = req.body.active;
  if (req.body.password) user.passwordHash = await bcrypt.hash(req.body.password, 10);
  await user.save();
  await writeAudit({ req, action: 'UPDATE_USER', entityType: 'User', entityId: user._id, oldValue: old, newValue: user.toPublic() });
  res.json({ success: true, user: user.toPublic() });
});

export const deleteUser = asyncHandler(async (req, res) => {
  if (req.params.id === String(req.user._id)) throw new ApiError(400, 'You cannot delete your own account.');
  const user = await User().findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found.');
  await writeAudit({ req, action: 'DELETE_USER', entityType: 'User', entityId: user._id, details: `Deleted user ${user.username}` });
  await user.deleteOne();
  res.json({ success: true, message: 'User deleted.' });
});