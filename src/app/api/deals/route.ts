import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notDeleted, softDeleteData } from "@/lib/soft-delete";
import { ownedByUserOrAdmin } from "@/lib/tenant-scope";
import { dealSchema } from "@/lib/validations";
import type { Prisma } from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";

const dealInclude = {
  customer: { select: { id: true, name: true, phone: true, email: true } },
  items: { include: { product: { select: { id: true, name: true, sku: true } } } },
  followUpNotes: { orderBy: { createdAt: "desc" as const } },
};

async function verifyCustomerAccess(customerId: string | null | undefined, session: NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>) {
  if (!customerId) return true;
  return Boolean(await prisma.customer.findFirst({ where: { id: customerId, ...ownedByUserOrAdmin(session), ...notDeleted } }));
}

async function buildItems(
  items: Array<{ productId?: string | null; productName: string; sku?: string | null; quantity: number; unitPrice: number; unitCost?: number | null }>,
  session: NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>,
): Promise<Prisma.DealItemCreateWithoutDealInput[]> {
  return Promise.all(items.map(async (item) => {
    if (!item.productId) {
      return {
        productName: item.productName,
        sku: item.sku,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        unitCost: item.unitCost,
      };
    }
    const product = await prisma.product.findFirst({ where: { id: item.productId, ...ownedByUserOrAdmin(session), ...notDeleted } });
    if (!product) throw new Error("Selected product was not found");
    return {
      productName: product.name,
      sku: product.sku,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      unitCost: item.unitCost ?? product.unitCost,
      product: { connect: { id: product.id } },
    };
  }));
}

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const stage = req.nextUrl.searchParams.get("stage");
  const customerId = req.nextUrl.searchParams.get("customerId");
  const dateFrom = req.nextUrl.searchParams.get("dateFrom");
  const dateTo = req.nextUrl.searchParams.get("dateTo");

  const where: Prisma.DealWhereInput = { ...ownedByUserOrAdmin(session), ...notDeleted };
  if (stage) where.stage = stage as Prisma.EnumDealStageFilter["equals"];
  if (customerId) where.customerId = customerId;
  if (dateFrom || dateTo) {
    where.createdAt = {
      ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00.000Z`) } : {}),
      ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59.999Z`) } : {}),
    };
  }

  const deals = await prisma.deal.findMany({ where, include: dealInclude, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ deals });
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const parsed = dealSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Invalid deal" }, { status: 400 });
  if (!(await verifyCustomerAccess(parsed.data.customerId, session))) {
    return NextResponse.json({ message: "Customer not found" }, { status: 404 });
  }

  try {
    const items = await buildItems(parsed.data.items, session);
    const { customerId, items: _items, ...dealData } = parsed.data;
    void _items;
    const deal = await prisma.deal.create({
      data: {
        ...dealData,
        user: { connect: { id: session.user.id } },
        ...(customerId ? { customer: { connect: { id: customerId } } } : {}),
        items: { create: items },
      },
      include: dealInclude,
    });
    return NextResponse.json({ deal }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Selected product was not found") {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }
    throw error;
  }
}

export async function PATCH(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (typeof body.id !== "string") return NextResponse.json({ message: "Deal ID is required" }, { status: 400 });
  const parsed = dealSchema.partial().safeParse(body);
  if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Invalid deal" }, { status: 400 });

  const existing = await prisma.deal.findFirst({ where: { id: body.id, ...ownedByUserOrAdmin(session), ...notDeleted } });
  if (!existing) return NextResponse.json({ message: "Deal not found" }, { status: 404 });
  if (parsed.data.customerId !== undefined && !(await verifyCustomerAccess(parsed.data.customerId, session))) {
    return NextResponse.json({ message: "Customer not found" }, { status: 404 });
  }

  try {
    const items = parsed.data.items ? await buildItems(parsed.data.items, session) : undefined;
    const { customerId, items: _items, ...dealData } = parsed.data;
    void _items;
    const deal = await prisma.deal.update({
      where: { id: existing.id },
      data: {
        ...dealData,
        ...(customerId === undefined
          ? {}
          : customerId
            ? { customer: { connect: { id: customerId } } }
            : { customer: { disconnect: true } }),
        ...(items ? { items: { deleteMany: {}, create: items } } : {}),
      },
      include: dealInclude,
    });
    return NextResponse.json({ deal });
  } catch (error) {
    if (error instanceof Error && error.message === "Selected product was not found") {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }
    throw error;
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ message: "Deal ID is required" }, { status: 400 });

  const result = await prisma.deal.updateMany({
    where: { id, ...ownedByUserOrAdmin(session), ...notDeleted },
    data: softDeleteData(session.user.id, req.nextUrl.searchParams.get("reason")),
  });
  if (!result.count) return NextResponse.json({ message: "Deal not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
