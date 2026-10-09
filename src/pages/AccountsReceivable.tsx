import { useState } from 'react';
import { useFilters } from '@/hooks/useFilters';
import { useQuery } from '@/hooks/useQuery';
import { fetchAccountsReceivable, fetchOverdueInvoices } from '@/lib/api';
import { formatDollar, formatPct, formatNumber } from '@/lib/utils';
import MetricCard, { DollarSign, Calendar, TrendingUp, CreditCard, Activity, TrendingDown } from '@/components/MetricCard';
import ChartCard from '@/components/ChartCard';
import DataTable from '@/components/DataTable';
import ReactECharts from '@/components/Chart';

const PALETTE = ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899'];
const AGING_ORDER = ['Current', '1-30 Days', '31-60 Days', '61-90 Days', '91-120 Days', '120+ Days'];
const AGING_COLORS: Record<string, string> = {
  'Current': '#10b981',
  '1-30 Days': '#06b6d4',
  '31-60 Days': '#3b82f6',
  '61-90 Days': '#f59e0b',
  '91-120 Days': '#f97316',
  '120+ Days': '#ef4444',
};
const COLLECTION_RATES: Record<string, number> = {
  'Current': 0.995,
  '1-30 Days': 0.995,
  '31-60 Days': 0.95,
  '61-90 Days': 0.92,
  '91-120 Days': 0.88,
  '120+ Days': 0.85,
};

const ACCENTS = [
  'border-cyan-300/50 bg-gradient-to-br from-cyan-50 to-sky-50',
  'border-emerald-300/50 bg-gradient-to-br from-emerald-50 to-green-50',
  'border-red-300/50 bg-gradient-to-br from-red-50 to-orange-50',
  'border-purple-300/50 bg-gradient-to-br from-purple-50 to-indigo-50',
  'border-amber-300/50 bg-gradient-to-br from-amber-50 to-yellow-50',
  'border-blue-300/50 bg-gradient-to-br from-blue-50 to-indigo-50',
];

const PERF_COLORS: Record<string, string> = {
  'On Time': '#10b981',
  'Late': '#f59e0b',
  'Not Yet Due': '#06b6d4',
  'Overdue': '#ef4444',
};

