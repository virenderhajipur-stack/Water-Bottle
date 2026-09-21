import mongoose from 'mongoose';
import { asyncHandler, ApiError } from '../utils/helpers.js';
import { writeAudit } from '../services/auditService.js';
import { applyInventoryDeltas, logInventory, getInventorySnapshot } from '../services/inventoryService.js';
import { reconcileInventory } from '../services/calcService.js';

const InventoryLog = () => mongoose.model('InventoryLog');

export const getInventory = asyncHandler(async (req, res) => {
  const snapshot = await getInventorySnapshot();
  res.json({ success: true, inventory: snapshot });
});

export const getReconciliation = asyncHandler(async (req, res) => {
  const rec = await reconcileInventory();
  res.json({ success: true, reconciliation: rec });
});

export const adjust = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw new ApiError(403, 'Only the admin can adjust inventory.');
  const { kind = 'add', quantity, reason = '', date } = req.body;
  if (!Number.isInteger(Number(quantity)) || Number(quantity) <= 0) {
    throw new ApiError(400, 'Quantity must be a positive whole number.');
  }
  const q = Number(quantity);
  if (kind === 'add') {
    const inv = await applyInventoryDeltas({ storeEmpty: q, total: q });
    await logInventory({
      type: 'adjustment_add',
      quantity: q,
      storeEmptyDelta: q,
      totalDelta: q,
      date: date ? new Date(date) : new Date(),
      source: 'store',
      notes: reason,
      createdBy: req.user._id
    });
    await writeAudit({ req, action: 'INVENTORY_ADJUST', entityType: 'Inventory', oldValue: { totalBottles: inv.totalBottles - q }, newValue: { totalBottles: inv.totalBottles }, details: `Added ${q} bottles to inventory. ${reason}` });
    res.json({ success: true, message: `${q} bottles added to inventory.`, inventory: inv });
  } else if (kind === 'remove') {
    const inv = await applyInventoryDeltas({ storeEmpty: -q, total: -q });
    await logInventory({
      type: 'adjustment_remove',
      quantity: q,
      storeEmptyDelta: -q,
      totalDelta: -q,
      date: date ? new Date(date) : new Date(),
      source: 'store',
      notes: reason,
      createdBy: req.user._id
    });
    await writeAudit({ req, action: 'INVENTORY_ADJUST', entityType: 'Inventory', oldValue: { totalBottles: inv.totalBottles + q }, newValue: { totalBottles: inv.totalBottles }, details: `Removed ${q} bottles from inventory. ${reason}` });
    res.json({ success: true, message: `${q} bottles removed from inventory.`, inventory: inv });
  } else {
    throw new ApiError(400, 'Adjustment type must be add or remove.');
  }
});

export const fill = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw new ApiError(403, 'Only the admin can move bottles between empty and filled stock.');
  const { quantity, notes = '' } = req.body;
  if (!Number.isInteger(Number(quantity)) || Number(quantity) <= 0) throw new ApiError(400, 'Quantity must be a positive whole number.');
  const q = Number(quantity);
  const inv = await applyInventoryDeltas({ storeEmpty: -q, storeFilled: q });
  await logInventory({
    type: 'fill',
    quantity: q,
    storeEmptyDelta: -q,
    storeFilledDelta: q,
    date: new Date(),
    source: 'store',
    notes: notes || 'Bottles filled for stock',
    createdBy: req.user._id
  });
  await writeAudit({ req, action: 'INVENTORY_FILL', entityType: 'Inventory', oldValue: { storeEmpty: inv.storeEmpty + q, storeFilled: inv.storeFilled - q }, newValue: inv, details: `Filled ${q} bottles (empty→filled).` });
  res.json({ success: true, message: `${q} bottles marked as filled.`, inventory: inv });
});

export const recordDamagedLost = asyncHandler(async (req, res) => {
  const { kind = 'damaged', quantity, reason = '', date, source = 'store', customerId = null } = req.body;
  if (!Number.isInteger(Number(quantity)) || Number(quantity) <= 0) throw new ApiError(400, 'Quantity must be a positive whole number.');
  if (!['damaged', 'lost'].includes(kind)) throw new ApiError(400, 'Kind must be damaged or lost.');
  if (!['store', 'customer'].includes(source)) throw new ApiError(400, 'Source must be store or customer.');
  if (source === 'customer') {
    throw new ApiError(400, 'For customer bottles please use a Damaged/Lost transaction from the customer profile, so the customer balance also updates.');
  }
  const q = Number(quantity);
  const de = source === 'store' ? -q : 0;
  const inv = await applyInventoryDeltas({
    storeEmpty: de,
    damaged: kind === 'damaged' ? q : 0,
    lost: kind === 'lost' ? q : 0
  });
  await logInventory({
    type: kind,
    quantity: q,
    storeEmptyDelta: de,
    damagedDelta: kind === 'damaged' ? q : 0,
    lostDelta: kind === 'lost' ? q : 0,
    customerDelta: 0,
    date: date ? new Date(date) : new Date(),
    source,
    notes: reason,
    createdBy: req.user._id
  });
  await writeAudit({
    req,
    action: 'RECORD_DAMAGED_LOST',
    entityType: 'Inventory',
    oldValue: {}, newValue: inv,
    details: `Recorded ${q} ${kind} bottle(s) (${source}). ${reason}`
  });
  res.json({ success: true, message: `${q} ${kind} bottle(s) recorded.`, inventory: inv });
});

export const history = asyncHandler(async (req, res) => {
  const { page = 1, limit = 40, from, to } = req.query;
  const q = {};
  if (from || to) {
    q.date = {};
    if (from) q.date.$gte = new Date(from);
    if (to) q.date.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
  }
  const perPage = Math.min(parseInt(limit, 10) || 40, 200);
  const skip = (parseInt(page, 10) - 1) * perPage;
  const total = await InventoryLog().countDocuments(q);
  const logs = await InventoryLog()
    .find(q)
    .sort({ date: -1, createdAt: -1 })
    .skip(skip)
    .limit(perPage)
    .populate('customerId', 'name customerId')
    .populate('createdBy', 'name')
    .lean();
  res.json({ success: true, logs, total, page: parseInt(page, 10) });
});