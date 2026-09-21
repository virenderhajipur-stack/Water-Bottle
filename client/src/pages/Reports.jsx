import { useEffect, useState, useCallback } from 'react';
import { BarChart3, Printer, Download, Search } from 'lucide-react';
import api from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { Spinner, EmptyState } from '../components/EmptyState.jsx';
import Badge from '../components/Badge.jsx';
import { inr, num, fmtDate, todayInput, monthInput, exportCsv } from '../utils/format.js';

const TABS = [
  { key: 'daily', label: 'Daily Sales' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'due', label: 'Customer Due' },
  { key: 'bottles', label: 'Bottle Customers' },
  { key: 'refills', label: 'Refill Report' }
];

export default function Reports() {
  const [tab, setTab] = useState('daily');
  const { toast } = useToast();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2"><BarChart3 className="w-6 h-6 text-brand-600" /> Reports</h1>
        <p className="text-sm text-slate-500">Sales, payments, udhaar and bottle reports — printable & exportable</p>
      </div>
      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3.5 py-2 rounded-lg text-sm font-bold whitespace-nowrap ${tab === t.key ? 'bg-brand-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'daily' && <DailySale />}
      {tab === 'monthly' && <Monthly />}
      {tab === 'due' && <DueReport />}
      {tab === 'bottles' && <BottleReport />}
      {tab === 'refills' && <RefillReport />}
    </div>
  );
}

function ReportShell({ title, datePicker, onPrint, onExport, children, extras }) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 no-print">
        <div className="flex items-center gap-2">{datePicker}</div>
        <div className="flex gap-2">
          {extras}
          <button className="btn-secondary !py-1.5 text-xs" onClick={onExport}><Download className="w-4 h-4" /> Export</button>
          <button className="btn-secondary !py-1.5 text-xs" onClick={onPrint}><Printer className="w-4 h-4" /> Print</button>
        </div>
      </div>
      <div className="print-area">
        <div className="hidden print:block py-3">
          <h2 className="text-lg font-extrabold">{title}</h2>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}

function SumGrid({ items }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map((it) => (
        <div key={it.label} className="card p-4">
          <p className="text-[11px] font-bold text-slate-400 uppercase">{it.label}</p>
          <p className="text-xl font-extrabold text-slate-900">{it.value}</p>
        </div>
      ))}
    </div>
  );
}

function DailySale() {
  const [date, setDate] = useState(todayInput());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    setLoading(true);
    api.get(`/reports/daily?date=${date}`).then((d) => { setData(d.report); setLoading(false); }).catch((e) => { toast(e.message, 'error'); setLoading(false); });
  }, [date, toast]);

  if (!data) return loading ? <Spinner /> : <EmptyState message="No data." />;
  const r = data;
  return (
    <ReportShell
      title="Daily Sales Report"
      datePicker={<input type="date" className="input !w-auto !py-1.5" value={date} max={todayInput()} onChange={(e) => setDate(e.target.value)} />}
      onPrint={() => window.print()}
      onExport={() => exportCsv([{ date: fmtDate(r.date), newBottleQty: r.newBottleQty, newBottleSales: r.newBottleSales, refillQty: r.refillQty, refillSales: r.refillSales, emptyReturns: r.emptyReturns, totalSales: r.totalSales, credit: r.credit, cashReceived: r.cashReceived, paymentsCollected: r.paymentsCollected }], 'daily-report.csv')}
    >
      <SumGrid items={[
        { label: 'Date', value: fmtDate(r.date) },
        { label: 'New Bottle Sales', value: `${inr(r.newBottleSales)} (${r.newBottleQty})` },
        { label: 'Refill Sales', value: `${inr(r.refillSales)} (${r.refillQty})` },
        { label: 'Total Sales', value: inr(r.totalSales) },
        { label: 'Cash Received', value: inr(r.cashReceived) },
        { label: 'Credit / Udhaar', value: inr(r.credit) },
        { label: 'Empty Returns', value: `${r.emptyReturns} bottles` },
        { label: 'Transactions', value: r.transactionCount }
      ]} />
      <div className="card overflow-x-auto mt-3">
        <table className="w-full min-w-[560px]">
          <thead className="bg-slate-50"><tr>
            <th className="th">Metric</th><th className="th text-right">Value</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            <DetailRow k="New bottle sales (qty)" v={`${r.newBottleQty} bottles · ${inr(r.newBottleSales)}`} />
            <DetailRow k="Refill sales (qty)" v={`${r.refillQty} refills · ${inr(r.refillSales)}`} />
            <DetailRow k="Empty bottles returned" v={`${r.emptyReturns} bottles`} />
            <DetailRow k="Total sales" v={inr(r.totalSales)} strong />
            <DetailRow k="Cash received on transactions" v={inr(r.txPayment)} />
            <DetailRow k="Payments collected" v={inr(r.paymentsCollected)} />
            <DetailRow k="Total collection" v={inr(r.cashReceived)} />
            <DetailRow k="Credit / Udhaar added" v={inr(r.credit)} />
          </tbody>
        </table>
      </div>
    </ReportShell>
  );
}

