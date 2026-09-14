import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { onlyDeleted, restoreData } from "@/lib/soft-delete";
import { isAdminSession } from "@/lib/tenant-scope";
import { NextRequest, NextResponse } from "next/server";

const trashTypes = [
  "customers",
  "sales",
  "finance",
  "financeEntries",
  "products",
  "deals",
  "expenses",
  "marketing",
] as const;

type TrashType = (typeof trashTypes)[number];

type TrashRecord = {
  id: string;
  name?: string | null;
  title?: string | null;
  customerName?: string | null;
  reporterName?: string | null;
  projectName?: string | null;
  phone?: string | null;
  company?: string | null;
  serviceName?: string | null;
  status?: string | null;
  cashType?: string | null;
  marketingChannel?: string | null;
  totalSalesAmount?: number | null;
  url?: string | null;
  packageName?: string | null;
  sku?: string | null;
  category?: string | null;
  subcategory?: string | null;
  amount?: number | null;
  expenseDate?: Date | null;
  entryDate?: Date | null;
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
  // Data isolation: every account (including admin) only sees its own trash.
  // Admin-only capabilities (restore_all, single restore) stay gated by
  // isAdminSession at their call sites — this scope only limits *whose* rows.
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
    case "financeEntries":
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
    case "financeEntries":
      return {
        ...restoreRequestMeta,
        type,
        id: record.id,
        title: record.title || "Finance ledger entry",
        subtitle: [record.cashType, record.amount ? `${record.amount.toLocaleString()} MMK` : null].filter(Boolean).join(" · ") || "Finance ledger",
        recordDate: displayDate(record.entryDate),
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
    case "financeEntries": {
      const [records, total] = await Promise.all([
        prisma.financeEntry.findMany({ where, orderBy: { deletedAt: "desc" }, skip, take }),
        prisma.financeEntry.count({ where }),
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

type TrashSession = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

// True when `id` names a trashed row of `type` owned by the session user.
// This is the ownership gate for single-record restore / permanent-delete /
// restore-request actions, so one tenant can never address another's rows.
async function isOwnedTrashedRecord(
  type: TrashType,
  session: TrashSession,
  id: string,
): Promise<boolean> {
  const where = { id, ...trashWhere(type, session, null, null) };

  switch (type) {
    case "customers":
      return Boolean(await prisma.customer.findFirst({ where, select: { id: true } }));
    case "sales":
      return Boolean(await prisma.demandRecord.findFirst({ where, select: { id: true } }));
    case "finance":
      return Boolean(await prisma.businessReport.findFirst({ where, select: { id: true } }));
    case "financeEntries":
      return Boolean(await prisma.financeEntry.findFirst({ where, select: { id: true } }));
    case "products":
      return Boolean(await prisma.product.findFirst({ where, select: { id: true } }));
    case "deals":
      return Boolean(await prisma.deal.findFirst({ where, select: { id: true } }));
    case "expenses":
      return Boolean(await prisma.expense.findFirst({ where, select: { id: true } }));
    case "marketing":
      return Boolean(await prisma.marketingMetric.findFirst({ where, select: { id: true } }));
  }
}

// True when anyone holds a pending restore request for this record. Admins
// may act on foreign rows only through this channel (plus their own rows) —
// never by guessing IDs.
async function hasPendingRestoreRequest(type: TrashType, id: string): Promise<boolean> {
  const hit = await prisma.restoreRequest.findFirst({
    where: { recordType: type, recordId: id, status: "pending" },
    select: { id: true },
  });
  return Boolean(hit);
}

async function restoreRecord(
  type: TrashType,
  ids: string[],
  userId: string,
) {
  const where = { id: { in: ids }, ...onlyDeleted };
  const data = restoreData(userId);

  switch (type) {
    case "customers": {
      const result = await prisma.customer.updateMany({ where, data });
      await prisma.demandRecord.updateMany({
        where: { customerId: { in: ids }, deletedReason: "Deleted along with customer", ...onlyDeleted },
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
    case "financeEntries":
      return prisma.financeEntry.updateMany({ where, data });
    case "marketing":
      return prisma.marketingMetric.updateMany({ where, data });
  }
}

async function permanentlyDeleteRecord(type: TrashType, ids: string[]) {
  const where = { id: { in: ids }, ...onlyDeleted };

  switch (type) {
    case "customers": {
      await prisma.demandRecord.deleteMany({
        where: { customerId: { in: ids }, deletedReason: "Deleted along with customer", ...onlyDeleted },
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
    case "financeEntries":
      return prisma.financeEntry.deleteMany({ where });
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
    // Any signed-in user may permanently delete their own trashed rows
    // (single + bulk are scoped server-side); restore stays admin-only.
    canPermanentDelete: true,
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

    // Sequential per-type writes instead of one 8-table transaction: a single
    // interactive transaction times out on serverless (P2028) once trash
    // grows. Each updateMany is atomic on its own; counts are reported so a
    // partial run is visible and safely retryable (idempotent).
    const restoredByType: Record<string, number> = {};
    try {
      for (const t of types) {
        const where = { ...scopedWhere(t, session), ...onlyDeleted, ...dateQuery };
        let ids: string[];
        let restored = 0;

        switch (t) {
          case "customers": {
            const customers = await prisma.customer.findMany({ where, select: { id: true } });
            ids = customers.map((customer) => customer.id);
            restored = (await prisma.customer.updateMany({ where: { id: { in: ids }, ...onlyDeleted }, data })).count;
            await prisma.demandRecord.updateMany({
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
            ids = (await prisma.demandRecord.findMany({ where, select: { id: true } })).map((record) => record.id);
            restored = (await prisma.demandRecord.updateMany({ where: { id: { in: ids }, ...onlyDeleted }, data })).count;
            break;
          case "finance":
            ids = (await prisma.businessReport.findMany({ where, select: { id: true } })).map((record) => record.id);
            restored = (await prisma.businessReport.updateMany({ where: { id: { in: ids }, ...onlyDeleted }, data })).count;
            break;
          case "products":
            ids = (await prisma.product.findMany({ where, select: { id: true } })).map((record) => record.id);
            restored = (await prisma.product.updateMany({ where: { id: { in: ids }, ...onlyDeleted }, data })).count;
            break;
          case "deals":
            ids = (await prisma.deal.findMany({ where, select: { id: true } })).map((record) => record.id);
            restored = (await prisma.deal.updateMany({ where: { id: { in: ids }, ...onlyDeleted }, data })).count;
            break;
          case "expenses":
            ids = (await prisma.expense.findMany({ where, select: { id: true } })).map((record) => record.id);
            restored = (await prisma.expense.updateMany({ where: { id: { in: ids }, ...onlyDeleted }, data })).count;
            break;
          case "financeEntries":
            ids = (await prisma.financeEntry.findMany({ where, select: { id: true } })).map((record) => record.id);
            restored = (await prisma.financeEntry.updateMany({ where: { id: { in: ids }, ...onlyDeleted }, data })).count;
            break;
          case "marketing":
            ids = (await prisma.marketingMetric.findMany({ where, select: { id: true } })).map((record) => record.id);
            restored = (await prisma.marketingMetric.updateMany({ where: { id: { in: ids }, ...onlyDeleted }, data })).count;
            break;
        }
        // Admins restore on behalf of requesters too: include trashed rows
        // with a pending restore request (only trashed rows are affected —
        // the update below re-applies ...onlyDeleted).
        const requested = await prisma.restoreRequest.findMany({
          where: { recordType: t, status: "pending" },
          select: { recordId: true },
        });
        if (requested.length > 0) {
          ids = [...new Set([...ids, ...requested.map((r) => r.recordId)])];
          if (t === "customers") {
            // The customers cascade above ran for owned ids only; extend it
            // to requested rows (already-restored rows are skipped by
            // ...onlyDeleted, so this is a no-op for them).
            restored += (await prisma.customer.updateMany({ where: { id: { in: ids }, ...onlyDeleted }, data })).count;
            await prisma.demandRecord.updateMany({
              where: {
                customerId: { in: ids },
                deletedReason: "Deleted along with customer",
                ...onlyDeleted,
              },
              data,
            });
          } else {
            // restoreRecord re-applies ...onlyDeleted, so already-restored
            // rows are a no-op and counted only once above.
            restored += (await restoreRecord(t, ids, session.user.id)).count;
          }
        }
        restoredByType[t] = restored;
        if (ids.length > 0) {
          await prisma.restoreRequest.updateMany({
            where: { recordType: t, recordId: { in: ids }, status: "pending" },
            data: {
              status: "approved",
              resolvedAt: new Date(),
              resolvedByUserId: session.user.id,
            },
          });
        }
      }
    } catch (error) {
      console.error("Bulk trash restore failed:", error);
      return NextResponse.json(
        { message: "Bulk restore failed partway. Some records may already be restored — please retry.", restoredByType },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, message: "All matching records restored", restoredByType });
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
        case "financeEntries":
          records = await prisma.financeEntry.findMany({ where, select: { id: true } });
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
        case "financeEntries":
          exists = Boolean(await prisma.financeEntry.findFirst({ where, select: { id: true } }));
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

  if (!isTrashType(type) || typeof id !== "string") {
    return NextResponse.json({ message: "Invalid trash record" }, { status: 400 });
  }

  // Admins may restore their own rows freely; foreign rows only when a
  // pending restore request names them (ID guessing alone is not enough).
  const owned = await isOwnedTrashedRecord(type, session, id);
  if (!owned && !(await hasPendingRestoreRequest(type, id))) {
    return NextResponse.json({ message: "Trash record not found or access denied" }, { status: 404 });
  }

  const result = await restoreRecord(type, [id], session.user.id);
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

  const body = await req.json().catch(() => ({}));
  const { type, id, confirmation, action, dateFrom, dateTo } = body;

  // Bulk path enforces tenancy itself: its loop combines
  // scopedWhere(t, session) + onlyDeleted + date range, so every account
  // (including admin) can only ever delete its own trashed rows.
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

    // Sequential per-type deletes instead of one 8-table transaction: a
    // single interactive transaction times out on serverless (P2028) once
    // trash grows, surfacing as a generic "Request failed". Each deleteMany
    // is atomic on its own; counts are reported so a partial run is visible
    // and safely retryable (idempotent — only ...onlyDeleted rows match).
    const deletedByType: Record<string, number> = {};
    try {
      for (const t of types) {
        const where = { ...scopedWhere(t, session), ...onlyDeleted, ...dateQuery };
        let ids: string[];
        let deleted = 0;

        switch (t) {
          case "customers": {
            const customers = await prisma.customer.findMany({ where, select: { id: true } });
            ids = customers.map((customer) => customer.id);
            await prisma.demandRecord.deleteMany({
              where: { customerId: { in: ids }, deletedReason: "Deleted along with customer", ...onlyDeleted },
            });
            deleted = (await prisma.customer.deleteMany({ where: { id: { in: ids }, ...onlyDeleted } })).count;
            break;
          }
          case "sales":
            ids = (await prisma.demandRecord.findMany({ where, select: { id: true } })).map((record) => record.id);
            deleted = (await prisma.demandRecord.deleteMany({ where: { id: { in: ids }, ...onlyDeleted } })).count;
            break;
          case "finance":
            ids = (await prisma.businessReport.findMany({ where, select: { id: true } })).map((record) => record.id);
            deleted = (await prisma.businessReport.deleteMany({ where: { id: { in: ids }, ...onlyDeleted } })).count;
            break;
          case "products":
            ids = (await prisma.product.findMany({ where, select: { id: true } })).map((record) => record.id);
            deleted = (await prisma.product.deleteMany({ where: { id: { in: ids }, ...onlyDeleted } })).count;
            break;
          case "deals":
            ids = (await prisma.deal.findMany({ where, select: { id: true } })).map((record) => record.id);
            deleted = (await prisma.deal.deleteMany({ where: { id: { in: ids }, ...onlyDeleted } })).count;
            break;
          case "expenses":
            ids = (await prisma.expense.findMany({ where, select: { id: true } })).map((record) => record.id);
            deleted = (await prisma.expense.deleteMany({ where: { id: { in: ids }, ...onlyDeleted } })).count;
            break;
          case "financeEntries":
            ids = (await prisma.financeEntry.findMany({ where, select: { id: true } })).map((record) => record.id);
            deleted = (await prisma.financeEntry.deleteMany({ where: { id: { in: ids }, ...onlyDeleted } })).count;
            break;
          case "marketing":
            ids = (await prisma.marketingMetric.findMany({ where, select: { id: true } })).map((record) => record.id);
            deleted = (await prisma.marketingMetric.deleteMany({ where: { id: { in: ids }, ...onlyDeleted } })).count;
            break;
        }
        deletedByType[t] = deleted;
        if (ids.length > 0) {
          await prisma.restoreRequest.updateMany({
            where: { recordType: t, recordId: { in: ids }, status: "pending" },
            data: {
              status: "rejected",
              resolvedAt: new Date(),
              resolvedByUserId: session.user.id,
            },
          });
        }
      }
    } catch (error) {
      console.error("Bulk trash delete failed:", error);
      return NextResponse.json(
        { message: "Bulk delete failed partway. Some records may already be deleted — please retry.", deletedByType },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, message: "All matching records permanently deleted", deletedByType });
  }

  if (!isTrashType(type) || typeof id !== "string") {
    return NextResponse.json({ message: "Invalid trash record" }, { status: 400 });
  }

  // Permanent delete is allowed for your own trashed rows. Admins may
  // additionally act on a foreign row named by a pending restore request
  // (e.g. rejecting the request by deleting); ID guessing alone is denied.
  const owned = await isOwnedTrashedRecord(type, session, id);
  let allowed = owned;
  if (!allowed && isAdminSession(session)) {
    allowed = await hasPendingRestoreRequest(type, id);
  }
  if (!allowed) {
    return NextResponse.json({ message: "Trash record not found or access denied" }, { status: 404 });
  }

  if (confirmation !== "PERMANENT DELETE") {
    return NextResponse.json({ message: "Type PERMANENT DELETE to confirm" }, { status: 400 });
  }

  const result = await permanentlyDeleteRecord(type, [id]);
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
