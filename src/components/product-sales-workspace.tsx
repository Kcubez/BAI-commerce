'use client';

import {
  useEffect,
  useState,
} from 'react';

import {
  useQueryClient,
} from '@tanstack/react-query';

import {
  CalendarCheck,
  DollarSign,
  Megaphone,
  Target,
  Trash2,
  TrendingUp,
  Users,
  Wallet,
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
import {
  useCommerceDashboard,
  useCommerceRecommendations,
  useCommerceWorkspaces,
  useSaveCommerceTargets,
} from '@/hooks/use-commerce-dashboard';
import type {
  CommerceDashboardParams,
} from '@/lib/api';
import {
  commerceDashboardKeys,
} from '@/hooks/use-commerce-dashboard';
import {
  dealsKeys,
} from '@/hooks/use-deals';
import {
  marketingMetricKeys,
} from '@/hooks/use-marketing-metrics';
import {
  trashKeys,
} from '@/hooks/use-trash';
import {
  useDateFilter,
} from '@/hooks/use-date-filter';
import {
  CustomerServiceView,
} from '@/components/customer-service-view';
import {
  periodRangeLabel,
  ProgressCard,
  SmartSuggestions,
  BusinessOverviewAnalytics,
} from '@/components/commerce/shared-charts';
import {
  FinanceWorkspace,
} from '@/components/commerce/finance-workspace';
import {
  SalesWorkspace,
} from '@/components/commerce/sales-workspace';
import {
  MarketingWorkspace,
} from '@/components/commerce/marketing-workspace';
import {
  InventoryWorkspace,
} from '@/components/commerce/inventory-workspace';
import {
  amount,
} from '@/components/commerce/shared-charts';
import {
  commerceCustomersKeys,
} from '@/hooks/use-commerce-customers';
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

type Workspace = 'overview' | 'finance' | 'sales' | 'marketing' | 'customers' | 'inventory';

// ─── Sales Workspace with Full CRUD Deals Table ─────────────────────────────

// ─── Marketing Workspace with Full CRUD Metrics Table ───────────────────────

// ─── Inventory Workspace with Full CRUD Products Table ──────────────────────

export function ProductSalesWorkspace({ workspace }: { workspace: Workspace }) {
  const queryClient = useQueryClient();
  const {
    period,
    month,
    day,
    year,
    customFrom,
    customTo,
    updatePeriod,
    years: filterYears,
    dateFrom,
    dateTo,
  } = useDateFilter('workspace_filter');
  const [isTargetDialogOpen, setIsTargetDialogOpen] = useState(false);
  // Start blank like BAI-service: only values the owner actually saved are
  // prefilled, never hardcoded defaults.
  const [targetRevenue, setTargetRevenue] = useState('');
  const [targetExpense, setTargetExpense] = useState('');
  const [targetOrders, setTargetOrders] = useState('');
  const [targetFulfilledOrders, setTargetFulfilledOrders] = useState('');
  const [targetNewCustomers, setTargetNewCustomers] = useState('');
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const overview = workspace === 'overview';
  const dashboardParams: CommerceDashboardParams = {
    period,
    year: Number(year),
    month: Number(month),
    ...(period === 'day' ? { day: Number(day) } : {}),
    ...(period === 'custom' ? { from: customFrom, to: customTo } : {}),
  };
  const { data: dashboard } = useCommerceDashboard(dashboardParams, overview);
  const { data: workspaceData } = useCommerceWorkspaces(dashboardParams, !overview);
  const { data: recommendationsData, isLoading: recsLoading } = useCommerceRecommendations(dashboardParams, true);
  const saveTargets = useSaveCommerceTargets();
  const content = {
    overview: ['Business Overview', 'Daily intelligence feed and target pacing.'],
    finance: ['Finance', 'Revenue, expense, and category-level cost control.'],
    sales: ['Sales', 'Deal pipeline, order performance, and follow-up actions.'],
    marketing: ['Marketing', 'Ad performance and spend efficiency.'],
    customers: ['Customer Service', 'Leads, inquiries, and customer relationships.'],
    inventory: ['Product & Inventory', 'Catalog, stock levels, and restock alerts.'],
  }[workspace];

  useEffect(() => {
    if (!dashboard?.targets) return;
    const prefill = (value: number | null) => (value !== null && value !== undefined ? String(value) : '');
    setTargetRevenue(prefill(dashboard.targets.targetSalesAmount));
    setTargetExpense(prefill(dashboard.targets.targetExpenseAmount));
    setTargetOrders(prefill(dashboard.targets.targetDemandCount));
    setTargetFulfilledOrders(prefill(dashboard.targets.targetAppointments));
    setTargetNewCustomers(prefill(dashboard.targets.targetNewCustomers));
  }, [dashboard?.targets]);

  const iconMap = {
    DollarSign,
    Wallet,
    TrendingUp,
    Megaphone,
    CalendarCheck,
    Users,
  };

  // Loading placeholders — no fake targets, matching the API's "Not set" state.
  const fallbackOverviewCards = [
    ['Revenue', amount(0), 'Not set', 'Set targets to track pacing', 'Not Set', 'slate', DollarSign, 0],
    ['Expense Limit', amount(0), 'Not set', 'Set targets to track pacing', 'Not Set', 'slate', Wallet, 0],
    ['Profit Margin', '0.0%', 'Not set', 'Set revenue & expense targets', 'Not Set', 'slate', TrendingUp, 0],
    ['Orders Received', '0', 'Not set', 'Set targets to track pacing', 'Not Set', 'slate', Megaphone, 0],
    ['Orders Fulfilled', '0', 'Not set', 'Set targets to track pacing', 'Not Set', 'slate', CalendarCheck, 0],
    ['New Customers', '0', 'Not set', 'Set targets to track pacing', 'Not Set', 'slate', Users, 0],
  ] as const;

  const cards = [
    ...(dashboard?.kpis.map((kpi) => [kpi.title, kpi.value, kpi.target, kpi.expected, kpi.status, kpi.tone, iconMap[kpi.icon], kpi.progressPercent] as const) ?? fallbackOverviewCards),
  ] as const;

  // Targets are stored per calendar period (month/year), matching
  // /api/settings/target. Non-calendar views anchor to their range's month.
  const targetAnchorParams = () => {
    if (period === 'year') return { period: 'year' as const, year: Number(year), month: 0 };
    if (period === 'month' || period === 'day') return { period: 'month' as const, year: Number(year), month: Number(month) };
    const base = period === 'custom' && customFrom ? new Date(`${customFrom}T00:00:00Z`) : new Date();
    return { period: 'month' as const, year: base.getUTCFullYear(), month: base.getUTCMonth() + 1 };
  };
  const anchor = targetAnchorParams();
  const anchorLabel = anchor.period === 'year'
    ? `${anchor.year} (Yearly)`
    : new Date(anchor.year, anchor.month - 1).toLocaleString('en', { month: 'long', year: 'numeric' });

  function handleSaveTargets() {
    const orNull = (value: string) => (value.trim() === '' ? null : Number(value));
    saveTargets.mutate({
      period: anchor.period,
      year: anchor.year,
      month: anchor.month,
      // Blank inputs clear the target (null) instead of saving zeros.
      targetSalesAmount: orNull(targetRevenue),
      targetExpenseAmount: orNull(targetExpense),
      targetDemandCount: orNull(targetOrders),
      targetAppointments: orNull(targetFulfilledOrders),
      targetNewCustomers: orNull(targetNewCustomers),
    }, {
      onSuccess: () => setIsTargetDialogOpen(false),
    });
  }

  async function handleDeleteAll() {
    setIsDeleting(true);
    try {
      const search = new URLSearchParams({ workspace });
      if ((period === 'month' || period === 'day' || period === 'year' || period === 'custom') && dateFrom && dateTo) {
        search.set('from', dateFrom);
        search.set('to', dateTo);
      }
      const response = await fetch(`/api/commerce/delete-all?${search.toString()}`, { method: 'DELETE' });
      const result = await response.json() as { count?: number; message?: string };
      if (!response.ok) throw new Error(result.message ?? 'Unable to move records to Trash');
      toast.success(`${result.count ?? 0} ${content[0]} record${result.count === 1 ? '' : 's'} moved to Trash`);
      // Refresh every workspace view (and Trash) so the deletion shows immediately.
      // Note: deals + marketing-metrics power their own tables via useDeals /
      // useMarketingMetrics, so they must be invalidated too — otherwise the
      // KPIs clear to 0 while the table keeps stale rows until a refresh.
      await queryClient.invalidateQueries({ queryKey: dealsKeys.all });
      await queryClient.invalidateQueries({ queryKey: marketingMetricKeys.all });
      await queryClient.invalidateQueries({ queryKey: commerceDashboardKeys.all });
      await queryClient.invalidateQueries({ queryKey: commerceCustomersKeys.all });
      await queryClient.invalidateQueries({ queryKey: trashKeys.all });
      setIsDeleteAllOpen(false);
      setDeleteConfirmText('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to move records to Trash');
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <main className="space-y-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-1 font-heading">{content[0]}</h1>
          <p className="text-muted-foreground text-sm">{content[1]}</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 rounded-xl border border-slate-200/80 bg-white/70 p-1.5 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/60 lg:w-auto">
          <Select value={period} onValueChange={(value) => {
            if (value === 'overall' || value === 'day' || value === 'month' || value === 'year' || value === 'custom') {
              updatePeriod({ period: value });
            }
          }}>
            <SelectTrigger className="h-9 w-36 rounded-lg border border-slate-200 bg-background text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 dark:text-slate-200">
              {period === 'overall' ? 'Overall' : period === 'year' ? 'Yearly' : period === 'day' ? 'Daily' : period === 'custom' ? 'Custom range' : 'Monthly'}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="overall">Overall</SelectItem>
              <SelectItem value="day">Daily</SelectItem>
              <SelectItem value="month">Monthly</SelectItem>
              <SelectItem value="year">Yearly</SelectItem>
              <SelectItem value="custom">Custom range</SelectItem>
            </SelectContent>
          </Select>
          {period === 'custom' ? (
            <div className="flex items-center gap-1.5">
              <Input type="date" value={customFrom} onChange={(event) => updatePeriod({ customFrom: event.target.value })} className="h-9 w-40 rounded-lg border border-slate-200 bg-background text-sm font-semibold shadow-sm dark:border-slate-700" aria-label="Start date" />
              <span className="px-1 text-xs font-medium text-muted-foreground">to</span>
              <Input type="date" value={customTo} min={customFrom} onChange={(event) => updatePeriod({ customTo: event.target.value })} className="h-9 w-40 rounded-lg border border-slate-200 bg-background text-sm font-semibold shadow-sm dark:border-slate-700" aria-label="End date" />
            </div>
          ) : period === 'day' ? (
            <Input
              type="date"
              value={`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`}
              onChange={(event) => {
                const next = new Date(`${event.target.value}T00:00:00`);
                if (!Number.isNaN(next.getTime())) updatePeriod({ year: next.getFullYear(), month: next.getMonth() + 1, day: next.getDate() });
              }}
              className="h-9 w-40 rounded-lg border border-slate-200 bg-background text-sm font-semibold shadow-sm dark:border-slate-700"
              aria-label="Select day"
            />
          ) : period === 'month' ? (
            <Select value={String(month)} onValueChange={(value) => {
              if (value) updatePeriod({ month: Number(value) });
            }}>
              <SelectTrigger className="h-9 w-32 rounded-lg border border-slate-200 bg-background text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 dark:text-slate-200">
                {new Date(Number(year), Number(month) - 1, 1).toLocaleString('en', { month: 'long' })}
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }).map((_, index) => (
                  <SelectItem key={index + 1} value={String(index + 1)}>
                    {new Date(Number(year), index, 1).toLocaleString('en', { month: 'long' })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          {period !== 'day' && period !== 'overall' && period !== 'custom' && (
            <Select value={String(year)} onValueChange={(value) => {
              if (value) updatePeriod({ year: Number(value) });
            }}>
              <SelectTrigger className="h-9 w-24 rounded-lg border border-slate-200 bg-background text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 dark:text-slate-200">
                {year}
              </SelectTrigger>
              <SelectContent>
                {filterYears.map((itemYear) => (
                  <SelectItem key={itemYear} value={String(itemYear)}>
                    {itemYear}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {overview ? (
            <Button onClick={() => setIsTargetDialogOpen(true)} variant="outline" className="h-9 rounded-lg border-2 border-slate-300 dark:border-slate-800 bg-card hover:bg-slate-50 dark:hover:bg-slate-800/80 text-xs font-bold gap-1.5 px-3 cursor-pointer"><Target className="w-4 h-4 text-emerald-500 animate-pulse" />Set Targets</Button>
          ) : (
            <Button onClick={() => { setDeleteConfirmText(''); setIsDeleteAllOpen(true); }} variant="outline" className="h-9 rounded-lg shrink-0 cursor-pointer bg-red-950/20 border-red-900/50 text-red-700 dark:text-red-300 hover:bg-red-900/40 hover:text-red-800 dark:hover:text-red-200 text-xs font-bold gap-1.5 px-3"><Trash2 className="w-4 h-4" />Delete All</Button>
          )}
        </div>
      </header>

      {workspace === 'finance' ? (
        <FinanceWorkspace
          data={workspaceData?.finance}
          recommendations={recommendationsData?.recommendations}
          isRecommendationsLoading={recsLoading}
          defaultDate={dateFrom}
        />
      ) : workspace === 'sales' ? (
        <SalesWorkspace
          data={workspaceData?.sales}
          recommendations={recommendationsData?.recommendations}
          isRecommendationsLoading={recsLoading}
          dateFrom={dateFrom}
          dateTo={dateTo}
        />
      ) : workspace === 'marketing' ? (
        <MarketingWorkspace
          data={workspaceData?.marketing}
          recommendations={recommendationsData?.recommendations}
          isRecommendationsLoading={recsLoading}
          dateFrom={dateFrom}
          dateTo={dateTo}
        />
      ) : workspace === 'customers' ? (
        <CustomerServiceView params={dashboardParams} dateFrom={dateFrom} dateTo={dateTo} />
      ) : workspace === 'inventory' ? (
        <InventoryWorkspace
          data={workspaceData?.inventory}
          recommendations={recommendationsData?.recommendations}
          isRecommendationsLoading={recsLoading}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {cards.map(([title, value, target, expected, status, tone, icon, progressPercent]) => (
              <ProgressCard
                key={title}
                title={title}
                value={value}
                target={target}
                expected={expected}
                status={status}
                tone={tone}
                icon={icon}
                progressPercent={progressPercent}
              />
            ))}
          </div>

          <SmartSuggestions
            recommendations={recommendationsData?.recommendations}
            isLoading={recsLoading}
            onSetTargets={() => setIsTargetDialogOpen(true)}
            areaFilter="general"
          />

          <BusinessOverviewAnalytics
            dashboard={dashboard}
            periodLabel={periodRangeLabel(period, year, month, day, customFrom, customTo)}
          />
        </>
      )}

      <Dialog open={isTargetDialogOpen} onOpenChange={setIsTargetDialogOpen}>
        <DialogContent showCloseButton={false} className="w-full max-w-md rounded-xl border border-slate-200 bg-card p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto dark:border-slate-800">
          <DialogHeader className="flex-row items-center justify-between border-b border-border pb-3">
            <div>
              <DialogTitle className="font-extrabold text-foreground flex items-center gap-2"><Target className="w-5 h-5 text-emerald-500" />Set Period Targets</DialogTitle>
              <DialogDescription className="mt-0.5 text-[11px] font-bold uppercase tracking-wide">Saved for {anchorLabel}</DialogDescription>
            </div>
            <Button aria-label="Close target settings" variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground" onClick={() => setIsTargetDialogOpen(false)}>✕</Button>
          </DialogHeader>
          <div className="space-y-4 text-xs font-semibold text-foreground">
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Target Revenue (KS)<Input className="mt-1.5 h-10 text-xs bg-muted border-border font-bold" value={targetRevenue} onChange={(event) => setTargetRevenue(event.target.value)} inputMode="numeric" /></label>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Target Expense (KS)<Input className="mt-1.5 h-10 text-xs bg-muted border-border font-bold" value={targetExpense} onChange={(event) => setTargetExpense(event.target.value)} inputMode="numeric" /></label>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Target Orders Received<Input className="mt-1.5 h-10 text-xs bg-muted border-border font-bold" value={targetOrders} onChange={(event) => setTargetOrders(event.target.value)} inputMode="numeric" /></label>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Target Orders Fulfilled<Input className="mt-1.5 h-10 text-xs bg-muted border-border font-bold" value={targetFulfilledOrders} onChange={(event) => setTargetFulfilledOrders(event.target.value)} inputMode="numeric" /></label>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Target New Customers<Input className="mt-1.5 h-10 text-xs bg-muted border-border font-bold" value={targetNewCustomers} onChange={(event) => setTargetNewCustomers(event.target.value)} inputMode="numeric" /></label>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="outline" size="sm" className="border-border text-foreground rounded-lg" onClick={() => setIsTargetDialogOpen(false)} disabled={saveTargets.isPending}>Cancel</Button>
            <Button size="sm" onClick={handleSaveTargets} disabled={saveTargets.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-4">{saveTargets.isPending ? 'Saving…' : 'Save Targets'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteAllOpen} onOpenChange={(open) => { setIsDeleteAllOpen(open); if (!open) setDeleteConfirmText(''); }}>
        <AlertDialogContent className="bg-card border-border text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all {content[0].toLowerCase()} records?</AlertDialogTitle>
            <AlertDialogDescription>All active records in this workspace will be moved to Trash. Type <strong>confirm</strong> to continue.</AlertDialogDescription>
          </AlertDialogHeader>
          <label className="grid gap-2 text-sm font-semibold text-foreground">Type confirm to move these records to Trash
            <Input value={deleteConfirmText} onChange={(event) => setDeleteConfirmText(event.target.value)} disabled={isDeleting} placeholder="confirm" className="h-10 font-mono" />
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border text-foreground" disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(event) => { event.preventDefault(); void handleDeleteAll(); }} disabled={isDeleting || deleteConfirmText.toLowerCase() !== 'confirm'} className="bg-red-600 hover:bg-red-700 text-white">{isDeleting ? 'Deleting…' : 'Move to Trash'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
