import { useState } from 'react';
import { useFilters } from '@/hooks/useFilters';
import { useQuery } from '@/hooks/useQuery';
import { fetchAccountsPayable, fetchLargestInvoices } from '@/lib/api';
import { formatDollar, formatNumber, formatPct } from '@/lib/utils';
import MetricCard, { Receipt, DollarSign, Calculator, Users, TrendingDown, Activity } from '@/components/MetricCard';
import ChartCard from '@/components/ChartCard';
import DataTable from '@/components/DataTable';
import ReactECharts from '@/components/Chart';

const PALETTE = ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899'];
const AGING_COLORS: Record<string, string> = {
  Current: '#10b981',
  '31-60 Days': '#06b6d4',
  '61-90 Days': '#f59e0b',
  '90+ Days': '#ef4444',
};
const ACCENTS = [
  'border-cyan-300/50 bg-gradient-to-br from-cyan-50 to-sky-50',
  'border-emerald-300/50 bg-gradient-to-br from-emerald-50 to-green-50',
  'border-purple-300/50 bg-gradient-to-br from-purple-50 to-indigo-50',
  'border-amber-300/50 bg-gradient-to-br from-amber-50 to-yellow-50',
  'border-red-300/50 bg-gradient-to-br from-red-50 to-orange-50',
  'border-blue-300/50 bg-gradient-to-br from-blue-50 to-indigo-50',
];

const STATUS_MAP: Record<string, string> = { P: 'Posted', A: 'Approved', C: 'Cleared', X: 'Cancelled' };

