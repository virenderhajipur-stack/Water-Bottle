import mongoose from 'mongoose';

/**
 * Audit logging for every important action.
 */
export async function writeAudit({
  req = null,
  userId = null,
  userName = '',
  role = '',
  action,
  entityType = '',
  entityId = null,
  oldValue = null,
  newValue = null,
  details = ''
}) {
  const AuditLog = mongoose.model('AuditLog');
  const user = req?.user;
  const uId = userId || user?._id || null;
  const uName = userName || user?.name || '';
  const uRole = role || user?.role || '';
  await AuditLog.create({
    userId: uId,
    userName: uName,
    role: uRole,
    action,
    entityType,
    entityId: entityId ? String(entityId) : undefined,
    oldValue,
    newValue,
    details
  });
}