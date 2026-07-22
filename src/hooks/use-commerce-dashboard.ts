"use client";

import {
  commerceDashboardApi,
  CommerceDashboardParams,
  SaveCommerceTargetsPayload,
} from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const commerceDashboardKeys = {
  all: ["commerce-dashboard"] as const,
  detail: (params: CommerceDashboardParams) => [...commerceDashboardKeys.all, params] as const,
  workspaces: (params: Pick<CommerceDashboardParams, "year" | "month">) => [...commerceDashboardKeys.all, "workspaces", params] as const,
};

export function useCommerceDashboard(params: CommerceDashboardParams, enabled = true) {
  return useQuery({
    queryKey: commerceDashboardKeys.detail(params),
    queryFn: () => commerceDashboardApi.get(params),
    enabled,
  });
}

export function useSaveCommerceTargets() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SaveCommerceTargetsPayload) => commerceDashboardApi.saveTargets(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commerceDashboardKeys.all });
      toast.success("Targets saved");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to save targets");
    },
  });
}

export function useCommerceWorkspaces(params: Pick<CommerceDashboardParams, "year" | "month">, enabled = true) {
  return useQuery({
    queryKey: commerceDashboardKeys.workspaces(params),
    queryFn: () => commerceDashboardApi.workspaces(params),
    enabled,
  });
}
