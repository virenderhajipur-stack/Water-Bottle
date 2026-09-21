import { Router } from 'express';
import { protect, adminOnly } from '../middlewares/auth.js';
import {
  login, me, changePassword, listUsers, createUser, updateUser, deleteUser
} from '../controllers/authController.js';
import {
  listCustomers, searchCustomers, getCustomer, getCustomerLedger, createCustomer, updateCustomer, archiveCustomer, deleteCustomer
} from '../controllers/customerController.js';
import { createTransaction, listTransactions, cancelTransaction } from '../controllers/transactionController.js';
import { createPayment, listPayments, cancelPayment } from '../controllers/paymentController.js';
import { getInventory, getReconciliation, adjust, fill, recordDamagedLost, history } from '../controllers/inventoryController.js';
import { summary, charts } from '../controllers/dashboardController.js';
import { dailyReport, monthlyReport, dueReport, bottleReport, refillReport } from '../controllers/reportController.js';
import { getSettings, updateSettings } from '../controllers/settingController.js';
import { listAuditLogs } from '../controllers/auditController.js';
import { exportEntity } from '../controllers/exportController.js';

const router = Router();

router.post('/auth/login', login);
router.get('/auth/me', protect, me);
router.post('/auth/change-password', protect, changePassword);

router.use(protect);

router.get('/users', adminOnly, listUsers);
router.post('/users', adminOnly, createUser);
router.patch('/users/:id', adminOnly, updateUser);
router.delete('/users/:id', adminOnly, deleteUser);

router.get('/customers', listCustomers);
router.get('/customers/search', searchCustomers);
router.get('/customers/:id', getCustomer);
router.get('/customers/:id/ledger', getCustomerLedger);
router.post('/customers', createCustomer);
router.patch('/customers/:id', updateCustomer);
router.patch('/customers/:id/archive', archiveCustomer);
router.delete('/customers/:id', deleteCustomer);

router.post('/transactions', createTransaction);
router.get('/transactions', listTransactions);
router.post('/transactions/:id/cancel', cancelTransaction);

router.post('/payments', createPayment);
router.get('/payments', listPayments);
router.post('/payments/:id/cancel', cancelPayment);

router.get('/inventory', getInventory);
router.get('/inventory/reconciliation', getReconciliation);
router.post('/inventory/adjust', adminOnly, adjust);
router.post('/inventory/fill', adminOnly, fill);
router.post('/inventory/damaged', adminOnly, recordDamagedLost);
router.get('/inventory/history', history);

router.get('/dashboard/summary', summary);
router.get('/dashboard/charts', charts);

router.get('/reports/daily', dailyReport);
router.get('/reports/monthly', monthlyReport);
router.get('/reports/due', dueReport);
router.get('/reports/bottles', bottleReport);
router.get('/reports/refills', refillReport);

router.get('/settings', getSettings);
router.put('/settings', updateSettings);

router.get('/audit-logs', listAuditLogs);

router.get('/export/:entity', exportEntity);

export default router;