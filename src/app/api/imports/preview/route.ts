import { auth } from "@/lib/auth";
import {
  DATA_IMPORT_META,
  detectDataImportKind,
  isDataImportKind,
  parseDataImportBuffer,
  parsedImportRowCount,
  sha256Hex,
  toPreviewRow,
  validateImportFile,
  type DataImportKind,
  type PreviewRow,
} from "@/lib/data-import";
import { NextRequest, NextResponse } from "next/server";

const PREVIEW_ROW_LIMIT = 100;

// POST /api/imports/preview — parse an uploaded spreadsheet and return a
// preview. Never writes to the database.
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

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
  const explicitKind: DataImportKind | null =
    typeof requestedType === "string" && isDataImportKind(requestedType) ? requestedType : null;

  const buffer = Buffer.from(await file.arrayBuffer());
  const detectedKind = detectDataImportKind(buffer);
  const kind = explicitKind ?? detectedKind;

  if (!kind) {
    return NextResponse.json(
      {
        message:
          "Could not detect the sheet type from headers. Pick a type manually and try again.",
        detectedType: null,
      },
      { status: 422 },
    );
  }

  let rows: PreviewRow[];
  let rowCount: number;
  try {
    const parsed = parseDataImportBuffer(buffer, kind);
    rowCount = parsedImportRowCount(parsed);
    rows = parsed.rows.slice(0, PREVIEW_ROW_LIMIT).map((row) => toPreviewRow(kind, row));
  } catch (err) {
    console.error(`Web import preview parse failed (${kind}):`, err);
    return NextResponse.json({ message: "Failed to parse the file" }, { status: 422 });
  }

  if (rowCount === 0) {
    return NextResponse.json(
      {
        message: `No importable rows found for “${DATA_IMPORT_META[kind].label}”. Check the expected columns and try again.`,
        detectedType: kind,
        rowCount: 0,
      },
      { status: 422 },
    );
  }

  return NextResponse.json({
    fileName: file.name,
    fileHash: sha256Hex(buffer),
    detectedType: detectedKind,
    importType: kind,
    rowCount,
    truncated: rowCount > rows.length,
    columns: DATA_IMPORT_META[kind].columns,
    rows,
  });
}
