import { useEffect, useState } from 'react';
import { HeaderBar } from '../../components/HeaderBar';
import { Button } from '../../components/ui/button';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import { FileUpload } from '../../components/ui/file-upload';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { requestJson, requestForm } from '../../lib/api';
import type { User, ServiceListing, PricingType } from '../../types/session';
import districts from '../../lib/districts.json';

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

export function DashboardPage({ user, onLogout }: { user: User; onLogout: () => Promise<void> }) {
  const label = user.role === 'service_provider' ? 'Service Provider Workspace' : 'Product Seller Workspace';
  const isServiceProvider = user.role === 'service_provider';

  const [listings, setListings] = useState<ServiceListing[]>([]);
  const [loadingListings, setLoadingListings] = useState(false);
  const [listingsError, setListingsError] = useState('');

  // Modal / Wizard State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [editingListing, setEditingListing] = useState<ServiceListing | null>(null);

  // Form payload state
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [pricingType, setPricingType] = useState<PricingType>('daily_labor');
  const [price, setPrice] = useState<number>(0);
  const [priceDetails, setPriceDetails] = useState('');
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);
  const [portfolioFiles, setPortfolioFiles] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Fetch current provider's listings
  async function fetchMyListings() {
    if (!isServiceProvider) return;
    setLoadingListings(true);
    setListingsError('');
    try {
      const response = await requestJson<{ listings: ServiceListing[] }>('/api/service-listings?my_listings=true');
      setListings((response.listings as ServiceListing[]) ?? []);
    } catch (err) {
      setListingsError(err instanceof Error ? err.message : 'Failed to load service listings.');
    } finally {
      setLoadingListings(false);
    }
  }

  useEffect(() => {
    void fetchMyListings();
  }, [user]);

  // Open modal to create a new listing
  function handleOpenCreate() {
    setEditingListing(null);
    setTitle('');
    setCategory(categories[0]);
    setDescription('');
    setPricingType('daily_labor');
    setPrice(0);
    setPriceDetails('');
    setSelectedDistricts([]);
    setPortfolioFiles([]);
    setExistingImages([]);
    setErrorMsg('');
    setWizardStep(1);
    setIsModalOpen(true);
  }

  // Open modal to edit listing
  function handleOpenEdit(listing: ServiceListing) {
    setEditingListing(listing);
    setTitle(listing.title);
    setCategory(listing.category);
    setDescription(listing.description);
    setPricingType(listing.pricing_type);
    setPrice(listing.price);
    setPriceDetails(listing.price_details ?? '');
    setSelectedDistricts(listing.cities ?? []);
    setPortfolioFiles([]);
    setExistingImages(listing.images ?? []);
    setErrorMsg('');
    setWizardStep(1);
    setIsModalOpen(true);
  }

  // Delete listing
  async function handleDeleteListing(id: number) {
    if (!confirm('Are you sure you want to delete this listing?')) return;
    try {
      await requestJson(`/api/service-listings/${id}/delete`, {});
      void fetchMyListings();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete listing.');
    }
  }

  // Handle District Toggle
  function toggleDistrict(districtName: string) {
    setSelectedDistricts((prev) =>
      prev.includes(districtName) ? prev.filter((d) => d !== districtName) : [...prev, districtName]
    );
  }

  // Next Step Validation
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

  // Submit Listing
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
      form.append('pricing_type', pricingType);
      form.append('price', price.toString());
      form.append('price_details', priceDetails);
      form.append('cities', JSON.stringify(selectedDistricts));

      // Send the updated list of remaining existing images
      form.append('images', JSON.stringify(existingImages));

      // Send all newly selected portfolio images
      console.log('Sending portfolioFiles to backend:', portfolioFiles);
      portfolioFiles.forEach((file) => {
        form.append('portfolio_images[]', file, file.name);
      });

      const endpoint = editingListing
        ? `/api/service-listings/${editingListing.id}/update`
        : '/api/service-listings';

      await requestForm(endpoint, form);
      setIsModalOpen(false);
      void fetchMyListings();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to submit listing.');
    } finally {
      setSubmitting(false);
    }
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

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-6 md:px-8">
      <HeaderBar user={user} onLogout={onLogout} />

      <section className="mt-8 rounded-3xl border border-white/70 bg-white/95 p-6 shadow-glow md:p-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-aura-600">Pro Workspace</p>
            <h1 className="mt-2 font-display text-3xl font-bold text-ink-900 md:text-4xl">{label}</h1>
            <p className="mt-2 text-sm text-ink-600">
              Welcome back, {user.name}. Manage your business profile, service offerings, and pricing details.
            </p>
          </div>
          {isServiceProvider && (
            <div>
              <Button onClick={handleOpenCreate} className="rounded-full bg-ink-900 text-white hover:bg-ink-800">
                + Create Service Listing
              </Button>
            </div>
          )}
        </div>

        {isServiceProvider ? (
          <Tabs defaultValue="listings" className="mt-8">
            <TabsList className="max-w-md">
              <TabsTrigger value="listings">My Service Listings</TabsTrigger>
              <TabsTrigger value="overview">Overview & Stats</TabsTrigger>
            </TabsList>

            <TabsContent value="listings" className="pt-4">
              {loadingListings ? (
                <div className="flex py-12 justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-ink-200 border-t-ink-900" />
                </div>
              ) : listingsError ? (
                <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">{listingsError}</div>
              ) : listings.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-ink-200 bg-ink-50/50 py-16 text-center">
                  <svg className="mx-auto h-12 w-12 text-ink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                  <h3 className="mt-4 text-base font-semibold text-ink-900">No services listed yet</h3>
                  <p className="mt-2 text-sm text-ink-600">Get started by listing your first construction service.</p>
                  <Button onClick={handleOpenCreate} className="mt-6 rounded-full bg-ink-900 text-white hover:bg-ink-800">
                    Add First Service
                  </Button>
                </div>
              ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {listings.map((listing) => (
                    <div key={listing.id} className="group relative flex flex-col overflow-hidden rounded-3xl border border-ink-200 bg-white transition-all duration-300 hover:shadow-md">
                      <div className="relative h-44 bg-ink-100">
                        {listing.images && listing.images.length > 0 ? (
                          <img src={listing.images[0]} alt={listing.title} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-aura-500/10 to-ember-500/10">
                            <span className="text-xs font-medium text-ink-400">No Image Uploaded</span>
                          </div>
                        )}
                        <span className="absolute left-4 top-4 rounded-full bg-ink-900/80 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                          {listing.category}
                        </span>
                      </div>

                      <div className="flex flex-1 flex-col p-5">
                        <h3 className="font-display text-lg font-bold text-ink-900 group-hover:text-aura-600 transition-colors">
                          {listing.title}
                        </h3>
                        <p className="mt-2 text-xs text-ink-500 line-clamp-2 leading-relaxed">
                          {listing.description}
                        </p>

                        <div className="mt-4 border-t border-ink-100 pt-3">
                          <p className="text-xs text-ink-400 font-semibold uppercase tracking-wider">Pricing Format</p>
                          <p className="mt-1 font-display font-semibold text-ink-900">
                            LKR {Number(listing.price).toLocaleString()} / {formatPriceType(listing.pricing_type)}
                          </p>
                          {listing.price_details && (
                            <p className="text-xs text-ink-500 italic mt-0.5">"{listing.price_details}"</p>
                          )}
                        </div>

                        <div className="mt-3">
                          <p className="text-xs text-ink-400 font-semibold uppercase tracking-wider">Service Area</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {listing.cities.slice(0, 3).map((c, i) => (
                              <span key={i} className="rounded bg-ink-100 px-2 py-0.5 text-[10px] font-medium text-ink-700">
                                {c}
                              </span>
                            ))}
                            {listing.cities.length > 3 && (
                              <span className="rounded bg-ink-100 px-2 py-0.5 text-[10px] font-medium text-ink-700">
                                +{listing.cities.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="mt-auto flex gap-2 border-t border-ink-100 pt-4">
                          <Button variant="outline" className="flex-1 rounded-full text-xs py-1" onClick={() => handleOpenEdit(listing)}>
                            Edit
                          </Button>
                          <Button variant="outline" className="rounded-full text-red-600 hover:bg-red-50 border-red-200 hover:text-red-700 text-xs py-1 px-3" onClick={() => void handleDeleteListing(listing.id)}>
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="overview">
              <div className="mt-4 grid gap-6 md:grid-cols-3">
                <MiniCard title="Business Entity" value={user.application?.business_name ?? 'Individual Pro'} />
                <MiniCard title="Total Listed Services" value={listings.length.toString()} />
                <MiniCard title="Verified Districts" value={(user.application as any)?.business_city ?? 'Colombo'} />
              </div>
              <div className="mt-6 rounded-3xl bg-ink-50 p-6 border border-ink-200">
                <h3 className="font-display text-lg font-semibold text-ink-900">Tips for Construction Providers in Sri Lanka</h3>
                <ul className="mt-4 space-y-3 text-sm text-ink-600 list-disc list-inside">
                  <li><strong>Update prices frequently:</strong> Because materials and wages fluctuate rapidly in Sri Lanka, keep your rates up to date to avoid BOQ discrepancies.</li>
                  <li><strong>Detail your rate boundaries:</strong> Specify in the pricing description whether tools, scaffolding, helper costs, or basic materials are included in your Square Foot or Daily wage estimates.</li>
                  <li><strong>Cover multiple districts:</strong> Expanding your serving districts to surrounding zones like Gampaha or Kalutara if you are based in Colombo will increase your booking flow.</li>
                </ul>
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="mt-6 rounded-2xl bg-ink-50 p-6">
            <p className="text-base font-semibold text-ink-800">Product Seller Workspace Dashboard</p>
            <p className="text-sm text-ink-600 mt-2">
              You are signed in as a Product Seller. This area will support managing inventory and product listings.
            </p>
          </div>
        )}
      </section>

      {/* Listing Onboarding Wizard Modal */}
      <Dialog isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <DialogHeader>
          <DialogTitle>{editingListing ? 'Edit Service Listing' : 'Add New Service Listing'}</DialogTitle>
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
                <Label htmlFor="service-category">Construction Service Category</Label>
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
                  <p className="text-xs text-ink-500">Specify what is included in this estimate (materials, helpers, tools).</p>
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
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} disabled={submitting}>
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
                      : editingListing
                      ? 'Save Changes'
                      : 'Publish Listing'}
                  </Button>
                )}
              </div>
            </div>
          </DialogFooter>
        </form>
      </Dialog>
    </main>
  );
}

function MiniCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-3xl border border-ink-200 bg-ink-50/50 p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-500">{title}</p>
      <p className="mt-2 text-base font-bold text-ink-900">{value}</p>
    </div>
  );
}
