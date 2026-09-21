import mongoose from 'mongoose';
import { asyncHandler, startOfDay, endOfDay, computeCustomerMoney, computeCustomerBottles } from '../utils/helpers.js';

const Customer = () => mongoose.model('Customer');
const Transaction = () => mongoose.model('Transaction');
const Payment = () => mongoose.model('Payment');

export const dailyReport = asyncHandler(async (req, res) => {
  const d = new Date(req.query.date || Date.now());
  const start = startOfDay(d);
  const end = endOfDay(d);

  const txns = await Transaction().find({ status: 'active', date: { $gte: start, $lte: end } }).lean();
  const pays = await Payment().find({ status: 'active', date: { $gte: start, $lte: end } }).lean();

  const newBottleQty = txns.filter((t) => t.transactionType === 'new_bottle').reduce((s, t) => s + t.quantity, 0);
  const newBottleSales = txns.filter((t) => t.transactionType === 'new_bottle').reduce((s, t) => s + t.totalAmount, 0);
  const refillQty = txns.filter((t) => t.transactionType === 'refill').reduce((s, t) => s + t.quantity, 0);
  const refillSales = txns.filter((t) => t.transactionType === 'refill').reduce((s, t) => s + t.totalAmount, 0);
  const emptyReturns = txns.filter((t) => t.transactionType === 'empty_return').reduce((s, t) => s + t.quantity, 0);

  const cashReceivedTx = txns.reduce((s, t) => s + (t.paymentAmount || 0), 0);
  const cashReceivedPayments = pays.reduce((s, p) => s + p.amount, 0);
  const totalSales = newBottleSales + refillSales;
  const credit = txns.filter((t) => ['new_bottle', 'refill'].includes(t.transactionType)).reduce((s, t) => s + (t.totalAmount - (t.paymentAmount || 0)), 0);

  res.json({
    success: true,
    date: start,
    report: {
      date: start,
      newBottleQty,
      newBottleSales,
      refillQty,
      refillSales,
      emptyReturns,
      totalSales,
      credit,
      cashReceived: cashReceivedTx + cashReceivedPayments,
      txPayment: cashReceivedTx,
      paymentsCollected: cashReceivedPayments,
      transactionCount: txns.length
    }
  });
});

export const monthlyReport = asyncHandler(async (req, res) => {
  const q = req.query.month || (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`; })();
  const [y, m] = q.split('-').map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0, 23, 59, 59, 999);

  const txns = await Transaction().find({ status: 'active', date: { $gte: start, $lte: end } }).lean();
  const pays = await Payment().find({ status: 'active', date: { $gte: start, $lte: end } }).lean();

  const newBottleQty = txns.filter((t) => t.transactionType === 'new_bottle').reduce((s, t) => s + t.quantity, 0);
  const newBottleSales = txns.filter((t) => t.transactionType === 'new_bottle').reduce((s, t) => s + t.totalAmount, 0);
  const refillQty = txns.filter((t) => t.transactionType === 'refill').reduce((s, t) => s + t.quantity, 0);
  const refillSales = txns.filter((t) => t.transactionType === 'refill').reduce((s, t) => s + t.totalAmount, 0);
  const emptyReturns = txns.filter((t) => t.transactionType === 'empty_return').reduce((s, t) => s + t.quantity, 0);
  const totalSales = newBottleSales + refillSales;
  const payments = pays.reduce((s, p) => s + p.amount, 0) + txns.reduce((s, t) => s + (t.paymentAmount || 0), 0);

  res.json({
    success: true,
    month: q,
    report: { month: q, newBottleQty, newBottleSales, refillQty, refillSales, emptyReturns, totalSales, payments }
  });
});

export const dueReport = asyncHandler(async (req, res) => {
  const customers = await Customer().find({ status: 'active' }).lean();
  const rows = [];
  for (const c of customers) {
    const [money, bottles] = await Promise.all([computeCustomerMoney(c._id), computeCustomerBottles(c._id)]);
    rows.push({
      customer: c,
      due: money.balance,
      advance: money.advance,
      totalCharges: money.totalCharges,
      totalPaid: money.paid,
      bottlesWithCustomer: bottles.balance,
      lastPayment: money.lastPayment
    });
  }
  const filtered = rows.filter((r) => r.due > 0).sort((a, b) => b.due - a.due);
  const advances = rows.filter((r) => r.due <= 0 && r.advance > 0).sort((a, b) => b.advance - a.advance);
  const totalDue = filtered.reduce((s, r) => s + r.due, 0);
  const totalAdvance = advances.reduce((s, r) => s + r.advance, 0);
  res.json({ success: true, customers: filtered, totalDue, advances, totalAdvance });
});

export const bottleReport = asyncHandler(async (req, res) => {
  const customers = await Customer().find({ status: 'active' }).sort({ name: 1 }).lean();
  const rows = [];
  for (const c of customers) {
    const bottles = await computeCustomerBottles(c._id);
    if (bottles.balance <= 0) continue;
    const money = await computeCustomerMoney(c._id);
    rows.push({ customer: c, bottles: bottles.balance, refills: bottles.refills, lastRefill: bottles.lastRefill, lastTransaction: money.lastTransaction, due: money.balance });
  }
  rows.sort((a, b) => b.bottles - a.bottles);
  const avg = rows.length ? rows.reduce((s, r) => s + r.bottles, 0) / rows.length : 0;
  const highlighted = rows.filter((r) => r.bottles > avg * 1.5 && r.bottles >= 5);
  res.json({ success: true, customers: rows, average: avg, totalBottles: rows.reduce((s, r) => s + r.bottles, 0), highlightedIds: highlighted.map((h) => h.customer._id) });
});

export const refillReport = asyncHandler(async (req, res) => {
  const { from, to, customerId = '', status = '' } = req.query;
  const q = { status: 'active', transactionType: 'refill' };
  if (customerId) q.customerId = customerId;
  if (from || to) {
    q.date = {};
    if (from) q.date.$gte = startOfDay(new Date(from));
    if (to) q.date.$lte = endOfDay(new Date(to));
  }
  const txns = await Transaction().find(q).sort({ date: -1 }).populate('customerId', 'name customerId phone').lean();
  let rows = txns.map((t) => ({
    ...t,
    paidAmt: t.paymentAmount,
    dueAmt: Math.max(0, t.totalAmount - t.paymentAmount),
    isPaid: t.paymentAmount >= t.totalAmount
  }));
  if (status === 'paid') rows = rows.filter((r) => r.isPaid);
  if (status === 'unpaid') rows = rows.filter((r) => !r.isPaid);
  const totals = {
    qty: rows.reduce((s, r) => s + r.quantity, 0),
    amount: rows.reduce((s, r) => s + r.totalAmount, 0),
    paid: rows.reduce((s, r) => s + r.paidAmt, 0),
    due: rows.reduce((s, r) => s + r.dueAmt, 0)
  };
  res.json({ success: true, refills: rows, totals });
});