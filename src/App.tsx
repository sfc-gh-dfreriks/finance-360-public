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
import AskCortexPage from '@/pages/AskCortexPage';
import AskCortex from '@/components/AskCortex';

// Pages whose data Cortex can explain in context: topic -> suggested follow-ups.
const ASK: Partial<Record<PageId, { topic: string; suggestions: string[] }>> = {
  overview: { topic: 'overview', suggestions: ['Which company code drives the most profit?', 'Which expense category is growing fastest?'] },
  'general-ledger': { topic: 'general-ledger', suggestions: ['Does the ledger balance, and what explains any gap?', 'Which GL accounts carry the largest balances?'] },
  'cost-centers': { topic: 'cost-centers', suggestions: ['Which departments are overspending?', 'Where could we cut cost first?'] },
  'profit-centers': { topic: 'profit-centers', suggestions: ['Which profit centers have the weakest margin?', 'Which segment contributes most revenue?'] },
  'accounts-payable': { topic: 'accounts-payable', suggestions: ['How concentrated is spend in our top vendors?', 'What AP aging needs attention?'] },
  'accounts-receivable': { topic: 'accounts-receivable', suggestions: ['Which customers should we chase first?', 'Is DSO improving or worsening?'] },
  'period-analysis': { topic: 'period-analysis', suggestions: ['Which periods show unusual swings?', 'Is there seasonality in revenue?'] },
};

const PAGE_COMPONENTS: Record<string, React.FC> = {
  'ask-cortex': AskCortexPage,
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
        {ASK[activePage] && (
          <div className="mb-6">
            <AskCortex key={activePage} topic={ASK[activePage]!.topic} suggestions={ASK[activePage]!.suggestions}
              label={`Ask Cortex about ${navItem.label}`} />
          </div>
        )}
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
