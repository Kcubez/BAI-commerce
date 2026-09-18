/** Sales workspace (deals CRUD).
 * Extracted verbatim from product-sales-workspace.
 */
'use client';
import {
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
  Package,
  Pencil,
  Plus,
  Trash2,
  TrendingUp,
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
  DealRecord,
} from '@/lib/api';
import {
  commerceDashboardKeys,
} from '@/hooks/use-commerce-dashboard';
import {
  dealsKeys,
  useDeals,
} from '@/hooks/use-deals';
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
  SmartSuggestions,
} from '@/components/commerce/shared-charts';

export function SalesWorkspace({ data, recommendations, isRecommendationsLoading, dateFrom, dateTo }: { data?: CommerceWorkspaceData['sales']; recommendations?: CommerceActionRecommendation[]; isRecommendationsLoading: boolean; dateFrom?: string; dateTo?: string }) {
  const queryClient = useQueryClient();
  const {
    data: dealsData,
    isLoading: isLoadingDeals,
    isError: isDealsError,
    refetch: refetchDeals,
  } = useDeals({ dateFrom, dateTo });
  const deals = dealsData?.deals ?? [];
  const [stageFilter, setStageFilter] = useState('ALL');
  const [dealSearch, setDealSearch] = useState('');
  const [dealDialogOpen, setDealDialogOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<DealRecord | null>(null);
  const [deleteDeal, setDeleteDeal] = useState<DealRecord | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [dealForm, setDealForm] = useState({
    quotedAmount: '',
    stage: 'NEW_LEAD',
    fulfillmentStatus: 'PENDING',
    sourceChannel: 'Direct',
    note: '',
  });

  const openAddDeal = () => {
    setEditingDeal(null);
    setDealForm({
      quotedAmount: '',
      stage: 'NEW_LEAD',
      fulfillmentStatus: 'PENDING',
      sourceChannel: 'Direct',
      note: '',
    });
    setDealDialogOpen(true);
  };

  const openEditDeal = (deal: DealRecord) => {
    setEditingDeal(deal);
    setDealForm({
      quotedAmount: deal.quotedAmount ? String(deal.quotedAmount) : '',
      stage: deal.stage || 'NEW_LEAD',
      fulfillmentStatus: deal.fulfillmentStatus || 'PENDING',
      sourceChannel: deal.sourceChannel || 'Direct',
      note: deal.note || '',
    });
    setDealDialogOpen(true);
  };

  const saveDeal = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {
        stage: dealForm.stage,
        fulfillmentStatus: dealForm.fulfillmentStatus,
        sourceChannel: dealForm.sourceChannel,
        quotedAmount: dealForm.quotedAmount ? Number(dealForm.quotedAmount) : null,
        note: dealForm.note.trim() || null,
      };

      const res = await fetch('/api/deals', {
        method: editingDeal ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingDeal ? { id: editingDeal.id, ...payload } : payload),
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        throw new Error(
          typeof errorBody?.message === 'string' && errorBody.message
            ? errorBody.message
            : 'Failed to save deal',
        );
      }
      toast.success(editingDeal ? 'Deal updated' : 'Deal created');
      setDealDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: dealsKeys.all });
      await queryClient.invalidateQueries({ queryKey: commerceDashboardKeys.all });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error saving deal');
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDeleteDeal = async () => {
    if (!deleteDeal) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/deals?id=${deleteDeal.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete deal');
      toast.success('Deal moved to Trash');
      setDeleteDeal(null);
      await queryClient.invalidateQueries({ queryKey: dealsKeys.all });
      await queryClient.invalidateQueries({ queryKey: commerceDashboardKeys.all });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error deleting deal');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredDeals = deals.filter((deal) => {
    const matchesStage = stageFilter === 'ALL' || deal.stage === stageFilter;
    const query = dealSearch.trim().toLowerCase();
    const matchesSearch = !query ||
      (deal.customer?.name && deal.customer.name.toLowerCase().includes(query)) ||
      (deal.note && deal.note.toLowerCase().includes(query)) ||
      (deal.sourceChannel && deal.sourceChannel.toLowerCase().includes(query));
    return matchesStage && matchesSearch;
  });

  const [dealPage, setDealPage] = useState(1);
  const dealPageSize = 10;
  const totalDealPages = Math.max(1, Math.ceil(filteredDeals.length / dealPageSize));
  const pagedDeals = filteredDeals.slice((dealPage - 1) * dealPageSize, dealPage * dealPageSize);

  const stageColors = [
    ['border-sky-500', 'bg-sky-50 dark:bg-sky-950/20'],
    ['border-violet-500', 'bg-violet-50 dark:bg-violet-950/20'],
    ['border-amber-500', 'bg-amber-50 dark:bg-amber-950/20'],
    ['border-emerald-500', 'bg-emerald-50 dark:bg-emerald-950/20'],
  ];
  const stages = (data?.stages.length ? data.stages : [
    { label: 'New Leads', count: 0, deals: [] },
    { label: 'Quoted', count: 0, deals: [] },
    { label: 'Pending Delivery', count: 0, deals: [] },
    { label: 'Closed Won', count: 0, deals: [] },
  ]).map((stage, index) => ({ ...stage, color: stageColors[index]?.[0] ?? 'border-slate-500', bg: stageColors[index]?.[1] ?? 'bg-slate-50 dark:bg-slate-950/20' }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <FinanceKpiCard label="Total Sales" value={amount(data?.kpis.totalSales ?? 0)} unit="MMK" icon={DollarSign} accentClass="border-l-4 border-l-sky-500" />
        <FinanceKpiCard label="Orders" value={amount(data?.kpis.orders ?? 0)} icon={Megaphone} accentClass="border-l-4 border-l-violet-500" />
        <FinanceKpiCard label="Pending Deliveries" value={amount(data?.kpis.pendingDeliveries ?? 0)} icon={Package} accentClass="border-l-4 border-l-amber-500" />
        <FinanceKpiCard label="Deals in Pipeline" value={amount(data?.kpis.pipelineDeals ?? 0)} icon={TrendingUp} accentClass="border-l-4 border-l-emerald-500" />
      </div>

      <SmartSuggestions recommendations={recommendations} isLoading={isRecommendationsLoading} areaFilter="sales" />

      <section className="rounded-xl border-2 border-slate-200 bg-card shadow-sm dark:border-slate-800">
        <div className="flex flex-col gap-3 border-b-2 border-slate-200 bg-slate-50/60 p-6 dark:border-slate-800 dark:bg-slate-950/40 md:flex-row md:items-center md:justify-between">
          <div><h2 className="text-sm font-bold uppercase tracking-wide text-slate-900 dark:text-slate-100">Deal Pipeline Flow</h2><p className="mt-1 text-xs text-muted-foreground">Deals grouped by their current sales stage with visual progress bars.</p></div>
          <span className="text-xs font-bold text-muted-foreground border-2 border-border bg-muted px-3 py-1 rounded-full">{amount(data?.kpis.pipelineDeals ?? 0)} Active Deals</span>
        </div>
        <div className="grid grid-cols-1 gap-4 p-6 lg:grid-cols-4">
          {stages.map((stage) => {
            const totalDealsCount = data?.kpis.orders || stages.reduce((s, st) => s + st.count, 0) || 1;
            const pct = Math.min(100, Math.round((stage.count / totalDealsCount) * 100));
            return (
              <section key={stage.label} className={`rounded-xl border-t-4 ${stage.color} ${stage.bg} p-4 flex flex-col justify-between`}>
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-extrabold uppercase tracking-wide text-slate-700 dark:text-slate-200">{stage.label}</h3>
                    <span className="text-xs font-black text-slate-900 dark:text-slate-100 font-mono">{stage.count}</span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                    <div className="h-full rounded-full bg-sky-500 transition-all duration-300" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1 text-[10px] font-semibold text-slate-500">{pct}% of pipeline volume</p>
                </div>
                <div className="mt-3 space-y-2">
                  {stage.deals.length > 0 ? (
                    stage.deals.map((deal) => (
                      <div key={deal.id} className="w-full rounded-lg border border-slate-200 bg-card p-2.5 text-left text-xs font-bold text-slate-700 shadow-sm dark:border-slate-800 dark:text-slate-200">
                        <span className="block truncate">{deal.customer}</span>
                        <span className="mt-0.5 block text-[10px] font-semibold text-slate-500">{amount(deal.amount)} MMK</span>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 p-2 text-center text-[10px] text-slate-400">No active deals</div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </section>

      {/* Deals Table with CRUD */}
      <section className="overflow-hidden rounded-xl border-2 border-slate-200 bg-card shadow-sm dark:border-slate-800">
        <div className="border-b-2 border-slate-200 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-950/40">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-black text-slate-900 dark:text-slate-100">
                <TrendingUp className="h-5 w-5 text-sky-600" />
                Deals &amp; Orders Table
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">Manage and track deals, quoted prices, stages, and order fulfillment.</p>
            </div>
            <div className="flex items-center gap-2">
              <Input placeholder="Search deals..." value={dealSearch} onChange={(e) => { setDealSearch(e.target.value); setDealPage(1); }} className="h-9 w-48 bg-card text-xs font-semibold" />
              <Select value={stageFilter} onValueChange={(val) => { setStageFilter(val ?? 'ALL'); setDealPage(1); }}>
                <SelectTrigger className="h-9 w-36 text-xs font-bold bg-card">{stageFilter === 'ALL' ? 'All Stages' : stageFilter}</SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Stages</SelectItem>
                  <SelectItem value="NEW_LEAD">New Lead</SelectItem>
                  <SelectItem value="QUOTED">Quoted</SelectItem>
                  <SelectItem value="FOLLOW_UP_NEEDED">Follow-up</SelectItem>
                  <SelectItem value="PENDING">Pending Delivery</SelectItem>
                  <SelectItem value="WON">Won / Completed</SelectItem>
                  <SelectItem value="LOST">Lost</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" className="h-9 bg-sky-600 hover:bg-sky-700 text-white font-bold cursor-pointer" onClick={openAddDeal}>
                <Plus className="mr-1.5 h-4 w-4" /> Add Deal
              </Button>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b-2 border-slate-200 bg-slate-50/60 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950/40">
              <tr>
                <th className="px-5 py-4">Date</th>
                <th className="px-5 py-4">Customer</th>
                <th className="px-5 py-4 text-right">Quoted Amount</th>
                <th className="px-5 py-4 text-center">Stage</th>
                <th className="px-5 py-4 text-center">Fulfillment</th>
                <th className="px-5 py-4">Channel / Notes</th>
                <th className="px-5 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-slate-100 dark:divide-slate-900">
              {isLoadingDeals ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-xs text-muted-foreground animate-pulse">Loading deals...</td></tr>
              ) : isDealsError ? (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-sm">
                  <p className="font-semibold text-red-600 dark:text-red-400">Couldn&apos;t load deals. Check your connection and try again.</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => void refetchDeals()}>Retry</Button>
                </td></tr>
              ) : pagedDeals.length > 0 ? (
                pagedDeals.map((deal) => (
                  <tr key={deal.id} className="transition hover:bg-slate-50 dark:hover:bg-slate-950/50">
                    <td className="whitespace-nowrap px-5 py-4 text-xs font-bold text-slate-600 dark:text-slate-400">
                      {new Date(deal.createdAt).toLocaleDateString(undefined, { timeZone: "UTC" })}
                    </td>
                    <td className="px-5 py-4 text-xs font-semibold text-slate-600 dark:text-slate-400">{deal.customer?.name || '—'}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-right text-xs font-black text-sky-600 dark:text-sky-400">
                      {deal.quotedAmount ? `${amount(deal.quotedAmount)} MMK` : '—'}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="rounded-full border border-slate-200 bg-slate-50 dark:bg-slate-900 px-2.5 py-1 text-[10px] font-extrabold uppercase text-slate-700 dark:text-slate-300">
                        {deal.stage}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase ${deal.fulfillmentStatus === 'FULFILLED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                        {deal.fulfillmentStatus}
                      </span>
                    </td>
                    <td className="max-w-40 truncate px-5 py-4 text-xs text-slate-500">{deal.sourceChannel || deal.note || '—'}</td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700" onClick={() => openEditDeal(deal)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700" onClick={() => setDeleteDeal(deal)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-500">No deals found for this period.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {totalDealPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 bg-card/20 px-6 py-4">
            <div className="text-xs text-muted-foreground font-mono">
              Showing Page <span className="text-foreground font-bold">{dealPage}</span> of <span className="text-foreground font-bold">{totalDealPages}</span> ({filteredDeals.length} total)
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={dealPage <= 1} onClick={() => setDealPage((p) => Math.max(1, p - 1))} className="bg-card border-border text-foreground hover:bg-muted cursor-pointer">
                <ChevronLeft className="w-4 h-4 mr-1" />
                Prev
              </Button>
              <Button variant="outline" size="sm" disabled={dealPage >= totalDealPages} onClick={() => setDealPage((p) => Math.min(totalDealPages, p + 1))} className="bg-card border-border text-foreground hover:bg-muted cursor-pointer">
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Deal Add/Edit Dialog */}
      <Dialog open={dealDialogOpen} onOpenChange={setDealDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingDeal ? 'Edit Deal' : 'Add New Deal'}</DialogTitle>
            <DialogDescription>Record deal details, customer, pricing, and stage.</DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={saveDeal}>
            {editingDeal && (
              <div className="grid gap-2">
                <label className="text-xs font-bold">Customer</label>
                <Input value={editingDeal.customer?.name || '—'} disabled className="bg-muted" />
              </div>
            )}
            <div className="grid gap-1.5">
              <label className="text-xs font-bold">Quoted Amount (MMK)</label>
              <Input type="number" value={dealForm.quotedAmount} onChange={(e) => setDealForm({ ...dealForm, quotedAmount: e.target.value })} placeholder="0" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <label className="text-xs font-bold">Stage</label>
                <Select value={dealForm.stage} onValueChange={(val) => setDealForm({ ...dealForm, stage: val ?? 'NEW_LEAD' })}>
                  <SelectTrigger className="text-xs font-bold">{dealForm.stage}</SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NEW_LEAD">New Lead</SelectItem>
                    <SelectItem value="QUOTED">Quoted</SelectItem>
                    <SelectItem value="FOLLOW_UP_NEEDED">Follow Up Needed</SelectItem>
                    <SelectItem value="PENDING">Pending Delivery</SelectItem>
                    <SelectItem value="WON">Closed Won</SelectItem>
                    <SelectItem value="LOST">Lost</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs font-bold">Fulfillment</label>
                <Select value={dealForm.fulfillmentStatus} onValueChange={(val) => setDealForm({ ...dealForm, fulfillmentStatus: val ?? 'PENDING' })}>
                  <SelectTrigger className="text-xs font-bold">{dealForm.fulfillmentStatus}</SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="PROCESSING">Processing</SelectItem>
                    <SelectItem value="FULFILLED">Fulfilled</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs font-bold">Channel / Source</label>
              <Input value={dealForm.sourceChannel} onChange={(e) => setDealForm({ ...dealForm, sourceChannel: e.target.value })} placeholder="e.g. Facebook, Direct, Telegram" />
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs font-bold">Notes</label>
              <Input value={dealForm.note} onChange={(e) => setDealForm({ ...dealForm, note: e.target.value })} placeholder="Additional remarks" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDealDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSaving} className="bg-sky-600 hover:bg-sky-700 text-white font-bold">{isSaving ? 'Saving...' : editingDeal ? 'Save Changes' : 'Create Deal'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={Boolean(deleteDeal)} onOpenChange={(open) => !open && setDeleteDeal(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this deal?</AlertDialogTitle>
            <AlertDialogDescription>This deal will be moved to Trash. It can be restored later from Trash.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={isDeleting} className="bg-red-600 text-white hover:bg-red-700 font-bold" onClick={confirmDeleteDeal}>{isDeleting ? 'Deleting...' : 'Move to Trash'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
