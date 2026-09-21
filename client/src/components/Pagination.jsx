import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ page, total, perPage = 20, onPage }) {
  const pages = Math.max(1, Math.ceil((total || 0) / perPage));
  if (pages <= 1) return null;
  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);
  return (
    <div className="flex items-center justify-between px-3 py-3 border-t border-slate-100">
      <p className="text-xs text-slate-500">
        Showing {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-1">
        <button className="btn-ghost !px-2 !py-1.5" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-slate-700 px-2">
          {page} / {pages}
        </span>
        <button className="btn-ghost !px-2 !py-1.5" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}