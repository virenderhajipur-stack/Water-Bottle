import mongoose from 'mongoose';
import { asyncHandler } from '../utils/helpers.js';

const AuditLog = () => mongoose.model('AuditLog');

export const listAuditLogs = asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, entityType = '', action = '', from, to } = req.query;
  const q = {};
  if (entityType) q.entityType = entityType;
  if (action) q.action = { $regex: action, $options: 'i' };
  if (from || to) {
    q.createdAt = {};
    if (from) q.createdAt.$gte = new Date(from);
    if (to) q.createdAt.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
  }
  const perPage = Math.min(parseInt(limit, 10) || 50, 100);
  const skip = (parseInt(page, 10) - 1) * perPage;
  const total = await AuditLog().countDocuments(q);
  const logs = await AuditLog().find(q).sort({ createdAt: -1 }).skip(skip).limit(perPage).lean();
  res.json({ success: true, logs, total, page: parseInt(page, 10) });
});