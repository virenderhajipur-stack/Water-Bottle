import { useEffect, useState, useCallback } from 'react';
import { ShieldCheck, Download, Filter } from 'lucide-react';
import api from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import Badge from '../components/Badge.jsx';
import Pagination from '../components/Pagination.jsx';
import { EmptyState, Spinner } from '../components/EmptyState.jsx';
import { fmtDateTime, todayInput, exportCsv } from '../utils/format.js';

const ACTIONS = [
  'LOGIN', 'CREATE_USER', 'UPDATE_USER', 'DELETE_USER', 'CHANGE_PASSWORD',
  'CREATE_CUSTOMER', 'UPDATE_CUSTOMER', 'TOGGLE_CUSTOMER_STATUS', 'DELETE_CUSTOMER',
  'CREATE_TRANSACTION', 'CANCEL_TRANSACTION', 'RECEIVE_PAYMENT', 'REVERSE_PAYMENT',
  'BOTTLE_ADJUST', 'BOTTLE_FILL', 'DAMAGED_LOST_RECORD', 'UPDATE_SETTING'
];

const ACTION_COLORS = {
  LOGIN: 'blue',
  CREATE_USER: 'purple',
  UPDATE_USER: 'purple',
  DELETE_USER: 'red',
  CHANGE_PASSWORD: 'amber',
  CREATE_CUSTOMER: 'green',
  UPDATE_CUSTOMER: 'blue',
  TOGGLE_CUSTOMER_STATUS: 'amber',
  DELETE_CUSTOMER: 'red',
  CREATE_TRANSACTION: 'green',
  CANCEL_TRANSACTION: 'red',
  RECEIVE_PAYMENT: 'green',
  REVERSE_PAYMENT: 'red',
  BOTTLE_ADJUST: 'amber',
  BOTTLE_FILL: 'blue',
  DAMAGED_LOST_RECORD: 'red',
  UPDATE_SETTING: 'amber'
};

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState(todayInput());
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page, limit: 50 });
      if (entity) qs.set('entityType', entity);
      if (action) qs.set('action', action);
      if (from) qs.set('from', from);
      if (to) qs.set('to', to);
      const data = await api.get(`/audit-logs?${qs}`);
      setLogs(data.logs);
      setTotal(data.total);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [page, entity, action, from, to, toast]);

  useEffect(() => { load(); }, [load]);

  const doExport = () => {
    const rows = logs.map((l) => ({
      date: fmtDateTime(l.createdAt),
      user: l.userName || (l.userId || 'system'),
      role: l.role,
      action: l.action,
      entity: l.entityType,
      id: l.entityId,
      details: l.details
    }));
    exportCsv(rows, 'audit-logs.csv');
    toast('Audit log exported.', 'success');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2"><ShieldCheck className="w-6 h-6 text-brand-600" /> Audit Logs</h1>
          <p className="text-sm text-slate-500">Every action on the system — tamper-proof record</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setShowFilters((s) => !s)}><Filter className="w-4 h-4" /> Filters</button>
          <button className="btn-secondary" onClick={doExport}><Download className="w-4 h-4" /> Export</button>
        </div>
      </div>

      {showFilters && (
        <div className="card p-4 grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="label">Entity</label>
            <select className="input" value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1); }}>
              <option value="">All entities</option>
              <option value="User">User</option>
              <option value="Customer">Customer</option>
              <option value="Transaction">Transaction</option>
              <option value="Payment">Payment</option>
              <option value="Setting">Settings</option>
              <option value="Inventory">Inventory</option>
            </select>
          </div>
          <div>
            <label className="label">Action</label>
            <select className="input" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>
              <option value="">All actions</option>
              {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="label">From</label>
            <input type="date" className="input" value={from} max={to || todayInput()} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
          </div>
          <div>
            <label className="label">To</label>
            <input type="date" className="input" value={to} max={todayInput()} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
          </div>
          <div className="flex items-end">
            <button className="btn-ghost !py-2 text-sm" onClick={() => { setEntity(''); setAction(''); setFrom(''); setTo(todayInput()); setPage(1); }}>Reset</button>
          </div>
        </div>
      )}

      <div className="card overflow-x-auto">
        {loading ? <Spinner /> : logs.length === 0 ? (
          <EmptyState message="No audit entries." sub="Try adjusting the filters." />
        ) : (
          <>
            <table className="w-full min-w-[760px] hidden md:table">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">Date</th>
                  <th className="th">User</th>
                  <th className="th">Action</th>
                  <th className="th">Entity</th>
                  <th className="th">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((l) => (
                  <tr key={l._id} className="hover:bg-slate-50 align-top">
                    <td className="td text-slate-500 whitespace-nowrap">{fmtDateTime(l.createdAt)}</td>
                    <td className="td">
                      <p className="font-semibold text-slate-800">{l.userName || 'System'}</p>
                      <p className="text-xs text-slate-400">{l.role}</p>
                    </td>
                    <td className="td"><Badge color={ACTION_COLORS[l.action] || 'slate'} label={l.action} /></td>
                    <td className="td text-slate-500">{l.entityType || '—'}</td>
                    <td className="td text-slate-600 max-w-md">{l.details || <span className="text-slate-300">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="md:hidden divide-y divide-slate-100">
              {logs.map((l) => (
                <li key={l._id} className="px-4 py-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Badge color={ACTION_COLORS[l.action] || 'slate'} label={l.action} />
                    <span className="text-xs text-slate-400">{fmtDateTime(l.createdAt)}</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {l.userName || 'System'}{l.role ? ` (${l.role})` : ''} · <span className="text-slate-400">{l.entityType || ''}</span>
                  </p>
                  {l.details && <p className="text-sm text-slate-600">{l.details}</p>}
                </li>
              ))}
            </ul>
          </>
        )}
        <Pagination page={page} total={total} perPage={50} onPage={setPage} />
      </div>
    </div>
  );
}