import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Droplets, Warehouse, PackagePlus, RefreshCcw, HandCoins,
  Wallet, AlertTriangle, CheckCircle2, TrendingUp
} from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend
} from 'recharts';
import api from '../api/client.js';
import StatCard from '../components/StatCard.jsx';
import { PageLoader } from '../components/EmptyState.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import Badge from '../components/Badge.jsx';
import { inr } from '../utils/format.js';

const RANGES = [
  { key: 'today', label: 'Today', days: 1 },
  { key: 'week', label: 'This Week', days: 7 },
  { key: 'month', label: 'This Month', days: 30 }
];

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [series, setSeries] = useState(null);
  const [range, setRange] = useState('week');
  const [loading, setLoading] = useState(true);
  const { isAdmin } = useAuth();

  const load = useCallback(async (key) => {
    const days = RANGES.find((r) => r.key === key)?.days || 7;
    try {
      const [s, c] = await Promise.all([api.get('/dashboard/summary'), api.get(`/dashboard/charts?days=${days}`)]);
      setStats(s.stats);
      setSeries(c.series);
    } catch {
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  if (loading) return <PageLoader />;
  if (!stats) return <p className="text-center text-ink-500 py-16">Could not load dashboard.</p>;

  const money = stats.money;
  const bottles = stats.bottles;
  const totalDue = money.totalOutstanding;

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold text-ink-900">Dashboard</h1>

      {/* Alerts */}
      <div className="space-y-2">
        {!bottles.balanced && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <p className="text-sm font-semibold text-red-700">Bottle stock mismatch detected. Check Bottle Reconciliation.</p>
            <Link to="/reconciliation" className="ml-auto text-xs font-bold text-red-700 underline">Fix →</Link>
          </div>
        )}
        {totalDue > 0 && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <Wallet className="w-5 h-5 text-amber-600" />
            <p className="text-sm font-semibold text-amber-700">
              {stats.customers.withDue} customer(s) have outstanding udhaar of {inr(totalDue)}.
            </p>
            <Link to="/reports" className="ml-auto text-xs font-bold text-amber-700 underline">Due Report →</Link>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 no-print">
        {[
          { to: '/customers', label: 'New Customer', icon: Users },
          { to: '/new-bottle', label: 'New Bottle', icon: PackagePlus },
          { to: '/refill', label: 'Refill', icon: RefreshCcw },
          { to: '/payments', label: 'Receive Payment', icon: HandCoins },
          { to: '/inventory', label: isAdmin ? 'Bottle Adjustment' : 'Bottle Inventory', icon: Warehouse }
        ].map((b) => (
          <Link key={b.label} to={b.to} className="bg-white border border-brand-200 text-brand-700 rounded-lg px-3 py-2 flex flex-col items-start gap-0.5 hover:bg-brand-50 transition-colors">
            <b.icon className="w-4 h-4" />
            <span className="text-xs font-bold">{b.label}</span>
          </Link>
        ))}
      </div>

      {/* Money stats */}
      <div>
        <h2 className="text-base font-bold text-ink-900 mb-2">Today</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          <StatCard label="Today's New Bottle Sales" value={inr(money.todayNewBottle)} sub={`${money.todayNewBottleQty} bottles`} icon={PackagePlus} accent="purple" />
          <StatCard label="Today's Refill Sales" value={inr(money.todayRefill)} sub={`${money.todayRefillQty} refills`} icon={RefreshCcw} accent="blue" />
          <StatCard label="Today's Collection" value={inr(money.todayCollection)} icon={Wallet} accent="green" />
          <StatCard label="Total Outstanding" value={inr(totalDue)} sub={`${stats.customers.withDue} customers with due`} icon={HandCoins} accent="red" />
        </div>
      </div>

      {/* Bottle + customer stats */}
      <div>
        <h2 className="text-base font-bold text-ink-900 mb-2">Business Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          <StatCard label="Total Customers" value={stats.customers.total} sub={`${stats.customers.cash} cash · ${stats.customers.credit} credit`} icon={Users} />
          <StatCard label="Bottles With Customers" value={bottles.withCustomers || 0} icon={Droplets} accent="blue" />
          <StatCard label="Bottles In Store" value={bottles.store || 0} sub={`${bottles.storeFilled} filled · ${bottles.storeEmpty} empty`} icon={Warehouse} accent="amber" />
          <StatCard label="Damaged / Lost" value={bottles.damagedLost || 0} icon={AlertTriangle} accent="red" />
        </div>
        <div className="mt-3 card px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {bottles.balanced ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-red-600" />
            )}
            <div>
              <p className="font-bold text-ink-900">Stock Status: {bottles.balanced ? 'Balanced' : 'Mismatch Detected'}</p>
              <p className="text-xs text-ink-500">
                Owned {bottles.totalOwned} = Store {bottles.store} + Customers {bottles.withCustomers} + Damaged/Lost {bottles.damagedLost}
              </p>
            </div>
          </div>
          <Badge color={bottles.balanced ? 'green' : 'red'} label={bottles.balanced ? '✅ Balanced' : '⚠ Mismatch'} />
        </div>
      </div>

      {/* Charts */}
      <div className="card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-sm font-bold text-ink-900">Daily Trend</h2>
          <div className="flex items-center gap-1">
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold ${range === r.key ? 'bg-brand-600 text-white' : 'bg-slate-100 text-ink-500 hover:bg-slate-200'}`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={series || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" />
              <Tooltip formatter={(v) => inr(v)} labelStyle={{ fontSize: 12, color: '#0f172a' }} contentStyle={{ fontSize: 12, color: '#334155' }} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#334155' }} />
              <Bar dataKey="sales" name="Sales" fill="#3498ff" radius={[4, 4, 0, 0]} />
              <Line dataKey="payments" name="Payments" stroke="#10b981" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-4">
          <h3 className="font-bold text-ink-900 mb-3 text-sm">New Bottles & Refills</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={series || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" allowDecimals={false} />
                <Tooltip labelStyle={{ fontSize: 12, color: '#0f172a' }} contentStyle={{ fontSize: 12, color: '#334155' }} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#334155' }} />
                <Bar dataKey="newBottles" name="New Bottles" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="refills" name="Refills" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                <Line dataKey="emptyReturns" name="Empty Returns" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-4">
          <h3 className="font-bold text-ink-900 mb-3 text-sm">Daily Details</h3>
          <div className="text-sm flex flex-col gap-2">
            <Row label="Empty Returns Today" value={`${money.todayEmptyReturns} bottles`} />
            <Row label="Credit / Udhaar Created Today" value={inr(money.todayCredit)} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, sub }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 last:border-0 pb-2 last:pb-0 leading-snug">
      <span className="text-ink-700">{label}</span>
      <div className="text-right">
        <p className="font-bold text-ink-900">{value}</p>
        {sub && <p className="text-xs text-ink-400">{sub}</p>}
      </div>
    </div>
  );
}