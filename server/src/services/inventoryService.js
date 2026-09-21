import mongoose from 'mongoose';
import ApiError from '../utils/ApiError.js';

/**
 * Service responsible for applying / reversing bottle inventory effects.
 * Every mutation updates the global Inventory doc and writes an InventoryLog row.
 *
 * Effects by transaction type:
 *  new_bottle(q)        storeEmpty -q                (empty gets filled & given)
 *  refill(q)            storeFilled -q, storeEmpty +q (filled given, empty returned)
 *  empty_return(q)      storeEmpty +q
 *  damaged_lost(q)      [source=customer] customer -q, damaged/lost +q
 *                       [source=store]     storeEmpty -q, damaged/lost +q
 *  adjustment add(q)    total +q, storeEmpty +q
 *  adjustment remove(q) total -q, storeEmpty -q
 *  opening bottles(q)   storeEmpty -q, customer +q
 */

export async function ensureInventory() {
  const Inventory = mongoose.model('Inventory');
  let inv = await Inventory.findOne();
  if (!inv) inv = await Inventory.create({ totalBottles: 500, storeFilled: 0, storeEmpty: 500, damaged: 0, lost: 0 });
  return inv;
}

function assertNonNegative(label, value, extra = '') {
  if (value < 0) {
    throw new ApiError(400, `Not enough ${label} ${extra ? `(${extra})` : ''}. Please adjust inventory first.`);
  }
}

/**
 * Refill: store gains `q` empty, loses `q` filled. If not enough filled
 * bottles are ready, bottles are filled on the spot from empty stock so the
 * store pool never has to go negative (physically accurate for shops).
 */
function applyRefill(inv, q) {
  if (inv.storeFilled < q) {
    const shortfall = q - inv.storeFilled;
    if (inv.storeEmpty < shortfall) {
      throw new ApiError(400, `Not enough bottles in the store for this refill (need ${q}, only ${inv.storeFilled + inv.storeEmpty} available).`);
    }
    inv.storeEmpty -= shortfall;
    inv.storeFilled += shortfall;
  }
  inv.storeFilled -= q;
  inv.storeEmpty += q;
  return inv;
}

/**
 * Apply a set of deltas to global inventory.
 * deltas: { storeEmpty, storeFilled, total, damaged, lost }
 */
export async function applyInventoryDeltas(deltas) {
  const inv = await ensureInventory();
  const storeEmpty = inv.storeEmpty + (deltas.storeEmpty || 0);
  const storeFilled = inv.storeFilled + (deltas.storeFilled || 0);
  const total = inv.totalBottles + (deltas.total || 0);
  const damaged = inv.damaged + (deltas.damaged || 0);
  const lost = inv.lost + (deltas.lost || 0);

  assertNonNegative('empty bottles in store', storeEmpty);
  assertNonNegative('filled bottles in store', storeFilled);
  assertNonNegative('damaged bottles', damaged);
  assertNonNegative('lost bottles', lost);
  assertNonNegative('total owned bottles', total);

  inv.storeEmpty = storeEmpty;
  inv.storeFilled = storeFilled;
  inv.totalBottles = total;
  inv.damaged = damaged;
  inv.lost = lost;
  await inv.save();
  return inv;
}

/**
 * Record bottle ledger history for a bottle-affecting event.
 */
export async function logInventory({
  type,
  quantity = 0,
  customerId = null,
  storeEmptyDelta = 0,
  storeFilledDelta = 0,
  totalDelta = 0,
  damagedDelta = 0,
  lostDelta = 0,
  customerDelta = 0,
  date = new Date(),
  source = 'system',
  notes = '',
  createdBy = null,
  transactionId = null
}) {
  const InventoryLog = mongoose.model('InventoryLog');
  await InventoryLog.create({
    type,
    quantity,
    customerId,
    storeEmptyDelta,
    storeFilledDelta,
    totalDelta,
    damagedDelta,
    lostDelta,
    customerDelta,
    date,
    source,
    notes,
    createdBy,
    transactionId
  });
}

/**
 * Apply inventory effect of an ACTIVE transaction being created.
 * Returns a summary description for the audit log.
 */
