import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema(
  {
    customerId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true, index: true },
    phone: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    area: { type: String, trim: true, default: '' },
    customerType: { type: String, enum: ['cash', 'credit'], default: 'cash' },
    openingBalance: { type: Number, default: 0 },
    openingBottleBalance: { type: Number, default: 0 },
    notes: { type: String, default: '' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true }
  },
  { timestamps: true }
);

customerSchema.index({ phone: 1 });
customerSchema.index({ name: 'text', phone: 'text', customerId: 'text', area: 'text', address: 'text' });

export default mongoose.model('Customer', customerSchema);