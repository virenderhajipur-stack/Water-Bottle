import { useEffect, useRef, useState } from 'react';
import { Search, Loader2, User, Phone, Droplets } from 'lucide-react';
import api from '../api/client.js';
import { inr } from '../utils/format.js';

/**
 * Debounced customer search input used across quick-transaction forms.
 */
export default function CustomerPicker({ selected, onSelect, onClear, placeholder = 'Search customer by name, phone or ID...', required = true }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.get(`/customers/search?q=${encodeURIComponent(query.trim())}`);
        setResults(data.customers || []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const handler = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={boxRef} className="relative">
      {selected ? (
        <div className="card !shadow-sm border-brand-300 border-2 flex items-center justify-between p-3">
          <div>
            <p className="font-bold text-slate-800">{selected.name}</p>
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <Phone className="w-3 h-3" /> {selected.phone || '—'} · {selected.customerId}
            </p>
            <div className="flex gap-3 mt-1.5 text-xs">
              <span className="chip bg-sky-100 text-sky-700">
                <Droplets className="w-3 h-3 mr-1" /> {selected.bottlesWithCustomer ?? 0} bottles
              </span>
              <span className={`chip ${selected.due > 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                Due: {inr(selected.due)}
              </span>
            </div>
          </div>
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className="text-xs text-red-500 font-semibold hover:underline"
            >
              Change
            </button>
          )}
        </div>
      ) : (
        <>
          <label className="label">{required ? 'Customer *' : 'Customer'}</label>
          <div className={`relative ${open ? 'rounded-t-lg' : 'rounded-lg'}`}>
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
            <input
              className="input !pl-9"
              placeholder={placeholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => results.length && setOpen(true)}
            />
            {loading && <Loader2 className="w-4 h-4 animate-spin text-brand-500 absolute right-3 top-3.5" />}
          </div>
          {open && results.length > 0 && (
            <div className="absolute z-30 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl overflow-y-auto max-h-72">
              {results.map((c) => (
                <button
                  key={c._id}
                  type="button"
                  className="w-full text-left px-4 py-3 hover:bg-brand-50 border-b border-slate-100 last:border-0 flex items-center justify-between gap-2"
                  onClick={() => {
                    onSelect(c);
                    setQuery('');
                    setOpen(false);
                  }}
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-slate-800 truncate">{c.name}</p>
                    <p className="text-xs text-slate-500 truncate">
                      <User className="w-3 h-3 inline mr-1" />
                      {c.customerId} · {c.phone || '—'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-sky-600">{c.bottlesWithCustomer ?? 0} bottles</p>
                    <p className={`text-xs font-semibold ${c.due > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                      {c.due > 0 ? `Due ${inr(c.due)}` : 'No due'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {open && query.trim() && !loading && results.length === 0 && (
            <div className="absolute z-30 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl p-4 text-sm text-slate-500">
              No matching customers. Add a new customer from the Customers page.
            </div>
          )}
        </>
      )}
    </div>
  );
}