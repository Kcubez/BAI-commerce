import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { DealStage, FulfillmentStatus } from "@/generated/prisma/enums";
import type { DealStage as DealStageValue, FulfillmentStatus as FulfillmentStatusValue } from "@/generated/prisma/enums";
import { parseExcelDate } from "@/lib/demand-parser";
import { restoreData } from "@/lib/soft-delete";
import { formatPhoneNumber } from "@/lib/utils";

// ─── Header helpers ──────────────────────────────────────────────────────────

function normalizeHeaderKey(value: unknown): string {
  return String(value ?? "")
    .replace(/[\u1040-\u1049]/g, (d) => String("၀၁၂၃၄၅၆၇၈၉".indexOf(d)))
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

export function isProductCatalogHeaders(headers: unknown[]): boolean {
  const h = headers.map(normalizeHeaderKey);
  const hasSku = h.includes("product code") || h.includes("sku") || h.includes("product sku");
  const hasCustomer = h.includes("customer name");
  if (!hasSku || hasCustomer) return false;
  return (
    h.includes("product name") ||
    h.includes("name") ||
    h.includes("selling price") ||
    h.includes("stock qty") ||
    h.includes("unit cost")
  );
}

export function isMarketingMetricsHeaders(headers: unknown[]): boolean {
  const h = headers.map(normalizeHeaderKey);
  const hasChannel = h.includes("channel") && !h.includes("customer name") && !h.includes("product name");
  if (!hasChannel) return false;
  return (
    h.includes("spend") ||
    h.includes("reach") ||
    h.includes("impressions") ||
    h.includes("ad driven orders")
  );
}

export function isSalesOrdersHeaders(headers: unknown[]): boolean {
  const h = headers.map(normalizeHeaderKey);
  const hasCustomer = h.includes("customer name");
  if (!hasCustomer) return false;
  return (
    h.includes("product name") ||
    (h.includes("quantity") && h.includes("unit price"))
  );
}

// ─── Row parsing ─────────────────────────────────────────────────────────────

const BURMESE_DIGIT_MAP: Record<string, string> = {
  "\u1040": "0", "\u1041": "1", "\u1042": "2", "\u1043": "3", "\u1044": "4",
  "\u1045": "5", "\u1046": "6", "\u1047": "7", "\u1048": "8", "\u1049": "9",
};

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const cleaned = String(value)
    .replace(/[\u1040-\u1049]/g, (d) => BURMESE_DIGIT_MAP[d] || d)
    .replace(/,/g, "");
  const n = Number(cleaned.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

type RowAccessor = (...keys: string[]) => unknown;

function makeRowAccessor(row: Record<string, unknown>): RowAccessor {
  const map = new Map<string, unknown>();
  for (const key of Object.keys(row)) {
    map.set(normalizeHeaderKey(key), row[key]);
  }
  return (...keys: string[]) => {
    for (const raw of keys) {
      const value = map.get(normalizeHeaderKey(raw));
      if (value !== undefined && value !== null && value !== "") return value;
    }
    return null;
  };
}

function readWorkbookRows(fileBuffer: Buffer): Array<Record<string, unknown>[]> {
  const workbook = XLSX.read(fileBuffer, { type: "buffer", cellDates: true });
  const sheetRows: Array<Record<string, unknown>[]> = [];
  for (const sheetName of workbook.SheetNames) {
    sheetRows.push(
      XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { raw: true })
    );
  }
  return sheetRows;
}

// ─── Product catalog / inventory ─────────────────────────────────────────────

export type ParsedProductRow = {
  name: string;
  sku: string;
  category: string | null;
  unitCost: number | null;
  sellingPrice: number | null;
  stockQty: number;
  lowStockThreshold: number;
};

export function parseProductCatalogRows(fileBuffer: Buffer): ParsedProductRow[] {
  const parsed: ParsedProductRow[] = [];
  for (const rows of readWorkbookRows(fileBuffer)) {
    for (const row of rows) {
      const get = makeRowAccessor(row);
      const sku = String(get("Product Code", "SKU", "Product SKU") ?? "").trim();
      const name = String(get("Product Name", "Name") ?? "").trim() || sku;
      if (!sku) continue;
      parsed.push({
        name,
        sku,
        category: String(get("Category") ?? "").trim() || null,
        unitCost: toNumber(get("Unit Cost")),
        sellingPrice: toNumber(get("Selling Price", "Price")),
        stockQty: Math.max(0, Math.trunc(toNumber(get("Stock Qty", "Stock")) ?? 0)),
        lowStockThreshold: Math.max(0, Math.trunc(toNumber(get("Low Stock Threshold", "Low Stock")) ?? 0)),
      });
    }
  }
  return parsed;
}

export async function upsertProductsFromRows(rows: ParsedProductRow[], userId: string): Promise<number> {
  let count = 0;
  for (const product of rows) {
    await prisma.product.upsert({
      where: { userId_sku: { userId, sku: product.sku } },
      create: {
        userId,
        name: product.name,
        sku: product.sku,
        category: product.category,
        unitCost: product.unitCost,
        sellingPrice: product.sellingPrice,
        stockQty: product.stockQty,
        lowStockThreshold: product.lowStockThreshold,
      },
      update: {
        ...restoreData(userId),
        ...(product.name ? { name: product.name } : {}),
        ...(product.category ? { category: product.category } : {}),
        ...(product.unitCost !== null ? { unitCost: product.unitCost } : {}),
        ...(product.sellingPrice !== null ? { sellingPrice: product.sellingPrice } : {}),
        stockQty: product.stockQty,
        lowStockThreshold: product.lowStockThreshold,
      },
    });
    count += 1;
  }
  return count;
}

// ─── Marketing metrics ───────────────────────────────────────────────────────

export type ParsedMarketingRow = {
  metricDate: Date;
  channel: string | null;
  spend: number;
  reach: number | null;
  impressions: number | null;
  adDrivenOrders: number | null;
  note: string | null;
};

export function parseMarketingMetricsRows(fileBuffer: Buffer): ParsedMarketingRow[] {
  const now = new Date();
  const parsed: ParsedMarketingRow[] = [];
  for (const rows of readWorkbookRows(fileBuffer)) {
    for (const row of rows) {
      const get = makeRowAccessor(row);
      const metricDate = parseExcelDate(get("Date"));
      const spend = toNumber(get("Spend")) ?? 0;
      // Skip fully empty rows (no date and nothing measurable).
      if (!metricDate && spend === 0 && get("Channel") == null && get("Reach") == null) continue;
      const intOrNull = (value: unknown) => {
        const n = toNumber(value);
        return n === null ? null : Math.trunc(n);
      };
      parsed.push({
        metricDate: metricDate || now,
        channel: String(get("Channel") ?? "").trim() || null,
        spend,
        reach: intOrNull(get("Reach")),
        impressions: intOrNull(get("Impressions")),
        adDrivenOrders: intOrNull(get("Ad-driven Orders", "Ad Driven Orders")),
        note: String(get("Notes", "Note") ?? "").trim() || null,
      });
    }
  }
  return parsed;
}

export async function createMarketingMetricsFromRows(rows: ParsedMarketingRow[], userId: string): Promise<number> {
  if (rows.length === 0) return 0;
  await prisma.marketingMetric.createMany({
    data: rows.map((metric) => ({
      userId,
      metricDate: metric.metricDate,
      channel: metric.channel,
      spend: metric.spend,
      reach: metric.reach,
      impressions: metric.impressions,
      adDrivenOrders: metric.adDrivenOrders,
      note: metric.note,
    })),
  });
  return rows.length;
}

// ─── Sales orders ────────────────────────────────────────────────────────────

export type ParsedSalesOrderRow = {
  orderDate: Date | null;
  customerName: string | null;
  customerPhone: string | null;
  productName: string;
  sku: string | null;
  quantity: number;
  unitPrice: number;
  stage: DealStageValue;
  fulfillmentStatus: FulfillmentStatusValue;
  notes: string | null;
};

export function mapDealStage(value: unknown): DealStageValue {
  const v = String(value ?? "").toLowerCase();
  if (/new|lead/.test(v)) return DealStage.NEW_LEAD;
  if (/quot/.test(v)) return DealStage.QUOTED;
  if (/follow/.test(v)) return DealStage.FOLLOW_UP_NEEDED;
  if (/pend/.test(v)) return DealStage.PENDING;
  if (/won|win|complete|success/.test(v)) return DealStage.WON;
  if (/lost|cancel/.test(v)) return DealStage.LOST;
  return DealStage.PENDING;
}

export function mapFulfillmentStatus(value: unknown): FulfillmentStatusValue {
  const v = String(value ?? "").toLowerCase();
  if (/process/.test(v)) return FulfillmentStatus.PROCESSING;
  if (/fulfil|ship|deliver|complete|done/.test(v)) return FulfillmentStatus.FULFILLED;
  if (/cancel/.test(v)) return FulfillmentStatus.CANCELLED;
  if (/pend/.test(v)) return FulfillmentStatus.PENDING;
  return FulfillmentStatus.NOT_APPLICABLE;
}

export function parseSalesOrderRows(fileBuffer: Buffer): ParsedSalesOrderRow[] {
  const parsed: ParsedSalesOrderRow[] = [];
  for (const rows of readWorkbookRows(fileBuffer)) {
    for (const row of rows) {
      const get = makeRowAccessor(row);
      const productName = String(get("Product Name", "Product") ?? "").trim();
      const quantity = Math.max(1, Math.trunc(toNumber(get("Quantity", "Qty")) ?? 1));
      const customerName = String(get("Customer Name", "Customer") ?? "").trim() || null;
      // Require at least a product or a customer so blank rows are skipped.
      if (!productName && !customerName) continue;
      parsed.push({
        orderDate: parseExcelDate(get("Date")),
        customerName,
        customerPhone: formatPhoneNumber(String(get("Phone", "Phone Number") ?? "")) || null,
        productName: productName || "Unknown product",
        sku: String(get("Product Code", "SKU") ?? "").trim() || null,
        quantity,
        unitPrice: toNumber(get("Unit Price", "Price")) ?? 0,
        stage: mapDealStage(get("Stage")),
        fulfillmentStatus: mapFulfillmentStatus(get("Fulfillment Status", "Fulfillment", "Status")),
        notes: String(get("Notes", "Note") ?? "").trim() || null,
      });
    }
  }
  return parsed;
}

async function resolveCustomerId(
  customerName: string,
  phone: string | null,
  userId: string
): Promise<string | null> {
  const nameNormalized = customerName.toLowerCase().replace(/\s+/g, " ").trim();
  const customer = await prisma.customer.upsert({
    where: { userId_nameNormalized: { userId, nameNormalized } },
    create: {
      userId,
      name: customerName,
      nameNormalized,
      phone,
    },
    update: {
      ...restoreData(userId),
      ...(phone ? { phone } : {}),
      status: "active",
    },
    select: { id: true },
  });
  return customer.id;
}

export async function createSalesOrdersFromRows(rows: ParsedSalesOrderRow[], userId: string): Promise<number> {
  let count = 0;
  for (const order of rows) {
    const customerId = order.customerName ? await resolveCustomerId(order.customerName, order.customerPhone, userId) : null;
    const dealDate = order.orderDate || new Date();
    const amount = order.unitPrice * order.quantity;
    const deal = await prisma.deal.create({
      data: {
        userId,
        customerId,
        stage: order.stage,
        fulfillmentStatus: order.fulfillmentStatus,
        source: "telegram_sales_import",
        sourceChannel: "Telegram",
        quotedAmount: amount > 0 ? amount : null,
        lastContactAt: dealDate,
        wonAt: order.stage === DealStage.WON ? dealDate : undefined,
        lostAt: order.stage === DealStage.LOST ? dealDate : undefined,
        note: [order.notes, order.orderDate ? `Order date: ${order.orderDate.toISOString().slice(0, 10)}` : ""]
          .filter(Boolean)
          .join(" · ") || null,
        items: {
          create: [{
            productName: order.productName,
            sku: order.sku,
            quantity: order.quantity,
            unitPrice: order.unitPrice,
          }],
        },
      },
    });
    if (customerId) {
      await prisma.customerActivity.create({
        data: {
          customerId,
          action: "demand_report",
          description: `Telegram sales import · ${deal.id}`,
        },
      });
    }
    count += 1;
  }
  return count;
}
