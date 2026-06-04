interface MiniCardProps {
  title: string;
  value: string;
}

export function MiniCard({ title, value }: MiniCardProps) {
  return (
    <div className="rounded-3xl border border-ink-200 bg-ink-50/50 p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-500">{title}</p>
      <p className="mt-2 text-base font-bold text-ink-900">{value}</p>
    </div>
  );
}
