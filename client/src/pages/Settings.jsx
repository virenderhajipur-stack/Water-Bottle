import { useEffect, useState } from 'react';
import { Settings2, Save, Building2, IndianRupee, ReceiptText, Bell, KeyRound, CloudDownload } from 'lucide-react';
import api from '../api/client.js';
import { PageLoader } from '../components/EmptyState.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import Modal from '../components/Modal.jsx';

export default function Settings() {
  const [s, setS] = useState(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { isAdmin, user } = useAuth();

  useEffect(() => {
    api.get('/settings').then((d) => setS(d.settings)).catch((e) => toast(e.message, 'error'));
  }, [toast]);

  if (!s) return <PageLoader />;

  const set = (k, v) => setS((prev) => ({ ...prev, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        businessName: s.businessName,
        businessAddress: s.businessAddress,
        businessPhone: s.businessPhone,
        newBottlePrice: s.newBottlePrice,
        refillPrice: s.refillPrice,
        currencySymbol: s.currencySymbol,
        allowAdvancePayment: s.allowAdvancePayment,
        allowRefillOverride: s.allowRefillOverride,
        receiptHeader: s.receiptHeader,
        receiptFooter: s.receiptFooter,
        signatureText: s.signatureText,
        taxLabel: s.taxLabel,
        taxRate: s.taxRate,
        lowStockThreshold: s.lowStockThreshold,
        highDueAlert: s.highDueAlert
      };
      const data = await api.put('/settings', payload);
      setS(data.settings);
      toast('Settings saved.', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const backup = async () => {
    try {
      const data = await api.get('/export/backup');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `water-bottle-backup-${stamp}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast('Backup downloaded.', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2"><Settings2 className="w-6 h-6 text-brand-600" /> Settings</h1>
          <p className="text-sm text-slate-500">Business info, pricing and system behaviour</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={backup}><CloudDownload className="w-4 h-4" /> Backup</button>
          <button className="btn-primary" onClick={save} disabled={saving}><Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save All'}</button>
        </div>
      </div>

      <Section icon={Building2} title="Business Details">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Business name">
            <input className="input" value={s.businessName} onChange={(e) => set('businessName', e.target.value)} />
          </Field>
          <Field label="Phone">
            <input className="input" value={s.businessPhone} onChange={(e) => set('businessPhone', e.target.value)} />
          </Field>
          <Field label="Address" full>
            <input className="input" value={s.businessAddress} onChange={(e) => set('businessAddress', e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section icon={IndianRupee} title="Pricing">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Field label="New bottle price (₹)">
            <input type="number" min="0" className="input" value={s.newBottlePrice} onChange={(e) => set('newBottlePrice', e.target.value)} />
          </Field>
          <Field label="Refill price (₹)">
            <input type="number" min="0" className="input" value={s.refillPrice} onChange={(e) => set('refillPrice', e.target.value)} />
          </Field>
          <Field label="Currency symbol">
            <input className="input w-24" value={s.currencySymbol} onChange={(e) => set('currencySymbol', e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section icon={ReceiptText} title="Receipt">
        <div className="space-y-3">
          <Field label="Receipt header">
            <input className="input" value={s.receiptHeader} onChange={(e) => set('receiptHeader', e.target.value)} />
          </Field>
          <Field label="Receipt footer">
            <input className="input" value={s.receiptFooter} onChange={(e) => set('receiptFooter', e.target.value)} />
          </Field>
          <Field label="Signature text">
            <input className="input" value={s.signatureText || ''} onChange={(e) => set('signatureText', e.target.value)} placeholder="Authorized Signatory" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tax label (leave blank to hide)">
              <input className="input" value={s.taxLabel} onChange={(e) => set('taxLabel', e.target.value)} placeholder="e.g. GST 18%" />
            </Field>
            <Field label={`Tax rate (%) ${s.taxLabel ? `applied as ${s.taxLabel}` : ''}`}>
              <input type="number" min="0" step="0.01" className="input" value={s.taxRate} onChange={(e) => set('taxRate', e.target.value)} />
            </Field>
          </div>
        </div>
      </Section>

      <Section icon={Bell} title="Business Rules">
        <div className="space-y-2">
          <Toggle
            label="Allow advance payments"
            desc="Let staff accept payments larger than the outstanding due"
            checked={s.allowAdvancePayment}
            onChange={(v) => set('allowAdvancePayment', v)}
            disabled={!isAdmin}
          />
          <Toggle
            label="Allow refill override"
            desc="Allow staff to force a refill even when the customer has no empty bottles"
            checked={s.allowRefillOverride}
            onChange={(v) => set('allowRefillOverride', v)}
            disabled={!isAdmin}
          />
          {!isAdmin && <p className="text-xs text-slate-400">Only the admin can change business rules.</p>}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Field label="Low stock warning (bottles)">
              <input type="number" min="0" className="input" value={s.lowStockThreshold} onChange={(e) => set('lowStockThreshold', e.target.value)} />
            </Field>
            <Field label="High due alert (₹)">
              <input type="number" min="0" className="input" value={s.highDueAlert} onChange={(e) => set('highDueAlert', e.target.value)} />
            </Field>
          </div>
        </div>
      </Section>

      <Section icon={KeyRound} title="Account">
        <ChangePassword />
      </Section>
    </div>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <div className="card p-5">
      <h2 className="font-extrabold text-slate-800 mb-4 flex items-center gap-2"><Icon className="w-4 h-4 text-brand-600" /> {title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children, full }) {
  return (
    <label className={`block ${full ? 'md:col-span-2' : ''}`}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

function Toggle({ label, desc, checked, onChange, disabled }) {
  return (
    <label className={`flex items-start justify-between gap-3 p-3 rounded-xl border ${disabled ? 'border-slate-200 opacity-60 cursor-not-allowed' : 'border-slate-200 hover:border-brand-300'}`}>
      <span>
        <span className="block text-sm font-bold text-slate-800">{label}</span>
        <span className="block text-xs text-slate-400">{desc}</span>
      </span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`shrink-0 w-11 h-6 rounded-full transition-colors relative ${checked ? 'bg-emerald-500' : 'bg-slate-200'}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </label>
  );
}

function ChangePassword() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const submit = async (e) => {
    e.preventDefault();
    if (next !== confirm) return toast('New passwords do not match.', 'error');
    setLoading(true);
    try {
      await api.post('/auth/change-password', { currentPassword: current, newPassword: next });
      toast('Password changed.', 'success');
      setOpen(false);
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button className="btn-secondary" onClick={() => setOpen(true)}><KeyRound className="w-4 h-4" /> Change My Password</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Change Password" size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={submit} disabled={loading}>{loading ? 'Saving...' : 'Change Password'}</button>
          </>
        }
      >
        <form onSubmit={submit} className="space-y-3">
          <Field label="Current password">
            <input type="password" className="input" value={current} onChange={(e) => setCurrent(e.target.value)} required />
          </Field>
          <Field label="New password">
            <input type="password" className="input" value={next} onChange={(e) => setNext(e.target.value)} required />
          </Field>
          <Field label="Confirm new password">
            <input type="password" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </Field>
        </form>
      </Modal>
    </>
  );
}