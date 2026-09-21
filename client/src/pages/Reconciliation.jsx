import { useEffect, useState } from 'react';
import { Scale, CheckCircle2, AlertTriangle, Printer, Download } from 'lucide-react';
import api from '../api/client.js';
import { PageLoader } from '../components/EmptyState.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { num, exportCsv } from '../utils/format.js';

export default function Reconciliation() {
  const [rec, setRec] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    api.get('/inventory/reconciliation').then((d) => setRec(d.reconciliation)).catch((e) => toast(e.message, 'error'));
  }, [toast]);

  if (!rec) return <PageLoader />;

  const balanced = rec.balanced;

  const doPrint = () => window.print();
  const doExport = () => {
    exportCsv([
      { item: 'Total Bottles Owned', count: rec.totalBottles },
      { item: 'Bottles In Store', count: rec.store },
      { item: 'Bottles With Customers', count: rec.withCustomers },
      { item: 'Damaged / Lost', count: rec.damagedLost },
      { item: 'Actual Total', count: rec.actual },
      { item: 'Difference', count: rec.difference }
    ], 'reconciliation.csv');
    toast('Reconciliation exported.', 'success');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2"><Scale className="w-6 h-6 text-brand-600" /> Bottle Reconciliation</h1>
          <p className="text-sm text-slate-500">Formula: Owned = Store + With Customers + Damaged/Lost</p>
        </div>
        <div className="flex gap-2 no-print">
          <button className="btn-secondary !py-2 text-xs" onClick={doExport}><Download className="w-4 h-4" /> Export</button>
          <button className="btn-secondary !py-2 text-xs" onClick={doPrint}><Printer className="w-4 h-4" /> Print</button>
        </div>
      </div>

      <div className={`card p-6 text-center ${balanced ? 'border-l-4 border-l-emerald-500' : 'border-l-4 border-l-red-500'}`}>
        {balanced ? (
          <CheckCircle2 className="w-14 h-14 text-emerald-600 mx-auto mb-3" />
        ) : (
          <AlertTriangle className="w-14 h-14 text-red-600 mx-auto mb-3" />
        )}
        <h2 className={`text-2xl font-extrabold ${balanced ? 'text-emerald-600' : 'text-red-600'}`}>
          {balanced ? 'Inventory Balanced' : '⚠ Bottle Stock Mismatch Detected'}
        </h2>
        {!balanced && (
          <p className="text-sm text-slate-500 mt-1">
            Expected {rec.totalBottles}, actual {rec.actual} — difference of <b>{num(rec.difference)}</b> bottles.
          </p>
        )}
      </div>

      <div className="card divide-y divide-slate-100 print-area">
        <Row label="Total Bottles Owned" value={rec.totalBottles} />
        <div className="grid grid-cols-2">
          <Sub label="Filled in store" value={rec.storeFilled} />
          <Sub label="Empty in store" value={rec.storeEmpty} />
        </div>
        <Row label="Bottles In Store" value={rec.store} />
        <Row label="Bottles With Customers" value={rec.withCustomers} />
        <div className="grid grid-cols-2">
          <Sub label="Damaged" value={rec.damaged} />
          <Sub label="Lost" value={rec.lost} />
        </div>
        <Row label="Damaged / Lost Total" value={rec.damagedLost} />
        <Row label="Actual Total (Store + Customers + Damaged/Lost)" value={rec.actual} />
        <Row label="Difference (Expected − Actual)" value={rec.difference} balance />
      </div>

      <div className="card p-4">
        <p className="text-sm text-slate-600">
          The system derives <b>Bottles With Customers</b> from transaction history and maintains store inventory
          automatically. A mismatch &gt; 0 means some bottle is unaccounted for — use <b>Bottle Adjustment</b> to reconcile.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value, balance }) {
  return (
    <div className="px-5 py-3.5 flex items-center justify-between">
      <span className="text-slate-600 font-medium">{label}</span>
      <span className={`text-lg font-extrabold ${balance ? (value === 0 ? 'text-emerald-600' : 'text-red-600') : 'text-slate-800'}`}>{num(value)}</span>
    </div>
  );
}
function Sub({ label, value }) {
  return (
    <div className="px-5 py-2.5 flex items-center justify-between bg-slate-50/60 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="font-bold text-slate-700">{num(value)}</span>
    </div>
  );
}