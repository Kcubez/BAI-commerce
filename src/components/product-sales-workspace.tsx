'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  AlertTriangle,
  Award,
  BarChart3,
  Bot,
  CalendarCheck,
  ChevronDown,
  ChevronUp,
  DollarSign,
  LineChart,
  Megaphone,
  Package,
  Percent,
  Pencil,
  Phone,
  ReceiptText,
  Server,
  Target,
  Trophy,
  Trash2,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  useCommerceDashboard,
  useCommerceRecommendations,
  useCommerceWorkspaces,
  useSaveCommerceTargets,
} from '@/hooks/use-commerce-dashboard';
import type { CommerceActionRecommendation, CommerceDashboard, CommerceDashboardParams, CommerceWorkspaceData } from '@/lib/api';
import { useDateFilter } from '@/hooks/use-date-filter';
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
import { toast } from 'sonner';

type Workspace = 'overview' | 'finance' | 'sales' | 'marketing' | 'customers' | 'inventory';
type CardTone = 'emerald' | 'red' | 'sky' | 'amber';

const amount = (value: number) => value.toLocaleString();

function periodRangeLabel(
  period: string,
  year: number,
  month: number,
  day: number,
  customFrom: string,
  customTo: string,
): string {
  if (period === 'overall') return 'Overall';
  if (period === 'year') return `Year ${year}`;
  if (period === 'day') return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  if (period === 'custom') return `${customFrom} → ${customTo}`;
  return new Date(year, month - 1).toLocaleString('en', { month: 'long', year: 'numeric' });
}

function ProgressCard({
  title,
  value,
  target,
  expected,
  status,
  tone,
  icon: Icon,
  progressPercent,
}: {
  title: string;
  value: string;
  target: string;
  expected: string;
  status: string;
  tone: CardTone;
  icon: LucideIcon;
  progressPercent?: number;
}) {
  const colors = {
    emerald: 'bg-emerald-500 text-emerald-600',
    red: 'bg-red-500 text-red-500',
    sky: 'bg-sky-500 text-sky-600',
    amber: 'bg-amber-500 text-amber-600',
  }[tone];
  const progress = progressPercent ?? (tone === 'emerald' ? 96 : tone === 'red' ? 28 : tone === 'amber' ? 62 : 68);

  return (
    <section className="bg-card border-2 border-slate-300 dark:border-slate-800 p-6 flex flex-col justify-between h-48 rounded-xl shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:border-slate-400 dark:hover:border-slate-700 transition-all duration-200">
      <div className="flex justify-between items-center">
        <p className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{title}</p>
        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center text-slate-400 dark:text-slate-500">
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div>
        <p className="text-3xl font-extrabold tracking-tight text-foreground leading-none whitespace-nowrap">
          {value} <span className="text-sm font-medium text-slate-400 dark:text-slate-500">/ {target}</span>
        </p>
        <div className="mt-5 relative w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700 shadow-inner overflow-visible">
          <div className={`h-full rounded-full ${colors.split(' ')[0]}`} style={{ width: `${progress}%` }} />
          <span className="absolute right-0 top-[-5px] bottom-[-5px] w-[3px] rounded bg-slate-800 dark:bg-slate-200" />
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 text-xs font-bold">
          <span className="text-slate-500 dark:text-slate-400">{expected}</span>
          <span className={colors.split(' ')[1]}>{status}</span>
        </div>
      </div>
    </section>
  );
}

const recommendationActionLink: Record<CommerceActionRecommendation['actionType'], string> = {
  view_sales: '/sales',
  view_finance: '/finance',
  view_inventory: '/inventory',
  view_marketing: '/marketing',
  set_target_modal: '',
  general_dashboard: '/dashboard',
};

