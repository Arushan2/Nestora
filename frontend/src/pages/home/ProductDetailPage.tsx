import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { HeaderBar } from '../../components/HeaderBar';
import { SriLankaMap } from '../../components/SriLankaMap';
import { requestJson } from '../../lib/api';
import type { User, ProductListing } from '../../types/session';

export function ProductDetailPage({
  user,
  onLogout,
}: {
  user: User | null;
  onLogout: () => Promise<void>;
}) {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<ProductListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    async function fetchProductDetail() {
      if (!id) return;
      setLoading(true);
      setError('');
      try {
        const response = (await requestJson<unknown>(`/api/product-listings/${id}`)) as {
          listing: ProductListing;
        };
        if (response.listing) {
          setProduct(response.listing);
        } else {
          setError('Product listing data not found.');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load product details.');
      } finally {
        setLoading(false);
      }
    }
    void fetchProductDetail();
  }, [id]);

  if (loading) {
    return (
      <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 md:px-8 lg:px-10">
        <HeaderBar user={user} onLogout={onLogout} />
        <div className="flex justify-center py-32">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-ink-200 border-t-ink-900" />
            <p className="font-display text-sm font-medium text-ink-600">Retrieving product details...</p>
          </div>
        </div>
      </main>
    );
  }

  if (error || !product) {
    return (
      <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 md:px-8 lg:px-10">
        <HeaderBar user={user} onLogout={onLogout} />
        <div className="mt-8 rounded-3xl border border-dashed border-red-200 bg-red-50/50 py-16 text-center max-w-2xl mx-auto px-6">
          <p className="text-base font-semibold text-red-950">Failed to load product</p>
          <p className="mt-1 text-sm text-red-700">{error || 'The requested product does not exist.'}</p>
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
          Back to Inventory
        </Link>
      </div>

      <div className="space-y-8">
        {/* Top Section: Images */}
        <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur">
          {product.images && product.images.length > 0 ? (
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Active Image */}
              <div className="relative h-96 overflow-hidden rounded-3xl bg-ink-50 border border-ink-100">
                <img
                  src={product.images[activeImageIndex]}
                  alt={product.title}
                  className="h-full w-full object-cover"
                />
                <div className="absolute bottom-4 right-4 rounded-full bg-ink-900/70 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
                  {activeImageIndex + 1} / {product.images.length}
                </div>
              </div>

              {/* Thumbnails & Title Snippet */}
              <div className="flex flex-col justify-center">
                <div className="mb-6">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-aura-100 px-3 py-1 text-xs font-semibold text-aura-800">
                      {product.category}
                    </span>
                    {product.brand && (
                      <span className="rounded-full border border-ink-200 px-3 py-1 text-xs font-semibold text-ink-700">
                        Brand: {product.brand}
                      </span>
                    )}
                  </div>
                  <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-ink-900 leading-[1.2]">
                    {product.title}
                  </h1>
                </div>

                {product.images.length > 1 && (
                  <div className="flex flex-wrap gap-3">
                    {product.images.map((img, index) => (
                      <button
                        key={index}
                        onClick={() => setActiveImageIndex(index)}
                        className={`relative h-24 w-24 overflow-hidden rounded-xl border-2 transition-all ${
                          activeImageIndex === index
                            ? 'border-aura-600 ring-2 ring-aura-600/30 scale-95'
                            : 'border-ink-200 hover:border-ink-300'
                        }`}
                      >
                        <img
                          src={img}
                          alt={`${product.title} thumbnail ${index + 1}`}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col justify-center">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-aura-100 px-3 py-1 text-xs font-semibold text-aura-800">
                  {product.category}
                </span>
                {product.brand && (
                  <span className="rounded-full border border-ink-200 px-3 py-1 text-xs font-semibold text-ink-700">
                    Brand: {product.brand}
                  </span>
                )}
              </div>
              <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-ink-900 leading-[1.2]">
                {product.title}
              </h1>
            </div>
          )}
        </div>

        {/* Lower Section: Map (Left) and Details (Right) */}
        <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
          
          {/* Left: Map Coverage */}
          <div className="space-y-6">
            <SriLankaMap selectedCities={product.shipping_districts} />

            <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur">
              <h3 className="font-display text-base font-bold text-ink-900 mb-3">Shipping Coverage</h3>
              <p className="text-xs text-ink-500 mb-4">
                This product can be shipped to the following districts:
              </p>
              <div className="flex flex-wrap gap-2">
                {product.shipping_districts.map((city, index) => (
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

          {/* Right: Details & Contact */}
          <div className="space-y-6">
            {/* Price Details */}
            <div className="rounded-3xl border border-white/70 bg-white/80 p-6 md:p-8 shadow-sm backdrop-blur">
              <h3 className="font-display text-base font-bold text-ink-900 mb-4">Pricing & Logistics</h3>
              
              <div className="flex flex-col gap-6">
                <div>
                  <p className="text-[10px] text-ink-400 font-semibold uppercase tracking-wider">Price per {product.unit_type}</p>
                  <p className="mt-1 font-display text-3xl font-bold text-ink-900">
                    LKR {Number(product.price).toLocaleString()}
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 pt-4 border-t border-ink-100">
                  <div>
                    <p className="text-[10px] text-ink-400 font-semibold uppercase tracking-wider">Delivery Terms</p>
                    <p className="mt-1 text-sm font-semibold text-ink-900">
                      {product.delivery_terms || 'Contact seller for delivery details.'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-ink-400 font-semibold uppercase tracking-wider">Site Unloading</p>
                    <div className="mt-1 flex items-center gap-2">
                      {product.unloading_provided ? (
                        <>
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          <span className="text-sm font-semibold text-ink-900">Provided</span>
                        </>
                      ) : (
                        <>
                          <span className="h-2 w-2 rounded-full bg-red-500" />
                          <span className="text-sm font-semibold text-ink-900">Not Provided</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="rounded-3xl border border-white/70 bg-white/80 p-6 md:p-8 shadow-sm backdrop-blur">
              <h3 className="font-display text-base font-bold text-ink-900 mb-2">Product Description</h3>
              <p className="text-sm text-ink-700 leading-relaxed whitespace-pre-line">
                {product.description}
              </p>
            </div>

            {/* Seller Contact */}
            <div className="rounded-3xl border border-white/70 bg-white/80 p-6 md:p-8 shadow-sm backdrop-blur space-y-4">
              <h3 className="font-display text-base font-bold text-ink-900">Seller Contact Information</h3>
              <p className="text-xs text-ink-500">
                Reach out to {product.business_name || product.seller_name} for stock inquiries and bulk orders.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <a
                  href={product.business_phone ? `tel:${product.business_phone}` : '#'}
                  className={`flex items-center gap-3.5 rounded-2xl border border-ink-200 bg-white p-4 transition-all hover:bg-ink-50 ${
                    !product.business_phone && 'pointer-events-none opacity-60'
                  }`}
                >
                  <div className="rounded-full bg-aura-100 p-2.5 text-aura-600 shadow-sm">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[10px] text-ink-400 font-semibold uppercase tracking-wider">Phone Call</p>
                    <p className="text-sm font-bold text-ink-900">{product.business_phone || 'Not Provided'}</p>
                  </div>
                </a>

                <a
                  href={product.business_email ? `mailto:${product.business_email}` : '#'}
                  className={`flex items-center gap-3.5 rounded-2xl border border-ink-200 bg-white p-4 transition-all hover:bg-ink-50 ${
                    !product.business_email && 'pointer-events-none opacity-60'
                  }`}
                >
                  <div className="rounded-full bg-ember-100 p-2.5 text-ember-600 shadow-sm">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[10px] text-ink-400 font-semibold uppercase tracking-wider">Email Seller</p>
                    <p className="text-sm font-bold text-ink-900 line-clamp-1">{product.business_email || 'Not Provided'}</p>
                  </div>
                </a>
              </div>

              <div className="flex items-center gap-3.5 rounded-2xl border border-ink-200 bg-white p-4">
                <div className="rounded-full bg-ink-100 p-2.5 text-ink-600">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] text-ink-400 font-semibold uppercase tracking-wider">Store Location</p>
                  <p className="text-sm font-bold text-ink-900">
                    {product.business_address || 'N/A'}, {product.business_city || 'N/A'}
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </main>
  );
}
