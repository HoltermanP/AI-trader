import KPIBlock from '@/components/ui/KPIBlock';

const kpis = [
  {
    label: 'Portfolio Value',
    value: '—',
    unit: 'EUR',
    subtext: 'Connect exchange to track',
    positive: null,
  },
  {
    label: '24h P&L',
    value: '—',
    unit: 'EUR',
    subtext: 'Requires exchange API',
    positive: null,
  },
  {
    label: 'Active Trades',
    value: '0',
    unit: '',
    subtext: 'No open positions',
    positive: null,
  },
  {
    label: 'Win Rate',
    value: '—',
    unit: '%',
    subtext: 'Based on closed trades',
    positive: null,
  },
];

export default function KPIGrid() {
  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <KPIBlock
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            unit={kpi.unit}
            subtext={kpi.subtext}
            positive={kpi.positive}
          />
        ))}
      </div>
      <p className="mt-2.5 text-[11px] text-slate-custom font-mono">
        * Live KPI data requires exchange API integration. Configure in Settings.
      </p>
    </div>
  );
}
