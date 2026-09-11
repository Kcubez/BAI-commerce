'use client';

import { useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  RotateCcw,
  Upload,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DATA_IMPORT_TYPES,
  importsApi,
  type DataImportType,
  type ImportConfirmResponse,
  type ImportPreviewResponse,
} from '@/lib/api';
import { useConfirmImport, usePreviewImportFile } from '@/hooks/use-data-import';

type TypeOption = DataImportType | 'auto';

function downloadTemplate(type: DataImportType) {
  const csv = importsApi.templateCsv(type);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${type}-template.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function formatCell(value: string | number | null): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number') return value.toLocaleString();
  return value;
}

export function DataImportView() {
  const [typeOption, setTypeOption] = useState<TypeOption>('auto');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<ImportConfirmResponse | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const previewMutation = usePreviewImportFile();
  const confirmMutation = useConfirmImport();

  const selectedMeta =
    typeOption === 'auto' ? null : DATA_IMPORT_TYPES.find((t) => t.value === typeOption);

  function runPreview(nextFile: File, nextType: TypeOption) {
    setFile(nextFile);
    setPreview(null);
    setExcluded(new Set());
    setResult(null);
    previewMutation.mutate(
      { file: nextFile, type: nextType },
      { onSuccess: (res) => setPreview(res) },
    );
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    runPreview(files[0], typeOption);
  }

  function handleTypeChange(next: TypeOption) {
    setTypeOption(next);
    // Re-preview the current file under the newly picked type.
    if (file) runPreview(file, next);
  }

  function toggleRow(idx: number) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function handleConfirm() {
    if (!file || !preview) return;
    confirmMutation.mutate(
      { file, type: preview.importType, excludedIndices: Array.from(excluded), fileHash: preview.fileHash },
      {
        onSuccess: (res) => {
          setResult(res);
          // Clear the uploaded file so the dropzone is fresh for the next
          // import — keeping the old file around after success is confusing.
          setFile(null);
          setPreview(null);
          setExcluded(new Set());
          if (fileInputRef.current) fileInputRef.current.value = '';
        },
      },
    );
  }

  function handleReset() {
    setFile(null);
    setPreview(null);
    setExcluded(new Set());
    setResult(null);
    previewMutation.reset();
    confirmMutation.reset();
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const previewMeta = preview
    ? DATA_IMPORT_TYPES.find((t) => t.value === preview.importType)
    : null;
  const includedCount = preview ? preview.rowCount - excluded.size : 0;

  return (
    <div className="min-h-[calc(100vh-7rem)] space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-foreground font-heading">Data Import</h1>
          <p className="text-sm text-muted-foreground">
            Upload an Excel (.xlsx/.xls) or CSV file — preview the rows, then confirm to import.
          </p>
        </div>
        {(file || result) && (
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Start over
          </Button>
        )}
      </div>

      {/* Step 1 — type + file */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Choose type &amp; upload file</CardTitle>
          <CardDescription>
            Auto-detect reads the header row (same rules as the Telegram importer). Pick a type
            manually if detection fails.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <button
              type="button"
              onClick={() => handleTypeChange('auto')}
              className={`rounded-lg border p-3 text-left transition-colors ${
                typeOption === 'auto'
                  ? 'border-sky-500 bg-sky-500/10'
                  : 'border-border hover:border-sky-500/50'
              }`}
            >
              <div className="text-sm font-semibold">✨ Auto-detect</div>
              <div className="text-xs text-muted-foreground">Detect type from headers</div>
            </button>
            {DATA_IMPORT_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => handleTypeChange(t.value)}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  typeOption === t.value
                    ? 'border-sky-500 bg-sky-500/10'
                    : 'border-border hover:border-sky-500/50'
                }`}
              >
                <div className="text-sm font-semibold">{t.label}</div>
                <div className="text-xs text-muted-foreground">{t.description}</div>
                {t.value === 'customer_service' && (
                  <div className="mt-1.5 flex items-start gap-1 text-[11px] leading-snug text-amber-600 dark:text-amber-400">
                    
                  </div>
                )}
              </button>
            ))}
          </div>

          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              handleFiles(e.dataTransfer.files);
            }}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
              isDragging ? 'border-sky-500 bg-sky-500/10' : 'border-border hover:border-sky-500/50'
            }`}
          >
            <Upload className="h-8 w-8 text-muted-foreground" />
            <div className="text-sm">
              <span className="font-semibold text-sky-500">Click to browse</span> or drag &amp; drop
              your file here
            </div>
            <div className="text-xs text-muted-foreground">.xlsx, .xls, .csv — max 10MB</div>
            {file && (
              <Badge variant="secondary" className="mt-1">
                <FileSpreadsheet className="mr-1 h-3 w-3" />
                {file.name}
              </Badge>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Templates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Column templates</CardTitle>
          <CardDescription>
            Download a CSV template with the expected header row, fill in your rows, then upload.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {DATA_IMPORT_TYPES.map((t) => (
            <Button key={t.value} variant="outline" size="sm" onClick={() => downloadTemplate(t.value)}>
              <Download className="mr-2 h-4 w-4" />
              {t.label}
            </Button>
          ))}
        </CardContent>
      </Card>

      {/* Expected columns hint for the active type */}
      {selectedMeta && (
        <Card>
          <CardContent className="pt-4 text-xs text-muted-foreground">
            Expected columns for <span className="font-semibold">{selectedMeta.label}</span>:{' '}
            <code className="text-[11px]">{selectedMeta.columns.join(' | ')}</code>
          </CardContent>
        </Card>
      )}

      {/* Step 2 — preview */}
      {previewMutation.isPending && (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Parsing file…
          </CardContent>
        </Card>
      )}

      {preview && previewMeta && !result && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">
                  2. Preview — {previewMeta.label}{' '}
                  <Badge variant="secondary" className="ml-1">
                    {preview.rowCount} row(s)
                  </Badge>
                </CardTitle>
                <CardDescription>
                  {preview.detectedType && preview.detectedType !== preview.importType
                    ? `Detected “${preview.detectedType}”, importing as “${preview.importType}”. `
                    : ''}
                  Uncheck rows to skip them. {excluded.size > 0 && `${excluded.size} skipped · `}
                  {includedCount} will be imported.
                  {preview.truncated && ` Showing the first 100 of ${preview.rowCount} rows — rows beyond 100 import unless skipped via "Skip all".`}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setExcluded(new Set(Array.from({ length: preview.rowCount }, (_, i) => i)))}
                >
                  Skip all
                </Button>
                <Button variant="outline" size="sm" onClick={() => setExcluded(new Set())}>
                  Include all
                </Button>
                <Button size="sm" onClick={handleConfirm} disabled={confirmMutation.isPending || includedCount === 0}>
                  {confirmMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Importing…
                    </>
                  ) : (
                    <>Confirm import ({includedCount})</>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">In</TableHead>
                    <TableHead className="w-12">#</TableHead>
                    {preview.columns.map((col) => (
                      <TableHead key={col} className="whitespace-nowrap">
                        {col}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.map((row, idx) => (
                    <TableRow key={idx} className={excluded.has(idx) ? 'opacity-40' : undefined}>
                      <TableCell>
                        <input
                          type="checkbox"
                          aria-label={`Include row ${idx + 1}`}
                          checked={!excluded.has(idx)}
                          onChange={() => toggleRow(idx)}
                          className="h-4 w-4 cursor-pointer accent-sky-600"
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                      {preview.columns.map((col) => (
                        <TableCell key={col} className="max-w-48 truncate whitespace-nowrap text-sm">
                          {formatCell(row[col] ?? null)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3 — result */}
      {result && (
        <Card className="border-emerald-500/40">
          <CardContent className="flex flex-col items-start gap-3 pt-6">
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
              <span className="text-lg font-semibold">Import complete</span>
            </div>
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{result.importedCount}</span> of{' '}
              {result.rowCount} row(s) from <code>{result.fileName}</code> imported
              {result.userSkippedCount > 0 && ` (${result.userSkippedCount} skipped by you)`}
              {result.invalidSkippedCount > 0 && ` (${result.invalidSkippedCount} invalid row${result.invalidSkippedCount === 1 ? "" : "s"} skipped)`}
              {result.duplicateCount > 0 && ` (${result.duplicateCount} duplicate${result.duplicateCount === 1 ? "" : "s"} skipped)`}
              {result.restoredCount > 0 && ` (${result.restoredCount} restored from trash)`}.
              {result.financeBreakdown && (
                <>
                  {' '}Including <span className="font-semibold text-foreground">{result.financeBreakdown.expenseCount}</span> expense(s) and{' '}
                  <span className="font-semibold text-foreground">{result.financeBreakdown.incomeCount}</span> income row(s) saved to the ledger.
                </>
              )}
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleReset}>
                Import another file
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!preview && !previewMutation.isPending && previewMutation.isError && (
        <Card className="border-amber-500/40">
          <CardContent className="flex items-center gap-2 pt-6 text-sm text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            Could not preview this file — check the expected columns or pick the type manually.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
