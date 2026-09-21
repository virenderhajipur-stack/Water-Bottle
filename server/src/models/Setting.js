import mongoose from 'mongoose';

const settingSchema = new mongoose.Schema(
  {
    businessName: { type: String, default: 'AquaPure Bottling Co.' },
    businessAddress: { type: String, default: '' },
    businessPhone: { type: String, default: '' },
    newBottlePrice: { type: Number, default: 500 },
    refillPrice: { type: Number, default: 250 },
    currencySymbol: { type: String, default: '₹' },
    allowAdvancePayment: { type: Boolean, default: false },
    allowRefillOverride: { type: Boolean, default: false },
    receiptHeader: { type: String, default: 'AquaPure Bottling Co. — Water Bottle Sales & Refill' },
    receiptFooter: { type: String, default: 'Thank you for your business!' },
    signatureText: { type: String, default: 'Authorized Signatory' },
    taxLabel: { type: String, default: '' },
    taxRate: { type: Number, default: 0 },
    lowStockThreshold: { type: Number, default: 20 },
    highDueAlert: { type: Number, default: 2000 }
  },
  { timestamps: true }
);

settingSchema.statics.getSettings = async function () {
  let s = await this.findOne();
  if (!s) {
    s = await this.create({});
  }
  return s;
};

export default mongoose.model('Setting', settingSchema);