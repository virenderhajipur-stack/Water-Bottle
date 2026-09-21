export default function StatCard({ label, value, sub, icon, accent = 'brand', onClick }) {
  const accents = {
    brand: 'bg-brand-50 text-brand-600',
    green: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-sky-50 text-sky-600',
    purple: 'bg-purple-50 text-purple-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600'
  };
  const Icon = icon;
  return (
    <div
      className={`card p-4 flex items-start justify-between ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={onClick}
    >
      <div className="min-w-0">
        <p className="text-xs font-semibold text-ink-500">{label}</p>
        <p className="text-xl font-bold text-ink-900 mt-1 truncate">{value}</p>
        {sub && <p className="text-xs text-ink-400 mt-0.5 truncate">{sub}</p>}
      </div>
      {Icon && (
        <div className={`rounded-xl p-2.5 ${accents[accent]}`}>
          <Icon className="w-5 h-5" />
        </div>
      )}
    </div>
  );
}