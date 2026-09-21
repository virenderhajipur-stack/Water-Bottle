import { useEffect, useState, useCallback } from 'react';
import { Boxes, Droplets, Warehouse, AlertTriangle, Plus, Minus, RefreshCcw, Download, Trash2 } from 'lucide-react';
import api from '../api/client.js';
import StatCard from '../components/StatCard.jsx';
import Modal from '../components/Modal.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import Badge from '../components/Badge.jsx';
import Pagination from '../components/Pagination.jsx';
import { EmptyState, Spinner } from '../components/EmptyState.jsx';
import { fmtDateTime, exportCsv } from '../utils/format.js';

const TYPE_COLORS = {
  new_bottle: 'purple',
  refill: 'blue',
  empty_return: 'green',
  damaged: 'red',
  lost: 'red',
  adjustment_add: 'green',
  adjustment_remove: 'red',
  fill: 'brand',
  opening: 'slate',
  reversed: 'slate'
};
const TYPE_LABELS = {
  new_bottle: 'New Bottle',
  refill: 'Refill',
  empty_return: 'Empty Return',
  damaged: 'Damaged',
  lost: 'Lost',
  adjustment_add: 'Adjustment +',
  adjustment_remove: 'Adjustment -',
  fill: 'Filled Stock',
  opening: 'Opening',
  reversed: 'Reversed'
};

