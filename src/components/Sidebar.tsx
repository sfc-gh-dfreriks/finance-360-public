import {
  LayoutDashboard,
  BookOpen,
  PieChart,
  TrendingUp,
  Receipt,
  CreditCard,
  Calendar,
  Bot,
  GitBranch,
  Check,
} from 'lucide-react';
import { useFilters } from '@/hooks/useFilters';
import { cn } from '@/lib/utils';

export type PageId =
  | 'overview'
  | 'general-ledger'
  | 'cost-centers'
  | 'profit-centers'
  | 'accounts-payable'
  | 'accounts-receivable'
  | 'period-analysis'
  | 'lineage'
  | 'analyst';

export interface NavItem {
  id: PageId;
  label: string;
  icon: React.ElementType;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Executive Overview', icon: LayoutDashboard },
  { id: 'general-ledger', label: 'General Ledger', icon: BookOpen },
  { id: 'cost-centers', label: 'Cost Centers', icon: PieChart },
  { id: 'profit-centers', label: 'Profit Centers', icon: TrendingUp },
  { id: 'accounts-payable', label: 'Accounts Payable', icon: Receipt },
  { id: 'accounts-receivable', label: 'Accounts Receivable', icon: CreditCard },
  { id: 'period-analysis', label: 'Period Analysis', icon: Calendar },
  { id: 'lineage', label: 'BDC Sources & Lineage', icon: GitBranch },
  { id: 'analyst', label: 'Cortex Analyst', icon: Bot },
];

interface SidebarProps {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
}

export default function Sidebar({ activePage, onNavigate }: SidebarProps) {
  const {
    companyCodes,
    selectedCompanyCodes,
    setSelectedCompanyCodes,
    fiscalYears,
    selectedFiscalYears,
    setSelectedFiscalYears,
  } = useFilters();

  function toggleItem(item: string, selected: string[], setSelected: (v: string[]) => void) {
    if (selected.includes(item)) {
      setSelected(selected.filter((s) => s !== item));
    } else {
      setSelected([...selected, item]);
    }
  }

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col bg-gradient-to-b from-sf-dark to-sf-deeper text-white">
      {/* Logo */}
      <div className="flex flex-col gap-1.5 border-b border-white/10 px-5 py-4">
        <img
          src={`${import.meta.env.BASE_URL}snowflake_logo.svg`}
          alt="Snowflake"
          className="h-7 w-auto self-start"
        />
        <span className="text-lg font-bold tracking-tight text-white">
          SAP BDC Finance 360
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activePage === item.id;
            return (
              <li key={item.id}>
                <button
                  onClick={() => onNavigate(item.id)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                    active
                      ? 'bg-sf-primary/20 text-sf-light font-medium'
                      : 'text-sf-pale/80 hover:bg-white/5 hover:text-white'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Company Codes Filter */}
      <div className="border-t border-white/10 px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-sf-pale/70">
            Company Codes
          </span>
          <div className="flex gap-2 text-[10px]">
            <button onClick={() => setSelectedCompanyCodes([...companyCodes])} className="text-sf-light hover:underline">
              All
            </button>
            <button onClick={() => setSelectedCompanyCodes([])} className="text-sf-light hover:underline">
              None
            </button>
          </div>
        </div>
        <div className="max-h-24 space-y-0.5 overflow-y-auto">
          {companyCodes.map((code) => {
            const checked = selectedCompanyCodes.includes(code);
            return (
              <button
                key={code}
                onClick={() => toggleItem(code, selectedCompanyCodes, setSelectedCompanyCodes)}
                className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs text-sf-pale/80 hover:bg-white/5"
              >
                <span
                  className={cn(
                    'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border',
                    checked
                      ? 'border-sf-primary bg-sf-primary'
                      : 'border-sf-pale/40'
                  )}
                >
                  {checked && <Check className="h-2.5 w-2.5 text-white" />}
                </span>
                <span className="truncate">{code}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Fiscal Years Filter */}
      <div className="border-t border-white/10 px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-sf-pale/70">
            Fiscal Years
          </span>
          <div className="flex gap-2 text-[10px]">
            <button onClick={() => setSelectedFiscalYears([...fiscalYears])} className="text-sf-light hover:underline">
              All
            </button>
            <button onClick={() => setSelectedFiscalYears([])} className="text-sf-light hover:underline">
              None
            </button>
          </div>
        </div>
        <div className="max-h-24 space-y-0.5 overflow-y-auto">
          {fiscalYears.map((year) => {
            const checked = selectedFiscalYears.includes(year);
            return (
              <button
                key={year}
                onClick={() => toggleItem(year, selectedFiscalYears, setSelectedFiscalYears)}
                className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs text-sf-pale/80 hover:bg-white/5"
              >
                <span
                  className={cn(
                    'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border',
                    checked
                      ? 'border-sf-primary bg-sf-primary'
                      : 'border-sf-pale/40'
                  )}
                >
                  {checked && <Check className="h-2.5 w-2.5 text-white" />}
                </span>
                <span className="truncate">{year}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-white/10 px-5 py-3">
        <p className="text-[10px] leading-relaxed text-sf-pale/50">
          SAP BDC &nbsp;|&nbsp; 94 Finance Data Products
        </p>
      </div>
    </aside>
  );
}
