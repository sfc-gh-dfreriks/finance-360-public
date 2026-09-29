import { useState } from 'react';
import { FilterProvider } from '@/hooks/useFilters';
import Sidebar, { NAV_ITEMS, type PageId } from '@/components/Sidebar';
import Overview from '@/pages/Overview';
import GeneralLedger from '@/pages/GeneralLedger';
import CostCenters from '@/pages/CostCenters';
import ProfitCenters from '@/pages/ProfitCenters';
import AccountsPayable from '@/pages/AccountsPayable';
import AccountsReceivable from '@/pages/AccountsReceivable';
import PeriodAnalysis from '@/pages/PeriodAnalysis';
import Lineage from '@/pages/Lineage';
import Analyst from '@/pages/Analyst';

const PAGE_COMPONENTS: Record<string, React.FC> = {
  overview: Overview,
  'general-ledger': GeneralLedger,
  'cost-centers': CostCenters,
  'profit-centers': ProfitCenters,
  'accounts-payable': AccountsPayable,
  'accounts-receivable': AccountsReceivable,
  'period-analysis': PeriodAnalysis,
  lineage: Lineage,
  analyst: Analyst,
};

function AppShell() {
  const [activePage, setActivePage] = useState<PageId>('overview');

  const navItem = NAV_ITEMS.find((n) => n.id === activePage)!;
  const Icon = navItem.icon;
  const PageComponent = PAGE_COMPONENTS[activePage];

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar activePage={activePage} onNavigate={setActivePage} />
      <main className="ml-64 min-h-screen p-6">
        <div className="mb-6 flex items-center gap-3">
          <Icon className="h-6 w-6 text-sf-primary" />
          <h1 className="text-2xl font-bold text-sf-deeper">{navItem.label}</h1>
        </div>
        {PageComponent ? (
          <PageComponent />
        ) : (
          <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-sf-primary/30 bg-sky-50/30">
            <p className="text-lg text-sf-dark/60">{navItem.label} — coming soon</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <FilterProvider>
      <AppShell />
    </FilterProvider>
  );
}