function SmartSuggestions({
  recommendations,
  isLoading,
  onSetTargets,
}: {
  recommendations?: CommerceActionRecommendation[];
  isLoading: boolean;
  onSetTargets: () => void;
}) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  if (!isLoading && (!recommendations || recommendations.length === 0)) return null;

  return (
    <section className="overflow-hidden rounded-xl border-2 border-sky-200 bg-sky-50/30 shadow-sm dark:border-sky-900/60 dark:bg-sky-950/15">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Bot className="h-4 w-4 text-sky-600" />
            Smart Suggestions
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">Suggestions are hidden until you choose to review them.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setVisible((open) => !open)}
          className="shrink-0 border-border bg-card text-foreground hover:bg-muted/50"
        >
          {visible ? 'Hide suggestions' : 'View suggestions'}
          {visible ? <ChevronUp className="ml-1.5 h-4 w-4" /> : <ChevronDown className="ml-1.5 h-4 w-4" />}
        </Button>
      </div>
      {visible && (
        <div className="grid grid-cols-1 gap-6 border-t border-sky-200 p-5 md:grid-cols-2 dark:border-sky-900/60">
          {(recommendations ?? []).slice(0, 4).map((rec, index) => {
            const isAlert = rec.severity === 'urgent' || rec.severity === 'warning';
            const borderColor = isAlert ? 'border-red-300 dark:border-red-900/60' : 'border-emerald-300 dark:border-emerald-900/60';
            const borderLeftColor = isAlert ? 'border-l-red-500' : 'border-l-emerald-500';
            const iconColor = isAlert ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400';
            const Icon = isAlert ? AlertTriangle : Award;
            return (
              <div key={`${rec.actionType}-${index}`} className={`bg-card border-2 ${borderColor} border-l-8 ${borderLeftColor} rounded-xl p-5 flex flex-col justify-center shadow-sm`}>
                <div className="flex items-center gap-3 mb-2">
                  <Icon className={`${iconColor} w-5 h-5 flex-shrink-0`} />
                  <h4 className="font-bold text-foreground text-sm">{rec.title}</h4>
                </div>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{rec.insight}</p>
                {rec.action && (
                  <div className="mt-3">
                    <button
                      onClick={() => {
                        if (rec.actionType === 'set_target_modal') onSetTargets();
                        else router.push(recommendationActionLink[rec.actionType]);
                      }}
                      className={`${
                        isAlert
                          ? 'bg-red-600 hover:bg-red-700 text-white'
                          : 'bg-background border-2 border-slate-300 dark:border-slate-700 text-foreground hover:bg-muted'
                      } px-4 py-2 rounded-lg text-xs font-bold transition shadow-sm cursor-pointer`}
                    >
                      {rec.action}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function CommerceLineChart({ data }: { data: { label: string; value: number }[] }) {
  const dailyIncome = data.length ? data.map((point) => point.value) : Array.from({ length: 30 }, () => 0);
  const chartLeft = 50;
  const chartRight = 680;
  const chartWidth = chartRight - chartLeft;
  const chartBottom = 190;
  const chartTop = 20;
  const isEmpty = dailyIncome.every((value) => value === 0);
  const maxIncome = isEmpty ? 5 : Math.max(1, Math.ceil(Math.max(...dailyIncome) / 500_000) * 500_000);
  const divisor = Math.max(dailyIncome.length - 1, 1);
  const points = dailyIncome.map((income, index) => `${chartLeft + (index / divisor) * chartWidth},${chartBottom - (income / maxIncome) * (chartBottom - chartTop)}`).join(' ');
  const labels = data.length ? data.map((point) => point.label) : Array.from({ length: 30 }, (_, index) => String(index + 1));
  const yLabels = isEmpty ? [0, 1, 2, 3, 4, 5] : Array.from({ length: 6 }, (_, index) => Math.round((maxIncome / 5) * index));
  return (
    <div className="relative w-full mt-4 select-none" aria-label="Daily income trend chart" role="img">
      <svg viewBox="0 0 700 240" className="w-full overflow-visible" style={{ display: 'block' }} preserveAspectRatio="xMidYMid meet">
        <defs><linearGradient id="commerceLineGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.12" /><stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.05" /></linearGradient></defs>
        {[20, 54, 88, 122, 156, 190].map((y) => <line key={y} x1={chartLeft} y1={y} x2={chartRight} y2={y} stroke="#f1f5f9" className="dark:stroke-slate-800" />)}
        {labels.map((_, index) => chartLeft + (index / divisor) * chartWidth).map((x, index) => <line key={index} x1={x} y1="20" x2={x} y2="190" stroke="#f8fafc" className="dark:stroke-slate-900" />)}
        {yLabels.map((value, index) => <text key={`${value}-${index}`} x="42" y={194 - index * 34} textAnchor="end" className="fill-slate-500 dark:fill-slate-400" style={{ fontSize: '9px', fontFamily: "'Inter', sans-serif" }}>{value.toLocaleString()}</text>)}
        {!isEmpty && <path d={`M ${points.split(' ').join(' L ')} L ${chartRight} ${chartBottom} L ${chartLeft} ${chartBottom} Z`} fill="url(#commerceLineGradient)" />}
        {!isEmpty && <line x1={chartLeft} y1="190" x2={chartRight} y2="190" stroke="#cbd5e1" strokeWidth="1.5" className="dark:stroke-slate-700" />}
        {!isEmpty && labels.map((_, index) => chartLeft + (index / divisor) * chartWidth).map((x, index) => <line key={`tick-${index}`} x1={x} y1="190" x2={x} y2="195" stroke="#cbd5e1" strokeWidth="1.2" className="dark:stroke-slate-700" />)}
        {labels.map((label, index) => <text key={`${label}-${index}`} x={chartLeft + (index / divisor) * chartWidth} y="209" textAnchor="middle" className="fill-slate-500 dark:fill-slate-400" style={{ fontSize: '8px', fontFamily: "'Inter', sans-serif" }}>{label}</text>)}
        {!isEmpty && <polyline points={points} fill="none" stroke="#0ea5e9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
        {!isEmpty && points.split(' ').map((point) => { const [cx, cy] = point.split(','); return <circle key={point} cx={cx} cy={cy} r="3" fill="#0ea5e9" stroke="white" strokeWidth="1.5" />; })}
        <text x="375" y="225" textAnchor="middle" className="fill-slate-500 dark:fill-slate-400" style={{ fontSize: '10px', fontWeight: 700, fontFamily: "'Inter', sans-serif" }}>Day of Month</text>
      </svg>
    </div>
  );
}

function CommerceBarChart({ data }: { data: { label: string; value: number }[] }) {
  const dailyOrders = data.length ? data.map((point) => point.value) : Array.from({ length: 30 }, () => 0);
  const chartLeft = 50;
  const chartWidth = 630;
  const slotWidth = chartWidth / dailyOrders.length;
  const maxOrders = Math.max(5, Math.ceil(Math.max(...dailyOrders) / 5) * 5);
  return (
    <div className="relative w-full mt-4 select-none" aria-label="Daily order volume chart" role="img">
      <svg viewBox="0 0 700 240" className="w-full overflow-visible" style={{ display: 'block' }} preserveAspectRatio="xMidYMid meet">
        {[20, 54, 88, 122, 156, 190].map((y) => <line key={y} x1="50" y1={y} x2="680" y2={y} stroke="#f1f5f9" className="dark:stroke-slate-800" />)}
        {Array.from({ length: 6 }, (_, index) => Math.round((maxOrders / 5) * index)).map((value, index) => <text key={value} x="42" y={194 - index * 34} textAnchor="end" className="fill-slate-500 dark:fill-slate-400" style={{ fontSize: '9px', fontFamily: "'Inter', sans-serif" }}>{value}</text>)}
        {dailyOrders.map((_, index) => chartLeft + index * slotWidth).map((x, index) => <line key={index} x1={x} y1="20" x2={x} y2="190" stroke="#f1f5f9" className="dark:stroke-slate-800" />)}
        {dailyOrders.map((orders, index) => { const height = (orders / maxOrders) * 170; const x = chartLeft + index * slotWidth + 3; const y = 190 - height; const width = Math.max(4, slotWidth - 6); return <path key={index} d={height ? `M ${x} 190 V ${y + 4} Q ${x} ${y} ${x + 4} ${y} H ${x + width - 4} Q ${x + width} ${y} ${x + width} ${y + 4} V 190 Z` : ''} fill="#8b5cf6" opacity="0.85" />; })}
        {(data.length ? data : Array.from({ length: 30 }, (_, index) => ({ label: String(index + 1), value: 0 }))).map((point, index) => <text key={`${point.label}-${index}`} x={chartLeft + index * slotWidth + slotWidth / 2} y="207" textAnchor="middle" className="fill-slate-500 dark:fill-slate-400" style={{ fontSize: '8px', fontFamily: "'Inter', sans-serif" }}>{point.label}</text>)}
        <text x="365" y="225" textAnchor="middle" className="fill-slate-500 dark:fill-slate-400" style={{ fontSize: '10px', fontWeight: 700, fontFamily: "'Inter', sans-serif" }}>Day of Month</text>
      </svg>
    </div>
  );
}

function BusinessOverviewAnalytics({ periodLabel, dashboard }: { periodLabel: string; dashboard?: CommerceDashboard }) {
  const products = dashboard?.analytics.topProducts ?? [];
  const intelligence = dashboard?.analytics.liveIntelligence ?? [
    { area: 'Finance', text: 'Revenue data will appear after Commerce sales are recorded.' },
    { area: 'Sales', text: 'Order fulfillment signals will appear after deals are recorded.' },
    { area: 'Inventory', text: 'Inventory signals will appear after products are added.' },
    { area: 'System', text: 'Telegram Bot status will appear after Commerce messages are processed.' },
  ];
  const icons = [DollarSign, Phone, Server, Bot];
  const iconClasses = [
    'bg-emerald-900/50 border-emerald-500/30 text-emerald-400',
    'bg-sky-900/50 border-sky-500/30 text-sky-400',
    'bg-amber-900/50 border-amber-500/30 text-amber-400',
    'bg-blue-900/50 border-blue-500/30 text-blue-400',
  ];
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="bg-card border-2 border-slate-300 dark:border-slate-800 p-6 flex flex-col h-full rounded-xl shadow-sm hover:shadow-lg transition-all duration-200">
          <div className="flex items-center gap-3 mb-4 border-b-2 border-border pb-3">
            <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center"><Trophy className="text-amber-500 w-4 h-4" /></div>
            <h3 className="font-bold text-foreground">Top Performing Products</h3>
          </div>
          <div className="overflow-x-auto flex-1"><table className="w-full text-left text-sm"><thead><tr className="text-muted-foreground uppercase text-[10px] font-extrabold tracking-wider border-b-2 border-border"><th className="pb-3 pt-2">Product</th><th className="pb-3 pt-2 text-center">Qty</th><th className="pb-3 pt-2 text-right">Income (MMK)</th></tr></thead><tbody className="divide-y-2 divide-border/50">{products.length ? products.map((product) => <tr key={product.sku ?? product.name} className="hover:bg-muted/30 transition"><td className="py-3.5 font-bold text-foreground">{product.name}</td><td className="py-3.5 text-center text-muted-foreground font-bold">{product.quantity}</td><td className="py-3.5 text-right font-extrabold text-sky-600 dark:text-sky-400">{amount(product.income)}</td></tr>) : <tr><td colSpan={3} className="py-8 text-center text-sm font-semibold text-muted-foreground">No product sales yet for this period.</td></tr>}</tbody></table></div>
        </section>
        <section className="p-6 flex-1 flex flex-col bg-slate-800 dark:bg-slate-900 border-none text-slate-300 shadow-xl relative overflow-hidden rounded-xl">
          <h3 className="text-sm font-bold text-white mb-6 flex items-center gap-3 border-b border-slate-700 pb-4 z-10 relative"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />Live Intelligence Data</h3>
          <div className="space-y-5 text-sm z-10 relative">
            {intelligence.map((item, index) => {
              const Icon = icons[index] ?? Bot;
              return <div key={`${item.area}-${index}`} className="flex items-start gap-4"><div className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 ${iconClasses[index] ?? iconClasses[3]}`}><Icon className="w-4 h-4" /></div><p className="mt-1"><span className="font-bold text-white">{item.area}:</span> {item.text}</p></div>;
            })}
          </div>
        </section>
      </div>
      <div className="space-y-6">
        <section className="bg-card border-2 border-slate-300 dark:border-slate-800 p-6 rounded-xl shadow-sm"><div className="flex justify-between items-center mb-6 border-b-2 border-border pb-4"><h3 className="font-bold text-foreground text-sm tracking-wide uppercase flex items-center gap-2"><LineChart className="w-4 h-4 text-sky-500" />Daily Income Trend (MMK)</h3><span className="text-xs font-bold text-muted-foreground border-2 border-border bg-muted px-3 py-1 rounded-full">{periodLabel}</span></div><CommerceLineChart data={dashboard?.analytics.incomeTrend ?? []} /></section>
        <section className="bg-card border-2 border-slate-300 dark:border-slate-800 p-6 rounded-xl shadow-sm"><div className="flex justify-between items-center mb-6 border-b-2 border-border pb-4"><h3 className="font-bold text-foreground text-sm tracking-wide uppercase flex items-center gap-2"><BarChart3 className="w-4 h-4 text-sky-500" />Daily Order Volume</h3><span className="text-xs font-bold text-muted-foreground border-2 border-border bg-muted px-3 py-1 rounded-full">{periodLabel}</span></div><CommerceBarChart data={dashboard?.analytics.orderTrend ?? []} /></section>
      </div>
    </>
  );
}

function FinanceKpiCard({ label, value, icon: Icon, accentClass, unit }: { label: string; value: string; icon: LucideIcon; accentClass: string; unit?: string }) {
  return (
    <section className={`bg-card border-2 border-slate-200 dark:border-slate-800 shadow-sm rounded-xl ${accentClass}`}>
      <div className="p-6 flex flex-col justify-center h-40"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-2">{label}</p><h3 className="flex items-baseline gap-1.5 whitespace-nowrap text-2xl font-black text-slate-900 tracking-tight dark:text-slate-100"><span>{value}</span>{unit && <span className="text-xs font-bold text-slate-400">{unit}</span>}</h3></div><div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-400"><Icon className="w-4 h-4" /></div></div></div>
    </section>
  );
}

function FinanceTimelineChart({ monthly, maxTimelineValue }: { monthly: [string, number, number][]; maxTimelineValue: number }) {
  const isEmpty = monthly.every(([, revenue, expense]) => revenue === 0 && expense === 0);
  const chartLeft = 56;
  const chartRight = 658;
  const chartTop = 40;
  const chartBottom = 250;
  const slot = monthly.length > 1 ? (chartRight - chartLeft) / (monthly.length - 1) : 0;
  const toPoint = (value: number, index: number) => `${chartLeft + index * slot},${chartBottom - (value / maxTimelineValue) * (chartBottom - chartTop)}`;
  const revenuePoints = monthly.map(([, revenue], index) => toPoint(revenue, index)).join(' ');
  const expensePoints = monthly.map(([, , expense], index) => toPoint(expense, index)).join(' ');
  const yLabels = isEmpty ? [0, 1, 2, 3, 4, 5] : Array.from({ length: 6 }, (_, index) => Math.round((maxTimelineValue / 5) * index));

  return (
    <svg className="h-full w-full overflow-visible" viewBox="0 0 680 300" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Revenue and expense timeline">
      {[40, 82, 124, 166, 208, 250].map((y) => <line key={y} x1={chartLeft} x2={chartRight} y1={y} y2={y} stroke="#e2e8f0" />)}
      {monthly.map((_, index) => {
        const x = chartLeft + index * slot;
        return <line key={`grid-${index}`} x1={x} x2={x} y1={chartTop} y2={chartBottom} stroke="#f8fafc" />;
      })}
      {yLabels.map((value, index) => <text key={`${value}-${index}`} x="44" y={254 - index * 42} textAnchor="end" className="fill-slate-500" style={{ fontSize: '10px' }}>{value.toLocaleString()}</text>)}
      {!isEmpty && <polyline points={revenuePoints} fill="none" stroke="#0ea5e9" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />}
      {!isEmpty && <polyline points={expensePoints} fill="none" stroke="#ef4444" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />}
      {!isEmpty && <line x1={chartLeft} y1={chartBottom} x2={chartRight} y2={chartBottom} stroke="#cbd5e1" strokeWidth="1.5" />}
      {monthly.map(([monthLabel], index) => {
        const x = chartLeft + index * slot;
        return <g key={monthLabel}>{!isEmpty && <line x1={x} x2={x} y1={chartBottom} y2={chartBottom + 6} stroke="#cbd5e1" strokeWidth="1.2" />}<text x={x} y="274" textAnchor="middle" className="fill-slate-500" style={{ fontSize: '11px' }}>{monthLabel}</text></g>;
      })}
    </svg>
  );
}

function MarketingPerformanceChart({ weekly }: { weekly: readonly (readonly [string, number, number])[] }) {
  const isEmpty = weekly.every(([, spend, orders]) => Number(spend) === 0 && Number(orders) === 0);
  const chartLeft = 58;
  const chartRight = 658;
  const chartTop = 42;
  const chartBottom = 226;
  const slot = weekly.length > 1 ? (chartRight - chartLeft) / (weekly.length - 1) : 0;
  const maxSpend = Math.max(100_000, Math.ceil(Math.max(...weekly.map(([, spend]) => Number(spend))) / 25_000) * 25_000);
  const maxOrders = Math.max(20, Math.ceil(Math.max(...weekly.map(([, , orders]) => Number(orders))) / 5) * 5);
  const orderPoints = weekly.map(([, , orders], index) => `${chartLeft + 20 + index * slot},${chartBottom - (Number(orders) / maxOrders) * (chartBottom - chartTop)}`).join(' ');
  const spendLabels = isEmpty ? [4, 3, 2, 1, 0] : Array.from({ length: 5 }, (_, index) => Math.round(maxSpend - (maxSpend / 4) * index));
  const orderLabels = isEmpty ? [4, 3, 2, 1, 0] : Array.from({ length: 5 }, (_, index) => Math.round(maxOrders - (maxOrders / 4) * index));

  return (
    <svg className="h-full w-full overflow-visible" viewBox="0 0 680 300" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Ad spend compared to ad driven orders">
      {[42, 88, 134, 180, 226].map((y) => <line key={y} x1={chartLeft} x2={chartRight} y1={y} y2={y} stroke="#e2e8f0" />)}
      {weekly.map((_, index) => {
        const x = chartLeft + 20 + index * slot;
        return <line key={`grid-${index}`} x1={x} x2={x} y1={chartTop} y2={chartBottom} stroke="#f8fafc" />;
      })}
      {spendLabels.map((value, index) => <text key={`${value}-${index}`} x="50" y={46 + index * 46} textAnchor="end" className="fill-slate-500" style={{ fontSize: '9px' }}>{value.toLocaleString()}</text>)}
      {orderLabels.map((value, index) => <text key={`${value}-${index}`} x="668" y={46 + index * 46} textAnchor="start" className="fill-emerald-600" style={{ fontSize: '9px' }}>{value}</text>)}
      {!isEmpty && weekly.map(([week, spend], index) => {
        const x = chartLeft + index * slot + 4;
        const height = (Number(spend) / maxSpend) * (chartBottom - chartTop);
        return <g key={week}><rect x={x} y={chartBottom - height} width="32" height={height} rx="4" fill="#0ea5e9" opacity="0.85" /></g>;
      })}
      {!isEmpty && <polyline points={orderPoints} fill="none" stroke="#10b981" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />}
      {!isEmpty && orderPoints.split(' ').map((point) => { const [cx, cy] = point.split(','); return <circle key={point} cx={cx} cy={cy} r="4" fill="#10b981" stroke="white" strokeWidth="2" />; })}
      {!isEmpty && <line x1={chartLeft} y1={chartBottom} x2={chartRight} y2={chartBottom} stroke="#cbd5e1" strokeWidth="1.5" />}
      {weekly.map(([week], index) => {
        const x = chartLeft + 20 + index * slot;
        return <g key={`tick-${week}`}>{!isEmpty && <line x1={x} x2={x} y1={chartBottom} y2={chartBottom + 6} stroke="#cbd5e1" strokeWidth="1.2" />}<text x={x} y="250" textAnchor="middle" className="fill-slate-500" style={{ fontSize: '10px' }}>{week}</text></g>;
      })}
    </svg>
  );
}

function FinanceWorkspace({ data }: { data?: CommerceWorkspaceData['finance'] }) {
  const monthly: [string, number, number][] = data?.timeline.length ? data.timeline.map((item) => [item.label, item.revenue, item.expense]) : [['Feb', 0, 0], ['Mar', 0, 0], ['Apr', 0, 0], ['May', 0, 0], ['Jun', 0, 0], ['Jul', 0, 0]];
  const maxTimelineValue = Math.max(1, ...monthly.flatMap(([, revenue, expense]) => [revenue, expense]));
  const breakdown: [string, number, string][] = data?.expenseBreakdown.length ? data.expenseBreakdown.map((item, index) => [item.category, item.percent, ['#0ea5e9', '#8b5cf6', '#f59e0b', '#64748b', '#10b981'][index] ?? '#64748b']) : [];
  const donut = `conic-gradient(${breakdown.map(([,, color], index) => { const start = breakdown.slice(0, index).reduce((sum, [, percent]) => sum + Number(percent), 0); const percent = Number(breakdown[index][1]); return `${color} ${start}% ${start + percent}%`; }).join(', ')})`;
  const [typeFilter, setTypeFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const records = data?.records.map((record) => ({ ...record, amount: `${record.type === 'Income' ? '+' : '-'}${amount(record.amount)}` })) ?? [];
  const filteredRecords = records.filter((record) => (typeFilter === 'All' || record.type === typeFilter) && (categoryFilter === 'All' || record.category === categoryFilter));
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"><FinanceKpiCard label="Total Revenue" value={amount(data?.kpis.revenue ?? 0)} unit="MMK" icon={DollarSign} accentClass="border-l-4 border-l-sky-500" /><FinanceKpiCard label="Total Expense" value={amount(data?.kpis.expense ?? 0)} unit="MMK" icon={ReceiptText} accentClass="border-l-4 border-l-red-500" /><FinanceKpiCard label="Profit / Loss" value={amount(data?.kpis.profit ?? 0)} unit="MMK" icon={TrendingUp} accentClass="border-l-4 border-l-emerald-500" /><FinanceKpiCard label="Profit Margin" value={`${(data?.kpis.profitMargin ?? 0).toFixed(1)}%`} icon={Percent} accentClass="border-l-4 border-l-emerald-500" /></div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {(data?.insights ?? [{ tone: 'emerald' as const, title: 'Finance data is ready', text: 'Revenue and expense insights will appear after Commerce records are added.', action: 'View records' }, { tone: 'amber' as const, title: 'No expense signal yet', text: 'Expense category review will appear after expense records are added.', action: 'Review expenses' }]).map((insight) => <section key={insight.title} className={`bg-card border-2 ${insight.tone === 'emerald' ? 'border-emerald-300 border-l-emerald-500' : insight.tone === 'red' ? 'border-red-300 border-l-red-500' : 'border-amber-300 border-l-amber-500'} border-l-8 rounded-xl shadow-sm flex flex-col justify-between`}><div className="p-5 flex flex-col h-full justify-between"><div><div className="mb-2 flex items-center gap-3">{insight.tone === 'emerald' ? <TrendingUp className="h-5 w-5 text-emerald-600" /> : <AlertTriangle className={`h-5 w-5 ${insight.tone === 'red' ? 'text-red-600' : 'text-amber-600'}`} />}<h3 className="font-bold text-slate-900 dark:text-slate-100">{insight.title}</h3></div><p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{insight.text}</p></div><Button variant={insight.tone === 'emerald' ? 'outline' : 'default'} size="sm" className={`mt-4 h-9 w-fit rounded-lg px-4 text-xs font-bold ${insight.tone === 'emerald' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : insight.tone === 'red' ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-amber-600 text-white hover:bg-amber-700'}`} onClick={() => toast.info(insight.action)}>{insight.action}</Button></div></section>)}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border-2 border-slate-200 bg-card shadow-sm dark:border-slate-800"><div className="p-6"><h2 className="border-b-2 border-slate-100 pb-3 text-sm font-bold uppercase tracking-wide text-slate-900 dark:border-slate-800 dark:text-slate-100">Revenue vs Expense Timeline</h2></div><div className="px-6 pb-6"><div className="flex items-center justify-center gap-6 text-sm font-semibold text-slate-600 dark:text-slate-300"><span className="inline-flex items-center gap-2"><span className="h-4 w-8 rounded-sm border-4 border-sky-500" />Revenue</span><span className="inline-flex items-center gap-2"><span className="h-4 w-8 rounded-sm border-4 border-red-500" />Expense</span></div><div className="relative h-80 w-full"><FinanceTimelineChart monthly={monthly} maxTimelineValue={maxTimelineValue} /></div></div></section>
        <section className="rounded-xl border-2 border-slate-200 bg-card shadow-sm dark:border-slate-800"><div className="p-6"><h2 className="border-b-2 border-slate-100 pb-3 text-sm font-bold uppercase tracking-wide text-slate-900 dark:border-slate-800 dark:text-slate-100">Expense Breakdown by Category</h2></div><div className="grid min-h-72 grid-cols-1 items-center gap-6 px-6 pb-6 md:grid-cols-[1fr_170px]"><div className="flex justify-center"><div className="relative h-56 w-56 rounded-full shadow-sm" style={{ background: donut }} aria-label="Expense breakdown donut chart"><div className="absolute inset-14 rounded-full bg-card shadow-inner" /></div></div><div className="space-y-3">{breakdown.map(([name, percent, color]) => <div key={name} className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300"><span className="h-4 w-12" style={{ background: color }} /><span className="min-w-0 flex-1 truncate">{name}</span><span className="text-xs text-slate-500">{percent}%</span></div>)}</div></div></section>
      </div>
      <section id="finance-records-table" className="overflow-hidden rounded-xl border-2 border-slate-200 bg-card shadow-sm dark:border-slate-800">
        <div className="border-b-2 border-slate-200 bg-slate-50/60 p-6 dark:border-slate-800 dark:bg-slate-950/40"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><h2 className="text-sm font-bold uppercase tracking-wide text-slate-900 dark:text-slate-100">Finance Records</h2><div className="flex flex-wrap items-center gap-2"><Select value={typeFilter} onValueChange={(value) => value && setTypeFilter(value)}><SelectTrigger className="h-9 w-32 rounded border-2 border-slate-300 bg-card text-xs font-bold text-slate-800 dark:border-slate-800 dark:text-slate-200">{typeFilter}</SelectTrigger><SelectContent><SelectItem value="All">All</SelectItem><SelectItem value="Income">Income</SelectItem><SelectItem value="Expense">Expense</SelectItem></SelectContent></Select><Select value={categoryFilter} onValueChange={(value) => value && setCategoryFilter(value)}><SelectTrigger className="h-9 w-36 rounded border-2 border-slate-300 bg-card text-xs font-bold text-slate-800 dark:border-slate-800 dark:text-slate-200">{categoryFilter}</SelectTrigger><SelectContent><SelectItem value="All">All</SelectItem><SelectItem value="Product Sales">Product Sales</SelectItem><SelectItem value="Inventory">Inventory</SelectItem><SelectItem value="Marketing">Marketing</SelectItem></SelectContent></Select></div></div></div>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b-2 border-slate-200 bg-card text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:border-slate-800"><tr>{['Date', 'Description', 'Category', 'Type', 'Amount (MMK)', 'Actions'].map((heading) => <th key={heading} className={`px-6 py-4 ${heading === 'Amount (MMK)' ? 'text-right' : heading === 'Actions' ? 'text-center' : ''}`}>{heading}</th>)}</tr></thead><tbody className="divide-y-2 divide-slate-100 dark:divide-slate-900">{filteredRecords.map((record) => <tr key={record.id} className="transition hover:bg-slate-50 dark:hover:bg-slate-950/50"><td className="whitespace-nowrap px-6 py-4 text-xs font-bold text-slate-600 dark:text-slate-400">{record.date}</td><td className="px-6 py-4 text-xs font-bold text-slate-900 dark:text-slate-100">{record.description}</td><td className="px-6 py-4 text-xs font-semibold text-slate-500">{record.category}</td><td className="px-6 py-4"><span className={`rounded border-2 px-2.5 py-1 text-[10px] font-extrabold ${record.type === 'Income' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>{record.type.toUpperCase()}</span></td><td className={`whitespace-nowrap px-6 py-4 text-right text-sm font-black ${record.amount.startsWith('+') ? 'text-emerald-700' : 'text-red-700'}`}>{record.amount}</td><td className="px-6 py-4"><div className="flex items-center justify-center gap-2"><Button aria-label={`Edit ${record.description}`} variant="ghost" size="icon" className="h-7 w-7 text-blue-600 hover:text-blue-700" onClick={() => toast.info(`Edit ${record.description}`)}><Pencil className="h-4 w-4" /></Button><Button aria-label={`Delete ${record.description}`} variant="ghost" size="icon" className="h-7 w-7 text-red-600 hover:text-red-700" onClick={() => toast.success('Finance record action selected')}><Trash2 className="h-4 w-4" /></Button></div></td></tr>)}{filteredRecords.length === 0 && <tr><td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-500">No finance records found for these filters.</td></tr>}</tbody></table></div>
      </section>
    </div>
  );
}

function SalesWorkspace({ data }: { data?: CommerceWorkspaceData['sales'] }) {
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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"><FinanceKpiCard label="Total Sales" value={amount(data?.kpis.totalSales ?? 0)} unit="MMK" icon={DollarSign} accentClass="border-l-4 border-l-sky-500" /><FinanceKpiCard label="Orders" value={amount(data?.kpis.orders ?? 0)} icon={Megaphone} accentClass="border-l-4 border-l-violet-500" /><FinanceKpiCard label="Pending Deliveries" value={amount(data?.kpis.pendingDeliveries ?? 0)} icon={Package} accentClass="border-l-4 border-l-amber-500" /><FinanceKpiCard label="Deals in Pipeline" value={amount(data?.kpis.pipelineDeals ?? 0)} icon={TrendingUp} accentClass="border-l-4 border-l-emerald-500" /></div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {(data?.insights ?? [{ tone: 'amber' as const, title: 'No delivery signal yet', text: 'Delivery insights will appear after Commerce deals are added.', action: 'Review deliveries' }, { tone: 'emerald' as const, title: 'Pipeline data is ready', text: 'Deal pipeline insights will appear after active deals are recorded.', action: 'View pipeline' }]).map((insight) => <section key={insight.title} className={`bg-card border-2 ${insight.tone === 'emerald' ? 'border-emerald-300 border-l-emerald-500' : insight.tone === 'red' ? 'border-red-300 border-l-red-500' : 'border-amber-300 border-l-amber-500'} border-l-8 rounded-xl shadow-sm flex flex-col justify-between`}><div className="p-5 flex flex-col h-full justify-between"><div><div className="mb-2 flex items-center gap-3">{insight.tone === 'emerald' ? <TrendingUp className="h-5 w-5 text-emerald-600" /> : <AlertTriangle className={`h-5 w-5 ${insight.tone === 'red' ? 'text-red-600' : 'text-amber-600'}`} />}<h3 className="font-bold text-slate-900 dark:text-slate-100">{insight.title}</h3></div><p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{insight.text}</p></div><Button variant={insight.tone === 'emerald' ? 'outline' : 'default'} size="sm" className={`mt-4 h-9 w-fit rounded-lg px-4 text-xs font-bold ${insight.tone === 'emerald' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : insight.tone === 'red' ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-amber-600 text-white hover:bg-amber-700'}`} onClick={() => toast.info(insight.action)}>{insight.action}</Button></div></section>)}
      </div>
      <section className="rounded-xl border-2 border-slate-200 bg-card shadow-sm dark:border-slate-800">
        <div className="flex flex-col gap-3 border-b-2 border-slate-200 bg-slate-50/60 p-6 dark:border-slate-800 dark:bg-slate-950/40 md:flex-row md:items-center md:justify-between"><div><h2 className="text-sm font-bold uppercase tracking-wide text-slate-900 dark:text-slate-100">Deal Pipeline</h2><p className="mt-1 text-xs text-muted-foreground">Deals grouped by their current sales stage.</p></div><span className="text-xs font-bold text-muted-foreground border-2 border-border bg-muted px-3 py-1 rounded-full">{amount(data?.kpis.pipelineDeals ?? 0)} Active Deals</span></div>
        <div className="grid grid-cols-1 gap-4 p-6 lg:grid-cols-4">{stages.map((stage) => <section key={stage.label} className={`rounded-xl border-t-4 ${stage.color} ${stage.bg} p-4`}><div className="mb-4"><h3 className="text-xs font-extrabold uppercase tracking-wide text-slate-600 dark:text-slate-300">{stage.label}</h3><p className="mt-1 text-[11px] font-semibold text-slate-500">{stage.count} deals in this stage</p></div><div className="space-y-3">{stage.deals.map((deal) => <button key={deal.id} type="button" onClick={() => toast.info(`${deal.customer} selected`)} className="w-full rounded-lg border border-slate-200 bg-card p-3 text-left text-xs font-bold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:text-slate-200"><span className="block truncate">{deal.customer}</span><span className="mt-1 block text-[10px] font-semibold text-slate-500">{amount(deal.amount)} MMK</span></button>)}</div><Button variant="ghost" size="sm" className="mt-3 h-8 w-full text-xs font-bold text-slate-600 hover:bg-card" onClick={() => toast.info(`Showing all ${stage.count} ${stage.label.toLowerCase()} deals`)}>View all {stage.count} deals</Button></section>)}</div>
      </section>
    </div>
  );
}

function MarketingWorkspace({ data }: { data?: CommerceWorkspaceData['marketing'] }) {
  const weekly = data?.chart.length ? data.chart.map((item) => [item.label, item.spend, item.orders] as const) : [['W1', 0, 0], ['W2', 0, 0], ['W3', 0, 0], ['W4', 0, 0]] as const;
  const topProducts = data?.topProducts ?? [];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <FinanceKpiCard label="Total Ad Expense" value={amount(data?.kpis.adSpend ?? 0)} unit="MMK" icon={ReceiptText} accentClass="border-l-4 border-l-pink-500" />
        <FinanceKpiCard label="Reach" value={amount(data?.kpis.reach ?? 0)} icon={Users} accentClass="border-l-4 border-l-sky-500" />
        <FinanceKpiCard label="Cost per Order" value={amount(data?.kpis.costPerOrder ?? 0)} unit="MMK" icon={DollarSign} accentClass="border-l-4 border-l-amber-500" />
        <FinanceKpiCard label="Ad-driven Orders" value={amount(data?.kpis.adOrders ?? 0)} icon={Megaphone} accentClass="border-l-4 border-l-emerald-500" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{(data?.insights ?? [{ tone: 'amber' as const, title: 'Marketing data is ready', text: 'Ad spend and order insights will appear after marketing records are added.', action: 'Review ad targeting' }, { tone: 'emerald' as const, title: 'Product conversion data is ready', text: 'Top ad-driven products will appear after product sales are recorded.', action: 'View product campaign' }]).map((insight) => <section key={insight.title} className={`bg-card border-2 ${insight.tone === 'emerald' ? 'border-emerald-300 border-l-emerald-500' : insight.tone === 'red' ? 'border-red-300 border-l-red-500' : 'border-amber-300 border-l-amber-500'} border-l-8 rounded-xl shadow-sm flex flex-col justify-between`}><div className="p-5 flex flex-col h-full justify-between"><div><div className="mb-2 flex items-center gap-3">{insight.tone === 'emerald' ? <TrendingUp className="h-5 w-5 text-emerald-600" /> : <AlertTriangle className={`h-5 w-5 ${insight.tone === 'red' ? 'text-red-600' : 'text-amber-600'}`} />}<h3 className="font-bold text-slate-900 dark:text-slate-100">{insight.title}</h3></div><p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{insight.text}</p></div><Button variant={insight.tone === 'emerald' ? 'outline' : 'default'} size="sm" className={`mt-4 h-9 w-fit rounded-lg px-4 text-xs font-bold ${insight.tone === 'emerald' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : insight.tone === 'red' ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-amber-600 text-white hover:bg-amber-700'}`} onClick={() => toast.info(insight.action)}>{insight.action}</Button></div></section>)}</div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border-2 border-slate-200 bg-card shadow-sm dark:border-slate-800"><div className="p-6"><h2 className="border-b-2 border-slate-100 pb-3 text-sm font-bold uppercase tracking-wide text-slate-900 dark:border-slate-800 dark:text-slate-100">Ad Spend vs Ad-driven Orders</h2></div><div className="px-6 pb-6"><div className="mb-4 flex items-center justify-center gap-6 text-sm font-semibold text-slate-600"><span className="inline-flex items-center gap-2"><span className="h-4 w-8 rounded-sm bg-sky-500" />Ad Spend</span><span className="inline-flex items-center gap-2"><span className="h-1 w-8 bg-emerald-500" />Orders</span></div><div className="relative h-72 w-full"><MarketingPerformanceChart weekly={weekly} /></div></div></section>
        <section className="rounded-xl border-2 border-slate-200 bg-card shadow-sm dark:border-slate-800"><div className="p-6"><h2 className="border-b-2 border-slate-100 pb-3 text-sm font-bold uppercase tracking-wide text-slate-900 dark:border-slate-800 dark:text-slate-100">Top Performing Products (Ad-driven)</h2></div><div className="divide-y-2 divide-slate-100 px-6 dark:divide-slate-900">{topProducts.length ? topProducts.map((product, index) => <div key={product.name} className="flex items-center justify-between gap-4 py-5"><div className="min-w-0"><p className="truncate font-bold text-slate-900 dark:text-slate-100">{index + 1}. {product.name}</p><p className="mt-1 text-xs font-semibold text-slate-500">Ad-attributed product sales</p></div><span className="whitespace-nowrap rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-bold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">{product.orders} orders</span></div>) : <div className="py-10 text-center text-sm font-semibold text-slate-500">No ad-driven product data yet.</div>}</div></section>
      </div>
    </div>
  );
}

function CustomerServiceWorkspace({ data }: { data?: CommerceWorkspaceData['customers'] }) {
  const customers = data?.purchasedCustomers ?? [];
  const leads = data?.leads ?? [];
  const highPotential = data?.kpis.highPotential ?? 0;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"><FinanceKpiCard label="Total Inquiries" value={amount(data?.kpis.inquiries ?? 0)} icon={Megaphone} accentClass="border-l-4 border-l-sky-500" /><FinanceKpiCard label="High Potential" value={amount(highPotential)} icon={TrendingUp} accentClass="border-l-4 border-l-emerald-500" /><FinanceKpiCard label="Total Customers" value={amount(data?.kpis.totalCustomers ?? 0)} icon={Users} accentClass="border-l-4 border-l-violet-500" /><FinanceKpiCard label="Avg Order Value" value={amount(data?.kpis.avgOrderValue ?? 0)} unit="MMK" icon={DollarSign} accentClass="border-l-4 border-l-amber-500" /></div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section className="bg-card border-2 border-emerald-300 border-l-8 border-l-emerald-500 rounded-xl shadow-sm flex flex-col justify-between"><div className="p-5 flex flex-col h-full justify-between"><div><div className="mb-2 flex items-center gap-3"><TrendingUp className="h-5 w-5 text-emerald-600" /><h3 className="font-bold text-slate-900 dark:text-slate-100">{highPotential > 0 ? `${highPotential} high-potential inquiries need attention` : 'No high-potential inquiries yet'}</h3></div><p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">Prioritize people who have asked about products, prices, or delivery. They are closest to purchase.</p></div><Button variant="outline" size="sm" className="mt-4 h-9 w-fit rounded-lg border-emerald-200 bg-emerald-50 text-xs font-bold text-emerald-700 hover:bg-emerald-100" onClick={() => toast.info('High-potential leads filter selected')}>Review high potential</Button></div></section>
        <section className="bg-card border-2 border-amber-300 border-l-8 border-l-amber-500 rounded-xl shadow-sm flex flex-col justify-between"><div className="p-5 flex flex-col h-full justify-between"><div><div className="mb-2 flex items-center gap-3"><AlertTriangle className="h-5 w-5 text-amber-600" /><h3 className="font-bold text-slate-900 dark:text-slate-100">{leads.length > 0 ? `Follow-up timing needs review (${leads.length} open)` : 'Follow-up queue is clear'}</h3></div><p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">Some inquiries have not received a response recently. Review the queue before customer interest cools.</p></div><Button size="sm" className="mt-4 h-9 w-fit rounded-lg bg-amber-600 px-4 text-xs font-bold text-white hover:bg-amber-700" onClick={() => toast.info('Follow-up queue selected')}>Review follow-ups</Button></div></section>
      </div>
      <section className="bg-card border-2 border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden"><div className="p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"><h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wide">1. Purchased Customers Directory</h2><Button variant="outline" size="sm" className="h-9 text-xs font-bold" onClick={() => toast.info('Customer directory opened')}>View all customers</Button></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-b-2 border-slate-200 bg-slate-50/60 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950/40"><tr>{['Customer Name', 'Purchased Product', 'Amount Paid (MMK)', 'Status', 'Actions'].map((heading) => <th key={heading} className={`px-6 py-4 ${heading.includes('Amount') ? 'text-right' : heading === 'Actions' ? 'text-center' : 'text-left'}`}>{heading}</th>)}</tr></thead><tbody className="divide-y-2 divide-slate-100 dark:divide-slate-900">{customers.map((customer) => <tr key={customer.id} className="transition hover:bg-slate-50 dark:hover:bg-slate-950/50"><td className="px-6 py-4 text-xs font-bold text-slate-900 dark:text-slate-100">{customer.name}</td><td className="px-6 py-4 text-xs font-semibold text-slate-500">{customer.product}</td><td className="px-6 py-4 text-right text-sm font-black text-emerald-700">{amount(customer.amount)}</td><td className="px-6 py-4"><span className="rounded border-2 border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold text-emerald-700">{customer.status.toUpperCase()}</span></td><td className="px-6 py-4"><div className="flex items-center justify-center gap-2"><Button aria-label={`Edit ${customer.name}`} variant="ghost" size="icon" className="h-7 w-7 text-blue-600 hover:text-blue-700" onClick={() => toast.info(`Edit ${customer.name}`)}><Pencil className="h-4 w-4" /></Button><Button aria-label={`Delete ${customer.name}`} variant="ghost" size="icon" className="h-7 w-7 text-red-600 hover:text-red-700" onClick={() => toast.success(`${customer.name} moved to Trash`)}><Trash2 className="h-4 w-4" /></Button></div></td></tr>)}{customers.length === 0 && <tr><td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">No purchased customers yet.</td></tr>}</tbody></table></div></section>
      <section className="bg-card border-2 border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden"><div className="p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"><h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wide">2. Inquiry / Lead Data</h2><Button variant="outline" size="sm" className="h-9 text-xs font-bold" onClick={() => toast.info('Inquiry data opened')}>View all inquiries</Button></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-b-2 border-slate-200 bg-slate-50/60 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950/40"><tr>{['Customer Name', 'Source', 'Interested Product', 'Status', 'Actions'].map((heading) => <th key={heading} className={`px-6 py-4 ${heading === 'Actions' ? 'text-center' : 'text-left'}`}>{heading}</th>)}</tr></thead><tbody className="divide-y-2 divide-slate-100 dark:divide-slate-900">{leads.map((lead) => <tr key={lead.id} className="transition hover:bg-slate-50 dark:hover:bg-slate-950/50"><td className="px-6 py-4 text-xs font-bold text-slate-900 dark:text-slate-100">{lead.name}</td><td className="px-6 py-4 text-xs font-semibold text-slate-500">{lead.source}</td><td className="px-6 py-4 text-xs font-semibold text-slate-500">{lead.product}</td><td className="px-6 py-4"><span className={`rounded border-2 px-2.5 py-1 text-[10px] font-extrabold ${lead.status === 'High Potential' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : lead.status === 'Follow-up' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-sky-200 bg-sky-50 text-sky-700'}`}>{lead.status.toUpperCase()}</span></td><td className="px-6 py-4"><div className="flex items-center justify-center gap-2"><Button aria-label={`Edit ${lead.name} lead`} variant="ghost" size="icon" className="h-7 w-7 text-blue-600 hover:text-blue-700" onClick={() => toast.info(`Edit ${lead.name}`)}><Pencil className="h-4 w-4" /></Button><Button aria-label={`Delete ${lead.name} lead`} variant="ghost" size="icon" className="h-7 w-7 text-red-600 hover:text-red-700" onClick={() => toast.success(`${lead.name} moved to Trash`)}><Trash2 className="h-4 w-4" /></Button></div></td></tr>)}{leads.length === 0 && <tr><td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">No inquiry or lead data yet.</td></tr>}</tbody></table></div></section>
    </div>
  );
}

function InventoryWorkspace({ data }: { data?: CommerceWorkspaceData['inventory'] }) {
  const products = data?.products ?? [];
  const outOfStock = products.filter((product) => product.status === 'Out of Stock');
  const wellStocked = products.find((product) => product.status === 'In Stock');
  const statusClass = (status: string) => status === 'In Stock' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : status === 'Low Stock' ? 'border-amber-200 bg-amber-50 text-amber-700' : status === 'Out of Stock' ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-slate-50 text-slate-600';
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"><FinanceKpiCard label="Total Products" value={amount(data?.kpis.totalProducts ?? 0)} icon={Package} accentClass="border-l-4 border-l-sky-500" /><FinanceKpiCard label="Low Stock Items" value={amount(data?.kpis.lowStockItems ?? 0)} icon={AlertTriangle} accentClass="border-l-4 border-l-amber-500" /><FinanceKpiCard label="Out of Stock" value={amount(data?.kpis.outOfStock ?? 0)} icon={Package} accentClass="border-l-4 border-l-red-500" /><FinanceKpiCard label="Inventory Value" value={amount(data?.kpis.inventoryValue ?? 0)} unit="MMK" icon={DollarSign} accentClass="border-l-4 border-l-emerald-500" /></div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section className="bg-card border-2 border-red-300 border-l-8 border-l-red-500 rounded-xl shadow-sm flex flex-col justify-between"><div className="p-5 flex flex-col h-full justify-between"><div><div className="mb-2 flex items-center gap-3"><AlertTriangle className="h-5 w-5 text-red-600" /><h3 className="font-bold text-slate-900 dark:text-slate-100">{outOfStock.length > 0 ? `${outOfStock.length} product${outOfStock.length === 1 ? ' is' : 's are'} out of stock` : 'No stockouts right now'}</h3></div><p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{outOfStock.length > 0 ? `${outOfStock.slice(0, 3).map((product) => product.name).join(', ')} cannot be sold until replenished. Review supplier availability.` : 'Every product has stock available for the next sale.'}</p></div><Button size="sm" className="mt-4 h-9 w-fit rounded-lg bg-red-600 px-4 text-xs font-bold text-white hover:bg-red-700" onClick={() => toast.info('Out-of-stock products selected')}>Review stockouts</Button></div></section>
        <section className="bg-card border-2 border-emerald-300 border-l-8 border-l-emerald-500 rounded-xl shadow-sm flex flex-col justify-between"><div className="p-5 flex flex-col h-full justify-between"><div><div className="mb-2 flex items-center gap-3"><TrendingUp className="h-5 w-5 text-emerald-600" /><h3 className="font-bold text-slate-900 dark:text-slate-100">{wellStocked ? `${wellStocked.name} is well stocked` : 'Stock levels look stable'}</h3></div><p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{wellStocked ? `${wellStocked.stockLevel}. It can support the next promotion cycle.` : 'Low-stock alerts will appear when a product crosses its threshold.'}</p></div><Button variant="outline" size="sm" className="mt-4 h-9 w-fit rounded-lg border-emerald-200 bg-emerald-50 text-xs font-bold text-emerald-700 hover:bg-emerald-100" onClick={() => toast.info(wellStocked ? `${wellStocked.name} selected` : 'Inventory overview selected')}>View product</Button></div></section>
      </div>
      <section className="bg-card border-2 border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden"><div className="p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"><div><h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wide">Product Catalog</h2><p className="mt-1 text-xs text-muted-foreground">Product Code is the internal identifier used to identify each product.</p></div><Button variant="outline" size="sm" className="h-9 text-xs font-bold" onClick={() => toast.info('Product catalog opened')}>View all products</Button></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-b-2 border-slate-200 bg-slate-50/60 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950/40"><tr>{['Product', 'Product Code', 'Stock Level', 'Status', 'Actions'].map((heading) => <th key={heading} className={`px-6 py-4 ${heading === 'Actions' ? 'text-center' : 'text-left'}`}>{heading}</th>)}</tr></thead><tbody className="divide-y-2 divide-slate-100 dark:divide-slate-900">{products.map((product) => <tr key={product.id} className="transition hover:bg-slate-50 dark:hover:bg-slate-950/50"><td className="px-6 py-4 text-xs font-bold text-slate-900 dark:text-slate-100">{product.name}</td><td className="px-6 py-4 text-xs font-bold text-slate-500">{product.productCode}</td><td className="px-6 py-4 text-xs font-semibold text-slate-500">{product.stockLevel}</td><td className="px-6 py-4"><span className={`rounded border-2 px-2.5 py-1 text-[10px] font-extrabold ${statusClass(product.status)}`}>{product.status.toUpperCase()}</span></td><td className="px-6 py-4"><div className="flex items-center justify-center gap-2"><Button aria-label={`Edit ${product.name}`} variant="ghost" size="icon" className="h-7 w-7 text-blue-600 hover:text-blue-700" onClick={() => toast.info(`Edit ${product.name}`)}><Pencil className="h-4 w-4" /></Button><Button aria-label={`Delete ${product.name}`} variant="ghost" size="icon" className="h-7 w-7 text-red-600 hover:text-red-700" onClick={() => toast.success(`${product.name} moved to Trash`)}><Trash2 className="h-4 w-4" /></Button></div></td></tr>)}{products.length === 0 && <tr><td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">No products in catalog yet.</td></tr>}</tbody></table></div></section>
    </div>
  );
}

export function ProductSalesWorkspace({ workspace }: { workspace: Workspace }) {
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
  const [targetRevenue, setTargetRevenue] = useState('30000000');
  const [targetExpense, setTargetExpense] = useState('11000000');
  const [targetOrders, setTargetOrders] = useState('220');
  const [targetFulfilledOrders, setTargetFulfilledOrders] = useState('220');
  const [targetNewCustomers, setTargetNewCustomers] = useState('120');
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
  const { data: recommendationsData, isLoading: recsLoading } = useCommerceRecommendations(dashboardParams, overview);
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
    setTargetRevenue(String(dashboard.targets.targetSalesAmount));
    setTargetExpense(String(dashboard.targets.targetExpenseAmount));
    setTargetOrders(String(dashboard.targets.targetDemandCount));
    setTargetFulfilledOrders(String(dashboard.targets.targetAppointments));
    setTargetNewCustomers(String(dashboard.targets.targetNewCustomers));
  }, [dashboard?.targets]);

  const iconMap = {
    DollarSign,
    Wallet,
    TrendingUp,
    Megaphone,
    CalendarCheck,
    Users,
  };

  const fallbackOverviewCards = [
    ['Revenue', amount(0), `${amount(30_000_000)} MMK`, `Expected (Day 30): ${amount(30_000_000)}`, 'Below Target', 'red', DollarSign, 0],
    ['Expense Limit', amount(0), `${amount(11_000_000)} MMK`, `Expected: ${amount(11_000_000)}`, 'On Track', 'emerald', Wallet, 0],
    ['Profit Margin', '0.0%', '63% Margin', 'Target Margin: 63%', 'Below Target', 'red', TrendingUp, 0],
    ['Orders Received', '0', '220', 'Expected (Day 30): 220', 'Below Target', 'red', Megaphone, 0],
    ['Orders Fulfilled', '0', '220', 'Expected (Day 30): 220', 'Below Target', 'red', CalendarCheck, 0],
    ['New Customers', '0', '120 Target', 'Expected (Day 30): 120', 'Below Target', 'red', Users, 0],
  ] as const;

  const cards = [
    ...(dashboard?.kpis.map((kpi) => [kpi.title, kpi.value, kpi.target, kpi.expected, kpi.status, kpi.tone, iconMap[kpi.icon], kpi.progressPercent] as const) ?? fallbackOverviewCards),
  ] as const;

  function handleSaveTargets() {
    saveTargets.mutate({
      ...dashboardParams,
      targetSalesAmount: Number(targetRevenue || 0),
      targetExpenseAmount: Number(targetExpense || 0),
      targetDemandCount: Number(targetOrders || 0),
      targetAppointments: Number(targetFulfilledOrders || 0),
      targetNewCustomers: Number(targetNewCustomers || 0),
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

      {workspace === 'finance' ? <FinanceWorkspace data={workspaceData?.finance} /> : workspace === 'sales' ? <SalesWorkspace data={workspaceData?.sales} /> : workspace === 'marketing' ? <MarketingWorkspace data={workspaceData?.marketing} /> : workspace === 'customers' ? <CustomerServiceWorkspace data={workspaceData?.customers} /> : workspace === 'inventory' ? <InventoryWorkspace data={workspaceData?.inventory} /> : <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cards.map(([title, value, target, expected, status, tone, icon, progressPercent]) => <ProgressCard key={title} title={title} value={value} target={target} expected={expected} status={status} tone={tone} icon={icon} progressPercent={progressPercent} />)}
      </div>

      {!recsLoading && (
        <SmartSuggestions recommendations={recommendationsData?.recommendations} isLoading={recsLoading} onSetTargets={() => setIsTargetDialogOpen(true)} />
      )}

      <BusinessOverviewAnalytics dashboard={dashboard} periodLabel={periodRangeLabel(period, year, month, day, customFrom, customTo)} />
      </>}

      <Dialog open={isTargetDialogOpen} onOpenChange={setIsTargetDialogOpen}>
        <DialogContent showCloseButton={false} className="w-full max-w-md rounded-xl border border-slate-200 bg-card p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto dark:border-slate-800">
          <DialogHeader className="flex-row items-center justify-between border-b border-border pb-3">
            <div>
              <DialogTitle className="font-extrabold text-foreground flex items-center gap-2"><Target className="w-5 h-5 text-emerald-500" />Set Period Targets</DialogTitle>
              <DialogDescription className="mt-0.5 text-[11px] font-bold uppercase tracking-wide">For {periodRangeLabel(period, year, month, day, customFrom, customTo)}</DialogDescription>
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
