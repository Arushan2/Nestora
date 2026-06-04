import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { FileUpload } from './ui/file-upload';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { requestForm } from '../lib/api';
import type { ServiceListing, PricingType } from '../types/session';
import districts from '../lib/districts.json';

const categories = [
  'Masonry & Brickwork',
  'Woodwork & Carpentry',
  'Painting & Wall Finishing',
  'Tiling & Flooring',
  'Electrical & Wiring',
  'Plumbing & Sanitary Works',
  'Roofing & Suspended Ceilings',
  'Steel & Metal Fabrication',
  'Structural & Concrete Works',
  'Architectural & Designing',
];

const categoryPricingTypes: Record<string, string[]> = {
  'Masonry & Brickwork': ['daily_labor', 'sqft'],
  'Woodwork & Carpentry': ['daily_labor', 'sqft', 'linear_ft'],
  'Painting & Wall Finishing': ['sqft', 'daily_labor'],
  'Tiling & Flooring': ['sqft', 'daily_labor'],
  'Electrical & Wiring': ['per_point', 'daily_labor'],
  'Plumbing & Sanitary Works': ['per_point', 'daily_labor', 'linear_ft'],
  'Roofing & Suspended Ceilings': ['sqft', 'linear_ft', 'daily_labor'],
  'Steel & Metal Fabrication': ['linear_ft', 'sqft', 'daily_labor'],
  'Structural & Concrete Works': ['sqft', 'daily_labor'],
  'Architectural & Designing': ['sqft', 'daily_labor'],
};

const pricingTypes = [
  { value: 'daily_labor', label: 'Daily Labor Rate (Wage)', hint: 'E.g. LKR 4,000 per skilled mason per day' },
  { value: 'sqft', label: 'Square Foot (Sqft) Rate', hint: 'E.g. LKR 150 per sqft for plastering or tiling' },
  { value: 'per_point', label: 'Per Point Rate', hint: 'E.g. LKR 800 per light/plug point wiring' },
  { value: 'linear_ft', label: 'Linear Foot (Lft) Rate', hint: 'E.g. LKR 300 per linear foot for roof gutter or skirting' },
];

interface ServiceListingModalProps {
  isOpen: boolean;
  onClose: () => void;
  listing: ServiceListing | null;
  onSaveSuccess: () => void;
}

