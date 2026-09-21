import mongoose from 'mongoose';
import { asyncHandler, ApiError } from '../utils/helpers.js';
import { writeAudit } from '../services/auditService.js';

const Setting = () => mongoose.model('Setting');

export const getSettings = asyncHandler(async (req, res) => {
  const settings = await Setting().getSettings();
  res.json({ success: true, settings });
});

export const updateSettings = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw new ApiError(403, 'Only the admin can change settings.');
  const settings = await Setting().getSettings();
  const allowed = [
    'businessName',
    'businessAddress',
    'businessPhone',
    'newBottlePrice',
    'refillPrice',
    'currencySymbol',
    'allowAdvancePayment',
    'allowRefillOverride',
    'receiptHeader',
    'receiptFooter',
    'taxLabel',
    'taxRate',
    'lowStockThreshold',
    'highDueAlert'
  ];
  const changes = {};
  const oldValues = {};
  for (const k of allowed) {
    if (req.body[k] !== undefined) {
      oldValues[k] = settings[k];
      changes[k] = req.body[k];
      if (['newBottlePrice', 'refillPrice', 'taxRate', 'lowStockThreshold', 'highDueAlert'].includes(k)) {
        const n = Number(req.body[k]);
        if (isNaN(n) || n < 0) throw new ApiError(400, `${k} must be a non-negative number.`);
        settings[k] = n;
      } else if (typeof req.body[k] === 'boolean' || ['currencySymbol', 'businessName', 'businessAddress', 'businessPhone', 'receiptHeader', 'receiptFooter', 'taxLabel'].includes(k)) {
        settings[k] = req.body[k];
      } else {
        throw new ApiError(400, `Invalid value for ${k}.`);
      }
    }
  }
  await settings.save();

  for (const k of Object.keys(changes)) {
    await writeAudit({
      req,
      action: 'UPDATE_SETTING',
      entityType: 'Setting',
      entityId: 'global',
      oldValue: { [k]: oldValues[k] },
      newValue: { [k]: changes[k] },
      details: describeChange(k, oldValues[k], changes[k])
    });
  }
  res.json({ success: true, settings });
});

function describeChange(key, oldV, newV) {
  if (key === 'newBottlePrice' || key === 'refillPrice') {
    return `${key === 'newBottlePrice' ? 'New bottle' : 'Refill'} price changed from ₹${oldV} to ₹${newV}.`;
  }
  return `${key} → ${typeof newV === 'boolean' ? (newV ? 'ON' : 'OFF') : newV}.`;
}