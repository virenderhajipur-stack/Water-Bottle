import { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Search, UserPlus, Droplets, Phone, MapPin, MoreVertical, Pencil, Eye, RefreshCcw, PackagePlus, HandCoins } from 'lucide-react';
import api from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import Badge from '../components/Badge.jsx';
import Modal from '../components/Modal.jsx';
import Pagination from '../components/Pagination.jsx';
import { EmptyState, Spinner } from '../components/EmptyState.jsx';
import { inr, fmtDate } from '../utils/format.js';

export default function Customers() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [type, setType] = useState('');
  const [sort, setSort] = useState('newest');
  const [withDue, setWithDue] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(null);
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page, limit: 20, sort, search: debounced });
      if (type) qs.set('type', type);
      if (withDue) qs.set('withDue', withDue);
      const data = await api.get(`/customers?${qs}`);
      setRows(data.customers);
      setTotal(data.total);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, sort, debounced, type, withDue]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleArchive = async (c) => {
    try {
      await api.patch(`/customers/${c._id}/archive`);
      toast(c.status === 'inactive' ? 'Customer restored.' : 'Customer archived.', 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Customers</h1>
          <p className="text-sm text-slate-500">{total} customers</p>
        </div>
        <button className="btn-primary" onClick={() => setShowAdd(true)}>
          <UserPlus className="w-4 h-4" /> Add Customer
        </button>
      </div>

      {/* Filters */}
      <div className="card p-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative lg:col-span-2">
          <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          <input className="input !pl-9" placeholder="Search name, phone, ID, area..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="input" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
          <option value="">All Types</option>
          <option value="cash">Cash</option>
          <option value="credit">Credit / Udhaar</option>
        </select>
        <select className="input" value={withDue} onChange={(e) => { setWithDue(e.target.value); setPage(1); }}>
          <option value="">All Balances</option>
          <option value="true">With Due</option>
          <option value="false">No Due</option>
        </select>
        <select className="input" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="name">Name A–Z</option>
          <option value="dueHigh">Highest Due</option>
          <option value="bottlesHigh">Most Bottles</option>
        </select>
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <EmptyState message="No customers found." sub="Try a different search or add a new customer." />
        ) : (
          <>
            <table className="w-full min-w-[860px] hidden md:table">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">Customer</th>
                  <th className="th">ID</th>
                  <th className="th">Type</th>
                  <th className="th text-center">Bottles</th>
                  <th className="th text-right">Total Due</th>
                  <th className="th">Last Transaction</th>
                  <th className="th">Status</th>
                  <th className="th">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((c) => (
                  <tr key={c._id} className="hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/customers/${c._id}`)}>
                    <td className="td">
                      <p className="font-bold text-slate-800">{c.name}</p>
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {c.phone || '—'}
                      </p>
                      {c.area && (
                        <p className="text-xs text-slate-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {c.area}
                        </p>
                      )}
                    </td>
                    <td className="td text-slate-500">{c.customerId}</td>
                    <td className="td">
                      <Badge color={c.customerType === 'credit' ? 'amber' : 'green'} label={c.customerType === 'credit' ? 'Credit' : 'Cash'} />
                    </td>
                    <td className="td text-center">
                      <span className={`chip ${c.bottlesWithCustomer > 0 ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-500'}`}>
                        <Droplets className="w-3 h-3 mr-1" /> {c.bottlesWithCustomer}
                      </span>
                    </td>
                    <td className="td text-right">
                      <p className={`font-bold ${c.due > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{inr(c.due)}</p>
                      {c.due === 0 && <p className="text-[10px] text-slate-400">Clear</p>}
                    </td>
                    <td className="td text-slate-500">{fmtDate(c.lastTransaction)}</td>
                    <td className="td">
                      <Badge color={c.status === 'active' ? 'green' : 'slate'} label={c.status === 'active' ? 'Active' : 'Archived'} dot />
                    </td>
                    <td className="td" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <Link to={`/customers/${c._id}`} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500" title="View">
                          <Eye className="w-4 h-4" />
                        </Link>
                        <Link to={`/new-bottle?customer=${c._id}`} className="p-1.5 rounded-lg hover:bg-purple-50 text-purple-600" title="New Bottle">
                          <PackagePlus className="w-4 h-4" />
                        </Link>
                        <Link to={`/refill?customer=${c._id}`} className="p-1.5 rounded-lg hover:bg-sky-50 text-sky-600" title="Refill">
                          <RefreshCcw className="w-4 h-4" />
                        </Link>
                        <Link to={`/payments?customer=${c._id}`} className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600" title="Receive Payment">
                          <HandCoins className="w-4 h-4" />
                        </Link>
                        <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500" title="Edit" onClick={() => setShowEdit(c)}>
                          <Pencil className="w-4 h-4" />
                        </button>
                        {isAdmin && (
                          <button className="p-1.5 rounded-lg hover:bg-red-50 text-red-500" title="Archive/Delete" onClick={() => toggleArchive(c)}>
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className="md:hidden divide-y divide-slate-100">
              {rows.map((c) => (
                <li key={c._id} className="px-4 py-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <button className="font-bold text-slate-800" onClick={() => navigate(`/customers/${c._id}`)}>{c.name}</button>
                      <p className="text-xs text-slate-500">{c.customerId} {c.phone ? `· ${c.phone}` : ''}</p>
                      {c.area && <p className="text-xs text-slate-400">{c.area}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`font-extrabold ${c.due > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{inr(c.due)}</p>
                      <p className="text-[10px] text-slate-400">{c.due > 0 ? 'Due' : 'Clear'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge color={c.customerType === 'credit' ? 'amber' : 'green'} label={c.customerType === 'credit' ? 'Credit' : 'Cash'} />
                    <Badge color={c.status === 'active' ? 'green' : 'slate'} label={c.status === 'active' ? 'Active' : 'Archived'} />
                    <span className={`chip ${c.bottlesWithCustomer > 0 ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-500'}`}>
                      <Droplets className="w-3 h-3 mr-1" /> {c.bottlesWithCustomer} bottles
                    </span>
                  </div>
                  <div className="flex items-center gap-1 pt-1 border-t border-slate-100 -mx-1">
                    <Link to={`/customers/${c._id}`} className="flex-1 text-center p-2 rounded-lg hover:bg-slate-100 text-slate-500" title="View">
                      <Eye className="w-5 h-5 mx-auto" />
                    </Link>
                    <Link to={`/new-bottle?customer=${c._id}`} className="flex-1 text-center p-2 rounded-lg hover:bg-purple-50 text-purple-600" title="New Bottle">
                      <PackagePlus className="w-5 h-5 mx-auto" />
                    </Link>
                    <Link to={`/refill?customer=${c._id}`} className="flex-1 text-center p-2 rounded-lg hover:bg-sky-50 text-sky-600" title="Refill">
                      <RefreshCcw className="w-5 h-5 mx-auto" />
                    </Link>
                    <Link to={`/payments?customer=${c._id}`} className="flex-1 text-center p-2 rounded-lg hover:bg-emerald-50 text-emerald-600" title="Receive Payment">
                      <HandCoins className="w-5 h-5 mx-auto" />
                    </Link>
                    <button className="flex-1 text-center p-2 rounded-lg hover:bg-slate-100 text-slate-500" title="Edit" onClick={() => setShowEdit(c)}>
                      <Pencil className="w-5 h-5 mx-auto" />
                    </button>
                    {isAdmin && (
                      <button className="flex-1 text-center p-2 rounded-lg hover:bg-red-50 text-red-500" title="Archive/Delete" onClick={() => toggleArchive(c)}>
                        <MoreVertical className="w-5 h-5 mx-auto" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
        <Pagination page={page} total={total} perPage={20} onPage={setPage} />
      </div>

      <CustomerForm open={showAdd || !!showEdit} customer={showEdit} onClose={() => { setShowAdd(false); setShowEdit(null); }} onSaved={() => { setShowAdd(false); setShowEdit(null); load(); }} />
    </div>
  );
}

function CustomerForm({ open, customer, onClose, onSaved }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const isEdit = !!customer;

  useEffect(() => {
    if (open) {
      setForm(
        customer
          ? { name: customer.name, phone: customer.phone, address: customer.address, area: customer.area, customerType: customer.customerType, notes: customer.notes }
          : { name: '', phone: '', address: '', area: '', customerType: 'cash', openingBalance: 0, openingBottleBalance: 0, notes: '' }
      );
    }
  }, [open, customer]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) {
        await api.patch(`/customers/${customer._id}`, form);
        toast('Customer updated.', 'success');
      } else {
        await api.post('/customers', form);
        toast('Customer added.', 'success');
      }
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Customer' : 'Add Customer'} size="lg"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={onSubmit} disabled={saving}>{saving ? 'Saving...' : 'Save Customer'}</button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="label">Customer Name *</label>
          <input className="input" required value={form.name || ''} onChange={set('name')} placeholder="e.g. Raj Kumar" />
        </div>
        <div>
          <label className="label">Mobile Number</label>
          <input className="input" value={form.phone || ''} onChange={set('phone')} placeholder="98XXXXXXXX" />
        </div>
        <div>
          <label className="label">Area / Locality</label>
          <input className="input" value={form.area || ''} onChange={set('area')} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Address</label>
          <input className="input" value={form.address || ''} onChange={set('address')} />
        </div>
        <div>
          <label className="label">Customer Type</label>
          <select className="input" value={form.customerType || 'cash'} onChange={set('customerType')}>
            <option value="cash">Cash</option>
            <option value="credit">Credit / Udhaar</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Notes</label>
          <input className="input" value={form.notes || ''} onChange={set('notes')} />
        </div>
        {!isEdit && (
          <>
            <div>
              <label className="label">Opening Money Balance (₹)</label>
              <input type="number" min="0" className="input" value={form.openingBalance || 0} onChange={(e) => setForm((f) => ({ ...f, openingBalance: e.target.value }))} />
              <p className="text-[11px] text-slate-400">Existing money due the customer owes</p>
            </div>
            <div>
              <label className="label">Opening Bottle Balance</label>
              <input type="number" min="0" step="1" className="input" value={form.openingBottleBalance || 0} onChange={(e) => setForm((f) => ({ ...f, openingBottleBalance: e.target.value }))} />
              <p className="text-[11px] text-slate-400">Bottles already with this customer</p>
            </div>
          </>
        )}
      </form>
    </Modal>
  );
}