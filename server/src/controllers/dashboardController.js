import mongoose from 'mongoose';
import { asyncHandler, startOfDay, endOfDay, dateKey } from '../utils/helpers.js';
import { getInventorySnapshot } from '../services/inventoryService.js';
import { reconcileInventory } from '../services/calcService.js';

const Customer = () => mongoose.model('Customer');
const Transaction = () => mongoose.model('Transaction');
const Payment = () => mongoose.model('Payment');
const Setting = () => mongoose.model('Setting');

export const summary = asyncHandler(async (req, res) => {
  const dayStart = startOfDay();
  const dayEnd = endOfDay();
  const { lowStockThreshold, highDueAlert } = await Setting().getSettings();

  const [totalCustomers, cashCustomers, creditCustomers, inventory] = await Promise.all([
    Customer().countDocuments({ status: 'active' }),
    Customer().countDocuments({ status: 'active', customerType: 'cash' }),
    Customer().countDocuments({ status: 'active', customerType: 'credit' }),
    getInventorySnapshot()
  ]);

  const todayTxns = await Transaction()
    .find({ status: 'active', date: { $gte: dayStart, $lte: dayEnd } })
    .lean();
  const todayPays = await Payment().find({ status: 'active', date: { $gte: dayStart, $lte: dayEnd } }).lean();

  const todayStats = {
    newBottleQty: todayTxns.filter((t) => t.transactionType === 'new_bottle').reduce((s, t) => s + t.quantity, 0),
    newBottleSales: todayTxns.filter((t) => t.transactionType === 'new_bottle').reduce((s, t) => s + t.totalAmount, 0),
    refillQty: todayTxns.filter((t) => t.transactionType === 'refill').reduce((s, t) => s + t.quantity, 0),
    refillSales: todayTxns.filter((t) => t.transactionType === 'refill').reduce((s, t) => s + t.totalAmount, 0),
    emptyReturns: todayTxns.filter((t) => t.transactionType === 'empty_return').reduce((s, t) => s + t.quantity, 0),
    txPayment: todayTxns.reduce((s, t) => s + (t.paymentAmount || 0), 0)
  };
  const todayCollection = todayStats.txPayment + todayPays.reduce((s, p) => s + p.amount, 0);
  const todayCredit = todayTxns
    .filter((t) => ['new_bottle', 'refill'].includes(t.transactionType))
    .reduce((s, t) => s + (t.totalAmount - t.paymentAmount), 0);

  const customers = await Customer().find({ status: 'active' }).select('_id').lean();
  let totalOutstanding = 0;
  let customersWithDue = 0;
  let totalBottlesWithCustomers = 0;
  for (const c of customers) {
    const txns = await Transaction().find({ customerId: c._id, status: 'active' }).lean();
    const pays = await Payment().find({ customerId: c._id, status: 'active' }).lean();
    let bal = 0;
    for (const t of txns) bal += (t.filledBottlesGiven || 0) - (t.emptyBottlesReturned || 0);
    let due = 0;
    for (const t of txns) due += t.totalAmount - (t.paymentAmount || 0);
    for (const p of pays) due -= p.amount;
    totalBottlesWithCustomers += bal;
    if (due > 0) customersWithDue++;
    totalOutstanding += Math.max(0, due);
  }

  const rec = await reconcileInventory();

  const alerts = [];
  if (inventory.store < lowStockThreshold) alerts.push({ level: 'warning', text: `Low bottle stock: only ${inventory.store} bottles in store.` });
  if (totalOutstanding > 0) alerts.push({ level: 'info', text: `Total outstanding udhaar across ${customersWithDue} customers is ₹${Math.round(totalOutstanding).toLocaleString('en-IN')}.` });
  if (!rec.balanced) alerts.push({ level: 'danger', text: `Bottle stock mismatch detected (difference ${rec.difference}). Check Bottle Reconciliation.` });

  res.json({
    success: true,
    stats: {
      customers: {
        total: totalCustomers,
        cash: cashCustomers,
        credit: creditCustomers,
        withDue: customersWithDue
      },
      bottles: {
        totalOwned: inventory.totalBottles,
        withCustomers: totalBottlesWithCustomers,
        store: inventory.store,
        storeFilled: inventory.storeFilled,
        storeEmpty: inventory.storeEmpty,
        damagedLost: inventory.damagedLost,
        balanced: rec.balanced
      },
      money: {
        todaySales: todayStats.newBottleSales + todayStats.refillSales,
        todayNewBottle: todayStats.newBottleSales,
        todayRefill: todayStats.refillSales,
        todayCollection,
        todayNewBottleQty: todayStats.newBottleQty,
        todayRefillQty: todayStats.refillQty,
        todayEmptyReturns: todayStats.emptyReturns,
        todayCredit: todayCredit,
        totalOutstanding,
        customersWithDue
      }
    },
    alerts
  });
});

export const charts = asyncHandler(async (req, res) => {
  const { from, to, days = 14 } = req.query;
  let start, end;
  if (from && to) {
    start = startOfDay(new Date(from));
    end = endOfDay(new Date(to));
  } else {
    end = endOfDay();
    const n = Math.min(parseInt(days, 10) || 14, 60);
    start = startOfDay(new Date(end.getTime() - (n - 1) * 86400000));
  }

  const txns = await Transaction().find({ status: 'active', date: { $gte: start, $lte: end } }).lean();
  const pays = await Payment().find({ status: 'active', date: { $gte: start, $lte: end } }).lean();

  const daySales = {};
  const dayPayments = {};
  const dayNewBottles = {};
  const dayRefills = {};
  const dayEmptyReturns = {};

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const k = dateKey(d);
    daySales[k] = 0; dayPayments[k] = 0; dayNewBottles[k] = 0; dayRefills[k] = 0; dayEmptyReturns[k] = 0;
  }
  for (const t of txns) {
    const k = dateKey(t.date);
    if (daySales[k] === undefined) continue;
    if (t.transactionType === 'new_bottle') {
      daySales[k] += t.totalAmount;
      dayNewBottles[k] += t.quantity;
    } else if (t.transactionType === 'refill') {
      daySales[k] += t.totalAmount;
      dayRefills[k] += t.quantity;
    } else if (t.transactionType === 'empty_return') {
      dayEmptyReturns[k] += t.quantity;
    }
    dayPayments[k] += t.paymentAmount || 0;
  }
  for (const p of pays) {
    const k = dateKey(p.date);
    if (dayPayments[k] !== undefined) dayPayments[k] += p.amount;
  }

  const series = Object.keys(daySales).sort().map((k) => ({
    date: k,
    sales: daySales[k],
    payments: dayPayments[k],
    newBottles: dayNewBottles[k],
    refills: dayRefills[k],
    emptyReturns: dayEmptyReturns[k]
  }));

  res.json({ success: true, range: { from: start, to: end }, series });
});