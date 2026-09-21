import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import './src/models/index.js';
import { connectDB, disconnectDB } from './src/config/db.js';
import { ensureDefaults } from './src/services/bootstrapService.js';
import { ensureInventory } from './src/services/inventoryService.js';
import { applyTransactionInventory, applyInventoryDeltas, logInventory } from './src/services/inventoryService.js';
import { getNextCustomerId } from './src/utils/helpers.js';

async function seed() {
  await connectDB();
  await ensureDefaults();
  await ensureInventory();
  const reset = process.argv.includes('--reset') || process.env.RESET === '1';
  if (reset) {
    const cols = await mongoose.connection.db.collections();
    for (const c of cols) {
      if (['users', 'settings', 'inventories'].includes(c.collectionName)) continue;
      await c.drop().catch(() => {});
    }
    const inv = await ensureInventory();
    inv.totalBottles = 500;
    inv.storeFilled = 0;
    inv.storeEmpty = 500;
    inv.damaged = 0;
    inv.lost = 0;
    await inv.save();
    console.log('Existing data cleared (users/settings/inventory kept).');
  }

  const Customer = mongoose.model('Customer');
  const Transaction = mongoose.model('Transaction');
  const Payment = mongoose.model('Payment');

  if ((await Customer.countDocuments()) > 0 && !reset) {
    console.log('Customers already exist — skipping sample data. (Use --reset to reseed.)');
    await disconnectDB();
    return;
  }

  const customers = [
    { name: 'Raj Kumar', phone: '9876543210', address: 'Gali No 4, New Market', area: 'Sector 12', customerType: 'credit' },
    { name: 'Sunil Verma', phone: '9812345678', address: 'House 21, Green Park', area: 'Green Park', customerType: 'cash' },
    { name: 'Priya Sharma', phone: '9411234567', address: 'Flat 302, Rose Villa', area: 'Civil Lines', customerType: 'credit' },
    { name: 'Amit Singh', phone: '9001122334', address: 'Shop 12, Main Bazaar', area: 'Main Bazaar', customerType: 'cash' },
    { name: 'Meena Devi', phone: '9555667788', address: 'Ward 8', area: 'Old Town', customerType: 'credit' }
  ];

  const daysAgo = (n, h = 11) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(h, Math.floor(Math.random() * 50) + 5, 0, 0);
    return d;
  };

  const admin = await mongoose.model('User').findOne({ role: 'admin' });

  async function addTxn(customerId, type, qty, date, { paid = 0, method = '', price } = {}) {
    const unit = price ?? (type === 'new_bottle' ? 500 : type === 'refill' ? 250 : 0);
    const t = await Transaction.create({
      customerId,
      transactionType: type,
      date,
      quantity: qty,
      filledBottlesGiven: type === 'refill' ? qty : type === 'new_bottle' ? qty : 0,
      emptyBottlesReturned: type === 'refill' || type === 'empty_return' ? qty : 0,
      unitPrice: unit,
      totalAmount: qty * unit,
      paymentAmount: paid,
      paymentMethod: paid ? (method || 'cash') : '',
      remainingDue: qty * unit - paid,
      notes: 'Seeded sample data',
      createdBy: admin._id,
      status: 'active'
    });
    await applyTransactionInventory(t, admin._id);
    return t;
  }

  // Raj Kumar — the "complete customer example" from the spec
  const raj = await Customer.create({ customerId: await getNextCustomerId(), ...customers[0] });
  await addTxn(raj._id, 'new_bottle', 1, daysAgo(20), { paid: 0 });
  await addTxn(raj._id, 'refill', 1, daysAgo(13), { paid: 0 });
  await addTxn(raj._id, 'refill', 1, daysAgo(6), { paid: 250, method: 'upi' });
  await Payment.create({ customerId: raj._id, amount: 500, paymentMethod: 'cash', date: daysAgo(1), notes: 'Udhaar payment', createdBy: admin._id });

  // Sunil Verma — cash customer
  const sunil = await Customer.create({ customerId: await getNextCustomerId(), ...customers[1] });
  await addTxn(sunil._id, 'new_bottle', 2, daysAgo(15), { paid: 1000, method: 'cash' });
  await addTxn(sunil._id, 'refill', 2, daysAgo(9), { paid: 500, method: 'cash' });
  await addTxn(sunil._id, 'refill', 1, daysAgo(3), { paid: 250, method: 'upi' });

  // Priya Sharma
  const priya = await Customer.create({ customerId: await getNextCustomerId(), ...customers[2] });
  await addTxn(priya._id, 'new_bottle', 3, daysAgo(10), { paid: 500, method: 'cash' });
  await addTxn(priya._id, 'refill', 2, daysAgo(4), { paid: 0 });
  await Payment.create({ customerId: priya._id, amount: 800, paymentMethod: 'upi', date: daysAgo(2), referenceId: 'UPI987654', createdBy: admin._id });

  // Amit Singh
  const amit = await Customer.create({ customerId: await getNextCustomerId(), ...customers[3] });
  await addTxn(amit._id, 'new_bottle', 1, daysAgo(8), { paid: 0 });
  await addTxn(amit._id, 'refill', 1, daysAgo(1), { paid: 250, method: 'cash' });

  // Meena Devi — with opening balance
  const meena = await Customer.create({ customerId: await getNextCustomerId(), ...customers[4], openingBalance: 750, openingBottleBalance: 2 });
  const ot = await Transaction.create({
    customerId: meena._id,
    transactionType: 'opening',
    date: daysAgo(25),
    quantity: 2,
    filledBottlesGiven: 2,
    unitPrice: 0,
    totalAmount: 750,
    paymentAmount: 0,
    remainingDue: 750,
    notes: 'Opening balance',
    createdBy: admin._id,
    meta: { moneyBalance: 750, bottleBalance: 2 }
  });
  await applyInventoryDeltas({ storeEmpty: -2 });
  await logInventory({ type: 'opening', quantity: 2, customerId: meena._id, storeEmptyDelta: -2, customerDelta: 2, date: daysAgo(25), source: 'store', notes: 'Opening balance', createdBy: admin._id, transactionId: ot._id });

  console.log(`Seeded ${await Customer.countDocuments()} customers with realistic history.`);
  console.log('Login as admin/admin123 or staff/staff123.');
  await disconnectDB();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});