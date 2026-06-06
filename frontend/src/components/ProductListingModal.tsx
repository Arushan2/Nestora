import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { FileUpload } from './ui/file-upload';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { requestForm } from '../lib/api';
import type { ProductListing } from '../types/session';
import districts from '../lib/districts.json';

const productCategories = [
  'Aggregates & Base Materials',
  'Cement & Binding Materials',
  'Bricks & Masonry Blocks',
  'Steel & Reinforcement',
  'Roofing & Ceiling',
  'Timber & Wood Products',
  'Plumbing & Sanitary',
  'Electrical & Wiring',
  'Paints & Finishes',
  'Floor & Wall Finishes',
  'Hardware & Fasteners',
];

const productUnitTypes = [
  'Bag', 'Cube', 'Sqft', 'Piece', 'Kg', 'Liter', 'Linear ft'
];

interface ProductListingModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: ProductListing | null;
  onSaveSuccess: () => void;
}

export function ProductListingModal({ isOpen, onClose, product, onSaveSuccess }: ProductListingModalProps) {
  const [wizardStep, setWizardStep] = useState(1);

  // Form payload state
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(productCategories[0]);
  const [brand, setBrand] = useState('');
  const [description, setDescription] = useState('');
  const [unitType, setUnitType] = useState('Piece');
  const [price, setPrice] = useState<number>(0);
  const [shippingFee, setShippingFee] = useState<number>(0);
  const [stockUnits, setStockUnits] = useState<number>(0);
  const [deliveryTerms, setDeliveryTerms] = useState('');
  const [unloadingProvided, setUnloadingProvided] = useState(false);
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);
  const [portfolioFiles, setPortfolioFiles] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reset/Initialize state when modal opens or product changes
  useEffect(() => {
    if (isOpen) {
      if (product) {
        setTitle(product.title);
        setCategory(product.category);
        setBrand(product.brand ?? '');
        setDescription(product.description);
        setUnitType(product.unit_type);
        setPrice(product.price);
        setShippingFee(product.shipping_fee ?? 0);
        setStockUnits(product.stock_units ?? 0);
        setDeliveryTerms(product.delivery_terms ?? '');
        setUnloadingProvided(product.unloading_provided);
        setSelectedDistricts(product.shipping_districts ?? []);
        setPortfolioFiles([]);
        setExistingImages(product.images ?? []);
      } else {
        setTitle('');
        setCategory(productCategories[0]);
        setBrand('');
        setDescription('');
        setUnitType('Piece');
        setPrice(0);
        setShippingFee(0);
        setStockUnits(0);
        setDeliveryTerms('');
        setUnloadingProvided(false);
        setSelectedDistricts([]);
        setPortfolioFiles([]);
        setExistingImages([]);
      }
      setWizardStep(1);
      setErrorMsg('');
    }
  }, [isOpen, product]);

  function toggleDistrict(districtName: string) {
    setSelectedDistricts((prev) =>
      prev.includes(districtName) ? prev.filter((d) => d !== districtName) : [...prev, districtName]
    );
  }

  function canGoToNextStep() {
    setErrorMsg('');
    if (wizardStep === 1) {
      if (!title.trim()) {
        setErrorMsg('Please enter a product title.');
        return false;
      }
      if (!category) {
        setErrorMsg('Please select a category.');
        return false;
      }
      if (!description.trim() || description.length < 20) {
        setErrorMsg('Description must be at least 20 characters.');
        return false;
      }
    } else if (wizardStep === 2) {
      if (price <= 0) {
        setErrorMsg('Please enter a valid price greater than zero.');
        return false;
      }
    } else if (wizardStep === 3) {
      if (selectedDistricts.length === 0) {
        setErrorMsg('Please select at least one shipping district.');
        return false;
      }
    }
    return true;
  }

  function handleNext() {
    if (canGoToNextStep()) {
      setWizardStep((prev) => Math.min(4, prev + 1));
    }
  }

  function handleBack() {
    setErrorMsg('');
    setWizardStep((prev) => Math.max(1, prev - 1));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (wizardStep < 4) {
      handleNext();
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const form = new FormData();
      form.append('title', title);
      form.append('category', category);
      form.append('description', description);
      form.append('price', price.toString());
      form.append('brand', brand);
      form.append('unit_type', unitType);
      form.append('shipping_districts', JSON.stringify(selectedDistricts));
      form.append('delivery_terms', deliveryTerms);
      form.append('unloading_provided', unloadingProvided ? 'true' : 'false');
      form.append('images', JSON.stringify(existingImages));
      form.append('shipping_fee', (shippingFee || 0).toString());
      form.append('stock_units', (stockUnits || 0).toString());

      portfolioFiles.forEach((file) => {
        form.append('portfolio_images[]', file, file.name);
      });

      const endpoint = product ? `/api/product-listings/${product.id}/update` : '/api/product-listings';
      await requestForm(endpoint, form);
      onClose();
      onSaveSuccess();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to submit product.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog isOpen={isOpen} onClose={onClose}>
      <DialogHeader>
        <DialogTitle>
          {product ? 'Edit Product' : 'Add New Product'}
        </DialogTitle>
        <DialogDescription>
          Showcase your inventory. Follow the 4-step wizard to publish your product.
        </DialogDescription>
      </DialogHeader>

      {/* Step Indicator Progress Bar */}
      <div className="my-6">
        <div className="flex items-center justify-between">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex flex-col items-center flex-1 relative">
              {s < 4 && (
                <div className={`absolute top-4 left-1/2 right-[-50%] h-0.5 -z-10 ${wizardStep > s ? 'bg-aura-500' : 'bg-ink-200'}`} />
              )}
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                wizardStep === s
                  ? 'bg-aura-500 text-white ring-4 ring-aura-100'
                  : wizardStep > s
                  ? 'bg-aura-600 text-white'
                  : 'bg-ink-100 text-ink-500'
              }`}>
                {s}
              </div>
              <span className={`mt-2 text-xs font-medium ${wizardStep === s ? 'text-aura-600 font-semibold' : 'text-ink-500'}`}>
                {s === 1 ? 'Basics' : s === 2 ? 'Pricing' : s === 3 ? 'Districts' : 'Publish'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="max-h-[50vh] overflow-y-auto pr-2 py-1">
          {/* Step 1: Basics */}
          {wizardStep === 1 && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="space-y-2">
                <Label htmlFor="product-title">Product Title</Label>
                <Input
                  id="product-title"
                  placeholder="e.g. Portland Cement Grade 42.5"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
                <p className="text-xs text-ink-500">Provide a clear, engaging title that explains what you specialize in.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="product-category">Category</Label>
                <select
                  id="product-category"
                  className="flex h-11 w-full rounded-2xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 ring-offset-white focus:outline-none focus:ring-2 focus:ring-ink-950 disabled:cursor-not-allowed disabled:opacity-50"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {productCategories.map((cat, i) => (
                    <option key={i} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="product-brand">Brand Name (Optional)</Label>
                <Input
                  id="product-brand"
                  placeholder="e.g. Tokyo Super, S-Lon"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="product-description">Detailed Description</Label>
                <textarea
                  id="product-description"
                  rows={4}
                  placeholder="Describe your product details, grade, specifications, usage instructions, packaging details, and quality standards..."
                  className="flex w-full rounded-2xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 ring-offset-white placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-ink-950 disabled:cursor-not-allowed disabled:opacity-50"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
                <p className="text-xs text-ink-500">Min 20 characters. Explain specifications clearly to attract buyers.</p>
              </div>
            </div>
          )}

          {/* Step 2: Pricing */}
          {wizardStep === 2 && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="product-unit">Unit Type</Label>
                  <select
                    id="product-unit"
                    className="flex h-11 w-full rounded-2xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900"
                    value={unitType}
                    onChange={(e) => setUnitType(e.target.value)}
                  >
                    {productUnitTypes.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-price">Price (LKR) per {unitType}</Label>
                  <Input
                    id="product-price"
                    type="number"
                    min="1"
                    placeholder="e.g. 2500"
                    value={price || ''}
                    onChange={(e) => setPrice(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="product-shipping-fee">Merchant Shipping Fee (LKR)</Label>
                  <Input
                    id="product-shipping-fee"
                    type="number"
                    min="0"
                    placeholder="e.g. 500"
                    value={shippingFee || ''}
                    onChange={(e) => setShippingFee(Number(e.target.value))}
                  />
                  <p className="text-[10px] text-ink-400">Leave empty or 0 for free shipping.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-stock">Stock Units Available</Label>
                  <Input
                    id="product-stock"
                    type="number"
                    min="0"
                    placeholder="e.g. 100"
                    value={stockUnits || ''}
                    onChange={(e) => setStockUnits(Number(e.target.value))}
                  />
                  <p className="text-[10px] text-ink-400">Quantity of materials currently in stock.</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="product-delivery">Delivery Terms</Label>
                <Input
                  id="product-delivery"
                  placeholder="e.g. Free delivery over 50 bags"
                  value={deliveryTerms}
                  onChange={(e) => setDeliveryTerms(e.target.value)}
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="unloading"
                  checked={unloadingProvided}
                  onChange={(e) => setUnloadingProvided(e.target.checked)}
                  className="h-4 w-4 rounded border-ink-300 text-aura-600 focus:ring-aura-600"
                />
                <Label htmlFor="unloading">Unloading provided at site</Label>
              </div>
            </div>
          )}

          {/* Step 3: Districts */}
          {wizardStep === 3 && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Shipping Districts (Sri Lanka)</Label>
                  <p className="text-xs text-ink-500">Select all administrative zones where you can deliver this product.</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedDistricts([...(districts as string[])])}
                    className="text-xs font-semibold text-aura-600 hover:text-aura-700"
                  >
                    Select All
                  </button>
                  <span className="text-ink-300">|</span>
                  <button
                    type="button"
                    onClick={() => setSelectedDistricts([])}
                    className="text-xs font-semibold text-ink-500 hover:text-ink-600"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 rounded-2xl border border-ink-200 bg-ink-50/50 p-4 max-h-60 overflow-y-auto sm:grid-cols-3">
                {(districts as string[]).map((d) => {
                  const isChecked = selectedDistricts.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDistrict(d)}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs transition-colors ${
                        isChecked
                          ? 'border-aura-500 bg-aura-50 text-aura-700 font-semibold shadow-sm'
                          : 'border-ink-200 bg-white text-ink-700 hover:bg-ink-50'
                      }`}
                    >
                      <span className={`h-2.5 w-2.5 rounded-full ${isChecked ? 'bg-aura-500' : 'bg-ink-300'}`} />
                      {d}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-ink-500 font-semibold">{selectedDistricts.length} districts selected.</p>
            </div>
          )}

          {/* Step 4: Preview & Publish */}
          {wizardStep === 4 && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="space-y-2">
                <FileUpload
                  id="portfolio-images"
                  label="Upload Portfolio Photos (Optional)"
                  accept="image/*"
                  multiple={true}
                  existingImages={existingImages}
                  onRemoveExistingImage={(url) => {
                    setExistingImages((prev) => prev.filter((img) => img !== url));
                  }}
                  onChangeMultiple={(files) => setPortfolioFiles(files)}
                  onError={(error) => setErrorMsg(error)}
                />
                <p className="text-xs text-ink-500">Upload one or more snapshots of your product or packaging.</p>
              </div>

              <div className="border-t border-ink-100 pt-4">
                <Label className="text-xs uppercase tracking-wider text-ink-400">Live Preview Card</Label>
                <div className="mt-3 flex justify-center">
                  <div className="w-full max-w-sm overflow-hidden rounded-3xl border border-ink-200 bg-white shadow-md">
                    <div className="relative h-40 bg-ink-100">
                      {portfolioFiles.length > 0 ? (
                        <img
                          src={URL.createObjectURL(portfolioFiles[0])}
                          alt="Preview"
                          className="h-full w-full object-cover"
                        />
                      ) : existingImages.length > 0 ? (
                        <img
                          src={existingImages[0]}
                          alt="Preview"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-aura-500/10 to-ember-500/10">
                          <span className="text-xs text-ink-400">No Image Uploaded</span>
                        </div>
                      )}
                      <span className="absolute left-3 top-3 rounded-full bg-ink-900/80 px-2 py-0.5 text-[10px] font-semibold text-white">
                        {category || 'Category'}
                      </span>
                    </div>

                    <div className="p-4">
                      {brand && <p className="text-[10px] font-bold text-aura-600 uppercase tracking-wider">{brand}</p>}
                      <h4 className="font-display text-base font-bold text-ink-900">
                        {title || 'Product Title'}
                      </h4>
                      <p className="mt-1 text-xs text-ink-500 line-clamp-2">
                        {description || 'No description provided.'}
                      </p>

                      <div className="mt-3 border-t border-ink-100 pt-2 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] text-ink-400 font-semibold">ESTIMATED RATE</p>
                          <p className="text-xs font-bold text-ink-900">
                            LKR {price ? price.toLocaleString() : '0'} / {unitType}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-ink-400 font-semibold">DELIVERING TO</p>
                          <p className="text-xs font-medium text-ink-700">
                            {selectedDistricts.length === 0
                              ? 'No districts'
                              : selectedDistricts.length === 1
                              ? selectedDistricts[0]
                              : `${selectedDistricts[0]} (+${selectedDistricts.length - 1} more)`}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {errorMsg && (
          <p className="text-sm font-semibold text-red-600 animate-pulse">{errorMsg}</p>
        )}

        <DialogFooter>
          <div className="flex w-full justify-between items-center">
            <div>
              {wizardStep > 1 && (
                <Button type="button" variant="outline" onClick={handleBack} disabled={submitting}>
                  Back
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
                Cancel
              </Button>
              {wizardStep < 4 && (
                <Button key="btn-next" type="button" onClick={handleNext}>
                  Next
                </Button>
              )}
              {wizardStep === 4 && (
                <Button key="btn-submit" type="submit" disabled={submitting} className="bg-aura-600 text-white hover:bg-aura-700">
                  {submitting
                    ? 'Saving...'
                    : product
                    ? 'Save Changes'
                    : 'Publish Product'}
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
