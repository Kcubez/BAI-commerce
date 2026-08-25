import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { onlyDeleted, restoreData } from "@/lib/soft-delete";
import { isAdminSession } from "@/lib/tenant-scope";
import { NextRequest, NextResponse } from "next/server";

const trashTypes = [
  "customers",
  "sales",
  "finance",
  "products",
  "deals",
  "expenses",
  "marketing",
] as const;

type TrashType = (typeof trashTypes)[number];

type TrashRecord = {
  id: string;
  name?: string | null;
  customerName?: string | null;
  reporterName?: string | null;
  projectName?: string | null;
  phone?: string | null;
  company?: string | null;
  serviceName?: string | null;
  status?: string | null;
  marketingChannel?: string | null;
  totalSalesAmount?: number | null;
  url?: string | null;
  packageName?: string | null;
  sku?: string | null;
  category?: string | null;
  subcategory?: string | null;
  amount?: number | null;
  expenseDate?: Date | null;
  metricDate?: Date | null;
  createdAt?: Date | null;
  reportDate?: Date | null;
  deletedAt?: Date | null;
  deletedByUserId?: string | null;
  deletedReason?: string | null;
  restoreRequested?: boolean;
  restoreRequestCount?: number;
};

type SerializedTrashRecord = ReturnType<typeof serialize>;

function isTrashType(value: string | null): value is TrashType {
  return !!value && trashTypes.includes(value as TrashType);
}

function parseBulkTrashType(value: unknown): TrashType | "all" | null {
  if (value === "all") return value;
  return typeof value === "string" && isTrashType(value) ? value : null;
}

function dateRangeWhere(dateFrom: string | null, dateTo: string | null) {
  const deletedAt: { gte?: Date; lte?: Date } = {};
  if (dateFrom) deletedAt.gte = new Date(`${dateFrom}T00:00:00.000Z`);
  if (dateTo) deletedAt.lte = new Date(`${dateTo}T23:59:59.999Z`);
  return Object.keys(deletedAt).length ? { deletedAt } : {};
}

function scopedWhere(
  type: TrashType,
  session: NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>,
) {
  if (isAdminSession(session)) return {};

  switch (type) {
    case "customers":
      return { userId: session.user.id };
    case "sales":
      return { sender: { userId: session.user.id } };
    case "finance":
      return { uploadedByUserId: session.user.id };
    case "products":
    case "deals":
    case "expenses":
    case "marketing":
      return { userId: session.user.id };
  }
}

function trashWhere(
  type: TrashType,
  session: NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>,
  dateFrom: string | null,
  dateTo: string | null,
) {
  return {
    ...scopedWhere(type, session),
    ...onlyDeleted,
    ...dateRangeWhere(dateFrom, dateTo),
  };
}

function displayDate(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : null;
}

