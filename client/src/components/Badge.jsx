const styles = {
  green: 'bg-emerald-100 text-emerald-700',
  red: 'bg-red-100 text-red-700',
  amber: 'bg-amber-100 text-amber-700',
  blue: 'bg-sky-100 text-sky-700',
  purple: 'bg-purple-100 text-purple-700',
  slate: 'bg-slate-100 text-slate-600',
  brand: 'bg-brand-100 text-brand-700'
};

export default function Badge({ label, color = 'slate', dot }) {
  return (
    <span className={`chip ${styles[color] || styles.slate}`}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5" />}
      {label}
    </span>
  );
}