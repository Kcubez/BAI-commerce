import { describe, expect, it } from "vitest";
import {
  isCustomerServiceHeaders,
  isMarketingMetricsHeaders,
  isProductCatalogHeaders,
  isSalesOrdersHeaders,
  mapDealStage,
  mapFulfillmentStatus,
  parseInventoryTextRecord,
  parseMarketingTextRecord,
} from "@/lib/commerce-import";
import { detectDemandColumnMapping } from "@/lib/demand-import";
import {
  normalizeAccountingType,
  normalizeCashType,
  normalizeFinanceCategory,
  parseFinanceTextRecord,
} from "@/lib/finance-import";
import { convertBurmeseDigits } from "@/lib/text-normalize";

describe("normalizeFinanceCategory", () => {
  it("classifies common categories and defaults to miscellaneous", () => {
    expect(normalizeFinanceCategory("Facebook Ads")).toMatch(/MARKETING/i);
    expect(normalizeFinanceCategory("staff salary")).toMatch(/STAFF/i);
    expect(normalizeFinanceCategory("office rent")).toMatch(/OPERATION/i);
    expect(normalizeFinanceCategory("mystery expense")).toMatch(/MISC/i);
    expect(normalizeFinanceCategory(null)).toMatch(/MISC/i);
  });
});

describe("normalizeCashType", () => {
  it("detects income in English and Burmese, defaults to expense", () => {
    expect(normalizeCashType("Income")).toBe("Income");
    expect(normalizeCashType("ဝင်ငွေ")).toBe("Income");
    expect(normalizeCashType("ရောင်း")).toBe("Income");
    expect(normalizeCashType("office supplies")).toBe("Expense");
    expect(normalizeCashType(null)).toBe("Expense");
  });
});

describe("normalizeAccountingType", () => {
  it("maps keywords and falls back to cash-type defaults", () => {
    expect(normalizeAccountingType("monthly salary", "Expense")).toBe("salary");
    expect(normalizeAccountingType("inventory restock", "Expense")).toBe("cogs");
    expect(normalizeAccountingType("customer receivable", "Income")).toBe("receivable");
    expect(normalizeAccountingType("unknown thing", "Income")).toBe("payment");
    expect(normalizeAccountingType("unknown thing", "Expense")).toBe("operating_expense");
  });
});

describe("parseFinanceTextRecord", () => {
  const fallback = new Date("2026-06-15T00:00:00.000Z");

  it("parses a labeled English record with Burmese digits", () => {
    const record = parseFinanceTextRecord(
      "Date: 2026-06-10\nType: Expense\nAmount: ၂၅၀၀၀၀\nDescription: Facebook ads",
      fallback,
    );
    expect(record.type).toBe("Expense");
    expect(record.amount).toBe(250000);
    expect(record.description).toMatch(/Facebook ads/);
    expect(record.date?.toISOString().slice(0, 10)).toBe("2026-06-10");
  });

  it("infers income from keywords and falls back for missing date", () => {
    const record = parseFinanceTextRecord("ရောင်း: product sale\nAmount: 100000", fallback);
    expect(record.type).toBe("Income");
    expect(record.date).toEqual(fallback);
  });
});

describe("parseInventoryTextRecord", () => {
  it("parses a product record and requires a SKU", () => {
    const row = parseInventoryTextRecord(
      "Product Name: Shampoo\nSKU: SH-001\nPrice: 15000\nStock: 20",
    );
    expect(row?.sku).toBe("SH-001");
    expect(row?.name).toBe("Shampoo");
    expect(row?.sellingPrice).toBe(15000);
    expect(row?.stockQty).toBe(20);
  });

  it("returns null without a SKU and handles Burmese digits", () => {
    expect(parseInventoryTextRecord("Product Name: No SKU here")).toBeNull();
    const row = parseInventoryTextRecord("SKU: SH-002\nPrice: ၁၅၀၀၀");
    expect(row?.sellingPrice).toBe(15000);
  });
});

describe("parseMarketingTextRecord", () => {
  const fallback = new Date("2026-06-15T00:00:00.000Z");

  it("parses channel metrics", () => {
    const row = parseMarketingTextRecord(
      "Date: 2026-06-10\nChannel: Facebook\nSpend: 200000\nReach: 5000",
      fallback,
    );
    expect(row?.channel).toBe("Facebook");
    expect(row?.spend).toBe(200000);
    expect(row?.reach).toBe(5000);
  });

  it("returns null for fully empty messages", () => {
    expect(parseMarketingTextRecord("hello there", fallback)).toBeNull();
  });
});

describe("mapDealStage / mapFulfillmentStatus", () => {
  it("maps stage keywords with a pending default", () => {
    expect(mapDealStage("quoted")).toMatch(/QUOTED/i);
    expect(mapDealStage("won")).toMatch(/WON/i);
    expect(mapDealStage("something unknown")).toMatch(/PENDING/i);
  });

  it("maps fulfillment keywords", () => {
    expect(mapFulfillmentStatus("shipped")).toMatch(/FULFILLED/i);
    expect(mapFulfillmentStatus("cancelled")).toMatch(/CANCELLED/i);
  });
});

describe("import header detectors", () => {
  it("detects each template kind", () => {
    expect(isProductCatalogHeaders(["SKU", "Product Name", "Price"])).toBe(true);
    expect(isSalesOrdersHeaders(["Order Date", "Customer Name", "Product Name"])).toBe(true);
    expect(isMarketingMetricsHeaders(["Date", "Channel", "Spend"])).toBe(true);
    expect(isCustomerServiceHeaders(["Customer Name", "Next Follow Up", "CSAT"])).toBe(true);
  });

  it("rejects mismatched headers", () => {
    expect(isProductCatalogHeaders(["Customer Name", "Phone"])).toBe(false);
    expect(isSalesOrdersHeaders(["SKU", "Price"])).toBe(false);
  });
});

describe("detectDemandColumnMapping (commerce)", () => {
  it("maps Burmese headers used by real import sheets", () => {
    const mapping = detectDemandColumnMapping(["သုံးစွဲသူ", "ဖုန်း", "ငွေပမာဏ"]);
    expect(mapping.customerName).toBe("သုံးစွဲသူ");
    expect(mapping.customerPhone).toBe("ဖုန်း");
    expect(mapping.serviceAmount).toBe("ငွေပမာဏ");
  });
});

describe("convertBurmeseDigits", () => {
  it("converts Myanmar digits and leaves other text untouched", () => {
    expect(convertBurmeseDigits("၅၀၀၀၀၀")).toBe("500000");
    expect(convertBurmeseDigits("Amount: ၂၅၀၀၀ Ks")).toBe("Amount: 25000 Ks");
    expect(convertBurmeseDigits("no digits here")).toBe("no digits here");
    expect(convertBurmeseDigits("")).toBe("");
  });
});