function serialize(type: TrashType, record: TrashRecord) {
  const restoreRequestMeta = {
    restoreRequested: Boolean(record.restoreRequested),
    restoreRequestCount: record.restoreRequestCount ?? 0,
  };

  switch (type) {
    case "customers":
      return {
        ...restoreRequestMeta,
        type,
        id: record.id,
        title: record.name,
        subtitle: [record.phone, record.company].filter(Boolean).join(" · ") || "Customer",
        recordDate: displayDate(record.createdAt),
        deletedAt: record.deletedAt?.toISOString() ?? null,
        deletedByUserId: record.deletedByUserId,
        deletedReason: record.deletedReason,
      };
    case "sales":
      return {
        ...restoreRequestMeta,
        type,
        id: record.id,
        title: record.customerName || "Unnamed sales record",
        subtitle: [record.serviceName, record.status].filter(Boolean).join(" · ") || "Sales & Marketing",
        recordDate: displayDate(record.createdAt),
        deletedAt: record.deletedAt?.toISOString() ?? null,
        deletedByUserId: record.deletedByUserId,
        deletedReason: record.deletedReason,
      };
    case "finance":
      return {
        ...restoreRequestMeta,
        type,
        id: record.id,
        title: record.reporterName || record.marketingChannel || "Finance report",
        subtitle: [record.marketingChannel, record.totalSalesAmount ? `${record.totalSalesAmount.toLocaleString()} MMK` : null]
          .filter(Boolean)
          .join(" · ") || "Business KPI Report",
        recordDate: displayDate(record.reportDate),
        deletedAt: record.deletedAt?.toISOString() ?? null,
        deletedByUserId: record.deletedByUserId,
        deletedReason: record.deletedReason,
      };
    case "products":
      return {
        ...restoreRequestMeta,
        type,
        id: record.id,
        title: record.name || "Unnamed product",
        subtitle: [record.sku, record.category].filter(Boolean).join(" · ") || "Product & Inventory",
        recordDate: displayDate(record.createdAt),
        deletedAt: record.deletedAt?.toISOString() ?? null,
        deletedByUserId: record.deletedByUserId,
        deletedReason: record.deletedReason,
      };
    case "deals":
      return {
        ...restoreRequestMeta,
        type,
        id: record.id,
        title: record.customerName || "Unnamed deal",
        subtitle: record.status || "Sales deal",
        recordDate: displayDate(record.createdAt),
        deletedAt: record.deletedAt?.toISOString() ?? null,
        deletedByUserId: record.deletedByUserId,
        deletedReason: record.deletedReason,
      };
    case "expenses":
      return {
        ...restoreRequestMeta,
        type,
        id: record.id,
        title: record.category || "Expense",
        subtitle: [record.subcategory, record.amount ? `${record.amount.toLocaleString()} MMK` : null].filter(Boolean).join(" · ") || "Finance expense",
        recordDate: displayDate(record.expenseDate),
        deletedAt: record.deletedAt?.toISOString() ?? null,
        deletedByUserId: record.deletedByUserId,
        deletedReason: record.deletedReason,
      };
    case "marketing":
      return {
        ...restoreRequestMeta,
        type,
        id: record.id,
        title: record.marketingChannel || "Marketing metric",
        subtitle: record.amount ? `${record.amount.toLocaleString()} MMK spend` : "Marketing & Ads",
        recordDate: displayDate(record.metricDate),
        deletedAt: record.deletedAt?.toISOString() ?? null,
        deletedByUserId: record.deletedByUserId,
        deletedReason: record.deletedReason,
      };
  }
}

async function attachRestoreRequestMeta(
  records: SerializedTrashRecord[],
  session: NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>,
) {
  if (records.length === 0) return records;

  const OR = records.map((record) => ({ recordType: record.type, recordId: record.id }));
  const requests = await prisma.restoreRequest.groupBy({
    by: ["recordType", "recordId"],
    where: {
      status: "pending",
      OR,
      ...(isAdminSession(session) ? {} : { requestedByUserId: session.user.id }),
    },
    _count: { _all: true },
  });
  const countByRecord = new Map(
    requests.map((request) => [`${request.recordType}:${request.recordId}`, request._count._all]),
  );

  return records.map((record) => ({
    ...record,
    restoreRequested: countByRecord.has(`${record.type}:${record.id}`),
    restoreRequestCount: countByRecord.get(`${record.type}:${record.id}`) ?? 0,
  }));
}

