import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { HeaderBar } from '../../components/HeaderBar';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import { requestJson } from '../../lib/api';
import type { User, ServiceListing } from '../../types/session';
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

const pricingFormats = [
  { value: 'daily_labor', label: 'Daily Labor Wage' },
  { value: 'sqft', label: 'Square Foot (Sqft)' },
  { value: 'per_point', label: 'Per Point Wiring/Plumbing' },
  { value: 'linear_ft', label: 'Per Linear Foot (Lft)' },
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
  user: User | null;
  notice: string;
  onLogout: () => Promise<void>;
}) {
  const isPro = user?.role === 'service_provider' || user?.role === 'product_seller';
  const isAdmin = user?.role === 'admin';
  const isPending = user?.application?.status === 'pending' && user?.role === 'user';
  const actionLabel = isAdmin ? 'Admin' : isPro ? 'Dashboard' : isPending ? 'Pending review' : 'Join as Pro';
  const actionTo = isAdmin ? '/admin' : isPro ? '/dashboard' : isPending ? '/' : '/join-as-pro';

  // Services State
  const [listings, setListings] = useState<ServiceListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Filtering States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('');

  // Infinite Scroll ("Magic Scroll") States
  const [visibleCount, setVisibleCount] = useState(6);
  const [isInfiniteLoading, setIsInfiniteLoading] = useState(false);
  const observerRef = useRef<HTMLDivElement | null>(null);

  // Lazy Load Services State
  const [hasScrolledToServices, setHasScrolledToServices] = useState(false);

  // Scroll Snap State & Ref
  const snappedRef = useRef(false);

  // Contact Pro Modal State
  const [selectedListingForContact, setSelectedListingForContact] = useState<ServiceListing | null>(null);

  // 1. Detect when user scrolls to services section
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasScrolledToServices) {
          setHasScrolledToServices(true);
        }
      },
      { threshold: 0.1 }
    );

    const target = document.getElementById('services-marketplace');
    if (target) {
      observer.observe(target);
    }

    return () => {
      if (target) {
        observer.unobserve(target);
      }
    };
  }, [hasScrolledToServices]);

  // 1.5 Fetch listings when scrolled
  useEffect(() => {
    if (!hasScrolledToServices) return;

    async function fetchListings() {
      setLoading(true);
      setError('');
      try {
        const response = await requestJson<{ listings: ServiceListing[] }>('/api/service-listings');
        setListings((response.listings as ServiceListing[]) ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load services.');
      } finally {
        setLoading(false);
      }
    }
    void fetchListings();
  }, [hasScrolledToServices]);

  // 2. Snap scroll from hero to services section when scrolling down
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      // If scroll position is near the top and scrolling down
      if (window.scrollY < window.innerHeight * 0.5 && e.deltaY > 10) {
        if (!snappedRef.current) {
          e.preventDefault();
          snappedRef.current = true;
          document.getElementById('services-marketplace')?.scrollIntoView({ behavior: 'smooth' });
          setTimeout(() => {
            snappedRef.current = false;
          }, 1500);
        }
      }
    };

    let touchStartY = 0;
    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touchEndY = e.touches[0].clientY;
      if (window.scrollY < window.innerHeight * 0.5 && touchStartY - touchEndY > 30) {
        if (!snappedRef.current) {
          e.preventDefault();
          snappedRef.current = true;
          document.getElementById('services-marketplace')?.scrollIntoView({ behavior: 'smooth' });
          setTimeout(() => {
            snappedRef.current = false;
          }, 1500);
        }
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  // 3. Reset visible count on filter changes
  useEffect(() => {
    setVisibleCount(6);
  }, [searchQuery, selectedCategory, selectedDistrict, selectedFormat]);

  // 4. Infinite scroll observer
  useEffect(() => {
    const totalFiltered = listings.filter((listing) => {
      const matchesSearch =
        listing.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        listing.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === '' || listing.category === selectedCategory;
      const matchesDistrict =
        selectedDistrict === '' || (listing.cities && listing.cities.includes(selectedDistrict));
      const matchesFormat = selectedFormat === '' || listing.pricing_type === selectedFormat;
      return matchesSearch && matchesCategory && matchesDistrict && matchesFormat;
    }).length;

    if (visibleCount >= totalFiltered) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isInfiniteLoading) {
          setIsInfiniteLoading(true);
          setTimeout(() => {
            setVisibleCount((prev) => prev + 6);
            setIsInfiniteLoading(false);
          }, 1000);
        }
      },
      { threshold: 0.1 }
    );

    const currentSentinel = observerRef.current;
    if (currentSentinel) {
      observer.observe(currentSentinel);
    }

    return () => {
      if (currentSentinel) {
        observer.unobserve(currentSentinel);
      }
    };
  }, [visibleCount, listings, searchQuery, selectedCategory, selectedDistrict, selectedFormat, isInfiniteLoading]);

  // Filter listings
  const filteredListings = listings.filter((listing) => {
    const matchesSearch =
      listing.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      listing.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === '' || listing.category === selectedCategory;
    const matchesDistrict =
      selectedDistrict === '' || (listing.cities && listing.cities.includes(selectedDistrict));
    const matchesFormat = selectedFormat === '' || listing.pricing_type === selectedFormat;

    return matchesSearch && matchesCategory && matchesDistrict && matchesFormat;
  });

  const getFormatLabel = (type: string) => {
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
        return 'Unit';
    }
  };

  return (
    <>
      <div className="bg-ink-50/50 flex flex-col min-h-[85vh] relative overflow-hidden">
        {/* Background Decorative Blobs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1000px] h-full pointer-events-none opacity-40">
          <div className="absolute -top-[20%] -left-[10%] w-[500px] h-[500px] rounded-full bg-aura-300 blur-[100px]" />
          <div className="absolute top-[20%] -right-[10%] w-[400px] h-[400px] rounded-full bg-ember-200 blur-[100px]" />
        </div>

        <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 lg:px-10 w-full z-10">
          <HeaderBar user={user} onLogout={onLogout} />
        </div>

        <div className="flex-1 flex flex-col justify-center items-center text-center px-4 py-12 z-10 max-w-5xl mx-auto w-full">
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
              <span className="rounded-full bg-amber-100 border border-amber-200 px-6 py-3.5 text-sm font-semibold text-amber-800">Pending review</span>
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
            document.getElementById('services-marketplace')?.scrollIntoView({ behavior: 'smooth' });
          }}
        >
          <span className="text-xs uppercase tracking-widest text-ink-400 font-semibold">Scroll to Explore</span>
          <div className="w-6 h-6 border-b-2 border-r-2 border-ink-300 transform rotate-45 animate-bounce" />
        </div>
      </div>

      {/* Services Browser Section */}
      <section id="services-marketplace" className="mx-auto max-w-7xl px-4 md:px-8 lg:px-10 mt-10">
      <div className="rounded-3xl border border-white/70 bg-white/85 p-6 shadow-glow backdrop-blur md:p-8">
        <div className="border-b border-ink-100 pb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-aura-600">Marketplace</p>
          <h2 className="mt-2 font-display text-3xl font-bold text-ink-900">Browse Construction Services</h2>
          <p className="mt-2 text-sm text-ink-600">
            Find the right construction professionals in Sri Lanka. Filter by category, districts, or pricing structures.
          </p>
        </div>

        {/* Advanced Filters */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {/* Search bar */}
          <div className="lg:col-span-2">
            <label className="text-xs font-semibold text-ink-500 uppercase tracking-wider block mb-1">Search Keywords</label>
            <input
              type="text"
              placeholder="Search masonry, electrical, paint..."
              className="flex h-11 w-full rounded-2xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-ink-950"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Category Filter */}
          <div>
            <label className="text-xs font-semibold text-ink-500 uppercase tracking-wider block mb-1">Category</label>
            <select
              className="flex h-11 w-full rounded-2xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-ink-950"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="">All Categories</option>
              {categories.map((cat, i) => (
                <option key={i} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* District Filter */}
          <div>
            <label className="text-xs font-semibold text-ink-500 uppercase tracking-wider block mb-1">District</label>
            <select
              className="flex h-11 w-full rounded-2xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-ink-950"
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
            >
              <option value="">All Districts</option>
              {(districts as string[]).map((dist, i) => (
                <option key={i} value={dist}>
                  {dist}
                </option>
              ))}
            </select>
          </div>

          {/* Pricing format filter */}
          <div>
            <label className="text-xs font-semibold text-ink-500 uppercase tracking-wider block mb-1">Pricing Format</label>
            <select
              className="flex h-11 w-full rounded-2xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-ink-950"
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value)}
            >
              <option value="">All Formats</option>
              {pricingFormats.map((pf) => (
                <option key={pf.value} value={pf.value}>
                  {pf.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Listings Display */}
        {loading ? (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : error ? (
          <div className="mt-8 rounded-2xl bg-red-50 p-4 text-sm text-red-800 text-center">{error}</div>
        ) : filteredListings.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-dashed border-ink-200 bg-ink-50/50 py-16 text-center">
            <p className="text-base font-semibold text-ink-900">No services match your filters</p>
            <p className="mt-1 text-sm text-ink-500">Try adjusting your search keywords, district or category criteria.</p>
            <Button
              variant="outline"
              className="mt-4 rounded-full"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('');
                setSelectedDistrict('');
                setSelectedFormat('');
              }}
            >
              Reset Filters
            </Button>
          </div>
        ) : (
          <>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredListings.slice(0, visibleCount).map((listing) => (
                <Link
                  key={listing.id}
                  to={`/services/${listing.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative flex flex-col overflow-hidden rounded-3xl border border-ink-200 bg-white transition-all duration-300 hover:shadow-lg cursor-pointer"
                >
                  {/* Photo Header */}
                  <div className="relative h-48 bg-ink-100">
                    {listing.images && listing.images.length > 0 ? (
                      <img
                        src={listing.images[0]}
                        alt={listing.title}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-aura-500/10 to-ember-500/10">
                        <span className="text-xs font-semibold text-ink-400">No Image Uploaded</span>
                      </div>
                    )}
                    <span className="absolute left-4 top-4 rounded-full bg-ink-900/80 px-3 py-1 text-xs font-semibold text-white backdrop-blur shadow-sm">
                      {listing.category}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex flex-1 flex-col p-6">
                    <h3 className="font-display text-lg font-bold text-ink-900 group-hover:text-aura-600 transition-colors">
                      {listing.title}
                    </h3>
                    <p className="mt-2 text-xs text-ink-600 line-clamp-3 leading-relaxed">
                      {listing.description}
                    </p>

                    <div className="mt-4 border-t border-ink-100 pt-3">
                      <p className="text-[10px] text-ink-400 font-semibold uppercase tracking-wider">Estimated Rate</p>
                      <p className="mt-0.5 font-display text-lg font-bold text-ink-900">
                        LKR {Number(listing.price).toLocaleString()} / {getFormatLabel(listing.pricing_type)}
                      </p>
                      {listing.price_details && (
                        <p className="text-xs text-ink-500 italic mt-0.5">"{listing.price_details}"</p>
                      )}
                    </div>

                    <div className="mt-3">
                      <p className="text-[10px] text-ink-400 font-semibold uppercase tracking-wider">Serving Districts</p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {listing.cities.slice(0, 3).map((c, i) => (
                          <span key={i} className="rounded bg-ink-50 border border-ink-200/60 px-2 py-0.5 text-[10px] font-medium text-ink-700">
                            {c}
                          </span>
                        ))}
                        {listing.cities.length > 3 && (
                          <span className="rounded bg-ink-50 border border-ink-200/60 px-2 py-0.5 text-[10px] font-medium text-ink-700">
                            +{listing.cities.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Provider Meta */}
                    <div className="mt-6 flex items-center justify-between border-t border-ink-100 pt-4">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Service Provider</span>
                        <span className="text-sm font-semibold text-ink-900">
                          {listing.business_name || listing.provider_name || 'Verified Nestora Pro'}
                        </span>
                      </div>
                      <span className="rounded-full bg-ink-900 text-white group-hover:bg-ink-800 text-xs px-4 py-1.5 font-semibold transition-colors">
                        View Details
                      </span>
                    </div>
                  </div>
                </Link>
              ))}

              {/* Infinite Load Skeleton Cards */}
              {isInfiniteLoading && (
                <>
                  <SkeletonCard />
                  <SkeletonCard />
                  <SkeletonCard />
                </>
              )}
            </div>

            {/* Sentinel for Infinite Scroll (Intersection Observer) */}
            {visibleCount < filteredListings.length && !isInfiniteLoading && (
              <div ref={observerRef} className="mt-8 flex justify-center py-6">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-ink-200 border-t-ink-900" />
              </div>
            )}
          </>
        )}
      </div>
      </section>

      {/* About Section */}
      <section className="mx-auto max-w-7xl px-4 md:px-8 lg:px-10 mt-6">
      <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur">
        <p className="text-sm uppercase tracking-[0.2em] text-ink-500">Platform Core Statistics</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <StatusCard title="Backend" value="PHP + PDO" subtitle="Session validation, dynamic database migration, and routing." />
          <StatusCard title="Database" value="MySQL" subtitle="Custom service_listings schema linked to verified users." />
          <StatusCard title="Frontend" value="React + Vite" subtitle="4-step onboarding wizard and filterable marketplace." />
        </div>
      </div>
      </section>

      {/* Notice Toast */}
      {notice ? (
        <div className="fixed bottom-6 left-1/2 z-10 w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 rounded-2xl border border-ink-200 bg-white px-5 py-4 shadow-glow animate-bounce">
          <p className="text-sm font-medium text-ink-900">{notice}</p>
        </div>
      ) : null}

      {/* Contact Pro Details Dialog */}
      <Dialog
        isOpen={selectedListingForContact !== null}
        onClose={() => setSelectedListingForContact(null)}
      >
        {selectedListingForContact && (
          <div className="space-y-6">
            <DialogHeader>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-aura-100 px-3 py-1 text-xs font-semibold text-aura-800 w-fit">
                <span className="h-1.5 w-1.5 rounded-full bg-aura-500" />
                Verified Nestora Contractor
              </div>
              <DialogTitle className="mt-2 text-2xl font-bold text-ink-900">
                Contact {selectedListingForContact.business_name || selectedListingForContact.provider_name}
              </DialogTitle>
              <DialogDescription>
                Reach out directly to discuss your construction project, request estimates, or book site inspection visits.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-2xl bg-ink-50 p-5 border border-ink-200 space-y-4">
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Service Offered</span>
                <span className="text-base font-semibold text-ink-900">{selectedListingForContact.title}</span>
                <span className="text-xs text-ink-600 leading-relaxed">{selectedListingForContact.description}</span>
              </div>

              <div className="grid gap-4 border-t border-ink-100 pt-4 sm:grid-cols-2">
                <div>
                  <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Estimated Rate</span>
                  <p className="text-sm font-bold text-ink-900">
                    LKR {Number(selectedListingForContact.price).toLocaleString()} / {getFormatLabel(selectedListingForContact.pricing_type)}
                  </p>
                  {selectedListingForContact.price_details && (
                    <p className="text-xs text-ink-500 italic">"{selectedListingForContact.price_details}"</p>
                  )}
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Mobilization Areas</span>
                  <p className="text-xs font-medium text-ink-700 leading-relaxed">
                    {selectedListingForContact.cities.join(', ')}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-display text-sm font-bold text-ink-900 uppercase tracking-wider">Contract Details</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                {/* Phone */}
                <a
                  href={`tel:${selectedListingForContact.business_phone}`}
                  className="flex items-center gap-3 rounded-2xl border border-ink-200 bg-white p-4 transition-colors hover:bg-ink-50"
                >
                  <div className="rounded-full bg-aura-100 p-2 text-aura-600">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[10px] text-ink-400 font-semibold uppercase">Call Phone</p>
                    <p className="text-sm font-bold text-ink-900">{selectedListingForContact.business_phone || 'N/A'}</p>
                  </div>
                </a>

                {/* Email */}
                <a
                  href={`mailto:${selectedListingForContact.business_email}`}
                  className="flex items-center gap-3 rounded-2xl border border-ink-200 bg-white p-4 transition-colors hover:bg-ink-50"
                >
                  <div className="rounded-full bg-ember-100 p-2 text-ember-600">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[10px] text-ink-400 font-semibold uppercase">Email Business</p>
                    <p className="text-sm font-bold text-ink-900 line-clamp-1">{selectedListingForContact.business_email || 'N/A'}</p>
                  </div>
                </a>
              </div>

              {/* Address */}
              <div className="flex items-center gap-3 rounded-2xl border border-ink-200 bg-white p-4">
                <div className="rounded-full bg-ink-100 p-2 text-ink-600">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] text-ink-400 font-semibold uppercase">Base Address</p>
                  <p className="text-sm font-bold text-ink-900">
                    {selectedListingForContact.business_address}, {selectedListingForContact.business_city}
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={() => setSelectedListingForContact(null)} className="rounded-full bg-ink-900 text-white hover:bg-ink-800 w-full sm:w-auto">
                Close Contact details
              </Button>
            </DialogFooter>
          </div>
        )}
      </Dialog>
    </>
  );
}

function InfoCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-sm">
      <h3 className="font-display text-lg font-semibold text-ink-900">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-ink-600">{text}</p>
    </div>
  );
}

function StatusCard({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-ink-500">{title}</p>
      <p className="mt-2 font-display text-xl font-bold text-ink-900">{value}</p>
      <p className="mt-1 text-xs leading-5 text-ink-600">{subtitle}</p>
    </div>
  );
}
