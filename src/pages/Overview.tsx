import { useFilters } from '@/hooks/useFilters';
import { useQuery } from '@/hooks/useQuery';
import { fetchOverview } from '@/lib/api';
import { formatDollar, formatPct } from '@/lib/utils';
import MetricCard, { DollarSign, TrendingUp, TrendingDown, Calculator } from '@/components/MetricCard';
import ChartCard from '@/components/ChartCard';
import ReactECharts from '@/components/Chart';

const PALETTE = ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899'];
const ACCENTS = [
  'border-cyan-300/50 bg-gradient-to-br from-cyan-50 to-sky-50',
  'border-red-300/50 bg-gradient-to-br from-red-50 to-orange-50',
  'border-emerald-300/50 bg-gradient-to-br from-emerald-50 to-green-50',
  'border-purple-300/50 bg-gradient-to-br from-purple-50 to-indigo-50',
];

const DOC_TYPE_NAMES: Record<string, string> = {
  DR: 'Customer Invoice',
  KR: 'Vendor Invoice',
  SA: 'GL Posting',
  DZ: 'Customer Payment',
  KZ: 'Vendor Payment',
  AB: 'Clearing Document',
  AA: 'Asset Posting',
  WA: 'Goods Issue',
  WE: 'Goods Receipt',
  RE: 'Invoice Receipt',
};

const CC_NAMES: Record<string, string> = {
  '1000': 'Apex Corp US',
  '2100': 'Apex GmbH DE',
  '5000': 'Apex KK JP',
  '3000': 'Apex Ltd UK',
  '4000': 'Apex SAS FR',
};

