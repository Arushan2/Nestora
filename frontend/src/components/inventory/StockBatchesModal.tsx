import { useEffect, useState } from 'react';
import * as Icons from 'lucide-react';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { requestJson } from '../../lib/api';
import type { ProductListing } from '../../types/session';

interface StockBatch {
  id: number;
  product_id: number;
  stock_units: number;
  expiry_date: string | null;
  discount_percentage: number | null;
  discount_price: number | null;
  is_near_expiry: boolean;
  suggested_discount: number;
  created_at: string;
}

interface StockBatchesModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: ProductListing | null;
  onSaveSuccess: () => void;
}

export function StockBatchesModal({ isOpen, onClose, product, onSaveSuccess }: StockBatchesModalProps) {
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [hasExpiryDate, setHasExpiryDate] = useState(false);

  // Form State
  const [quantity, setQuantity] = useState<number>(0);
  const [expiryDate, setExpiryDate] = useState('');
  const [adding, setAdding] = useState(false);

  // Discount state
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [discountPrice, setDiscountPrice] = useState<number>(0);
  const [settingDiscount, setSettingDiscount] = useState(false);

  async function fetchBatches() {
    if (!product) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const response = (await requestJson<any>(
        `/api/inventory/${product.id}/batches`
      )) as unknown as { batches: StockBatch[]; has_expiry_date: boolean };
      setBatches(response.batches ?? []);
      setHasExpiryDate(response.has_expiry_date ?? false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load stock batches.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isOpen && product) {
      void fetchBatches();
      setQuantity(0);
      setExpiryDate('');
      setSelectedBatchId(null);
      setErrorMsg('');
    }
  }, [isOpen, product]);

  async function handleAddBatch(e: React.FormEvent) {
    e.preventDefault();
    if (!product) return;
    if (quantity <= 0) {
      setErrorMsg('Quantity must be greater than zero.');
      return;
    }

    setAdding(true);
    setErrorMsg('');
    try {
      await requestJson(`/api/inventory/${product.id}/batches`, {
        quantity,
        expiry_date: hasExpiryDate && expiryDate ? expiryDate : null,
      });
      setQuantity(0);
      setExpiryDate('');
      await fetchBatches();
      onSaveSuccess();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to add stock batch.');
    } finally {
      setAdding(false);
    }
  }

  async function handleDecreaseStock(batchId: number, currentUnits: number) {
    if (currentUnits <= 0) return;
    setErrorMsg('');
    try {
      await requestJson(`/api/inventory/batches/${batchId}/update`, {
        stock_units: currentUnits - 1,
      });
      await fetchBatches();
      onSaveSuccess();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to decrease stock.');
    }
  }

  function handleOpenDiscount(batch: StockBatch) {
    setSelectedBatchId(batch.id);
    setDiscountPercent(batch.discount_percentage ?? Math.round(batch.suggested_discount));
    
    // Auto-calculate suggested price if no price is overridden
    const basePrice = product?.price ?? 0;
    const suggestedPct = batch.discount_percentage ?? Math.round(batch.suggested_discount);
    const calculatedPrice = basePrice * (1 - suggestedPct / 100);
    setDiscountPrice(batch.discount_price ?? Number(calculatedPrice.toFixed(2)));
  }

  function handlePercentChange(pct: number) {
    setDiscountPercent(pct);
    const basePrice = product?.price ?? 0;
    const calculatedPrice = basePrice * (1 - pct / 100);
    setDiscountPrice(Number(calculatedPrice.toFixed(2)));
  }

  async function handleSaveDiscount() {
    if (selectedBatchId === null) return;
    setSettingDiscount(true);
    setErrorMsg('');
    try {
      await requestJson(`/api/inventory/batches/${selectedBatchId}/update`, {
        discount_percentage: discountPercent > 0 ? discountPercent : null,
        discount_price: discountPercent > 0 ? discountPrice : null,
      });
      setSelectedBatchId(null);
      await fetchBatches();
      onSaveSuccess();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update discount.');
    } finally {
      setSettingDiscount(false);
    }
  }

  function handleUseLastExpiry() {
    if (batches.length === 0) return;
    // Find latest batch with an expiry date
    const latestWithExpiry = [...batches]
      .reverse()
      .find((b) => b.expiry_date !== null);

    if (latestWithExpiry && latestWithExpiry.expiry_date) {
      setExpiryDate(latestWithExpiry.expiry_date);
    }
  }

  return (
    <Dialog isOpen={isOpen} onClose={onClose}>
      <DialogHeader>
        <DialogTitle>Manage Stock: {product?.title}</DialogTitle>
        <DialogDescription>
          Track inventory batches, register expiry dates, and set custom batch discounts.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
        {errorMsg && (
          <div className="rounded-2xl bg-red-50 p-4 text-xs font-semibold text-red-800 animate-pulse">
            {errorMsg}
          </div>
        )}

        {/* Add Batch Form */}
        <form onSubmit={handleAddBatch} className="rounded-3xl border border-ink-100 bg-ink-50/50 p-5 space-y-4">
          <h4 className="font-display text-sm font-bold text-ink-900">Add Stock Batch</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="batch-quantity">Quantity</Label>
              <Input
                id="batch-quantity"
                type="number"
                min="1"
                placeholder="e.g. 50"
                value={quantity || ''}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
            </div>

            {hasExpiryDate && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="batch-expiry">Expiry Date</Label>
                  {batches.some((b) => b.expiry_date !== null) && (
                    <button
                      type="button"
                      onClick={handleUseLastExpiry}
                      className="text-[10px] font-bold text-aura-600 hover:text-aura-700 uppercase"
                    >
                      Use Last Expiry
                    </button>
                  )}
                </div>
                <Input
                  id="batch-expiry"
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                />
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={adding} className="rounded-full bg-ink-900 text-white hover:bg-ink-800">
              {adding ? 'Adding...' : 'Add Batch'}
            </Button>
          </div>
        </form>

        {/* Active Batches Table */}
        <div className="space-y-3">
          <h4 className="font-display text-sm font-bold text-ink-900">Active Stock Batches</h4>
          {loading ? (
            <div className="flex py-8 justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-ink-200 border-t-ink-900" />
            </div>
          ) : batches.length === 0 ? (
            <p className="text-center py-6 text-xs text-ink-500 bg-white border border-dashed border-ink-200 rounded-3xl">
              No stock batches active for this product listing. Please add stock above.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-3xl border border-ink-200 bg-white shadow-sm">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-ink-100 bg-ink-50 text-ink-600 font-semibold uppercase tracking-wider">
                    <th className="p-3">Batch ID</th>
                    <th className="p-3">Stock Count</th>
                    {hasExpiryDate && <th className="p-3">Expiry Date</th>}
                    <th className="p-3">Discount</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {batches.map((batch) => {
                    const isNearExp = batch.is_near_expiry;
                    return (
                      <tr
                        key={batch.id}
                        className={`transition-colors ${isNearExp ? 'bg-amber-50/40 hover:bg-amber-50/60' : 'hover:bg-ink-50/30'}`}
                      >
                        <td className="p-3 font-medium text-ink-900">
                          #{batch.id}
                          {isNearExp && (
                            <span className="ml-2 inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-semibold text-amber-800">
                              <Icons.AlertTriangle className="h-2.5 w-2.5" /> Near Expiry
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-ink-700">{batch.stock_units} units</td>
                        {hasExpiryDate && (
                          <td className="p-3 text-ink-700">
                            {batch.expiry_date ? (
                              <span className={isNearExp ? 'font-bold text-amber-700' : ''}>
                                {batch.expiry_date}
                              </span>
                            ) : (
                              <span className="text-ink-400">N/A</span>
                            )}
                          </td>
                        )}
                        <td className="p-3 text-ink-700">
                          {batch.discount_percentage ? (
                            <span className="font-semibold text-red-600">
                              {batch.discount_percentage}% Off (LKR {Number(batch.discount_price).toLocaleString()})
                            </span>
                          ) : (
                            <span className="text-ink-400">None</span>
                          )}
                        </td>
                        <td className="p-3 text-right flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDecreaseStock(batch.id, batch.stock_units)}
                            title="Manually decrease stock by 1"
                            className="p-1 rounded bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition-colors"
                          >
                            <Icons.Minus className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDiscount(batch)}
                            className="px-2.5 py-1 rounded-full bg-ink-100 hover:bg-ink-200 text-ink-800 font-semibold transition-colors"
                          >
                            {batch.discount_percentage ? 'Edit Disc.' : 'Set Disc.'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Set Discount Inner Modal / Dialog */}
        {selectedBatchId !== null && (
          <div className="rounded-3xl border border-aura-200 bg-aura-50/10 p-5 space-y-4 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between">
              <h4 className="font-display text-sm font-bold text-ink-900">Set Batch Discount</h4>
              <button
                type="button"
                onClick={() => setSelectedBatchId(null)}
                className="text-ink-400 hover:text-ink-600"
              >
                <Icons.X className="h-4 w-4" />
              </button>
            </div>
            
            {/* Auto suggest banner */}
            {(() => {
              const activeBatch = batches.find((b) => b.id === selectedBatchId);
              if (activeBatch && activeBatch.suggested_discount > 0) {
                return (
                  <div className="flex items-center gap-2 rounded-2xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                    <Icons.Lightbulb className="h-4 w-4 text-amber-600" />
                    <span>
                      Near Expiry Batch! Suggested discount: <strong>{Math.round(activeBatch.suggested_discount)}%</strong> based on expiry date.
                    </span>
                    <button
                      type="button"
                      onClick={() => handlePercentChange(Math.round(activeBatch.suggested_discount))}
                      className="ml-auto text-xs font-bold text-aura-600 hover:text-aura-700 underline"
                    >
                      Apply
                    </button>
                  </div>
                );
              }
              return null;
            })()}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="disc-percentage">Discount Percentage (%)</Label>
                <Input
                  id="disc-percentage"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="e.g. 15"
                  value={discountPercent || ''}
                  onChange={(e) => handlePercentChange(Number(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="disc-price">Discounted Unit Price (LKR)</Label>
                <Input
                  id="disc-price"
                  type="number"
                  min="0"
                  placeholder="e.g. 2000"
                  value={discountPrice || ''}
                  onChange={(e) => setDiscountPrice(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSelectedBatchId(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={settingDiscount}
                onClick={handleSaveDiscount}
                className="bg-aura-600 text-white hover:bg-aura-700"
              >
                {settingDiscount ? 'Saving...' : 'Apply Discount'}
              </Button>
            </div>
          </div>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
