import mongoose from 'mongoose';
import { asyncHandler, ApiError, getNextCustomerId, computeCustomerMoney, computeCustomerBottles } from '../utils/helpers.js';
import { writeAudit } from '../services/auditService.js';
import { getCustomerSummary } from '../services/calcService.js';
import { applyInventoryDeltas, logInventory, getInventorySnapshot } from '../services/inventoryService.js';

const Customer = () => mongoose.model('Customer');
const Transaction = () => mongoose.model('Transaction');

export const listCustomers = asyncHandler(async (req, res) => {
  const { search = '', type = '', status = '', page = 1, limit = 20, sort = 'newest', withDue, hasBottles } = req.query;
  const q = {};
  if (type) q.customerType = type;
  if (status) q.status = status;
  else q.status = { $ne: 'inactive' };
  if (search) {
    const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    q.$or = [{ name: rx }, { phone: rx }, { customerId: rx }, { area: rx }, { address: rx }];
  }

  const perPage = Math.min(parseInt(limit, 10) || 20, 100);
  const skip = (parseInt(page, 10) - 1) * perPage;
  const sortMap = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    name: { name: 1 },
    dueHigh: undefined,
    bottlesHigh: undefined
  };
  let sortQ = sortMap[sort] || { createdAt: -1 };

  const all = await Customer().find(q).sort(sortQ === undefined ? { createdAt: -1 } : sortQ).lean();

  const enriched = await Promise.all(
    all.map(async (c) => {
      const [money, bottles] = await Promise.all([computeCustomerMoney(c._id), computeCustomerBottles(c._id)]);
      return { ...c, due: money.balance, advance: money.advance, bottlesWithCustomer: bottles.balance, lastTransaction: money.lastTransaction };
    })
  );

  let rows = enriched;
  if (withDue === 'true') rows = rows.filter((r) => r.due > 0);
  if (withDue === 'advance') rows = rows.filter((r) => r.advance > 0);
  if (withDue === 'false') rows = rows.filter((r) => r.due <= 0 && r.advance <= 0);
  if (hasBottles === 'true') rows = rows.filter((r) => r.bottlesWithCustomer > 0);

  if (sort === 'dueHigh') rows.sort((a, b) => b.due - a.due);
  if (sort === 'bottlesHigh') rows.sort((a, b) => b.bottlesWithCustomer - a.bottlesWithCustomer);

  const totalDue = rows.reduce((s, r) => s + r.due, 0);
  const totalBottles = rows.reduce((s, r) => s + r.bottlesWithCustomer, 0);

  const customers = rows.slice(skip, skip + perPage);

  res.json({ success: true, customers, total: rows.length, page: parseInt(page, 10), totalDue, totalBottles });
});

export const searchCustomers = asyncHandler(async (req, res) => {
  const { q = '' } = req.query;
  const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const rows = await Customer()
    .find({ status: 'active', $or: [{ name: rx }, { phone: rx }, { customerId: rx }] })
    .limit(20)
    .lean();
  const enriched = await Promise.all(
    rows.map(async (c) => {
      const [money, bottles] = await Promise.all([computeCustomerMoney(c._id), computeCustomerBottles(c._id)]);
      return { ...c, due: money.balance, bottlesWithCustomer: bottles.balance };
    })
  );
  res.json({ success: true, customers: enriched });
});

export const getCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer().findById(req.params.id);
  if (!customer) throw new ApiError(404, 'Customer not found.');
  const summary = await getCustomerSummary(customer._id);
  res.json({ success: true, customer: { ...customer.toObject(), summary } });
});

export const getCustomerLedger = asyncHandler(async (req, res) => {
  const customer = await Customer().findById(req.params.id);
  if (!customer) throw new ApiError(404, 'Customer not found.');
  const txns = await Transaction()
    .find({ customerId: customer._id, status: 'active' })
    .sort({ date: 1, createdAt: 1 })
    .lean();
  const payments = await mongoose
    .model('Payment')
    .find({ customerId: customer._id, status: 'active' })
    .sort({ date: 1, createdAt: 1 })
    .lean();

  const entries = [];
  for (const t of txns) {
    entries.push({
      _id: t._id,
      kind: 'transaction',
      date: t.date,
      type: t.transactionType,
      filled: t.filledBottlesGiven,
      empty: t.emptyBottlesReturned,
      rate: t.unitPrice,
      amount: t.totalAmount,
      paid: t.paymentAmount,
      method: t.paymentMethod,
      notes: t.notes,
      remainingDue: t.remainingDue,
      status: t.status
    });
  }
  for (const p of payments) {
    entries.push({
      _id: p._id,
      kind: 'payment',
      date: p.date,
      type: 'payment',
      filled: 0,
      empty: 0,
      rate: 0,
      amount: 0,
      paid: p.amount,
      method: p.paymentMethod,
      notes: p.referenceId ? `Ref: ${p.referenceId}` : '',
      remainingDue: null,
      status: p.status
    });
  }
  entries.sort((a, b) => new Date(a.date) - new Date(b.date));

  let run = 0;
  for (const e of entries) {
    run += (e.amount || 0) - (e.paid || 0);
    e.runningDue = run;
  }

  const summary = await getCustomerSummary(customer._id);
  res.json({ success: true, customer: { ...customer.toObject(), summary }, entries });
});

