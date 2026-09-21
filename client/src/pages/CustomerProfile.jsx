import { useEffect, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, Phone, MapPin, Droplets, RefreshCcw, PackagePlus,
  HandCoins, Printer, Download, Package, Pencil
} from 'lucide-react';
import api from '../api/client.js';
import { PageLoader, EmptyState } from '../components/EmptyState.jsx';
import StatCard from '../components/StatCard.jsx';
import Badge from '../components/Badge.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { inr, fmtDate, fmtDateTime, TYPE_LABELS, exportCsv, PAY_METHOD_LABEL, toDateInput, todayInput } from '../utils/format.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function CustomerProfile() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { isAdmin } = useAuth();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get(`/customers/${id}/ledger`);
      setData(d);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <PageLoader />;
  if (!data) return <p className="text-center py-16 text-slate-500">Customer not found.</p>;

  const { customer, entries } = data;
  const s = customer.summary;
  const money = s.money;
  const bottles = s.bottles;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/customers" className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1 font-semibold">
            <ArrowLeft className="w-4 h-4" /> Customers
          </Link>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-2xl font-extrabold text-slate-900">{customer.name}</h1>
            <Badge color={customer.customerType === 'credit' ? 'amber' : 'green'} label={customer.customerType === 'credit' ? 'Credit' : 'Cash'} />
            <Badge color={customer.status === 'active' ? 'green' : 'slate'} label={customer.status} />
          </div>
          <p className="text-sm text-slate-500">{customer.customerId}</p>
          <div className="flex flex-wrap gap-3 mt-1 text-sm text-slate-600">
            <span className="flex items-center gap-1"><Phone className="w-4 h-4" /> {customer.phone || '—'}</span>
            <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {customer.area || customer.address || '—'}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 no-print">
          <Link to={`/new-bottle?customer=${customer._id}`} className="btn bg-purple-600 text-white hover:bg-purple-700">
            <PackagePlus className="w-4 h-4" /> New Bottle
          </Link>
          <Link to={`/refill?customer=${customer._id}`} className="btn bg-sky-600 text-white hover:bg-sky-700">
            <RefreshCcw className="w-4 h-4" /> Refill
          </Link>
          <Link to={`/payments?customer=${customer._id}`} className="btn bg-emerald-600 text-white hover:bg-emerald-700">
            <HandCoins className="w-4 h-4" /> Receive Payment
          </Link>
        </div>
      </div>

      {/* Money status banner */}
      <div className={`card p-4 flex flex-wrap items-center justify-between gap-3 border-l-4 ${money.balance > 0 ? 'border-l-red-500' : 'border-l-emerald-500'}`}>
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase">Outstanding Due</p>
          <p className={`text-3xl font-extrabold ${money.balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{inr(money.balance)}</p>
          {money.advance > 0 && <p className="text-xs font-semibold text-sky-600">Advance balance {inr(money.advance)} available</p>}
        </div>
        <div className="text-right text-sm text-slate-600">
          <p>Total charges <b>{inr(money.totalCharges)}</b></p>
          <p>Total paid <b>{inr(money.paid)}</b></p>
          <p>Last payment: <b>{fmtDate(money.lastPayment)}</b></p>
          <p>Last transaction: <b>{fmtDate(money.lastTransaction)}</b></p>
        </div>
      </div>

      {/* Bottle + money cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard label="New Bottles Given" value={bottles.given || 0} icon={PackagePlus} accent="purple" />
        <StatCard label="Empty Returned" value={bottles.returned || 0} icon={Package} accent="blue" />
        <StatCard label="Total Refills" value={bottles.refills || 0} icon={RefreshCcw} accent="amber" />
        <StatCard label="Bottles With Customer" value={bottles.balance || 0} icon={Droplets} accent="brand" />
        <StatCard label="Bottle Charges" value={inr(money.newBottleCharges + money.refillCharges + money.otherCharges)} sub={`New ${inr(money.newBottleCharges)} · Refill ${inr(money.refillCharges)}`} accent="brand" />
        <StatCard label="Outstanding Due" value={inr(money.balance)} icon={HandCoins} accent={money.balance > 0 ? 'red' : 'green'} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Mini label="New Bottle Charges" value={inr(money.newBottleCharges)} />
        <Mini label="Refill Charges" value={inr(money.refillCharges)} />
        <Mini label="Total Charges" value={inr(money.totalCharges)} />
        <Mini label="Total Paid" value={inr(money.paid)} />
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-slate-500">
        <span>Last Refill: <b>{fmtDate(bottles.lastRefill)}</b></span>
        <span>·</span>
        <span>Last Payment: <b>{fmtDate(money.lastPayment)}</b></span>
        <span>·</span>
        <span>Created: <b>{fmtDate(customer.createdAt)}</b></span>
        {customer.notes && <span>· Notes: <b>{customer.notes}</b></span>}
      </div>

      {/* Ledger */}
      <Ledger customer={customer} entries={entries} isAdmin={isAdmin} onChanged={load} />
    </div>
  );
}

function Mini({ label, value }) {
  return (
    <div className="card px-4 py-3">
      <p className="text-[11px] font-bold text-slate-400 uppercase">{label}</p>
      <p className="font-extrabold text-slate-800">{value}</p>
    </div>
  );
}

function Ledger({ customer, entries, isAdmin, onChanged }) {
  const [filter, setFilter] = useState('all');
  const { toast } = useToast();
  const visible = entries.filter((e) => filter === 'all' || e.type === filter);

  const doExport = () => {
    const rows = entries.map((e) => ({
      date: fmtDate(e.date),
      type: TYPE_LABELS[e.type] || e.type,
      filled: e.filled,
      empty: e.empty,
      rate: e.rate,
      amount: e.amount,
      paid: e.paid,
      runningBalance: e.runningDue
    }));
    exportCsv(rows, `${customer.customerId}-ledger.csv`);
    toast('Ledger exported to CSV.', 'success');
  };

  const onPrint = () => window.print();

  const reverse = async (id) => {
    if (!window.confirm('Reverse this transaction? Its effect on bottles and money will be reversed. This action is recorded in audit logs.')) return;
    try {
      await api.post(`/transactions/${id}/cancel`);
      toast('Transaction reversed.', 'success');
      onChanged();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="font-extrabold text-slate-800">Customer Ledger</h2>
          <select className="input !w-auto !py-1.5 text-xs" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="new_bottle">New Bottles</option>
            <option value="refill">Refills</option>
            <option value="empty_return">Empty Returns</option>
            <option value="payment">Payments</option>
            <option value="damaged_lost">Damaged/Lost</option>
            <option value="adjustment">Adjustments</option>
            <option value="opening">Opening</option>
          </select>
        </div>
        <div className="flex gap-2 no-print">
          <button className="btn-secondary !py-1.5 text-xs" onClick={doExport}><Download className="w-4 h-4" /> Export CSV</button>
          <button className="btn-secondary !py-1.5 text-xs" onClick={onPrint}><Printer className="w-4 h-4" /> Print</button>
        </div>
      </div>
      <div className="print-area">
        <div className="hidden print:block px-4 pt-4 pb-2">
          <h1 className="text-xl font-extrabold">{customer.name} — Ledger</h1>
          <p className="text-sm text-slate-500">{customer.customerId} · {customer.phone}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] hidden md:table">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">Date</th>
                <th className="th">Transaction</th>
                <th className="th text-center">Filled Given</th>
                <th className="th text-center">Empty Returned</th>
                <th className="th text-right">Rate</th>
                <th className="th text-right">Amount</th>
                <th className="th text-right">Paid</th>
                <th className="th text-right">Due</th>
                {isAdmin && <th className="th"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((e) => (
                <tr key={e._id} className="hover:bg-slate-50">
                  <td className="td text-slate-500">{fmtDate(e.date)}</td>
                  <td className="td">
                    <span className={`chip ${
                      e.type === 'new_bottle' ? 'bg-purple-100 text-purple-700'
                      : e.type === 'refill' ? 'bg-sky-100 text-sky-700'
                      : e.type === 'payment' ? 'bg-emerald-100 text-emerald-700'
                      : e.type === 'opening' ? 'bg-slate-200 text-slate-600'
                      : 'bg-slate-100 text-slate-600'
                    }`}>
                      {TYPE_LABELS[e.type] || e.type}
                    </span>
                    {e.notes && <p className="text-[11px] text-slate-400 mt-0.5">{e.notes}</p>}
                  </td>
                  <td className="td text-center">{e.filled || '—'}</td>
                  <td className="td text-center">{e.empty || '—'}</td>
                  <td className="td text-right text-slate-500">{e.rate ? inr(e.rate) : '—'}</td>
                  <td className="td text-right font-semibold">{e.amount ? inr(e.amount) : '—'}</td>
                  <td className="td text-right font-semibold text-emerald-700">{e.paid ? inr(e.paid) : '—'}</td>
                  <td className={`td text-right font-bold ${e.runningDue > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{inr(e.runningDue)}</td>
                  {isAdmin && (
                    <td className="td">
                      {e.status === 'active' && e.type !== 'payment' && (
                        <button onClick={() => reverse(e._id)} className="text-xs text-red-500 hover:underline">Reverse</button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          <ul className="md:hidden divide-y divide-slate-100">
            {visible.map((e) => (
              <li key={e._id} className="px-4 py-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`chip ${
                      e.type === 'new_bottle' ? 'bg-purple-100 text-purple-700'
                      : e.type === 'refill' ? 'bg-sky-100 text-sky-700'
                      : e.type === 'payment' ? 'bg-emerald-100 text-emerald-700'
                      : e.type === 'opening' ? 'bg-slate-200 text-slate-600'
                      : 'bg-slate-100 text-slate-600'
                    }`}>
                      {TYPE_LABELS[e.type] || e.type}
                    </span>
                    <span className="text-xs text-slate-400">{fmtDate(e.date)}</span>
                  </div>
                  <span className={`font-extrabold ${e.runningDue > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{inr(e.runningDue)}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-slate-50 rounded-lg py-2">
                    <p className="text-slate-400">Filled</p>
                    <p className="font-bold text-slate-700">{e.filled || '—'}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg py-2">
                    <p className="text-slate-400">Empty</p>
                    <p className="font-bold text-slate-700">{e.empty || '—'}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg py-2">
                    <p className="text-slate-400">Amount</p>
                    <p className="font-bold text-slate-700">{e.amount ? inr(e.amount) : '—'}</p>
                  </div>
                </div>
                {(e.paid ? inr(e.paid) : null) && (
                  <p className="text-xs text-emerald-700">Paid: {e.paid ? inr(e.paid) : '—'}</p>
                )}
                {e.notes && <p className="text-xs text-slate-400">{e.notes}</p>}
                {isAdmin && e.status === 'active' && e.type !== 'payment' && (
                  <button onClick={() => reverse(e._id)} className="text-xs text-red-500 hover:underline">Reverse</button>
                )}
              </li>
            ))}
          </ul>
        </div>
        {visible.length === 0 && <EmptyState message="No entries for this filter." />}
      </div>
    </div>
  );
}