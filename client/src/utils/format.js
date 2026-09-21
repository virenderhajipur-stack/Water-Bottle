export const inr = (n) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;

export const num = (n) => Math.round(n || 0).toLocaleString('en-IN');

export function fmtDate(d) {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dt)) return '—';
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtDateTime(d) {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dt)) return '—';
  return dt.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function todayInput() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

export function monthInput() {
  return todayInput().slice(0, 7);
}

export function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

export function toDateInput(d) {
  const dt = typeof d === 'string' ? new Date(d) : d;
  const off = dt.getTimezoneOffset();
  return new Date(dt.getTime() - off * 60000).toISOString().slice(0, 10);
}

export function parseCsvRows(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const rows = [];
  for (const line of lines) {
    const m = line.match(/("([^"]*)"|[^,]*)(?:,|$)/g) || [];
    rows.push(m.map((s) => s.replace(/^"(.*)"$/, '$1').trim()));
  }
  return rows;
}

export function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime || 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportCsv(rows, filename) {
  if (!rows.length) {
    downloadBlob('', filename);
    return;
  }
  const headers = Object.keys(rows[0]);
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [headers.map(esc).join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))];
  downloadBlob('\uFEFF' + lines.join('\r\n'), filename);
}

export const TYPE_LABELS = {
  new_bottle: 'New Bottle',
  refill: 'Refill',
  empty_return: 'Empty Return',
  damaged_lost: 'Damaged/Lost',
  adjustment: 'Adjustment',
  payment_adj: 'Money Adjustment',
  opening: 'Opening Balance',
  payment: 'Payment'
};

export const PAY_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank', label: 'Bank Transfer' },
  { value: 'other', label: 'Other' }
];

export const PAY_METHOD_LABEL = {
  cash: 'Cash',
  upi: 'UPI',
  bank: 'Bank',
  other: 'Other'
};