async function listByType(
  type: TrashType,
  session: NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>,
  dateFrom: string | null,
  dateTo: string | null,
  skip: number,
  take: number,
) {
  const where = trashWhere(type, session, dateFrom, dateTo);

  switch (type) {
    case "customers": {
      const [records, total] = await Promise.all([
        prisma.customer.findMany({ where, orderBy: { deletedAt: "desc" }, skip, take }),
        prisma.customer.count({ where }),
      ]);
      return { records: records.map((record) => serialize(type, record)), total };
    }
    case "sales": {
      const [records, total] = await Promise.all([
        prisma.demandRecord.findMany({ where, orderBy: { deletedAt: "desc" }, skip, take }),
        prisma.demandRecord.count({ where }),
      ]);
      return { records: records.map((record) => serialize(type, record)), total };
    }
    case "finance": {
      const [records, total] = await Promise.all([
        prisma.businessReport.findMany({ where, orderBy: { deletedAt: "desc" }, skip, take }),
        prisma.businessReport.count({ where }),
      ]);
      return { records: records.map((record) => serialize(type, record)), total };
    }
    case "products": {
      const [records, total] = await Promise.all([
        prisma.product.findMany({ where, orderBy: { deletedAt: "desc" }, skip, take }),
        prisma.product.count({ where }),
      ]);
      return { records: records.map((record) => serialize(type, record)), total };
    }
    case "deals": {
      const [records, total] = await Promise.all([
        prisma.deal.findMany({ where, include: { customer: { select: { name: true } } }, orderBy: { deletedAt: "desc" }, skip, take }),
        prisma.deal.count({ where }),
      ]);
      return { records: records.map((record) => serialize(type, { ...record, customerName: record.customer?.name ?? null, status: record.stage })), total };
    }
    case "expenses": {
      const [records, total] = await Promise.all([
        prisma.expense.findMany({ where, orderBy: { deletedAt: "desc" }, skip, take }),
        prisma.expense.count({ where }),
      ]);
      return { records: records.map((record) => serialize(type, record)), total };
    }
    case "marketing": {
      const [records, total] = await Promise.all([
        prisma.marketingMetric.findMany({ where, orderBy: { deletedAt: "desc" }, skip, take }),
        prisma.marketingMetric.count({ where }),
      ]);
      return { records: records.map((record) => serialize(type, { ...record, marketingChannel: record.channel, amount: record.spend })), total };
    }
  }
}

async function restoreRecord(
  type: TrashType,
  id: string,
  userId: string,
) {
  const where = { id, ...onlyDeleted };
  const data = restoreData(userId);

  switch (type) {
    case "customers": {
      const result = await prisma.customer.updateMany({ where, data });
      await prisma.demandRecord.updateMany({
        where: { customerId: id, deletedReason: "Deleted along with customer", ...onlyDeleted },
        data: restoreData(userId),
      });
      return result;
    }
    case "sales":
      return prisma.demandRecord.updateMany({ where, data });
    case "finance":
      return prisma.businessReport.updateMany({ where, data });
    case "products":
      return prisma.product.updateMany({ where, data });
    case "deals":
      return prisma.deal.updateMany({ where, data });
    case "expenses":
      return prisma.expense.updateMany({ where, data });
    case "marketing":
      return prisma.marketingMetric.updateMany({ where, data });
  }
}