export default function Inventory() {
  const [inv, setInv] = useState(null);
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [threshold, setThreshold] = useState(null);
  const [modal, setModal] = useState(null); // adjust | fill | damaged
  const { toast } = useToast();
  const { isAdmin } = useAuth();

  const load = useCallback(async () => {
    try {
      const [i, l, s] = await Promise.all([api.get('/inventory'), api.get(`/inventory/history?page=${page}&limit=30`), api.get('/settings').catch(() => null)]);
      setInv(i.inventory);
      setLogs(l.logs);
      setTotal(l.total);
      setThreshold(s?.settings?.lowStockThreshold ?? 20);
    } catch (err) {
      toast(err.message, 'error');
    }
  }, [page, toast]);

  useEffect(() => { load(); }, [load]);

  const lowStock = inv && threshold != null && inv.store < threshold;
  const doExport = () => {
    const rows = logs.map((l) => ({
      date: fmtDateTime(l.date),
      type: TYPE_LABELS[l.type] || l.type,
      quantity: l.quantity,
      customer: l.customerId?.name || '',
      storeEmptyΔ: l.storeEmptyDelta,
      storeFilledΔ: l.storeFilledDelta,
      totalΔ: l.totalDelta,
      damagedΔ: l.damagedDelta,
      lostΔ: l.lostDelta,
      customerΔ: l.customerDelta,
      notes: l.notes
    }));
    exportCsv(rows, 'inventory-history.csv');
    toast('Inventory history exported.', 'success');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Bottle Inventory</h1>
          <p className="text-sm text-slate-500">Automatic updates after every transaction</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={doExport}><Download className="w-4 h-4" /> Export</button>
          {isAdmin && (
            <>
              <button className="btn-secondary" onClick={() => setModal('fill')}><RefreshCcw className="w-4 h-4" /> Fill Stock</button>
              <button className="btn-secondary" onClick={() => setModal('adjust')}><Boxes className="w-4 h-4" /> Adjust</button>
              <button className="btn-danger" onClick={() => setModal('damaged')}><Trash2 className="w-4 h-4" /> Damaged/Lost</button>
            </>
          )}
        </div>
      </div>

      {lowStock && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          <p className="text-sm font-semibold text-amber-700">Low bottle stock: only {inv.store} bottles available in store.</p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        <StatCard label="Total Bottles Owned" value={inv?.totalBottles ?? 0} icon={Boxes} accent="brand" />
        <StatCard label="Filled In Store" value={inv?.storeFilled ?? 0} icon={Warehouse} accent="blue" />
        <StatCard label="Empty In Store" value={inv?.storeEmpty ?? 0} icon={Warehouse} accent="purple" />
        <StatCard label="Bottles With Customers" value={inv?.withCustomers ?? 0} icon={Droplets} accent="green" />
        <StatCard label="Damaged" value={inv?.damaged ?? 0} icon={AlertTriangle} accent="red" />
        <StatCard label="Lost" value={inv?.lost ?? 0} icon={AlertTriangle} accent="amber" />
      </div>

      <div className="card p-4">
        <h3 className="font-bold text-slate-800 mb-2">Availability</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-2xl font-extrabold text-slate-800">{inv?.store ?? 0}</p>
            <p className="text-xs font-semibold text-slate-500">Ready for sale / refill</p>
          </div>
          <div className="rounded-xl bg-sky-50 p-3">
            <p className="text-2xl font-extrabold text-sky-700">{inv?.storeFilled ?? 0}</p>
            <p className="text-xs font-semibold text-sky-600">Filled ready</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-2xl font-extrabold text-slate-800">{inv?.storeEmpty ?? 0}</p>
            <p className="text-xs font-semibold text-slate-500">Empty to be filled</p>
          </div>
          <div className="rounded-xl bg-emerald-50 p-3">
            <p className="text-2xl font-extrabold text-emerald-700">{inv?.withCustomers ?? 0}</p>
            <p className="text-xs font-semibold text-emerald-600">In customers' hands</p>
          </div>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <div className="px-4 py-3 flex items-center justify-between">
          <h3 className="font-extrabold text-slate-800">Bottle Movement History</h3>
          <span className="text-xs text-slate-400">{total} events</span>
        </div>
        {logs.length === 0 ? <EmptyState message="No bottle movements yet." /> : (
          <>
            <table className="w-full min-w-[820px] hidden md:table">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">Date</th>
                  <th className="th">Type</th>
                  <th className="th">Qty</th>
                  <th className="th">Customer</th>
                  <th className="th text-center">Empty Δ</th>
                  <th className="th text-center">Filled Δ</th>
                  <th className="th text-center">Customer Δ</th>
                  <th className="th">Notes</th>
                  <th className="th">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((l) => (
                  <tr key={l._id} className="hover:bg-slate-50">
                    <td className="td text-slate-500">{fmtDateTime(l.date)}</td>
                    <td className="td"><Badge color={TYPE_COLORS[l.type] || 'slate'} label={TYPE_LABELS[l.type] || l.type} /></td>
                    <td className="td font-bold">{l.quantity}</td>
                    <td className="td text-slate-600">{l.customerId?.name || '—'}</td>
                    <td className="td text-center">{delta(l.storeEmptyDelta)}</td>
                    <td className="td text-center">{delta(l.storeFilledDelta)}</td>
                    <td className="td text-center">{delta(l.customerDelta)}</td>
                    <td className="td text-slate-400 text-xs">{l.notes || ''}</td>
                    <td className="td text-slate-400">{l.createdBy?.name || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="md:hidden divide-y divide-slate-100">
              {logs.map((l) => (
                <li key={l._id} className="px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Badge color={TYPE_COLORS[l.type] || 'slate'} label={TYPE_LABELS[l.type] || l.type} />
                    <span className="text-xs text-slate-400">{fmtDateTime(l.date)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">{l.customerId?.name || 'Store / General'}</span>
                    <span className="font-extrabold text-slate-800">{l.quantity} bottles</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className={deltaCls(l.storeEmptyDelta)}>Empty {deltaTxt(l.storeEmptyDelta)}</span>
                    <span className={deltaCls(l.storeFilledDelta)}>Filled {deltaTxt(l.storeFilledDelta)}</span>
                    <span className={deltaCls(l.customerDelta)}>Cust {deltaTxt(l.customerDelta)}</span>
                  </div>
                  {l.notes && <p className="text-xs text-slate-400">{l.notes}</p>}
                </li>
              ))}
            </ul>
          </>
        )}
        <Pagination page={page} total={total} perPage={30} onPage={setPage} />
      </div>

      <ActionModal kind={modal} onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />
    </div>
  );
}

function deltaCls(n) { return n > 0 ? 'text-emerald-600' : n < 0 ? 'text-red-600' : 'text-slate-300'; }
function deltaTxt(n) { if (!n) return '—'; return `${n > 0 ? '+' : ''}${n}`; }

function delta(n) {
  if (!n) return <span className="text-slate-300">0</span>;
  return <span className={n > 0 ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold'}>{n > 0 ? `+${n}` : n}</span>;
}

function ActionModal({ kind, onClose, onDone }) {
  const [qty, setQty] = useState(1);
  const [kind2, setKind2] = useState('add');
  const [dKind, setDKind] = useState('damaged');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const open = !!kind;
  useEffect(() => {
    if (open) {
      setQty(1);
      setKind2('add');
      setDKind('damaged');
      setNotes('');
      setLoading(false);
    }
  }, [open]);

  const titles = { adjust: 'Bottle Adjustment', fill: 'Fill Stock', damaged: 'Damaged / Lost Bottles' };
  const isAdjust = kind === 'adjust';

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (kind === 'adjust') {
        await api.post('/inventory/adjust', { kind: kind2, quantity: Number(qty), reason: notes });
        toast(`${qty} bottles ${kind2 === 'add' ? 'added to' : 'removed from'} inventory.`, 'success');
      } else if (kind === 'fill') {
        await api.post('/inventory/fill', { quantity: Number(qty), notes });
        toast(`${qty} empty bottles marked as filled.`, 'success');
      } else {
        await api.post('/inventory/damaged', { kind: dKind, quantity: Number(qty), reason: notes });
        toast(`${qty} ${dKind} bottle(s) recorded.`, 'success');
      }
      onDone();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={!!kind} onClose={onClose} title={titles[kind] || ''} size="sm"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={submit} disabled={loading}>{loading ? 'Saving...' : 'Save'}</button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {isAdjust && (
          <div>
            <label className="label">Adjustment type</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setKind2('add')} className={`rounded-xl border-2 p-3 text-sm font-bold flex items-center justify-center gap-2 ${kind2 === 'add' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500'}`}>
                <Plus className="w-4 h-4" /> Add bottles
              </button>
              <button type="button" onClick={() => setKind2('remove')} className={`rounded-xl border-2 p-3 text-sm font-bold flex items-center justify-center gap-2 ${kind2 === 'remove' ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-200 text-slate-500'}`}>
                <Minus className="w-4 h-4" /> Remove bottles
              </button>
            </div>
          </div>
        )}
        {kind === 'damaged' && (
          <div>
            <label className="label">Type</label>
            <select className="input" value={dKind} onChange={(e) => setDKind(e.target.value)}>
              <option value="damaged">Damaged / Broken</option>
              <option value="lost">Lost</option>
            </select>
          </div>
        )}
        <div>
          <label className="label">Quantity *</label>
          <input type="number" min="1" step="1" className="input !text-lg font-bold" value={qty} onChange={(e) => setQty(Math.max(1, Math.floor(Number(e.target.value) || 1)))} />
        </div>
        <div>
          <label className="label">{isAdjust ? 'Reason *' : 'Reason / Notes'}</label>
          <input className="input" required={isAdjust} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Physical count differs by..." />
        </div>
      </form>
    </Modal>
  );
}