import { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, HandCoins, Printer, Download, Droplets, Share2 } from 'lucide-react';
import api from '../api/client.js';
import Modal from '../components/Modal.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import Badge from '../components/Badge.jsx';
import Pagination from '../components/Pagination.jsx';
import { EmptyState, Spinner } from '../components/EmptyState.jsx';
import { inr, fmtDate, fmtDateTime, PAY_METHOD_LABEL, PAY_METHODS, todayInput, exportCsv } from '../utils/format.js';
import { buildReceiptHtml, buildReceiptNumber, formatMoney } from '../utils/receipt.mjs';

export default function Payments() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const customerParam = () => new URLSearchParams(location.search).get('customer') || '';

  const load = useCallback(async (customerId = '') => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page, limit: 25 });
      if (customerId) qs.set('customerId', customerId);
      const data = await api.get(`/payments?${qs}`);
      setRows(data.payments);
      setTotal(data.total);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    const customerId = new URLSearchParams(location.search).get('customer') || '';
    load(customerId);
  }, [load, location.search]);

  const reversePayment = async (p) => {
    if (!window.confirm(`Reverse ${inr(p.amount)} payment from ${p.customerId?.name}?`)) return;
    try {
      await api.post(`/payments/${p._id}/cancel`);
      toast('Payment reversed.', 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const doExport = () => {
    const r = rows.map((p) => ({
      date: fmtDate(p.date),
      customer: p.customerId?.name || '',
      customerId: p.customerId?.customerId || '',
      amount: p.amount,
      method: p.paymentMethod,
      reference: p.referenceId,
      status: p.status,
      recordedBy: p.createdBy?.name || ''
    }));
    exportCsv(r, 'payments.csv');
    toast('Payments exported.', 'success');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Payments</h1>
          <p className="text-sm text-slate-500">{total} payments recorded</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={doExport}><Download className="w-4 h-4" /> Export</button>
          <button className="btn-primary" onClick={() => { setShowNew(true); }}><Plus className="w-4 h-4" /> Receive Payment</button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        {loading ? <Spinner /> : rows.length === 0 ? (
          <EmptyState message="No payments found." sub="Record a payment to reduce a customer's udhaar." />
        ) : (
          <>
            <table className="w-full min-w-[760px] hidden md:table">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">Date</th>
                  <th className="th">Customer</th>
                  <th className="th text-right">Amount</th>
                  <th className="th">Method</th>
                  <th className="th">Reference</th>
                  <th className="th">Recorded By</th>
                  <th className="th">Status</th>
                  <th className="th text-center">Receipt</th>
                  {isAdmin && <th className="th"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((p) => (
                  <tr key={p._id} className="hover:bg-slate-50">
                    <td className="td text-slate-500">{fmtDate(p.date)}</td>
                    <td className="td">
                      <button className="font-bold text-slate-800 hover:text-brand-600" onClick={() => navigate(`/customers/${p.customerId?._id}`)}>
                        {p.customerId?.name || '—'}
                      </button>
                      <p className="text-xs text-slate-400">{p.customerId?.customerId}</p>
                    </td>
                    <td className="td text-right font-extrabold text-emerald-700">{inr(p.amount)}</td>
                    <td className="td"><Badge color="green" label={PAY_METHOD_LABEL[p.paymentMethod] || p.paymentMethod} /></td>
                    <td className="td text-slate-500">{p.referenceId || '—'}</td>
                    <td className="td text-slate-500">{p.createdBy?.name || '—'}</td>
                    <td className="td">
                      <Badge color={p.status === 'active' ? 'green' : 'red'} label={p.status === 'active' ? 'Active' : 'Reversed'} dot />
                    </td>
                    <td className="td text-center">
                      {p.status === 'active' && (
                        <button onClick={() => setReceipt(p)} className="chip bg-brand-50 text-brand-700 hover:bg-brand-100">Receipt</button>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="td">
                        {p.status === 'active' && (
                          <button onClick={() => reversePayment(p)} className="text-xs text-red-500 hover:underline">Reverse</button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="md:hidden divide-y divide-slate-100">
              {rows.map((p) => (
                <li key={p._id} className="px-4 py-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <button className="font-bold text-slate-800 hover:text-brand-600" onClick={() => navigate(`/customers/${p.customerId?._id}`)}>
                      {p.customerId?.name || '—'}
                    </button>
                    <span className="text-lg font-extrabold text-emerald-700 shrink-0">{inr(p.amount)}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>{fmtDate(p.date)}</span>
                    <Badge color="green" label={PAY_METHOD_LABEL[p.paymentMethod] || p.paymentMethod} />
                    {p.referenceId && <span className="truncate">Ref: {p.referenceId}</span>}
                    <span>{p.createdBy?.name || ''}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge color={p.status === 'active' ? 'green' : 'red'} label={p.status === 'active' ? 'Active' : 'Reversed'} dot />
                    <div className="flex items-center gap-2">
                      {p.status === 'active' && (
                        <button onClick={() => setReceipt(p)} className="chip bg-brand-50 text-brand-700 hover:bg-brand-100">Receipt</button>
                      )}
                      {isAdmin && p.status === 'active' && (
                        <button onClick={() => reversePayment(p)} className="text-xs text-red-500 hover:underline">Reverse</button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
        <Pagination page={page} total={total} perPage={25} onPage={setPage} />
      </div>

      <NewPayment
        open={showNew}
        preCustomer={customerParam()}
        onClose={() => setShowNew(false)}
        onSaved={(pay) => {
          setShowNew(false);
          setReceipt(pay);
          load();
        }}
      />

      <ReceiptModal payment={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
}

function NewPayment({ open, preCustomer, onClose, onSaved }) {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [customerId, setCustomerId] = useState(preCustomer || '');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [date, setDate] = useState(todayInput());
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setCustomerId(preCustomer || '');
      setSelected(null);
      setAmount('');
      setMethod('cash');
      setReference('');
      setDate(todayInput());
      setNotes('');
      if (preCustomer) {
        api.get(`/customers/${preCustomer}`).then((d) => setSelected({ _id: d.customer._id, name: d.customer.name, due: d.customer.summary.money.balance, customerId: d.customer.customerId })).catch(() => {});
      }
    }
  }, [open, preCustomer]);

  useEffect(() => {
    if (!open || preCustomer) return;
    let t;
    setCustomers([]);
    t = setTimeout(async () => {
      if (!search.trim()) {
        const data = await api.get('/customers?limit=50&sort=name');
        setCustomers(data.customers || []);
      } else {
        const data = await api.get(`/customers/search?q=${encodeURIComponent(search.trim())}`);
        setCustomers(data.customers || []);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [open, search, preCustomer]);

  const submit = async (e) => {
    e.preventDefault();
    if (!selected && !customerId) return toast('Please select a customer.', 'error');
    setLoading(true);
    try {
      const data = await api.post('/payments', {
        customerId: selected?._id || customerId,
        amount: Number(amount),
        paymentMethod: method,
        referenceId: reference,
        date: date ? new Date(date) : undefined,
        notes
      });
      if (data.payment) {
        onSaved({
          ...data.payment,
          customerId: { name: selected?.name || '', customerId: selected?.customerId || '' },
          previousDue: data.previousDue,
          remainingDue: data.remainingDue
        });
      } else {
        onSaved(null);
      }
      toast('Payment recorded.', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Receive Payment" size="lg"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={submit} disabled={loading}>{loading ? 'Saving...' : 'Save Payment'}</button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {!preCustomer && (
          <div>
            <label className="label">Customer</label>
            <input className="input" placeholder="Search customer..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="mt-1 max-h-44 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
              {customers.map((c) => (
                <button
                  key={c._id}
                  type="button"
                  onClick={() => { setCustomerId(c._id); setSelected({ _id: c._id, name: c.name, due: c.due, customerId: c.customerId }); }}
                  className={`w-full text-left px-3 py-2 hover:bg-brand-50 flex items-center justify-between ${selected?._id === c._id ? 'bg-brand-50' : ''}`}
                >
                  <span className="text-sm font-semibold">{c.name} <span className="text-slate-400 font-normal">· {c.customerId}</span></span>
                  <span className={`text-xs font-bold ${c.due > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{c.due > 0 ? `Due ${inr(c.due)}` : 'No due'}</span>
                </button>
              ))}
              {!loading && customers.length === 0 && <p className="px-3 py-2 text-xs text-slate-400">No customers match.</p>}
            </div>
          </div>
        )}
        {selected && (
          <div className="card !bg-slate-50 !border-brand-300 border-2 p-3 flex items-center justify-between">
            <div>
              <p className="font-bold"><HandCoins className="w-4 h-4 inline mr-1 text-emerald-600" /> {selected.name}</p>
              <p className="text-xs text-slate-500">Current due: <b className={selected.due > 0 ? 'text-red-600' : 'text-emerald-600'}>{inr(selected.due)}</b></p>
            </div>
            <Droplets className="w-5 h-5 text-slate-300" />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={date} max={todayInput()} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Amount (₹) *</label>
            <input type="number" min="1" className="input !text-lg font-bold" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Payment method *</label>
            <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
              {PAY_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Reference / Transaction ID</label>
            <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UPI ref / cheque no." />
          </div>
        </div>
        <div>
          <label className="label">Notes</label>
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </form>
    </Modal>
  );
}

function ReceiptModal({ payment, onClose }) {
  const [settings, setSettings] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    if (payment) api.get('/settings').then((d) => setSettings(d.settings)).catch(() => {});
  }, [payment]);

  const print = () => {
    const html = buildReceiptHtml(payment, settings || {});
    const w = window.open('', '_blank', 'width=420,height=720');
    if (!w) return alert('Please allow pop-ups to print the invoice.');
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  const download = () => {
    if (!payment) return;
    const html = buildReceiptHtml(payment, settings || {});
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice-${buildReceiptNumber(payment?._id)}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast('Invoice downloaded.', 'success');
  };

  const share = async () => {
    if (!payment) return;
    const shareText = [
      `${settings?.businessName || 'Business Receipt'}`,
      `Receipt: ${buildReceiptNumber(payment._id)}`,
      `Customer: ${payment.customerId?.name || ''} (${payment.customerId?.customerId || ''})`,
      `Amount: ${formatMoney(payment.amount)}`,
      `Date: ${fmtDateTime(payment.date)}`,
      `Method: ${PAY_METHOD_LABEL[payment.paymentMethod] || payment.paymentMethod}`,
      `Reference: ${payment.referenceId || '—'}`,
      `Previous Due: ${inr(payment.previousDue)}`,
      `Remaining Due: ${inr(payment.remainingDue)}`,
      settings?.receiptFooter || 'Thank you for your business!'
    ].join('\n');

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Invoice ${buildReceiptNumber(payment._id)}`,
          text: shareText,
          url: window.location.href
        });
        toast('Invoice shared.', 'success');
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return;
      }
    }

    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(shareText);
        toast('Invoice details copied to clipboard.', 'success');
        return;
      } catch (err) {
        console.error('Clipboard copy failed', err);
      }
    }

    download();
  };

  if (!payment) return null;
  return (
    <Modal open={!!payment} onClose={onClose} title="Payment Invoice" size="sm"
      footer={
        <>
          <button className="btn-secondary" onClick={print}><Printer className="w-4 h-4" /> Print</button>
          <button className="btn-secondary" onClick={download}><Download className="w-4 h-4" /> Download</button>
          <button className="btn-primary" onClick={share}><Share2 className="w-4 h-4" /> Share</button>
          <button className="btn-ghost" onClick={onClose}>Close</button>
        </>
      }
    >
      <div className="print-area border border-slate-200 rounded-lg p-5 text-center bg-white">
        <div className="text-center mb-3">
          <p className="text-lg font-extrabold text-slate-900">{settings?.businessName || 'Business Receipt'}</p>
          <p className="text-[11px] text-slate-500">{settings?.businessPhone || ''} {settings?.businessAddress || ''}</p>
        </div>
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Payment Invoice</p>
        <p className="mt-1 text-4xl font-extrabold text-emerald-600">{inr(payment.amount)}</p>
        <div className="text-left mt-4 space-y-1 text-sm">
          <Row k="Receipt No" v={buildReceiptNumber(payment._id)} />
          <Row k="Customer" v={payment.customerId?.name} />
          <Row k="Customer ID" v={payment.customerId?.customerId} />
          <Row k="Date" v={fmtDateTime(payment.date)} />
          <Row k="Method" v={PAY_METHOD_LABEL[payment.paymentMethod] || payment.paymentMethod} />
          <Row k="Reference" v={payment.referenceId || '—'} />
          <div className="border-t border-slate-200 mt-2 pt-2">
            <Row k="Previous Due" v={inr(payment.previousDue)} />
            <Row k="Payment Received" v={inr(payment.amount)} strong />
            <Row k="Remaining Due" v={inr(payment.remainingDue)} />
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-200 pt-3 text-[11px] text-slate-500">
          <div className="border-t border-slate-400 pt-2 text-center">Customer Signature</div>
          <div className="border-t border-slate-400 pt-2 text-center">{settings?.signatureText || 'Authorized Signatory'}</div>
        </div>
        <p className="text-xs text-slate-400 mt-4">{settings?.receiptFooter || 'Thank you for your business!'}</p>
      </div>
    </Modal>
  );
}

function Row({ k, v, strong }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-slate-500">{k}</span>
      <span className={strong ? 'font-extrabold text-slate-800' : 'font-semibold text-slate-700'}>{v}</span>
    </div>
  );
}