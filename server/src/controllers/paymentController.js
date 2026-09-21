import mongoose from 'mongoose';
import { asyncHandler, ApiError, computeCustomerMoney, parseDate } from '../utils/helpers.js';
import { writeAudit } from '../services/auditService.js';

const Payment = () => mongoose.model('Payment');
const Customer = () => mongoose.model('Customer');
const Setting = () => mongoose.model('Setting');

export const createPayment = asyncHandler(async (req, res) => {
  const { customerId, amount, paymentMethod, referenceId = '', date, notes = '' } = req.body;
  if (!customerId) throw new ApiError(400, 'Please select a customer.');
  if (!amount || Number(amount) <= 0) throw new ApiError(400, 'Payment amount must be greater than zero.');
  if (!paymentMethod) throw new ApiError(400, 'Please select a payment method.');
  const customer = await Customer().findById(customerId);
  if (!customer) throw new ApiError(404, 'Customer not found.');

  const curr = await computeCustomerMoney(customerId);
  const settings = await Setting().getSettings();
  const amt = Number(amount);
  const isAdmin = req.user.role === 'admin';
  const overPay = amt > Math.max(0, curr.balance);

  if (curr.totalCharges === 0 && curr.paid === 0 && !isAdmin) {
    throw new ApiError(400, 'This customer has no outstanding due.');
  }
  if (overPay && !settings.allowAdvancePayment && !isAdmin) {
    throw new ApiError(
      400,
      `Payment (${amt.toLocaleString('en-IN')}) cannot exceed the outstanding due of ${curr.balance.toLocaleString('en-IN')}. Enable advance payments in Settings to collect more.`
    );
  }

  const payment = await Payment().create({
    customerId,
    amount: amt,
    paymentMethod,
    referenceId: String(referenceId || '').trim(),
    date: parseDate(date) || new Date(),
    notes: String(notes || '').trim(),
    createdBy: req.user._id
  });

  const after = await computeCustomerMoney(customerId);
  await writeAudit({
    req,
    action: 'RECEIVE_PAYMENT',
    entityType: 'Payment',
    entityId: payment._id,
    oldValue: { balance: curr.balance },
    newValue: { balance: after.balance },
    details: `${amountStr(amt)} payment from ${customer.name} (${paymentMethod})${overPay ? ' — advance amount credited' : ''}`
  });
  res.status(201).json({ success: true, payment, customerSummary: after, previousDue: curr.balance, remainingDue: after.balance });
});

export const listPayments = asyncHandler(async (req, res) => {
  const { customerId = '', from, to, method = '', page = 1, limit = 30 } = req.query;
  const q = {};
  if (customerId) q.customerId = customerId;
  if (method) q.paymentMethod = method;
  if (from || to) {
    q.date = {};
    if (from) q.date.$gte = parseDate(from);
    if (to) q.date.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
  }
  const perPage = Math.min(parseInt(limit, 10) || 30, 200);
  const skip = (parseInt(page, 10) - 1) * perPage;
  const total = await Payment().countDocuments(q);
  const payments = await Payment()
    .find(q)
    .sort({ date: -1, createdAt: -1 })
    .skip(skip)
    .limit(perPage)
    .populate('customerId', 'name customerId phone')
    .populate('createdBy', 'name')
    .lean();
  res.json({ success: true, payments, total, page: parseInt(page, 10) });
});

export const cancelPayment = asyncHandler(async (req, res) => {
  const payment = await Payment().findById(req.params.id);
  if (!payment) throw new ApiError(404, 'Payment not found.');
  if (payment.status === 'reversed') throw new ApiError(400, 'This payment is already reversed.');
  if (req.user.role !== 'admin') throw new ApiError(403, 'Only the admin can reverse payments.');
  payment.status = 'reversed';
  payment.reversedAt = new Date();
  payment.reversedBy = req.user._id;
  await payment.save();
  const customer = await Customer().findById(payment.customerId);
  await writeAudit({
    req,
    action: 'REVERSE_PAYMENT',
    entityType: 'Payment',
    entityId: payment._id,
    newValue: { status: 'reversed' },
    details: `Reversed ${amountStr(payment.amount)} payment from ${customer ? customer.name : ''}`
  });
  res.json({ success: true, message: 'Payment reversed. Outstanding due has been recalculated.' });
});

function amountStr(n) {
  return `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
}