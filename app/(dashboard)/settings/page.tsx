import type { Metadata } from 'next';
import SettingsForm from '@/components/settings/SettingsForm';

export const metadata: Metadata = {
  title: 'Settings | AI-Trader',
};

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-off-white mb-1 tracking-tight">Settings</h1>
        <p className="text-xs font-mono text-slate-custom tracking-[0.15em]">
          CONFIGURE YOUR TRADING PREFERENCES
        </p>
      </div>

      <SettingsForm />
    </div>
  );
}
