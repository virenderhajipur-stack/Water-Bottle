import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReceiptLines, buildReceiptNumber, buildTransactionReceiptHtml } from './receipt.mjs';

test('buildReceiptNumber includes invoice prefix', () => {
  assert.equal(buildReceiptNumber('abc123'), 'INV-ABC123');
});

test('buildReceiptLines includes customer and payment summary', () => {
  const payment = {
    _id: '64ed7f3a4d2d1c001a2b3c4d',
    amount: 1250,
    paymentMethod: 'upi',
    date: '2026-09-22T18:30:00.000Z',
    referenceId: 'UPI-123',
    customerId: { name: 'Rahul', customerId: 'CUST-101' },
    previousDue: 3000,
    remainingDue: 1750
  };

  const lines = buildReceiptLines(payment, {
    businessName: 'AquaPure Bottling Co.',
    businessPhone: '+91 98765 43210',
    businessAddress: 'B-14, River Road, Jaipur',
    receiptFooter: 'Thank you for your business!',
    signatureText: 'Manager Approval'
  });

  assert.ok(lines.some((line) => line.includes('AquaPure Bottling Co.')));
  assert.ok(lines.some((line) => line.includes('Rahul')));
  assert.ok(lines.some((line) => line.includes('₹1,250')));
  assert.ok(lines.some((line) => line.includes('Payment received')));
  assert.ok(lines.some((line) => line.includes('Manager Approval')));
});

test('buildTransactionReceiptHtml includes bottle sale details', () => {
  const html = buildTransactionReceiptHtml({
    _id: 'txn123',
    transactionType: 'new_bottle',
    customerId: { name: 'Raj Kumar', customerId: 'CUS-001' },
    date: '2026-09-22T10:00:00.000Z',
    quantity: 2,
    unitPrice: 50,
    totalAmount: 100,
    paymentAmount: 50,
    remainingDue: 50
  });

  assert.match(html, /New Bottle Invoice/);
  assert.match(html, /Raj Kumar/);
  assert.match(html, /2 bottles/);
  assert.match(html, /Remaining Due/);
});