export default function AccountsReceivable() {
  const { selectedCompanyCodes, selectedFiscalYears } = useFilters();
  const hasFilters = selectedCompanyCodes.length > 0 && selectedFiscalYears.length > 0;
  const { data, loading, error } = useQuery(
    () => hasFilters ? fetchAccountsReceivable(selectedCompanyCodes, selectedFiscalYears) : Promise.resolve(null),
    [selectedCompanyCodes.join(','), selectedFiscalYears.join(',')]
  );

  const [showOverduePanel, setShowOverduePanel] = useState(false);
  const { data: overdueData } = useQuery(
    () => (hasFilters && showOverduePanel) ? fetchOverdueInvoices(selectedCompanyCodes, selectedFiscalYears) : Promise.resolve(null),
    [selectedCompanyCodes.join(','), selectedFiscalYears.join(','), showOverduePanel]
  );

  if (!hasFilters) {
    return <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">Select at least one company code and fiscal year.</div>;
  }
  if (loading) return <div className="grid grid-cols-6 gap-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-gray-200" />)}</div>;
  if (error) return <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">Error: {error}</div>;
  if (!data || !data.kpis) return null;

  const { kpis: summary, agingBuckets, dsoTrend, topCustomers, paymentPerf: paymentPerformance, monthlyCollections } = data;

  // DSO trend sparkline
  const dsoValues = (dsoTrend ?? []).map((d: any) => d.avgDso ?? 0);
  const currentDso = summary.avgDso ?? (dsoValues.length > 0 ? dsoValues[dsoValues.length - 1] : 0);

  // Sort aging buckets by order
  const sortedAging = AGING_ORDER
    .map(bucket => (agingBuckets ?? []).find((d: any) => d.agingBucket === bucket))
    .filter(Boolean) as any[];
  const agingTotal = sortedAging.reduce((sum: number, d: any) => sum + (d.amount || 0), 0);

  // Compute CEI (Collection Effectiveness Index) from collections data
  // CEI = Collected / (Beginning AR + New Invoices - Ending AR) — approximate from paid vs net
  const totalBilled = (monthlyCollections ?? []).reduce((s: number, d: any) => s + (d.netAmount ?? d.net_amount ?? 0), 0);
  const totalCollected = (monthlyCollections ?? []).reduce((s: number, d: any) => s + (d.paidAmount ?? d.paid_amount ?? 0), 0);
  const cei = totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0;

  // AR Turnover Ratio approximation
  const avgAR = summary.totalOpen ?? agingTotal;
  const arTurnover = avgAR > 0 ? totalCollected / avgAR : 0;

  // Expected Cash Collections using probability rates
  const expectedCash = sortedAging.reduce((sum: number, d: any) => {
    const rate = COLLECTION_RATES[d.agingBucket] ?? 0.85;
    return sum + (d.amount || 0) * rate;
  }, 0);

  // Bad debt estimate (120+ days * (1 - collection rate))
  const aging120Plus = sortedAging.find((d: any) => d.agingBucket === '120+ Days');
  const badDebtEstimate = aging120Plus ? aging120Plus.amount * (1 - (COLLECTION_RATES['120+ Days'] ?? 0.85)) : 0;
  const badDebtRatio = totalBilled > 0 ? (badDebtEstimate / totalBilled) * 100 : 0;

  // Payment performance totals
  const perfTotal = (paymentPerformance ?? []).reduce((sum: number, d: any) => sum + (d.count ?? d.cnt ?? 0), 0);

  // Monthly collection amounts for sparkline
  const collectionAmounts = (monthlyCollections ?? []).map((d: any) => d.paidAmount ?? d.paid_amount ?? 0);

  return (
    <div className="space-y-6">
      {/* KPI Cards — 6 key AR metrics from Versapay/insightsoftware */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div onClick={() => setShowOverduePanel(true)} className="cursor-pointer">
          <MetricCard
            title="DSO"
            value={`${currentDso.toFixed(0)} days`}
            icon={Calendar}
            accent={ACCENTS[0]}
            trend={dsoValues.slice(-8)}
            delta={currentDso <= 30 ? 'Best-in-class (<30d)' : currentDso <= 50 ? 'Average (30-50d)' : 'Click for overdue details'}
            deltaType={currentDso <= 30 ? 'positive' : currentDso <= 50 ? 'neutral' : 'negative'}
            className="ring-2 ring-transparent hover:ring-sf-primary/50 transition-all"
          />
        </div>
        <MetricCard
          title="Total Open AR"
          value={formatDollar(summary.totalOpen)}
          icon={DollarSign}
          accent={ACCENTS[1]}
          trend={collectionAmounts.slice(-8)}
        />
        <MetricCard
          title="CEI"
          value={formatPct(cei)}
          icon={TrendingUp}
          accent={ACCENTS[3]}
          delta={cei >= 90 ? 'Top performer (>90%)' : cei >= 80 ? 'Standard (>80%)' : 'Below target (<80%)'}
          deltaType={cei >= 90 ? 'positive' : cei >= 80 ? 'neutral' : 'negative'}
        />
        <MetricCard
          title="AR Turnover"
          value={`${arTurnover.toFixed(1)}x`}
          icon={Activity}
          accent={ACCENTS[5]}
          delta={`~${arTurnover > 0 ? Math.round(365 / arTurnover) : 0} day cycle`}
          deltaType={arTurnover >= 8 ? 'positive' : arTurnover >= 5 ? 'neutral' : 'negative'}
        />
        <MetricCard
          title="Overdue Amount"
          value={formatDollar(summary.overdueAmount)}
          icon={CreditCard}
          accent={ACCENTS[2]}
          delta={agingTotal > 0 ? `${((summary.overdueAmount / agingTotal) * 100).toFixed(0)}% of total AR` : ''}
          deltaType="negative"
        />
        <MetricCard
          title="Bad Debt Risk"
          value={formatPct(badDebtRatio)}
          icon={TrendingDown}
          accent={ACCENTS[4]}
          delta={badDebtRatio < 0.5 ? 'Low risk (<0.5%)' : badDebtRatio < 1.5 ? 'Average (~1.5%)' : 'High risk (>1.5%)'}
          deltaType={badDebtRatio < 0.5 ? 'positive' : badDebtRatio < 1.5 ? 'neutral' : 'negative'}
        />
      </div>

      {/* Row 1: DSO Gauge + AR Aging Schedule */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* DSO Gauge with benchmark zones */}
        <ChartCard title="Days Sales Outstanding" subtitle="Benchmark: <30d best-in-class, 40-50d average">
          <ReactECharts option={{
            series: [{
              type: 'gauge',
              startAngle: 200,
              endAngle: -20,
              min: 0,
              max: 120,
              pointer: { show: true, length: '60%', width: 6, itemStyle: { color: '#1e293b' } },
              axisLine: {
                lineStyle: {
                  width: 22,
                  color: [[0.25, '#10b981'], [0.42, '#3b82f6'], [0.58, '#f59e0b'], [0.75, '#f97316'], [1, '#ef4444']],
                },
              },
              axisTick: { show: false },
              splitLine: { distance: -22, length: 22, lineStyle: { color: '#fff', width: 2 } },
              axisLabel: { distance: -32, fontSize: 10, color: '#6b7280', formatter: (v: number) => `${v}` },
              detail: {
                valueAnimation: true,
                formatter: `{value} days`,
                fontSize: 22,
                fontWeight: 'bold',
                offsetCenter: [0, '70%'],
                color: currentDso > 60 ? '#ef4444' : currentDso > 45 ? '#f59e0b' : '#10b981',
              },
              data: [{ value: Math.round(currentDso) }],
            }],
          }} style={{ height: 280 }} />
        </ChartCard>

        {/* AR Aging Schedule — the centerpiece visual per articles */}
        <ChartCard title="AR Aging Schedule" subtitle="Outstanding receivables by aging bucket" className="lg:col-span-2">
          <ReactECharts option={{
            tooltip: {
              trigger: 'axis',
              formatter: (params: any) => {
                const p = params[0];
                const pct = agingTotal > 0 ? ((p.value / agingTotal) * 100).toFixed(1) : '0';
                const bucket = (agingBuckets ?? []).find((d: any) => d.agingBucket === p.name);
                return `<strong>${p.name}</strong><br/>
                  Amount: ${formatDollar(p.value)}<br/>
                  Invoices: ${bucket?.count ?? 0}<br/>
                  Share: ${pct}%<br/>
                  Collection Rate: ${((COLLECTION_RATES[p.name] ?? 0.85) * 100).toFixed(1)}%`;
              },
            },
            grid: { left: 70, right: 40, top: 30, bottom: 30 },
            xAxis: { type: 'category', data: sortedAging.map((d: any) => d.agingBucket) },
            yAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatDollar(v) } },
            series: [{
              type: 'bar',
              data: sortedAging.map((d: any) => ({
                value: d.amount,
                itemStyle: {
                  borderRadius: [6, 6, 0, 0],
                  color: AGING_COLORS[d.agingBucket] || '#94a3b8',
                },
              })),
              barMaxWidth: 50,
              label: {
                show: true,
                position: 'top',
                formatter: (p: any) => {
                  const pct = agingTotal > 0 ? ((p.value / agingTotal) * 100).toFixed(0) : '0';
                  return `${pct}%\n${formatDollar(p.value)}`;
                },
                fontSize: 10,
                lineHeight: 14,
              },
            }],
          }} style={{ height: 300 }} />
        </ChartCard>
      </div>

      {/* Row 2: Expected Cash + CEI Gauge + Payment Performance */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Expected Cash Collections — Waterfall by aging bucket */}
        <ChartCard title="Expected Cash Collections" subtitle="Projected based on aging collection probabilities">
          <ReactECharts option={{
            tooltip: {
              trigger: 'axis',
              formatter: (params: any) => {
                const p = params[0];
                const bucket = sortedAging[p.dataIndex];
                const rate = COLLECTION_RATES[bucket?.agingBucket] ?? 0.85;
                return `<strong>${bucket?.agingBucket}</strong><br/>
                  Outstanding: ${formatDollar(bucket?.amount)}<br/>
                  Collection Rate: ${(rate * 100).toFixed(1)}%<br/>
                  Expected: ${formatDollar(p.value)}`;
              },
            },
            grid: { left: 60, right: 20, top: 20, bottom: 50 },
            xAxis: { type: 'category', data: sortedAging.map((d: any) => d.agingBucket), axisLabel: { fontSize: 9, rotate: 30 } },
            yAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatDollar(v) } },
            series: [{
              type: 'bar',
              data: sortedAging.map((d: any, i: number) => ({
                value: Math.round((d.amount || 0) * (COLLECTION_RATES[d.agingBucket] ?? 0.85)),
                itemStyle: {
                  borderRadius: [4, 4, 0, 0],
                  color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: PALETTE[i % PALETTE.length] }, { offset: 1, color: PALETTE[i % PALETTE.length] + '80' }] },
                },
              })),
              barMaxWidth: 35,
              label: { show: true, position: 'top', formatter: (p: any) => formatDollar(p.value), fontSize: 9 },
            }],
          }} style={{ height: 280 }} />
        </ChartCard>

        {/* CEI Gauge */}
        <ChartCard title="Collection Effectiveness Index" subtitle="Target: >80% standard, >90% top performer">
          <ReactECharts option={{
            series: [{
              type: 'gauge',
              startAngle: 200,
              endAngle: -20,
              min: 0,
              max: 100,
              pointer: { show: true, length: '55%', width: 5, itemStyle: { color: '#1e293b' } },
              axisLine: {
                lineStyle: {
                  width: 20,
                  color: [[0.6, '#ef4444'], [0.8, '#f59e0b'], [0.9, '#3b82f6'], [1, '#10b981']],
                },
              },
              axisTick: { show: false },
              splitLine: { distance: -20, length: 20, lineStyle: { color: '#fff', width: 2 } },
              axisLabel: { distance: -28, fontSize: 9, color: '#6b7280', formatter: (v: number) => `${v}%` },
              detail: {
                valueAnimation: true,
                formatter: `{value}%`,
                fontSize: 22,
                fontWeight: 'bold',
                offsetCenter: [0, '70%'],
                color: cei >= 90 ? '#10b981' : cei >= 80 ? '#3b82f6' : '#ef4444',
              },
              data: [{ value: Math.round(cei * 10) / 10 }],
            }],
          }} style={{ height: 280 }} />
        </ChartCard>

        {/* Payment Performance — Donut with legend */}
        <ChartCard title="Payment Performance" subtitle="Distribution of payment timeliness">
          <ReactECharts option={{
            tooltip: { trigger: 'item', formatter: (p: any) => `${p.name}: ${p.value} invoices (${perfTotal > 0 ? ((p.value / perfTotal) * 100).toFixed(1) : 0}%)` },
            legend: { bottom: 0, textStyle: { fontSize: 10 } },
            series: [{
              type: 'pie',
              radius: ['45%', '72%'],
              center: ['50%', '45%'],
              avoidLabelOverlap: true,
              itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
              label: { formatter: '{d}%', fontSize: 11 },
              data: (paymentPerformance ?? []).map((d: any) => ({
                name: d.status ?? d.performance ?? 'Unknown',
                value: d.count ?? d.cnt ?? 0,
                itemStyle: { color: PERF_COLORS[d.status ?? d.performance] || '#94a3b8' },
              })),
            }],
          }} style={{ height: 280 }} />
        </ChartCard>
      </div>

      {/* Row 3: DSO Trend + Top Customers */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* DSO Trend with benchmark line */}
        <ChartCard title="DSO Trend Over Time" subtitle="Monthly DSO vs 30-day and 50-day benchmarks">
          <ReactECharts option={{
            tooltip: { trigger: 'axis', formatter: (params: any) => `${params[0].name}<br/>DSO: ${params[0].value} days` },
            grid: { left: 50, right: 20, top: 30, bottom: 30 },
            xAxis: { type: 'category', data: (dsoTrend ?? []).map((d: any) => d.period), boundaryGap: false },
            yAxis: { type: 'value', min: 0, axisLabel: { formatter: '{value}d' } },
            series: [{
              type: 'line',
              smooth: true,
              symbol: 'circle',
              symbolSize: 6,
              data: dsoValues,
              lineStyle: { width: 3, color: '#8b5cf6' },
              itemStyle: { color: '#8b5cf6' },
              areaStyle: {
                color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(139,92,246,0.25)' }, { offset: 1, color: 'rgba(139,92,246,0.02)' }] },
              },
              markLine: {
                silent: true,
                data: [
                  { yAxis: 30, lineStyle: { type: 'dashed', color: '#10b981' }, label: { formatter: '30d target', fontSize: 9, position: 'end' } },
                  { yAxis: 50, lineStyle: { type: 'dashed', color: '#f59e0b' }, label: { formatter: '50d avg', fontSize: 9, position: 'end' } },
                ],
              },
            }],
          }} style={{ height: 300 }} />
        </ChartCard>

        {/* Top Customers by Open Balance — with risk indicator */}
        <ChartCard title="Top Customers by Open Balance" subtitle="Highest outstanding receivables">
          <ReactECharts option={{
            tooltip: {
              trigger: 'axis',
              formatter: (params: any) => `<strong>${params[0].name}</strong><br/>Open: ${formatDollar(params[0].value)}`,
            },
            grid: { left: 140, right: 60, top: 10, bottom: 20 },
            xAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatDollar(v) } },
            yAxis: {
              type: 'category',
              data: (topCustomers ?? []).map((d: any) => d.customername).reverse(),
              axisLabel: { width: 120, overflow: 'truncate', fontSize: 10 },
            },
            series: [{
              type: 'bar',
              data: (topCustomers ?? []).map((d: any) => d.openAmount ?? d.open_amount ?? 0).reverse(),
              itemStyle: {
                borderRadius: [0, 6, 6, 0],
                color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#ef4444' }, { offset: 1, color: '#fca5a5' }] },
              },
              barMaxWidth: 22,
              label: { show: true, position: 'right', formatter: (p: any) => formatDollar(p.value), fontSize: 9 },
            }],
          }} style={{ height: 320 }} />
        </ChartCard>
      </div>

      {/* Row 4: Monthly Collections (full width) */}
      <ChartCard title="Monthly Billed vs Collected" subtitle="Collection gap indicates growing AR risk">
        <ReactECharts option={{
          tooltip: { trigger: 'axis' },
          legend: { data: ['Billed', 'Collected', 'Gap'], top: 0 },
          grid: { left: 70, right: 40, top: 35, bottom: 30 },
          xAxis: { type: 'category', data: (monthlyCollections ?? []).map((d: any) => d.period), boundaryGap: false },
          yAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatDollar(v) } },
          series: [
            {
              name: 'Billed',
              type: 'line',
              data: (monthlyCollections ?? []).map((d: any) => d.netAmount ?? d.net_amount ?? 0),
              smooth: true,
              lineStyle: { width: 2, color: '#3b82f6' },
              itemStyle: { color: '#3b82f6' },
              areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(59,130,246,0.2)' }, { offset: 1, color: 'rgba(59,130,246,0.01)' }] } },
            },
            {
              name: 'Collected',
              type: 'line',
              data: (monthlyCollections ?? []).map((d: any) => d.paidAmount ?? d.paid_amount ?? 0),
              smooth: true,
              lineStyle: { width: 2, color: '#10b981' },
              itemStyle: { color: '#10b981' },
              areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(16,185,129,0.2)' }, { offset: 1, color: 'rgba(16,185,129,0.01)' }] } },
            },
            {
              name: 'Gap',
              type: 'bar',
              data: (monthlyCollections ?? []).map((d: any) => {
                const billed = d.netAmount ?? d.net_amount ?? 0;
                const collected = d.paidAmount ?? d.paid_amount ?? 0;
                return Math.max(0, billed - collected);
              }),
              itemStyle: { color: 'rgba(239,68,68,0.3)', borderRadius: [3, 3, 0, 0] },
              barMaxWidth: 12,
            },
          ],
        }} style={{ height: 300 }} />
      </ChartCard>

      {/* Customer Detail Table */}
      <ChartCard title="Top Customer Details" subtitle="Open balances and invoice counts">
        <DataTable
          columns={[
            { key: 'customer', label: 'Customer' },
            { key: 'invoices', label: 'Open Invoices', format: (v: number) => formatNumber(v) },
            { key: 'balance', label: 'Open Balance', format: (v: number) => formatDollar(v) },
            { key: 'avg', label: 'Avg Invoice', format: (v: number) => formatDollar(v) },
            { key: 'pct', label: '% of Total AR', format: (v: number) => `${v.toFixed(1)}%` },
          ]}
          data={(topCustomers ?? []).map((d: any) => ({
            customer: d.customername,
            invoices: d.invoiceCount ?? d.invoice_count ?? 0,
            balance: d.openAmount ?? d.open_amount ?? 0,
            avg: (d.invoiceCount ?? d.invoice_count ?? 1) > 0 ? (d.openAmount ?? d.open_amount ?? 0) / (d.invoiceCount ?? d.invoice_count ?? 1) : 0,
            pct: agingTotal > 0 ? ((d.openAmount ?? d.open_amount ?? 0) / agingTotal) * 100 : 0,
          }))}
        />
      </ChartCard>

      {/* Overdue Invoices Slide-Out Panel */}
      {showOverduePanel && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowOverduePanel(false)} />
          {/* Panel */}
          <div className="relative w-full max-w-lg bg-white shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 bg-gradient-to-r from-sf-dark to-sf-deeper px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-white">Most Overdue Invoices</h2>
                <p className="text-xs text-sf-pale">Sorted by days past due (longest first)</p>
              </div>
              <button
                onClick={() => setShowOverduePanel(false)}
                className="rounded-full p-1.5 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {!overdueData ? (
                <div className="space-y-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-100" />
                  ))}
                </div>
              ) : (overdueData as any[]).length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500">No overdue invoices found.</p>
              ) : (
                <div className="space-y-2">
                  {(overdueData as any[]).map((inv: any, i: number) => (
                    <div
                      key={inv.invoiceid || i}
                      className="rounded-lg border border-gray-200 p-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-900">{inv.customername}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          (inv.daysPastDue ?? inv.days_past_due ?? 0) > 120 ? 'bg-red-100 text-red-700' :
                          (inv.daysPastDue ?? inv.days_past_due ?? 0) > 90 ? 'bg-orange-100 text-orange-700' :
                          (inv.daysPastDue ?? inv.days_past_due ?? 0) > 60 ? 'bg-amber-100 text-amber-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {inv.daysPastDue ?? inv.days_past_due ?? 0} days overdue
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-xs text-gray-500">
                        <span>Invoice: {inv.invoiceid}</span>
                        <span className="font-semibold text-gray-900">{formatDollar(inv.openamount)}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
                        <span>Due: {inv.duedate}</span>
                        <span>{inv.agingBucket ?? inv.aging_bucket}</span>
                        <span>{inv.documentcurrency}</span>
                        <span>Terms: {inv.paymentterms}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Footer */}
            <div className="border-t border-gray-200 bg-gray-50 px-6 py-3">
              <p className="text-xs text-gray-500">
                Showing top 50 overdue invoices · Total overdue: {formatDollar(summary.overdueAmount)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
