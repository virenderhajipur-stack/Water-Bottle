import mongoose from 'mongoose';

/**
 * transactionType:
 *  new_bottle     – filled bottle given (₹500 each), increases customer bottle balance
 *  refill         – empty returned + filled given (₹250 each), bottle balance unchanged
 *  empty_return   – only empty bottles returned to shop, bottle balance decreases
 *  damaged_lost   – bottle damaged/lost (source: customer or store), removed from active pool
 *  adjustment     – bottle adjustment tied to a customer (add/remove to customer balance)
 *  payment_adj    – financial adjustment for a customer (debit/credit note)
 *  opening        – opening balance (money and/or bottle) seeded when customer is created
 */
const transactionSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', index: true },
    transactionType: {
      type: String,
      enum: ['new_bottle', 'refill', 'empty_return', 'damaged_lost', 'adjustment', 'payment_adj', 'opening'],
      required: true,
      index: true
    },
    date: { type: Date, required: true, default: Date.now },
    quantity: { type: Number, default: 0 },
    filledBottlesGiven: { type: Number, default: 0 },
    emptyBottlesReturned: { type: Number, default: 0 },
    unitPrice: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    paymentAmount: { type: Number, default: 0 },
    paymentMethod: { type: String, enum: ['', 'cash', 'upi', 'bank', 'other'], default: '' },
    remainingDue: { type: Number, default: 0 },
    notes: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['active', 'reversed'], default: 'active', index: true },
    reversedAt: { type: Date },
    reversedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reverseOf: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', default: null },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

transactionSchema.index({ customerId: 1, date: 1 });
transactionSchema.index({ date: 1, transactionType: 1 });

export default mongoose.model('Transaction', transactionSchema);