import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { PackagePlus, RefreshCcw, Save, Droplets, Wallet, AlertTriangle, RotateCcw } from 'lucide-react';
import api from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import CustomerPicker from '../components/CustomerPicker.jsx';
import { PAY_METHODS, inr, todayInput, toDateInput } from '../utils/format.js';

export default function BottleTxn({ kind }) {
  const isRefill = kind === 'refill';
  const Title = isRefill ? 'Quick Refill' : 'New Bottle';
  const [settings, setSettings] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState('');
  const [payment, setPayment] = useState(0);
  const [method, setMethod] = useState('cash');
  const [date, setDate] = useState(todayInput());
  const [notes, setNotes] = useState('');
  const [override, setOverride] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);

  useEffect(() => {
    api.get('/settings').then((d) => {
      setSettings(d.settings);
      setPrice(isRefill ? d.settings.refillPrice : d.settings.newBottlePrice);
    }).catch(() => {});
  }, [isRefill]);

  // Optional customer pre-selection via ?customer=
  useEffect(() => {
    const cid = params.get('customer');
    if (cid) {
      api.get(`/customers/${cid}`).then((d) => {
        setCustomer({ ...d.customer, due: d.customer.summary.money.balance, bottlesWithCustomer: d.customer.summary.bottles.balance });
        params.delete('customer');
        navigate(`${location.pathname}`, { replace: true });
      }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unitPrice = Number(price) || 0;
  const total = qty * unitPrice;
  const dueBefore = customer?.due ?? 0;
  const newDue = Math.max(0, dueBefore + total - (Number(payment) || 0));

  const exceeding = Number(payment) > total + Math.max(0, dueBefore) && (!isAdmin && !settings?.allowAdvancePayment);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!customer) return toast('Please select a customer.', 'error');
    const body = {
      customerId: customer._id,
      transactionType: kind,
      quantity: Number(qty),
      paymentAmount: Number(payment) || 0,
      paymentMethod: Number(payment) > 0 ? method : '',
      date: date ? new Date(date) : undefined,
      notes,
      unitPrice: unitPrice
    };
    if (isRefill && override) body.override = true;
    setSaving(true);
    try {
      const res = await api.post('/transactions', body);
      toast(
        `${Title} saved. Bottles with customer: ${res.customer.bottles.balance}, Due: ${inr(res.customer.money.balance)}`,
        'success'
      );
      navigate(`/customers/${customer._id}`);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return null;

  const canResolve = customer && Number(qty) > customer.bottlesWithCustomer && isRefill && isAdmin;
  const overrideEnabledBySetting = !!settings?.allowRefillOverride;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            {isRefill ? <RefreshCcw className="w-6 h-6 text-sky-600" /> : <PackagePlus className="w-6 h-6 text-purple-600" />}
            {Title}
          </h1>
          <p className="text-sm text-slate-500">
            {isRefill ? 'Return empty · get filled · balance stays same' : 'New filled bottle at default price'}
          </p>
        </div>
        <Link to="/customers" className="btn-secondary !py-2 text-sm">Add Customer</Link>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <CustomerPicker selected={customer} onSelect={setCustomer} onClear={() => setCustomer(null)} />

        <div className="grid grid-cols-2 gap-3">
          <div className="card p-3 border-slate-200">
            <p className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-1"><Droplets className="w-3 h-3" /> Bottles with customer</p>
            <p className="text-2xl font-extrabold text-slate-900">{customer?.bottlesWithCustomer ?? 0}</p>
          </div>
          <div className="card p-3 border-slate-200">
            <p className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-1"><Wallet className="w-3 h-3" /> Current due</p>
            <p className={`text-2xl font-extrabold ${(customer?.due ?? 0) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{customer ? inr(dueBefore) : '—'}</p>
          </div>
        </div>

        <div>
          <label className="label">Date</label>
          <input type="date" className="input" value={date} max={todayInput()} onChange={(e) => setDate(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Quantity (bottles) *</label>
            <input
              type="number"
              min="1"
              step="1"
              className="input !text-lg font-bold"
              value={qty}
              onChange={(e) => setQty(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
            />
            {isRefill && customer && Number(qty) > customer.bottlesWithCustomer && (
              <div className={`mt-1.5 flex items-start gap-1.5 text-xs font-semibold ${isAdmin || overrideEnabledBySetting ? 'text-amber-600' : 'text-red-600'}`}>
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                {isAdmin
                  ? `Customer only has ${customer.bottlesWithCustomer} bottles. Your override is required to proceed.`
                  : overrideEnabledBySetting
                    ? `Customer only has ${customer.bottlesWithCustomer} bottles. Refill override is enabled in Settings, so you can proceed.`
                    : `Customer only has ${customer.bottlesWithCustomer} bottles available for refill.`}
              </div>
            )}
          </div>
          <div>
            <label className="label">Rate per bottle (₹)</label>
            <input
              type="number"
              min="0"
              className="input !text-lg font-bold"
              value={price}
              disabled={!isAdmin}
              onChange={(e) => setPrice(e.target.value)}
            />
            <p className="text-[11px] text-slate-400 mt-1">
              {isRefill ? 'Default refill rate' : 'Default new bottle rate'}{isAdmin ? ' — tap to edit (admin)' : ''}
            </p>
          </div>
        </div>

        <div className="card !bg-slate-50 p-4 text-sm">
          <div className="flex justify-between py-1">
            <span className="text-slate-500">Total ({qty} × {inr(unitPrice)})</span>
            <b>{inr(total)}</b>
          </div>
          <div className="flex justify-between py-1 border-t border-slate-200 mt-1">
            <span className="text-slate-500">Paid now</span>
            <b className="text-emerald-600">- {inr(Number(payment) || 0)}</b>
          </div>
          <div className="flex justify-between py-1 border-t border-slate-200 mt-1 font-bold">
            <span>New due</span>
            <span className={newDue > 0 ? 'text-red-600' : 'text-emerald-600'}>{inr(newDue)}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Payment amount (₹)</label>
            <input type="number" min="0" className="input" value={payment} onChange={(e) => setPayment(Math.max(0, Number(e.target.value) || 0))} />
            {exceeding && (
              <p className="text-xs text-red-600 font-semibold mt-1">Payment exceeds total due. Enable advance in Settings (admin only).</p>
            )}
          </div>
          <div>
            <label className="label">Payment method</label>
            <div className="relative">
              <select className="input" value={method} onChange={(e) => setMethod(e.target.value)} disabled={Number(payment) === 0}>
                {PAY_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            {Number(payment) === 0 && <p className="text-[11px] text-slate-400 mt-1">Add a payment amount to choose method</p>}
          </div>
        </div>

        <div>
          <label className="label">Notes (optional)</label>
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything to remember..." />
        </div>

        {isRefill && customer && canResolve && !overrideEnabledBySetting && (
          <label className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
            <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
            <span className="flex items-center gap-1"><RotateCcw className="w-3.5 h-3.5" /> Admin override — allow refill beyond current balance</span>
          </label>
        )}

        <button type="submit" className="btn-primary w-full !py-3.5 !text-base" disabled={saving || !!exceeding || (isRefill && customer && Number(qty) > customer.bottlesWithCustomer && !(isAdmin && override) && !overrideEnabledBySetting)}>
          {saving ? 'Saving...' : (<><Save className="w-5 h-5" /> Save {Title}</>)}
        </button>
      </form>
    </div>
  );
}