export function ServiceListingModal({ isOpen, onClose, listing, onSaveSuccess }: ServiceListingModalProps) {
  const [wizardStep, setWizardStep] = useState(1);

  // Form payload state
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(categories[0]);
  const [description, setDescription] = useState('');
  const [pricingType, setPricingType] = useState<PricingType>('daily_labor');
  const [price, setPrice] = useState<number>(0);
  const [priceDetails, setPriceDetails] = useState('');
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);
  const [portfolioFiles, setPortfolioFiles] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reset/Initialize state when modal opens or listing changes
  useEffect(() => {
    if (isOpen) {
      if (listing) {
        setTitle(listing.title);
        setCategory(listing.category);
        setDescription(listing.description);
        setPricingType(listing.pricing_type);
        setPrice(listing.price);
        setPriceDetails(listing.price_details ?? '');
        setSelectedDistricts(listing.cities ?? []);
        setPortfolioFiles([]);
        setExistingImages(listing.images ?? []);
      } else {
        setTitle('');
        setCategory(categories[0]);
        setDescription('');
        setPricingType('daily_labor');
        setPrice(0);
        setPriceDetails('');
        setSelectedDistricts([]);
        setPortfolioFiles([]);
        setExistingImages([]);
      }
      setWizardStep(1);
      setErrorMsg('');
    }
  }, [isOpen, listing]);

  function toggleDistrict(districtName: string) {
    setSelectedDistricts((prev) =>
      prev.includes(districtName) ? prev.filter((d) => d !== districtName) : [...prev, districtName]
    );
  }

  const formatPriceType = (type: string) => {
    switch (type) {
      case 'sqft':
        return 'Sqft';
      case 'daily_labor':
        return 'Day';
      case 'per_point':
        return 'Point';
      case 'linear_ft':
        return 'Lft';
      default:
        return '';
    }
  };

  function canGoToNextStep() {
    setErrorMsg('');
    if (wizardStep === 1) {
      if (!title.trim()) {
        setErrorMsg('Please enter a service title.');
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
        setErrorMsg('Please select at least one serving district.');
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
      form.append('pricing_type', pricingType);
      form.append('price_details', priceDetails);
      form.append('cities', JSON.stringify(selectedDistricts));
      form.append('images', JSON.stringify(existingImages));

      portfolioFiles.forEach((file) => {
        form.append('portfolio_images[]', file, file.name);
      });

      const endpoint = listing ? `/api/service-listings/${listing.id}/update` : '/api/service-listings';
      await requestForm(endpoint, form);
      onClose();
      onSaveSuccess();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to submit listing.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog isOpen={isOpen} onClose={onClose}>
      <DialogHeader>
        <DialogTitle>
          {listing ? 'Edit Service Listing' : 'Add New Service Listing'}
        </DialogTitle>
        <DialogDescription>
          Showcase your skills. Follow the 4-step wizard to publish your listing.
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
                <Label htmlFor="service-title">Service Listing Title</Label>
                <Input
                  id="service-title"
                  placeholder="e.g. Premium Bathroom Wall & Floor Tiling"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
                <p className="text-xs text-ink-500">Provide a clear, engaging title that explains what you specialize in.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="service-category">Category</Label>
                <select
                  id="service-category"
                  className="flex h-11 w-full rounded-2xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 ring-offset-white focus:outline-none focus:ring-2 focus:ring-ink-950 disabled:cursor-not-allowed disabled:opacity-50"
                  value={category}
                  onChange={(e) => {
                    const newCat = e.target.value;
                    setCategory(newCat);
                    const allowed = categoryPricingTypes[newCat] || ['daily_labor', 'sqft'];
                    if (!allowed.includes(pricingType)) {
                      setPricingType(allowed[0] as PricingType);
                    }
                  }}
                >
                  {categories.map((cat, i) => (
                    <option key={i} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="service-description">Detailed Description</Label>
                <textarea
                  id="service-description"
                  rows={4}
                  placeholder="Describe your service, experience, tools used, scaffolding arrangements, crew size, and work quality standard..."
                  className="flex w-full rounded-2xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 ring-offset-white placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-ink-950 disabled:cursor-not-allowed disabled:opacity-50"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
                <p className="text-xs text-ink-500">Min 20 characters. Explain your process clearly to attract clients.</p>
              </div>
            </div>
          )}

          {/* Step 2: Pricing */}
          {wizardStep === 2 && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="space-y-2">
                <Label>Choose Pricing Format</Label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {pricingTypes
                    .filter((pt) => (categoryPricingTypes[category] || ['daily_labor', 'sqft']).includes(pt.value))
                    .map((pt) => (
                      <button
                        key={pt.value}
                        type="button"
                        onClick={() => setPricingType(pt.value as PricingType)}
                        className={`flex flex-col items-start p-4 rounded-2xl border-2 text-left transition-all ${
                          pricingType === pt.value
                            ? 'border-aura-500 bg-aura-50/50'
                            : 'border-ink-200 bg-white hover:bg-ink-50'
                        }`}
                      >
                        <span className="font-semibold text-sm text-ink-900">{pt.label}</span>
                        <span className="text-xs text-ink-500 mt-1">{pt.hint}</span>
                      </button>
                    ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="service-price">
                    Rate (LKR) per {formatPriceType(pricingType)}
                  </Label>
                  <Input
                    id="service-price"
                    type="number"
                    min="1"
                    placeholder="e.g. 4500"
                    value={price || ''}
                    onChange={(e) => setPrice(Number(e.target.value))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="price-details">Rate Details / Inclusions</Label>
                  <Input
                    id="price-details"
                    placeholder="e.g. Labor only, scaffolding excluded"
                    value={priceDetails}
                    onChange={(e) => setPriceDetails(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Districts */}
          {wizardStep === 3 && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Serving Districts (Sri Lanka)</Label>
                  <p className="text-xs text-ink-500">Select all administrative zones where you can mobilize your crew.</p>
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
                <p className="text-xs text-ink-500">Upload one or more snapshots of your past construction sites or completed work.</p>
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
                      <h4 className="font-display text-base font-bold text-ink-900">
                        {title || 'Service Title'}
                      </h4>
                      <p className="mt-1 text-xs text-ink-500 line-clamp-2">
                        {description || 'No description provided.'}
                      </p>

                      <div className="mt-3 border-t border-ink-100 pt-2 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] text-ink-400 font-semibold">ESTIMATED RATE</p>
                          <p className="text-xs font-bold text-ink-900">
                            LKR {price ? price.toLocaleString() : '0'} / {formatPriceType(pricingType)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-ink-400 font-semibold">SERVING</p>
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
                    : listing
                    ? 'Save Changes'
                    : 'Publish Listing'}
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
