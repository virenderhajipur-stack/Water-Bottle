import mongoose from 'mongoose';
import { asyncHandler, ApiError, computeCustomerMoney, computeCustomerBottles, parseDate } from '../utils/helpers.js';
import { writeAudit } from '../services/auditService.js';
import { applyTransactionInventory, reverseTransactionInventory } from '../services/inventoryService.js';
import { validateTransactionInput, assertRefillAvailable } from '../services/calcService.js';

const Transaction = () => mongoose.model('Transaction');
const Customer = () => mongoose.model('Customer');
const Setting = () => mongoose.model('Setting');

function amountStr(n) {
  return `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
}

/**
 * Create a bottle/financial transaction with full validation, automatic
 * calculation, inventory update and audit logging.
 *
 * Body fields (per type):
 *  new_bottle        customerId, quantity, paymentAmount?, paymentMethod?, date?, notes?
 *  refill            customerId, quantity, paymentAmount?, paymentMethod?, date?, notes?, override?
 *  empty_return      customerId, quantity, date?, notes?
 *  damaged_lost      customerId?|store, quantity, meta:{kind:'damaged'|'lost', source:'customer'|'store'}, date?, notes?
 *  adjustment        (store) quantity, meta:{kind:'add'|'remove'}, date?, notes?
 *  opening           internal (used at customer creation)
 */
export const createTransaction = asyncHandler(async (req, res) => {
  const {
    customerId,
    transactionType,
    quantity = 0,
    unitPrice,
    paymentAmount = 0,
    paymentMethod = '',
    date,
    notes = '',
    override = false,
    meta = {}
  } = req.body;

  await validateTransactionInput({ type: transactionType, quantity, unitPrice, paymentAmount, customerId });
  const customer = await Customer().findById(customerId);
  if (!customer) throw new ApiError(404, 'Customer not found.');

  const trDate = parseDate(date) || new Date();
  const settings = await Setting().getSettings();
  const isAdmin = req.user.role === 'admin';

  let effectiveUnitPrice = Number(unitPrice);
  if (transactionType === 'new_bottle' && unitPrice === undefined) effectiveUnitPrice = settings.newBottlePrice;
  if (transactionType === 'refill' && unitPrice === undefined) effectiveUnitPrice = settings.refillPrice;
  if (transactionType === 'new_bottle') {
    if (unitPrice !== undefined && Number(unitPrice) !== settings.newBottlePrice && !isAdmin) {
      throw new ApiError(403, 'Only the admin can change the new bottle price.');
    }
  }
  if (transactionType === 'refill') {
    if (unitPrice !== undefined && Number(unitPrice) !== settings.refillPrice && !isAdmin) {
      throw new ApiError(403, 'Only the admin can change the refill price.');
    }
  }
  effectiveUnitPrice = Number(effectiveUnitPrice) || 0;

  const qty = Number(quantity);
  let filledGiven = 0;
  let emptyReturned = 0;
  let totalAmount = 0;
  let appliedPayment = 0;
  let appliedMethod = paymentMethod || '';
  let txnMeta = { ...meta };

  const currentMoney = await computeCustomerMoney(customerId);

  switch (transactionType) {
    case 'new_bottle': {
      filledGiven = qty;
      emptyReturned = 0;
      totalAmount = qty * effectiveUnitPrice;
      txnMeta = { ...txnMeta, source: 'customer' };
      break;
    }
    case 'refill': {
      const allowOv = (isAdmin && override) || settings.allowRefillOverride;
      const available = await assertRefillAvailable(customerId, qty, { allowOverride: allowOv });
      if (qty > available.balance) {
        txnMeta = { ...txnMeta, overrideApproved: true, approvedBy: req.user.name };
      }
      filledGiven = qty;
      emptyReturned = qty;
      totalAmount = qty * effectiveUnitPrice;
      txnMeta = { ...txnMeta, source: 'customer' };
      break;
    }
    case 'empty_return': {
      filledGiven = 0;
      emptyReturned = qty;
      totalAmount = 0;
      txnMeta = { ...txnMeta, source: 'customer' };
      break;
    }
    case 'damaged_lost': {
      filledGiven = 0;
      emptyReturned = meta.source === 'customer' ? qty : 0;
      totalAmount = 0;
      txnMeta = { ...txnMeta, kind: meta.kind || 'damaged', source: meta.source || 'store' };
      break;
    }
    case 'adjustment': {
      filledGiven = 0;
      emptyReturned = 0;
      totalAmount = 0;
      txnMeta = { ...txnMeta, kind: meta.kind || 'add', source: 'store' };
      if (!isAdmin) throw new ApiError(403, 'Only the admin can make bottle adjustments.');
      break;
    }
    case 'opening': {
      filledGiven = Number(meta.bottleBalance) || 0;
      emptyReturned = 0;
      totalAmount = Number(meta.moneyBalance) || 0;
      break;
    }
    case 'payment_adj': {
      filledGiven = 0;
      emptyReturned = 0;
      totalAmount = Number(meta.amount) || 0;
      if (!isAdmin) throw new ApiError(403, 'Only the admin can make financial adjustments.');
      break;
    }
    default:
      throw new ApiError(400, 'Invalid transaction type.');
  }

  appliedPayment = Number(paymentAmount) || 0;

  if (transactionType === 'new_bottle' || transactionType === 'refill') {
    if (appliedPayment > 0) {
      if (!appliedMethod) throw new ApiError(400, 'Please select a payment method.');
      const maxAllowed = totalAmount + Math.max(0, currentMoney.balance);
      if (!settings.allowAdvancePayment && !isAdmin && appliedPayment > maxAllowed) {
        throw new ApiError(400, `Payment amount cannot exceed the total due (${amountStr(maxAllowed)}). Enable advance payments in Settings to allow this.`);
      }
      if (appliedPayment > totalAmount) {
        txnMeta = { ...txnMeta, advancePaid: appliedPayment - totalAmount };
      }
    }
  } else {
    appliedPayment = 0;
  }

  const remainingDue = currentMoney.balance + totalAmount - appliedPayment;

  const txn = await Transaction().create({
    customerId,
    transactionType,
    date: trDate,
    quantity: qty,
    filledBottlesGiven: filledGiven,
    emptyBottlesReturned: emptyReturned,
    unitPrice: effectiveUnitPrice,
    totalAmount,
    paymentAmount: appliedPayment,
    paymentMethod: appliedMethod,
    remainingDue,
    notes: notes || '',
    createdBy: req.user._id,
    meta: txnMeta
  });

  let inv = null;
  try {
    inv = await applyTransactionInventory(txn, req.user._id);
  } catch (err) {
    await Transaction().deleteOne({ _id: txn._id });
    throw err;
  }

  const label = {
    new_bottle: 'New Bottle',
    refill: 'Refill',
    empty_return: 'Empty Bottle Return',
    damaged_lost: 'Damaged/Lost Bottle',
    adjustment: 'Bottle Adjustment',
    payment_adj: 'Financial Adjustment',
    opening: 'Opening Balance'
  }[transactionType];
  await writeAudit({
    req,
    action: 'CREATE_TRANSACTION',
    entityType: 'Transaction',
    entityId: txn._id,
    newValue: { type: label, qty, amount: totalAmount, payment: appliedPayment },
    details: `${label} for ${customer.name}: qty ${qty}, amount ${amountStr(totalAmount)}, paid ${amountStr(appliedPayment)}`
  });

  const [money, bottles] = await Promise.all([computeCustomerMoney(customerId), computeCustomerBottles(customerId)]);
  res.status(201).json({ success: true, transaction: txn, inventory: inv, customer: { money, bottles } });
});

export const listTransactions = asyncHandler(async (req, res) => {
  const { customerId, type = '', from, to, status = 'active', page = 1, limit = 30, paymentStatus = '' } = req.query;
  const q = {};
  if (customerId) q.customerId = customerId;
  if (status === 'all') delete q.status;
  else q.status = status;
  if (type) q.transactionType = type;
  if (from || to) {
    q.date = {};
    if (from) q.date.$gte = parseDate(from);
    if (to) q.date.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
  }
  const perPage = Math.min(parseInt(limit, 10) || 30, 200);
  const skip = (parseInt(page, 10) - 1) * perPage;
  const total = await Transaction().countDocuments(q);
  let txns = await Transaction()
    .find(q)
    .sort({ date: -1, createdAt: -1 })
    .skip(skip)
    .limit(perPage)
    .populate('customerId', 'name customerId phone')
    .populate('createdBy', 'name')
    .lean();

  const money = customerId ? await computeCustomerMoney(customerId) : null;
  if (paymentStatus === 'paid') txns = txns.filter((t) => t.paymentAmount > 0 || t.totalAmount === 0);
  if (paymentStatus === 'unpaid') txns = txns.filter((t) => t.totalAmount > 0 && t.paymentAmount === 0);
  if (paymentStatus === 'partial') txns = txns.filter((t) => t.totalAmount > 0 && t.paymentAmount > 0 && t.paymentAmount < t.totalAmount);

  res.json({ success: true, transactions: txns, total, page: parseInt(page, 10), customerMoney: money });
});

/**
 * Reverse/cancel an active transaction. Its effect on bottle balance,
 * inventory and money (all derived) are reversed automatically.
 */
export const cancelTransaction = asyncHandler(async (req, res) => {
  const txn = await Transaction().findById(req.params.id);
  if (!txn) throw new ApiError(404, 'Transaction not found.');
  if (txn.status === 'reversed') throw new ApiError(400, 'This transaction is already reversed.');
  if (req.user.role !== 'admin') {
    throw new ApiError(403, 'Only the admin can reverse transactions.');
  }
  const customer = txn.customerId ? await Customer().findById(txn.customerId) : null;
  txn.status = 'reversed';
  txn.reversedAt = new Date();
  txn.reversedBy = req.user._id;
  await txn.save();

  let inv = null;
  try {
    inv = await reverseTransactionInventory(txn, req.user._id);
  } catch (err) {
    txn.status = 'active';
    txn.reversedAt = undefined;
    txn.reversedBy = undefined;
    await txn.save();
    throw err;
  }

  await writeAudit({
    req,
    action: 'REVERSE_TRANSACTION',
    entityType: 'Transaction',
    entityId: txn._id,
    oldValue: { status: 'active' },
    newValue: { status: 'reversed' },
    details: `Reversed ${txn.transactionType} for ${customer ? customer.name : 'inventory'} (${amountStr(txn.totalAmount)})`
  });
  res.json({ success: true, message: 'Transaction reversed. All balances have been updated.' });
});