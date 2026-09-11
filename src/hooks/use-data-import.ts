"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { importsApi, type DataImportType } from "@/lib/api";
import { commerceDashboardKeys } from "@/hooks/use-commerce-dashboard";
import { toast } from "sonner";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export const dataImportKeys = {
  all: ["data-import"] as const,
};

export function usePreviewImportFile() {
  return useMutation({
    mutationFn: ({ file, type }: { file: File; type?: DataImportType | "auto" }) =>
      importsApi.preview(file, type),
    onError: (error: unknown) => {
      toast.error(errorMessage(error, "Failed to preview file"));
    },
  });
}

export function useConfirmImport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      file,
      type,
      excludedIndices,
      fileHash,
    }: {
      file: File;
      type: DataImportType;
      excludedIndices: number[];
      fileHash?: string;
    }) => importsApi.confirm(file, type, excludedIndices, fileHash),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: commerceDashboardKeys.all });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["marketing-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["demand-records"] });
      queryClient.invalidateQueries({ queryKey: ["demand-record-stats"] });
      const userSkipped = res.userSkippedCount > 0 ? ` (${res.userSkippedCount} skipped by you)` : "";
      const invalid = res.invalidSkippedCount > 0 ? ` (${res.invalidSkippedCount} invalid skipped)` : "";
      const dupes = res.duplicateCount > 0 ? ` (${res.duplicateCount} duplicate${res.duplicateCount === 1 ? "" : "s"} skipped)` : "";
      const restored = res.restoredCount > 0 ? ` (${res.restoredCount} restored from trash)` : "";
      if (res.financeBreakdown) {
        const { expenseCount, incomeCount } = res.financeBreakdown;
        toast.success(
          `Imported ${res.importedCount} of ${res.rowCount} row(s) — ${expenseCount} expense(s), ${incomeCount} income (ledger)${userSkipped}${invalid}${dupes}${restored}`,
        );
      } else {
        toast.success(`Imported ${res.importedCount} of ${res.rowCount} row(s)${userSkipped}${invalid}${dupes}${restored}`);
      }
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error, "Failed to import file"));
    },
  });
}
