import { useFilters } from '@/hooks/useFilters';
import { useQuery } from '@/hooks/useQuery';
import { fetchProfitCenters } from '@/lib/api';
import { formatDollar, formatPct, formatNumber } from '@/lib/utils';
import MetricCard, { DollarSign, TrendingUp, Building2, Calculator, Gauge } from '@/components/MetricCard';
import ChartCard from '@/components/ChartCard';
import DataTable from '@/components/DataTable';
import ReactECharts from '@/components/Chart';

const PALETTE = ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899'];
const ACCENTS = [
  'border-cyan-300/50 bg-gradient-to-br from-cyan-50 to-sky-50',
  'border-emerald-300/50 bg-gradient-to-br from-emerald-50 to-green-50',
  'border-purple-300/50 bg-gradient-to-br from-purple-50 to-indigo-50',
  'border-amber-300/50 bg-gradient-to-br from-amber-50 to-yellow-50',
];

const PC_NAMES: Record<string, string> = {
  PC1000: 'Corporate Services',
  PC2000: 'Products - Domestic',
  PC2100: 'Products - International',
  PC3000: 'Technology Services',
  PC4000: 'Manufacturing Ops',
  PC5000: 'Innovation & R&D',
};

export default function ProfitCenters() {
  const { selectedCompanyCodes, selectedFiscalYears } = useFilters();
  const hasFilters = selectedCompanyCodes.length > 0 && selectedFiscalYears.length > 0;
  const { data, loading, error } = useQuery(
    () => hasFilters ? fetchProfitCenters(selectedCompanyCodes, selectedFiscalYears) : Promise.resolve(null),
    [selectedCompanyCodes.join(','), selectedFiscalYears.join(',')]
  );

  if (!hasFilters) {
    return <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">Select at least one company code and fiscal year.</div>;
  }
  if (loading) return <div className="grid grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-gray-200" />)}</div>;
  if (error) return <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">Error: {error}</div>;
  if (!data || !data.kpis) return null;

  const { kpis: summary, revenueByPC, revenueBySegment, monthlyRevenueTrend, comparison } = data;

  // Compute margin KPIs
  const totalRevenue = summary.totalRevenue || 0;
  const totalExpense = summary.totalExpense || 0;
  const grossMargin = totalRevenue - totalExpense;
  const marginPct = totalRevenue > 0 ? (grossMargin / totalRevenue) * 100 : 0;
  const marginDeltaType: 'positive' | 'negative' | 'neutral' = marginPct >= 30 ? 'positive' : marginPct >= 15 ? 'neutral' : 'negative';

  // Gauge chart for overall margin %
  const gaugeOption = {
    series: [{
      type: 'gauge',
      startAngle: 200,
      endAngle: -20,
      min: 0,
      max: 50,
      center: ['50%', '60%'],
      radius: '85%',
      progress: {
        show: true,
        width: 24,
        roundCap: true,
        itemStyle: {
          color: marginPct >= 30 ? '#10b981' : marginPct >= 15 ? '#f59e0b' : '#ef4444',
        },
      },
      pointer: {
        show: true,
        length: '50%',
        width: 5,
        offsetCenter: [0, '-10%'],
        itemStyle: { color: '#334155' },
      },
      axisLine: {
        roundCap: true,
        lineStyle: {
          width: 24,
          color: [[0.3, '#fecaca'], [0.6, '#fef3c7'], [1, '#d1fae5']],
        },
      },
      axisTick: { show: false },
      splitLine: {
        distance: -28,
        length: 28,
        lineStyle: { width: 2, color: '#fff' },
      },
      axisLabel: {
        distance: -18,
        fontSize: 10,
        color: '#6b7280',
        formatter: (v: number) => {
          if (v === 0) return '0%';
          if (v === 15) return '15%';
          if (v === 30) return '30%';
          if (v === 50) return '50%';
          return '';
        },
      },
      anchor: {
        show: true,
        size: 14,
        showAbove: true,
        itemStyle: { borderWidth: 3, borderColor: '#334155', color: '#fff' },
      },
      title: {
        show: true,
        offsetCenter: [0, '35%'],
        fontSize: 12,
        color: '#6b7280',
      },
      detail: {
        valueAnimation: true,
        fontSize: 28,
        fontWeight: 'bold',
        offsetCenter: [0, '10%'],
        formatter: `{value}%`,
        color: marginPct >= 30 ? '#10b981' : marginPct >= 15 ? '#f59e0b' : '#ef4444',
      },
      data: [{ value: Math.round(marginPct * 10) / 10, name: marginPct >= 30 ? 'Healthy' : marginPct >= 15 ? 'Moderate' : 'Low' }],
    }],
  };

  // Dual-axis revenue + margin by PC
  const enrichedComparison = (comparison ?? []).map((row: any) => ({
    ...row,
    name: PC_NAMES[row.profitcenter] || row.profitcenter,
    marginPct: row.revenue > 0 ? ((row.revenue - row.expense) / row.revenue) * 100 : 0,
  }));

  const dualAxisOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
    legend: { data: ['Revenue', 'Margin %'], top: 0 },
    grid: { top: 40, bottom: 30, left: 60, right: 60 },
    xAxis: {
      type: 'category',
      data: enrichedComparison.map((d: any) => d.name),
      axisLabel: { rotate: 20, fontSize: 10 },
    },
    yAxis: [
      { type: 'value', name: 'Revenue', axisLabel: { formatter: (v: number) => formatDollar(v) } },
      { type: 'value', name: 'Margin %', min: 0, max: 60, axisLabel: { formatter: '{value}%' } },
    ],
    series: [
      {
        name: 'Revenue',
        type: 'bar',
        data: enrichedComparison.map((d: any, i: number) => ({ value: d.revenue, itemStyle: { color: PALETTE[i % PALETTE.length] } })),
      },
      {
        name: 'Margin %',
        type: 'line',
        yAxisIndex: 1,
        data: enrichedComparison.map((d: any) => d.marginPct.toFixed(1)),
        smooth: true,
        lineStyle: { width: 3, color: '#f59e0b' },
        itemStyle: { color: '#f59e0b' },
        symbol: 'circle',
        symbolSize: 8,
      },
    ],
  };

  // Sunburst / nightingale rose for segment
  const segmentTotal = (revenueBySegment ?? []).reduce((sum: number, d: any) => sum + (d.revenue || 0), 0);
  const sunburstOption = {
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        const pct = segmentTotal > 0 ? ((params.value / segmentTotal) * 100).toFixed(1) : '0';
        return `${params.name}<br/>${formatDollar(params.value)}<br/>${pct}%`;
      },
    },
    series: [{
      type: 'pie',
      roseType: 'area',
      radius: ['20%', '70%'],
      itemStyle: { borderRadius: 6 },
      label: { formatter: '{b}\n{d}%', fontSize: 11 },
      data: (revenueBySegment ?? []).map((d: any, i: number) => ({
        name: d.segment,
        value: d.revenue,
        itemStyle: { color: PALETTE[i % PALETTE.length] },
      })),
    }],
  };

  // Monthly revenue trend with gradient area fills
  // Transform flat array [{period, profitcenter, revenue}] into periods + series
  const trendFlat = monthlyRevenueTrend ?? [];
  const trendPeriods = [...new Set(trendFlat.map((d: any) => d.period))] as string[];
  trendPeriods.sort();
  const trendCenters = [...new Set(trendFlat.map((d: any) => d.profitcenter))] as string[];
  const trendSeriesMap: Record<string, number[]> = {};
  trendCenters.forEach((pc) => {
    trendSeriesMap[pc] = trendPeriods.map((p) => {
      const row = trendFlat.find((r: any) => r.period === p && r.profitcenter === pc);
      return row?.revenue ?? 0;
    });
  });

  const trendSeries = trendCenters.slice(0, 5).map((pc, i) => {
    const seriesData = trendSeriesMap[pc] ?? [];
    return {
      name: PC_NAMES[pc] || pc,
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
    };
  });

  const trendOption = {
    tooltip: { trigger: 'axis' },
    legend: { data: trendCenters.slice(0, 5).map((pc) => PC_NAMES[pc] || pc), top: 0 },
    grid: { top: 40, bottom: 30, left: 60, right: 20 },
    xAxis: { type: 'category', data: trendPeriods },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatDollar(v) } },
    series: trendSeries,
  };

  // Comparison table with margin coloring
  const tableData = enrichedComparison.map((row: any) => ({
    ...row,
    marginBar: row.marginPct,
  }));

  const columns = [
    { key: 'profitcenter', label: 'Profit Center' },
    { key: 'name', label: 'Name' },
    { key: 'revenue', label: 'Revenue', format: (v: number) => formatDollar(v) },
    { key: 'expense', label: 'Expense', format: (v: number) => formatDollar(v) },
    { key: 'marginPct', label: 'Margin %', format: (v: number) => formatPct(v) },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Active PCs" value={formatNumber(summary.profitCenterCount)} icon={Building2} accent={ACCENTS[0]} />
        <MetricCard title="Total Revenue" value={formatDollar(totalRevenue)} icon={DollarSign} accent={ACCENTS[1]} />
        <MetricCard title="Gross Margin" value={formatDollar(grossMargin)} icon={TrendingUp} accent={ACCENTS[2]} />
        <MetricCard title="Margin %" value={formatPct(marginPct)} icon={Calculator} accent={ACCENTS[3]} deltaType={marginDeltaType} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Overall Margin %">
          <ReactECharts option={gaugeOption} style={{ height: 260 }} />
        </ChartCard>

        <ChartCard title="Revenue + Margin by Profit Center">
          <ReactECharts option={dualAxisOption} style={{ height: 320 }} />
        </ChartCard>

        <ChartCard title="Revenue by Segment">
          <ReactECharts option={sunburstOption} style={{ height: 320 }} />
        </ChartCard>

        {/* Profit Center Health Scorecard — RAG status per Domo best practices */}
        <ChartCard title="PC Health Scorecard" subtitle="Revenue contribution vs target (equal share)">
          <ReactECharts option={{
            tooltip: {
              trigger: 'axis',
              formatter: (params: any) => {
                const p = params[0];
                const target = totalRevenue / Math.max(enrichedComparison.length, 1);
                const pct = target > 0 ? ((p.value / target) * 100).toFixed(0) : '0';
                return `<strong>${p.name}</strong><br/>Revenue: ${formatDollar(p.value)}<br/>Target: ${formatDollar(target)}<br/>Attainment: ${pct}%`;
              },
            },
            grid: { left: 130, right: 60, top: 10, bottom: 20 },
            xAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatDollar(v) } },
            yAxis: {
              type: 'category',
              data: enrichedComparison.map((d: any) => d.name).reverse(),
              axisLabel: { fontSize: 10 },
            },
            series: [
              {
                type: 'bar',
                data: enrichedComparison.map((d: any) => {
                  const target = totalRevenue / Math.max(enrichedComparison.length, 1);
                  const attainment = target > 0 ? d.revenue / target : 0;
                  const color = attainment >= 1.1 ? '#10b981' : attainment >= 0.9 ? '#f59e0b' : '#ef4444';
                  return { value: d.revenue, itemStyle: { color, borderRadius: [0, 4, 4, 0] } };
                }).reverse(),
                barMaxWidth: 20,
                label: {
                  show: true,
                  position: 'right',
                  formatter: (p: any) => {
                    const target = totalRevenue / Math.max(enrichedComparison.length, 1);
                    const pct = target > 0 ? ((p.value / target) * 100).toFixed(0) : '0';
                    return `${pct}%`;
                  },
                  fontSize: 10,
                  fontWeight: 'bold',
                },
              },
            ],
            ...(enrichedComparison.length > 0 ? {
              markLine: undefined,
            } : {}),
          }} style={{ height: 320 }} />
          <div className="mt-2 flex items-center gap-4 text-[10px] text-gray-500">
            <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Above target (&gt;110%)</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-500" /> On target (90-110%)</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-500" /> Below target (&lt;90%)</span>
          </div>
        </ChartCard>

        <ChartCard title="Monthly Revenue Trend" className="lg:col-span-2">
          <ReactECharts option={trendOption} style={{ height: 320 }} />
        </ChartCard>
      </div>

      {/* Comparison Table */}
      <ChartCard title="Profit Center Comparison">
        <DataTable columns={columns} data={tableData} />
      </ChartCard>
    </div>
  );
}
