/** Marketing workspace (metrics CRUD).
 * Extracted verbatim from product-sales-workspace.
 */
'use client';
import {
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import {
  useQueryClient,
} from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Megaphone,
  Pencil,
  Plus,
  ReceiptText,
  Trash2,
  Users,
} from 'lucide-react';
import {
  Button,
} from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Input,
} from '@/components/ui/input';
import type {
  CommerceActionRecommendation,
  CommerceWorkspaceData,
  MarketingMetricRecord,
} from '@/lib/api';
import {
  commerceDashboardKeys,
} from '@/hooks/use-commerce-dashboard';
import {
  marketingMetricKeys,
  useMarketingMetrics,
} from '@/hooks/use-marketing-metrics';
import {
  amount,
} from '@/components/commerce/shared-charts';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  toast,
} from 'sonner';
import {
  FinanceKpiCard,
  MarketingPerformanceChart,
  SmartSuggestions,
} from '@/components/commerce/shared-charts';

export function MarketingWorkspace({ data, recommendations, isRecommendationsLoading, dateFrom, dateTo }: { data?: CommerceWorkspaceData['marketing']; recommendations?: CommerceActionRecommendation[]; isRecommendationsLoading: boolean; dateFrom?: string; dateTo?: string }) {
  const queryClient = useQueryClient();
  const {
    data: metricsData,
    isLoading: isLoadingMetrics,
    isError: isMetricsError,
    refetch: refetchMetrics,
  } = useMarketingMetrics({ dateFrom, dateTo });
  const metrics = useMemo(() => metricsData?.metrics ?? [], [metricsData]);
  const [metricDialogOpen, setMetricDialogOpen] = useState(false);
  const [editingMetric, setEditingMetric] = useState<MarketingMetricRecord | null>(null);
  const [deleteMetric, setDeleteMetric] = useState<MarketingMetricRecord | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [metricForm, setMetricForm] = useState({
    metricDate: new Date().toISOString().slice(0, 10),
    channel: 'Facebook',
    campaignName: '',
    spend: '',
    reach: '',
    leads: '',
    adDrivenOrders: '',
    notes: '',
  });

  const openAddMetric = () => {
    setEditingMetric(null);
    setMetricForm({
      metricDate: dateFrom || new Date().toISOString().slice(0, 10),
      channel: 'Facebook',
      campaignName: '',
      spend: '',
      reach: '',
      leads: '',
      adDrivenOrders: '',
      notes: '',
    });
    setMetricDialogOpen(true);
  };

  const openEditMetric = (metric: MarketingMetricRecord) => {
    setEditingMetric(metric);
    setMetricForm({
      metricDate: metric.metricDate ? metric.metricDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
      channel: metric.channel || 'Facebook',
      campaignName: metric.campaignName || '',
      spend: metric.spend ? String(metric.spend) : '0',
      reach: metric.reach ? String(metric.reach) : '',
      leads: metric.leads ? String(metric.leads) : '',
      adDrivenOrders: metric.adDrivenOrders ? String(metric.adDrivenOrders) : '',
      notes: metric.notes || '',
    });
    setMetricDialogOpen(true);
  };

  const saveMetric = async (e: FormEvent) => {
    e.preventDefault();
    const spendNum = Number(metricForm.spend);
    if (!Number.isFinite(spendNum) || spendNum < 0) {
      toast.error('Enter a valid spend amount');
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        metricDate: metricForm.metricDate,
        channel: metricForm.channel,
        campaignName: metricForm.campaignName.trim() || null,
        spend: spendNum,
        reach: metricForm.reach ? Number(metricForm.reach) : null,
        leads: metricForm.leads ? Number(metricForm.leads) : null,
        adDrivenOrders: metricForm.adDrivenOrders ? Number(metricForm.adDrivenOrders) : null,
        notes: metricForm.notes.trim() || null,
      };

      const res = await fetch('/api/marketing-metrics', {
        method: editingMetric ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingMetric ? { id: editingMetric.id, ...payload } : payload),
      });

      if (!res.ok) throw new Error('Failed to save marketing metric');
      toast.success(editingMetric ? 'Metric updated' : 'Metric recorded');
      setMetricDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: marketingMetricKeys.all });
      await queryClient.invalidateQueries({ queryKey: commerceDashboardKeys.all });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error saving metric');
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDeleteMetric = async () => {
    if (!deleteMetric) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/marketing-metrics?id=${deleteMetric.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete marketing metric');
      toast.success('Metric moved to Trash');
      setDeleteMetric(null);
      await queryClient.invalidateQueries({ queryKey: marketingMetricKeys.all });
      await queryClient.invalidateQueries({ queryKey: commerceDashboardKeys.all });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error deleting metric');
    } finally {
      setIsDeleting(false);
    }
  };

  const weekly = data?.chart.length ? data.chart.map((item) => [item.label, item.spend, item.orders] as const) : [['W1', 0, 0], ['W2', 0, 0], ['W3', 0, 0], ['W4', 0, 0]] as const;
  const topProducts = data?.topProducts ?? [];

  // Channel spend breakdown, computed from the same period-scoped metrics
  // table below — no extra query. Shows where the ad budget actually went.
  const channelBreakdown = useMemo(() => {
    const byChannel = new Map<string, { spend: number; orders: number; reach: number }>();
    for (const metric of metrics) {
      const key = metric.channel?.trim() || "Other";
      const current = byChannel.get(key) ?? { spend: 0, orders: 0, reach: 0 };
      current.spend += Number(metric.spend) || 0;
      current.orders += Number(metric.adDrivenOrders) || 0;
      current.reach += Number(metric.reach) || Number(metric.impressions) || 0;
      byChannel.set(key, current);
    }
    const total = [...byChannel.values()].reduce((sum, entry) => sum + entry.spend, 0);
    return {
      total,
      rows: [...byChannel.entries()]
        .map(([channel, entry]) => ({
          channel,
          ...entry,
          share: total > 0 ? (entry.spend / total) * 100 : 0,
          costPerOrder: entry.orders > 0 ? entry.spend / entry.orders : 0,
        }))
        .sort((a, b) => b.spend - a.spend),
    };
  }, [metrics]);
  const channelColors = ["#0ea5e9", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#64748b"];

  const [metricPage, setMetricPage] = useState(1);
  const metricPageSize = 10;
  const totalMetricPages = Math.max(1, Math.ceil(metrics.length / metricPageSize));
  const pagedMetrics = metrics.slice((metricPage - 1) * metricPageSize, metricPage * metricPageSize);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <FinanceKpiCard label="Total Ad Expense" value={amount(data?.kpis.adSpend ?? 0)} unit="MMK" icon={ReceiptText} accentClass="border-l-4 border-l-pink-500" />
        <FinanceKpiCard label="Reach" value={amount(data?.kpis.reach ?? 0)} icon={Users} accentClass="border-l-4 border-l-sky-500" />
        <FinanceKpiCard label="Cost per Order" value={amount(data?.kpis.costPerOrder ?? 0)} unit="MMK" icon={DollarSign} accentClass="border-l-4 border-l-amber-500" />
        <FinanceKpiCard label="Ad-driven Orders" value={amount(data?.kpis.adOrders ?? 0)} icon={Megaphone} accentClass="border-l-4 border-l-emerald-500" />
      </div>

      <SmartSuggestions recommendations={recommendations} isLoading={isRecommendationsLoading} areaFilter="marketing" />

      <section className="rounded-xl border-2 border-slate-200 bg-card shadow-sm dark:border-slate-800">
        <div className="p-6"><h2 className="border-b-2 border-slate-100 pb-3 text-sm font-bold uppercase tracking-wide text-slate-900 dark:border-slate-800 dark:text-slate-100">Ad Spend vs Ad-driven Orders</h2></div>
        <div className="px-6 pb-6">
          <div className="mb-4 flex items-center justify-center gap-6 text-sm font-semibold text-slate-600">
            <span className="inline-flex items-center gap-2"><span className="h-4 w-8 rounded-sm bg-sky-500" />Ad Spend</span>
            <span className="inline-flex items-center gap-2"><span className="h-1 w-8 bg-emerald-500" />Orders</span>
          </div>
          <div className="relative h-80 w-full"><MarketingPerformanceChart weekly={weekly} /></div>
        </div>
      </section>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border-2 border-slate-200 bg-card shadow-sm dark:border-slate-800">
          <div className="p-6"><h2 className="border-b-2 border-slate-100 pb-3 text-sm font-bold uppercase tracking-wide text-slate-900 dark:border-slate-800 dark:text-slate-100">Top Performing Products (Ad-driven)</h2></div>
          <div className="divide-y-2 divide-slate-100 px-6 dark:divide-slate-900">
            {topProducts.length ? topProducts.map((product, index) => (
              <div key={`${product.name}-${index}`} className="flex items-center justify-between gap-4 py-5">
                <div className="min-w-0"><p className="truncate font-bold text-slate-900 dark:text-slate-100">{index + 1}. {product.name}</p><p className="mt-1 text-xs font-semibold text-slate-500">Ad-attributed product sales</p></div>
                <span className="whitespace-nowrap rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-bold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">{product.orders} orders</span>
              </div>
            )) : <div className="py-10 text-center text-sm font-semibold text-slate-500">No ad-driven product data yet.</div>}
          </div>
        </section>
        <section className="rounded-xl border-2 border-slate-200 bg-card shadow-sm dark:border-slate-800">
          <div className="p-6"><h2 className="border-b-2 border-slate-100 pb-3 text-sm font-bold uppercase tracking-wide text-slate-900 dark:border-slate-800 dark:text-slate-100">Spend by Channel</h2></div>
          <div className="space-y-5 px-6 pb-6">
            {channelBreakdown.rows.length ? channelBreakdown.rows.map((row, index) => (
              <div key={row.channel}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate font-bold text-slate-900 dark:text-slate-100">{row.channel}</p>
                  <p className="whitespace-nowrap text-sm font-black text-slate-900 dark:text-slate-100">{amount(row.spend)} <span className="text-xs font-bold text-slate-400">MMK · {row.share.toFixed(1)}%</span></p>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className="h-full rounded-full transition-all duration-300" style={{ width: `${Math.min(100, row.share)}%`, backgroundColor: channelColors[index % channelColors.length] }} />
                </div>
                <p className="mt-1.5 text-xs font-semibold text-slate-500">
                  {row.orders} orders
                  {row.orders > 0 ? ` · ${amount(Math.round(row.costPerOrder))} MMK/order` : " · no orders yet"}
                  {row.reach > 0 && ` · ${amount(row.reach)} reach`}
                </p>
              </div>
            )) : <div className="py-10 text-center text-sm font-semibold text-slate-500">No channel data yet for this period.</div>}
          </div>
        </section>
      </div>

      {/* Marketing Metrics Table with CRUD */}
      <section className="overflow-hidden rounded-xl border-2 border-slate-200 bg-card shadow-sm dark:border-slate-800">
        <div className="border-b-2 border-slate-200 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-950/40">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-black text-slate-900 dark:text-slate-100">
                <Megaphone className="h-5 w-5 text-sky-600" />
                Marketing Campaigns &amp; Ad Metrics Table
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">Track channel spend, reach, leads, and conversion efficiency.</p>
            </div>
            <Button size="sm" className="h-9 bg-sky-600 hover:bg-sky-700 text-white font-bold cursor-pointer" onClick={openAddMetric}>
              <Plus className="mr-1.5 h-4 w-4" /> Add Campaign Metric
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b-2 border-slate-200 bg-slate-50/60 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950/40">
              <tr>
                <th className="px-5 py-4">Date</th>
                <th className="px-5 py-4">Channel</th>
                <th className="px-5 py-4 text-right">Spend (MMK)</th>
                <th className="px-5 py-4 text-center">Reach / Impr</th>
                <th className="px-5 py-4 text-center">Leads</th>
                <th className="px-5 py-4 text-center">Ad Orders</th>
                <th className="px-5 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-slate-100 dark:divide-slate-900">
              {isLoadingMetrics ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-xs text-muted-foreground animate-pulse">Loading marketing records...</td></tr>
              ) : isMetricsError ? (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-sm">
                  <p className="font-semibold text-red-600 dark:text-red-400">Couldn&apos;t load marketing records. Check your connection and try again.</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => void refetchMetrics()}>Retry</Button>
                </td></tr>
              ) : pagedMetrics.length > 0 ? (
                pagedMetrics.map((metric) => (
                  <tr key={metric.id} className="transition hover:bg-slate-50 dark:hover:bg-slate-950/50">
                    <td className="whitespace-nowrap px-5 py-4 text-xs font-bold text-slate-600 dark:text-slate-400">
                      {metric.metricDate ? metric.metricDate.slice(0, 10) : '—'}
                    </td>
                    <td className="px-5 py-4 font-bold text-xs text-slate-900 dark:text-slate-100">{metric.channel}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-right text-xs font-black text-rose-600 dark:text-rose-400">
                      {amount(metric.spend)} MMK
                    </td>
                    <td className="px-5 py-4 text-center text-xs font-semibold">{amount(metric.reach || metric.impressions || 0)}</td>
                    <td className="px-5 py-4 text-center text-xs font-semibold text-violet-600">{metric.leads || 0}</td>
                    <td className="px-5 py-4 text-center text-xs font-black text-emerald-600">{metric.adDrivenOrders || 0}</td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700" onClick={() => openEditMetric(metric)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700" onClick={() => setDeleteMetric(metric)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-500">No marketing records found for this period.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {totalMetricPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 bg-card/20 px-6 py-4">
            <div className="text-xs text-muted-foreground font-mono">
              Showing Page <span className="text-foreground font-bold">{metricPage}</span> of <span className="text-foreground font-bold">{totalMetricPages}</span> ({metrics.length} total)
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={metricPage <= 1} onClick={() => setMetricPage((p) => Math.max(1, p - 1))} className="bg-card border-border text-foreground hover:bg-muted cursor-pointer">
                <ChevronLeft className="w-4 h-4 mr-1" />
                Prev
              </Button>
              <Button variant="outline" size="sm" disabled={metricPage >= totalMetricPages} onClick={() => setMetricPage((p) => Math.min(totalMetricPages, p + 1))} className="bg-card border-border text-foreground hover:bg-muted cursor-pointer">
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Metric Add/Edit Dialog */}
      <Dialog open={metricDialogOpen} onOpenChange={setMetricDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingMetric ? 'Edit Marketing Metric' : 'Record Marketing Metric'}</DialogTitle>
            <DialogDescription>Record advertising spend, reach, and order attribution.</DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={saveMetric}>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <label className="text-xs font-bold">Date</label>
                <Input type="date" value={metricForm.metricDate} onChange={(e) => setMetricForm({ ...metricForm, metricDate: e.target.value })} required />
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs font-bold">Channel</label>
                <Select value={metricForm.channel} onValueChange={(val) => setMetricForm({ ...metricForm, channel: val ?? 'Facebook' })}>
                  <SelectTrigger className="text-xs font-bold">{metricForm.channel}</SelectTrigger>
                  <SelectContent>
                    {['Facebook', 'TikTok', 'Google', 'Viber', 'Telegram', 'Instagram', 'Other'].map((ch) => (
                      <SelectItem key={ch} value={ch}>{ch}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs font-bold">Campaign Name</label>
              <Input value={metricForm.campaignName} onChange={(e) => setMetricForm({ ...metricForm, campaignName: e.target.value })} placeholder="e.g. Summer Promo 2026" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <label className="text-xs font-bold">Spend (MMK) *</label>
                <Input type="number" value={metricForm.spend} onChange={(e) => setMetricForm({ ...metricForm, spend: e.target.value })} placeholder="0" required />
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs font-bold">Reach / Impressions</label>
                <Input type="number" value={metricForm.reach} onChange={(e) => setMetricForm({ ...metricForm, reach: e.target.value })} placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <label className="text-xs font-bold">Leads Generated</label>
                <Input type="number" value={metricForm.leads} onChange={(e) => setMetricForm({ ...metricForm, leads: e.target.value })} placeholder="0" />
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs font-bold">Ad-driven Orders</label>
                <Input type="number" value={metricForm.adDrivenOrders} onChange={(e) => setMetricForm({ ...metricForm, adDrivenOrders: e.target.value })} placeholder="0" />
              </div>
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs font-bold">Notes</label>
              <Input value={metricForm.notes} onChange={(e) => setMetricForm({ ...metricForm, notes: e.target.value })} placeholder="Targeting details, notes" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setMetricDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSaving} className="bg-sky-600 hover:bg-sky-700 text-white font-bold">{isSaving ? 'Saving...' : editingMetric ? 'Save Changes' : 'Record Metric'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={Boolean(deleteMetric)} onOpenChange={(open) => !open && setDeleteMetric(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this marketing metric?</AlertDialogTitle>
            <AlertDialogDescription>This metric entry will be moved to Trash.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={isDeleting} className="bg-red-600 text-white hover:bg-red-700 font-bold" onClick={confirmDeleteMetric}>{isDeleting ? 'Deleting...' : 'Move to Trash'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
