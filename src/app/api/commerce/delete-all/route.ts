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

export async function DELETE(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const workspace = req.nextUrl.searchParams.get("workspace");
  if (!isWorkspace(workspace)) {
    return NextResponse.json({ message: "A valid Commerce workspace is required" }, { status: 400 });
  }

  const where = { ...ownedByUserOrAdmin(session), ...notDeleted };
  const data = softDeleteData(session.user.id, `Deleted all ${workspace} records`);
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
