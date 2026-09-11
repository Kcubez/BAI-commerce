import { Suspense } from 'react';
import { DataImportView } from '@/components/data-import-view';

export default function DataImportPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground animate-pulse">Loading Import...</div>}>
      <DataImportView />
    </Suspense>
  );
}
