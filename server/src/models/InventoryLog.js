import mongoose from 'mongoose';

/**
 * Chronological bottle inventory ledger. Every bottle-affecting event
 * writes one row so the inventory history / reconciliation can be audited.
 */
const inventoryLogSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['new_bottle', 'refill', 'empty_return', 'damaged', 'lost', 'adjustment_add', 'adjustment_remove', 'fill', 'opening', 'reversed'],
      required: true,
      index: true
    },
    quantity: { type: Number, default: 0 },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
    storeEmptyDelta: { type: Number, default: 0 },
    storeFilledDelta: { type: Number, default: 0 },
    totalDelta: { type: Number, default: 0 },
    damagedDelta: { type: Number, default: 0 },
    lostDelta: { type: Number, default: 0 },
    customerDelta: { type: Number, default: 0 },
    date: { type: Date, default: Date.now },
    source: { type: String, enum: ['customer', 'store', 'system'], default: 'system' },
    notes: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', default: null }
  },
  { timestamps: true }
);

export default mongoose.model('InventoryLog', inventoryLogSchema);