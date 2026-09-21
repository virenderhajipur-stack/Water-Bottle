import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import api from '../api/client.js';

export default function GlobalSearch() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const boxRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.get(`/customers/search?q=${encodeURIComponent(q.trim())}`);
        setResults(data.customers || []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const onKey = (e) => {
    if (e.key === 'Enter') {
      const first = results[0];
      if (first) goTo(first._id);
    }
    if (e.key === 'Escape') setOpen(false);
  };

  const goTo = (id) => {
    setOpen(false);
    setQ('');
    navigate(`/customers/${id}`);
  };

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-ink-400" />
        <input
          className="input !py-2 !pl-9 !bg-slate-50"
          placeholder="Search customers, phones, IDs..."
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            if (!e.target.value.trim()) setOpen(false);
          }}
          onKeyDown={onKey}
          onFocus={() => results.length && setOpen(true)}
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-y-auto max-h-72">
          {results.map((c) => (
            <button
              key={c._id}
              onClick={() => goTo(c._id)}
              className="w-full text-left px-4 py-2.5 hover:bg-brand-50 border-b border-slate-100 last:border-0"
            >
              <p className="font-semibold text-sm text-ink-900">
                {c.name} <span className="text-ink-400 font-normal">· {c.customerId}</span>
              </p>
              <p className="text-xs text-ink-500">
                {c.phone} · {c.bottlesWithCustomer} bottles · {c.due > 0 ? `Due ₹${c.due.toLocaleString('en-IN')}` : 'No due'}
              </p>
            </button>
          ))}
        </div>
      )}
      {open && q.trim() && !loading && results.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl p-4 text-sm text-ink-500">
          No matching customers.
        </div>
      )}
      {loading && <p className="absolute -bottom-6 left-2 text-xs text-ink-400">Searching...</p>}
    </div>
  );
}