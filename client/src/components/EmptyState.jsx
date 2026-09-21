import { Inbox } from 'lucide-react';

export function EmptyState({ message, sub }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
      <div className="rounded-2xl bg-slate-100 p-4 mb-3">
        <Inbox className="w-8 h-8" />
      </div>
      <p className="font-semibold text-slate-500">{message}</p>
      {sub && <p className="text-sm mt-1">{sub}</p>}
    </div>
  );
}

export default EmptyState;

export function Spinner({ className = '' }) {
  return (
    <div className={`flex items-center justify-center py-10 ${className}`}>
      <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
    </div>
  );
}