function Monthly() {
  const [month, setMonth] = useState(monthInput());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    setLoading(true);
    api.get(`/reports/monthly?month=${month}`).then((d) => { setData(d.report); setLoading(false); }).catch((e) => { toast(e.message, 'error'); setLoading(false); });
  }, [month, toast]);

  if (!data) return loading ? <Spinner /> : <EmptyState message="No data." />;
  const r = data;
  return (
    <ReportShell
      title="Monthly Report"
      datePicker={<input type="month" className="input !w-auto !py-1.5" value={month} onChange={(e) => setMonth(e.target.value)} />}
      onPrint={() => window.print()}
      onExport={() => exportCsv([{ month: r.month, newBottles: r.newBottleQty, newBottleSales: r.newBottleSales, refills: r.refillQty, refillSales: r.refillSales, emptyReturns: r.emptyReturns, totalSales: r.totalSales, payments: r.payments }], 'monthly-report.csv')}
    >
      <SumGrid items={[
        { label: 'New Bottles', value: `${r.newBottleQty} · ${inr(r.newBottleSales)}` },
        { label: 'Refills', value: `${r.refillQty} · ${inr(r.refillSales)}` },
        { label: 'Empty Returned', value: `${r.emptyReturns} bottles` },
        { label: 'Total Sales', value: inr(r.totalSales) },
        { label: 'Payments Collected', value: inr(r.payments) }
      ]} />
    </ReportShell>
  );
}

