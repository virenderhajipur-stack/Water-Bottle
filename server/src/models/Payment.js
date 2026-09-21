import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    amount: { type: Number, required: true },
    paymentMethod: { type: String, enum: ['cash', 'upi', 'bank', 'other'], required: true },
    referenceId: { type: String, default: '' },
    date: { type: Date, required: true, default: Date.now },
    notes: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['active', 'reversed'], default: 'active', index: true },
    reversedAt: { type: Date },
    reversedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reverseOf: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null }
  },
  { timestamps: true }
);

paymentSchema.index({ customerId: 1, date: 1 });

export default mongoose.model('Payment', paymentSchema);