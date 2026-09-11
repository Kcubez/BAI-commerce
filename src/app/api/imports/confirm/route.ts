import { auth } from "@/lib/auth";
import {
  DASHBOARD_CS_SOURCE,
  DASHBOARD_SALES_SOURCE,
  createCustomerServiceRecordsFromRows,
  createMarketingMetricsFromRows,
  createSalesOrdersFromRows,
  upsertProductsFromRows,
} from "@/lib/commerce-import";
import {
  createFinanceRecord,
} from "@/lib/finance-import";
import {
  fingerprintImportRows,
  isDataImportKind,
  parseDataImportBuffer,
  parsedImportRowCount,
  sha256Hex,
  validateImportFile,
} from "@/lib/data-import";
import { NextRequest, NextResponse } from "next/server";

// POST /api/imports/confirm — re-parse the uploaded file and write the rows
// to the database. Stateless: the client re-sends the file it previewed.
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ message: "Invalid upload" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ message: "Upload a spreadsheet file" }, { status: 400 });
  }

  const fileError = validateImportFile(file);
  if (fileError) {
    return NextResponse.json({ message: fileError }, { status: 400 });
  }

  const requestedType = formData.get("type");
  if (typeof requestedType !== "string" || !isDataImportKind(requestedType)) {
    return NextResponse.json({ message: "Pick a valid import type before confirming" }, { status: 400 });
  }
  const kind = requestedType;

  const excluded = new Set<number>();
  const rawExcluded = formData.get("excludedIndices");
  if (typeof rawExcluded === "string" && rawExcluded.trim()) {
    try {
      const parsed = JSON.parse(rawExcluded);
      if (Array.isArray(parsed)) {
        for (const idx of parsed) {
          if (typeof idx === "number" && Number.isInteger(idx) && idx >= 0) excluded.add(idx);
        }
      }
    } catch {
      return NextResponse.json({ message: "Invalid excluded rows" }, { status: 400 });
    }
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileHash = sha256Hex(buffer);

  // The client previews a file, then re-sends it to confirm. The hash is
  // required (not optional): without it, positional row exclusions could
  // apply to a different file's rows.
  const previewHash = formData.get("fileHash");
  if (typeof previewHash !== "string" || !previewHash.trim() || previewHash !== fileHash) {
    return NextResponse.json(
      { message: "Please preview the file before confirming." },
      { status: 422 },
    );
  }

  let parsed;
  try {
    parsed = parseDataImportBuffer(buffer, kind);
  } catch (err) {
    console.error(`Web import confirm parse failed (${kind}):`, err);
    return NextResponse.json({ message: "Failed to parse the file" }, { status: 422 });
  }

  const totalRows = parsedImportRowCount(parsed);
  if (totalRows === 0) {
    return NextResponse.json({ message: "No importable rows found" }, { status: 422 });
  }

  try {
    let importedCount = 0;
    let skippedCount = 0;
    let duplicateCount = 0;
    let restoredCount = 0;
    let invalidSkippedCount = 0;

    // Fingerprint ALL parsed rows with their original indices first, so keys
    // stay stable even when the user excludes rows. Row subsets are sliced
    // per branch below so TypeScript keeps the narrowed row types.
    const allKeys = fingerprintImportRows({
      channel: "web",
      channelRef: sha256Hex(buffer),
      kind,
      rows: parsed.rows,
    });
    const keptIdxs = parsed.rows.map((_, idx) => idx).filter((idx) => !excluded.has(idx));
    const keptKeys = (idxs: number[]) => idxs.map((i) => allKeys[i] as string);
    const userSkippedCount = totalRows - keptIdxs.length;
    skippedCount = userSkippedCount;

    if (parsed.kind === "sales_orders") {
      const rows = keptIdxs.map((i) => parsed.rows[i]);
      const res = await createSalesOrdersFromRows(rows, userId, DASHBOARD_SALES_SOURCE, keptKeys(keptIdxs));
      importedCount = res.imported;
      duplicateCount = res.duplicates;
      restoredCount = res.restored;
    } else if (parsed.kind === "customer_service") {
      const rows = keptIdxs.map((i) => parsed.rows[i]);
      const res = await createCustomerServiceRecordsFromRows(rows, userId, DASHBOARD_CS_SOURCE, keptKeys(keptIdxs));
      importedCount = res.imported;
      duplicateCount = res.duplicates;
      restoredCount = res.restored;
    } else if (parsed.kind === "product_catalog") {
      const rows = keptIdxs.map((i) => parsed.rows[i]);
      const res = await upsertProductsFromRows(rows, userId);
      importedCount = res.imported;
      duplicateCount = res.duplicates;
      restoredCount = res.restored;
    } else if (parsed.kind === "marketing_metrics") {
      const rows = keptIdxs.map((i) => parsed.rows[i]);
      const res = await createMarketingMetricsFromRows(rows, userId, keptKeys(keptIdxs));
      importedCount = res.imported;
      duplicateCount = res.duplicates;
      restoredCount = res.restored;
    } else {
      // createFinanceRecord saves a ledger entry for every row with
      // amount > 0 (income rows are ledger-only by design), so "imported"
      // means ledger-saved. Only amount <= 0 rows are genuinely skipped.
      const importableIdxs = keptIdxs.filter((i) => parsed.rows[i].amount > 0);
      invalidSkippedCount = keptIdxs.length - importableIdxs.length;
      skippedCount += invalidSkippedCount;
      const outcomes = await Promise.all(
        importableIdxs.map((i) =>
          createFinanceRecord({ record: parsed.rows[i], userId, importKey: allKeys[i] as string }),
        ),
      );
      const expenseCount = outcomes.filter((o) => o === "expense").length;
      const incomeCount = outcomes.filter((o) => o === "ledger").length;
      duplicateCount = outcomes.filter((o) => o === "duplicate").length;
      restoredCount = outcomes.filter((o) => o === "restored").length;
      importedCount = expenseCount + incomeCount;

      return NextResponse.json({
        fileName: file.name,
        importType: kind,
        rowCount: totalRows,
        importedCount,
        skippedCount,
        userSkippedCount,
        invalidSkippedCount,
        duplicateCount,
        restoredCount,
        financeBreakdown: {
          expenseCount,
          incomeCount,
        },
      });
    }

    return NextResponse.json({
      fileName: file.name,
      importType: kind,
      rowCount: totalRows,
      importedCount,
      skippedCount,
      userSkippedCount,
      invalidSkippedCount,
      duplicateCount,
      restoredCount,
    });
  } catch (err) {
    console.error(`Web import confirm write failed (${kind}):`, err);
    return NextResponse.json({ message: "Import failed while saving records" }, { status: 500 });
  }
}
