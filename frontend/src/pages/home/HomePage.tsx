import { useEffect, useState, useRef } from 'react';
import { ArrowDown, Search, FilterX, HelpCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { HeaderBar } from '../../components/HeaderBar';
import { requestJson } from '../../lib/api';
import type { User as UserType, ServiceListing, ProductListing, Profile } from '../../types/session';
import { ServiceCard } from '../../components/ServiceCard';
import { ProductCard } from '../../components/ProductCard';
import { ProviderCard } from '../../components/ProviderCard';
import districts from '../../lib/districts.json';

const serviceCategories = [
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

const pricingFormats = [
  { value: 'daily_labor', label: 'Daily Labor Wage' },
  { value: 'sqft', label: 'Square Foot (Sqft)' },
  { value: 'per_point', label: 'Per Point' },
  { value: 'linear_ft', label: 'Linear Foot' },
];

function SkeletonCard() {
  return (
    <div className="rounded-3xl border border-ink-100 bg-white p-6 space-y-4 animate-pulse">
      <div className="relative h-48 rounded-2xl bg-ink-100/70" />
      <div className="space-y-3">
        <div className="h-5 w-2/3 rounded bg-ink-200" />
        <div className="h-3 w-full rounded bg-ink-100" />
        <div className="h-3 w-5/6 rounded bg-ink-100" />
      </div>
      <div className="pt-2 border-t border-ink-100/50 space-y-2">
        <div className="h-2 w-1/4 rounded bg-ink-100" />
        <div className="h-5 w-1/2 rounded bg-ink-200" />
      </div>
      <div className="pt-3 border-t border-ink-100/50 flex justify-between items-center">
        <div className="space-y-1">
          <div className="h-2 w-12 rounded bg-ink-100" />
          <div className="h-4 w-24 rounded bg-ink-200" />
        </div>
        <div className="h-8 w-24 rounded-full bg-ink-900/10" />
      </div>
    </div>
  );
}

export function HomePage({
  user,
  notice,
  onLogout,
}: {
  user: UserType | null;
  notice: string;
  onLogout: () => Promise<void>;
}) {
  const isPro = user?.role === 'service_provider' || user?.role === 'product_seller';
  const isAdmin = user?.role === 'admin';
  const isPending = user?.application?.status === 'pending' && user?.role === 'user';
  const actionLabel = isAdmin ? 'Admin' : isPro ? 'Dashboard' : isPending ? 'Pending review' : 'Join as Pro';
  const actionTo = isAdmin ? '/admin' : isPro ? '/dashboard' : isPending ? '/' : '/join-as-pro';

  // Search Context Tab
  const [searchType, setSearchType] = useState<'all' | 'services' | 'products' | 'providers' | 'sellers'>('all');

  // Lazy loading interaction guard
  const [hasInteracted, setHasInteracted] = useState(false);

  // Search Inputs
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [pricingTypeFilter, setPricingTypeFilter] = useState('');

  // Search Data Results
  const [services, setServices] = useState<ServiceListing[]>([]);
  const [products, setProducts] = useState<ProductListing[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Scroll Snap Refs
  const snappedRef = useRef(false);        // true while a snap animation is in progress
  const hasSnappedOnce = useRef(false);    // permanently true after the first snap
  const lastScrollY = useRef(0);           // tracks previous scroll position for direction detection

  // Debounce the text search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Reset category filters when search type changes to avoid mismatch
  useEffect(() => {
    setCategoryFilter('');
    setPricingTypeFilter('');
    setDistrictFilter('');
    setSearchQuery('');
    setDebouncedQuery('');
  }, [searchType]);

  // Fetch results based on filters
  useEffect(() => {
    if (!hasInteracted) return;

    async function fetchResults() {
      setLoading(true);
      setError('');
      try {
        if (searchType === 'all') {
          // Fetch both services and products (latest 9)
          const sUrl = `/api/service-listings?limit=9&q=${encodeURIComponent(debouncedQuery)}&category=${encodeURIComponent(categoryFilter)}&district=${encodeURIComponent(districtFilter)}&pricing_type=${encodeURIComponent(pricingTypeFilter)}`;
          const pUrl = `/api/product-listings?limit=9&q=${encodeURIComponent(debouncedQuery)}&category=${encodeURIComponent(categoryFilter)}&district=${encodeURIComponent(districtFilter)}`;
          
          const [sRes, pRes] = await Promise.all([
            requestJson<unknown>(sUrl),
            requestJson<unknown>(pUrl)
          ]);
          
          const sData = sRes as unknown as { listings: ServiceListing[] };
          const pData = pRes as unknown as { listings: ProductListing[] };
          
          setServices(sData.listings ?? []);
          setProducts(pData.listings ?? []);
        } else if (searchType === 'services') {
          const url = `/api/service-listings?q=${encodeURIComponent(debouncedQuery)}&category=${encodeURIComponent(categoryFilter)}&district=${encodeURIComponent(districtFilter)}&pricing_type=${encodeURIComponent(pricingTypeFilter)}`;
          const response = (await requestJson<unknown>(url)) as unknown as { listings: ServiceListing[] };
          setServices(response.listings ?? []);
        } else if (searchType === 'products') {
          const url = `/api/product-listings?q=${encodeURIComponent(debouncedQuery)}&category=${encodeURIComponent(categoryFilter)}&district=${encodeURIComponent(districtFilter)}`;
          const response = (await requestJson<unknown>(url)) as unknown as { listings: ProductListing[] };
          setProducts(response.listings ?? []);
        } else if (searchType === 'providers' || searchType === 'sellers') {
          const role = searchType === 'providers' ? 'service_provider' : 'product_seller';
          const url = `/api/profiles?role=${role}&q=${encodeURIComponent(debouncedQuery)}&category=${encodeURIComponent(categoryFilter)}&city=${encodeURIComponent(districtFilter)}`;
          const response = (await requestJson<unknown>(url)) as unknown as { profiles: Profile[] };
          setProfiles(response.profiles ?? []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch search results.');
      } finally {
        setLoading(false);
      }
    }

    void fetchResults();
  }, [searchType, debouncedQuery, categoryFilter, districtFilter, pricingTypeFilter, hasInteracted]);

  // Magic Scroll: Snap down to the marketplace section ONCE on first downward scroll from the hero
  useEffect(() => {
    const handleScroll = () => {
      const scrollPos = window.scrollY;
      const scrollingDown = scrollPos > lastScrollY.current;
      lastScrollY.current = scrollPos;

      // Trigger lazy data load once the user scrolls at all
      if (scrollPos > 10) {
        setHasInteracted(true);
      }

      // Only snap if: scrolling DOWN, in the hero zone, never snapped before, and not mid-animation
      if (
        scrollingDown &&
        scrollPos > 15 &&
        scrollPos < 300 &&
        !hasSnappedOnce.current &&
        !snappedRef.current
      ) {
        snappedRef.current = true;
        hasSnappedOnce.current = true; // permanently disable future snaps
        document.getElementById('search-marketplace')?.scrollIntoView({ behavior: 'smooth' });
        setTimeout(() => {
          snappedRef.current = false;
        }, 1200);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  function handleClearFilters() {
    setSearchQuery('');
    setCategoryFilter('');
    setDistrictFilter('');
    setPricingTypeFilter('');
  }

  const hasActiveFilters = searchQuery !== '' || categoryFilter !== '' || districtFilter !== '' || pricingTypeFilter !== '';

  // Resolving Placeholders based on category selection
  const searchPlaceholder = (() => {
    switch (searchType) {
      case 'all':
        return 'Search cement, tiling, masonry, woodwork, plumbing...';
      case 'services':
        return 'Search concrete, tiling, painting, plumbing experts...';
      case 'products':
        return 'Search cement bags, reinforcement steel, roof tiles, timber...';
      case 'providers':
        return 'Search verified contractors, engineering firms, plumbers...';
      case 'sellers':
        return 'Search local hardware stores, cement warehouses, dealers...';
    }
  })();

  const triggerInteraction = () => {
    setHasInteracted(true);
  };

  return (
    <>
      {/* Hero section */}
      <div className="bg-ink-50/50 flex flex-col min-h-[85vh] relative overflow-hidden">
        {/* Background Decorative Blobs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1000px] h-full pointer-events-none opacity-40">
          <div className="absolute -top-[20%] -left-[10%] w-[500px] h-[500px] rounded-full bg-aura-300 blur-[100px]" />
          <div className="absolute top-[20%] -right-[10%] w-[400px] h-[400px] rounded-full bg-ember-200 blur-[100px]" />
        </div>

        <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 lg:px-10 w-full z-10">
          <HeaderBar user={user} onLogout={onLogout} />
        </div>

        <div className="flex-1 flex flex-col justify-center items-center text-center px-4 py-12 pb-20 z-10 max-w-5xl mx-auto w-full">
          <div className="inline-flex items-center gap-2 rounded-full border border-aura-200 bg-white/60 backdrop-blur px-4 py-2 text-sm font-medium text-aura-800 mb-8 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-aura-500 animate-pulse" />
            Home for verified construction professionals
          </div>

          <h1 className="font-display text-5xl font-bold tracking-tight text-ink-900 md:text-6xl lg:text-7xl leading-[1.1]">
            Build, book, and grow your service business with{' '}
            <span className="bg-gradient-to-r from-aura-500 to-ember-500 bg-clip-text text-transparent">Nestora</span>.
          </h1>

          <p className="max-w-2xl text-base leading-7 text-ink-600 md:text-xl md:leading-8 mt-6">
            Nestora connects Sri Lankan homebuilders and renovation clients with verified masonry, tiling, electrical, and carpentry experts.
          </p>

          <div className="flex flex-wrap justify-center gap-3 mt-10">
            {isPending ? (
              <span className="rounded-full bg-amber-100 border border-amber-200 px-6 py-3.5 text-sm font-semibold text-amber-800">
                Pending review
              </span>
            ) : (
              <Link to={actionTo} className="rounded-full bg-gradient-to-r from-aura-500 to-aura-600 px-8 py-4 text-sm font-semibold text-white transition-all hover:shadow-lg hover:shadow-aura-500/30 hover:scale-105 shadow-md">
                {actionLabel}
              </Link>
            )}
            {!user ? (
              <Link to="/auth" className="rounded-full border border-ink-200 bg-white px-8 py-4 text-sm font-semibold text-ink-900 transition-all hover:bg-ink-50 shadow-sm">
                Sign in
              </Link>
            ) : null}
          </div>
        </div>

        {/* Scroll Hint */}
        <div
          className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 cursor-pointer z-10"
          onClick={() => {
            triggerInteraction();
            document.getElementById('search-marketplace')?.scrollIntoView({ behavior: 'smooth' });
          }}
        >
          <span className="text-xs uppercase tracking-widest text-ink-400 font-semibold">Scroll to Search</span>
          <ArrowDown className="w-5 h-5 text-ink-400 animate-bounce" strokeWidth={2} />
        </div>
      </div>

      {/* Global Search and Results Marketplace Section */}
      <section id="search-marketplace" className="mx-auto max-w-7xl px-4 md:px-8 lg:px-10 py-12 pb-24">
        <div className="rounded-3xl border border-white/70 bg-white/85 p-6 shadow-glow backdrop-blur md:p-8 space-y-8">
          
          {/* Header */}
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-aura-600">Search Engine</p>
            <h2 className="font-display text-3xl font-bold text-ink-900 md:text-4xl">Explore Construction Marketplace</h2>
            <p className="text-sm text-ink-500">
              Select a category below, enter your query, and filter results by location, specialty, or pricing format.
            </p>
          </div>

          {/* Category Tabs Selector */}
          <div className="flex flex-wrap justify-center gap-2 border-b border-ink-100 pb-6">
            <button
              onClick={() => {
                triggerInteraction();
                setSearchType('all');
              }}
              className={`rounded-full px-5 py-2.5 text-xs font-bold transition-all shadow-sm ${
                searchType === 'all'
                  ? 'bg-ink-900 text-white hover:bg-ink-800'
                  : 'bg-white border border-ink-200 text-ink-700 hover:bg-ink-50'
              }`}
            >
              All Categories
            </button>
            <button
              onClick={() => {
                triggerInteraction();
                setSearchType('services');
              }}
              className={`rounded-full px-5 py-2.5 text-xs font-bold transition-all shadow-sm ${
                searchType === 'services'
                  ? 'bg-ink-900 text-white hover:bg-ink-800'
                  : 'bg-white border border-ink-200 text-ink-700 hover:bg-ink-50'
              }`}
            >
              Services
            </button>
            <button
              onClick={() => {
                triggerInteraction();
                setSearchType('products');
              }}
              className={`rounded-full px-5 py-2.5 text-xs font-bold transition-all shadow-sm ${
                searchType === 'products'
                  ? 'bg-ink-900 text-white hover:bg-ink-800'
                  : 'bg-white border border-ink-200 text-ink-700 hover:bg-ink-50'
              }`}
            >
              Building Materials
            </button>
            <button
              onClick={() => {
                triggerInteraction();
                setSearchType('providers');
              }}
              className={`rounded-full px-5 py-2.5 text-xs font-bold transition-all shadow-sm ${
                searchType === 'providers'
                  ? 'bg-ink-900 text-white hover:bg-ink-800'
                  : 'bg-white border border-ink-200 text-ink-700 hover:bg-ink-50'
              }`}
            >
              Service Providers
            </button>
            <button
              onClick={() => {
                triggerInteraction();
                setSearchType('sellers');
              }}
              className={`rounded-full px-5 py-2.5 text-xs font-bold transition-all shadow-sm ${
                searchType === 'sellers'
                  ? 'bg-ink-900 text-white hover:bg-ink-800'
                  : 'bg-white border border-ink-200 text-ink-700 hover:bg-ink-50'
              }`}
            >
              Material Sellers
            </button>
          </div>

          {/* Filter Bar Panel */}
          <div className="bg-ink-50/50 p-5 rounded-2xl border border-ink-150 space-y-4">
            <div className="grid gap-4 md:grid-cols-[1.5fr_1fr_1fr_auto]">
              
              {/* Keyword Text Input */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-ink-400" />
                <input
                  type="text"
                  placeholder={searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => {
                    triggerInteraction();
                    setSearchQuery(e.target.value);
                  }}
                  className="h-11 w-full rounded-xl border border-ink-200 bg-white pl-11 pr-4 text-sm text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-ink-950 shadow-sm"
                />
              </div>

              {/* Category Dropdown */}
              <div>
                <select
                  value={categoryFilter}
                  onChange={(e) => {
                    triggerInteraction();
                    setCategoryFilter(e.target.value);
                  }}
                  className="h-11 w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-ink-950 shadow-sm"
                >
                  <option value="">All Categories</option>
                  
                  {searchType === 'all' && (
                    <>
                      <optgroup label="Services Offered">
                        {serviceCategories.map((c, i) => (
                          <option key={`s-${i}`} value={c}>{c}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Building Materials">
                        {productCategories.map((c, i) => (
                          <option key={`p-${i}`} value={c}>{c}</option>
                        ))}
                      </optgroup>
                    </>
                  )}

                  {(searchType === 'services' || searchType === 'providers') && (
                    serviceCategories.map((c, i) => (
                      <option key={i} value={c}>{c}</option>
                    ))
                  )}

                  {(searchType === 'products' || searchType === 'sellers') && (
                    productCategories.map((c, i) => (
                      <option key={i} value={c}>{c}</option>
                    ))
                  )}
                </select>
              </div>

              {/* Location (District) Dropdown */}
              <div>
                <select
                  value={districtFilter}
                  onChange={(e) => {
                    triggerInteraction();
                    setDistrictFilter(e.target.value);
                  }}
                  className="h-11 w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-ink-950 shadow-sm"
                >
                  <option value="">
                    {searchType === 'services' || searchType === 'providers' || searchType === 'all' ? 'All Operating Districts' : 'All Shipping Districts'}
                  </option>
                  {districts.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              {/* Services Pricing format dropdown / Clear filters button */}
              {(searchType === 'services' || searchType === 'all') && (
                <div>
                  <select
                    value={pricingTypeFilter}
                    onChange={(e) => {
                      triggerInteraction();
                      setPricingTypeFilter(e.target.value);
                    }}
                    className="h-11 w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-ink-950 shadow-sm"
                  >
                    <option value="">All Pricing Formats</option>
                    {pricingFormats.map((f, i) => (
                      <option key={i} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Clear filters shortcut */}
              {hasActiveFilters && (
                <div className="flex items-center justify-end">
                  <button
                    onClick={handleClearFilters}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100/50 border border-red-100 rounded-xl px-4 py-3 h-11 shrink-0 transition-colors shadow-sm"
                  >
                    <FilterX className="w-4 h-4" />
                    Reset
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Results section */}
          <div>
            {/* Status indicator */}
            <div className="flex items-center justify-between mb-6 pb-2 border-b border-ink-100">
              <span className="text-xs font-semibold text-ink-400 uppercase tracking-wider">
                {!hasInteracted
                  ? 'Ready to search'
                  : loading
                  ? 'Searching database...'
                  : searchType === 'all'
                  ? 'All Categories'
                  : `Search Results (${
                      searchType === 'services'
                        ? services.length
                        : searchType === 'products'
                        ? products.length
                        : profiles.length
                    })`}
              </span>
            </div>

            {(!hasInteracted || loading) ? (
              searchType === 'all' ? (
                <div className="space-y-12 animate-pulse">
                  <div>
                    <h3 className="font-display text-xl font-bold text-ink-950 mb-6">Latest Construction Services</h3>
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                      <SkeletonCard />
                      <SkeletonCard />
                      <SkeletonCard />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-display text-xl font-bold text-ink-950 mb-6 pt-6 border-t border-ink-100">Latest Construction Materials</h3>
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                      <SkeletonCard />
                      <SkeletonCard />
                      <SkeletonCard />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  <SkeletonCard />
                  <SkeletonCard />
                  <SkeletonCard />
                </div>
              )
            ) : error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                {error}
              </div>
            ) : (
              <>
                {/* ── Render ALL Tab: latest 9 services + latest 9 products ── */}
                {searchType === 'all' && (
                  <div className="space-y-12">
                    {/* Services Column */}
                    <div>
                      <div className="flex justify-between items-center mb-6">
                        <h3 className="font-display text-xl font-bold text-ink-900">Latest Construction Services</h3>
                        <button
                          onClick={() => {
                            triggerInteraction();
                            setSearchType('services');
                          }}
                          className="text-xs font-bold text-aura-600 hover:underline"
                        >
                          View all services &rarr;
                        </button>
                      </div>
                      {services.length === 0 ? (
                        <p className="text-sm text-ink-500 py-4 italic">No construction services currently listed.</p>
                      ) : (
                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                          {services.map((service) => (
                            <ServiceCard key={service.id} listing={service} />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Products Column */}
                    <div>
                      <div className="flex justify-between items-center mb-6 pt-6 border-t border-ink-100">
                        <h3 className="font-display text-xl font-bold text-ink-900">Latest Construction Materials</h3>
                        <button
                          onClick={() => {
                            triggerInteraction();
                            setSearchType('products');
                          }}
                          className="text-xs font-bold text-aura-600 hover:underline"
                        >
                          View all materials &rarr;
                        </button>
                      </div>
                      {products.length === 0 ? (
                        <p className="text-sm text-ink-500 py-4 italic">No building materials currently listed.</p>
                      ) : (
                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                          {products.map((product) => (
                            <ProductCard key={product.id} product={product} />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Render Services ── */}
                {searchType === 'services' && (
                  services.length === 0 ? (
                    <EmptyResultsState query={debouncedQuery} type="services" onClear={handleClearFilters} />
                  ) : (
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                      {services.map((service) => (
                        <ServiceCard key={service.id} listing={service} />
                      ))}
                    </div>
                  )
                )}

                {/* ── Render Products/Materials ── */}
                {searchType === 'products' && (
                  products.length === 0 ? (
                    <EmptyResultsState query={debouncedQuery} type="materials" onClear={handleClearFilters} />
                  ) : (
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                      {products.map((product) => (
                        <ProductCard key={product.id} product={product} />
                      ))}
                    </div>
                  )
                )}

                {/* ── Render Service Providers & Shops ── */}
                {(searchType === 'providers' || searchType === 'sellers') && (
                  profiles.length === 0 ? (
                    <EmptyResultsState query={debouncedQuery} type="vendors" onClear={handleClearFilters} />
                  ) : (
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                      {profiles.map((profile) => (
                        <ProviderCard key={profile.id} profile={profile} />
                      ))}
                    </div>
                  )
                )}
              </>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

function EmptyResultsState({ query, type, onClear }: { query: string; type: string; onClear: () => void }) {
  return (
    <div className="rounded-3xl border border-dashed border-ink-200 bg-white/60 py-16 px-6 text-center max-w-xl mx-auto shadow-sm">
      <HelpCircle className="mx-auto h-12 w-12 text-ink-400" />
      <h3 className="mt-4 text-base font-semibold text-ink-900">No matching results found</h3>
      <p className="mt-2 text-sm text-ink-600">
        We couldn't find any {type} matching your filters {query ? `for "${query}"` : ''}. Try adjusting your keywords, districts, or category choices.
      </p>
      <button
        onClick={onClear}
        className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-ink-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-ink-800 transition-colors"
      >
        Clear Search & Filters
      </button>
    </div>
  );
}
