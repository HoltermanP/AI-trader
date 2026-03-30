import type { Metadata } from 'next';
import CryptoImpactNewsPanel from '@/components/dashboard/CryptoImpactNewsPanel';
import KPIGrid from '@/components/dashboard/KPIGrid';
import LivePriceChart from '@/components/dashboard/LivePriceChart';
import TradeStrategyAnalyzer from '@/components/dashboard/TradeStrategyAnalyzer';
import TradingSignalsPanel from '@/components/dashboard/TradingSignalsPanel';

export const metadata: Metadata = {
  title: 'Dashboard | AI-Trader',
};

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-off-white mb-1 tracking-tight">
          Trading Dashboard
        </h1>
        <p className="text-xs font-mono text-slate-custom tracking-[0.15em]">
          <span className="text-blue-light">AI</span>-FIRST CRYPTO ANALYSIS &middot; CLAUDE (ANTHROPIC)
        </p>
      </div>

      <KPIGrid />

      <CryptoImpactNewsPanel />

      <TradingSignalsPanel />

      <LivePriceChart />

      <TradeStrategyAnalyzer />
    </div>
  );
}
