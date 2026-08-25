import { Suspense } from 'react';
import { ProductSalesWorkspace } from '@/components/product-sales-workspace';

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500 animate-pulse">Loading...</div>}>
      <ProductSalesWorkspace workspace="overview" />
    </Suspense>
  );
}
