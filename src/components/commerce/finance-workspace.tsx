/** Finance workspace (ledger, KPIs, entry CRUD).
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
  ClipboardList,
  DollarSign,
  Package,
  Percent,
  Pencil,
  Plus,
  ReceiptText,
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
import type {
  CommerceActionRecommendation,
  CommerceWorkspaceData,
} from '@/lib/api';
import {
  commerceDashboardKeys,
} from '@/hooks/use-commerce-dashboard';
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
  ExpenseBreakdownChart,
  FinanceKpiCard,
  FinanceTimelineChart,
  SmartSuggestions,
} from '@/components/commerce/shared-charts';

type FinanceEntryView = CommerceWorkspaceData['finance']['accounting']['entries'][number];
type FinanceEntryForm = {
  entryDate: string;
  title: string;
  amount: string;
  cashType: string;
  accountingType: string;
  status: string;
  counterparty: string;
  dueDate: string;
  voucherNumber: string;
  notes: string;
};

export const financeEntryTypes = [
  ['salary', 'Salary', 'Payroll costs', Wallet, 'border-l-sky-500'],
  ['cogs', 'COGS', 'Cost of goods sold', Package, 'border-l-violet-500'],
  ['operating_expense', 'Operating Expenses', 'Running costs', ReceiptText, 'border-l-amber-500'],
  ['payment', 'Payments', 'Payment records', DollarSign, 'border-l-emerald-500'],
  ['receivable', 'Receivables', 'Outstanding income', Users, 'border-l-cyan-500'],
  ['debt', 'Debt', 'Outstanding liabilities', Wallet, 'border-l-rose-500'],
  ['voucher', 'Vouchers', 'Supporting records', ReceiptText, 'border-l-slate-500'],
  ['owner_capital', 'Owner Capital', 'Business investment', Wallet, 'border-l-indigo-500'],
] as const;

export const financeStatuses = ['recorded', 'pending', 'paid', 'settled', 'overdue'];

export function financeTypeLabel(value: string) {
  return financeEntryTypes.find(([key]) => key === value)?.[1] ?? value.replaceAll('_', ' ');
}

export function defaultCashType(accountingType: string) {
  if (accountingType === 'owner_capital') return 'Capital';
  if (['payment', 'receivable', 'voucher'].includes(accountingType)) return 'Income';
  return 'Expense';
}

export function FinanceWorkspace({ data, recommendations, isRecommendationsLoading, defaultDate }: { data?: CommerceWorkspaceData['finance']; recommendations?: CommerceActionRecommendation[]; isRecommendationsLoading: boolean; defaultDate?: string }) {
  const queryClient = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const getEmptyForm = (): FinanceEntryForm => ({
    entryDate: defaultDate || data?.accounting.entries[0]?.date || today,
    title: '',
    amount: '',
    cashType: 'Expense',
    accountingType: 'operating_expense',
    status: 'recorded',
    counterparty: '',
    dueDate: '',
    voucherNumber: '',
    notes: '',
  });
  const monthly: [string, number, number][] = data?.timeline.length ? data.timeline.map((item) => [item.label, item.revenue, item.expense]) : [['Feb', 0, 0], ['Mar', 0, 0], ['Apr', 0, 0], ['May', 0, 0], ['Jun', 0, 0], ['Jul', 0, 0]];
  const breakdown: [string, number, number, string][] = data?.expenseBreakdown.length ? data.expenseBreakdown.map((item, index) => [item.category, item.percent, item.value, ['#0ea5e9', '#94a3b8', '#f59e0b', '#64748b', '#8b5cf6'][index] ?? '#64748b']) : [];
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [recordDialogOpen, setRecordDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FinanceEntryView | null>(null);
  const [deleteRecord, setDeleteRecord] = useState<FinanceEntryView | null>(null);
  const [recordForm, setRecordForm] = useState<FinanceEntryForm>(getEmptyForm);
  const [isSavingRecord, setIsSavingRecord] = useState(false);
  const [isDeletingRecord, setIsDeletingRecord] = useState(false);
  const accountingEntries = data?.accounting.entries ?? [];
  const filteredRecords = accountingEntries.filter((record) => {
    const cashLabel = record.cashType === 'Income' || record.cashType === 'Capital' ? record.cashType : 'Expense';
    return (typeFilter === 'All' || cashLabel === typeFilter || record.accountingType === typeFilter) && (statusFilter === 'All' || record.status === statusFilter);
  });
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const pagedRecords = filteredRecords.slice((page - 1) * pageSize, page * pageSize);
  const accountingTotals = data?.accounting.totals ?? {};
  const accountingExpenseTotal = (accountingTotals.salary ?? 0) + (accountingTotals.cogs ?? 0) + (accountingTotals.operating_expense ?? 0);

  const updateForm = (key: keyof FinanceEntryForm, value: string) => {
    setRecordForm((current) => ({
      ...current,
      [key]: value,
      ...(key === 'accountingType' ? { cashType: defaultCashType(value) } : {}),
    }));
  };
  const refreshFinance = async () => {
    await queryClient.invalidateQueries({ queryKey: commerceDashboardKeys.all });
  };
  const openAddRecord = () => {
    setEditingRecord(null);
    setRecordForm(getEmptyForm());
    setRecordDialogOpen(true);
  };
  const openEditRecord = (record: FinanceEntryView) => {
    setEditingRecord(record);
    setRecordForm({
      entryDate: record.date,
      title: record.title,
      amount: String(record.amount),
      cashType: record.cashType || defaultCashType(record.accountingType),
      accountingType: record.accountingType,
      status: record.status || 'recorded',
      counterparty: record.counterparty ?? '',
      dueDate: record.dueDate ?? '',
      voucherNumber: record.voucherNumber ?? '',
      notes: record.notes ?? '',
    });
    setRecordDialogOpen(true);
  };
  const saveRecord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const numericAmount = Number(recordForm.amount);
    if (!recordForm.title.trim() || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      toast.error('Enter a description and a positive amount');
      return;
    }
    setIsSavingRecord(true);
    const payload = {
      entryDate: recordForm.entryDate,
      title: recordForm.title.trim(),
      amount: numericAmount,
      cashType: recordForm.cashType,
      accountingType: recordForm.accountingType,
      status: recordForm.status,
      counterparty: recordForm.counterparty.trim() || null,
      dueDate: recordForm.dueDate || null,
      voucherNumber: recordForm.voucherNumber.trim() || null,
      notes: recordForm.notes.trim() || null,
    };
    const response = await fetch(editingRecord ? `/api/commerce/finance/entries/${editingRecord.id}` : '/api/commerce/finance/entries', {
      method: editingRecord ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setIsSavingRecord(false);
    if (!response.ok) {
      toast.error(editingRecord ? 'Could not update finance record' : 'Could not add finance record');
      return;
    }
    toast.success(editingRecord ? 'Finance record updated' : 'Finance record added');
    setRecordDialogOpen(false);
    await refreshFinance();
  };
  const confirmDeleteRecord = async () => {
    if (!deleteRecord) return;
    setIsDeletingRecord(true);
    const response = await fetch(`/api/commerce/finance/entries/${deleteRecord.id}`, { method: 'DELETE' });
    setIsDeletingRecord(false);
    if (!response.ok) {
      toast.error('Could not delete finance record');
      return;
    }
    toast.success('Finance record moved to Trash');
    setDeleteRecord(null);
    await refreshFinance();
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <FinanceKpiCard label="Total Revenue" value={amount(data?.kpis.revenue ?? 0)} unit="MMK" icon={DollarSign} accentClass="border-l-4 border-l-sky-500" />
        <FinanceKpiCard label="Total Expense" value={amount(data?.kpis.expense ?? 0)} unit="MMK" icon={ReceiptText} accentClass="border-l-4 border-l-red-500" />
        <FinanceKpiCard label="Profit / Loss" value={amount(data?.kpis.profit ?? 0)} unit="MMK" icon={TrendingUp} accentClass="border-l-4 border-l-emerald-500" />
        <FinanceKpiCard label="Profit Margin" value={`${(data?.kpis.profitMargin ?? 0).toFixed(1)}%`} icon={Percent} accentClass="border-l-4 border-l-emerald-500" />
      </div>

      <SmartSuggestions recommendations={recommendations} isLoading={isRecommendationsLoading} areaFilter="finance" />

      <div className="space-y-6">
        <section className="rounded-xl border-2 border-slate-200 bg-card shadow-sm dark:border-slate-800"><div className="p-6"><h2 className="border-b-2 border-slate-100 pb-3 text-sm font-bold uppercase tracking-wide text-slate-900 dark:border-slate-800 dark:text-slate-100">Revenue vs Expense Timeline</h2></div><div className="px-4 pb-5 sm:px-6">{monthly.every(([, revenue, expense]) => revenue === 0 && expense === 0) ? <p className="py-12 text-center text-sm text-slate-500">No timeline data yet.</p> : <FinanceTimelineChart monthly={monthly} />}</div></section>
        <section className="rounded-xl border-2 border-slate-200 bg-card shadow-sm dark:border-slate-800"><div className="p-6"><h2 className="border-b-2 border-slate-100 pb-3 text-sm font-bold uppercase tracking-wide text-slate-900 dark:border-slate-800 dark:text-slate-100">Expense Breakdown</h2></div><div className="p-5 sm:p-6">{breakdown.length === 0 ? <p className="py-12 text-center text-sm text-slate-500">No expense breakdown yet.</p> : <ExpenseBreakdownChart items={breakdown} />}</div></section>
      </div>

      <section id="finance-records-table" className="overflow-hidden rounded-xl border-2 border-slate-200 bg-card shadow-sm dark:border-slate-800">
        <div className="border-b-2 border-slate-200 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-950/40">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-black text-slate-900 dark:text-slate-100"><ClipboardList className="h-5 w-5 text-sky-600" />Finance Records</h2>
              <p className="mt-1 text-sm text-muted-foreground">Income, expenses, accounting category, status, counterparty, due date, voucher, and payment context in one table.</p>
            </div>
            <Button size="sm" className="h-10 w-fit cursor-pointer bg-sky-600 px-4 hover:bg-sky-700 text-white font-bold" onClick={openAddRecord}><Plus className="mr-1.5 h-4 w-4" />Add record</Button>
          </div>
        </div>
        <div className="space-y-5 p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <FinanceKpiCard label="Accounting Expenses" value={amount(accountingExpenseTotal)} unit="MMK" icon={ReceiptText} accentClass="border-l-4 border-l-red-500" />
            <FinanceKpiCard label="Open Receivables" value={amount(accountingTotals.receivable ?? 0)} unit="MMK" icon={Users} accentClass="border-l-4 border-l-cyan-500" />
            <FinanceKpiCard label="Open Debt" value={amount(accountingTotals.debt ?? 0)} unit="MMK" icon={Wallet} accentClass="border-l-4 border-l-rose-500" />
            <FinanceKpiCard label="Vouchers" value={String(accountingEntries.filter((entry) => entry.accountingType === 'voucher').length)} unit="records" icon={ReceiptText} accentClass="border-l-4 border-l-slate-500" />
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Showing {Math.min(pageSize, pagedRecords.length)} of {filteredRecords.length} records</p>
            <div className="flex flex-wrap gap-2">
              <Select value={typeFilter} onValueChange={(value) => { if (value) { setTypeFilter(value); setPage(1); } }}><SelectTrigger className="h-10 w-56 rounded-lg border-2 border-slate-200 bg-card text-sm font-bold text-slate-800 dark:border-slate-800 dark:text-slate-200">{typeFilter === 'All' ? 'All' : financeTypeLabel(typeFilter)}</SelectTrigger><SelectContent><SelectItem value="All">All</SelectItem><SelectItem value="Income">Income</SelectItem><SelectItem value="Expense">Expense</SelectItem><SelectItem value="Capital">Capital</SelectItem>{financeEntryTypes.map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select>
              <Select value={statusFilter} onValueChange={(value) => { if (value) { setStatusFilter(value); setPage(1); } }}><SelectTrigger className="h-10 w-44 rounded-lg border-2 border-slate-200 bg-card text-sm font-bold capitalize text-slate-800 dark:border-slate-800 dark:text-slate-200">{statusFilter}</SelectTrigger><SelectContent><SelectItem value="All">All</SelectItem>{financeStatuses.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1280px] w-full text-left text-sm">
            <thead className="border-y-2 border-slate-200 bg-slate-50/60 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950/40">
              <tr>{['Date', 'Description', 'Type', 'Amount (MMK)', 'Accounting Type', 'Status', 'Counterparty', 'Due Date', 'Voucher / Ref', 'Payment / Notes', 'Actions'].map((heading) => <th key={heading} className={`px-5 py-4 ${heading === 'Amount (MMK)' ? 'text-right' : heading === 'Actions' ? 'text-center' : ''}`}>{heading}</th>)}</tr>
            </thead>
            <tbody className="divide-y-2 divide-slate-100 dark:divide-slate-900">
              {pagedRecords.map((record) => {
                const signedAmount = record.cashType === 'Expense' ? `-${amount(record.amount)}` : amount(record.amount);
                return (
                  <tr key={record.id} className="transition hover:bg-slate-50 dark:hover:bg-slate-950/50">
                    <td className="whitespace-nowrap px-5 py-4 text-xs font-bold text-slate-600 dark:text-slate-400">{record.date}</td>
                    <td className="max-w-64 px-5 py-4 text-xs font-bold text-slate-900 dark:text-slate-100">{record.title}</td>
                    <td className="px-5 py-4"><span className={`rounded border-2 px-2.5 py-1 text-[10px] font-extrabold ${record.cashType === 'Income' || record.cashType === 'Capital' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>{record.cashType.toUpperCase()}</span></td>
                    <td className={`whitespace-nowrap px-5 py-4 text-right text-sm font-black ${record.cashType === 'Expense' ? 'text-red-700' : 'text-emerald-700'}`}>{signedAmount}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-xs font-semibold capitalize text-slate-600 dark:text-slate-400">{financeTypeLabel(record.accountingType)}</td>
                    <td className="px-5 py-4"><span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-bold lowercase text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">{record.status}</span></td>
                    <td className="max-w-40 px-5 py-4 text-xs font-semibold text-slate-600 dark:text-slate-400">{record.counterparty ?? '—'}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-xs font-semibold text-slate-600 dark:text-slate-400">{record.dueDate ?? '—'}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-xs font-bold text-slate-600 dark:text-slate-400">{record.voucherNumber ?? '—'}</td>
                    <td className="max-w-64 px-5 py-4 text-xs font-semibold text-slate-600 dark:text-slate-400">{record.notes ?? '—'}</td>
                    <td className="px-5 py-4"><div className="flex items-center justify-center gap-2"><Button aria-label={`Edit ${record.title}`} variant="ghost" size="icon" className="h-9 w-9 cursor-pointer text-blue-600 hover:text-blue-700" onClick={() => openEditRecord(record)}><Pencil className="h-4 w-4" /></Button><Button aria-label={`Delete ${record.title}`} variant="ghost" size="icon" className="h-9 w-9 cursor-pointer text-red-600 hover:text-red-700" onClick={() => setDeleteRecord(record)}><Trash2 className="h-4 w-4" /></Button></div></td>
                  </tr>
                );
              })}
              {filteredRecords.length === 0 && <tr><td colSpan={11} className="px-6 py-10 text-center text-sm text-slate-500">No finance records found for these filters.</td></tr>}
            </tbody>
          </table>
        </div>
        {filteredRecords.length > 0 && <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/60 px-6 py-3 dark:border-slate-800 dark:bg-slate-950/40"><span className="text-xs font-semibold text-muted-foreground">Showing {Math.min((page - 1) * pageSize + 1, filteredRecords.length)}-{Math.min(page * pageSize, filteredRecords.length)} of {filteredRecords.length}</span><div className="flex gap-2"><Button variant="outline" size="sm" className="h-8 cursor-pointer text-xs" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</Button><Button variant="outline" size="sm" className="h-8 cursor-pointer text-xs" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next</Button></div></div>}
      </section>
      <Dialog open={recordDialogOpen} onOpenChange={setRecordDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>{editingRecord ? 'Edit finance record' : 'Add finance record'}</DialogTitle><DialogDescription>Record income, expenses, accounting category, status, voucher, and payment context.</DialogDescription></DialogHeader>
          <form className="grid gap-4" onSubmit={saveRecord}>
            <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm font-semibold">Date<Input type="date" value={recordForm.entryDate} onChange={(event) => updateForm('entryDate', event.target.value)} /></label><label className="grid gap-1 text-sm font-semibold">Amount (MMK)<Input type="number" min="1" value={recordForm.amount} onChange={(event) => updateForm('amount', event.target.value)} /></label></div>
            <label className="grid gap-1 text-sm font-semibold">Description<Input value={recordForm.title} onChange={(event) => updateForm('title', event.target.value)} placeholder="Record description" /></label>
            <div className="grid gap-3 sm:grid-cols-3"><label className="grid gap-1 text-sm font-semibold">Cash type<Select value={recordForm.cashType} onValueChange={(value) => updateForm('cashType', value ?? '')}><SelectTrigger>{recordForm.cashType}</SelectTrigger><SelectContent>{['Income', 'Expense', 'Capital'].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></label><label className="grid gap-1 text-sm font-semibold">Accounting type<Select value={recordForm.accountingType} onValueChange={(value) => updateForm('accountingType', value ?? '')}><SelectTrigger>{financeTypeLabel(recordForm.accountingType)}</SelectTrigger><SelectContent>{financeEntryTypes.map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select></label><label className="grid gap-1 text-sm font-semibold">Status<Select value={recordForm.status} onValueChange={(value) => updateForm('status', value ?? '')}><SelectTrigger className="capitalize">{recordForm.status}</SelectTrigger><SelectContent>{financeStatuses.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></label></div>
            <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm font-semibold">Counterparty<Input value={recordForm.counterparty} onChange={(event) => updateForm('counterparty', event.target.value)} placeholder="Supplier or customer" /></label><label className="grid gap-1 text-sm font-semibold">Due date<Input type="date" value={recordForm.dueDate} onChange={(event) => updateForm('dueDate', event.target.value)} /></label></div>
            <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm font-semibold">Voucher / Ref<Input value={recordForm.voucherNumber} onChange={(event) => updateForm('voucherNumber', event.target.value)} placeholder="INV-0001" /></label><label className="grid gap-1 text-sm font-semibold">Payment / Notes<Input value={recordForm.notes} onChange={(event) => updateForm('notes', event.target.value)} placeholder="Payment method, reference, or notes" /></label></div>
            <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setRecordDialogOpen(false)}>Cancel</Button><Button type="submit" disabled={isSavingRecord}>{isSavingRecord ? 'Saving...' : editingRecord ? 'Save changes' : 'Add record'}</Button></div>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={Boolean(deleteRecord)} onOpenChange={(open) => !open && setDeleteRecord(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete this finance record?</AlertDialogTitle><AlertDialogDescription>This will move the record to Trash using soft delete. It will no longer appear in Finance Records.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={isDeletingRecord}>Cancel</AlertDialogCancel><AlertDialogAction disabled={isDeletingRecord} className="bg-red-600 text-white hover:bg-red-700" onClick={confirmDeleteRecord}>{isDeletingRecord ? 'Deleting...' : 'Delete'}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
