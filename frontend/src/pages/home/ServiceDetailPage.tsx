import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { HeaderBar } from '../../components/HeaderBar';
import { SriLankaMap } from '../../components/SriLankaMap';
import { requestJson } from '../../lib/api';
import type { User, ServiceListing } from '../../types/session';
import { Button } from '../../components/ui/button';
import { ImageLightbox } from '../../components/ImageLightbox';

export function ServiceDetailPage({
  user,
  onLogout,
}: {
  user: User | null;
  onLogout: () => Promise<void>;
}) {
  const { id } = useParams<{ id: string }>();
  const [listing, setListing] = useState<ServiceListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  useEffect(() => {
    async function fetchListingDetail() {
      if (!id) return;
      setLoading(true);
      setError('');
      try {
        const response = (await requestJson<unknown>(`/api/service-listings/${id}`)) as {
          listing: ServiceListing;
        };
        if (response.listing) {
          setListing(response.listing);
        } else {
          setError('Service listing data not found.');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load service details.');
      } finally {
        setLoading(false);
      }
    }
    void fetchListingDetail();
  }, [id]);

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

  if (loading) {
    return (
      <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 md:px-8 lg:px-10">
        <HeaderBar user={user} onLogout={onLogout} />
        <div className="flex justify-center py-32">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-ink-200 border-t-ink-900" />
            <p className="font-display text-sm font-medium text-ink-600">Retrieving service details...</p>
          </div>
        </div>
      </main>
    );
  }

  if (error || !listing) {
    return (
      <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 md:px-8 lg:px-10">
        <HeaderBar user={user} onLogout={onLogout} />
        <div className="mt-8 rounded-3xl border border-dashed border-red-200 bg-red-50/50 py-16 text-center max-w-2xl mx-auto px-6">
          <p className="text-base font-semibold text-red-950">Failed to load service</p>
          <p className="mt-1 text-sm text-red-700">{error || 'The requested service listing does not exist.'}</p>
          <Link to="/" className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-ink-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-ink-800 transition-colors">
            ← Return to Homepage
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 md:px-8 lg:px-10">
      <HeaderBar user={user} onLogout={onLogout} />

      {/* Back Button */}
      <div className="mb-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white/80 px-4 py-2 text-xs font-semibold text-ink-700 hover:text-ink-950 hover:bg-ink-50 shadow-sm backdrop-blur transition-all"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Marketplace
        </Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        {/* Left Column: Details, Images, Contact */}
        <div className="space-y-6">
          {/* Main Info Card */}
          <div className="rounded-3xl border border-white/70 bg-white/80 p-6 md:p-8 shadow-sm backdrop-blur">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-aura-100 px-3 py-1 text-xs font-semibold text-aura-800">
                <span className="h-1.5 w-1.5 rounded-full bg-aura-500" />
                {listing.category}
              </span>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                Verified Provider
              </span>
            </div>

            <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-ink-900 md:text-4xl leading-[1.2]">
              {listing.title}
            </h1>

            <p className="mt-2 text-sm font-semibold text-ink-500">
              Offered by:{' '}
              {listing.user_id ? (
                <Link
                  to={`/profile/${listing.user_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-aura-600 hover:text-aura-700 hover:underline transition-colors"
                >
                  {listing.business_name || listing.provider_name || 'Verified Nestora Contractor'}
                </Link>
              ) : (
                listing.business_name || listing.provider_name || 'Verified Nestora Contractor'
              )}
            </p>

            <div className="mt-6 border-y border-ink-100 py-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[10px] text-ink-400 font-semibold uppercase tracking-wider">Estimated Base Rate</p>
                <p className="mt-1 font-display text-2xl font-bold text-ink-900">
                  LKR {Number(listing.price).toLocaleString()} <span className="text-sm font-normal text-ink-500">/ {getFormatLabel(listing.pricing_type)}</span>
                </p>
              </div>
              {listing.price_details && (
                <div className="max-w-md bg-ink-50 border border-ink-100 px-4 py-2.5 rounded-2xl">
                  <p className="text-[10px] text-ink-400 font-semibold uppercase tracking-wider">Price Details & Conditions</p>
                  <p className="text-xs text-ink-700 italic mt-0.5">"{listing.price_details}"</p>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="mt-6">
              <h3 className="font-display text-base font-bold text-ink-900 mb-2">Service Description</h3>
              <p className="text-sm text-ink-700 leading-relaxed whitespace-pre-line">
                {listing.description}
              </p>
            </div>
          </div>

          {/* Portfolio Images Gallery */}
          <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur">
            <h3 className="font-display text-base font-bold text-ink-900 mb-4">Work Portfolio & Projects</h3>
            {listing.images && listing.images.length > 0 ? (
              <div className="space-y-4">
                {/* Active Image */}
                <button
                  onClick={() => setIsLightboxOpen(true)}
                  className="relative h-96 w-full overflow-hidden rounded-2xl bg-ink-50 border border-ink-100 group focus:outline-none focus:ring-2 focus:ring-aura-600 focus:ring-offset-2"
                  aria-label="Enlarge image"
                >
                  <img
                    src={listing.images[activeImageIndex]}
                    alt={`${listing.title} work index ${activeImageIndex + 1}`}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 cursor-zoom-in"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-white rounded-full p-3 backdrop-blur shadow-lg">
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                      </svg>
                    </span>
                  </div>
                  <div className="absolute bottom-4 right-4 rounded-full bg-ink-900/70 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur z-10">
                    {activeImageIndex + 1} / {listing.images.length}
                  </div>
                </button>

                {/* Thumbnails */}
                {listing.images.length > 1 && (
                  <div className="flex flex-wrap gap-3">
                    {listing.images.map((img, index) => (
                      <button
                        key={index}
                        onClick={() => setActiveImageIndex(index)}
                        className={`relative h-20 w-20 overflow-hidden rounded-xl border-2 transition-all ${
                          activeImageIndex === index
                            ? 'border-aura-600 ring-2 ring-aura-600/30 scale-95'
                            : 'border-ink-200 hover:border-ink-300'
                        }`}
                      >
                        <img
                          src={img}
                          alt={`${listing.title} thumbnail ${index + 1}`}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex h-64 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-ink-200 bg-ink-50/50">
                <svg className="h-10 w-10 text-ink-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="mt-2 text-xs font-semibold text-ink-400">No portfolio images uploaded by provider</p>
              </div>
            )}
          </div>

          {/* Contact Information block */}
          <div className="rounded-3xl border border-white/70 bg-white/80 p-6 md:p-8 shadow-sm backdrop-blur space-y-4">
            <h3 className="font-display text-base font-bold text-ink-900">Direct Contact & Scheduling</h3>
            <p className="text-xs text-ink-500">
              Get in touch with {listing.business_name || listing.provider_name || 'the contractor'} directly. Nestora listings do not charge booking fees.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Phone */}
              <a
                href={listing.business_phone ? `tel:${listing.business_phone}` : '#'}
                className={`flex items-center gap-3.5 rounded-2xl border border-ink-200 bg-white p-4 transition-all hover:bg-ink-50 ${
                  !listing.business_phone && 'pointer-events-none opacity-60'
                }`}
              >
                <div className="rounded-full bg-aura-100 p-2.5 text-aura-600 shadow-sm">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] text-ink-400 font-semibold uppercase tracking-wider">Phone Call</p>
                  <p className="text-sm font-bold text-ink-900">{listing.business_phone || 'Not Provided'}</p>
                </div>
              </a>

              {/* Email */}
              <a
                href={listing.business_email ? `mailto:${listing.business_email}` : '#'}
                className={`flex items-center gap-3.5 rounded-2xl border border-ink-200 bg-white p-4 transition-all hover:bg-ink-50 ${
                  !listing.business_email && 'pointer-events-none opacity-60'
                }`}
              >
                <div className="rounded-full bg-ember-100 p-2.5 text-ember-600 shadow-sm">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] text-ink-400 font-semibold uppercase tracking-wider">Email Business</p>
                  <p className="text-sm font-bold text-ink-900 line-clamp-1">{listing.business_email || 'Not Provided'}</p>
                </div>
              </a>
            </div>

            {/* Address */}
            <div className="flex items-center gap-3.5 rounded-2xl border border-ink-200 bg-white p-4">
              <div className="rounded-full bg-ink-100 p-2.5 text-ink-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <p className="text-[10px] text-ink-400 font-semibold uppercase tracking-wider">Base Office Address</p>
                <p className="text-sm font-bold text-ink-900">
                  {listing.business_address || 'N/A'}, {listing.business_city || 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Sri Lanka Map / Coverage */}
        <div className="space-y-6">
          {/* Map Coverage */}
          <SriLankaMap selectedCities={listing.cities} />

          {/* List of Served Districts */}
          <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur">
            <h3 className="font-display text-base font-bold text-ink-900 mb-3">Mobilization Cities & Districts</h3>
            <p className="text-xs text-ink-500 mb-4">
              This provider actively travels to and works within the following Sri Lankan districts:
            </p>
            <div className="flex flex-wrap gap-2">
              {listing.cities.map((city, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-1.5 text-xs font-semibold text-emerald-800 shadow-sm"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {city}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <ImageLightbox
        isOpen={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
        images={listing.images || []}
        currentIndex={activeImageIndex}
        onIndexChange={setActiveImageIndex}
      />
    </main>
  );
}
