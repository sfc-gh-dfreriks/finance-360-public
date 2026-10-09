import { useFilters } from '@/hooks/useFilters';
import { useQuery } from '@/hooks/useQuery';
import { fetchGeneralLedger } from '@/lib/api';
import { formatDollar } from '@/lib/utils';
import MetricCard, { DollarSign, TrendingUp, TrendingDown, Activity } from '@/components/MetricCard';
import ChartCard from '@/components/ChartCard';
import DataTable from '@/components/DataTable';
import ReactECharts from '@/components/Chart';

const PALETTE = ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899'];
const ACCENTS = [
  'border-cyan-300/50 bg-gradient-to-br from-cyan-50 to-sky-50',
  'border-emerald-300/50 bg-gradient-to-br from-emerald-50 to-green-50',
  'border-red-300/50 bg-gradient-to-br from-red-50 to-orange-50',
  'border-purple-300/50 bg-gradient-to-br from-purple-50 to-indigo-50',
];

const GL_NAMES: Record<string, { name: string; category: string }> = {
  '100000': { name: 'Cash & Bank', category: 'Assets' },
  '110000': { name: 'Accounts Receivable', category: 'Assets' },
  '120000': { name: 'Inventory - Raw Materials', category: 'Assets' },
  '121000': { name: 'Inventory - Finished Goods', category: 'Assets' },
  '130000': { name: 'Prepaid Expenses', category: 'Assets' },
  '140000': { name: 'Fixed Assets - Equipment', category: 'Assets' },
  '141000': { name: 'Fixed Assets - Buildings', category: 'Assets' },
  '142000': { name: 'Accumulated Depreciation', category: 'Assets' },
  '150000': { name: 'Intangible Assets', category: 'Assets' },
  '200000': { name: 'Accounts Payable', category: 'Liabilities' },
  '210000': { name: 'Accrued Liabilities', category: 'Liabilities' },
  '220000': { name: 'Short-term Loans', category: 'Liabilities' },
  '230000': { name: 'Long-term Debt', category: 'Liabilities' },
  '240000': { name: 'Deferred Revenue', category: 'Liabilities' },
  '250000': { name: 'Tax Payable', category: 'Liabilities' },
  '300000': { name: 'Common Stock', category: 'Equity' },
  '310000': { name: 'Retained Earnings', category: 'Equity' },
  '320000': { name: 'Additional Paid-in Capital', category: 'Equity' },
  '400000': { name: 'Product Revenue', category: 'Revenue' },
  '410000': { name: 'Service Revenue', category: 'Revenue' },
  '420000': { name: 'License Revenue', category: 'Revenue' },
  '430000': { name: 'Subscription Revenue', category: 'Revenue' },
  '440000': { name: 'Other Revenue', category: 'Revenue' },
  '500000': { name: 'Cost of Goods Sold', category: 'COGS' },
  '510000': { name: 'Direct Labor', category: 'COGS' },
  '520000': { name: 'Manufacturing Overhead', category: 'COGS' },
  '600000': { name: 'Salaries & Wages', category: 'Operating Expenses' },
  '610000': { name: 'Employee Benefits', category: 'Operating Expenses' },
  '620000': { name: 'Rent & Facilities', category: 'Operating Expenses' },
  '630000': { name: 'Marketing & Advertising', category: 'Operating Expenses' },
  '640000': { name: 'Travel & Entertainment', category: 'Operating Expenses' },
  '650000': { name: 'IT & Communications', category: 'Operating Expenses' },
  '660000': { name: 'Professional Services', category: 'Operating Expenses' },
  '670000': { name: 'Depreciation Expense', category: 'Operating Expenses' },
  '680000': { name: 'Insurance', category: 'Operating Expenses' },
  '690000': { name: 'Office Supplies', category: 'Operating Expenses' },
  '700000': { name: 'Research & Development', category: 'Operating Expenses' },
  '800000': { name: 'Interest Income', category: 'Other Income' },
  '810000': { name: 'Interest Expense', category: 'Other Expenses' },
  '820000': { name: 'Foreign Exchange Gain/Loss', category: 'Other Expenses' },
  '900000': { name: 'Income Tax Expense', category: 'Tax' },
  '910000': { name: 'Deferred Tax', category: 'Tax' },
};

