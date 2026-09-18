/**
 * Customers list query used by the customers workspace.
 * Extracted verbatim from the page.
 */
import { useQuery } from '@tanstack/react-query';
import { customersApi } from '@/lib/api';

export function useCustomers(params: { search?: string; page?: number; limit?: number; status?: string; dateFrom?: string; dateTo?: string } = {}) {
  return useQuery({
    queryKey: ['customers', params],
    queryFn: () => customersApi.list(params),
    placeholderData: (prev) => prev,
    refetchInterval: 10000,
  });
}
