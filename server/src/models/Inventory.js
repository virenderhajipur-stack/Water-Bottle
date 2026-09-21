import mongoose from 'mongoose';

/**
 * Single global inventory document. bottle counts (in units).
 * totalBottles    – complete bottles the business owns
 * storeFilled     – filled bottles ready at the store
 * storeEmpty      – empty bottles at the store
 * damaged         – damaged/broken bottles
 * lost            – lost bottles
 * BottlesWithCustomers is derived from customer balances.
 */
const inventorySchema = new mongoose.Schema(
  {
    totalBottles: { type: Number, default: 500 },
    storeFilled: { type: Number, default: 0 },
    storeEmpty: { type: Number, default: 500 },
    damaged: { type: Number, default: 0 },
    lost: { type: Number, default: 0 }
  },
  { timestamps: true }
);

inventorySchema.statics.getGlobal = async function () {
  let inv = await this.findOne().sort({ createdAt: 1 });
  if (!inv) {
    inv = await this.create({ totalBottles: 500, storeFilled: 0, storeEmpty: 500, damaged: 0, lost: 0 });
  }
  return inv;
};

export default mongoose.model('Inventory', inventorySchema);