export default function GeneralLedger() {
  const { selectedCompanyCodes, selectedFiscalYears } = useFilters();
  const hasFilters = selectedCompanyCodes.length > 0 && selectedFiscalYears.length > 0;
  const { data, loading, error } = useQuery(
    () => hasFilters ? fetchGeneralLedger(selectedCompanyCodes, selectedFiscalYears) : Promise.resolve(null),
    [selectedCompanyCodes.join(','), selectedFiscalYears.join(',')]
  );

  if (!hasFilters) {
    return <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">Select at least one company code and fiscal year.</div>;
  }
  if (loading) return <div className="h-64 animate-pulse rounded-xl bg-gray-200" />;
  if (error) return <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">Error: {error}</div>;
  if (!data || !data.trialBalance) return null;

  const { trialBalance, plSummary, balanceSheet: balanceSheetComposition, glActivity: activityByPeriod } = data;

  // Enrich trial balance with names
  const enrichedTB = (trialBalance ?? []).map((row: any) => {
    const info = GL_NAMES[row.glaccount] || { name: row.glaccount, category: 'Other' };
    return { ...row, name: info.name, category: info.category };
  });

  // KPI computations
  const totalDebits = (trialBalance ?? []).reduce((s: number, r: any) => s + (r.debit ?? 0), 0);
  const totalCredits = (trialBalance ?? []).reduce((s: number, r: any) => s + (r.credit ?? 0), 0);
  const netBalance = (trialBalance ?? []).reduce((s: number, r: any) => s + (r.balance ?? 0), 0);
  const glAccountCount = (trialBalance ?? []).length;

  // Liquidity & Solvency Ratios (ClearPoint Financial Measures)
  const currentAssets = enrichedTB
    .filter((r: any) => r.category === 'Assets' && ['100000','110000','120000','121000','130000'].includes(r.glaccount))
    .reduce((s: number, r: any) => s + Math.abs(r.balance ?? 0), 0);
  const inventory = enrichedTB
    .filter((r: any) => ['120000','121000'].includes(r.glaccount))
    .reduce((s: number, r: any) => s + Math.abs(r.balance ?? 0), 0);
  const currentLiabilities = enrichedTB
    .filter((r: any) => r.category === 'Liabilities' && ['200000','210000','220000','250000'].includes(r.glaccount))
    .reduce((s: number, r: any) => s + Math.abs(r.balance ?? 0), 0);
  const totalLiabilities = enrichedTB
    .filter((r: any) => r.category === 'Liabilities')
    .reduce((s: number, r: any) => s + Math.abs(r.balance ?? 0), 0);
  const totalEquity = enrichedTB
    .filter((r: any) => r.category === 'Equity')
    .reduce((s: number, r: any) => s + Math.abs(r.balance ?? 0), 0);

  const workingCapital = currentAssets - currentLiabilities;
  const currentRatio = currentLiabilities > 0 ? currentAssets / currentLiabilities : 0;
  const quickRatio = currentLiabilities > 0 ? (currentAssets - inventory) / currentLiabilities : 0;
  const debtToEquity = totalEquity > 0 ? totalLiabilities / totalEquity : 0;

  // P&L Waterfall
  const plData = (plSummary ?? []) as { category: string; amount: number }[];
  const revenueAmt = plData.find(d => d.category === 'Revenue')?.amount ?? 0;
  const cogsAmt = plData.find(d => d.category === 'COGS')?.amount ?? 0;
  const grossProfit = revenueAmt - Math.abs(cogsAmt);
  const opExAmt = plData.find(d => d.category === 'Operating Expenses')?.amount ?? 0;
  const otherAmt = (plData.find(d => d.category === 'Other Income')?.amount ?? 0) + (plData.find(d => d.category === 'Other Expenses')?.amount ?? 0);
  const taxAmt = plData.find(d => d.category === 'Tax')?.amount ?? 0;
  const netIncome = grossProfit - Math.abs(opExAmt) + otherAmt - Math.abs(taxAmt);

  const waterfallItems: { name: string; value: number; isTotal: boolean }[] = [
    { name: 'Revenue', value: revenueAmt, isTotal: false },
    { name: 'COGS', value: -Math.abs(cogsAmt), isTotal: false },
    { name: 'Gross Profit', value: grossProfit, isTotal: true },
    { name: 'OpEx', value: -Math.abs(opExAmt), isTotal: false },
    { name: 'Other', value: otherAmt, isTotal: false },
    { name: 'Tax', value: -Math.abs(taxAmt), isTotal: false },
    { name: 'Net Income', value: netIncome, isTotal: true },
  ];

  // Compute assist (invisible) bar + value bar
  let runningTotal = 0;
  const assistValues: number[] = [];
  const valueItems: { value: number; itemStyle: { color: string } }[] = [];
  waterfallItems.forEach(item => {
    if (item.isTotal) {
      assistValues.push(0);
      valueItems.push({ value: item.value, itemStyle: { color: '#3b82f6' } });
      runningTotal = item.value;
    } else {
      if (item.value >= 0) {
        assistValues.push(runningTotal);
        valueItems.push({ value: item.value, itemStyle: { color: '#10b981' } });
      } else {
        assistValues.push(runningTotal + item.value);
        valueItems.push({ value: Math.abs(item.value), itemStyle: { color: '#ef4444' } });
      }
      runningTotal += item.value;
    }
  });

  // Balance Sheet Treemap data
  const bsCategories = ['Assets', 'Liabilities', 'Equity'];
  const bsColors: Record<string, string> = { Assets: '#06b6d4', Liabilities: '#ef4444', Equity: '#8b5cf6' };
  const treemapData = bsCategories.map(cat => {
    const children = enrichedTB
      .filter((r: any) => r.category === cat)
      .map((r: any) => ({ name: r.name, value: Math.abs(r.balance ?? 0) }))
      .filter((c: any) => c.value > 0);
    return { name: cat, itemStyle: { color: bsColors[cat] }, children };
  }).filter(d => d.children.length > 0);

  // GL Activity area chart data
  const activityData = (activityByPeriod ?? []).map((d: any) => ({
    period: `${d.fiscalyear}-${d.fiscalperiod}`,
    amount: d.totalAmount ?? 0,
    postings: d.postings ?? 0,
  }));

  // Trial Balance Table
  const columns = [
    { key: 'glaccount', label: 'GL Account' },
    { key: 'name', label: 'Name' },
    { key: 'category', label: 'Category' },
    { key: 'debit', label: 'Debit', format: (v: number) => formatDollar(v) },
    { key: 'credit', label: 'Credit', format: (v: number) => formatDollar(v) },
    { key: 'balance', label: 'Balance', format: (v: number) => formatDollar(v) },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Total Debits" value={formatDollar(totalDebits)} icon={DollarSign} accent={ACCENTS[0]} />
        <MetricCard title="Total Credits" value={formatDollar(totalCredits)} icon={TrendingUp} accent={ACCENTS[1]} />
        <MetricCard title="Net Balance" value={formatDollar(netBalance)} icon={TrendingDown} accent={ACCENTS[2]} />
        <MetricCard title="GL Accounts" value={glAccountCount.toString()} icon={Activity} accent={ACCENTS[3]} />
      </div>

      {/* Liquidity & Solvency Ratios (ClearPoint) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Working Capital"
          value={formatDollar(workingCapital)}
          icon={DollarSign}
          accent="border-blue-300/50 bg-gradient-to-br from-blue-50 to-indigo-50"
          delta={workingCapital > 0 ? 'Positive — can meet short-term obligations' : 'Negative — liquidity risk'}
          deltaType={workingCapital > 0 ? 'positive' : 'negative'}
        />
        <MetricCard
          title="Current Ratio"
          value={currentRatio.toFixed(2)}
          icon={Activity}
          accent="border-emerald-300/50 bg-gradient-to-br from-emerald-50 to-green-50"
          delta={currentRatio >= 2 ? 'Strong (≥2.0)' : currentRatio >= 1 ? 'Adequate (1.0-2.0)' : 'Below 1.0 — concern'}
          deltaType={currentRatio >= 2 ? 'positive' : currentRatio >= 1 ? 'neutral' : 'negative'}
        />
        <MetricCard
          title="Quick Ratio"
          value={quickRatio.toFixed(2)}
          icon={TrendingUp}
          accent="border-amber-300/50 bg-gradient-to-br from-amber-50 to-yellow-50"
          delta={quickRatio >= 1 ? 'Can cover liabilities w/o inventory' : 'Relies on inventory sales'}
          deltaType={quickRatio >= 1 ? 'positive' : 'negative'}
        />
        <MetricCard
          title="Debt-to-Equity"
          value={debtToEquity.toFixed(2)}
          icon={TrendingDown}
          accent="border-red-300/50 bg-gradient-to-br from-red-50 to-orange-50"
          delta={debtToEquity <= 1 ? 'Conservative leverage' : debtToEquity <= 2 ? 'Moderate leverage' : 'High leverage'}
          deltaType={debtToEquity <= 1 ? 'positive' : debtToEquity <= 2 ? 'neutral' : 'negative'}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* P&L Waterfall */}
        <ChartCard title="P&L Waterfall" className="lg:col-span-2">
          <ReactECharts option={{
            tooltip: {
              trigger: 'axis',
              formatter: (params: any) => {
                const item = params.find((p: any) => p.seriesName === 'Value');
                if (!item) return '';
                return `${item.name}: ${formatDollar(item.value)}`;
              },
            },
            grid: { left: 60, right: 20, bottom: 40, top: 20 },
            xAxis: {
              type: 'category',
              data: waterfallItems.map(d => d.name),
              axisLabel: { fontSize: 11 },
            },
            yAxis: {
              type: 'value',
              axisLabel: { formatter: (v: number) => formatDollar(v) },
            },
            series: [
              {
                name: 'Assist',
                type: 'bar',
                stack: 'waterfall',
                itemStyle: { color: 'transparent', borderColor: 'transparent' },
                emphasis: { itemStyle: { color: 'transparent', borderColor: 'transparent' } },
                data: assistValues,
              },
              {
                name: 'Value',
                type: 'bar',
                stack: 'waterfall',
                label: { show: true, position: 'top', formatter: (p: any) => formatDollar(p.value), fontSize: 10 },
                data: valueItems,
              },
            ],
          }} style={{ height: 320 }} />
        </ChartCard>

        {/* Balance Sheet Composition — Enhanced stacked bar with totals */}
        <ChartCard title="Balance Sheet Composition" subtitle="Assets = Liabilities + Equity">
          <ReactECharts option={{
            tooltip: {
              trigger: 'axis',
              formatter: (params: any) => {
                let html = `<strong>${params[0]?.name}</strong>`;
                params.forEach((p: any) => {
                  if (p.value > 0) html += `<br/>${p.marker} ${p.seriesName}: ${formatDollar(p.value)}`;
                });
                return html;
              },
            },
            legend: { top: 0, textStyle: { fontSize: 10 } },
            grid: { left: 100, right: 40, top: 35, bottom: 30 },
            xAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatDollar(v) } },
            yAxis: {
              type: 'category',
              data: ['Liab + Equity', 'Assets'],
              axisLabel: { fontSize: 12, fontWeight: 'bold' },
            },
            series: (() => {
              // Build sub-account stacks for each side
              const assetAccounts = enrichedTB.filter((r: any) => r.category === 'Assets' && Math.abs(r.balance ?? 0) > 0);
              const liabAccounts = enrichedTB.filter((r: any) => r.category === 'Liabilities' && Math.abs(r.balance ?? 0) > 0);
              const equityAccounts = enrichedTB.filter((r: any) => r.category === 'Equity' && Math.abs(r.balance ?? 0) > 0);

              const totalAssets = assetAccounts.reduce((s: number, r: any) => s + Math.abs(r.balance ?? 0), 0);
              const totalLiab = liabAccounts.reduce((s: number, r: any) => s + Math.abs(r.balance ?? 0), 0);
              const totalEq = equityAccounts.reduce((s: number, r: any) => s + Math.abs(r.balance ?? 0), 0);

              // Top asset accounts as stacked series
              const topAssets = assetAccounts.sort((a: any, b: any) => Math.abs(b.balance) - Math.abs(a.balance)).slice(0, 5);
              const topLiab = liabAccounts.sort((a: any, b: any) => Math.abs(b.balance) - Math.abs(a.balance)).slice(0, 3);

              const series: any[] = [];
              // Asset bars (row index 1)
              topAssets.forEach((acc: any, i: number) => {
                series.push({
                  name: acc.name,
                  type: 'bar',
                  stack: 'total',
                  data: [0, Math.abs(acc.balance)],
                  itemStyle: { color: PALETTE[i % PALETTE.length], borderRadius: i === topAssets.length - 1 ? [0, 4, 4, 0] : 0 },
                  barMaxWidth: 32,
                });
              });
              if (totalAssets > topAssets.reduce((s: number, a: any) => s + Math.abs(a.balance), 0)) {
                series.push({
                  name: 'Other Assets',
                  type: 'bar',
                  stack: 'total',
                  data: [0, totalAssets - topAssets.reduce((s: number, a: any) => s + Math.abs(a.balance), 0)],
                  itemStyle: { color: '#94a3b8', borderRadius: [0, 4, 4, 0] },
                  barMaxWidth: 32,
                });
              }
              // Liability bars (row index 0)
              topLiab.forEach((acc: any, i: number) => {
                series.push({
                  name: acc.name,
                  type: 'bar',
                  stack: 'liab',
                  data: [Math.abs(acc.balance), 0],
                  itemStyle: { color: ['#fca5a5', '#f87171', '#ef4444'][i] || '#ef4444' },
                  barMaxWidth: 32,
                });
              });
              if (totalLiab > topLiab.reduce((s: number, a: any) => s + Math.abs(a.balance), 0)) {
                series.push({
                  name: 'Other Liabilities',
                  type: 'bar',
                  stack: 'liab',
                  data: [totalLiab - topLiab.reduce((s: number, a: any) => s + Math.abs(a.balance), 0), 0],
                  itemStyle: { color: '#fecaca' },
                  barMaxWidth: 32,
                });
              }
              // Equity (row index 0, same stack as liab)
              series.push({
                name: 'Equity',
                type: 'bar',
                stack: 'liab',
                data: [totalEq, 0],
                itemStyle: { color: '#8b5cf6', borderRadius: [0, 4, 4, 0] },
                barMaxWidth: 32,
              });

              return series;
            })(),
          }} style={{ height: 300 }} />
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg bg-cyan-50 p-2">
              <p className="font-bold text-sf-dark">{formatDollar(enrichedTB.filter((r: any) => r.category === 'Assets').reduce((s: number, r: any) => s + Math.abs(r.balance ?? 0), 0))}</p>
              <p className="text-gray-500">Total Assets</p>
            </div>
            <div className="rounded-lg bg-red-50 p-2">
              <p className="font-bold text-red-700">{formatDollar(enrichedTB.filter((r: any) => r.category === 'Liabilities').reduce((s: number, r: any) => s + Math.abs(r.balance ?? 0), 0))}</p>
              <p className="text-gray-500">Total Liabilities</p>
            </div>
            <div className="rounded-lg bg-purple-50 p-2">
              <p className="font-bold text-purple-700">{formatDollar(enrichedTB.filter((r: any) => r.category === 'Equity').reduce((s: number, r: any) => s + Math.abs(r.balance ?? 0), 0))}</p>
              <p className="text-gray-500">Shareholders' Equity</p>
            </div>
          </div>
        </ChartCard>

        {/* GL Activity Gradient Area */}
        <ChartCard title="GL Activity by Period">
          <ReactECharts option={{
            tooltip: { trigger: 'axis' },
            legend: { data: ['Amount', 'Postings'], top: 0 },
            grid: { left: 60, right: 60, bottom: 30, top: 35 },
            xAxis: { type: 'category', data: activityData.map((d: any) => d.period), boundaryGap: false },
            yAxis: [
              { type: 'value', axisLabel: { formatter: (v: number) => formatDollar(v) } },
              { type: 'value', splitLine: { show: false } },
            ],
            series: [
              {
                name: 'Amount',
                type: 'line',
                smooth: true,
                symbol: 'circle',
                symbolSize: 6,
                data: activityData.map((d: any) => d.amount),
                areaStyle: {
                  color: {
                    type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                    colorStops: [
                      { offset: 0, color: 'rgba(6,182,212,0.4)' },
                      { offset: 1, color: 'rgba(6,182,212,0.05)' },
                    ],
                  },
                },
                lineStyle: { color: '#06b6d4', width: 2 },
                itemStyle: { color: '#06b6d4' },
              },
              {
                name: 'Postings',
                type: 'line',
                smooth: true,
                symbol: 'circle',
                symbolSize: 6,
                yAxisIndex: 1,
                data: activityData.map((d: any) => d.postings),
                lineStyle: { color: '#8b5cf6', width: 2, type: 'dashed' },
                itemStyle: { color: '#8b5cf6' },
              },
            ],
          }} style={{ height: 320 }} />
        </ChartCard>
      </div>

      {/* Trial Balance Table */}
      <ChartCard title="Trial Balance" subtitle={`Total Debits: ${formatDollar(totalDebits)} | Total Credits: ${formatDollar(totalCredits)}`}>
        <DataTable columns={columns} data={enrichedTB} />
      </ChartCard>
    </div>
  );
}
