import Customer from '../models/Customer.js';
import Transaction from '../models/Transaction.js';
import Payment from '../models/Payment.js';
import ApiError from './ApiError.js';

export { ApiError };

export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export const toINR = (n) => `₹${Math.round((n || 0)).toLocaleString('en-IN')}`;

export function startOfDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function endOfDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export function parseDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

export function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * Last N days starting at today (inclusive), oldest first.
 */
export function lastNDays(n, from = new Date()) {
  const days = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() - i);
    days.push(d);
  }
  return days;
}

export function aggregateByDate(items, start, end) {
  const map = {};
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    map[dateKey(d)] = 0;
  }
  for (const it of items) {
    const k = dateKey(new Date(it._id ? it._id : it.date));
    map[k] = (map[k] || 0) + (it.total || 0);
  }
  return Object.entries(map).map(([date, total]) => ({ date, total }));
}

/**
 * Atomically generate the next customer ID like CUS-0001.
 */
export async function getNextCustomerId() {
  const last = await Customer.findOne({}, { customerId: 1, _id: 0 })
    .sort({ customerId: -1 })
    .lean();
  let num = 0;
  if (last && last.customerId) {
    const m = /CUS-(\d+)/.exec(last.customerId);
    if (m) num = parseInt(m[1], 10);
  }
  return `CUS-${String(num + 1).padStart(4, '0')}`;
}

/**
 * Compute a customer's full financial summary from history.
 */
export async function computeCustomerMoney(customerId, opts = {}) {
  const { upto } = opts;
  const q = { customerId, status: 'active' };
  if (upto) q.date = { $lte: endOfDay(upto) };
  const txns = await Transaction.find(q).sort({ date: 1, createdAt: 1 }).lean();
  const pays = await Payment.find({ customerId, status: 'active', ...(upto ? { date: { $lte: endOfDay(upto) } } : {}) }).lean();

  let newBottleCharges = 0;
  let refillCharges = 0;
  let otherCharges = 0;
  let paid = 0;
  let newBottles = 0;
  let refills = 0;
  let emptyReturned = 0;
  let lastRefill = null;
  let lastPayment = null;

  for (const t of txns) {
    if (t.transactionType === 'new_bottle') {
      newBottleCharges += t.totalAmount;
      newBottles += t.quantity;
    } else if (t.transactionType === 'refill') {
      refillCharges += t.totalAmount;
      refills += t.quantity;
      if (!lastRefill || t.date > lastRefill) lastRefill = t.date;
    } else if (t.transactionType === 'opening') {
      otherCharges += t.totalAmount;
    } else {
      otherCharges += t.totalAmount;
    }
    emptyReturned += t.emptyBottlesReturned || 0;
    paid += t.paymentAmount || 0;
  }
  for (const p of pays) {
    paid += p.amount;
    if (!lastPayment || p.date > lastPayment) lastPayment = p.date;
  }

  const totalCharges = newBottleCharges + refillCharges + otherCharges;
  const balance = totalCharges - paid;
  return {
    newBottleCharges,
    refillCharges,
    otherCharges,
    totalCharges,
    paid,
    balance,
    advance: Math.max(0, -balance),
    newBottles,
    refills,
    emptyReturned,
    lastRefill,
    lastPayment,
    lastTransaction: txns.length ? txns[txns.length - 1].date : null
  };
}

/**
 * Compute a customer's bottle balance from history.
 */
export async function computeCustomerBottles(customerId) {
  const txns = await Transaction.find({ customerId, status: 'active' }).lean();
  let given = 0;
  let returned = 0;
  let refills = 0;
  let lastRefill = null;
  for (const t of txns) {
    given += t.filledBottlesGiven || 0;
    returned += t.emptyBottlesReturned || 0;
    if (t.transactionType === 'refill') {
      refills += t.quantity;
      if (!lastRefill || t.date > lastRefill) lastRefill = t.date;
    }
  }
  return { given, returned, balance: given - returned, refills, lastRefill };
}