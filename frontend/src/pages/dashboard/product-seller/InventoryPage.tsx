import { useEffect, useState } from 'react';
import * as Icons from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { ProductListingModal } from '../../../components/ProductListingModal';
import { requestJson } from '../../../lib/api';
import type { User, ProductListing } from '../../../types/session';

interface InventoryPageProps {
  user: User;
  searchQuery: string;
}

export function InventoryPage({ user, searchQuery }: InventoryPageProps) {
  const [products, setProducts] = useState<ProductListing[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productsError, setProductsError] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductListing | null>(null);

  // Fetch current seller's products
  async function fetchMyProducts() {
    setLoadingProducts(true);
    setProductsError('');
    try {
      const response = await requestJson<{ listings: ProductListing[] }>('/api/product-listings?my_listings=true');
      setProducts((response.listings as ProductListing[]) ?? []);
    } catch (err) {
      setProductsError(err instanceof Error ? err.message : 'Failed to load products.');
    } finally {
      setLoadingProducts(false);
    }
  }

  useEffect(() => {
    void fetchMyProducts();
  }, [user]);

  function handleOpenCreate() {
    setEditingProduct(null);
    setIsModalOpen(true);
  }

  function handleOpenEdit(product: ProductListing) {
    setEditingProduct(product);
    setIsModalOpen(true);
  }

  async function handleDeleteProduct(id: number) {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      await requestJson(`/api/product-listings/${id}/delete`, {});
      void fetchMyProducts();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete product.');
    }
  }

  const filteredProducts = products.filter((product) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      product.title.toLowerCase().includes(query) ||
      product.category.toLowerCase().includes(query) ||
      (product.brand && product.brand.toLowerCase().includes(query)) ||
      product.description.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleOpenCreate} className="rounded-full bg-ink-900 text-white hover:bg-ink-800">
          + Add Product
        </Button>
      </div>

      {loadingProducts ? (
        <div className="flex py-12 justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-ink-200 border-t-ink-900" />
        </div>
      ) : productsError ? (
        <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">{productsError}</div>
      ) : filteredProducts.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-ink-200 bg-white/60 backdrop-blur-sm py-16 text-center shadow-sm">
          <Icons.Package className="mx-auto h-12 w-12 text-ink-400" />
          <h3 className="mt-4 text-base font-semibold text-ink-900">
            {searchQuery ? 'No matching products found' : 'No products listed yet'}
          </h3>
          <p className="mt-2 text-sm text-ink-600">
            {searchQuery ? 'Try adjusting your search keywords.' : 'Get started by adding your first construction material.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.map((product) => (
            <div key={product.id} className="group relative flex flex-col overflow-hidden rounded-3xl border border-ink-200 bg-white transition-all duration-300 hover:shadow-md">
              <div className="relative h-44 bg-ink-100">
                {product.images && product.images.length > 0 ? (
                  <img src={product.images[0]} alt={product.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-aura-500/10 to-ember-500/10">
                    <span className="text-xs font-medium text-ink-400">No Image</span>
                  </div>
                )}
                <span className="absolute left-4 top-4 rounded-full bg-ink-900/80 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                  {product.category}
                </span>
              </div>
              <div className="flex flex-1 flex-col p-5">
                {product.brand && <p className="text-[10px] font-bold text-aura-600 uppercase tracking-wider">{product.brand}</p>}
                <h3 className="font-display text-lg font-bold text-ink-900 group-hover:text-aura-600 transition-colors">
                  {product.title}
                </h3>
                <div className="mt-4 border-t border-ink-100 pt-3 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-ink-500 font-medium">Rate / Unit</span>
                    <span className="text-ink-900 font-bold">LKR {Number(product.price).toLocaleString()} / {product.unit_type}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-ink-500 font-medium">Stock Level</span>
                    <span className={`font-semibold px-2 py-0.5 rounded-full ${
                      (product.stock_units ?? 0) === 0 
                        ? 'bg-red-50 text-red-700' 
                        : (product.stock_units ?? 0) < 10 
                        ? 'bg-amber-50 text-amber-700' 
                        : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      {(product.stock_units ?? 0).toLocaleString()} {product.unit_type}(s)
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-ink-500 font-medium">Shipping Fee</span>
                    <span className="text-ink-900 font-semibold">
                      {product.shipping_fee && product.shipping_fee > 0 
                        ? `LKR ${Number(product.shipping_fee).toLocaleString()}` 
                        : 'Default province rates'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-t border-ink-100/60 pt-2 font-display">
                    <span className="text-ink-800 font-bold">Total Listing Value</span>
                    <span className="text-sm font-extrabold text-aura-600">
                      LKR {((Number(product.price) * (product.stock_units ?? 0)) + (Number(product.shipping_fee) ?? 0)).toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="mt-auto flex gap-2 border-t border-ink-100 pt-4">
                  <Button variant="outline" className="flex-1 rounded-full text-xs py-1" onClick={() => handleOpenEdit(product)}>
                    Edit
                  </Button>
                  <Button variant="outline" className="rounded-full text-red-600 hover:bg-red-50 border-red-200 hover:text-red-700 text-xs py-1 px-3" onClick={() => void handleDeleteProduct(product.id)}>
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ProductListingModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        product={editingProduct}
        onSaveSuccess={fetchMyProducts}
      />
    </div>
  );
}