async function permanentlyDeleteRecord(type: TrashType, id: string) {
  const where = { id, ...onlyDeleted };

  switch (type) {
    case "customers": {
      await prisma.demandRecord.deleteMany({
        where: { customerId: id, deletedReason: "Deleted along with customer", ...onlyDeleted },
      });
      return prisma.customer.deleteMany({ where });
    }
    case "sales":
      return prisma.demandRecord.deleteMany({ where });
    case "finance":
      return prisma.businessReport.deleteMany({ where });
    case "products":
      return prisma.product.deleteMany({ where });
    case "deals":
      return prisma.deal.deleteMany({ where });
    case "expenses":
      return prisma.expense.deleteMany({ where });
    case "marketing":
      return prisma.marketingMetric.deleteMany({ where });
  }
}

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const requestedType = searchParams.get("type");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 25)));
  const skip = (page - 1) * limit;

  if (requestedType && !isTrashType(requestedType)) {
    return NextResponse.json({ message: "Invalid trash type" }, { status: 400 });
  }

  const selectedType: TrashType | null = isTrashType(requestedType) ? requestedType : null;
  const types: readonly TrashType[] = selectedType ? [selectedType] : trashTypes;
  const results = await Promise.all(
    types.map((type) => listByType(type, session, dateFrom, dateTo, selectedType ? skip : 0, limit)),
  );

  const allRecords = results
    .flatMap((result) => result.records)
    .sort((a, b) => (b.deletedAt || "").localeCompare(a.deletedAt || ""));

  const pagedRecords = selectedType ? allRecords : allRecords.slice(skip, skip + limit);
  const records = await attachRestoreRequestMeta(pagedRecords, session);
  const total = results.reduce((sum, result) => sum + result.total, 0);

  return NextResponse.json({
    records,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    canRestore: isAdminSession(session),
    canPermanentDelete: isAdminSession(session),
  });
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { type, id, action, dateFrom, dateTo } = body;

  if (action === "restore_all") {
    if (!isAdminSession(session)) {
      return NextResponse.json({ message: "Admin access required to restore records" }, { status: 403 });
    }

    const bulkType = parseBulkTrashType(type);
    if (!bulkType) {
      return NextResponse.json({ message: "Invalid trash type" }, { status: 400 });
    }

    const types: readonly TrashType[] = bulkType === "all" ? trashTypes : [bulkType];
    const data = restoreData(session.user.id);
    const dateQuery = dateRangeWhere(dateFrom, dateTo);

    await prisma.$transaction(async (tx) => {
      for (const t of types) {
        const where = { ...scopedWhere(t, session), ...onlyDeleted, ...dateQuery };
        let ids: string[];

        switch (t) {
          case "customers": {
            const customers = await tx.customer.findMany({ where, select: { id: true } });
            ids = customers.map((customer) => customer.id);
            await tx.customer.updateMany({ where: { id: { in: ids }, ...onlyDeleted }, data });
            await tx.demandRecord.updateMany({
              where: {
                customerId: { in: ids },
                deletedReason: "Deleted along with customer",
                ...onlyDeleted,
              },
              data,
            });
            break;
          }
          case "sales":
            ids = (await tx.demandRecord.findMany({ where, select: { id: true } })).map((record) => record.id);
            await tx.demandRecord.updateMany({ where: { id: { in: ids }, ...onlyDeleted }, data });
            break;
          case "finance":
            ids = (await tx.businessReport.findMany({ where, select: { id: true } })).map((record) => record.id);
            await tx.businessReport.updateMany({ where: { id: { in: ids }, ...onlyDeleted }, data });
            break;
          case "products":
            ids = (await tx.product.findMany({ where, select: { id: true } })).map((record) => record.id);
            await tx.product.updateMany({ where: { id: { in: ids }, ...onlyDeleted }, data });
            break;
          case "deals":
            ids = (await tx.deal.findMany({ where, select: { id: true } })).map((record) => record.id);
            await tx.deal.updateMany({ where: { id: { in: ids }, ...onlyDeleted }, data });
            break;
          case "expenses":
            ids = (await tx.expense.findMany({ where, select: { id: true } })).map((record) => record.id);
            await tx.expense.updateMany({ where: { id: { in: ids }, ...onlyDeleted }, data });
            break;
          case "marketing":
            ids = (await tx.marketingMetric.findMany({ where, select: { id: true } })).map((record) => record.id);
            await tx.marketingMetric.updateMany({ where: { id: { in: ids }, ...onlyDeleted }, data });
            break;
        }
        if (ids.length > 0) {
          await tx.restoreRequest.updateMany({
            where: { recordType: t, recordId: { in: ids }, status: "pending" },
            data: {
              status: "approved",
              resolvedAt: new Date(),
              resolvedByUserId: session.user.id,
            },
          });
        }
      }
    });

    return NextResponse.json({ success: true, message: "All matching records restored" });
  }

  if (action === "request_restore_all") {
    const bulkType = parseBulkTrashType(type);
    if (!bulkType) {
      return NextResponse.json({ message: "Invalid trash type" }, { status: 400 });
    }

    const types: readonly TrashType[] = bulkType === "all" ? trashTypes : [bulkType];
    const dateQuery = dateRangeWhere(dateFrom, dateTo);

    for (const t of types) {
      const where = { ...scopedWhere(t, session), ...onlyDeleted, ...dateQuery };
      let records: { id: string }[] = [];
      switch (t) {
        case "customers":
          records = await prisma.customer.findMany({ where, select: { id: true } });
          break;
        case "sales":
          records = await prisma.demandRecord.findMany({ where, select: { id: true } });
          break;
        case "finance":
          records = await prisma.businessReport.findMany({ where, select: { id: true } });
          break;
        case "products":
          records = await prisma.product.findMany({ where, select: { id: true } });
          break;
        case "deals":
          records = await prisma.deal.findMany({ where, select: { id: true } });
          break;
        case "expenses":
          records = await prisma.expense.findMany({ where, select: { id: true } });
          break;
        case "marketing":
          records = await prisma.marketingMetric.findMany({ where, select: { id: true } });
          break;
      }

      if (records.length > 0) {
        await Promise.all(
          records.map((r) =>
            prisma.restoreRequest.upsert({
              where: {
                recordType_recordId_requestedByUserId_status: {
                  recordType: t,
                  recordId: r.id,
                  requestedByUserId: session.user.id,
                  status: "pending",
                },
              },
              update: { updatedAt: new Date() },
              create: {
                recordType: t,
                recordId: r.id,
                requestedByUserId: session.user.id,
              },
            })
          )
        );
      }
    }

    return NextResponse.json({ success: true, message: "Restore request sent for all matching records" });
  }

  if (!isTrashType(type) || typeof id !== "string") {
    return NextResponse.json({ message: "Invalid trash record" }, { status: 400 });
  }

  if (action === "request_restore") {
    const where = { id, ...trashWhere(type, session, null, null) };
    let exists = false;

    switch (type) {
      case "customers":
        exists = Boolean(await prisma.customer.findFirst({ where, select: { id: true } }));
        break;
      case "sales":
        exists = Boolean(await prisma.demandRecord.findFirst({ where, select: { id: true } }));
        break;
      case "finance":
        exists = Boolean(await prisma.businessReport.findFirst({ where, select: { id: true } }));
        break;
      case "products":
        exists = Boolean(await prisma.product.findFirst({ where, select: { id: true } }));
        break;
      case "deals":
        exists = Boolean(await prisma.deal.findFirst({ where, select: { id: true } }));
        break;
      case "expenses":
        exists = Boolean(await prisma.expense.findFirst({ where, select: { id: true } }));
        break;
      case "marketing":
        exists = Boolean(await prisma.marketingMetric.findFirst({ where, select: { id: true } }));
        break;
    }

    if (!exists) {
      return NextResponse.json({ message: "Trash record not found or access denied" }, { status: 404 });
    }

    await prisma.restoreRequest.upsert({
      where: {
        recordType_recordId_requestedByUserId_status: {
          recordType: type,
          recordId: id,
          requestedByUserId: session.user.id,
          status: "pending",
        },
      },
      update: { updatedAt: new Date() },
      create: {
        recordType: type,
        recordId: id,
        requestedByUserId: session.user.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Restore request received. An admin must restore the record.",
    });
  }

  if (!isAdminSession(session)) {
    return NextResponse.json({ message: "Admin access required to restore records" }, { status: 403 });
  }

  const result = await restoreRecord(type, id, session.user.id);
  await prisma.restoreRequest.updateMany({
    where: { recordType: type, recordId: id, status: "pending" },
    data: {
      status: "approved",
      resolvedAt: new Date(),
      resolvedByUserId: session.user.id,
    },
  });
  return NextResponse.json({ success: true, restored: result.count });
}