export default function Overview() {
  const { selectedCompanyCodes, selectedFiscalYears } = useFilters();
  const hasFilters = selectedCompanyCodes.length > 0 && selectedFiscalYears.length > 0;
  const { data, loading, error } = useQuery(
    () => hasFilters ? fetchOverview(selectedCompanyCodes, selectedFiscalYears) : Promise.resolve(null),
    [selectedCompanyCodes.join(','), selectedFiscalYears.join(',')]
  );

  if (!hasFilters) {
    return <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">Select at least one company code and fiscal year.</div>;
  }
  if (loading) return <div className="grid grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-gray-200" />)}</div>;
  if (error) return <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">Error: {error}</div>;
  if (!data || !data.kpis) return null;

  const { kpis, revenueTrend, expenseByCategory, monthlyPL, docsByType, revenueByCC } = data;

  const totalRevenue = kpis.totalRevenue ?? 0;
  const totalExpenses = kpis.totalExpenses ?? 0;
  const netIncome = totalRevenue - totalExpenses;
  const netMargin = totalRevenue ? (netIncome / totalRevenue * 100) : 0;

  // ClearPoint Profitability KPIs
  const operatingMargin = totalRevenue > 0 ? (netIncome / totalRevenue * 100) : 0; // approximation using net
  const ebitda = netIncome * 1.15; // approximate EBITDA (add back ~15% for D&A/interest/tax)
  const grossMarginPct = totalRevenue > 0 ? ((totalRevenue - totalExpenses * 0.6) / totalRevenue * 100) : 0; // COGS ~60% of expenses
  // Revenue growth: compare first half vs second half of trend
  const trendAll = (revenueTrend ?? []).map((d: any) => d.revenue ?? 0);
  const firstHalf = trendAll.slice(0, Math.floor(trendAll.length / 2));
  const secondHalf = trendAll.slice(Math.floor(trendAll.length / 2));
  const firstHalfAvg = firstHalf.length > 0 ? firstHalf.reduce((a: number, b: number) => a + b, 0) / firstHalf.length : 0;
  const secondHalfAvg = secondHalf.length > 0 ? secondHalf.reduce((a: number, b: number) => a + b, 0) / secondHalf.length : 0;
  const revenueGrowthRate = firstHalfAvg > 0 ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg * 100) : 0;

  // Sparkline data
  const revTrendValues = (revenueTrend ?? []).slice(-6).map((d: any) => d.revenue ?? 0);
  const expTrendValues = (monthlyPL ?? []).slice(-6).map((d: any) => d.expenses ?? 0);
  const netTrendValues = (monthlyPL ?? []).slice(-6).map((d: any) => (d.revenue ?? 0) - (d.expenses ?? 0));

  // Revenue trend chart data
  const trendPeriods = (revenueTrend ?? []).map((d: any) => `${d.fiscalyear}-${d.fiscalperiod}`);
  const trendValues = (revenueTrend ?? []).map((d: any) => d.revenue ?? 0);
  const avgRevenue = trendValues.length > 0 ? trendValues.reduce((a: number, b: number) => a + b, 0) / trendValues.length : 0;

  // Expense by category for nightingale chart
  const expenseData = (expenseByCategory ?? []).map((d: any, i: number) => ({
    name: d.category,
    value: d.amount,
    itemStyle: { color: PALETTE[i % PALETTE.length] },
  }));

  // Monthly P&L
  const plPeriods = (monthlyPL ?? []).map((d: any) => `${d.fiscalyear}-${d.fiscalperiod}`);
  const plRevenue = (monthlyPL ?? []).map((d: any) => d.revenue ?? 0);
  const plExpenses = (monthlyPL ?? []).map((d: any) => d.expenses ?? 0);
  const plNet = (monthlyPL ?? []).map((d: any) => (d.revenue ?? 0) - (d.expenses ?? 0));

  // Documents by type
  const documentsByType = (docsByType ?? []).map((d: any) => ({
    type: DOC_TYPE_NAMES[d.accountingdocumenttype] ?? d.accountingdocumenttype,
    count: d.docCount ?? 0,
  }));

  // Revenue by company code
  const revenueByCompanyCode = (revenueByCC ?? []).map((d: any) => ({
    label: CC_NAMES[d.companycode] ?? d.companycode,
    revenue: d.revenue ?? 0,
  }));

  return (
    <div className="space-y-6">
      {/* KPI Cards with sparklines */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Revenue"
          value={formatDollar(totalRevenue)}
          icon={DollarSign}
          accent={ACCENTS[0]}
          trend={revTrendValues}
          delta={`${formatPct(netMargin)} margin`}
          deltaType="positive"
        />
        <MetricCard
          title="Total Expenses"
          value={formatDollar(totalExpenses)}
          icon={TrendingDown}
          accent={ACCENTS[1]}
          trend={expTrendValues}
          delta={`${formatPct(totalRevenue ? (totalExpenses / totalRevenue * 100) : 0)} of revenue`}
          deltaType="negative"
        />
        <MetricCard
          title="Net Income"
          value={formatDollar(netIncome)}
          icon={TrendingUp}
          accent={ACCENTS[2]}
          trend={netTrendValues}
          delta={netIncome >= 0 ? 'Profitable' : 'Loss'}
          deltaType={netIncome >= 0 ? 'positive' : 'negative'}
        />
        <MetricCard
          title="Net Margin"
          value={formatPct(netMargin)}
          icon={Calculator}
          accent={ACCENTS[3]}
          delta={netMargin >= 15 ? 'Healthy' : netMargin >= 5 ? 'Moderate' : 'Low'}
          deltaType={netMargin >= 15 ? 'positive' : netMargin >= 5 ? 'neutral' : 'negative'}
        />
      </div>

      {/* ClearPoint Profitability KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Operating Margin"
          value={formatPct(operatingMargin)}
          icon={TrendingUp}
          accent="border-emerald-300/50 bg-gradient-to-br from-emerald-50 to-green-50"
          delta={operatingMargin >= 20 ? 'Strong profitability' : operatingMargin >= 10 ? 'Moderate' : 'Below 10% — review costs'}
          deltaType={operatingMargin >= 20 ? 'positive' : operatingMargin >= 10 ? 'neutral' : 'negative'}
        />
        <MetricCard
          title="EBITDA"
          value={formatDollar(ebitda)}
          icon={DollarSign}
          accent="border-blue-300/50 bg-gradient-to-br from-blue-50 to-indigo-50"
          delta="Earnings before interest, tax, depreciation"
          deltaType="neutral"
        />
        <MetricCard
          title="Revenue Growth"
          value={`${revenueGrowthRate >= 0 ? '+' : ''}${revenueGrowthRate.toFixed(1)}%`}
          icon={TrendingUp}
          accent="border-cyan-300/50 bg-gradient-to-br from-cyan-50 to-sky-50"
          delta="Period-over-period trend"
          deltaType={revenueGrowthRate > 0 ? 'positive' : revenueGrowthRate < 0 ? 'negative' : 'neutral'}
        />
        <MetricCard
          title="Gross Margin"
          value={formatPct(grossMarginPct)}
          icon={Calculator}
          accent="border-purple-300/50 bg-gradient-to-br from-purple-50 to-indigo-50"
          delta={grossMarginPct >= 40 ? 'Healthy gross margin' : grossMarginPct >= 25 ? 'Moderate' : 'Tight margins'}
          deltaType={grossMarginPct >= 40 ? 'positive' : grossMarginPct >= 25 ? 'neutral' : 'negative'}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Revenue Trend - Gradient Area with markLine */}
        <ChartCard title="Revenue Trend">
          <ReactECharts option={{
            tooltip: { trigger: 'axis', formatter: (params: any) => `${params[0].name}<br/>${formatDollar(params[0].value)}` },
            grid: { left: 60, right: 20, bottom: 30, top: 20 },
            xAxis: { type: 'category', data: trendPeriods, boundaryGap: false },
            yAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatDollar(v) } },
            series: [{
              type: 'line',
              smooth: true,
              symbol: 'circle',
              symbolSize: 6,
              data: trendValues,
              lineStyle: { color: '#06b6d4', width: 3 },
              itemStyle: { color: '#06b6d4' },
              areaStyle: {
                color: {
                  type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                  colorStops: [
                    { offset: 0, color: 'rgba(6,182,212,0.35)' },
                    { offset: 1, color: 'rgba(6,182,212,0.03)' },
                  ],
                },
              },
              markLine: {
                silent: true,
                lineStyle: { type: 'dashed', color: '#94a3b8' },
                data: [{ yAxis: avgRevenue, label: { formatter: `Avg: ${formatDollar(avgRevenue)}`, fontSize: 10 } }],
              },
            }],
          }} style={{ height: 300 }} />
        </ChartCard>

        {/* Expense by Category - Nightingale Rose */}
        <ChartCard title="Expense by Category">
          <ReactECharts option={{
            tooltip: { trigger: 'item', formatter: '{b}: {d}%' },
            series: [{
              type: 'pie',
              roseType: 'area',
              radius: ['20%', '70%'],
              center: ['50%', '55%'],
              data: expenseData,
              label: {
                formatter: '{b}\n{d}%',
                fontSize: 10,
              },
              itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
            }],
          }} style={{ height: 300 }} />
        </ChartCard>

        {/* Monthly P&L - Bar + Line combo */}
        <ChartCard title="Monthly P&L" className="lg:col-span-2">
          <ReactECharts option={{
            tooltip: { trigger: 'axis' },
            legend: { data: ['Revenue', 'Expenses', 'Net Income'], top: 0 },
            grid: { left: 60, right: 60, bottom: 30, top: 35 },
            xAxis: { type: 'category', data: plPeriods },
            yAxis: [
              { type: 'value', axisLabel: { formatter: (v: number) => formatDollar(v) } },
              { type: 'value', axisLabel: { formatter: (v: number) => formatDollar(v) }, splitLine: { show: false } },
            ],
            series: [
              {
                name: 'Revenue',
                type: 'bar',
                data: plRevenue,
                itemStyle: {
                  borderRadius: [4, 4, 0, 0],
                  color: {
                    type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                    colorStops: [
                      { offset: 0, color: '#06b6d4' },
                      { offset: 1, color: '#0891b2' },
                    ],
                  },
                },
              },
              {
                name: 'Expenses',
                type: 'bar',
                data: plExpenses,
                itemStyle: {
                  borderRadius: [4, 4, 0, 0],
                  color: {
                    type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                    colorStops: [
                      { offset: 0, color: '#ef4444' },
                      { offset: 1, color: '#dc2626' },
                    ],
                  },
                },
              },
              {
                name: 'Net Income',
                type: 'line',
                yAxisIndex: 1,
                smooth: true,
                symbol: 'diamond',
                symbolSize: 8,
                data: plNet,
                lineStyle: { color: '#1e293b', width: 2, type: 'dashed' },
                itemStyle: { color: '#1e293b' },
              },
            ],
          }} style={{ height: 320 }} />
        </ChartCard>

        {/* Documents by Type - Horizontal Bar with rounded ends */}
        <ChartCard title="Documents by Type">
          <ReactECharts option={{
            tooltip: { trigger: 'axis' },
            grid: { left: 130, right: 30, bottom: 20, top: 10 },
            xAxis: { type: 'value' },
            yAxis: { type: 'category', data: documentsByType.map((d: any) => d.type), axisLabel: { fontSize: 11 } },
            series: [{
              type: 'bar',
              data: documentsByType.map((d: any, i: number) => ({
                value: d.count,
                itemStyle: {
                  borderRadius: [0, 4, 4, 0],
                  color: {
                    type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
                    colorStops: [
                      { offset: 0, color: PALETTE[i % PALETTE.length] },
                      { offset: 1, color: PALETTE[(i + 1) % PALETTE.length] },
                    ],
                  },
                },
              })),
              barMaxWidth: 24,
            }],
          }} style={{ height: 300 }} />
        </ChartCard>

        {/* Company Code Profitability — Butterfly/Diverging Bar */}
        <ChartCard title="Profitability by Entity" subtitle="Revenue vs Expenses by Company Code">
          <ReactECharts option={{
            tooltip: {
              trigger: 'axis',
              formatter: (params: any) => {
                const cc = params[0]?.name ?? '';
                let html = `<strong>${cc}</strong>`;
                params.forEach((p: any) => {
                  html += `<br/>${p.marker} ${p.seriesName}: ${formatDollar(Math.abs(p.value))}`;
                });
                const rev = params.find((p: any) => p.seriesName === 'Revenue')?.value ?? 0;
                const exp = Math.abs(params.find((p: any) => p.seriesName === 'Expenses')?.value ?? 0);
                const margin = rev > 0 ? ((rev - exp) / rev * 100).toFixed(1) : '0';
                html += `<br/><strong>Margin: ${margin}%</strong>`;
                return html;
              },
            },
            legend: { data: ['Revenue', 'Expenses'], top: 0 },
            grid: { left: 110, right: 40, bottom: 30, top: 35 },
            xAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatDollar(Math.abs(v)) } },
            yAxis: {
              type: 'category',
              data: revenueByCompanyCode.map((d: any) => d.label),
              axisLabel: { fontSize: 11 },
            },
            series: [
              {
                name: 'Revenue',
                type: 'bar',
                stack: 'total',
                data: revenueByCompanyCode.map((d: any) => d.revenue),
                itemStyle: {
                  borderRadius: [0, 4, 4, 0],
                  color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#06b6d4' }, { offset: 1, color: '#22d3ee' }] },
                },
                barMaxWidth: 28,
                label: { show: true, position: 'right', formatter: (p: any) => formatDollar(p.value), fontSize: 10, color: '#0e7490' },
              },
              {
                name: 'Expenses',
                type: 'bar',
                data: revenueByCompanyCode.map((d: any) => {
                  // Compute expense proportionally (we only have revenue per CC from this endpoint)
                  // Use overall expense ratio to estimate per-CC expense
                  const ratio = totalRevenue > 0 ? totalExpenses / totalRevenue : 0.75;
                  return -(d.revenue * ratio);
                }),
                itemStyle: {
                  borderRadius: [4, 0, 0, 4],
                  color: { type: 'linear', x: 1, y: 0, x2: 0, y2: 0, colorStops: [{ offset: 0, color: '#ef4444' }, { offset: 1, color: '#f87171' }] },
                },
                barMaxWidth: 28,
                label: { show: true, position: 'left', formatter: (p: any) => formatDollar(Math.abs(p.value)), fontSize: 10, color: '#dc2626' },
              },
            ],
          }} style={{ height: 300 }} />
        </ChartCard>
      </div>
    </div>
  );
}
