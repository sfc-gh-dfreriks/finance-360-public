import { useFilters } from '@/hooks/useFilters';
import { useQuery } from '@/hooks/useQuery';
import { fetchCostCenters } from '@/lib/api';
import { formatDollar, formatNumber, formatPct } from '@/lib/utils';
import MetricCard, { PieChart, TrendingDown, Building2 } from '@/components/MetricCard';
import ChartCard from '@/components/ChartCard';
import DataTable from '@/components/DataTable';
import ReactECharts from '@/components/Chart';

const PALETTE = ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899'];
const ACCENTS = [
  'border-cyan-300/50 bg-gradient-to-br from-cyan-50 to-sky-50',
  'border-red-300/50 bg-gradient-to-br from-red-50 to-orange-50',
  'border-purple-300/50 bg-gradient-to-br from-purple-50 to-indigo-50',
];

const CC_NAMES: Record<string, string> = {
  CC1000: 'Executive Mgmt',
  CC1100: 'Finance & Acctg',
  CC1200: 'Human Resources',
  CC1300: 'Legal & Compliance',
  CC2000: 'Sales - Domestic',
  CC2100: 'Sales - Intl',
  CC2200: 'Marketing',
  CC3000: 'IT Operations',
  CC3100: 'IT Development',
  CC4000: 'Manufacturing',
  CC4100: 'Quality Assurance',
  CC4200: 'Supply Chain',
  CC5000: 'R&D',
  CC6000: 'Customer Support',
  CC7000: 'Facilities & Admin',
};