export const createCustomer = asyncHandler(async (req, res) => {
  const { name, phone = '', address = '', area = '', customerType = 'cash', openingBalance = 0, openingBottleBalance = 0, notes = '' } = req.body;
  if (!name || !String(name).trim()) throw new ApiError(400, 'Customer name is required.');
  if (Number(openingBalance) < 0) throw new ApiError(400, 'Opening balance cannot be negative.');
  if (!Number.isInteger(Number(openingBottleBalance)) || Number(openingBottleBalance) < 0) {
    throw new ApiError(400, 'Opening bottle balance must be a non-negative whole number.');
  }
  const openingBottles = Number(openingBottleBalance);
  if (openingBottles > 0) {
    const inventory = await getInventorySnapshot();
    if (inventory.storeEmpty < openingBottles) {
      throw new ApiError(400, `Not enough empty bottles in store for this opening balance (need ${openingBottles}, only ${inventory.storeEmpty} available).`);
    }
  }
  const customerId = await getNextCustomerId();
  const customer = await Customer().create({
    customerId,
    name: String(name).trim(),
    phone: String(phone).trim(),
    address: String(address).trim(),
    area: String(area).trim(),
    customerType,
    openingBalance: Number(openingBalance),
    openingBottleBalance: Number(openingBottleBalance),
    notes: String(notes).trim()
  });

  if (Number(openingBalance) > 0 || Number(openingBottleBalance) > 0) {
    const txn = await Transaction().create({
      customerId: customer._id,
      transactionType: 'opening',
      date: new Date(),
      quantity: openingBottles,
      filledBottlesGiven: openingBottles,
      emptyBottlesReturned: 0,
      unitPrice: 0,
      totalAmount: Number(openingBalance),
      paymentAmount: 0,
      remainingDue: Number(openingBalance),
      notes: `Opening balance (money ₹${openingBalance}, bottles ${openingBottles})`,
      createdBy: req.user._id,
      meta: { moneyBalance: Number(openingBalance), bottleBalance: openingBottles }
    });
    if (openingBottles > 0) {
      await applyInventoryDeltas({ storeEmpty: -openingBottles });
      await logInventory({
        type: 'opening',
        quantity: openingBottles,
        customerId: customer._id,
        storeEmptyDelta: -openingBottles,
        customerDelta: openingBottles,
        date: new Date(),
        source: 'store',
        notes: `Opening bottle balance for ${customer.name}`,
        createdBy: req.user._id,
        transactionId: txn._id
      });
    }
  }

  await writeAudit({
    req,
    action: 'CREATE_CUSTOMER',
    entityType: 'Customer',
    entityId: customer._id,
    details: `Created customer ${customer.name} (${customer.customerId})`
  });
  res.status(201).json({ success: true, customer });
});

export const updateCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer().findById(req.params.id);
  if (!customer) throw new ApiError(404, 'Customer not found.');
  const old = customer.toObject();
  const fields = ['name', 'phone', 'address', 'area', 'customerType', 'notes', 'status'];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      if (f === 'customerType') {
        if (!['cash', 'credit'].includes(req.body[f])) throw new ApiError(400, 'Invalid customer type.');
        customer[f] = req.body[f];
      } else {
        customer[f] = req.body[f];
      }
    }
  }
  await customer.save();
  await writeAudit({ req, action: 'UPDATE_CUSTOMER', entityType: 'Customer', entityId: customer._id, oldValue: old, newValue: customer.toObject() });
  res.json({ success: true, customer });
});

export const archiveCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer().findById(req.params.id);
  if (!customer) throw new ApiError(404, 'Customer not found.');
  customer.status = customer.status === 'inactive' ? 'active' : 'inactive';
  await customer.save();
  await writeAudit({ req, action: 'TOGGLE_CUSTOMER_STATUS', entityType: 'Customer', entityId: customer._id, details: `Status set to ${customer.status}` });
  res.json({ success: true, customer });
});

export const deleteCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer().findById(req.params.id);
  if (!customer) throw new ApiError(404, 'Customer not found.');
  const txnCount = await Transaction().countDocuments({ customerId: customer._id });
  const payCount = await mongoose.model('Payment').countDocuments({ customerId: customer._id });
  if (txnCount > 0 || payCount > 0) {
    throw new ApiError(400, 'This customer has transaction history. Permanently deleting is not allowed — use "Archive" instead to keep records safe.');
  }
  await writeAudit({ req, action: 'DELETE_CUSTOMER', entityType: 'Customer', entityId: customer._id, details: `Deleted customer ${customer.name}` });
  await customer.deleteOne();
  res.json({ success: true, message: 'Customer deleted.' });
});