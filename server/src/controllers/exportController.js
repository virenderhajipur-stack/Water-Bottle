import mongoose from 'mongoose';
import { asyncHandler, ApiError } from '../utils/helpers.js';

/**
 * CSV + JSON export utilities used by the Export endpoints.
 */
function esc(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

function toCsv(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.map(esc).join(',')];
  for (const r of rows) lines.push(headers.map((h) => esc(r[h])).join(','));
  return lines.join('\r\n');
}

const Customer = () => mongoose.model('Customer');
const Transaction = () => mongoose.model('Transaction');
const Payment = () => mongoose.model('Payment');
const InventoryLog = () => mongoose.model('InventoryLog');

export const exportEntity = asyncHandler(async (req, res) => {
  const { entity } = req.params;
  const format = (req.query.format || 'csv').toLowerCase();
  const exportDate = new Date().toISOString().slice(0, 10);
  let filename = `${entity}-${exportDate}.${format}`;
  let data;

  if (entity === 'customers') {
    const customers = await Customer().find().lean();
    data = customers.map((c) => ({
      customerId: c.customerId,
      name: c.name,
      phone: c.phone,
      address: c.address,
      area: c.area,
      customerType: c.customerType,
      openingBalance: c.openingBalance,
      openingBottleBalance: c.openingBottleBalance,
      status: c.status,
      createdAt: c.createdAt
    }));
  } else if (entity === 'transactions') {
    const txns = await Transaction().find().populate('customerId', 'name customerId').lean();
    data = txns.map((t) => ({
      date: t.date,
      customer: t.customerId?.name || '',
      customerId: t.customerId?.customerId || '',
      type: t.transactionType,
      quantity: t.quantity,
      filledGiven: t.filledBottlesGiven,
      emptyReturned: t.emptyBottlesReturned,
      unitPrice: t.unitPrice,
      amount: t.totalAmount,
      paid: t.paymentAmount,
      method: t.paymentMethod,
      remainingDue: t.remainingDue,
      status: t.status,
      notes: t.notes
    }));
  } else if (entity === 'payments') {
    const pays = await Payment().find().populate('customerId', 'name customerId').lean();
    data = pays.map((p) => ({
      date: p.date,
      customer: p.customerId?.name || '',
      customerId: p.customerId?.customerId || '',
      amount: p.amount,
      method: p.paymentMethod,
      reference: p.referenceId,
      status: p.status,
      notes: p.notes
    }));
  } else if (entity === 'inventory') {
    const logs = await InventoryLog().find().populate('customerId', 'name').lean();
    data = logs.map((l) => ({
      date: l.date,
      type: l.type,
      quantity: l.quantity,
      customer: l.customerId?.name || '',
      storeEmptyDelta: l.storeEmptyDelta,
      storeFilledDelta: l.storeFilledDelta,
      totalDelta: l.totalDelta,
      damagedDelta: l.damagedDelta,
      lostDelta: l.lostDelta,
      customerDelta: l.customerDelta,
      notes: l.notes
    }));
  } else if (entity === 'audit') {
    const logs = await mongoose.model('AuditLog').find().lean();
    data = logs.map((l) => ({
      createdAt: l.createdAt,
      user: l.userName,
      role: l.role,
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId,
      details: l.details
    }));
  } else if (entity === 'backup') {
    const [customers, transactions, payments, inventoryLogs, auditLogs, settings, users, inventory] = await Promise.all([
      Customer().find().lean(),
      Transaction().find().populate('customerId', 'name customerId').lean(),
      Payment().find().populate('customerId', 'name customerId').lean(),
      InventoryLog().find().populate('customerId', 'name').lean(),
      mongoose.model('AuditLog').find().lean(),
      mongoose.model('Setting').find().lean(),
      mongoose.model('User').find().select('-passwordHash').lean(),
      mongoose.model('Inventory').find().lean()
    ]);
    const backup = {
      app: 'water-bottle-system',
      exportedAt: new Date(),
      inventory,
      settings,
      users,
      customers,
      transactions,
      payments,
      inventoryLogs,
      auditLogs
    };
    filename = `backup-${exportDate}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(JSON.stringify(backup, null, 2));
  } else {
    throw new ApiError(400, 'Unknown export entity.');
  }

  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(JSON.stringify(data, null, 2));
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send('\uFEFF' + toCsv(data));
});