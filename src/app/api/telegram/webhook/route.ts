import {
  prisma,
} from '@/lib/prisma';
import {
  Prisma,
} from '@/generated/prisma/client';
import * as XLSX from "xlsx";
import {
  answerQuestionWithGemini,
  isFileTooLarge,
  isSpreadsheetFile,
  type ParsedDemandRecord,
} from '@/lib/demand-parser';
import {
  analyzeDemandRecord,
} from '@/lib/demand-analysis';
import {
  parseCommerceMessageWithGemini,
} from '@/lib/commerce-parser';
import {
  createCustomerServiceRecordsFromRows,
  createMarketingMetricsFromRows,
  createSalesOrdersFromRows,
  isCustomerServiceHeaders,
  isMarketingMetricsHeaders,
  isProductCatalogHeaders,
  isSalesOrdersHeaders,
  parseCustomerServiceRows,
  parseInventoryTextRecord,
  parseMarketingMetricsRows,
  parseMarketingTextRecord,
  parseProductCatalogRows,
  parseSalesOrderRows,
  upsertProductsFromRows,
  type ParsedCustomerServiceRow,
  type ParsedMarketingRow,
  type ParsedProductRow,
  type ParsedSalesOrderRow,
} from '@/lib/commerce-import';
import {
  NextRequest,
  NextResponse,
  after,
} from 'next/server';
import {
  sendOTPEmail,
} from '@/lib/email';
import {
  notDeleted,
  restoreData,
} from '@/lib/soft-delete';
import {
  formatPhoneNumber,
} from '@/lib/utils';
import {
  isCommerceReportMode,
  buildFormatInlineButtons,
  buildMainMenuButtons,
  getDepartmentForMode,
  getDepartmentNameBurmese,
  getFormatPrompt,
  getCustomerServiceFormatPrompt,
  getFinanceTransactionsFormatPrompt,
  getInventoryImportFormatPrompt,
  getMarketingImportFormatPrompt,
  getFormatPromptForMode,
  getFormatHintFooter,
  getCopyPasteTemplateForMode,
  escapeHtml,
} from '@/lib/telegram/templates';
import {
  sendTelegramMessage,
  answerCallbackQuery,
  editTelegramMessage,
  downloadTelegramFile,
  getFileInfoFromMessage,
} from '@/lib/telegram/client';
import {
  displayNameFromTelegramUser,
  normalizeCustomerName,
  isPrismaUniqueConstraintError,
  createTelegramMessageIfNew,
  getActiveBotSettings,
  upsertSender,
} from '@/lib/telegram/senders';
import type {
  TelegramSender,
} from '@/generated/prisma/client';
import {
  createFinanceRecord,
  isFinanceRecordsHeaders,
  parseFinanceRecordsSpreadsheet,
  parseFinanceTextRecord,
  type FinanceRecord,
} from '@/lib/finance-import';
import {
  fingerprintImportRows,
  sha256Hex,
} from '@/lib/data-import';

const MAIN_MENU_BUTTONS = {
  inline_keyboard: [
    [{ text: "🤖 Q&A မေးမြန်း", callback_data: "mode:qa" }, { text: "📈 Sales Orders", callback_data: "mode:demand_report" }],
    [{ text: "🎧 Customer Service", callback_data: "mode:customer_service" }, { text: "💳 Finance Transactions", callback_data: "mode:finance_transactions" }],
    [{ text: "📦 Inventory / Products", callback_data: "mode:inventory_import" }, { text: "📣 Marketing Metrics", callback_data: "mode:marketing_import" }],
  ],
};

const KEYBOARD_UNLINKED = {
  keyboard: [
    [{ text: "/link" }]
  ],
  resize_keyboard: true,
  one_time_keyboard: false
};

const KEYBOARD_LINKED = {
  keyboard: [
    [{ text: "/menu" }],
    [{ text: "/format" }, { text: "/template" }],
    [{ text: "/unlink" }]
  ],
  resize_keyboard: true,
  one_time_keyboard: false
};

async function sendNoPermissionPrompt(
  botToken: string | null | undefined,
  chatId: bigint | number,
  departmentName: string
) {
  await sendTelegramMessage({
    botToken,
    chatId,
    text: [
      "🚫 ━━━━━━━━━━━━━━━━━━━━",
      "",
      `  <b>ဝင်ရောက်ခွင့် မရှိပါ</b>`,
      "",
      "━━━━━━━━━━━━━━━━━━━━",
      "",
      `📌 <b>ဌာန:</b>  ${getDepartmentNameBurmese(departmentName)}`,
      "",
      `သင်သည် ယခုဌာနအတွက် ဒေတာပေးပို့ရန်`,
      `ခွင့်ပြုချက် မရရှိသေးပါ။`,
      "",
      "💡 <i>ကျေးဇူးပြု၍ လုပ်ငန်းတာဝန်ရှိသူ</i>",
      "<i>(Business Owner) အား ဆက်သွယ်ပါ။</i>",
    ].join("\n"),
    replyMarkup: {
      inline_keyboard: [
        [{ text: "↩️ Main Menu", callback_data: "action:menu" }]
      ]
    }
  });
}

async function checkAuthorization(
  sender: Pick<TelegramSender, "isVerified" | "isAuthorized" | "id" | "email" | "otpExpiresAt">,
  botToken: string | null | undefined,
  chatId: bigint | number
): Promise<boolean> {
  if (sender.isVerified && sender.isAuthorized) {
    return true;
  }

  if (!sender.isVerified) {
    await sendTelegramMessage({
      botToken,
      chatId,
      text: [
        "👋 ━━━━━━━━━━━━━━━━━━━━",
        "",
        "  <b>BAI-Commerce</b>",
        "  <i>စနစ်မှ လှိုက်လှဲစွာ ကြိုဆိုပါသည်</i>",
        "",
        "━━━━━━━━━━━━━━━━━━━━",
        "",
        "စနစ်ကို သုံးနိုင်ရန် အီးမေးလ်ဖြင့်",
        "အကောင့် အရင်ဆုံး ချိတ်ဆက်ရပါမည်။",
        "",
        "📝 <b>လုပ်ဆောင်ရန်:</b>",
        "",
        "  ① အောက်ခြေရှိ <b>/link</b> ခလုတ်ကို နှိပ်ပါ",
        "  ② သင့် ဝန်ထမ်းအီးမေးလ်ကို ရိုက်ထည့်ပါ",
        "  ③ ရရှိလာသော အီးမေးလ် OTP ကုဒ်ကို ရိုက်ထည့်ပါ",
      ].join("\n"),
      replyMarkup: KEYBOARD_UNLINKED,
    });
    return false;
  }

  if (!sender.isAuthorized) {
    await sendTelegramMessage({
      botToken,
      chatId,
      text: [
        "⏳ ━━━━━━━━━━━━━━━━━━━━",
        "",
        "  <b>ခွင့်ပြုချက် စောင့်ဆိုင်းနေပါသည်</b>",
        "",
        "━━━━━━━━━━━━━━━━━━━━",
        "",
        `✅ အီးမေးလ်: <code>${sender.email}</code>`,
        "   (အတည်ပြုပြီး)",
        "",
        "🔄 Business Owner ၏ ခွင့်ပြုချက်ကို",
        "   စောင့်ဆိုင်းနေပါသည်...",
        "",
        "💡 <i>သင့်လုပ်ငန်း တာဝန်ရှိသူအား</i>",
        "<i>ဆက်သွယ်ပြီး ခွင့်ပြုချက် တောင်းဆိုပါ။</i>",
      ].join("\n"),
      replyMarkup: KEYBOARD_UNLINKED, // keep unlinked status or allow unlink
    });
    return false;
  }

  return false;
}

// Sent when a sender submits data without first picking a report mode.
// Prevents data from being mis-filed into the wrong report type.
async function sendPickModePrompt(
  botToken: string | null | undefined,
  chatId: bigint,
) {
  await sendTelegramMessage({
    botToken,
    chatId,
    text: [
      "👋 <b>ကဏ္ဍ ရွေးချယ်ရန် လိုအပ်ပါသည်။</b>",
      "",
      "အချက်အလက် မထည့်သွင်းမီ မည်သည့် လုပ်ငန်းစဉ်အမျိုးအစားဖြင့် ဆောင်ရွက်မည်ကို အောက်ပါ Menu မှ ဦးစွာ ရွေးချယ်ပေးပါရန် မေတ္တာရပ်ခံအပ်ပါသည်။",
      "",
      "ရွေးချယ်ပြီးမှသာ ပေးပို့သော အချက်အလက်များကို မှန်ကန်သော ကဏ္ဍတွင် သိမ်းဆည်းပေးနိုင်မည် ဖြစ်ပါသည်။",
    ].join("\n"),
    replyMarkup: MAIN_MENU_BUTTONS,
  });
}

// Return the full format guide for whatever report mode the sender is in.

// A compact footer reminding the sender of the expected fields for the
// current report mode. Appended to confirmation messages so users can see
// what to include next time without re-opening the menu.

