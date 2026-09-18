/** Shared commerce charts, KPI cards, and insight components.
 * Extracted verbatim from product-sales-workspace.
 */
'use client';

export type CardTone = 'emerald' | 'red' | 'sky' | 'amber' | 'slate';

export const amount = (value: number) => value.toLocaleString();
import {
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  useRouter,
} from 'next/navigation';
import {
  AlertTriangle,
  Award,
  BarChart3,
  Bot,
  ChevronDown,
  ChevronUp,
  DollarSign,
  LineChart,
  Phone,
  Server,
  Trophy,
} from 'lucide-react';
import type {
  LucideIcon,
} from 'lucide-react';
import {
  Button,
} from '@/components/ui/button';
import type {
  CommerceActionRecommendation,
  CommerceDashboard,
} from '@/lib/api';

export function periodRangeLabel(
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

export function ProgressCard({
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
    slate: 'bg-slate-400 text-slate-500',
  }[tone];
  const progress = progressPercent ?? (tone === 'emerald' ? 96 : tone === 'red' ? 28 : tone === 'amber' ? 62 : tone === 'slate' ? 0 : 68);

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

export const recommendationActionLink: Record<CommerceActionRecommendation['actionType'], string> = {
  view_sales: '/sales',
  view_finance: '/finance',
  view_inventory: '/inventory',
  view_marketing: '/marketing',
  set_target_modal: '',
  general_dashboard: '/dashboard',
};

export function SmartSuggestions({
  recommendations,
  isLoading,
  onSetTargets,
  areaFilter,
  limit,
}: {
  recommendations?: CommerceActionRecommendation[];
  isLoading: boolean;
  onSetTargets?: () => void;
  areaFilter?: 'sales' | 'marketing' | 'inventory' | 'finance' | 'general';
  limit?: number;
}) {
  const router = useRouter();
  const [visible, setVisible] = useState(true);
  
  const filtered = areaFilter && areaFilter !== 'general'
    ? (recommendations?.filter((rec) => rec.area === areaFilter || (areaFilter === 'sales' && rec.area === 'general')) ?? [])
    : (recommendations ?? []);

  const maxCount = limit ?? (areaFilter === 'general' || !areaFilter ? 4 : 2);
  const displayRecs = filtered.slice(0, maxCount);

  if (!isLoading && displayRecs.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-xl border-2 border-sky-200 bg-sky-50/30 shadow-sm dark:border-sky-900/60 dark:bg-sky-950/15">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Bot className="h-4 w-4 text-sky-600" />
            Smart Suggestions
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">ဒီကာလအတွက် အဓိကဆောင်ရွက်ရန် လိုအပ်ချက်များကို တွက်ချက်ဖော်ပြထားပါသည်။</p>
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
        <div className="grid grid-cols-1 gap-4 border-t border-sky-200 p-5 md:grid-cols-2 dark:border-sky-900/60">
          {isLoading ? (
            <p className="text-xs text-muted-foreground animate-pulse py-2">အကြံပြုချက်များကို တွက်ချက်နေပါသည်…</p>
          ) : (
            displayRecs.map((rec, index) => {
              const isAlert = rec.severity === 'urgent' || rec.severity === 'warning';
              const borderColor = isAlert ? 'border-amber-300 dark:border-amber-900/60' : 'border-emerald-300 dark:border-emerald-900/60';
              const borderLeftColor = isAlert ? 'border-l-amber-500' : 'border-l-emerald-500';
              const iconColor = isAlert ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400';
              const Icon = isAlert ? AlertTriangle : Award;
              return (
                <div key={`${rec.actionType}-${index}`} className={`bg-card border-2 ${borderColor} border-l-8 ${borderLeftColor} rounded-xl p-5 flex flex-col justify-between shadow-sm`}>
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <Icon className={`${iconColor} w-5 h-5 flex-shrink-0`} />
                      <h4 className="font-bold text-foreground text-sm">{rec.title}</h4>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{rec.insight}</p>
                  </div>
                  {rec.action && (
                    <div className="mt-3.5 flex justify-start">
                      <button
                        onClick={() => {
                          if (rec.actionType === 'set_target_modal' && onSetTargets) onSetTargets();
                          else if (recommendationActionLink[rec.actionType]) router.push(recommendationActionLink[rec.actionType]);
                        }}
                        className={`${
                          isAlert
                            ? 'bg-amber-600 hover:bg-amber-700 text-white'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        } px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm cursor-pointer inline-flex items-center gap-1`}
                      >
                        {rec.action}
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </section>
  );
}

export function CommerceLineChart({ data }: { data: { label: string; value: number }[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const dailyIncome = data.length ? data.map((point) => point.value) : Array.from({ length: 12 }, () => 0);
  const chartLeft = 60;
  const chartRight = 670;
  const chartWidth = chartRight - chartLeft;
  const chartBottom = 185;
  const chartTop = 25;
  const isEmpty = dailyIncome.every((value) => value === 0);
  const maxIncome = isEmpty ? 500_000 : Math.max(100_000, Math.ceil(Math.max(...dailyIncome) / 500_000) * 500_000);
  const divisor = Math.max(dailyIncome.length - 1, 1);
  const slotWidth = chartWidth / divisor;
  const points = dailyIncome.map((income, index) => `${chartLeft + (index / divisor) * chartWidth},${chartBottom - (income / maxIncome) * (chartBottom - chartTop)}`).join(' ');
  const labels = data.length ? data.map((point) => point.label) : Array.from({ length: 12 }, (_, index) => String(index + 1));
  const yLabels = Array.from({ length: 6 }, (_, index) => Math.round((maxIncome / 5) * index));
  const hovered = hoveredIndex !== null && data[hoveredIndex] ? data[hoveredIndex] : null;

  return (
    <div className="relative w-full mt-4 select-none" aria-label="Daily income trend chart" role="img">
      <svg viewBox="0 0 700 240" className="w-full overflow-visible" style={{ display: 'block' }} preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="commerceLineGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {[25, 57, 89, 121, 153, 185].map((y) => (
          <line key={y} x1={chartLeft} y1={y} x2={chartRight} y2={y} stroke="#e2e8f0" strokeDasharray="3 3" className="dark:stroke-slate-800" />
        ))}
        {yLabels.map((value, index) => (
          <text key={`${value}-${index}`} x="60" y={189 - index * 32} textAnchor="end" className="fill-slate-500 dark:fill-slate-400 font-mono" style={{ fontSize: '9px' }}>
            {value.toLocaleString()}
          </text>
        ))}
        {!isEmpty && <path d={`M ${points.split(' ').join(' L ')} L ${chartRight} ${chartBottom} L ${chartLeft} ${chartBottom} Z`} fill="url(#commerceLineGradient)" />}
        <line x1={chartLeft} y1={chartBottom} x2={chartRight} y2={chartBottom} stroke="#cbd5e1" strokeWidth="1.5" className="dark:stroke-slate-700" />
        {labels.map((label, index) => {
          const x = chartLeft + (index / divisor) * chartWidth;
          const shouldShowLabel = labels.length <= 15 || index === 0 || index === labels.length - 1 || index % Math.ceil(labels.length / 10) === 0;
          return (
            <g key={`${label}-${index}`}>
              <line x1={x} y1={chartBottom} x2={x} y2={chartBottom + 4} stroke="#cbd5e1" strokeWidth="1" className="dark:stroke-slate-700" />
              {shouldShowLabel && (
                <text x={x} y="206" textAnchor="middle" className="fill-slate-500 dark:fill-slate-400" style={{ fontSize: '8.5px', fontFamily: "'Inter', sans-serif" }}>
                  {label}
                </text>
              )}
            </g>
          );
        })}
        {!isEmpty && <polyline points={points} fill="none" stroke="#0ea5e9" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
        {!isEmpty && points.split(' ').map((point, index) => {
          const [cx, cy] = point.split(',').map(Number);
          return (
            <g key={point}>
              <circle cx={cx} cy={cy} r={hoveredIndex === index ? 6 : 3.5} fill="#0ea5e9" stroke="white" strokeWidth={hoveredIndex === index ? 2.5 : 1.5} />
              <rect
                x={cx - slotWidth / 2}
                y={chartTop}
                width={Math.max(12, slotWidth)}
                height={chartBottom - chartTop + 20}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            </g>
          );
        })}
      </svg>
      {hovered && (
        <div
          className="pointer-events-none absolute z-20 transition-all duration-75"
          style={{
            left: `${((chartLeft + (hoveredIndex! / divisor) * chartWidth) / 700) * 100}%`,
            top: `${((chartBottom - (hovered.value / maxIncome) * (chartBottom - chartTop)) / 240) * 100}%`,
            transform: 'translate(-50%, -120%)',
          }}
        >
          <div className="whitespace-nowrap rounded-lg border border-slate-700/50 bg-slate-900/95 px-3 py-1.5 text-xs text-white shadow-xl backdrop-blur-sm">
            <span className="font-semibold text-slate-300">{hovered.label}: </span>
            <b className="text-sky-400 font-bold">{hovered.value.toLocaleString()} MMK</b>
          </div>
        </div>
      )}
    </div>
  );
}

export function CommerceBarChart({ data }: { data: { label: string; value: number }[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const dailyOrders = data.length ? data.map((point) => point.value) : Array.from({ length: 12 }, () => 0);
  const chartLeft = 50;
  const chartWidth = 630;
  const slotWidth = chartWidth / dailyOrders.length;
  const maxOrders = Math.max(5, Math.ceil(Math.max(...dailyOrders) / 5) * 5);
  const hovered = hoveredIndex !== null && data[hoveredIndex] ? data[hoveredIndex] : null;

  return (
    <div className="relative w-full mt-4 select-none" aria-label="Daily order volume chart" role="img">
      <svg viewBox="0 0 700 240" className="w-full overflow-visible" style={{ display: 'block' }} preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="orderBarGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#6d28d9" stopOpacity="0.75" />
          </linearGradient>
        </defs>
        {[20, 54, 88, 122, 156, 190].map((y) => (
          <line key={y} x1="50" y1={y} x2="680" y2={y} stroke="#f1f5f9" className="dark:stroke-slate-800" />
        ))}
        {Array.from({ length: 6 }, (_, index) => Math.round((maxOrders / 5) * index)).map((value, index) => (
          <text key={value} x="42" y={194 - index * 34} textAnchor="end" className="fill-slate-500 dark:fill-slate-400 font-mono" style={{ fontSize: '9px' }}>
            {value}
          </text>
        ))}
        {dailyOrders.map((orders, index) => {
          const height = (orders / maxOrders) * 170;
          const barWidth = Math.max(6, Math.min(28, slotWidth - 6));
          const x = chartLeft + index * slotWidth + (slotWidth - barWidth) / 2;
          const y = 190 - height;
          return (
            <g key={index} onMouseEnter={() => setHoveredIndex(index)} onMouseLeave={() => setHoveredIndex(null)} className="cursor-pointer">
              {height > 0 && (
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={height}
                  rx="3"
                  fill="url(#orderBarGradient)"
                  className="transition-all duration-150 hover:brightness-110"
                />
              )}
              <rect x={chartLeft + index * slotWidth} y="20" width={slotWidth} height="170" fill="transparent" />
            </g>
          );
        })}
        {(data.length ? data : Array.from({ length: 12 }, (_, index) => ({ label: String(index + 1), value: 0 }))).map((point, index) => {
          const x = chartLeft + index * slotWidth + slotWidth / 2;
          const shouldShow = data.length <= 15 || index === 0 || index === data.length - 1 || index % Math.ceil(data.length / 10) === 0;
          return shouldShow ? (
            <text key={`${point.label}-${index}`} x={x} y="207" textAnchor="middle" className="fill-slate-500 dark:fill-slate-400" style={{ fontSize: '8.5px', fontFamily: "'Inter', sans-serif" }}>
              {point.label}
            </text>
          ) : null;
        })}
        <line x1="50" y1="190" x2="680" y2="190" stroke="#cbd5e1" strokeWidth="1.5" className="dark:stroke-slate-700" />
      </svg>
      {hovered && (
        <div
          className="pointer-events-none absolute z-20 transition-all duration-75"
          style={{
            left: `${((chartLeft + hoveredIndex! * slotWidth + slotWidth / 2) / 700) * 100}%`,
            top: `${((190 - (hovered.value / maxOrders) * 170) / 240) * 100}%`,
            transform: 'translate(-50%, -120%)',
          }}
        >
          <div className="whitespace-nowrap rounded-lg border border-slate-700/50 bg-slate-900/95 px-3 py-1.5 text-xs text-white shadow-xl backdrop-blur-sm">
            <span className="font-semibold text-slate-300">{hovered.label}: </span>
            <b className="text-violet-400 font-bold">{hovered.value} Orders</b>
          </div>
        </div>
      )}
    </div>
  );
}

export function BusinessOverviewAnalytics({ periodLabel, dashboard }: { periodLabel: string; dashboard?: CommerceDashboard }) {
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
          <div className="overflow-x-auto flex-1"><table className="w-full text-left text-sm"><thead><tr className="text-muted-foreground uppercase text-[10px] font-extrabold tracking-wider border-b-2 border-border"><th className="pb-3 pt-2">Product</th><th className="pb-3 pt-2 text-center">Qty</th><th className="pb-3 pt-2 text-right">Income (MMK)</th></tr></thead><tbody className="divide-y-2 divide-border/50">{products.length ? products.map((product, idx) => <tr key={`${product.sku ?? product.name}-${idx}`} className="hover:bg-muted/30 transition"><td className="py-3.5 font-bold text-foreground">{product.name}</td><td className="py-3.5 text-center text-muted-foreground font-bold">{product.quantity}</td><td className="py-3.5 text-right font-extrabold text-sky-600 dark:text-sky-400">{amount(product.income)}</td></tr>) : <tr><td colSpan={3} className="py-8 text-center text-sm font-semibold text-muted-foreground">No product sales yet for this period.</td></tr>}</tbody></table></div>
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

export function FinanceKpiCard({ label, value, icon: Icon, accentClass, unit }: { label: string; value: string; icon: LucideIcon; accentClass: string; unit?: string }) {
  return (
    <section className={`bg-card border-2 border-slate-200 dark:border-slate-800 shadow-sm rounded-xl ${accentClass}`}>
      <div className="flex h-28 flex-col justify-center p-4"><div className="flex items-start justify-between gap-3"><div><p className="mb-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">{label}</p><h3 className="flex items-baseline gap-1.5 whitespace-nowrap text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100"><span>{value}</span>{unit && <span className="text-xs font-bold text-slate-400">{unit}</span>}</h3></div><div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-900"><Icon className="h-4 w-4" /></div></div></div>
    </section>
  );
}

export function FinanceTimelineChart({ monthly }: { monthly: [string, number, number][] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const maxValue = Math.max(...monthly.flatMap(([, revenue, expense]) => [revenue, expense]), 1);
  const axisMax = Math.ceil(Math.max(1, maxValue / 1_000_000) * 10) / 10;
  const width = 1120, height = 330, left = 72, right = 32, top = 24, bottom = 48;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const pointFor = (value: number, index: number) => {
    const x = left + (monthly.length <= 1 ? 0 : (index / (monthly.length - 1)) * plotWidth);
    return [x, top + plotHeight - ((value / 1_000_000) / axisMax) * plotHeight] as const;
  };
  const points = monthly.map(([label, revenue, expense], index) => {
    const [x, revenueY] = pointFor(revenue, index); const [, expenseY] = pointFor(expense, index);
    return { label, revenue, expense, x, revenueY, expenseY };
  });
  const slotWidth = monthly.length <= 1 ? plotWidth : plotWidth / (monthly.length - 1);
  const labelStep = monthly.length <= 8 ? 1 : Math.ceil((monthly.length - 1) / 6);
  const hovered = hoveredIndex === null ? null : points[hoveredIndex];
  return <div className="space-y-4"><div className="flex items-center justify-center gap-6 text-sm font-semibold text-slate-600 dark:text-slate-300"><span className="inline-flex items-center gap-2"><span className="h-4 w-8 rounded-sm border-4 border-sky-500" />Revenue</span><span className="inline-flex items-center gap-2"><span className="h-4 w-8 rounded-sm border-4 border-red-500" />Expense</span></div><div className="relative h-[21rem] w-full select-none sm:h-[23rem]"><svg className="h-full w-full overflow-visible" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Revenue and expense timeline">{Array.from({ length: 6 }, (_, index) => { const value = axisMax / 5 * index; const y = top + plotHeight - value / axisMax * plotHeight; return <g key={index}><line x1={left} x2={width - right} y1={y} y2={y} stroke="#e2e8f0" /><text x={left - 12} y={y + 4} textAnchor="end" className="fill-slate-500 text-[12px] font-semibold">{amount(Math.round(value * 1_000_000))}</text></g>; })}<line x1={left} x2={left} y1={top} y2={height - bottom} stroke="#cbd5e1" strokeWidth="1.5" /><line x1={left} x2={width - right} y1={height - bottom} y2={height - bottom} stroke="#cbd5e1" strokeWidth="1.5" /><polyline points={points.map((point) => `${point.x},${point.revenueY}`).join(' ')} fill="none" stroke="#0ea5e9" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" /><polyline points={points.map((point) => `${point.x},${point.expenseY}`).join(' ')} fill="none" stroke="#ef4444" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />{hovered && <line x1={hovered.x} x2={hovered.x} y1={top} y2={height - bottom} stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 4" />}{points.map((point, index) => <g key={point.label}><circle cx={point.x} cy={point.revenueY} r={hoveredIndex === index ? 6 : 4} fill="#0ea5e9" stroke="white" strokeWidth={hoveredIndex === index ? 3 : 2} /><circle cx={point.x} cy={point.expenseY} r={hoveredIndex === index ? 6 : 4} fill="#ef4444" stroke="white" strokeWidth={hoveredIndex === index ? 3 : 2} />{(index === 0 || index === points.length - 1 || index % labelStep === 0) && <text x={point.x} y={height - 14} textAnchor="middle" className={`text-[13px] font-semibold ${hoveredIndex === index ? 'fill-slate-900 dark:fill-white font-bold' : 'fill-slate-500'}`}>{point.label}</text>}<rect x={point.x - slotWidth / 2} y={top} width={slotWidth} height={plotHeight} fill="transparent" className="cursor-pointer" onMouseEnter={() => setHoveredIndex(index)} onMouseLeave={() => setHoveredIndex(null)} /></g>)}</svg>{hovered && <div className="pointer-events-none absolute z-20 transition-all duration-75" style={{ left: `${hovered.x / width * 100}%`, top: `${Math.min(hovered.revenueY, hovered.expenseY) / height * 100}%`, transform: `translate(${hovered.x / width > .8 ? '-95%' : hovered.x / width < .2 ? '-5%' : '-50%'}, ${Math.min(hovered.revenueY, hovered.expenseY) / height < .28 ? '12px' : '-115%'})` }}><div className="whitespace-nowrap rounded-lg border border-slate-700/50 bg-slate-800/95 px-3.5 py-2.5 text-[11px] text-white shadow-xl backdrop-blur-sm"><div className="mb-1.5 border-b border-slate-700/60 pb-1 font-bold text-slate-200">{hovered.label}</div><div className="space-y-1"><div className="flex justify-between gap-3"><span className="text-slate-300">● Revenue:</span><b className="text-sky-400">{amount(hovered.revenue)} MMK</b></div><div className="flex justify-between gap-3"><span className="text-slate-300">● Expense:</span><b className="text-red-400">{amount(hovered.expense)} MMK</b></div><div className="flex justify-between gap-3 border-t border-slate-700/40 pt-1 text-[10px]"><span className="text-slate-400">Net:</span><b className={hovered.revenue - hovered.expense >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{hovered.revenue - hovered.expense >= 0 ? '+' : ''}{amount(hovered.revenue - hovered.expense)} MMK</b></div></div></div></div>}</div></div>;
}

export function ExpenseBreakdownChart({ items }: { items: [string, number, number, string][] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const total = items.reduce((sum, [, , amount]) => sum + amount, 0);
  const cx = 120, cy = 120, outer = 108, inner = 68;
  const slices = items.map(([label, percent, value, color], index) => {
    const start = -Math.PI / 2 + (total ? items.slice(0, index).reduce((sum, [, , previousValue]) => sum + previousValue / total, 0) * Math.PI * 2 : 0);
    const end = start + (total ? value / total : 0) * Math.PI * 2;
    const large = end - start > Math.PI ? 1 : 0;
    const x1 = cx + outer * Math.cos(start), y1 = cy + outer * Math.sin(start);
    const x2 = cx + outer * Math.cos(end), y2 = cy + outer * Math.sin(end);
    const x3 = cx + inner * Math.cos(end), y3 = cy + inner * Math.sin(end);
    const x4 = cx + inner * Math.cos(start), y4 = cy + inner * Math.sin(start);
    const path = `M ${x1} ${y1} A ${outer} ${outer} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${inner} ${inner} 0 ${large} 0 ${x4} ${y4} Z`;
    const mid = (start + end) / 2;
    return { label, percent, value, color, index, path, tooltipX: cx + 88 * Math.cos(mid), tooltipY: cy + 88 * Math.sin(mid) };
  });
  const active = hoveredIndex === null ? null : slices[hoveredIndex];
  return <div className="grid min-h-72 grid-cols-1 items-center gap-8 md:grid-cols-[minmax(15rem,0.8fr)_minmax(0,1.2fr)]"><div className="relative flex justify-center select-none md:justify-end"><div className="relative h-60 w-60"><svg viewBox="0 0 240 240" className="h-full w-full overflow-visible" role="img" aria-label="Expense breakdown donut chart">{slices.map((slice) => <path key={slice.label} d={slice.path} fill={slice.color} className="cursor-pointer transition-all duration-200" opacity={hoveredIndex !== null && hoveredIndex !== slice.index ? .55 : 1} stroke={hoveredIndex === slice.index ? 'white' : 'transparent'} strokeWidth={hoveredIndex === slice.index ? 2 : 0} onMouseEnter={() => setHoveredIndex(slice.index)} onMouseLeave={() => setHoveredIndex(null)} />)}</svg><div className="pointer-events-none absolute inset-[3.75rem] flex flex-col items-center justify-center rounded-full bg-card px-2 text-center shadow-inner"><span className="max-w-[100px] truncate text-[10px] font-bold uppercase tracking-wide text-slate-500">{active?.label ?? 'Total expense'}</span><span className="mt-0.5 text-sm font-black tracking-tight text-slate-900 dark:text-slate-100">{amount(active?.value ?? total)}</span><span className="text-[10px] font-semibold text-slate-500">{active ? `${active.percent}% of total` : 'MMK'}</span></div>{active && <div className="pointer-events-none absolute z-20 transition-all duration-75" style={{ left: `${active.tooltipX / 240 * 100}%`, top: `${active.tooltipY / 240 * 100}%`, transform: `translate(${active.tooltipX / 240 > .65 ? '-95%' : active.tooltipX / 240 < .35 ? '-5%' : '-50%'}, ${active.tooltipY / 240 < .35 ? '8px' : '-115%'})` }}><div className="whitespace-nowrap rounded-lg border border-slate-700/50 bg-slate-800/95 px-3 py-2 text-[11px] text-white shadow-xl"><b>{active.label}</b><div className="mt-1 text-slate-300"><b className="text-white">{amount(active.value)} MMK</b> ({active.percent}%)</div></div></div>}</div></div><div className="w-full divide-y divide-slate-100 rounded-lg border border-slate-200 bg-slate-50/50 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-950/30">{slices.map((slice) => <div key={slice.label} className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-3 py-2.5 transition-colors ${hoveredIndex === slice.index ? 'rounded-md bg-slate-200/60 dark:bg-slate-800/60' : 'cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-900/40'}`} onMouseEnter={() => setHoveredIndex(slice.index)} onMouseLeave={() => setHoveredIndex(null)}><span className="flex min-w-0 items-center gap-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200"><span className="h-3 w-3 shrink-0 rounded-full ring-2 ring-white shadow-sm dark:ring-slate-950" style={{ background: slice.color }} />{slice.label}</span><span className="ml-auto whitespace-nowrap text-right text-xs font-bold text-slate-600 dark:text-slate-300">{amount(slice.value)} MMK <span className="font-medium text-slate-500">({slice.percent}%)</span></span></div>)}</div></div>;
}

export function MarketingPerformanceChart({ weekly }: { weekly: readonly (readonly [string, number, number])[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Fill the card exactly like the Business Overview charts: measure the
  // container and stretch the viewBox to it (fixed height, variable width)
  // instead of letterboxing a fixed 680px-wide scene.
  const [viewWidth, setViewWidth] = useState(680);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setViewWidth(w);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const isEmpty = weekly.every(([, spend, orders]) => Number(spend) === 0 && Number(orders) === 0);
  // Like the Business Overview charts: render every raw point but label only
  // a sparse subset (first / last / every Nth) so long ranges stay readable.
  const points: readonly (readonly [string, number, number])[] = weekly;
  const showTick = (index: number) =>
    points.length <= 15 ||
    index === 0 ||
    index === points.length - 1 ||
    index % Math.ceil(points.length / 10) === 0;
  const chartLeft = 58;
  const chartRight = Math.max(chartLeft + 100, viewWidth - 22);
  const chartTop = 42;
  const chartBottom = 226;
  const slot = points.length > 1 ? (chartRight - chartLeft) / (points.length - 1) : 0;
  const barWidth = Math.max(4, Math.min(32, slot - 6));
  // Nice round axis steps like the Business Overview charts — raw max/4 almost
  // always lands on an ugly fraction (e.g. 112,500), so snap the step to a
  // 1 / 1.25 / 2 / 2.5 / 5 / 10 multiple instead.
  const niceStep = (raw: number): number => {
    if (!(raw > 0)) return 25000;
    const exp = Math.floor(Math.log10(raw));
    const frac = raw / 10 ** exp;
    const mult = frac <= 1 ? 1 : frac <= 1.25 ? 1.25 : frac <= 2 ? 2 : frac <= 2.5 ? 2.5 : frac <= 5 ? 5 : 10;
    return mult * 10 ** exp;
  };
  const spendStep = niceStep(Math.max(...points.map(([, spend]) => Number(spend))) / 4);
  const maxSpend = Math.max(100_000, spendStep * 4);
  const orderStep = Math.max(5, Math.ceil(Math.max(...points.map(([, , orders]) => Number(orders))) / 20) * 5);
  const maxOrders = Math.max(20, orderStep * 4);
  const orderPoints = points.map(([, , orders], index) => `${chartLeft + 20 + index * slot},${chartBottom - (Number(orders) / maxOrders) * (chartBottom - chartTop)}`).join(' ');
  // Rendered top-to-bottom, so index 0 must be the max (Business Overview
  // order) — ascending here would flip the axis upside down.
  const spendLabels = isEmpty ? [4, 3, 2, 1, 0] : [0, 1, 2, 3, 4].map((i) => maxSpend - ((maxSpend / 4) * i));
  const orderLabels = isEmpty ? [4, 3, 2, 1, 0] : [0, 1, 2, 3, 4].map((i) => maxOrders - ((maxOrders / 4) * i));
  const hovered = hoveredIndex !== null && points[hoveredIndex] ? points[hoveredIndex] : null;

  return (
    <div ref={containerRef} className="relative h-full w-full select-none" aria-label="Ad spend compared to ad driven orders" role="img">
      <svg className="h-full w-full overflow-visible" viewBox={`0 0 ${viewWidth} 300`} preserveAspectRatio="xMidYMid meet">
        {[42, 88, 134, 180, 226].map((y) => <line key={y} x1={chartLeft} y1={y} x2={chartRight} y2={y} stroke="#e2e8f0" className="dark:stroke-slate-800" strokeDasharray="3 3" />)}
        {points.map((_, index) => {
          const x = chartLeft + 20 + index * slot;
          return <line key={`grid-${index}`} x1={x} x2={x} y1={chartTop} y2={chartBottom} stroke="#f8fafc" className="dark:stroke-slate-900" />;
        })}
        {spendLabels.map((value, index) => <text key={`${value}-${index}`} x="50" y={46 + index * 46} textAnchor="end" className="fill-slate-500 dark:fill-slate-400 font-mono" style={{ fontSize: '11px' }}>{value.toLocaleString()}</text>)}
        {orderLabels.map((value, index) => <text key={`${value}-${index}`} x={chartRight + 10} y={46 + index * 46} textAnchor="start" className="fill-emerald-600 dark:fill-emerald-400 font-bold font-mono" style={{ fontSize: '11px' }}>{value.toLocaleString()}</text>)}
        {!isEmpty && points.map(([week, spend], index) => {
          const px = chartLeft + 20 + index * slot;
          const x = px - barWidth / 2;
          const height = (Number(spend) / maxSpend) * (chartBottom - chartTop);
          const isHovered = hoveredIndex === index;
          return (
            <g key={week}>
              <rect
                x={x}
                y={chartBottom - height}
                width={barWidth}
                height={height}
                rx="4"
                fill="#0ea5e9"
                opacity={isHovered ? 1 : 0.8}
                className="transition-all duration-150"
              />
              <rect
                x={px - Math.max(22, slot / 2)}
                y={chartTop}
                width={Math.max(44, slot)}
                height={chartBottom - chartTop + 30}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            </g>
          );
        })}
        {!isEmpty && <polyline points={orderPoints} fill="none" stroke="#10b981" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />}
        {!isEmpty && orderPoints.split(' ').map((point, index) => {
          const [cx, cy] = point.split(',').map(Number);
          const isHovered = hoveredIndex === index;
          return (
            <circle
              key={point}
              cx={cx}
              cy={cy}
              r={isHovered ? 6 : 4}
              fill="#10b981"
              stroke="white"
              strokeWidth={isHovered ? 3 : 2}
            />
          );
        })}
        {!isEmpty && <line x1={chartLeft} y1={chartBottom} x2={chartRight} y2={chartBottom} stroke="#cbd5e1" strokeWidth="1.5" className="dark:stroke-slate-700" />}
        {points.map(([week], index) => {
          const x = chartLeft + 20 + index * slot;
          const isHovered = hoveredIndex === index;
          return (
            <g key={`tick-${week}-${index}`}>
              {!isEmpty && <line x1={x} x2={x} y1={chartBottom} y2={chartBottom + 6} stroke="#cbd5e1" strokeWidth="1.2" className="dark:stroke-slate-700" />}
              {showTick(index) && (
                <text x={x} y="250" textAnchor="middle" className={`text-xs font-bold ${isHovered ? 'fill-slate-900 dark:fill-white' : 'fill-slate-600 dark:fill-slate-300'}`}>{week}</text>
              )}
            </g>
          );
        })}
      </svg>
      {hovered && (
        <div
          className="pointer-events-none absolute z-20 transition-all duration-75"
          style={{
            left: `${((chartLeft + 20 + hoveredIndex! * slot) / viewWidth) * 100}%`,
            top: '30%',
            // Near the edges a centered tooltip would run off-screen, so pin
            // it inside instead (same trick as the expense donut chart).
            transform: `translate(${points.length > 1 && hoveredIndex! / (points.length - 1) > 0.7 ? '-95%' : points.length > 1 && hoveredIndex! / (points.length - 1) < 0.3 ? '-5%' : '-50%'}, -100%)`,
          }}
        >
          <div className="whitespace-nowrap rounded-lg border border-slate-700/50 bg-slate-900/95 px-3.5 py-2.5 text-xs text-white shadow-xl backdrop-blur-sm">
            <div className="font-bold border-b border-slate-700/60 pb-1 mb-1.5 text-slate-300">Period: {hovered[0]}</div>
            <div className="space-y-1">
              <div className="flex justify-between gap-4 text-sky-400"><span>● Ad Spend:</span> <b>{amount(Number(hovered[1]))} MMK</b></div>
              <div className="flex justify-between gap-4 text-emerald-400"><span>● Ad Orders:</span> <b>{hovered[2]} orders</b></div>
              <div className="flex justify-between gap-4 text-[10px] text-slate-400 border-t border-slate-700/40 pt-1">
                <span>Cost / Order:</span>
                <b>{Number(hovered[2]) > 0 ? `${amount(Math.round(Number(hovered[1]) / Number(hovered[2])))} MMK` : '—'}</b>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
