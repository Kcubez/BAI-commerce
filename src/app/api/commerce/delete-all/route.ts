import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notDeleted, softDeleteData } from "@/lib/soft-delete";
import { ownedByUserOrAdmin } from "@/lib/tenant-scope";
import { NextRequest, NextResponse } from "next/server";

const workspaces = ["finance", "sales", "marketing", "customers", "inventory"] as const;
type Workspace = (typeof workspaces)[number];

function isWorkspace(value: string | null): value is Workspace {
  return Boolean(value && workspaces.includes(value as Workspace));
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function rangeFrom(searchParams: URLSearchParams): { gte: Date; lt: Date } | null {
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to || !ISO_DATE.test(from) || !ISO_DATE.test(to) || from > to) return null;
  return {
    gte: new Date(`${from}T00:00:00.000Z`),
    lt: new Date(new Date(`${to}T00:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000),
  };
}

export async function DELETE(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const workspace = req.nextUrl.searchParams.get("workspace");
  if (!isWorkspace(workspace)) {
    return NextResponse.json({ message: "A valid Commerce workspace is required" }, { status: 400 });
  }

  // Optional period scoping so Delete All matches the visible filter range.
  const dateRange = rangeFrom(req.nextUrl.searchParams);

  const where = {
    ...ownedByUserOrAdmin(session),
    ...notDeleted,
    ...(dateRange
      ? workspace === "finance"
        ? { expenseDate: dateRange }
        : workspace === "marketing"
          ? { metricDate: dateRange }
          : { createdAt: dateRange }
      : {}),
  };
  const data = softDeleteData(session.user.id, `Deleted all ${workspace} records${dateRange ? ` (${req.nextUrl.searchParams.get("from")} to ${req.nextUrl.searchParams.get("to")})` : ""}`);
  const result = workspace === "finance"
    ? await prisma.expense.updateMany({ where, data })
    : workspace === "sales"
      ? await prisma.deal.updateMany({ where, data })
      : workspace === "marketing"
        ? await prisma.marketingMetric.updateMany({ where, data })
        : workspace === "customers"
          ? await prisma.customer.updateMany({ where, data })
          : await prisma.product.updateMany({ where, data });

  return NextResponse.json({ success: true, count: result.count });
}