async function buildQAContext(ownerUserId: string): Promise<string> {
  // Fail closed: without an owner the queries below would drop their tenant
  // filter and mix every tenant's data into the AI prompt. Never do that.
  if (!ownerUserId) return "";
  const ownerWhere = { userId: ownerUserId };
  const [demandRecords, qaDocs, customers, deals, products, expenses, marketingMetrics] = await Promise.all([
    prisma.demandRecord.findMany({
      where: { sender: { userId: ownerUserId }, ...notDeleted },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { sender: true },
    }),
    prisma.qADocument.findMany({
      where: { userId: ownerUserId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.customer.findMany({
      where: { userId: ownerUserId, ...notDeleted },
      take: 20,
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.deal.findMany({
      where: { ...ownerWhere, ...notDeleted },
      include: { customer: true, items: true },
      orderBy: { updatedAt: 'desc' },
      take: 30,
    }),
    prisma.product.findMany({
      where: { ...ownerWhere, ...notDeleted },
      orderBy: { updatedAt: 'desc' },
      take: 30,
    }),
    prisma.expense.findMany({
      where: { ...ownerWhere, ...notDeleted },
      orderBy: { expenseDate: 'desc' },
      take: 20,
    }),
    prisma.marketingMetric.findMany({
      where: { ...ownerWhere, ...notDeleted },
      orderBy: { metricDate: 'desc' },
      take: 20,
    }),
  ]);

  const parts: string[] = [];

  if (demandRecords.length > 0) {
    parts.push('=== LEGACY SALES / Q&A RECORDS ===');
    for (const r of demandRecords) {
      const fields = [
        `Date: ${r.createdAt.toISOString().slice(0, 10)}`,
        `Reporter: ${r.sender?.displayName || "System / Uploaded"}`,
        r.customerName ? `Customer: ${r.customerName}` : 'Customer: —',
        r.serviceName ? `Product/Service: ${r.serviceName} (Amount: ${r.serviceAmount ?? '—'}, Qty: ${r.serviceQty ?? '—'})` : 'Product/Service: —',
        r.followUpDate ? `Follow-up Date: ${r.followUpDate.toISOString().slice(0, 10)}` : 'Follow-up: —',
        `Note: ${r.note || '—'}`,
      ].join(', ');
      parts.push(fields);
    }
  }

  if (deals.length > 0) {
    parts.push('\n=== COMMERCE DEALS / ORDERS ===');
    for (const deal of deals) {
      const total = deal.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0) || deal.quotedAmount || 0;
      const fields = [
        `Date: ${deal.createdAt.toISOString().slice(0, 10)}`,
        `Customer: ${deal.customer?.name || '—'}`,
        `Stage: ${deal.stage}`,
        `Fulfillment: ${deal.fulfillmentStatus}`,
        `Amount: ${total.toLocaleString()} MMK`,
        deal.items.length ? `Items: ${deal.items.map((item) => `${item.productName} x${item.quantity}`).join('; ')}` : '',
        deal.note ? `Note: ${deal.note}` : '',
      ].filter(Boolean).join(', ');
      parts.push(fields);
    }
  }

  if (qaDocs.length > 0) {
    parts.push('\n=== REFERENCE DOCUMENTS ===');
    for (const doc of qaDocs) {
      parts.push(`[${doc.title}]: ${doc.content.slice(0, 500)}`);
    }
  }

  if (customers.length > 0) {
    parts.push('\n=== CUSTOMERS ===');
    parts.push(customers.map(c => `${c.name} (${c.status})`).join(', '));
  }

  if (products.length > 0) {
    parts.push('\n=== PRODUCTS & INVENTORY ===');
    for (const product of products) {
      parts.push(`${product.name} (${product.sku}) — stock ${product.stockQty}, min ${product.lowStockThreshold}, price ${product.sellingPrice ?? '—'} MMK`);
    }
  }

  if (expenses.length > 0) {
    parts.push('\n=== FINANCE EXPENSES ===');
    for (const expense of expenses) {
      parts.push(`${expense.expenseDate.toISOString().slice(0, 10)} — ${expense.category}: ${expense.amount.toLocaleString()} MMK${expense.subcategory ? ` (${expense.subcategory})` : ''}`);
    }
  }

  if (marketingMetrics.length > 0) {
    parts.push('\n=== MARKETING METRICS ===');
    for (const metric of marketingMetrics) {
      parts.push(`${metric.metricDate.toISOString().slice(0, 10)} — ${metric.channel || 'Marketing'} spend ${metric.spend.toLocaleString()} MMK, reach ${metric.reach ?? '—'}, ad orders ${metric.adDrivenOrders ?? '—'}`);
    }
  }

  return parts.join('\n') || 'No business data available yet.';
}

async function resolveCustomersBatch(
  parsedDemands: {
    customerName: string | null;
    customerPhone?: string | null;
    customerCompany?: string | null;
    createdAt?: Date | null;
  }[],
  senderId: string,
  fileName: string,
  ownerUserId: string | null,
): Promise<Map<string, string>> {
  const nameToNormalized = new Map<string, string>();
  const nameToDetails = new Map<string, { phone: string | null; company: string | null; createdAt: Date | null }>();

  for (const d of parsedDemands) {
    if (d.customerName) {
      const normalized = normalizeCustomerName(d.customerName);
      if (!nameToNormalized.has(d.customerName)) {
        nameToNormalized.set(d.customerName, normalized);
      }

      const existing = nameToDetails.get(d.customerName);
      const existingDate = existing?.createdAt ?? null;
      const newDate = d.createdAt ?? null;
      let earliestDate = existingDate;
      if (newDate) {
        if (!earliestDate || newDate < earliestDate) {
          earliestDate = newDate;
        }
      }

      nameToDetails.set(d.customerName, {
        phone: d.customerPhone ? formatPhoneNumber(d.customerPhone) : (existing ? existing.phone : null),
        company: d.customerCompany || (existing ? existing.company : null),
        createdAt: earliestDate,
      });
    }
  }
  if (nameToNormalized.size === 0) return new Map();

  const allNormalized = Array.from(new Set(nameToNormalized.values()));
  const allRawNames = Array.from(nameToNormalized.keys());

  const [byNormalizedRows, byRawNameRows] = await Promise.all([
    prisma.customer.findMany({
      where: { nameNormalized: { in: allNormalized }, userId: ownerUserId },
      select: { id: true, name: true, nameNormalized: true, deletedAt: true },
    }),
    prisma.customer.findMany({
      where: { name: { in: allRawNames }, userId: ownerUserId },
      select: { id: true, name: true, nameNormalized: true, deletedAt: true },
    }),
  ]);

  const idByNormalized = new Map<string, { id: string; name: string; nameNormalized: string | null; deletedAt?: Date | null }>();
  for (const c of byNormalizedRows) {
    if (c.nameNormalized) idByNormalized.set(c.nameNormalized, c);
  }
  for (const c of byRawNameRows) {
    if (c.nameNormalized) {
      if (!idByNormalized.has(c.nameNormalized)) idByNormalized.set(c.nameNormalized, c);
    } else {
      const targetNormalized = nameToNormalized.get(c.name);
      if (targetNormalized && !idByNormalized.has(targetNormalized)) {
        idByNormalized.set(targetNormalized, c);
      }
    }
  }

  const missingNames: { raw: string; normalized: string }[] = [];
  for (const [raw, normalized] of nameToNormalized.entries()) {
    if (!idByNormalized.has(normalized)) missingNames.push({ raw, normalized });
  }

  for (const m of missingNames) {
    try {
      const details = nameToDetails.get(m.raw);
      const created = await prisma.customer.create({
        data: {
          name: m.raw,
          userId: ownerUserId,
          nameNormalized: m.normalized,
          phone: details?.phone || null,
          company: details?.company || null,
          createdAt: details?.createdAt ?? undefined,
        },
        select: { id: true, name: true, nameNormalized: true, deletedAt: true },
      });
      idByNormalized.set(m.normalized, created);
    } catch (err) {
      if (isPrismaUniqueConstraintError(err)) {
        const existing = await prisma.customer.findFirst({
          where: { nameNormalized: m.normalized, userId: ownerUserId },
          select: { id: true, name: true, nameNormalized: true, deletedAt: true },
        });
        if (existing) idByNormalized.set(m.normalized, existing);
      } else {
        throw err;
      }
    }
  }

  // Update details (phone, company) and backfill normalized name for existing/newly resolved customers
  await Promise.all(
    Array.from(idByNormalized.values()).map(async (c) => {
      const details = nameToDetails.get(c.name);
      if (!details) return;
      const updateData: {
        phone?: string;
        company?: string;
        nameNormalized?: string;
        updatedAt?: Date;
        status?: string;
        deletedAt?: null;
        deletedByUserId?: null;
        deletedReason?: null;
        restoredAt?: Date;
        restoredByUserId?: string | null;
      } = {};
      if (details.phone) {
        updateData.phone = details.phone;
      }
      if (details.company) {
        updateData.company = details.company;
      }
      const targetNormalized = nameToNormalized.get(c.name);
      if (targetNormalized && !c.nameNormalized) {
        updateData.nameNormalized = targetNormalized;
      }
      if (c.deletedAt && ownerUserId) {
        Object.assign(updateData, restoreData(ownerUserId), { status: "active" });
      }

      if (Object.keys(updateData).length > 0) {
        updateData.updatedAt = new Date();
        await prisma.customer.update({
          where: { id: c.id },
          data: updateData,
        });
      }
    })
  );

  const rawNameToId = new Map<string, string>();
  for (const [raw, normalized] of nameToNormalized.entries()) {
    const entry = idByNormalized.get(normalized);
    if (entry) rawNameToId.set(raw, entry.id);
  }

  const activityCreates = Array.from(rawNameToId.entries()).map(([raw, id]) => {
    const details = nameToDetails.get(raw);
    return {
      customerId: id,
      senderId,
      action: 'demand_report',
      description: `File: ${fileName}`,
      createdAt: details?.createdAt ?? undefined,
    };
  });
  if (activityCreates.length > 0) {
    await prisma.customerActivity.createMany({ data: activityCreates });
  }

  return rawNameToId;
}

function serializeParsedDemand(record: ParsedDemandRecord) {
  return {
    ...record,
    followUpDate: record.followUpDate ? record.followUpDate.toISOString() : null,
    createdAt: record.createdAt ? record.createdAt.toISOString() : null,
  };
}

function hydrateParsedDemand(record: Record<string, unknown>): ParsedDemandRecord {
  const parseDate = (value: unknown) => {
    if (!value) return null;
    const parsed = Date.parse(String(value));
    return Number.isNaN(parsed) ? null : new Date(parsed);
  };

  return {
    customerName: typeof record.customerName === 'string' ? record.customerName : null,
    customerPhone: typeof record.customerPhone === 'string' ? record.customerPhone : null,
    customerCompany: typeof record.customerCompany === 'string' ? record.customerCompany : null,
    category: typeof record.category === 'string' ? record.category : 'demand',
    status: typeof record.status === 'string' ? record.status : 'new',
    note: typeof record.note === 'string' ? record.note : '',
    confidence: typeof record.confidence === 'number' ? record.confidence : 0.35,
    aiProvider: typeof record.aiProvider === 'string' ? record.aiProvider : 'heuristic',
    aiModel: typeof record.aiModel === 'string' ? record.aiModel : null,
    followUpDate: parseDate(record.followUpDate),
    serviceName: typeof record.serviceName === 'string' ? record.serviceName : null,
    serviceAmount: typeof record.serviceAmount === 'number' ? record.serviceAmount : null,
    serviceQty: typeof record.serviceQty === 'number' ? record.serviceQty : null,
    createdAt: parseDate(record.createdAt),
  };
}

function summarizeParsedDemands(parsedDemands: ParsedDemandRecord[]) {
  const summary = {
    total: parsedDemands.length,
    high: 0,
    medium: 0,
    low: 0,
    missingPhone: 0,
    missingCustomer: 0,
    missingService: 0,
    dueOrOverdue: 0,
  };

  parsedDemands.forEach((record) => {
    const analysis = analyzeDemandRecord(record);
    summary[analysis.priority] += 1;
    if (analysis.missingFields.includes('phone')) summary.missingPhone += 1;
    if (analysis.missingFields.includes('customerName')) summary.missingCustomer += 1;
    if (analysis.missingFields.includes('service')) summary.missingService += 1;
    if (analysis.followUpStatus === 'due' || analysis.followUpStatus === 'overdue') {
      summary.dueOrOverdue += 1;
    }
  });

  return summary;
}

async function createDemandRecordsFromParsedDemands({
  parsedDemands,
  senderId,
  telegramMessageId,
  fileName,
  sourceType = 'telegram',
  importBatchId,
  ownerUserId,
}: {
  parsedDemands: ParsedDemandRecord[];
  senderId: string;
  telegramMessageId: string;
  fileName?: string | null;
  sourceType?: string;
  importBatchId?: string | null;
  ownerUserId: string | null;
}) {
  const customerIdByName = await resolveCustomersBatch(
    parsedDemands,
    senderId,
    fileName || 'Telegram demand import',
    ownerUserId,
  );

  const demandRecordCreates: Prisma.DemandRecordUncheckedCreateInput[] = [];
  for (const parsedDemand of parsedDemands) {
    const analysis = analyzeDemandRecord(parsedDemand);
    const customerId = parsedDemand.customerName
      ? customerIdByName.get(parsedDemand.customerName) ?? null
      : null;

    demandRecordCreates.push({
      messageId: telegramMessageId,
      senderId,
      customerId,
      customerName: parsedDemand.customerName,
      category: parsedDemand.category,
      status: parsedDemand.status,
      note: parsedDemand.note,
      sourceType,
      sourceChannel: parsedDemand.sourceChannel || null,
      sourceFileName: fileName || null,
      normalizedData: serializeParsedDemand(parsedDemand),
      importBatchId: importBatchId || null,
      serviceName: parsedDemand.serviceName,
      serviceAmount: parsedDemand.serviceAmount,
      serviceQty: parsedDemand.serviceQty,
      followUpDate: parsedDemand.followUpDate,
      followUpStatus: analysis.followUpStatus,
      priority: analysis.priority,
      potentialScore: analysis.potentialScore,
      priorityReason: analysis.priorityReason,
      recommendedAction: analysis.recommendedAction,
      missingFields: analysis.missingFields,
      confidence: parsedDemand.confidence,
      aiProvider: parsedDemand.aiProvider,
      aiModel: parsedDemand.aiModel,
      createdAt: parsedDemand.createdAt || undefined,
    });
  }

  if (demandRecordCreates.length > 0) {
    await prisma.demandRecord.createMany({ data: demandRecordCreates });
  }

  return demandRecordCreates.length;
}

async function processFileInBackground({
  downloadedBuffer,
  fileInfo,
  settings,
  activeMode,
  chatId,
  telegramMessageId,
  progressMsgId,
}: {
  downloadedBuffer: Buffer;
  fileInfo: { fileName: string; mimeType: string; fileSize: number };
  settings: { userId: string | null; botToken: string | null; geminiApiKey: string | null; geminiModel: string | null };
  activeMode: string | null;
  chatId: bigint;
  telegramMessageId: string;
  progressMsgId: number | null;
}) {
  const isSpreadsheet = fileInfo.mimeType.includes("sheet") ||
    fileInfo.mimeType.includes("excel") ||
    fileInfo.mimeType.includes("csv") ||
    fileInfo.fileName.endsWith(".xlsx") ||
    fileInfo.fileName.endsWith(".xls") ||
    fileInfo.fileName.endsWith(".xlsm") ||
    fileInfo.fileName.endsWith(".csv");

  try {
    type ImportKind = 'finance' | 'product_catalog' | 'marketing_metrics' | 'sales_orders' | 'customer_service';
    let importKind: ImportKind | null = null;
    let parsedFinanceRecords: FinanceRecord[] = [];
    let parsedProductRows: ParsedProductRow[] = [];
    let parsedMarketingRows: ParsedMarketingRow[] = [];
    let parsedSalesRows: ParsedSalesOrderRow[] = [];
    let parsedCsRows: ParsedCustomerServiceRow[] = [];

  if (isSpreadsheet) {
    try {
      const workbook = XLSX.read(downloadedBuffer, { type: 'buffer', cellDates: true });
      if (workbook.SheetNames.length > 0) {
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, { header: 1 });
        if (rows.length > 0 && Array.isArray(rows[0])) {
          const headers = rows[0].map(h => String(h || ''));
          // Most-specific first: CS before sales (a CS sheet with order
          // columns would otherwise match sales and lose CSAT/follow-up
          // data); finance last as the least-specific fallback.
          if (isCustomerServiceHeaders(headers)) importKind = 'customer_service';
          else if (isSalesOrdersHeaders(headers)) importKind = 'sales_orders';
          else if (isMarketingMetricsHeaders(headers)) importKind = 'marketing_metrics';
          else if (isProductCatalogHeaders(headers)) importKind = 'product_catalog';
          else if (isFinanceRecordsHeaders(headers)) importKind = 'finance';
        }
      }
    } catch (err) {
      console.error("Error checking headers for spreadsheet types:", err);
    }

    // Mode-based fallback when header sniffing could not classify the file.
    if (!importKind && activeMode === 'finance_transactions') importKind = 'finance';
    else if (!importKind && activeMode === 'demand_report') importKind = 'sales_orders';
    else if (!importKind && activeMode === 'inventory_import') importKind = 'product_catalog';
    else if (!importKind && activeMode === 'marketing_import') importKind = 'marketing_metrics';
    else if (!importKind && activeMode === 'customer_service') importKind = 'customer_service';

    try {
      switch (importKind) {
        case 'finance':
          parsedFinanceRecords = parseFinanceRecordsSpreadsheet(downloadedBuffer);
          break;
        case 'product_catalog':
          parsedProductRows = parseProductCatalogRows(downloadedBuffer);
          break;
        case 'marketing_metrics':
          parsedMarketingRows = parseMarketingMetricsRows(downloadedBuffer);
          break;
        case 'sales_orders':
          parsedSalesRows = parseSalesOrderRows(downloadedBuffer);
          break;
        case 'customer_service':
          parsedCsRows = parseCustomerServiceRows(downloadedBuffer);
          break;
      }
    } catch (err) {
      console.error(`Error parsing ${importKind} spreadsheet:`, err);
    }
  }

  if (importKind) {
    const parsedRowCount =
      importKind === 'finance' ? parsedFinanceRecords.length :
      importKind === 'product_catalog' ? parsedProductRows.length :
      importKind === 'marketing_metrics' ? parsedMarketingRows.length :
      importKind === 'customer_service' ? parsedCsRows.length :
      parsedSalesRows.length;

    if (!settings.userId) {
      throw new Error("Commerce file import requires a linked business owner user.");
    }

    if (parsedRowCount === 0) {
      const emptyText = [
        "⚠️ <b>ဖိုင်ထဲတွင် တင်သွင်းနိုင်သော အချက်အလက် မတွေ့ပါ။</b>",
        "━━━━━━━━━━━━━━━━━━━━",
        `📄 <b>ဖိုင်အမည်:</b> <code>${fileInfo.fileName}</code>`,
        "",
        getExpectedColumnsHint(importKind),
      ].join("\n");
      await sendOrEditMessage({ botToken: settings.botToken, chatId, progressMsgId, text: emptyText });
      return;
    }

    let createdCount = 0;
    let duplicateCount = 0;
    let restoredCount = 0;
    let skippedCount = 0;
    let financeExpenseCount = 0;
    let financeIncomeCount = 0;
    // Stable per-row keys so re-processing the same file (retry,
    // re-upload — same bytes, same keys) skips already-imported rows
    // instead of duplicating them. The telegram channel namespace keeps
    // these keys isolated from web imports of the same file.
    const tgKeys = (rows: unknown[]) =>
      fingerprintImportRows({ channel: "telegram", channelRef: sha256Hex(downloadedBuffer), kind: importKind!, rows });
    if (importKind === 'finance') {
      const financeKeys = tgKeys(parsedFinanceRecords);
      const outcomes = await Promise.all(parsedFinanceRecords.map((rec, idx) => createFinanceRecord({
        record: rec,
        userId: settings.userId!,
        sourceMessageId: telegramMessageId,
        importKey: financeKeys[idx],
      })));
      financeExpenseCount = outcomes.filter((o) => o === "expense").length;
      financeIncomeCount = outcomes.filter((o) => o === "ledger").length;
      duplicateCount = outcomes.filter((o) => o === "duplicate").length;
      restoredCount = outcomes.filter((o) => o === "restored").length;
      skippedCount = outcomes.filter((o) => o === "skipped").length;
      createdCount = financeExpenseCount + financeIncomeCount;
    } else if (importKind === 'product_catalog') {
      const res = await upsertProductsFromRows(parsedProductRows, settings.userId);
      createdCount = res.imported;
      duplicateCount = res.duplicates;
      restoredCount = res.restored;
    } else if (importKind === 'marketing_metrics') {
      const res = await createMarketingMetricsFromRows(parsedMarketingRows, settings.userId, tgKeys(parsedMarketingRows));
      createdCount = res.imported;
      duplicateCount = res.duplicates;
      restoredCount = res.restored;
    } else if (importKind === 'sales_orders') {
      const res = await createSalesOrdersFromRows(parsedSalesRows, settings.userId, undefined, tgKeys(parsedSalesRows));
      createdCount = res.imported;
      duplicateCount = res.duplicates;
      restoredCount = res.restored;
    } else if (importKind === 'customer_service') {
      const res = await createCustomerServiceRecordsFromRows(parsedCsRows, settings.userId, undefined, tgKeys(parsedCsRows));
      createdCount = res.imported;
      duplicateCount = res.duplicates;
      restoredCount = res.restored;
    }

    const duplicateNote = duplicateCount > 0
      ? `\n🔁 <b>ထပ်နေသော:</b> <code>${duplicateCount}</code> စောင် ကျော်သွားပါသည်။`
      : "";
    const restoredNote = restoredCount > 0
      ? `\n♻️ <b>ပြန်လည်ရရှိသော:</b> <code>${restoredCount}</code> စောင် Trash မှ ပြန်ပေါ်လာပါသည်။`
      : "";
    const skippedNote = skippedCount > 0
      ? `\n⏭️ <b>ကျော်သွားသော (amount 0):</b> <code>${skippedCount}</code> စောင် မသိမ်းဆည်းပါ။`
      : "";
    const successTitle: Record<ImportKind, string> = {
      finance: "✅ <b>ဘဏ္ဍာရေး ငွေသွင်း/ငွေထုတ် မှတ်တမ်းများ တင်သွင်းပြီးပါပြီ</b>",
      product_catalog: "✅ <b>Product Catalog / Inventory တင်သွင်းပြီးပါပြီ</b>",
      marketing_metrics: "✅ <b>Marketing Metrics တင်သွင်းပြီးပါပြီ</b>",
      sales_orders: "✅ <b>Sales Orders တင်သွင်းပြီးပါပြီ</b>",
      customer_service: "✅ <b>Customer Service မှတ်တမ်းများ တင်သွင်းပြီးပါပြီ</b>",
    };
    const successBody: Record<ImportKind, string> = {
      finance: `📊 <b>အရေအတွက်:</b> <code>${createdCount}</code> စောင် (Expense <code>${financeExpenseCount}</code> · Income <code>${financeIncomeCount}</code>) ကို Commerce Finance ထဲသို့ မှတ်တမ်းတင်ပြီးပါပြီ။${duplicateNote}${restoredNote}${skippedNote}`,
      product_catalog: `📦 <b>အရေအတွက်:</b> <code>${createdCount}</code> ခုကို Inventory ထဲသို့ update လုပ်ပြီးပါပြီ။${duplicateNote}${restoredNote}`,
      marketing_metrics: `📈 <b>အရေအတွက်:</b> <code>${createdCount}</code> ခုကို Marketing Metrics ထဲသို့ မှတ်တမ်းတင်ပြီးပါပြီ။${duplicateNote}${restoredNote}`,
      sales_orders: `🛒 <b>အရေအတွက်:</b> <code>${createdCount}</code> orders ကို Sales module ထဲသို့ မှတ်တမ်းတင်ပြီးပါပြီ။${duplicateNote}${restoredNote}`,
      customer_service: `🎧 <b>အရေအတွက်:</b> <code>${createdCount}</code> ခုကို Customer Service ထဲသို့ မှတ်တမ်းတင်ပြီးပါပြီ။${duplicateNote}${restoredNote}`,
    };

    if (progressMsgId) {
      await editTelegramMessage({
        botToken: settings.botToken,
        chatId,
        messageId: progressMsgId,
        text: [
          successTitle[importKind],
          "━━━━━━━━━━━━━━━━━━━━",
          `📄 <b>ဖိုင်အမည်:</b> <code>${fileInfo.fileName}</code>`,
          successBody[importKind],
        ].join("\n"),
      });
    }
    return;
  }

  const unsupportedText = [
    "⚠️ <b>ဒီဖိုင်အမျိုးအစားကို တင်သွင်း၍ မရပါ။</b>",
    "━━━━━━━━━━━━━━━━━━━━",
    `📄 <b>ဖိုင်အမည်:</b> <code>${fileInfo.fileName}</code>`,
    "",
    "လက်ရှိ support လုပ်သော Excel/CSV formats:",
    "• Finance Transactions — Date, Description, Category, Type, Amount (MMK), Payment Method, Reference, Notes",
    "• Product Catalog — Product Code, Product Name, Category, Unit Cost, Selling Price, Stock Qty, Low Stock Threshold",
    "• Marketing Metrics — Date, Channel, Spend, Reach, Impressions, Ad-driven Orders, Notes",
    "• Sales Orders — Date, Customer Name, Phone, Product Name, Product Code, Quantity, Unit Price, Stage, Fulfillment Status, Notes",
    "• Customer Service — Date, Customer Name, Company, Phone, Email, Purchased Product, Purchase Amount (MMK), Status, Next Follow Up, CSAT, Last Contact Note",
  ].join("\n");
  await sendOrEditMessage({ botToken: settings.botToken, chatId, progressMsgId, text: unsupportedText });
  } catch (err) {
    console.error('Background file processing error:', err);
    const errMessage = err instanceof Error ? err.message : String(err);
    const errorText = [
      "❌ <b>ဖိုင်ဆန်းစစ်ရာတွင် ချို့ယွင်းချက် ဖြစ်ပေါ်ခဲ့ပါသည်</b>",
      "━━━━━━━━━━━━━━━━━━━━",
      `📄 <b>ဖိုင်အမည်:</b> <code>${fileInfo.fileName}</code>`,
      "⚠️ <b>အခြေအနေ:</b> နည်းပညာဆိုင်ရာ ချို့ယွင်းချက် ဖြစ်ပေါ်ခဲ့ပါသည်။ ကျေးဇူးပြု၍ ပြန်လည်ကြိုးစားပေးပါရန်။",
      "",
      "🔍 <b>အသေးစိတ် ချို့ယွင်းချက်:</b>",
      `<code>${errMessage}</code>`,
    ].join("\n");
    await sendOrEditMessage({ botToken: settings.botToken, chatId, progressMsgId, text: errorText });
  }
}

function getExpectedColumnsHint(kind: 'finance' | 'product_catalog' | 'marketing_metrics' | 'sales_orders' | 'customer_service'): string {
  switch (kind) {
    case 'finance':
      return "💡 Columns: Date • Description • Category • Type • Amount (MMK) • Payment Method • Reference • Notes";
    case 'product_catalog':
      return "💡 Columns: Product Code • Product Name • Category • Unit Cost • Selling Price • Stock Qty • Low Stock Threshold";
    case 'marketing_metrics':
      return "💡 Columns: Date • Channel • Spend • Reach • Impressions • Ad-driven Orders • Notes";
    case 'sales_orders':
      return "💡 Columns: Date • Customer Name • Phone • Product Name • Product Code • Quantity • Unit Price • Stage • Fulfillment Status • Notes";
    case 'customer_service':
      return "💡 Columns: Date • Customer Name • Company • Phone • Email • Purchased Product • Purchase Amount (MMK) • Status • Next Follow Up • CSAT • Last Contact Note";
  }
}

async function sendOrEditMessage({
  botToken,
  chatId,
  progressMsgId,
  text,
}: {
  botToken: string | null | undefined;
  chatId: bigint;
  progressMsgId: number | null;
  text: string;
}) {
  if (progressMsgId) {
    await editTelegramMessage({ botToken, chatId, messageId: progressMsgId, text });
  } else {
    await sendTelegramMessage({ botToken, chatId, text });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const settings = await getActiveBotSettings(req);
    if (!settings?.botToken) {
      return NextResponse.json({ message: "Unauthorized bot webhook" }, { status: 401 });
    }
    const callbackQuery = body.callback_query;

    // ─── Handle Callback Queries (Button presses) ─────────────────────
    if (callbackQuery?.data && callbackQuery.from) {
      const sender = await upsertSender(callbackQuery.from, settings.userId);
      const chatId = callbackQuery.message?.chat?.id;
      const messageId = callbackQuery.message?.message_id;
      const data = callbackQuery.data;

      // ─── Guard: Check Authorization ─────────────────────────────────
      const isAuthorized = await checkAuthorization(sender, settings?.botToken, chatId ? BigInt(chatId) : 0);
      if (!isAuthorized) {
        await answerCallbackQuery(settings?.botToken, callbackQuery.id, 'Unauthorized');
        return NextResponse.json({ ok: true });
      }

      if (data.startsWith('demand_import_confirm:')) {
        const pendingId = data.replace('demand_import_confirm:', '');
        // Bound to the confirming sender AND this bot's owner: a leaked or
        // guessed pendingId from another sender/bot can never be imported here.
        const pending = await prisma.pendingDemandImport.findFirst({
          where: { id: pendingId, senderId: sender.id, sender: { userId: settings.userId } },
        });

        if (!pending || (chatId && Number(pending.chatId) !== Number(chatId))) {
          await answerCallbackQuery(settings?.botToken, callbackQuery.id, 'Preview not found');
          return NextResponse.json({ ok: true });
        }

        if (pending.status !== 'pending') {
          await answerCallbackQuery(settings?.botToken, callbackQuery.id, `Already ${pending.status}`);
          return NextResponse.json({ ok: true });
        }

        if (pending.expiresAt < new Date()) {
          await prisma.pendingDemandImport.update({
            where: { id: pending.id },
            data: { status: 'expired' },
          });
          await answerCallbackQuery(settings?.botToken, callbackQuery.id, 'Preview expired');
          if (chatId && messageId) {
            await editTelegramMessage({
              botToken: settings?.botToken,
              chatId: BigInt(chatId),
              messageId,
              text: [
                "⌛ <b>Sales & Marketing file preview expired</b>",
                "━━━━━━━━━━━━━━━━━━━━",
                `📎 <b>File:</b> <code>${escapeHtml(pending.fileName)}</code>`,
                "ကျေးဇူးပြု၍ file ကိုပြန်ပို့ပြီး preview အသစ်လုပ်ပါ။",
              ].join("\n"),
            });
          }
          return NextResponse.json({ ok: true });
        }

        const rows = Array.isArray(pending.parsedRows)
          ? pending.parsedRows.map((row) => hydrateParsedDemand(row as Record<string, unknown>))
          : [];

        if (rows.length === 0) {
          await prisma.pendingDemandImport.update({
            where: { id: pending.id },
            data: { status: 'cancelled' },
          });
          await answerCallbackQuery(settings?.botToken, callbackQuery.id, 'No rows to import');
          return NextResponse.json({ ok: true });
        }

        const importBatch = await prisma.demandImportBatch.create({
          data: {
            fileName: pending.fileName,
            fileType: pending.fileType,
            status: 'imported',
            source: 'telegram_file',
            detectedColumns: Prisma.JsonNull,
            columnMapping: Prisma.JsonNull,
            rowCount: rows.length,
            importedCount: 0,
            uploadedByUserId: settings.userId,
          },
        });

        await prisma.qADocument.create({
          data: {
            userId: settings.userId,
            title: `📎 ${pending.fileName}`,
            content: pending.extractedText.slice(0, 10000),
            source: 'telegram_file',
            fileType: pending.fileType,
            fileName: pending.fileName,
            senderId: pending.senderId,
          },
        });

        const importedCount = await createDemandRecordsFromParsedDemands({
          parsedDemands: rows,
          senderId: pending.senderId,
          telegramMessageId: pending.messageId,
          fileName: pending.fileName,
          sourceType: 'telegram_file',
          importBatchId: importBatch.id,
          ownerUserId: settings.userId,
        });

        await Promise.all([
          prisma.demandImportBatch.update({
            where: { id: importBatch.id },
            data: { importedCount },
          }),
          prisma.pendingDemandImport.update({
            where: { id: pending.id },
            data: { status: 'confirmed' },
          }),
        ]);

        const summary = summarizeParsedDemands(rows);
        await answerCallbackQuery(settings?.botToken, callbackQuery.id, `Imported ${importedCount} records`);
        if (chatId && messageId) {
          await editTelegramMessage({
            botToken: settings?.botToken,
            chatId: BigInt(chatId),
            messageId,
            text: [
              "✅ <b>Sales & Marketing file imported</b>",
              "━━━━━━━━━━━━━━━━━━━━",
              `📎 <b>File:</b> <code>${escapeHtml(pending.fileName)}</code>`,
              `📊 <b>Imported:</b> <code>${importedCount}</code> records`,
              "",
              "🎯 <b>Priority summary</b>",
              `• High: <b>${summary.high}</b>`,
              `• Medium: <b>${summary.medium}</b>`,
              `• Low: <b>${summary.low}</b>`,
              "",
              "Dashboard မှာ Sales & Marketing records ကိုကြည့်ပြီး priority/action တွေကို ဆက်လုပ်နိုင်ပါပြီ။",
            ].join("\n"),
          });
        }
        return NextResponse.json({ ok: true });
      }

      if (data.startsWith('demand_import_cancel:')) {
        const pendingId = data.replace('demand_import_cancel:', '');
        // Same binding as confirm: only the owning sender on this bot's
        // owner can cancel a preview (prevents cross-user cancel DoS).
        const pending = await prisma.pendingDemandImport.findFirst({
          where: { id: pendingId, senderId: sender.id, sender: { userId: settings.userId } },
        });

        if (!pending || (chatId && Number(pending.chatId) !== Number(chatId))) {
          await answerCallbackQuery(settings?.botToken, callbackQuery.id, 'Preview not found');
          return NextResponse.json({ ok: true });
        }

        await prisma.pendingDemandImport.update({
          where: { id: pending.id },
          data: { status: 'cancelled' },
        });

        await answerCallbackQuery(settings?.botToken, callbackQuery.id, 'Import cancelled');
        if (chatId && messageId) {
          await editTelegramMessage({
            botToken: settings?.botToken,
            chatId: BigInt(chatId),
            messageId,
            text: [
              "❌ <b>Sales & Marketing file import cancelled</b>",
              "━━━━━━━━━━━━━━━━━━━━",
              `📎 <b>File:</b> <code>${escapeHtml(pending.fileName)}</code>`,
              "Dashboard ထဲသို့ data မသွင်းထားပါ။ File ကိုပြင်ပြီးပြန်ပို့နိုင်ပါသည်။",
            ].join("\n"),
          });
        }
        return NextResponse.json({ ok: true });
      }

      if (data === 'mode:qa') {
        await prisma.telegramSender.update({
          where: { id: sender.id },
          data: { activeReportType: 'qa' },
        });
        await answerCallbackQuery(settings?.botToken, callbackQuery.id, '✅ Q&A Mode selected');
        if (chatId && messageId) {
          await editTelegramMessage({
            botToken: settings?.botToken,
            chatId: BigInt(chatId),
            messageId,
            text: [
              "🤖 ━━━━━━━━━━━━━━━━━━━━",
              "",
              "  <b>Q&A Mode — အသက်ဝင်ပါပြီ</b>",
              "",
              "━━━━━━━━━━━━━━━━━━━━",
              "",
              "Gemini AI မှ လုပ်ငန်းဒေတာကို",
              "အခြေခံ၍ ဖြေကြားပေးမည်။",
              "",
              "💬 <b>ဥပမာများ:</b>",
              "",
              "  • <i>ဒီလမှာ အရောင်းရငွေ ဘယ်လောက်ရှိလဲ?</i>",
              "  • <i>ပြတ်နေတဲ့ ပစ္စည်း ဘာတွေရှိလဲ?</i>",
              "  • <i>Follow-up လုပ်ရမယ့် customer ရှိလား?</i>",
              "",
              "━━━━━━━━━━━━━━━━━━━━",
            ].join("\n"),
            replyMarkup: {
              inline_keyboard: [
                [{ text: "↩️ Main Menu", callback_data: "action:menu" }]
              ]
            }
          });
        }
        return NextResponse.json({ ok: true });
      }

      if (data === 'mode:demand_report') {
        await prisma.telegramSender.update({
          where: { id: sender.id },
          data: { activeReportType: 'demand_report' },
        });
        await answerCallbackQuery(settings?.botToken, callbackQuery.id, '✅ Sales Orders selected');
        if (chatId && messageId) {
          await editTelegramMessage({
            botToken: settings?.botToken,
            chatId: BigInt(chatId),
            messageId,
            text: getFormatPrompt(),
            replyMarkup: buildFormatInlineButtons('demand_report'),
          });
        }
        return NextResponse.json({ ok: true });
      }

      if (data === 'mode:customer_service') {
        await prisma.telegramSender.update({
          where: { id: sender.id },
          data: { activeReportType: 'customer_service' },
        });
        await answerCallbackQuery(settings?.botToken, callbackQuery.id, '✅ Customer Service selected');
        if (chatId && messageId) {
          await editTelegramMessage({
            botToken: settings?.botToken,
            chatId: BigInt(chatId),
            messageId,
            text: getCustomerServiceFormatPrompt(),
            replyMarkup: buildFormatInlineButtons('customer_service'),
          });
        }
        return NextResponse.json({ ok: true });
      }

      if (data === 'mode:finance_transactions') {
        await prisma.telegramSender.update({
          where: { id: sender.id },
          data: { activeReportType: 'finance_transactions' },
        });
        await answerCallbackQuery(settings?.botToken, callbackQuery.id, '✅ Finance Transactions selected');
        if (chatId && messageId) {
          await editTelegramMessage({
            botToken: settings?.botToken,
            chatId: BigInt(chatId),
            messageId,
            text: getFinanceTransactionsFormatPrompt(),
            replyMarkup: buildFormatInlineButtons('finance_transactions'),
          });
        }
        return NextResponse.json({ ok: true });
      }

      if (data === 'mode:inventory_import') {
        await prisma.telegramSender.update({
          where: { id: sender.id },
          data: { activeReportType: 'inventory_import' },
        });
        await answerCallbackQuery(settings?.botToken, callbackQuery.id, '✅ Inventory / Products selected');
        if (chatId && messageId) {
          await editTelegramMessage({
            botToken: settings?.botToken,
            chatId: BigInt(chatId),
            messageId,
            text: getInventoryImportFormatPrompt(),
            replyMarkup: buildFormatInlineButtons('inventory_import'),
          });
        }
        return NextResponse.json({ ok: true });
      }

      if (data === 'mode:marketing_import') {
        await prisma.telegramSender.update({
          where: { id: sender.id },
          data: { activeReportType: 'marketing_import' },
        });
        await answerCallbackQuery(settings?.botToken, callbackQuery.id, '✅ Marketing Metrics selected');
        if (chatId && messageId) {
          await editTelegramMessage({
            botToken: settings?.botToken,
            chatId: BigInt(chatId),
            messageId,
            text: getMarketingImportFormatPrompt(),
            replyMarkup: buildFormatInlineButtons('marketing_import'),
          });
        }
        return NextResponse.json({ ok: true });
      }

      if (data === 'mode:project_expiry' || data === 'mode:website_update' || data === 'mode:business_report') {
        await prisma.telegramSender.update({
          where: { id: sender.id },
          data: { activeReportType: 'none' },
        });
        await answerCallbackQuery(settings?.botToken, callbackQuery.id, 'This legacy mode was removed');
        if (chatId && messageId) {
          await editTelegramMessage({
            botToken: settings?.botToken,
            chatId: BigInt(chatId),
            messageId,
            text: [
              "⚠️ <b>ဒီ legacy Service-only mode ကို BAI-Commerce မှာဖယ်ထားပါပြီ။</b>",
              "",
              "ကျေးဇူးပြု၍ Commerce mode တစ်ခုရွေးပါ။",
            ].join("\n"),
            replyMarkup: buildMainMenuButtons(sender.allowedDepartments),
          });
        }
        return NextResponse.json({ ok: true });
      }

      if (data === 'action:template') {
        const templateText = getCopyPasteTemplateForMode(sender.activeReportType);
        await answerCallbackQuery(settings?.botToken, callbackQuery.id, '✅ Copy template below');
        
        await sendTelegramMessage({
          botToken: settings?.botToken,
          chatId,
          text: templateText,
          replyMarkup: {
            inline_keyboard: [
              [{ text: "↩️ Back to Menu", callback_data: "action:menu" }]
            ]
          }
        });
        return NextResponse.json({ ok: true });
      }

      if (data === 'action:menu') {
        await prisma.telegramSender.update({
          where: { id: sender.id },
          data: { activeReportType: 'none' },
        });
        await answerCallbackQuery(settings?.botToken, callbackQuery.id, 'Main Menu');
        const allowedButtons = buildMainMenuButtons(sender.allowedDepartments);
        
        if (chatId && messageId) {
          await editTelegramMessage({
            botToken: settings?.botToken,
            chatId: BigInt(chatId),
            messageId,
            text: [
              "👋 ━━━━━━━━━━━━━━━━━━━━",
              "",
              `  <b>မင်္ဂလာပါ ${sender.displayName || 'ခင်ဗျာ/ရှင်'}</b>`,
              "",
              "━━━━━━━━━━━━━━━━━━━━",
              "",
              "အောက်ပါ Menu မှ လုပ်ဆောင်လိုသည့်",
              "လုပ်ငန်းစဉ်အမျိုးအစားကို ရွေးချယ်ပါ။",
            ].join("\n"),
            replyMarkup: allowedButtons,
          });
        }
        return NextResponse.json({ ok: true });
      }

      return NextResponse.json({ ok: true });
    }

    // ─── Handle Messages (text + files) ────────────────────────────────
    const message = body.message;
    if (!message) {
      return NextResponse.json({ ok: true });
    }

    const fileInfo = getFileInfoFromMessage(message);
    const hasText = !!message.text;
    const hasFile = !!fileInfo;

    if (!hasText && !hasFile) {
      return NextResponse.json({ ok: true });
    }

    const from = message.from;
    if (!from) return NextResponse.json({ ok: true });

    const sender = await upsertSender(from, settings.userId);
    const chatId = BigInt(message.chat.id);

    // ─── Handle Auth & OTP Command States (Bypasses general authorization) ──
    if (message.text) {
      const text = message.text.trim();

      // 1. Command: /unlink (Unlinks current account)
      if (text === '/unlink') {
        await prisma.telegramSender.update({
          where: { id: sender.id },
          data: {
            email: null,
            isVerified: false,
            isAuthorized: false,
            activeReportType: 'none',
            otpCode: null,
            otpExpiresAt: null,
          },
        });
        await sendTelegramMessage({
          botToken: settings?.botToken,
          chatId,
          text: [
            "🔓 ━━━━━━━━━━━━━━━━━━━━",
            "",
            "  <b>အကောင့် ချိတ်ဆက်မှု ဖြုတ်ပြီးပါပြီ</b>",
            "",
            "━━━━━━━━━━━━━━━━━━━━",
            "",
            "ယခု Telegram account ကို စနစ်မှ",
            "အောင်မြင်စွာ ဖြုတ်လိုက်ပြီး ဖြစ်သည်။",
          ].join("\n"),
          replyMarkup: KEYBOARD_UNLINKED,
        });
        return NextResponse.json({ ok: true });
      }

      // 2. Command: /link (Starts verification process)
      if (text === '/link') {
        await prisma.telegramSender.update({
          where: { id: sender.id },
          data: { activeReportType: 'awaiting_email' },
        });
        await sendTelegramMessage({
          botToken: settings?.botToken,
          chatId,
          text: [
            "🔐 ━━━━━━━━━━━━━━━━━━━━",
            "",
            "  <b>အကောင့် ချိတ်ဆက်ခြင်း</b>",
            "",
            "━━━━━━━━━━━━━━━━━━━━",
            "",
            "စနစ်တွင် စာရင်းသွင်းထားသော",
            "သင့်ဝန်ထမ်း အီးမေးလ်ကို ရိုက်ထည့်ပေးပါ။",
          ].join("\n"),
          replyMarkup: KEYBOARD_UNLINKED,
        });
        return NextResponse.json({ ok: true });
      }

      // 3. State: Awaiting Email input
      if (sender.activeReportType === 'awaiting_email') {
        const email = text;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(email)) {
          await sendTelegramMessage({
            botToken: settings?.botToken,
            chatId,
            text: [
              "⚠️ ━━━━━━━━━━━━━━━━━━━━",
              "",
              "  <b>အီးမေးလ် ပုံစံမမှန်ပါ</b>",
              "",
              "━━━━━━━━━━━━━━━━━━━━",
              "",
              "ကျေးဇူးပြု၍ အီးမေးလ် မှန်ကန်စွာ ရိုက်ထည့်ပါ။",
              "ဥပမာ: <code>name@company.com</code>",
            ].join("\n"),
            replyMarkup: KEYBOARD_UNLINKED,
          });
          return NextResponse.json({ ok: true });
        }

        const normalizedEmail = email.toLowerCase().trim();

        // Find a pre-registered TelegramSender where either:
        // 1. email matches and telegramUserId is NULL
        // 2. email matches and telegramUserId matches the sender's telegramUserId
        const preRegisteredSender = await prisma.telegramSender.findFirst({
          where: {
            userId: settings.userId,
            email: normalizedEmail,
            OR: [
              { telegramUserId: null },
              { telegramUserId: sender.telegramUserId },
            ],
          },
        });

        if (!preRegisteredSender) {
          await sendTelegramMessage({
            botToken: settings?.botToken,
            chatId,
            text: [
              "❌ ━━━━━━━━━━━━━━━━━━━━",
              "",
              "  <b>ဝင်ရောက်ခွင့်မရှိပါ</b>",
              "",
              "━━━━━━━━━━━━━━━━━━━━",
              "",
              `ဤအီးမေးလ် <code>${email}</code> ကို Staff Bot Access တွင်`,
              "Business Owner မှ ကြိုတင်ထည့်သွင်းထားခြင်း မရှိပါ။",
              "",
              "💡 <i>ကျေးဇူးပြု၍ သင့်လုပ်ငန်းတာဝန်ရှိသူအား</i>",
              "<i>Staff Bot Access တွင် စာရင်းသွင်းပေးရန် ပြောပါ။</i>",
            ].join("\n"),
            replyMarkup: KEYBOARD_UNLINKED,
          });
          return NextResponse.json({ ok: true });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

        await prisma.telegramSender.update({
          where: { id: sender.id },
          data: {
            email: normalizedEmail,
            otpCode: otp,
            otpExpiresAt,
            activeReportType: 'awaiting_otp',
            isVerified: false,
          },
        });

        const emailSent = await sendOTPEmail(email, otp);
        if (emailSent) {
          // Mask email for display e.g. kc***@gmail.com
          const atIndex = email.indexOf('@');
          let maskedEmail = email;
          if (atIndex > 2) {
            maskedEmail = email.slice(0, 2) + '***' + email.slice(atIndex);
          }

          await sendTelegramMessage({
            botToken: settings?.botToken,
            chatId,
            text: [
              "📩 ━━━━━━━━━━━━━━━━━━━━",
              "",
              "  <b>အတည်ပြုကုဒ် ပို့ပြီးပါပြီ</b>",
              "",
              "━━━━━━━━━━━━━━━━━━━━",
              "",
              `သင့်အီးမေးလ် <code>${maskedEmail}</code> သို့`,
              "ဂဏန်း ၆ လုံးပါ OTP ပို့ပေးထားပါသည်။",
              "",
              "📝 <b>လုပ်ဆောင်ရန်:</b>",
              "  ရရှိလာသော အတည်ပြုကုဒ်ကို ရိုက်ပို့ပါ။",
            ].join("\n"),
            replyMarkup: KEYBOARD_UNLINKED,
          });
        } else {
          await sendTelegramMessage({
            botToken: settings?.botToken,
            chatId,
            text: [
              "❌ ━━━━━━━━━━━━━━━━━━━━",
              "",
              "  <b>အီးမေးလ် မပို့နိုင်ပါ</b>",
              "",
              "━━━━━━━━━━━━━━━━━━━━",
              "",
              "အီးမေးလ်ပို့ခြင်း မအောင်မြင်ပါ။",
              "Business Owner အား ဆက်သွယ်ပါ။",
            ].join("\n"),
            replyMarkup: KEYBOARD_UNLINKED,
          });
        }
        return NextResponse.json({ ok: true });
      }

      // 4. State: Awaiting OTP input
      if (sender.activeReportType === 'awaiting_otp') {
        const code = text;

        if (!code || !/^\d{6}$/.test(code)) {
          await sendTelegramMessage({
            botToken: settings?.botToken,
            chatId,
            text: [
              "⚠️ ━━━━━━━━━━━━━━━━━━━━",
              "",
              "  <b>ကုဒ် ပုံစံမမှန်ပါ</b>",
              "",
              "━━━━━━━━━━━━━━━━━━━━",
              "",
              "ဂဏန်း ၆ လုံးပါသော OTP ကို ရိုက်ပို့ပါ။",
            ].join("\n"),
            replyMarkup: KEYBOARD_UNLINKED,
          });
          return NextResponse.json({ ok: true });
        }

        if (sender.otpCode !== code || !sender.otpExpiresAt || sender.otpExpiresAt < new Date()) {
          await sendTelegramMessage({
            botToken: settings?.botToken,
            chatId,
            text: [
              "❌ ━━━━━━━━━━━━━━━━━━━━",
              "",
              "  <b>အတည်ပြုခြင်း မအောင်မြင်ပါ</b>",
              "",
              "━━━━━━━━━━━━━━━━━━━━",
              "",
              "ကုဒ်မှားယွင်းနေပါသည် သို့မဟုတ်",
              "သက်တမ်းကုန်ဆုံးသွားပါပြီ။",
            ].join("\n"),
            replyMarkup: KEYBOARD_UNLINKED,
          });
          return NextResponse.json({ ok: true });
        }

        // Verification Success
        const preRegistered = await prisma.telegramSender.findFirst({
          where: {
            userId: settings.userId,
            email: sender.email,
            OR: [
              { telegramUserId: null },
              { telegramUserId: sender.telegramUserId },
            ],
          },
        });

        if (preRegistered) {
          const displayName = displayNameFromTelegramUser(from);
          if (preRegistered.id !== sender.id) {
            // Merge the pre-registered record's permissions INTO the active
            // Telegram sender (which already owns messages, demand records, etc.)
            // then delete the empty placeholder to avoid duplicates.
            await prisma.telegramSender.update({
              where: { id: sender.id },
              data: {
                firstName: from.first_name || "Unknown",
                lastName: from.last_name || null,
                username: from.username || null,
                displayName: displayName || "Unknown",
                userId: settings.userId,
                email: sender.email,
                isVerified: true,
                isAuthorized: preRegistered.isAuthorized,
                allowedDepartments: preRegistered.allowedDepartments,
                activeReportType: 'none',
                otpCode: null,
                otpExpiresAt: null,
              },
            });

            // Delete the empty pre-registered placeholder (no linked data)
            await prisma.telegramSender.delete({
              where: { id: preRegistered.id },
            });
          } else {
            // They were already on the same record (e.g. re-linking)
            await prisma.telegramSender.update({
              where: { id: sender.id },
              data: {
                isVerified: true,
                isAuthorized: true,
                activeReportType: 'none',
                otpCode: null,
                otpExpiresAt: null,
              },
            });
          }
        }

        await sendTelegramMessage({
          botToken: settings?.botToken,
          chatId,
          text: [
            "✅ ━━━━━━━━━━━━━━━━━━━━",
            "",
            "  <b>အကောင့် ချိတ်ဆက်ပြီးပါပြီ</b>",
            "",
            "━━━━━━━━━━━━━━━━━━━━",
            "",
            `အီးမေးလ်: <code>${sender.email}</code>`,
            "အတည်ပြု ချိတ်ဆက်ခြင်း အောင်မြင်ပါသည်။",
            "",
            "💡 <i>အောက်ခြေရှိ Menu မှတစ်ဆင့်</i>",
            "<i>လုပ်ငန်းစဉ်များကို စတင်ဆောင်ရွက်နိုင်ပါပြီ။</i>",
          ].join("\n"),
          replyMarkup: KEYBOARD_LINKED,
        });
        return NextResponse.json({ ok: true });
      }
    }

    // ─── Guard: Check General Authorization ───────────────────────────
    const isAuthorized = await checkAuthorization(sender, settings?.botToken, chatId);
    if (!isAuthorized) {
      return NextResponse.json({ ok: true });
    }

    // Guard: Check if sender has any allowed departments
    if (!sender.allowedDepartments || sender.allowedDepartments.length === 0) {
      await sendTelegramMessage({
        botToken: settings?.botToken,
        chatId,
        text: [
          "⏳ ━━━━━━━━━━━━━━━━━━━━",
          "",
          "  <b>ခွင့်ပြုချက် စောင့်ဆိုင်းနေပါသည်</b>",
          "",
          "━━━━━━━━━━━━━━━━━━━━",
          "",
          `အီးမေးလ်: <code>${sender.email}</code> (အတည်ပြုပြီး)`,
          "",
          "စနစ်ကိုသုံးရန် မည်သည့်ဌာနအတွက်မျှ",
          "ခွင့်ပြုချက် မရရှိသေးပါ။",
          "",
          "💡 <i>ကျေးဇူးပြု၍ Business Owner အား</i>",
          "<i>ဆက်သွယ်ပြီး ခွင့်ပြုချက် တောင်းဆိုပါ။</i>",
        ].join("\n"),
        replyMarkup: KEYBOARD_UNLINKED,
      });
      return NextResponse.json({ ok: true });
    }

    if (message.text === '/format') {
      const showButtons = isCommerceReportMode(sender.activeReportType);
      await sendTelegramMessage({
        botToken: settings?.botToken,
        chatId,
        text: getFormatPromptForMode(sender.activeReportType),
        ...(showButtons ? { replyMarkup: buildFormatInlineButtons(sender.activeReportType) } : {}),
      });
      return NextResponse.json({ ok: true });
    }

    if (message.text === '/template') {
      const showButtons = isCommerceReportMode(sender.activeReportType);
      await sendTelegramMessage({
        botToken: settings?.botToken,
        chatId,
        text: getCopyPasteTemplateForMode(sender.activeReportType),
        ...(showButtons
          ? {
              replyMarkup: {
                inline_keyboard: [[{ text: "↩️ Back to Menu", callback_data: "action:menu" }]],
              },
            }
          : {}),
      });
      return NextResponse.json({ ok: true });
    }

    if (message.text === '/start' || message.text === '/menu') {
      const allowedButtons = buildMainMenuButtons(sender.allowedDepartments);
      
      // Send bottom custom keyboard initializer first
      await sendTelegramMessage({
        botToken: settings?.botToken,
        chatId,
        text: [
          "👋 ━━━━━━━━━━━━━━━━━━━━",
          "",
          `  <b>မင်္ဂလာပါ ${sender.displayName || 'ခင်ဗျာ/ရှင်'}</b>`,
          "",
          "━━━━━━━━━━━━━━━━━━━━",
          "",
          "<b>BAI-Commerce</b> မှ ကြိုဆိုပါသည်",
        ].join("\n"),
        replyMarkup: KEYBOARD_LINKED,
      });

      // Send inline category keyboard
      await sendTelegramMessage({
        botToken: settings?.botToken,
        chatId,
        text: "📂 <b>လုပ်ငန်းစဉ် အမျိုးအစား ရွေးချယ်ပါ:</b>",
        replyMarkup: allowedButtons,
      });
      return NextResponse.json({ ok: true });
    }

    // ─── Handle File Uploads ──────────────────────────────────────────
    if (hasFile && fileInfo) {
      const receivedAt = new Date(message.date * 1000);
      const updatedSender = await prisma.telegramSender.update({
        where: { id: sender.id },
        data: {
          messageCount: { increment: 1 },
          lastMessageAt: new Date(),
        },
      });

      const activeMode = updatedSender.activeReportType;

      const requiredDep = getDepartmentForMode(activeMode);
      if (requiredDep && !updatedSender.allowedDepartments.includes(requiredDep)) {
        await prisma.telegramSender.update({
          where: { id: sender.id },
          data: { activeReportType: 'none' },
        });
        await sendNoPermissionPrompt(settings?.botToken, chatId, requiredDep);
        return NextResponse.json({ ok: true });
      }

      if (activeMode === 'none') {
        await sendPickModePrompt(settings?.botToken, chatId);
        return NextResponse.json({ ok: true });
      }

      if (activeMode === 'qa') {
        await sendTelegramMessage({
          botToken: settings?.botToken,
          chatId,
          text: [
            "⚠️ <b>Q&A မေးမြန်းခြင်း ကဏ္ဍတွင် ဖိုင်များ ပေးပို့၍ မရနိုင်ပါ။</b>",
            "",
            "အစီရင်ခံစာ (Report) တင်သွင်းရန်အတွက် သက်ဆိုင်ရာ mode သို့ ပြောင်းလဲပေးပို့ပေးပါရန် မေတ္တာရပ်ခံအပ်ပါသည်။",
            "/start သို့မဟုတ် /menu ကိုနှိပ်၍ သက်ဆိုင်ရာ mode ကို ရွေးချယ်နိုင်ပါသည်။",
          ].join("\n"),
        });
        return NextResponse.json({ ok: true });
      }

      if (isFileTooLarge(fileInfo.fileSize)) {
        await sendTelegramMessage({
          botToken: settings?.botToken,
          chatId,
          text: [
            "⚠️ <b>ပေးပို့သော ဖိုင်အရွယ်အစားမှာ သတ်မှတ်ချက်ထက် ကျော်လွန်နေပါသည်။</b>",
            "",
            "ကျေးဇူးပြု၍ ဖိုင်အရွယ်အစား 10MB အောက်သာ ရှိသော ဖိုင်များကို ပေးပို့ပေးပါရန်။",
          ].join("\n"),
        });
        return NextResponse.json({ ok: true });
      }

      // Excel/CSV imports are deterministic — they don't need a Gemini key.
      const spreadsheetUpload = isSpreadsheetFile(fileInfo.mimeType, fileInfo.fileName);
      if (!settings?.botToken || (!settings?.geminiApiKey && !spreadsheetUpload)) {
        await sendTelegramMessage({
          botToken: settings?.botToken,
          chatId,
          text: [
            "⚠️ <b>စနစ်ပြင်ဆင်မှု လိုအပ်ချက်ရှိနေပါသည်။</b>",
            "",
            "Gemini API key သို့မဟုတ် Bot Token ထည့်သွင်းထားခြင်း မရှိသေးပါ။ ကျေးဇူးပြု၍ settings စာမျက်နှာတွင် သွားရောက်ထည့်သွင်းပေးပါရန်။",
          ].join("\n"),
        });
        return NextResponse.json({ ok: true });
      }

      const caption = (message.caption as string) || undefined;
      const telegramMessage = await createTelegramMessageIfNew({
        telegramMsgId: message.message_id,
        text: `[File: ${fileInfo.fileName}] ${caption || ''}`.trim(),
        senderId: sender.id,
        chatId,
        chatTitle: message.chat.title || null,
        receivedAt,
      });
      if (!telegramMessage) {
        return NextResponse.json({ ok: true });
      }

      const progressMsg = await sendTelegramMessage({
        botToken: settings.botToken,
        chatId,
        text: [
          "⏳ <b>ဖိုင်တင်သွင်းမှုကို စတင်လုပ်ဆောင်နေပါသည်</b>",
          "━━━━━━━━━━━━━━━━━━━━",
          `📄 <b>ဖိုင်အမည်:</b> <code>${fileInfo.fileName}</code>`,
          "⚙️ <b>အခြေအနေ:</b> အချက်အလက်များအား ဖတ်ယူရန် ပြင်ဆင်နေပါသည်...",
        ].join("\n"),
      });
      const progressMsgId = progressMsg?.message_id || null;

      const downloaded = await downloadTelegramFile(settings.botToken, fileInfo.fileId);
      if (!downloaded) {
        const errorText = [
          "❌ <b>ဖိုင်ဒေါင်းလုဒ် ရယူခြင်း မအောင်မြင်ပါ</b>",
          "━━━━━━━━━━━━━━━━━━━━",
          `📄 <b>ဖိုင်အမည်:</b> <code>${fileInfo.fileName}</code>`,
          "⚠️ <b>အကြံပြုချက်:</b> ဖိုင်အား ပြန်လည်ပေးပို့ပေးပါရန် သို့မဟုတ် ဖိုင်ပုံစံ မှန်ကန်မှု ရှိမရှိ စစ်ဆေးပေးပါရန်။",
        ].join("\n");
        if (progressMsgId) {
          await editTelegramMessage({
            botToken: settings.botToken,
            chatId,
            messageId: progressMsgId,
            text: errorText,
          });
        } else {
          await sendTelegramMessage({
            botToken: settings.botToken,
            chatId,
            text: errorText,
          });
        }
        return NextResponse.json({ ok: true });
      }

      after(async () => {
        try {
          await processFileInBackground({
            downloadedBuffer: downloaded.buffer,
            fileInfo,
            settings,
            activeMode,
            chatId,
            telegramMessageId: telegramMessage.id,
            progressMsgId,
          });
        } catch (err) {
          console.error("Unhandled error in processFileInBackground:", err);
        }
      });

      return NextResponse.json({ ok: true });
    }

    // ─── Text-only messages below ─────────────────────────────────────
    if (!hasText) {
      return NextResponse.json({ ok: true });
    }

    const receivedAt = new Date(message.date * 1000);
    const updatedSender = await prisma.telegramSender.update({
      where: { id: sender.id },
      data: {
        messageCount: { increment: 1 },
        lastMessageAt: new Date(),
      },
    });

    const activeMode = updatedSender.activeReportType;

    const requiredDep = getDepartmentForMode(activeMode);
    if (requiredDep && !updatedSender.allowedDepartments.includes(requiredDep)) {
      await prisma.telegramSender.update({
        where: { id: sender.id },
        data: { activeReportType: 'none' },
      });
      await sendNoPermissionPrompt(settings?.botToken, chatId, requiredDep);
      return NextResponse.json({ ok: true });
    }

    // ─── No mode selected yet — prompt the user to pick one first ──────
    if (activeMode === 'none') {
      await sendPickModePrompt(settings?.botToken, chatId);
      return NextResponse.json({ ok: true });
    }

    // ─── Q & A Mode ───────────────────────────────────────────────────
    if (activeMode === 'qa') {
      if (!settings.userId) {
        await sendTelegramMessage({
          botToken: settings?.botToken,
          chatId,
          text: "⚠️ Q&A အသုံးပြုရန် business owner account နှင့် link လုပ်ထားရန်လိုအပ်ပါသည်။",
        });
        return NextResponse.json({ ok: true });
      }
      if (!settings?.geminiApiKey) {
        await sendTelegramMessage({
          botToken: settings?.botToken,
          chatId,
          text: "⚠️ Gemini API key မရှိသေးပါ။ Settings မှာ ထည့်ပါ။",
        });
        return NextResponse.json({ ok: true });
      }

      const telegramMessage = await createTelegramMessageIfNew({
        telegramMsgId: message.message_id,
        text: message.text,
        senderId: sender.id,
        chatId,
        chatTitle: message.chat.title || null,
        receivedAt,
      });
      if (!telegramMessage) {
        return NextResponse.json({ ok: true });
      }

      const context = await buildQAContext(settings.userId);
      const answer = await answerQuestionWithGemini({
        question: message.text,
        context,
        apiKey: settings.geminiApiKey,
        model: settings.geminiModel,
      });

      await sendTelegramMessage({
        botToken: settings?.botToken,
        chatId,
        text: `🤖 ${answer}`,
      });

      return NextResponse.json({ ok: true });
    }

    // ─── Inventory / Marketing Import Modes (text + Excel) ────────────────
    if (activeMode === 'inventory_import' || activeMode === 'marketing_import') {
      const isInventory = activeMode === 'inventory_import';
      const telegramMessage = await createTelegramMessageIfNew({
        telegramMsgId: message.message_id,
        text: message.text,
        senderId: sender.id,
        chatId,
        chatTitle: message.chat.title || null,
        receivedAt,
      });
      if (!telegramMessage) {
        return NextResponse.json({ ok: true });
      }

      if (!settings.userId) {
        await sendTelegramMessage({
          botToken: settings?.botToken,
          chatId,
          text: isInventory
            ? "⚠️ Product သိမ်းရန် business owner account နှင့် link လုပ်ထားရန်လိုအပ်ပါသည်။"
            : "⚠️ Marketing မှတ်တမ်း သိမ်းရန် business owner account နှင့် link လုပ်ထားရန်လိုအပ်ပါသည်။",
        });
        return NextResponse.json({ ok: true });
      }

      if (isInventory) {
        const row = parseInventoryTextRecord(message.text);
        if (!row) {
          await sendTelegramMessage({
            botToken: settings?.botToken,
            chatId,
            text: [
              "⚠️ <b>Product Code (SKU) မပါဝင်ပါ</b>",
              "━━━━━━━━━━━━━━━━━━━━",
              "ပစ္စည်းကို SKU ဖြင့် မှတ်သားသောကြောင့် Product Code ထည့်ပေးပါ။",
              "ဥပမာ — <code>Product Code: SKU-001</code>",
              getFormatHintFooter('inventory_import'),
            ].join("\n"),
          });
          return NextResponse.json({ ok: true });
        }
        const res = await upsertProductsFromRows([row], settings.userId);
        const statusLine =
          res.imported > 0
            ? "✅ <b>ပစ္စည်း အသစ် သိမ်းဆည်းပြီးပါပြီ</b>"
            : res.restored > 0
              ? "♻️ <b>Trash မှ ပြန်လည်ရယူပြီး အချက်အလက်အသစ်ဖြင့် update လုပ်ပြီးပါပြီ</b>"
              : "🔄 <b>SKU တူနေသောကြောင့် အချက်အလက်အသစ်ဖြင့် update လုပ်ပြီးပါပြီ</b>";
        await sendTelegramMessage({
          botToken: settings?.botToken,
          chatId,
          text: [
            statusLine,
            "━━━━━━━━━━━━━━━━━━━━",
            `📦 <b>Product:</b> <i>${row.name}</i>`,
            `🔖 <b>SKU:</b> <code>${row.sku}</code>`,
            ...(row.sellingPrice != null
              ? [`💵 <b>Price:</b> <code>${row.sellingPrice.toLocaleString()} MMK</code>`]
              : []),
            `📊 <b>Stock:</b> <code>${row.stockQty}</code>`,
            getFormatHintFooter('inventory_import'),
          ].join("\n"),
        });
        return NextResponse.json({ ok: true });
      }

      const metric = parseMarketingTextRecord(message.text, receivedAt);
      if (!metric) {
        await sendTelegramMessage({
          botToken: settings?.botToken,
          chatId,
          text: [
            "⚠️ <b>မှတ်တမ်း မသိမ်းဆည်းပါ</b>",
            "━━━━━━━━━━━━━━━━━━━━",
            "Channel (သို့မဟုတ်) Date / Spend ထည့်ပေးပါ။",
            "ဥပမာ — <code>Channel: Facebook</code>",
            getFormatHintFooter('marketing_import'),
          ].join("\n"),
        });
        return NextResponse.json({ ok: true });
      }
      await createMarketingMetricsFromRows([metric], settings.userId);
      await sendTelegramMessage({
        botToken: settings?.botToken,
        chatId,
        text: [
          "✅ <b>Marketing မှတ်တမ်း သိမ်းဆည်းပြီးပါပြီ</b>",
          "━━━━━━━━━━━━━━━━━━━━",
          `📅 <b>ရက်စွဲ:</b> <code>${(metric.metricDate || receivedAt).toISOString().slice(0, 10)}</code>`,
          `📣 <b>Channel:</b> <code>${metric.channel || "-"}</code>`,
          `💵 <b>Spend:</b> <code>${metric.spend.toLocaleString()} MMK</code>`,
          getFormatHintFooter('marketing_import'),
        ].join("\n"),
      });
      return NextResponse.json({ ok: true });
    }

    // ─── Finance Transactions Mode (text) ─────────────────────────────
    if (activeMode === 'finance_transactions') {
      const telegramMessage = await createTelegramMessageIfNew({
        telegramMsgId: message.message_id,
        text: message.text,
        senderId: sender.id,
        chatId,
        chatTitle: message.chat.title || null,
        receivedAt,
      });
      if (!telegramMessage) {
        return NextResponse.json({ ok: true });
      }

      if (!settings.userId) {
        await sendTelegramMessage({
          botToken: settings?.botToken,
          chatId,
          text: "⚠️ Finance record သိမ်းရန် business owner account နှင့် link လုပ်ထားရန်လိုအပ်ပါသည်။",
        });
        return NextResponse.json({ ok: true });
      }

      const parsed = parseFinanceTextRecord(message.text, receivedAt);
      const outcome = await createFinanceRecord({
        record: parsed,
        userId: settings.userId,
        sourceMessageId: telegramMessage.id,
      });

      if (outcome === "skipped") {
        await sendTelegramMessage({
          botToken: settings?.botToken,
          chatId,
          text: [
            "⚠️ <b>မှတ်တမ်း မသိမ်းဆည်းပါ</b>",
            "━━━━━━━━━━━━━━━━━━━━",
            "Amount 0 (သို့မဟုတ်) ငွေပမာဏ မပါဝင်သောကြောင့် သိမ်းဆည်းခြင်း မပြုပါ။",
            "ငွေပမာဏ ထည့်ပြီး ပြန်ပို့ပေးပါ။",
          ].join("\n"),
        });
        return NextResponse.json({ ok: true });
      }

      const confirmParts = [
        "✅ <b>ဘဏ္ဍာရေး ငွေသွင်း/ငွေထုတ် မှတ်တမ်း တင်သွင်းခြင်း အောင်မြင်ပါသည်</b>",
        "━━━━━━━━━━━━━━━━━━━━",
        `📅 <b>ရက်စွဲ:</b> <code>${(parsed.date || receivedAt).toISOString().slice(0, 10)}</code>`,
        `🏷️ <b>Type:</b> <code>${parsed.type}</code>`,
        `📂 <b>Category:</b> <code>${parsed.category}</code>`,
        `💵 <b>Amount:</b> <code>${parsed.amount.toLocaleString()} MMK</code>`,
      ];
      if (parsed.description) confirmParts.push(`📝 <b>Description:</b> <i>${parsed.description}</i>`);
      if (parsed.notes) confirmParts.push(`📝 <b>Notes:</b> <i>${parsed.notes}</i>`);
      confirmParts.push(getFormatHintFooter('finance_transactions'));

      await sendTelegramMessage({
        botToken: settings?.botToken,
        chatId,
        text: confirmParts.join('\n'),
      });

      return NextResponse.json({ ok: true });
    }

    // ─── Commerce Lead / Customer Service Mode ────────────────────────
    // New product-sales flow. The legacy DemandRecord path below remains
    // temporarily unreachable while its historical import endpoints are removed.
    if (activeMode === 'demand_report' || activeMode === 'customer_service') {
      const telegramMessage = await createTelegramMessageIfNew({
        telegramMsgId: message.message_id,
        text: message.text,
        senderId: sender.id,
        chatId,
        chatTitle: message.chat.title || null,
        receivedAt,
      });
      if (!telegramMessage) return NextResponse.json({ ok: true });

      if (!settings.userId) {
        await sendTelegramMessage({
          botToken: settings?.botToken,
          chatId,
          text: "⚠️ Order / customer မှတ်တမ်း သိမ်းရန် business owner account နှင့် link လုပ်ထားရန်လိုအပ်ပါသည်။",
        });
        return NextResponse.json({ ok: true });
      }

      const parsed = await parseCommerceMessageWithGemini({
        text: message.text,
        apiKey: settings?.geminiApiKey,
        model: settings?.geminiModel,
      });
      let customerId: string | null = null;
      if (parsed.customerName && settings?.userId) {
        const nameNormalized = normalizeCustomerName(parsed.customerName);
        const customer = await prisma.customer.upsert({
          where: { userId_nameNormalized: { userId: settings.userId, nameNormalized } },
          create: {
            userId: settings.userId,
            name: parsed.customerName,
            nameNormalized,
            phone: parsed.customerPhone ? formatPhoneNumber(parsed.customerPhone) : null,
          },
          update: {
            ...restoreData(settings.userId),
            ...(parsed.customerPhone ? { phone: formatPhoneNumber(parsed.customerPhone) } : {}),
            status: "active",
          },
        });
        customerId = customer.id;
        await prisma.customerActivity.create({
          data: {
            customerId,
            senderId: sender.id,
            action: activeMode,
            description: parsed.note,
          },
        });
      }

      const stage = parsed.intent === "order" ? "PENDING" : "FOLLOW_UP_NEEDED";
      const deal = await prisma.deal.create({
        data: {
          userId: settings.userId,
          customerId,
          stage,
          fulfillmentStatus: parsed.intent === "order" ? "PENDING" : "NOT_APPLICABLE",
          source: "telegram",
          sourceChannel: "Telegram",
          quotedAmount: parsed.items.reduce((total, item) => total + (item.unitPrice || 0) * item.quantity, 0) || null,
          lastContactAt: receivedAt,
          note: parsed.note,
          items: {
            create: parsed.items.map((item) => ({
              productName: item.name,
              sku: item.sku,
              quantity: item.quantity,
              unitPrice: item.unitPrice || 0,
            })),
          },
        },
      });
      await prisma.followUpNote.create({
        data: {
          dealId: deal.id,
          messageId: telegramMessage.id,
          aiDraftedText: parsed.suggestedFollowUpText,
          intentDetected: parsed.intent,
          suggestedNextAction: parsed.suggestedNextAction,
          suggestedFollowUpDate: parsed.suggestedFollowUpDate,
        },
      });

      await sendTelegramMessage({
        botToken: settings?.botToken,
        chatId,
        text: [
          "✅ <b>Commerce lead မှတ်တမ်းတင်ခြင်း အောင်မြင်ပါသည်</b>",
          "━━━━━━━━━━━━━━━━━━━━",
          parsed.customerName ? `👤 <b>Customer:</b> ${parsed.customerName}` : "👤 <b>Customer:</b> Not detected",
          `⚙️ <b>Stage:</b> <code>${stage}</code>`,
          `📝 <b>Next action:</b> ${parsed.suggestedNextAction}`,
          "AI follow-up draft ကို Sales module မှာ review/edit/accept လုပ်နိုင်ပါသည်။",
        ].join("\n"),
      });
      return NextResponse.json({ ok: true });
    }

    await prisma.telegramSender.update({
      where: { id: sender.id },
      data: { activeReportType: 'none' },
    });
    await sendTelegramMessage({
      botToken: settings?.botToken,
      chatId,
      text: [
        "⚠️ <b>ရွေးထားသော mode ကို BAI-Commerce မှာမသုံးတော့ပါ။</b>",
        "",
        "ကျေးဇူးပြု၍ /menu မှ Commerce mode တစ်ခုကို ပြန်ရွေးပါ။",
      ].join("\n"),
      replyMarkup: buildMainMenuButtons(sender.allowedDepartments),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Telegram webhook error:", error);
    return NextResponse.json({ ok: true });
  }
}
