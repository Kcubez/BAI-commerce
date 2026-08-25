import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/soft-delete";
import { customerOwnedByUserOrAdmin, ownedByUserOrAdmin } from "@/lib/tenant-scope";
import { buildTrendBuckets, elapsedRatio, resolvePeriodRange, targetAnchor, parsePeriodParams } from "@/lib/period-range";
import type { Prisma } from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";

const DEFAULT_TARGETS = {
  targetSalesAmount: 30_000_000,
  targetExpenseAmount: 11_000_000,
  targetDemandCount: 220,
  targetAppointments: 220,
  targetNewCustomers: 120,
};

function dealRevenue(deal: { quotedAmount: number | null; items: { quantity: number; unitPrice: number }[] }) {
  const itemTotal = deal.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  return itemTotal || deal.quotedAmount || 0;
}

function formatAmount(value: number) {
  return Math.round(value).toLocaleString();
}

function progress(current: number, target: number | null | undefined) {
  if (!target || target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((current / target) * 100)));
}

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const resolved = parsePeriodParams(req.nextUrl.searchParams);
  const periodLabel = resolved.period === "overall"
    ? "Overall"
    : resolved.period;
  const { start, end } = resolvePeriodRange(resolved);
  const buckets = buildTrendBuckets(resolved);
  const anchor = targetAnchor(resolved);
  const userWhere = ownedByUserOrAdmin(session);
  const dateRange = { gte: start, lt: end };
  const wonDealWhere: Prisma.DealWhereInput = {
    ...userWhere,
    ...notDeleted,
    stage: "WON",
    OR: [
      { wonAt: dateRange },
      { wonAt: null, createdAt: dateRange },
    ],
  };

  const [
    monthTarget,
    yearTarget,
    wonDeals,
    periodDeals,
    fulfilledOrders,
    newCustomers,
    expenses,
    lowStockCount,
    recentMessages,
  ] = await Promise.all([
    prisma.periodTarget.findFirst({
      where: { userId: session.user.id, period: "month", year: anchor.year, month: anchor.month },
    }),
    prisma.periodTarget.findFirst({
      where: { userId: session.user.id, period: "year", year: anchor.year, month: 0 },
    }),
    prisma.deal.findMany({
      where: wonDealWhere,
      include: { items: true },
      orderBy: { wonAt: "asc" },
    }),
    prisma.deal.findMany({
      where: { ...userWhere, ...notDeleted, createdAt: dateRange },
      include: { items: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.deal.count({
      where: { ...userWhere, ...notDeleted, fulfillmentStatus: "FULFILLED", updatedAt: dateRange },
    }),
    prisma.customer.count({
      where: { ...customerOwnedByUserOrAdmin(session), ...notDeleted, createdAt: dateRange },
    }),
    prisma.expense.findMany({
      where: { ...userWhere, ...notDeleted, expenseDate: dateRange },
      orderBy: { expenseDate: "asc" },
    }),
    prisma.product.count({
      where: { ...userWhere, ...notDeleted, stockQty: { gt: 0 } },
    }),
    prisma.telegramMessage.findMany({
      where: { createdAt: dateRange, sender: userWhere.userId ? { userId: String(userWhere.userId) } : undefined },
      orderBy: { createdAt: "desc" },
      take: 1,
      select: { id: true },
    }),
  ]);

  const targets = monthTarget ?? yearTarget ?? undefined;
  const activeTargets = {
    targetSalesAmount: targets?.targetSalesAmount ?? DEFAULT_TARGETS.targetSalesAmount,
    targetExpenseAmount: targets?.targetExpenseAmount ?? DEFAULT_TARGETS.targetExpenseAmount,
    targetDemandCount: targets?.targetDemandCount ?? DEFAULT_TARGETS.targetDemandCount,
    targetAppointments: targets?.targetAppointments ?? DEFAULT_TARGETS.targetAppointments,
    targetNewCustomers: targets?.targetNewCustomers ?? DEFAULT_TARGETS.targetNewCustomers,
  };
  const revenue = wonDeals.reduce((sum, deal) => sum + dealRevenue(deal), 0);
  const expense = expenses.reduce((sum, item) => sum + item.amount, 0);
  const profitMargin = revenue > 0 ? ((revenue - expense) / revenue) * 100 : 0;
  const targetProfitMargin = activeTargets.targetSalesAmount > 0
    ? ((activeTargets.targetSalesAmount - activeTargets.targetExpenseAmount) / activeTargets.targetSalesAmount) * 100
    : 0;

  const incomeTrend = buckets.labels.map((label) => ({ label, value: 0 }));
  const orderTrend = buckets.labels.map((label) => ({ label, value: 0 }));

  wonDeals.forEach((deal) => {
    const date = deal.wonAt ?? deal.createdAt;
    const index = buckets.bucketIndex(date);
    if (index >= 0 && incomeTrend[index]) incomeTrend[index].value += dealRevenue(deal);
  });
  periodDeals.forEach((deal) => {
    const index = buckets.bucketIndex(deal.createdAt);
    if (index >= 0 && orderTrend[index]) orderTrend[index].value += 1;
  });

  const productMap = new Map<string, { name: string; sku: string | null; quantity: number; income: number }>();
  wonDeals.forEach((deal) => {
    deal.items.forEach((item) => {
      const key = item.sku || item.productName;
      const current = productMap.get(key) ?? { name: item.productName, sku: item.sku, quantity: 0, income: 0 };
      current.quantity += item.quantity;
      current.income += item.quantity * item.unitPrice;
      productMap.set(key, current);
    });
  });
  const topProducts = Array.from(productMap.values()).sort((a, b) => b.income - a.income).slice(0, 5);
  const topProduct = topProducts[0];
  const ordersReceived = periodDeals.length;
  const ratio = elapsedRatio(start, end);
  const expectedToDate = (target: number) => Math.round(target * ratio);

  return NextResponse.json({
    period: periodLabel,
    year: resolved.year,
    month: resolved.month,
    targets: activeTargets,
    kpis: [
      {
        title: "Revenue",
        value: formatAmount(revenue),
        target: `${formatAmount(activeTargets.targetSalesAmount)} MMK`,
        expected: `Expected to date: ${formatAmount(expectedToDate(activeTargets.targetSalesAmount))}`,
        status: revenue >= activeTargets.targetSalesAmount ? "On Track" : "Below Target",
        tone: revenue >= activeTargets.targetSalesAmount ? "emerald" : "red",
        icon: "DollarSign",
        progressPercent: progress(revenue, activeTargets.targetSalesAmount),
      },
      {
        title: "Expense Limit",
        value: formatAmount(expense),
        target: `${formatAmount(activeTargets.targetExpenseAmount)} MMK`,
        expected: `Budget to date: ${formatAmount(expectedToDate(activeTargets.targetExpenseAmount))}`,
        status: expense <= activeTargets.targetExpenseAmount ? "On Track" : "Over Limit",
        tone: expense <= activeTargets.targetExpenseAmount ? "emerald" : "red",
        icon: "Wallet",
        progressPercent: progress(expense, activeTargets.targetExpenseAmount),
      },
      {
        title: "Profit Margin",
        value: `${profitMargin.toFixed(1)}%`,
        target: `${Math.max(0, targetProfitMargin).toFixed(0)}% Margin`,
        expected: `Target Margin: ${Math.max(0, targetProfitMargin).toFixed(0)}%`,
        status: profitMargin >= targetProfitMargin ? "On Track" : "Below Target",
        tone: profitMargin >= targetProfitMargin ? "emerald" : "red",
        icon: "TrendingUp",
        progressPercent: progress(profitMargin, Math.max(1, targetProfitMargin)),
      },
      {
        title: "Orders Received",
        value: formatAmount(ordersReceived),
        target: formatAmount(activeTargets.targetDemandCount),
        expected: `Expected to date: ${formatAmount(expectedToDate(activeTargets.targetDemandCount))}`,
        status: ordersReceived >= activeTargets.targetDemandCount ? "On Track" : "Below Target",
        tone: ordersReceived >= activeTargets.targetDemandCount ? "emerald" : "red",
        icon: "Megaphone",
        progressPercent: progress(ordersReceived, activeTargets.targetDemandCount),
      },
      {
        title: "Orders Fulfilled",
        value: formatAmount(fulfilledOrders),
        target: formatAmount(activeTargets.targetAppointments),
        expected: `Expected to date: ${formatAmount(expectedToDate(activeTargets.targetAppointments))}`,
        status: fulfilledOrders >= activeTargets.targetAppointments ? "On Track" : "Below Target",
        tone: fulfilledOrders >= activeTargets.targetAppointments ? "emerald" : "red",
        icon: "CalendarCheck",
        progressPercent: progress(fulfilledOrders, activeTargets.targetAppointments),
      },
      {
        title: "New Customers",
        value: formatAmount(newCustomers),
        target: `${formatAmount(activeTargets.targetNewCustomers)} Target`,
        expected: `Expected to date: ${formatAmount(expectedToDate(activeTargets.targetNewCustomers))}`,
        status: newCustomers >= activeTargets.targetNewCustomers ? "On Track" : "Below Target",
        tone: newCustomers >= activeTargets.targetNewCustomers ? "emerald" : "red",
        icon: "Users",
        progressPercent: progress(newCustomers, activeTargets.targetNewCustomers),
      },
    ],
    insights: [
      {
        tone: fulfilledOrders < ordersReceived ? "red" : "emerald",
        title: fulfilledOrders < ordersReceived ? "Orders need dispatch attention" : "Dispatch pace is healthy",
        text: fulfilledOrders < ordersReceived
          ? "Fulfilled orders are trailing received orders. Review pending deliveries and assign the next dispatch action."
          : "Fulfilled orders are keeping pace with received orders for the selected period.",
        action: "Review queue",
      },
      {
        tone: "emerald",
        title: topProduct ? "Product opportunity detected" : "Product data is ready",
        text: topProduct
          ? `${topProduct.name} is the top product this period. Keep sufficient stock available for the next sales cycle.`
          : "Once sales messages include products, the strongest product signal will appear here.",
        action: "View details",
      },
    ],
    analytics: {
      topProducts,
      liveIntelligence: [
        {
          area: "Finance",
          text: topProduct
            ? `Highest grossing product ${topProduct.name} generated ${formatAmount(topProduct.income)} MMK this period.`
            : `Revenue recorded for this period is ${formatAmount(revenue)} MMK.`,
        },
        { area: "Sales", text: `${Math.max(ordersReceived - fulfilledOrders, 0)} orders are waiting for fulfillment follow-up.` },
        { area: "Inventory", text: `${lowStockCount} products have stock recorded and should be reviewed against minimum thresholds.` },
        { area: "System", text: recentMessages.length ? "Telegram Bot processed commerce data in the selected period." : "No Telegram commerce messages found for the selected period yet." },
      ],
      incomeTrend,
      orderTrend,
    },
  });
}