function DueReport() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    setLoading(true);
    api.get('/reports/due').then((d) => { setData(d); setLoading(false); }).catch((e) => { toast(e.message, 'error'); setLoading(false); });
  }, [toast]);

  if (!data) return loading ? <Spinner /> : <EmptyState message="No data." />;
  const rows = data.customers.filter((r) => {
    if (!text.trim()) return true;
    const rx = text.toLowerCase();
    return [r.customer.name, r.customer.phone, r.customer.customerId].some((f) => String(f || '').toLowerCase().includes(rx));
  });
  return (
    <ReportShell
      title="Customer Due Report"
      datePicker={<input className="input !w-48 !py-1.5" placeholder="Filter by name/phone/ID..." value={text} onChange={(e) => setText(e.target.value)} />}
      onPrint={() => window.print()}
      onExport={() => exportCsv(rows.map((r) => ({ customer: r.customer.name, phone: r.customer.phone, id: r.customer.customerId, type: r.customer.customerType, bottles: r.bottlesWithCustomer, charges: r.totalCharges, paid: r.totalPaid, due: r.due })), 'due-report.csv')}
      extras={<span className="chip bg-red-100 text-red-700 !text-sm !px-3 !py-1.5">Total Due: {inr(data.totalDue)}</span>}
    >
      <div className="card overflow-x-auto mt-3">
        {rows.length === 0 ? <EmptyState message="No outstanding payments." sub="All customers have cleared their dues." /> : (
          <table className="w-full min-w-[780px]">
            <thead className="bg-slate-50"><tr>
              <th className="th">Customer</th><th className="th">Phone</th><th className="th">Type</th>
              <th className="th text-center">Bottles</th><th className="th text-right">Charges</th>
              <th className="th text-right">Paid</th><th className="th text-right">Due</th><th className="th">Last Payment</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.customer._id} className="hover:bg-slate-50">
                  <td className="td font-bold text-slate-800">{r.customer.name}</td>
                  <td className="td text-slate-500">{r.customer.phone || '—'}</td>
                  <td className="td"><Badge color={r.customer.customerType === 'credit' ? 'amber' : 'green'} label={r.customer.customerType === 'credit' ? 'Credit' : 'Cash'} /></td>
                  <td className="td text-center">{r.bottlesWithCustomer}</td>
                  <td className="td text-right">{inr(r.totalCharges)}</td>
                  <td className="td text-right text-emerald-700">{inr(r.totalPaid)}</td>
                  <td className="td text-right font-extrabold text-red-600">{inr(r.due)}</td>
                  <td className="td text-slate-500">{fmtDate(r.lastPayment)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </ReportShell>
  );
}

function BottleReport() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    setLoading(true);
    api.get('/reports/bottles').then((d) => { setData(d); setLoading(false); }).catch((e) => { toast(e.message, 'error'); setLoading(false); });
  }, [toast]);

  if (!data) return loading ? <Spinner /> : <EmptyState message="No data." />;
  const rows = data.customers;
  return (
    <ReportShell
      title="Bottle Customer Report"
      datePicker={<span className="chip bg-sky-100 text-sky-700 !text-sm !px-3 !py-1.5">Total with customers: {num(data.totalBottles)}</span>}
      onPrint={() => window.print()}
      onExport={() => exportCsv(rows.map((r) => ({ customer: r.customer.name, phone: r.customer.phone, bottles: r.bottles, refills: r.refills, lastRefill: fmtDate(r.lastRefill), lastTransaction: fmtDate(r.lastTransaction) })), 'bottle-customers.csv')}
    >
      <div className="card overflow-x-auto mt-3">
        {rows.length === 0 ? <EmptyState message="No customers have bottles right now." /> : (
          <table className="w-full min-w-[680px]">
            <thead className="bg-slate-50"><tr>
              <th className="th">Customer</th><th className="th">Phone</th>
              <th className="th text-center">Bottles</th><th className="th text-center">Refills</th>
              <th className="th">Last Refill</th><th className="th">Last Transaction</th><th className="th">Flag</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => {
                const flagged = data.highlightedIds?.includes(r.customer._id);
                return (
                  <tr key={r.customer._id} className={flagged ? 'bg-amber-50/60' : 'hover:bg-slate-50'}>
                    <td className="td font-bold text-slate-800">{r.customer.name}</td>
                    <td className="td text-slate-500">{r.customer.phone || '—'}</td>
                    <td className="td text-center font-extrabold text-sky-700">{r.bottles}</td>
                    <td className="td text-center">{r.refills}</td>
                    <td className="td text-slate-500">{fmtDate(r.lastRefill)}</td>
                    <td className="td text-slate-500">{fmtDate(r.lastTransaction)}</td>
                    <td className="td">{flagged && <Badge color="amber" label="High balance" />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </ReportShell>
  );
}

function RefillReport() {
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); });
  const [to, setTo] = useState(todayInput());
  const [status, setStatus] = useState('');
  const [customerText, setCustomerText] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    setLoading(true);
    let qs = new URLSearchParams({ from, to });
    if (status) qs.set('status', status);
    api.get(`/reports/refills?${qs}`).then((d) => { setData(d); setLoading(false); }).catch((e) => { toast(e.message, 'error'); setLoading(false); });
  }, [from, to, status, toast]);

  if (!data) return loading ? <Spinner /> : <EmptyState message="No data." />;
  const rows = data.refills.filter((r) => {
    if (!customerText.trim()) return true;
    const rx = customerText.toLowerCase();
    return String(r.customerId?.name || '').toLowerCase().includes(rx) || String(r.customerId?.customerId || '').toLowerCase().includes(rx);
  });
  const sums = data.totals;
  return (
    <ReportShell
      title="Refill Report"
      datePicker={
        <div className="flex flex-wrap gap-2">
          <input type="date" className="input !w-auto !py-1.5" value={from} onChange={(e) => setFrom(e.target.value)} />
          <span className="text-xs text-slate-400 self-center">to</span>
          <input type="date" className="input !w-auto !py-1.5" value={to} max={todayInput()} onChange={(e) => setTo(e.target.value)} />
          <select className="input !w-auto !py-1.5" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
          </select>
          <div className="relative">
            <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
            <input className="input !w-40 !py-1.5 !pl-8" placeholder="Customer..." value={customerText} onChange={(e) => setCustomerText(e.target.value)} />
          </div>
        </div>
      }
      onPrint={() => window.print()}
      onExport={() => exportCsv(rows.map((r) => ({ date: fmtDate(r.date), customer: r.customerId?.name || '', qty: r.quantity, emptyReturned: r.emptyBottlesReturned, amount: r.totalAmount, paid: r.paidAmt, due: r.dueAmt, status: r.isPaid ? 'Paid' : 'Unpaid' })), 'refill-report.csv')}
    >
      <SumGrid items={[
        { label: 'Refills', value: num(sums.qty) },
        { label: 'Amount', value: inr(sums.amount) },
        { label: 'Paid', value: inr(sums.paid) },
        { label: 'Due', value: inr(sums.due) }
      ]} />
      <div className="card overflow-x-auto mt-3">
        {rows.length === 0 ? <EmptyState message="No refill transactions in this range." /> : (
          <table className="w-full min-w-[760px]">
            <thead className="bg-slate-50"><tr>
              <th className="th">Date</th><th className="th">Customer</th><th className="th text-center">Qty</th>
              <th className="th text-center">Empty Returned</th><th className="th text-right">Amount</th>
              <th className="th text-right">Paid</th><th className="th text-right">Due</th><th className="th">Status</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r._id} className="hover:bg-slate-50">
                  <td className="td text-slate-500">{fmtDate(r.date)}</td>
                  <td className="td font-bold text-slate-800">{r.customerId?.name || '—'} <span className="text-slate-400 font-normal">{r.customerId?.customerId}</span></td>
                  <td className="td text-center">{r.quantity}</td>
                  <td className="td text-center">{r.emptyBottlesReturned}</td>
                  <td className="td text-right">{inr(r.totalAmount)}</td>
                  <td className="td text-right text-emerald-700">{inr(r.paidAmt)}</td>
                  <td className="td text-right font-bold text-red-600">{inr(r.dueAmt)}</td>
                  <td className="td"><Badge color={r.isPaid ? 'green' : 'red'} label={r.isPaid ? 'Paid' : 'Due'} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </ReportShell>
  );
}

function DetailRow({ k, v, strong }) {
  return (
    <tr className="hover:bg-slate-50">
      <td className="td text-slate-600">{k}</td>
      <td className={`td text-right ${strong ? 'font-extrabold text-slate-900' : 'font-semibold'}`}>{v}</td>
    </tr>
  );
}