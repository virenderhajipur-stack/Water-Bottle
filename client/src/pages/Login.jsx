import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Droplets, Lock, User as UserIcon, LogIn } from 'lucide-react';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await api.post('/auth/login', { username, password });
      await login(data.token, data.user);
      toast(`Welcome back, ${data.user.name}!`, 'success');
      navigate('/');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-600 via-brand-700 to-dark p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/15 backdrop-blur mb-3">
            <Droplets className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-white">AquaTrack</h1>
          <p className="text-white/70 mt-1">Water Bottle Sales · Refill · Udhaar Management</p>
        </div>
        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8">
          <h2 className="text-xl font-bold text-slate-800 mb-1">Sign in</h2>
          <p className="text-sm text-slate-500 mb-6">Use your staff or admin credentials</p>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="label">Username</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input
                  className="input !pl-9"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin or staff"
                  required
                />
              </div>
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input
                  type="password"
                  className="input !pl-9"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>
            <button type="submit" className="btn-primary w-full !py-3" disabled={loading}>
              {loading ? 'Signing in...' : (<> <LogIn className="w-4 h-4" /> Sign In</>)}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}