export async function applyTransactionInventory(txn, createdBy) {
  const q = txn.quantity || 0;
  const type = txn.transactionType;
  const meta = txn.meta || {};

  const de = (() => {
    switch (type) {
      case 'new_bottle': return -q;
      case 'refill': return q;
      case 'empty_return': return q;
      case 'damaged_lost': return meta.source === 'customer' ? 0 : -q;
      case 'adjustment': return meta.kind === 'add' ? q : -q;
      case 'opening': return -(meta.bottleBalance || 0);
      default: return 0;
    }
  })();
  const df = type === 'refill' ? -q : 0;
  const dt = type === 'adjustment' ? (meta.kind === 'add' ? q : -q) : 0;
  const dl = type === 'damaged_lost' && meta.kind === 'loss' ? q : 0;
  const dd = type === 'damaged_lost' && meta.kind !== 'loss' ? q : 0;
  const cd = (() => {
    switch (type) {
      case 'new_bottle': return q;
      case 'damaged_lost': return meta.source === 'customer' ? -q : 0;
      case 'opening': return -(meta.bottleBalance || 0);
      default: return 0;
    }
  })();

  let logType = type;
  let source = 'system';
  let note = txn.notes || '';
  switch (type) {
    case 'new_bottle': logType = 'new_bottle'; source = 'customer'; break;
    case 'refill': logType = 'refill'; source = 'customer'; break;
    case 'empty_return': logType = 'empty_return'; source = 'customer'; break;
    case 'damaged_lost': {
      logType = meta.kind === 'loss' ? 'lost' : 'damaged';
      source = meta.source || 'store';
      break;
    }
    case 'adjustment':
      logType = meta.kind === 'add' ? 'adjustment_add' : 'adjustment_remove';
      source = 'store';
      break;
    case 'opening': logType = 'opening'; source = 'store'; break;
    case 'payment_adj':
    default:
      return { deltas: null, log: null };
  }

  let inv;
  if (type === 'refill') {
    inv = await ensureInventory();
    applyRefill(inv, q);
    await inv.save();
  } else {
    inv = await applyInventoryDeltas({ storeEmpty: de, storeFilled: df, total: dt, damaged: dd, lost: dl });
  }
  const lg = await logInventory({
    type: logType,
    quantity: q,
    customerId: txn.customerId,
    storeEmptyDelta: de,
    storeFilledDelta: df,
    totalDelta: dt,
    damagedDelta: dd,
    lostDelta: dl,
    customerDelta: cd,
    date: txn.date,
    source,
    notes: note,
    createdBy,
    transactionId: txn._id
  });
  return { inv, log: lg };
}

/**
 * Reverse the inventory effect of a transaction (flip all deltas).
 */
export async function reverseTransactionInventory(txn, reversedBy) {
  const q = txn.quantity || 0;
  const type = txn.transactionType;
  let de = 0, df = 0, dt = 0, dd = 0, dl = 0, cd = 0;
  let logType = 'reversed';

  switch (type) {
    case 'new_bottle': de = q; cd = -q; break;
    case 'refill': df = q; de = -q; break;
    case 'empty_return': de = -q; break;
    case 'damaged_lost': {
      const kind = txn.meta?.kind || 'damaged';
      const src = txn.meta?.source || 'store';
      if (src === 'customer') cd = q;
      else de = q;
      if (kind === 'loss') dl = -q;
      else dd = -q;
      break;
    }
    case 'adjustment': {
      const kind = txn.meta?.kind || 'add';
      if (kind === 'add') { de = -q; dt = -q; }
      else { de = q; dt = q; }
      break;
    }
    case 'opening': {
      const b = txn.meta?.bottleBalance || 0;
      if (b > 0) { de = b; cd = -b; }
      break;
    }
    default:
      return null;
  }

  const inv = await applyInventoryDeltas({ storeEmpty: de, storeFilled: df, total: dt, damaged: dd, lost: dl });
  await logInventory({
    type: logType,
    quantity: q,
    customerId: txn.customerId,
    storeEmptyDelta: de,
    storeFilledDelta: df,
    totalDelta: dt,
    damagedDelta: dd,
    lostDelta: dl,
    customerDelta: cd,
    date: new Date(),
    source: 'system',
    notes: `Reversed ${type} (${txn._id})`,
    createdBy: reversedBy,
    transactionId: txn._id
  });
  return inv;
}

export async function getInventorySnapshot() {
  const Inventory = mongoose.model('Inventory');
  const Customer = mongoose.model('Customer');
  const Transaction = mongoose.model('Transaction');
  const inv = await ensureInventory();
  const customers = await Customer.find({ status: 'active' }).select('_id').lean();
  let withCustomers = 0;
  for (const c of customers) {
    const txns = await Transaction.find({ customerId: c._id, status: 'active' }).lean();
    let bal = 0;
    for (const t of txns) bal += (t.filledBottlesGiven || 0) - (t.emptyBottlesReturned || 0);
    withCustomers += bal;
  }
  return {
    totalBottles: inv.totalBottles,
    storeFilled: inv.storeFilled,
    storeEmpty: inv.storeEmpty,
    store: inv.storeFilled + inv.storeEmpty,
    withCustomers,
    damaged: inv.damaged,
    lost: inv.lost,
    damagedLost: inv.damaged + inv.lost
  };
}