export default function AccountsPayable() {
  const { selectedCompanyCodes, selectedFiscalYears } = useFilters();
  const hasFilters = selectedCompanyCodes.length > 0 && selectedFiscalYears.length > 0;
  const { data, loading, error } = useQuery(
    () => hasFilters ? fetchAccountsPayable(selectedCompanyCodes, selectedFiscalYears) : Promise.resolve(null),
    [selectedCompanyCodes.join(','), selectedFiscalYears.join(',')]
  );

  const [showInvoicePanel, setShowInvoicePanel] = useState(false);
  const { data: largestInvoices } = useQuery(
    () => (hasFilters && showInvoicePanel) ? fetchLargestInvoices(selectedCompanyCodes, selectedFiscalYears) : Promise.resolve(null),
    [selectedCompanyCodes.join(','), selectedFiscalYears.join(','), showInvoicePanel]
  );

  if (!hasFilters) {
    return <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">Select at least one company code and fiscal year.</div>;
  }
  if (loading) return <div className="grid grid-cols-6 gap-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-gray-200" />)}</div>;
  if (error) return <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">Error: {error}</div>;
  if (!data || !data.kpis) return null;

  const { kpis: summary, aging: agingBuckets, invoiceStatus, topVendors, currencyDist: currencyDistribution, monthlyVolume } = data;

  // Compute derived KPIs from articles
  const agingTotal = (agingBuckets ?? []).reduce((sum: number, d: any) => sum + (d.amount || 0), 0);
  const overdueAmount = (agingBuckets ?? [])
    .filter((d: any) => d.agingBucket !== 'Current')
    .reduce((sum: number, d: any) => sum + (d.amount || 0), 0);
  const overdueCount = (agingBuckets ?? [])
    .filter((d: any) => d.agingBucket !== 'Current')
    .reduce((sum: number, d: any) => sum + (d.count || 0), 0);
  const latePaymentRate = summary.invoiceCount > 0 ? (overdueCount / summary.invoiceCount) * 100 : 0;

  // DPO approximation: weighted avg days from aging buckets
  const agingDays: Record<string, number> = { 'Current': 15, '31-60 Days': 45, '61-90 Days': 75, '90+ Days': 120 };
  const weightedDays = (agingBuckets ?? []).reduce((sum: number, d: any) => sum + ((agingDays[d.agingBucket] || 30) * (d.count || 0)), 0);
  const dpo = summary.invoiceCount > 0 ? Math.round(weightedDays / summary.invoiceCount) : 0;

  // Vendor concentration: top 3 vendors as % of total
  const top3VendorTotal = (topVendors ?? []).slice(0, 3).reduce((sum: number, d: any) => sum + (d.total || 0), 0);
  const vendorConcentration = summary.totalAmount > 0 ? (top3VendorTotal / summary.totalAmount) * 100 : 0;

  // Monthly trend for sparkline
  const monthlyAmounts = (monthlyVolume ?? []).map((d: any) => d.total || 0);

  // Cumulative monthly totals
  let cumulative = 0;
  const cumulativeData = (monthlyVolume ?? []).map((d: any) => {
    cumulative += d.total || 0;
    return cumulative;
  });

  // Aging bucket order
  const agingOrder = ['Current', '31-60 Days', '61-90 Days', '90+ Days'];
  const sortedAging = agingOrder.map(bucket => (agingBuckets ?? []).find((d: any) => d.agingBucket === bucket)).filter(Boolean);

  return (
    <div className="space-y-6">
      {/* KPI Cards — 6 key AP metrics from Sage/IntelliChief */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div onClick={() => setShowInvoicePanel(true)} className="cursor-pointer">
          <MetricCard
            title="Total Invoices"
            value={formatNumber(summary.invoiceCount)}
            icon={Receipt}
            accent={ACCENTS[0]}
            trend={monthlyAmounts.slice(-8).map((_: any, i: number) => (monthlyVolume ?? []).slice(-8)[i]?.count || 0)}
            delta="Click for largest invoices"
            deltaType="neutral"
            className="ring-2 ring-transparent hover:ring-sf-primary/50 transition-all"
          />
        </div>
        <MetricCard
          title="Total AP"
          value={formatDollar(summary.totalAmount)}
          icon={DollarSign}
          accent={ACCENTS[1]}
          trend={monthlyAmounts.slice(-8)}
        />
        <MetricCard
          title="DPO (Days)"
          value={String(dpo)}
          icon={Activity}
          accent={ACCENTS[2]}
          delta={dpo > 60 ? 'Above target' : dpo > 30 ? 'Moderate' : 'Healthy'}
          deltaType={dpo > 60 ? 'negative' : dpo > 30 ? 'neutral' : 'positive'}
        />
        <MetricCard
          title="Late Payment %"
          value={formatPct(latePaymentRate)}
          icon={TrendingDown}
          accent={ACCENTS[4]}
          delta={latePaymentRate > 10 ? 'Above 10% target' : 'Within target'}
          deltaType={latePaymentRate > 10 ? 'negative' : 'positive'}
        />
        <MetricCard
          title="Avg Invoice"
          value={formatDollar(summary.avgAmount)}
          icon={Calculator}
          accent={ACCENTS[3]}
        />
        <MetricCard
          title="Vendor Risk"
          value={formatPct(vendorConcentration)}
          icon={Users}
          accent={ACCENTS[5]}
          delta={`Top 3 of ${summary.vendorCount ?? summary.uniqueVendors ?? 0} vendors`}
          deltaType={vendorConcentration > 40 ? 'negative' : 'neutral'}
        />
      </div>

      {/* Row 1: DPO Gauge + Aging Analysis */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* DPO Gauge */}
        <ChartCard title="Days Payable Outstanding" subtitle="Target: 30-45 days">
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
                  width: 20,
                  color: [[0.25, '#10b981'], [0.5, '#f59e0b'], [0.75, '#f97316'], [1, '#ef4444']],
                },
              },
              axisTick: { show: false },
              splitLine: { distance: -20, length: 20, lineStyle: { color: '#fff', width: 2 } },
              axisLabel: { distance: -30, fontSize: 10, color: '#6b7280' },
              detail: {
                valueAnimation: true,
                formatter: `${dpo} days`,
                fontSize: 20,
                fontWeight: 'bold',
                offsetCenter: [0, '70%'],
                color: dpo > 60 ? '#ef4444' : dpo > 45 ? '#f59e0b' : '#10b981',
              },
              data: [{ value: dpo }],
            }],
          }} style={{ height: 280 }} />
        </ChartCard>

        {/* AP Aging — Vertical stacked bar with labels */}
        <ChartCard title="AP Aging Breakdown" subtitle="Amount outstanding by bucket" className="lg:col-span-2">
          <ReactECharts option={{
            tooltip: {
              trigger: 'axis',
              formatter: (params: any) => {
                let html = '<strong>AP Aging</strong>';
                (params ?? []).forEach((p: any) => {
                  const pct = agingTotal > 0 ? ((p.value / agingTotal) * 100).toFixed(1) : '0';
                  html += `<br/>${p.marker} ${p.seriesName}: ${formatDollar(p.value)} (${pct}%)`;
                });
                return html;
              },
            },
            grid: { left: 80, right: 40, top: 50, bottom: 30 },
            legend: { top: 0, textStyle: { fontSize: 11 } },
            xAxis: { type: 'category', data: agingOrder },
            yAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatDollar(v) } },
            series: [{
              name: 'Outstanding',
              type: 'bar',
              data: sortedAging.map((d: any) => ({
                value: d.amount,
                itemStyle: {
                  borderRadius: [6, 6, 0, 0],
                  color: AGING_COLORS[d.agingBucket] || '#94a3b8',
                },
              })),
              barMaxWidth: 60,
              label: {
                show: true,
                position: 'top',
                formatter: (p: any) => {
                  const pct = agingTotal > 0 ? ((p.value / agingTotal) * 100).toFixed(0) : '0';
                  return `${pct}%`;
                },
                fontSize: 12,
                fontWeight: 'bold',
              },
            }],
          }} style={{ height: 280 }} />
        </ChartCard>
      </div>

      {/* Row 2: Invoice Status + Vendor Concentration */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Invoice Lifecycle Funnel */}
        <ChartCard title="Invoice Processing Status" subtitle="Distribution by lifecycle stage">
          <ReactECharts option={{
            tooltip: { trigger: 'item', formatter: '{b}: {c} invoices ({d}%)' },
            series: [{
              type: 'funnel',
              sort: 'descending',
              gap: 4,
              left: '10%',
              right: '10%',
              top: 20,
              bottom: 20,
              label: { show: true, position: 'inside', formatter: '{b}\n{c}', fontSize: 12, color: '#fff' },
              itemStyle: { borderWidth: 0 },
              data: (invoiceStatus ?? [])
                .sort((a: any, b: any) => (b.count ?? 0) - (a.count ?? 0))
                .map((d: any, i: number) => ({
                  name: STATUS_MAP[d.status] || d.status || 'Unknown',
                  value: d.count ?? d.cnt ?? 0,
                  itemStyle: { color: PALETTE[i % PALETTE.length] },
                })),
            }],
          }} style={{ height: 280 }} />
        </ChartCard>

        {/* Vendor Concentration — Top vendors with cumulative % line */}
        <ChartCard title="Vendor Concentration" subtitle="Spend distribution across suppliers">
          <ReactECharts option={{
            tooltip: {
              trigger: 'axis',
              formatter: (params: any) => {
                let html = `<strong>${params[0]?.name}</strong>`;
                params.forEach((p: any) => {
                  const val = p.seriesName === 'Cumulative %' ? `${p.value.toFixed(1)}%` : formatDollar(p.value);
                  html += `<br/>${p.marker} ${p.seriesName}: ${val}`;
                });
                return html;
              },
            },
            legend: { data: ['Amount', 'Cumulative %'], top: 0 },
            grid: { left: 90, right: 50, top: 35, bottom: 30 },
            xAxis: {
              type: 'category',
              data: (topVendors ?? []).map((d: any) => d.vendor || d.invoicingparty),
              axisLabel: { rotate: 30, fontSize: 9 },
            },
            yAxis: [
              { type: 'value', axisLabel: { formatter: (v: number) => formatDollar(v) } },
              { type: 'value', max: 100, axisLabel: { formatter: '{value}%' }, splitLine: { show: false } },
            ],
            series: [
              {
                name: 'Amount',
                type: 'bar',
                data: (topVendors ?? []).map((d: any, i: number) => ({
                  value: d.total,
                  itemStyle: {
                    borderRadius: [4, 4, 0, 0],
                    color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#8b5cf6' }, { offset: 1, color: '#c084fc' }] },
                  },
                })),
                barMaxWidth: 30,
              },
              {
                name: 'Cumulative %',
                type: 'line',
                yAxisIndex: 1,
                smooth: true,
                symbol: 'circle',
                symbolSize: 6,
                lineStyle: { width: 2, color: '#ef4444' },
                itemStyle: { color: '#ef4444' },
                markLine: {
                  silent: true,
                  lineStyle: { type: 'dashed', color: '#f59e0b' },
                  data: [{ yAxis: 80, label: { formatter: '80% threshold', fontSize: 9, position: 'end' } }],
                },
                data: (() => {
                  const total = (topVendors ?? []).reduce((s: number, d: any) => s + (d.total || 0), 0);
                  let cum = 0;
                  return (topVendors ?? []).map((d: any) => {
                    cum += d.total || 0;
                    return total > 0 ? (cum / total) * 100 : 0;
                  });
                })(),
              },
            ],
          }} style={{ height: 320 }} />
        </ChartCard>
      </div>

      {/* Row 3: Currency + Monthly Trend (full width) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Currency Distribution */}
        <ChartCard title="Invoices by Currency" subtitle="Volume and amount by currency">
          <ReactECharts option={{
            tooltip: { trigger: 'axis' },
            grid: { left: 50, right: 20, top: 30, bottom: 30 },
            xAxis: { type: 'category', data: (currencyDistribution ?? []).map((d: any) => d.documentcurrency || d.currency) },
            yAxis: { type: 'value', name: 'Count' },
            series: [{
              type: 'bar',
              data: (currencyDistribution ?? []).map((d: any, i: number) => ({
                value: d.cnt || d.count,
                itemStyle: { borderRadius: [4, 4, 0, 0], color: PALETTE[i % PALETTE.length] },
              })),
              barMaxWidth: 50,
              label: { show: true, position: 'top', fontSize: 12, fontWeight: 'bold' },
            }],
          }} style={{ height: 280 }} />
        </ChartCard>

        {/* Monthly Invoice Throughput */}
        <ChartCard title="Monthly Invoice Throughput" subtitle="Volume & cumulative spend over time" className="lg:col-span-2">
          <ReactECharts option={{
            tooltip: { trigger: 'axis' },
            legend: { data: ['Invoices', 'Cumulative Spend'], top: 0 },
            grid: { left: 50, right: 70, top: 35, bottom: 30 },
            xAxis: { type: 'category', data: (monthlyVolume ?? []).map((d: any) => d.period), axisLabel: { fontSize: 9, rotate: 30 } },
            yAxis: [
              { type: 'value', name: 'Count', position: 'left' },
              { type: 'value', name: 'Cumulative', position: 'right', axisLabel: { formatter: (v: number) => formatDollar(v) }, splitLine: { show: false } },
            ],
            series: [
              {
                name: 'Invoices',
                type: 'bar',
                data: (monthlyVolume ?? []).map((d: any) => d.count || d.invoices || 0),
                itemStyle: {
                  borderRadius: [3, 3, 0, 0],
                  color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#06b6d4' }, { offset: 1, color: '#0e7490' }] },
                },
                barMaxWidth: 16,
              },
              {
                name: 'Cumulative Spend',
                type: 'line',
                yAxisIndex: 1,
                data: cumulativeData,
                smooth: true,
                lineStyle: { width: 2, color: '#8b5cf6' },
                itemStyle: { color: '#8b5cf6' },
                areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(139,92,246,0.15)' }, { offset: 1, color: 'rgba(139,92,246,0)' }] } },
              },
            ],
          }} style={{ height: 300 }} />
        </ChartCard>
      </div>

      {/* Vendor Detail Table */}
      <ChartCard title="Top Vendor Details">
        <DataTable
          columns={[
            { key: 'vendor', label: 'Vendor' },
            { key: 'invoiceCount', label: 'Invoices', format: (v: number) => formatNumber(v) },
            { key: 'total', label: 'Total Amount', format: (v: number) => formatDollar(v) },
            { key: 'avg', label: 'Avg Invoice', format: (v: number) => formatDollar(v) },
            { key: 'pct', label: '% of Total', format: (v: number) => `${v.toFixed(1)}%` },
          ]}
          data={(topVendors ?? []).map((d: any) => ({
            vendor: d.vendor || d.invoicingparty,
            invoiceCount: d.invoiceCount ?? d.invoice_count ?? 0,
            total: d.total,
            avg: d.invoiceCount > 0 ? d.total / d.invoiceCount : d.total,
            pct: summary.totalAmount > 0 ? (d.total / summary.totalAmount) * 100 : 0,
          }))}
        />
      </ChartCard>

      {/* Largest Invoices Slide-Out Panel */}
      {showInvoicePanel && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowInvoicePanel(false)} />
          <div className="relative w-full max-w-lg bg-white shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between border-b border-gray-200 bg-gradient-to-r from-sf-dark to-sf-deeper px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-white">Largest Invoices</h2>
                <p className="text-xs text-sf-pale">Sorted by amount (highest first)</p>
              </div>
              <button
                onClick={() => setShowInvoicePanel(false)}
                className="rounded-full p-1.5 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {!largestInvoices ? (
                <div className="space-y-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-100" />
                  ))}
                </div>
              ) : (largestInvoices as any[]).length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500">No invoices found.</p>
              ) : (
                <div className="space-y-2">
                  {(largestInvoices as any[]).map((inv: any, i: number) => (
                    <div
                      key={inv.supplierinvoice || i}
                      className="rounded-lg border border-gray-200 p-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-900">{inv.invoicingparty}</span>
                        <span className="text-sm font-bold text-sf-dark">{formatDollar(inv.invoicegrossamount)}</span>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-xs text-gray-500">
                        <span>Invoice: {inv.supplierinvoice}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          inv.supplierinvoicestatus === 'C' ? 'bg-emerald-100 text-emerald-700' :
                          inv.supplierinvoicestatus === 'P' ? 'bg-blue-100 text-blue-700' :
                          inv.supplierinvoicestatus === 'A' ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {STATUS_MAP[inv.supplierinvoicestatus] || inv.supplierinvoicestatus}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
                        <span>Date: {inv.documentdate}</span>
                        <span>CC: {inv.companycode}</span>
                        <span>{inv.documentcurrency}</span>
                        {inv.documentheadertext && <span className="truncate max-w-[120px]">{inv.documentheadertext}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="border-t border-gray-200 bg-gray-50 px-6 py-3">
              <p className="text-xs text-gray-500">
                Showing top 50 invoices · Total AP: {formatDollar(summary.totalAmount)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
