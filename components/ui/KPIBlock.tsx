interface KPIBlockProps {
  label: string;
  value: string;
  unit?: string;
  subtext?: string;
  positive?: boolean | null;
}

export default function KPIBlock({ label, value, unit, subtext, positive }: KPIBlockProps) {
  const valueColor =
    positive === true
      ? 'text-green-400'
      : positive === false
        ? 'text-velocity-red'
        : 'text-blue-light';

  return (
    <div className="bg-surface border border-[#1E1E28] rounded-[12px] p-4 sm:p-5">
      <p className="text-[10px] font-mono text-slate-custom uppercase tracking-[0.15em] mb-2">{label}</p>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-3xl font-bold font-mono ${valueColor}`}>{value}</span>
        {unit && <span className="text-sm text-slate-custom font-mono">{unit}</span>}
      </div>
      {subtext && <p className="text-xs text-slate-custom mt-1.5">{subtext}</p>}
    </div>
  );
}
