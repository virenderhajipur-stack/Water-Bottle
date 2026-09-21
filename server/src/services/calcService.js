import mongoose from 'mongoose';
import ApiError from '../utils/ApiError.js';
import { computeCustomerBottles, computeCustomerMoney } from '../utils/helpers.js';

/**
 * Central calculation engine. All money & bottle balances are DERIVED
 * from the active transaction / payment history — never stored blindly.
 */

export async function getCustomerBottles(customerId) {
  return computeCustomerBottles(customerId);
}

export async function getCustomerMoney(customerId) {
  return computeCustomerMoney(customerId);
}

/**
 * Full customer summary (bottle + money side) used by the profile page.
 */
export async function getCustomerSummary(customerId) {
  const [bottles, money] = await Promise.all([getCustomerBottles(customerId), getCustomerMoney(customerId)]);
  return { bottles, money };
}

/**
 * Running due BEFORE applying a new charge of `amount` (used to snapshot remainingDue).
 */
export async function currentDueBefore(customerId, beforeDate = new Date()) {
  const m = await computeCustomerMoney(customerId, { upto: beforeDate });
  return m.balance;
}

/**
 * Validate that a refill does not exceed the customer's available bottles.
 * Allows admin override when setting is enabled or override flag is passed.
 */
export async function assertRefillAvailable(customerId, qty, { allowOverride = false } = {}) {
  const bottles = await getCustomerBottles(customerId);
  if (qty > bottles.balance && !allowOverride) {
    throw new ApiError(
      400,
      `Customer only has ${bottles.balance} bottle${bottles.balance === 1 ? '' : 's'} available for refill.`,
      { available: bottles.balance, requested: qty, allowOverride }
    );
  }
  return bottles;
}

export async function reconcileInventory() {
  const Inventory = mongoose.model('Inventory');
  const Customer = mongoose.model('Customer');
  const Transaction = mongoose.model('Transaction');

  const inv = await Inventory.findOne();
  const customers = await Customer.find({ status: 'active' }).select('_id').lean();
  let withCustomers = 0;
  for (const c of customers) {
    const txns = await Transaction.find({ customerId: c._id, status: 'active' }).select('filledBottlesGiven emptyBottlesReturned').lean();
    let bal = 0;
    for (const t of txns) bal += (t.filledBottlesGiven || 0) - (t.emptyBottlesReturned || 0);
    withCustomers += bal;
  }

  const totalBottles = inv?.totalBottles ?? 500;
  const damagedLost = (inv?.damaged || 0) + (inv?.lost || 0);
  const store = (inv?.storeFilled || 0) + (inv?.storeEmpty || 0);
  const actual = store + withCustomers + damagedLost;
  const difference = totalBottles - actual;
  const balanced = difference === 0;

  return {
    totalBottles,
    store,
    storeFilled: inv?.storeFilled || 0,
    storeEmpty: inv?.storeEmpty || 0,
    withCustomers,
    damaged: inv?.damaged || 0,
    lost: inv?.lost || 0,
    damagedLost,
    actual,
    difference,
    balanced
  };
}

export async function validateTransactionInput({ type, quantity, unitPrice, paymentAmount, customerId }) {
  if (!mongoose.isValidObjectId(customerId)) throw new ApiError(400, 'Please select a customer.');
  if (type === 'new_bottle' || type === 'refill' || type === 'empty_return' || type === 'damaged_lost' || type === 'adjustment') {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new ApiError(400, 'Quantity must be a positive whole number.');
    }
  }
  if (unitPrice != null && (typeof unitPrice !== 'number' || isNaN(unitPrice) || unitPrice < 0)) {
    throw new ApiError(400, 'Price must be a valid non-negative number.');
  }
  if (paymentAmount != null && (typeof paymentAmount !== 'number' || isNaN(paymentAmount) || paymentAmount < 0)) {
    throw new ApiError(400, 'Payment amount cannot be negative.');
  }
  return true;
}