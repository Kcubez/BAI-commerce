/** Inventory workspace (products CRUD).
 * Extracted verbatim from product-sales-workspace.
 */
'use client';
import {
  useState,
  type FormEvent,
} from 'react';
import {
  useQueryClient,
} from '@tanstack/react-query';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Package,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  Button,
} from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Input,
} from '@/components/ui/input';
import type {
  CommerceActionRecommendation,
  CommerceWorkspaceData,
  ProductRecord,
} from '@/lib/api';
import {
  commerceDashboardKeys,
} from '@/hooks/use-commerce-dashboard';
import {
  amount,
} from '@/components/commerce/shared-charts';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  toast,
} from 'sonner';
import {
  FinanceKpiCard,
  SmartSuggestions,
} from '@/components/commerce/shared-charts';

export function InventoryWorkspace({ data, recommendations, isRecommendationsLoading }: { data?: CommerceWorkspaceData['inventory']; recommendations?: CommerceActionRecommendation[]; isRecommendationsLoading: boolean }) {
  const queryClient = useQueryClient();
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductRecord | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<ProductRecord | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [productForm, setProductForm] = useState({
    name: '',
    sku: '',
    category: '',
    sellingPrice: '',
    unitCost: '',
    stockQty: '0',
    lowStockThreshold: '5',
    description: '',
  });

  const products = data?.products ?? [];
  const statusClass = (status: string) => status === 'In Stock' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : status === 'Low Stock' ? 'border-amber-200 bg-amber-50 text-amber-700' : status === 'Out of Stock' ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-slate-50 text-slate-600';

  const openAddProduct = () => {
    setEditingProduct(null);
    setProductForm({
      name: '',
      sku: '',
      category: '',
      sellingPrice: '',
      unitCost: '',
      stockQty: '0',
      lowStockThreshold: '5',
      description: '',
    });
    setProductDialogOpen(true);
  };

  const openEditProduct = (prod: ProductRecord) => {
    setEditingProduct(prod);
    setProductForm({
      name: prod.name || '',
      sku: prod.sku || '',
      category: prod.category || '',
      sellingPrice: prod.sellingPrice ? String(prod.sellingPrice) : '',
      unitCost: prod.unitCost ? String(prod.unitCost) : '',
      stockQty: String(prod.stockQty ?? 0),
      lowStockThreshold: String(prod.lowStockThreshold ?? 5),
      description: prod.description || '',
    });
    setProductDialogOpen(true);
  };

  const saveProduct = async (e: FormEvent) => {
    e.preventDefault();
    if (!productForm.name.trim()) {
      toast.error('Product name is required');
      return;
    }
    setIsSaving(true);
    try {
      const generatedSku = productForm.sku.trim() || `SKU-${Date.now().toString().slice(-6)}`;
      const payload = {
        name: productForm.name.trim(),
        sku: generatedSku,
        category: productForm.category.trim() || null,
        sellingPrice: productForm.sellingPrice ? Number(productForm.sellingPrice) : null,
        unitCost: productForm.unitCost ? Number(productForm.unitCost) : null,
        stockQty: Number(productForm.stockQty) || 0,
        lowStockThreshold: Number(productForm.lowStockThreshold) || 5,
      };

      const res = await fetch('/api/products', {
        method: editingProduct ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingProduct ? { id: editingProduct.id, ...payload } : payload),
      });

      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        throw new Error(err.message || 'Failed to save product');
      }
      toast.success(editingProduct ? 'Product updated' : 'Product created');
      setProductDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: commerceDashboardKeys.all });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error saving product');
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDeleteProduct = async () => {
    if (!deleteProduct) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/products?id=${deleteProduct.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete product');
      toast.success('Product moved to Trash');
      setDeleteProduct(null);
      await queryClient.invalidateQueries({ queryKey: commerceDashboardKeys.all });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error deleting product');
    } finally {
      setIsDeleting(false);
    }
  };

  const [prodPage, setProdPage] = useState(1);
  const prodPageSize = 10;
  const totalProdPages = Math.max(1, Math.ceil(products.length / prodPageSize));
  const pagedProducts = products.slice((prodPage - 1) * prodPageSize, prodPage * prodPageSize);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <FinanceKpiCard label="Total Products" value={amount(data?.kpis.totalProducts ?? 0)} icon={Package} accentClass="border-l-4 border-l-sky-500" />
        <FinanceKpiCard label="Low Stock Items" value={amount(data?.kpis.lowStockItems ?? 0)} icon={AlertTriangle} accentClass="border-l-4 border-l-amber-500" />
        <FinanceKpiCard label="Out of Stock" value={amount(data?.kpis.outOfStock ?? 0)} icon={Package} accentClass="border-l-4 border-l-red-500" />
        <FinanceKpiCard label="Inventory Value" value={amount(data?.kpis.inventoryValue ?? 0)} unit="MMK" icon={DollarSign} accentClass="border-l-4 border-l-emerald-500" />
      </div>

      <SmartSuggestions recommendations={recommendations} isLoading={isRecommendationsLoading} areaFilter="inventory" />

      <section className="bg-card border-2 border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wide">Product Catalog Table</h2>
            <p className="mt-1 text-xs text-muted-foreground">Product Code is the internal identifier used to identify each product.</p>
          </div>
          <Button size="sm" className="h-9 bg-sky-600 hover:bg-sky-700 text-white font-bold cursor-pointer" onClick={openAddProduct}>
            <Plus className="mr-1.5 h-4 w-4" /> Add Product
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b-2 border-slate-200 bg-slate-50/60 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950/40">
              <tr>
                {['Product', 'Product Code', 'Stock Level', 'Status', 'Actions'].map((heading) => (
                  <th key={heading} className={`px-6 py-4 ${heading === 'Actions' ? 'text-center' : 'text-left'}`}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-slate-100 dark:divide-slate-900">
              {pagedProducts.length > 0 ? (
                pagedProducts.map((product) => (
                  <tr key={product.id} className="transition hover:bg-slate-50 dark:hover:bg-slate-950/50">
                    <td className="px-6 py-4 text-xs font-bold text-slate-900 dark:text-slate-100">{product.name}</td>
                    <td className="px-6 py-4 text-xs font-bold text-slate-500">{product.productCode || '—'}</td>
                    <td className="px-6 py-4 text-xs font-semibold text-slate-500">{product.stockLevel}</td>
                    <td className="px-6 py-4">
                      <span className={`rounded border-2 px-2.5 py-1 text-[10px] font-extrabold ${statusClass(product.status)}`}>
                        {product.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <Button aria-label={`Edit ${product.name}`} variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700" onClick={() => openEditProduct(product as unknown as ProductRecord)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button aria-label={`Delete ${product.name}`} variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700" onClick={() => setDeleteProduct(product as unknown as ProductRecord)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">No products in catalog yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {totalProdPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 bg-card/20 px-6 py-4">
            <div className="text-xs text-muted-foreground font-mono">
              Showing Page <span className="text-foreground font-bold">{prodPage}</span> of <span className="text-foreground font-bold">{totalProdPages}</span> ({products.length} total)
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={prodPage <= 1} onClick={() => setProdPage((p) => Math.max(1, p - 1))} className="bg-card border-border text-foreground hover:bg-muted cursor-pointer">
                <ChevronLeft className="w-4 h-4 mr-1" />
                Prev
              </Button>
              <Button variant="outline" size="sm" disabled={prodPage >= totalProdPages} onClick={() => setProdPage((p) => Math.min(totalProdPages, p + 1))} className="bg-card border-border text-foreground hover:bg-muted cursor-pointer">
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Product Add/Edit Dialog */}
      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Edit Product' : 'Add New Product'}</DialogTitle>
            <DialogDescription>Add or update product stock, price, and SKU details.</DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={saveProduct}>
            <div className="grid gap-1.5">
              <label className="text-xs font-bold">Product Name *</label>
              <Input value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} placeholder="Product name" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <label className="text-xs font-bold">SKU / Product Code</label>
                <Input value={productForm.sku} onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })} placeholder="SKU-001" />
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs font-bold">Category</label>
                <Input value={productForm.category} onChange={(e) => setProductForm({ ...productForm, category: e.target.value })} placeholder="Category" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <label className="text-xs font-bold">Selling Price (MMK)</label>
                <Input type="number" value={productForm.sellingPrice} onChange={(e) => setProductForm({ ...productForm, sellingPrice: e.target.value })} placeholder="0" />
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs font-bold">Unit Cost (MMK)</label>
                <Input type="number" value={productForm.unitCost} onChange={(e) => setProductForm({ ...productForm, unitCost: e.target.value })} placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <label className="text-xs font-bold">Stock Quantity</label>
                <Input type="number" value={productForm.stockQty} onChange={(e) => setProductForm({ ...productForm, stockQty: e.target.value })} placeholder="0" />
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs font-bold">Low Stock Threshold</label>
                <Input type="number" value={productForm.lowStockThreshold} onChange={(e) => setProductForm({ ...productForm, lowStockThreshold: e.target.value })} placeholder="5" />
              </div>
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs font-bold">Description</label>
              <Input value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} placeholder="Product notes" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setProductDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSaving} className="bg-sky-600 hover:bg-sky-700 text-white font-bold">{isSaving ? 'Saving...' : editingProduct ? 'Save Changes' : 'Add Product'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={Boolean(deleteProduct)} onOpenChange={(open) => !open && setDeleteProduct(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this product?</AlertDialogTitle>
            <AlertDialogDescription>This product will be moved to Trash.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={isDeleting} className="bg-red-600 text-white hover:bg-red-700 font-bold" onClick={confirmDeleteProduct}>{isDeleting ? 'Deleting...' : 'Move to Trash'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