export default function CostCenters() {
  const { selectedCompanyCodes, selectedFiscalYears } = useFilters();
  const hasFilters = selectedCompanyCodes.length > 0 && selectedFiscalYears.length > 0;
  const { data, loading, error } = useQuery(
    () => hasFilters ? fetchCostCenters(selectedCompanyCodes, selectedFiscalYears) : Promise.resolve(null),
    [selectedCompanyCodes.join(','), selectedFiscalYears.join(',')]
  );

  if (!hasFilters) {
    return <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">Select at least one company code and fiscal year.</div>;
  }
  if (loading) return <div className="grid grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-gray-200" />)}</div>;
  if (error) return <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">Error: {error}</div>;
  if (!data || !data.kpis) return null;

  const { kpis: summary, topCostCenters: costCenterExpenses, byDepartment, monthlyTrend, detail } = data;

  // Transform flat monthlyTrend array into periods + series structure
  const trendFlat = monthlyTrend ?? [];
  const trendPeriodsAll = [...new Set(trendFlat.map((d: any) => d.period))] as string[];
  trendPeriodsAll.sort();
  const trendGroups = [...new Set(trendFlat.map((d: any) => d.costcenter))] as string[];
  const trendSeriesMap: Record<string, number[]> = {};
  trendGroups.forEach((cc) => {
    trendSeriesMap[cc] = trendPeriodsAll.map((p) => {
      const row = trendFlat.find((r: any) => r.period === p && r.costcenter === cc);
      return row?.amount ?? 0;
    });
  });

  // Compute period-over-period delta from monthlyTrend if available
  let expenseDelta: string | undefined;
  let expenseDeltaType: 'positive' | 'negative' | 'neutral' | undefined;
  if (trendPeriodsAll.length >= 2) {
    const lastPeriod = trendPeriodsAll[trendPeriodsAll.length - 1];
    const prevPeriod = trendPeriodsAll[trendPeriodsAll.length - 2];
    let lastTotal = 0;
    let prevTotal = 0;
    Object.values(trendSeriesMap).forEach((series: number[]) => {
      lastTotal += (series[trendPeriodsAll.indexOf(lastPeriod)] || 0);
      prevTotal += (series[trendPeriodsAll.indexOf(prevPeriod)] || 0);
    });
    if (prevTotal > 0) {
      const pct = ((lastTotal - prevTotal) / prevTotal) * 100;
      expenseDelta = `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
      expenseDeltaType = pct > 0 ? 'negative' : pct < 0 ? 'positive' : 'neutral';
    }
  }

  // Top 5 for radar and trend
  const top5 = (costCenterExpenses ?? []).slice(0, 5);
  const top5CCs = top5.map((d: any) => d.costcenter);

  // Radar data: compute varied metrics per cost center from monthly trend
  // Metrics: Peak Month Spend, Volatility (std dev), Growth Rate, Period Count, Avg Monthly
  const ccMonthlyMap = new Map<string, number[]>();
  (trendFlat ?? []).forEach((r: any) => {
    const arr = ccMonthlyMap.get(r.costcenter) || [];
    arr.push(r.amount || 0);
    ccMonthlyMap.set(r.costcenter, arr);
  });

  const computeStdDev = (values: number[]) => {
    if (values.length < 2) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
    return Math.sqrt(variance);
  };

  const computeGrowth = (values: number[]) => {
    if (values.length < 2) return 0;
    const first = values.slice(0, 3).reduce((a, b) => a + b, 0) / Math.min(3, values.length);
    const last = values.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, values.length);
    return first > 0 ? ((last - first) / first) * 100 : 0;
  };

  const radarMetrics = top5.map((d: any) => {
    const monthly = ccMonthlyMap.get(d.costcenter) || [];
    const peak = monthly.length > 0 ? Math.max(...monthly) : 0;
    const volatility = computeStdDev(monthly);
    const growth = computeGrowth(monthly);
    const periodCount = monthly.length;
    const avgMonthly = monthly.length > 0 ? monthly.reduce((a, b) => a + b, 0) / monthly.length : 0;
    return { peak, volatility, growth: Math.abs(growth), growthRaw: growth, periodCount, avgMonthly };
  });

  const maxPeak = Math.max(...radarMetrics.map((m: any) => m.peak), 1);
  const maxVolatility = Math.max(...radarMetrics.map((m: any) => m.volatility), 1);
  const maxGrowth = Math.max(...radarMetrics.map((m: any) => m.growth), 1);
  const maxPeriods = Math.max(...radarMetrics.map((m: any) => m.periodCount), 1);
  const maxAvgMonthly = Math.max(...radarMetrics.map((m: any) => m.avgMonthly), 1);

  const radarOption = {
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        const values = params.value;
        return `<strong>${params.name}</strong><br/>
          Peak Month: ${formatDollar(values[0])}<br/>
          Volatility: ${formatDollar(values[1])}<br/>
          Growth: ${values[2].toFixed(1)}%<br/>
          Active Periods: ${values[3]}<br/>
          Avg Monthly: ${formatDollar(values[4])}`;
      },
    },
    legend: { data: top5.map((d: any) => CC_NAMES[d.costcenter] || d.costcenter), top: 0, textStyle: { fontSize: 10 } },
    radar: {
      indicator: [
        { name: 'Peak Month', max: maxPeak },
        { name: 'Volatility', max: maxVolatility },
        { name: 'Growth %', max: maxGrowth || 100 },
        { name: 'Active Periods', max: maxPeriods },
        { name: 'Avg Monthly', max: maxAvgMonthly },
      ],
      shape: 'polygon',
      splitNumber: 4,
      axisName: { fontSize: 10, color: '#6b7280' },
    },
    series: [{
      type: 'radar',
      data: top5.map((d: any, i: number) => {
        const m = radarMetrics[i];
        return {
          name: CC_NAMES[d.costcenter] || d.costcenter,
          value: [m.peak, m.volatility, m.growth, m.periodCount, m.avgMonthly],
          lineStyle: { color: PALETTE[i % PALETTE.length], width: 2 },
          itemStyle: { color: PALETTE[i % PALETTE.length] },
          areaStyle: { color: PALETTE[i % PALETTE.length], opacity: 0.15 },
        };
      }),
    }],
  };

  // Treemap by department
  const deptTotal = (byDepartment ?? []).reduce((sum: number, d: any) => sum + (d.total || 0), 0);
  const treemapOption = {
    tooltip: {
      formatter: (params: any) => {
        const pct = deptTotal > 0 ? ((params.value / deptTotal) * 100).toFixed(1) : '0';
        return `<strong>${params.name}</strong><br/>${formatDollar(params.value)}<br/>${pct}% of total`;
      },
    },
    series: [{
      type: 'treemap',
      roam: false,
      nodeClick: false,
      breadcrumb: { show: false },
      label: {
        show: true,
        formatter: (params: any) => {
          const pct = deptTotal > 0 ? ((params.value / deptTotal) * 100).toFixed(1) : '0';
          return `{name|${params.name}}\n{pct|${pct}%}\n{amt|${formatDollar(params.value)}}`;
        },
        rich: {
          name: { fontSize: 13, fontWeight: 'bold', color: '#fff', lineHeight: 20 },
          pct: { fontSize: 16, fontWeight: 'bold', color: '#fff', lineHeight: 22 },
          amt: { fontSize: 10, color: 'rgba(255,255,255,0.8)', lineHeight: 16 },
        },
        verticalAlign: 'middle',
      },
      upperLabel: { show: false },
      itemStyle: { borderColor: '#fff', borderWidth: 2, gapWidth: 2 },
      levels: [{
        itemStyle: { borderColor: '#fff', borderWidth: 3, gapWidth: 3 },
      }],
      data: (byDepartment ?? []).map((d: any, i: number) => ({
        name: d.department,
        value: d.total,
        itemStyle: {
          color: PALETTE[i % PALETTE.length],
          borderRadius: 4,
        },
      })),
    }],
  };

  // Monthly trend with gradient area fills
  const trendPeriods = trendPeriodsAll;
  const trendSeries = top5CCs.map((cc: string, i: number) => {
    const seriesData = trendSeriesMap[cc] ?? [];
    const maxVal = Math.max(...seriesData, 0);
    const maxIdx = seriesData.indexOf(maxVal);
    return {
      name: CC_NAMES[cc] || cc,
      type: 'line',
      smooth: true,
      data: seriesData,
      color: PALETTE[i % PALETTE.length],
      areaStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: PALETTE[i % PALETTE.length] + '40' },
            { offset: 1, color: PALETTE[i % PALETTE.length] + '05' },
          ],
        },
      },
      markPoint: maxVal > 0 ? {
        data: [{ coord: [maxIdx, maxVal], value: formatDollar(maxVal), symbol: 'pin', symbolSize: 40, itemStyle: { color: PALETTE[i % PALETTE.length] } }],
        label: { fontSize: 9 },
      } : undefined,
    };
  });

  const trendOption = {
    tooltip: { trigger: 'axis' },
    legend: { data: top5CCs.map((cc: string) => CC_NAMES[cc] || cc), top: 0 },
    grid: { top: 40, bottom: 30, left: 60, right: 20 },
    xAxis: { type: 'category', data: trendPeriods },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatDollar(v) } },
    series: trendSeries,
  };

  // Detail table with CC name enrichment
  const enrichedDetail = (detail ?? []).map((row: any) => ({
    ...row,
    name: CC_NAMES[row.costcenter] || row.costcenter,
  }));

  const columns = [
    { key: 'costcenter', label: 'Cost Center' },
    { key: 'name', label: 'Name' },
    { key: 'fiscalyear', label: 'Fiscal Year' },
    { key: 'total', label: 'Total Expense', format: (v: number) => formatDollar(v) },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard title="Active Cost Centers" value={formatNumber(summary.costCenterCount)} icon={Building2} accent={ACCENTS[0]} />
        <MetricCard title="Total Expenses" value={formatDollar(summary.totalExpense)} icon={TrendingDown} accent={ACCENTS[1]} delta={expenseDelta} deltaType={expenseDeltaType} />
        <MetricCard title="Avg per Center" value={formatDollar(summary.avgExpense)} icon={PieChart} accent={ACCENTS[2]} />
      </div>

      {/* ClearPoint Cost Efficiency KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          title="SG&A % of Spend"
          value={formatPct((() => {
            const sgaDepts = ['EXEC', 'FIN', 'HR', 'LEGAL', 'ADMIN', 'MKT', 'SALES'];
            const sgaTotal = (byDepartment ?? []).filter((d: any) => sgaDepts.includes(d.department)).reduce((s: number, d: any) => s + (d.total || 0), 0);
            const allTotal = (byDepartment ?? []).reduce((s: number, d: any) => s + (d.total || 0), 0);
            return allTotal > 0 ? (sgaTotal / allTotal) * 100 : 0;
          })())}
          icon={PieChart}
          accent="border-blue-300/50 bg-gradient-to-br from-blue-50 to-indigo-50"
          delta="Selling, General & Admin overhead"
          deltaType="neutral"
        />
        <MetricCard
          title="Workforce Cost %"
          value={formatPct((() => {
            const workforceDepts = ['HR', 'EXEC'];
            const wfTotal = (byDepartment ?? []).filter((d: any) => workforceDepts.includes(d.department)).reduce((s: number, d: any) => s + (d.total || 0), 0);
            const allTotal = (byDepartment ?? []).reduce((s: number, d: any) => s + (d.total || 0), 0);
            return allTotal > 0 ? (wfTotal / allTotal) * 100 : 0;
          })())}
          icon={Building2}
          accent="border-emerald-300/50 bg-gradient-to-br from-emerald-50 to-green-50"
          delta="HR + Executive as % of total"
          deltaType="neutral"
        />
        <MetricCard
          title="Production Cost %"
          value={formatPct((() => {
            const prodDepts = ['PROD', 'SCM', 'QA', 'MFG'];
            const prodTotal = (byDepartment ?? []).filter((d: any) => prodDepts.includes(d.department)).reduce((s: number, d: any) => s + (d.total || 0), 0);
            const allTotal = (byDepartment ?? []).reduce((s: number, d: any) => s + (d.total || 0), 0);
            return allTotal > 0 ? (prodTotal / allTotal) * 100 : 0;
          })())}
          icon={TrendingDown}
          accent="border-amber-300/50 bg-gradient-to-br from-amber-50 to-yellow-50"
          delta="Direct production-related costs"
          deltaType="neutral"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Cost Center Performance Profile">
          <ReactECharts option={radarOption} style={{ height: 320 }} />
        </ChartCard>

        <ChartCard title="Expense by Department">
          <ReactECharts option={treemapOption} style={{ height: 320 }} />
        </ChartCard>

        <ChartCard title="Monthly Expense Trend (Top 5)" className="lg:col-span-2">
          <ReactECharts option={trendOption} style={{ height: 320 }} />
        </ChartCard>
      </div>

      {/* Detail Table */}
      <ChartCard title="Cost Center Detail">
        <DataTable columns={columns} data={enrichedDetail} />
      </ChartCard>
    </div>
  );
}
