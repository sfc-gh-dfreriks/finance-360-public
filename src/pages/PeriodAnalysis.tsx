import { useFilters } from '@/hooks/useFilters';
import { useQuery } from '@/hooks/useQuery';
import { fetchPeriodAnalysis } from '@/lib/api';
import { formatDollar, formatPct, formatNumber } from '@/lib/utils';
import MetricCard, { Calendar, DollarSign, TrendingUp, FileText } from '@/components/MetricCard';
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

export default function PeriodAnalysis() {
  const { selectedCompanyCodes, selectedFiscalYears } = useFilters();
  const hasFilters = selectedCompanyCodes.length > 0 && selectedFiscalYears.length > 0;
  const { data, loading, error } = useQuery(
    () => hasFilters ? fetchPeriodAnalysis(selectedCompanyCodes, selectedFiscalYears) : Promise.resolve(null),
    [selectedCompanyCodes.join(','), selectedFiscalYears.join(',')]
  );

  if (!hasFilters) {
    return <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">Select at least one company code and fiscal year.</div>;
  }
  if (loading) return <div className="grid grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-gray-200" />)}</div>;
  if (error) return <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">Error: {error}</div>;
  if (!data || !data.monthlySummary) return null;

  const { monthlySummary, yoyRevenue, heatmap: heatmapData } = data;

  // Compute KPIs from monthlySummary
  const sortedPeriods = (monthlySummary ?? []).slice().sort((a: any, b: any) => {
    const aKey = `${a.fiscalyear}-${String(a.fiscalperiod).padStart(2, '0')}`;
    const bKey = `${b.fiscalyear}-${String(b.fiscalperiod).padStart(2, '0')}`;
    return aKey.localeCompare(bKey);
  });
  const latestPeriod = sortedPeriods.length > 0 ? sortedPeriods[sortedPeriods.length - 1] : null;
  const prevPeriod = sortedPeriods.length > 1 ? sortedPeriods[sortedPeriods.length - 2] : null;

  const latestRevenue = latestPeriod?.revenue || 0;
  const latestExpenses = latestPeriod?.expenses || 0;
  const latestDocs = latestPeriod?.docCount || 0;
  const prevRevenue = prevPeriod?.revenue || 0;
  const prevExpenses = prevPeriod?.expenses || 0;
  const revenueMoM = prevRevenue > 0 ? ((latestRevenue - prevRevenue) / prevRevenue) : 0;
  const expensesMoM = prevExpenses > 0 ? ((latestExpenses - prevExpenses) / prevExpenses) : 0;

  // Last 6 months sparkline data
  const revenueSparkline = sortedPeriods.slice(-6).map((d: any) => d.revenue || 0);

  // MoM change for lollipop chart
  const momData: { period: string; change: number }[] = sortedPeriods.slice(1).map((d: any, i: number) => {
    const prev = sortedPeriods[i];
    const change = prev.revenue > 0 ? d.revenue - prev.revenue : 0;
    return { period: `${d.fiscalyear}-P${d.fiscalperiod}`, change };
  });

  // Revenue vs expenses periods
  const revExpPeriods = sortedPeriods.map((d: any) => `${d.fiscalyear}-P${d.fiscalperiod}`);
  const revenueData = sortedPeriods.map((d: any) => d.revenue || 0);
  const expensesData = sortedPeriods.map((d: any) => d.expenses || 0);
  const netIncomeData = sortedPeriods.map((d: any) => (d.revenue || 0) - (d.expenses || 0));

  // YoY data
  const yoyYears = [...new Set((yoyRevenue ?? []).map((d: any) => d.fiscalyear))] as string[];
  yoyYears.sort();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Build heatmap
  const heatYears = [...new Set((heatmapData ?? []).map((d: any) => String(d.fiscalyear)))].sort();
  const heatValues: number[][] = [];
  let heatMin = Infinity;
  let heatMax = -Infinity;
  (heatmapData ?? []).forEach((d: any) => {
    const yIdx = heatYears.indexOf(String(d.fiscalyear));
    const mIdx = (parseInt(String(d.fiscalperiod), 10) || 1) - 1;
    if (yIdx >= 0 && mIdx >= 0) {
      heatValues.push([mIdx, yIdx, d.revenue || 0]);
      if (d.revenue < heatMin) heatMin = d.revenue;
      if (d.revenue > heatMax) heatMax = d.revenue;
    }
  });
  if (heatMin === Infinity) heatMin = 0;
  if (heatMax === -Infinity) heatMax = 1;

  // Period table
  const tableData = sortedPeriods.map((d: any) => ({
    period: `${d.fiscalyear}-P${String(d.fiscalperiod).padStart(2, '0')}`,
    revenue: d.revenue || 0,
    expenses: d.expenses || 0,
    netIncome: (d.revenue || 0) - (d.expenses || 0),
    documents: d.docCount || 0,
  }));

  const columns = [
    { key: 'period', label: 'Period' },
    { key: 'revenue', label: 'Revenue', format: (v: number) => formatDollar(v) },
    { key: 'expenses', label: 'Expenses', format: (v: number) => formatDollar(v) },
    { key: 'netIncome', label: 'Net Income', format: (v: number) => formatDollar(v) },
    { key: 'documents', label: 'Documents', format: (v: number) => formatNumber(v) },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Latest Period"
          value={latestPeriod ? `${latestPeriod.fiscalyear}-P${latestPeriod.fiscalperiod}` : '—'}
          icon={Calendar}
          accent={ACCENTS[0]}
        />
        <MetricCard
          title="Revenue"
          value={formatDollar(latestRevenue)}
          icon={DollarSign}
          accent={ACCENTS[1]}
          delta={`${revenueMoM >= 0 ? '+' : ''}${formatPct(revenueMoM)} MoM`}
          deltaType={revenueMoM >= 0 ? 'positive' : 'negative'}
          trend={revenueSparkline}
        />
        <MetricCard
          title="Expenses"
          value={formatDollar(latestExpenses)}
          icon={TrendingUp}
          accent={ACCENTS[2]}
          delta={`${expensesMoM >= 0 ? '+' : ''}${formatPct(expensesMoM)} MoM`}
          deltaType={expensesMoM <= 0 ? 'positive' : 'negative'}
        />
        <MetricCard title="Documents" value={formatNumber(latestDocs)} icon={FileText} accent={ACCENTS[3]} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Revenue vs Expenses — Gradient area with profit/loss zones (full width) */}
        <ChartCard title="Revenue vs Expenses" className="lg:col-span-2">
          <ReactECharts option={{
            tooltip: { trigger: 'axis' },
            legend: { data: ['Revenue', 'Expenses', 'Net Income'], bottom: 0 },
            grid: { left: 60, right: 40, top: 20, bottom: 40 },
            xAxis: { type: 'category', data: revExpPeriods, boundaryGap: false },
            yAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatDollar(v) } },
            series: [
              {
                name: 'Revenue',
                type: 'line',
                data: revenueData,
                smooth: true,
                lineStyle: { width: 2, color: '#10b981' },
                itemStyle: { color: '#10b981' },
                areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(16,185,129,0.25)' }, { offset: 1, color: 'rgba(16,185,129,0)' }] } },
              },
              {
                name: 'Expenses',
                type: 'line',
                data: expensesData,
                smooth: true,
                lineStyle: { width: 2, color: '#ef4444' },
                itemStyle: { color: '#ef4444' },
                areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(239,68,68,0.15)' }, { offset: 1, color: 'rgba(239,68,68,0)' }] } },
              },
              {
                name: 'Net Income',
                type: 'line',
                data: netIncomeData,
                smooth: true,
                lineStyle: { width: 2, type: 'dashed', color: '#1e3a5f' },
                itemStyle: { color: '#1e3a5f' },
              },
            ],
          }} style={{ height: 300 }} />
        </ChartCard>

        {/* YoY Revenue — Multi-line */}
        <ChartCard title="YoY Revenue Comparison">
          <ReactECharts option={{
            tooltip: { trigger: 'axis' },
            legend: { data: yoyYears, bottom: 0 },
            grid: { left: 60, right: 20, top: 20, bottom: 40 },
            xAxis: { type: 'category', data: months },
            yAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatDollar(v) } },
            series: yoyYears.map((year: string, i: number) => {
              const yearData = (yoyRevenue ?? []).filter((d: any) => d.fiscalyear === year).sort((a: any, b: any) => String(a.fiscalperiod).localeCompare(String(b.fiscalperiod)));
              const values = Array.from({ length: 12 }, (_, m) => {
                const match = yearData.find((d: any) => parseInt(String(d.fiscalperiod), 10) === m + 1);
                return match ? match.revenue : null;
              });
              const isLatest = i === yoyYears.length - 1;
              return {
                name: year,
                type: 'line',
                data: values,
                smooth: true,
                lineStyle: { width: isLatest ? 3 : 1.5, type: isLatest ? 'solid' : 'solid' },
                itemStyle: { color: PALETTE[i % PALETTE.length] },
                emphasis: { lineStyle: { width: 3 } },
              };
            }),
          }} style={{ height: 280 }} />
        </ChartCard>

        {/* MoM Revenue Change → Lollipop chart */}
        <ChartCard title="MoM Revenue Change">
          <ReactECharts option={{
            tooltip: { trigger: 'axis', formatter: (params: any) => `${params[0].name}: ${formatDollar(params[0].value)}` },
            grid: { left: 60, right: 20, top: 20, bottom: 30 },
            xAxis: { type: 'category', data: momData.map((d) => d.period), axisLabel: { rotate: 45, fontSize: 10 } },
            yAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatDollar(v) } },
            series: [
              {
                type: 'bar',
                barWidth: 2,
                data: momData.map((d) => ({
                  value: d.change,
                  itemStyle: { color: d.change >= 0 ? '#10b981' : '#ef4444' },
                })),
                silent: true,
              },
              {
                type: 'scatter',
                symbolSize: 10,
                data: momData.map((d) => ({
                  value: d.change,
                  itemStyle: { color: d.change >= 0 ? '#10b981' : '#ef4444' },
                })),
              },
            ],
          }} style={{ height: 280 }} />
        </ChartCard>

        {/* Revenue Heatmap — Improved */}
        <ChartCard title="Revenue Heatmap" className="lg:col-span-2">
          <ReactECharts option={{
            tooltip: {
              formatter: (params: any) => {
                const [m, y, v] = params.data;
                return `${months[m]} ${heatYears[y]}: ${formatDollar(v)}`;
              },
            },
            grid: { left: 80, right: 40, top: 20, bottom: 80 },
            xAxis: { type: 'category', data: months, splitArea: { show: true } },
            yAxis: { type: 'category', data: heatYears, splitArea: { show: true } },
            visualMap: {
              min: heatMin,
              max: heatMax,
              calculable: true,
              orient: 'horizontal',
              left: 'center',
              bottom: 10,
              itemWidth: 14,
              itemHeight: 140,
              text: [formatDollar(heatMax), formatDollar(heatMin)],
              textStyle: { fontSize: 10 },
              inRange: { color: ['#e0f2fe', '#0284c7', '#1e3a5f'] },
            },
            series: [{
              type: 'heatmap',
              data: heatValues,
              label: { show: true, formatter: (p: any) => formatDollar(p.data[2]), fontSize: 9, color: '#334155' },
              emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.3)' } },
            }],
          }} style={{ height: 360 }} />
        </ChartCard>
      </div>

      {/* Period Summary Table */}
      <ChartCard title="Period Summary">
        <DataTable columns={columns} data={tableData} />
      </ChartCard>
    </div>
  );
}