export async function DELETE(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isAdminSession(session)) {
    return NextResponse.json({ message: "Admin access required" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { type, id, confirmation, action, dateFrom, dateTo } = body;

  if (action === "delete_all") {
    if (confirmation !== "PERMANENT DELETE ALL") {
      return NextResponse.json({ message: "Type PERMANENT DELETE ALL to confirm" }, { status: 400 });
    }

    const bulkType = parseBulkTrashType(type);
    if (!bulkType) {
      return NextResponse.json({ message: "Invalid trash type" }, { status: 400 });
    }

    const types: readonly TrashType[] = bulkType === "all" ? trashTypes : [bulkType];
    const dateQuery = dateRangeWhere(dateFrom, dateTo);

    await prisma.$transaction(async (tx) => {
      for (const t of types) {
        const where = { ...scopedWhere(t, session), ...onlyDeleted, ...dateQuery };
        let ids: string[];

        switch (t) {
          case "customers": {
            const customers = await tx.customer.findMany({ where, select: { id: true } });
            ids = customers.map((customer) => customer.id);
            await tx.demandRecord.deleteMany({
              where: { customerId: { in: ids }, deletedReason: "Deleted along with customer", ...onlyDeleted },
            });
            await tx.customer.deleteMany({ where: { id: { in: ids }, ...onlyDeleted } });
            break;
          }
          case "sales":
            ids = (await tx.demandRecord.findMany({ where, select: { id: true } })).map((record) => record.id);
            await tx.demandRecord.deleteMany({ where: { id: { in: ids }, ...onlyDeleted } });
            break;
          case "finance":
            ids = (await tx.businessReport.findMany({ where, select: { id: true } })).map((record) => record.id);
            await tx.businessReport.deleteMany({ where: { id: { in: ids }, ...onlyDeleted } });
            break;
          case "products":
            ids = (await tx.product.findMany({ where, select: { id: true } })).map((record) => record.id);
            await tx.product.deleteMany({ where: { id: { in: ids }, ...onlyDeleted } });
            break;
          case "deals":
            ids = (await tx.deal.findMany({ where, select: { id: true } })).map((record) => record.id);
            await tx.deal.deleteMany({ where: { id: { in: ids }, ...onlyDeleted } });
            break;
          case "expenses":
            ids = (await tx.expense.findMany({ where, select: { id: true } })).map((record) => record.id);
            await tx.expense.deleteMany({ where: { id: { in: ids }, ...onlyDeleted } });
            break;
          case "marketing":
            ids = (await tx.marketingMetric.findMany({ where, select: { id: true } })).map((record) => record.id);
            await tx.marketingMetric.deleteMany({ where: { id: { in: ids }, ...onlyDeleted } });
            break;
        }
        if (ids.length > 0) {
          await tx.restoreRequest.updateMany({
            where: { recordType: t, recordId: { in: ids }, status: "pending" },
            data: {
              status: "rejected",
              resolvedAt: new Date(),
              resolvedByUserId: session.user.id,
            },
          });
        }
      }
    });

    return NextResponse.json({ success: true, message: "All matching records permanently deleted" });
  }

  if (!isTrashType(type) || typeof id !== "string") {
    return NextResponse.json({ message: "Invalid trash record" }, { status: 400 });
  }

  if (confirmation !== "PERMANENT DELETE") {
    return NextResponse.json({ message: "Type PERMANENT DELETE to confirm" }, { status: 400 });
  }

  const result = await permanentlyDeleteRecord(type, id);
  await prisma.restoreRequest.updateMany({
    where: { recordType: type, recordId: id, status: "pending" },
    data: {
      status: "rejected",
      resolvedAt: new Date(),
      resolvedByUserId: session.user.id,
    },
  });
  return NextResponse.json({ success: true, deleted: result.count });
}
