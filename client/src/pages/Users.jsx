import { useEffect, useState, useCallback } from 'react';
import { Users as UsersIcon, UserPlus, ShieldCheck, Download, Power, Lock } from 'lucide-react';
import api from '../api/client.js';
import Modal from '../components/Modal.jsx';
import Badge from '../components/Badge.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { EmptyState, Spinner } from '../components/EmptyState.jsx';
import { fmtDateTime, exportCsv } from '../utils/format.js';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState(null);
  const { toast } = useToast();
  const { user: me } = useAuth();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/users');
      setUsers(data.users);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (u) => {
    try {
      await api.patch(`/users/${u.id || u._id}`, { active: !u.active });
      toast(u.active ? 'User disabled.' : 'User enabled.', 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const remove = async (u) => {
    if (!window.confirm(`Delete user "${u.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/users/${u.id || u._id}`);
      toast('User deleted.', 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const doExport = () => {
    exportCsv(users.map((u) => ({ name: u.name, username: u.username, role: u.role, active: u.active, lastLogin: fmtDateTime(u.lastLogin), created: fmtDateTime(u.createdAt) })), 'users.csv');
    toast('Users exported.', 'success');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2"><UsersIcon className="w-6 h-6 text-brand-600" /> Users & Staff</h1>
          <p className="text-sm text-slate-500">{users.length} users · administrators and staff accounts</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={doExport}><Download className="w-4 h-4" /> Export</button>
          <button className="btn-primary" onClick={() => { setEditing(null); setShowNew(true); }}><UserPlus className="w-4 h-4" /> Add User</button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        {loading ? <Spinner /> : users.length === 0 ? <EmptyState message="No users yet." /> : (
          <>
            <table className="w-full min-w-[680px] hidden md:table">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">User</th>
                  <th className="th">Role</th>
                  <th className="th">Last Login</th>
                  <th className="th">Status</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => {
                  const id = u.id || u._id;
                  const isMe = me && me.id === id;
                  return (
                    <tr key={id} className="hover:bg-slate-50">
                      <td className="td">
                        <p className="font-bold text-slate-800">{u.name} {isMe && <span className="text-slate-400 font-normal text-xs">(you)</span>}</p>
                        <p className="text-xs text-slate-400">@{u.username}</p>
                      </td>
                      <td className="td">
                        <Badge color={u.role === 'admin' ? 'purple' : 'blue'} label={u.role === 'admin' ? 'Admin' : 'Staff'} />
                      </td>
                      <td className="td text-slate-500">{fmtDateTime(u.lastLogin)}</td>
                      <td className="td">
                        <Badge color={u.active ? 'green' : 'red'} label={u.active ? 'Active' : 'Disabled'} dot />
                      </td>
                      <td className="td">
                        <div className="flex justify-end gap-2">
                          <button className="chip bg-slate-100 text-slate-600 hover:bg-slate-200" onClick={() => { setEditing(u); setShowNew(true); }}>Edit</button>
                          {!isMe && u.role !== 'admin' && (
                            <button className="chip bg-amber-50 text-amber-700 hover:bg-amber-100" onClick={() => toggleActive(u)}>
                              <Power className="w-3 h-3 mr-1 inline" /> {u.active ? 'Disable' : 'Enable'}
                            </button>
                          )}
                          {!isMe && (
                            <button className="chip bg-red-50 text-red-600 hover:bg-red-100" onClick={() => remove(u)}>Delete</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <ul className="md:hidden divide-y divide-slate-100">
              {users.map((u) => {
                const id = u.id || u._id;
                const isMe = me && me.id === id;
                return (
                  <li key={id} className="px-4 py-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800">{u.name} {isMe && <span className="text-slate-400 font-normal text-xs">(you)</span>}</p>
                        <p className="text-xs text-slate-400">@{u.username} · {fmtDateTime(u.lastLogin)}</p>
                      </div>
                      <Badge color={u.active ? 'green' : 'red'} label={u.active ? 'Active' : 'Disabled'} dot />
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge color={u.role === 'admin' ? 'purple' : 'blue'} label={u.role === 'admin' ? 'Admin' : 'Staff'} />
                    </div>
                    <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                      <button className="btn-secondary flex-1 !py-1.5 text-sm" onClick={() => { setEditing(u); setShowNew(true); }}>Edit</button>
                      {!isMe && u.role !== 'admin' && (
                        <button className="btn-ghost flex-1 !py-1.5 text-sm text-amber-700" onClick={() => toggleActive(u)}>
                          <Power className="w-3 h-3 mr-1 inline" /> {u.active ? 'Disable' : 'Enable'}
                        </button>
                      )}
                      {!isMe && (
                        <button className="btn-ghost flex-1 !py-1.5 text-sm text-red-600" onClick={() => remove(u)}>Delete</button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      <UserModal open={showNew} editing={editing ? { ...editing, id: editing.id || editing._id } : null} onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load(); }} />
    </div>
  );
}

function UserModal({ open, editing, onClose, onSaved }) {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('staff');
  const [active, setActive] = useState(true);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setName(editing?.name || '');
      setUsername(editing?.username || '');
      setRole(editing?.role || 'staff');
      setActive(editing?.active ?? true);
      setPassword('');
    }
  }, [open, editing]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editing) {
        const payload = { name, role, active };
        if (password.trim()) payload.password = password;
        await api.patch(`/users/${editing.id}`, payload);
        toast('User updated.', 'success');
      } else {
        if (!name.trim() || !username.trim() || !password.trim()) {
          return toast('Name, username and password are required.', 'error');
        }
        if (password.length < 4) return toast('Password must be at least 4 characters.', 'error');
        await api.post('/users', { name, username, password, role });
        toast('User created.', 'success');
      }
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? `Edit ${editing.name}` : 'Add User'} size="sm"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={submit} disabled={loading}>{loading ? 'Saving...' : editing ? 'Save Changes' : 'Create User'}</button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="label">Full name *</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="block">
          <span className="label">Username *</span>
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} required autoCapitalize="off" />
        </label>
        {editing ? (
          <label className="block">
            <span className="label">New password <span className="text-slate-400 font-normal">(leave blank to keep)</span></span>
            <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" />
          </label>
        ) : (
          <label className="block">
            <span className="label">Password *</span>
            <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Min. 4 characters" />
          </label>
        )}
        <div>
          <span className="label">Role</span>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setRole('staff')} className={`rounded-xl border-2 p-3 text-sm font-bold ${role === 'staff' ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-200 text-slate-500'}`}>
              <Lock className="w-4 h-4 inline mr-1" /> Staff
              <span className="block text-[11px] font-normal text-slate-400">Sales, refills, payments</span>
            </button>
            <button type="button" onClick={() => setRole('admin')} className={`rounded-xl border-2 p-3 text-sm font-bold ${role === 'admin' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-slate-200 text-slate-500'}`}>
              <ShieldCheck className="w-4 h-4 inline mr-1" /> Admin
              <span className="block text-[11px] font-normal text-slate-400">Full access + settings</span>
            </button>
          </div>
        </div>
        {editing && (
          <label className="flex items-center gap-2 pt-1">
            <input type="checkbox" className="w-4 h-4 accent-brand-600" checked={active} onChange={(e) => setActive(e.target.checked)} />
            <span className="text-sm font-medium text-slate-700">Account active</span>
          </label>
        )}
      </form>
    </Modal>
  );
}