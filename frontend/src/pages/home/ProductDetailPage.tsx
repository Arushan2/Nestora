import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Heart, Star, ShoppingBag, ShoppingCart, MessageSquare, User as UserIcon } from 'lucide-react';
import { HeaderBar } from '../../components/HeaderBar';
import { SriLankaMap } from '../../components/SriLankaMap';
import { requestJson } from '../../lib/api';
import type { User, ProductListing, Review } from '../../types/session';
import { ImageLightbox } from '../../components/ImageLightbox';

export function ProductDetailPage({
  user,
  onLogout,
}: {
  user: User | null;
  onLogout: () => Promise<void>;
}) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [product, setProduct] = useState<ProductListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // New States for Favorites, Cart & Reviews
  const [isFavorited, setIsFavorited] = useState(false);
  const [favLoading, setFavLoading] = useState(false);
  const [cartAdding, setCartAdding] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [successMsg, setSuccessMsg] = useState('');

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

  // Fetch Favorites Status and Reviews
  useEffect(() => {
    if (!product) return;

    async function fetchFavoritesAndReviews() {
      const currentProduct = product;
      if (!currentProduct) return;

      if (user) {
        try {
          const response = (await requestJson('/api/favorites')) as any;
          if (response.favorites) {
            const exists = response.favorites.some((fav: any) => fav.product_id === currentProduct.id);
            setIsFavorited(exists);
          }
        } catch (err) {
          console.error('Failed to load favorites status:', err);
        }
      }

      try {
        const response = (await requestJson(`/api/product-listings/${currentProduct.id}/reviews`)) as any;
        if (response.reviews) {
          setReviews(response.reviews);
        }
      } catch (err) {
        console.error('Failed to load reviews:', err);
      }
    }

    void fetchFavoritesAndReviews();
  }, [product, user]);

  async function handleToggleFavorite() {
    if (!user) {
      navigate('/auth');
      return;
    }
    const currentProduct = product;
    if (!currentProduct) return;

    setFavLoading(true);
    try {
      const response = (await requestJson('/api/favorites/toggle', { product_id: currentProduct.id })) as any;
      setIsFavorited(response.favorited ?? false);
      window.dispatchEvent(new Event('favorites-updated'));
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    } finally {
      setFavLoading(false);
    }
  }

  async function handleAddToCart() {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (!product) return;

    setCartAdding(true);
    setSuccessMsg('');
    try {
      await requestJson('/api/cart', { product_id: product.id, quantity: 1 });
      window.dispatchEvent(new Event('cart-updated'));
      setSuccessMsg('Added to cart!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add item to cart.');
    } finally {
      setCartAdding(false);
    }
  }

  function handleBuyNow() {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (!product) return;
    navigate(`/checkout?buyNow=${product.id}&qty=1`);
  }

  // Calculate Average Product Rating
  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.product_rating, 0) / reviews.length).toFixed(1)
    : null;

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
      <div className="mb-6 mt-4">
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

      <div className="grid gap-8 lg:grid-cols-2" style={{ gridTemplateRows: 'auto auto auto' }}>

        {/* ── Row 1 Left: Title (compact, self-start) ── */}
        <div className="rounded-3xl border border-white/70 bg-white/80 p-6 md:p-8 shadow-sm backdrop-blur self-start">
          <div className="flex flex-wrap items-center gap-2.5 mb-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-aura-100 px-3 py-1 text-xs font-semibold text-aura-800">
              {product.category}
            </span>
            {product.brand && (
              <span className="rounded-full border border-ink-200 px-3 py-1 text-xs font-semibold text-ink-700">
                Brand: {product.brand}
              </span>
            )}
            {avgRating && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-800">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                {avgRating} ({reviews.length})
              </span>
            )}
          </div>
          <h1 className="font-display text-4xl font-bold tracking-tight text-ink-900 leading-[1.2]">
            {product.title}
          </h1>
        </div>

        {/* ── Right Column Rows 1-2: Service Area Map + Shipping Coverage ── */}
        <div className="space-y-6 lg:row-span-2">
          <SriLankaMap selectedCities={product.shipping_districts} />

          <div className="rounded-3xl border border-white/70 bg-white/80 p-6 md:p-8 shadow-sm backdrop-blur">
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

        {/* ── Row 2 Left: Product Image ── */}
        <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur">
          {product.images && product.images.length > 0 ? (
            <div className="flex flex-col gap-4">
              {/* Active Image */}
              <button
                onClick={() => setIsLightboxOpen(true)}
                className="relative h-96 w-full overflow-hidden rounded-3xl bg-ink-50 border border-ink-100 group focus:outline-none focus:ring-2 focus:ring-aura-600 focus:ring-offset-2"
                aria-label="Enlarge image"
              >
                <img
                  src={product.images[activeImageIndex]}
                  alt={product.title}
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
                  {activeImageIndex + 1} / {product.images.length}
                </div>
              </button>

              {/* Thumbnails */}
              {product.images.length > 1 && (
                <div className="flex flex-wrap gap-3">
                  {product.images.map((img, index) => (
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
                        alt={`${product.title} thumbnail ${index + 1}`}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-96 items-center justify-center rounded-3xl bg-ink-50 border border-ink-100">
              <p className="text-sm text-ink-400 font-medium">No images available</p>
            </div>
          )}
        </div>

        {/* ── Row 3 Left: Price & Description (Unified Card) ── */}
        <div className="rounded-3xl border border-white/70 bg-white/80 p-6 md:p-8 shadow-sm backdrop-blur space-y-8 animate-in fade-in">
          {/* Price Details & Interactive CTAs */}
          <div>
            <h3 className="font-display text-base font-bold text-ink-900 mb-4">Pricing & Purchase</h3>
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-ink-400 font-semibold uppercase tracking-wider">Price per {product.unit_type}</p>
                  <p className="mt-1 font-display text-3xl font-bold text-ink-900">
                    LKR {Number(product.price).toLocaleString()}
                  </p>
                </div>
                {successMsg && (
                  <span className="rounded-full bg-emerald-100 px-3.5 py-1.5 text-xs font-semibold text-emerald-800 animate-bounce">
                    {successMsg}
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  onClick={() => void handleAddToCart()}
                  disabled={cartAdding}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl border border-ink-200 bg-white px-6 py-4 text-sm font-semibold text-ink-800 transition-all hover:bg-ink-50 disabled:opacity-50 shadow-sm"
                >
                  <ShoppingCart className="h-4.5 w-4.5" />
                  {cartAdding ? 'Adding...' : 'Add to Cart'}
                </button>
                <button
                  onClick={handleBuyNow}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-ink-900 px-6 py-4 text-sm font-semibold text-white transition-all hover:bg-ink-800 shadow-md hover:scale-[1.01]"
                >
                  <ShoppingBag className="h-4.5 w-4.5 text-aura-400" />
                  Buy Now
                </button>
                <button
                  onClick={() => void handleToggleFavorite()}
                  disabled={favLoading}
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border transition-all ${
                    isFavorited
                      ? 'border-red-200 bg-red-50 text-red-500 hover:bg-red-100'
                      : 'border-ink-200 bg-white text-ink-500 hover:bg-ink-50 hover:text-red-500'
                  }`}
                  title={isFavorited ? 'Remove from saved' : 'Save to favorites'}
                >
                  <Heart className={`h-5 w-5 ${isFavorited ? 'fill-red-500' : ''}`} />
                </button>
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
          <div className="pt-6 border-t border-ink-100">
            <h3 className="font-display text-base font-bold text-ink-900 mb-2">Product Description</h3>
            <p className="text-sm text-ink-700 leading-relaxed whitespace-pre-line">
              {product.description}
            </p>
          </div>
        </div>

        {/* ── Row 3 Right: Seller Contact Information ── */}
        <div className="rounded-3xl border border-white/70 bg-white/80 p-6 md:p-8 shadow-sm backdrop-blur space-y-4 self-start">
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

      {/* ── Row 4: Customer Reviews (Full Width Card) ── */}
      <section className="mt-8 rounded-3xl border border-white/70 bg-white/80 p-6 md:p-8 shadow-sm backdrop-blur">
        <div className="flex items-center gap-2 mb-6 border-b border-ink-100 pb-4">
          <MessageSquare className="h-5 w-5 text-aura-600" />
          <h2 className="font-display text-xl font-bold text-ink-900">Customer Feedback & Reviews</h2>
        </div>

        {reviews.length === 0 ? (
          <div className="py-12 text-center text-ink-500">
            <p className="text-sm font-medium">No reviews yet for this product.</p>
            <p className="text-xs text-ink-400 mt-1">Be the first to order and leave feedback!</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {reviews.map((rev) => (
              <div key={rev.id} className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-aura-100 text-aura-700">
                      <UserIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-ink-900">{rev.customer_name ?? 'Verified Buyer'}</p>
                      <p className="text-[9px] text-ink-400 font-medium">
                        {new Date(rev.created_at).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Ratings */}
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] font-semibold text-ink-400">Product:</span>
                      <div className="flex">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`h-3 w-3 ${
                              i < rev.product_rating ? 'fill-amber-400 text-amber-400' : 'text-ink-200'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] font-semibold text-ink-400">Merchant:</span>
                      <div className="flex">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`h-3 w-3 ${
                              i < rev.seller_rating ? 'fill-amber-400 text-amber-400' : 'text-ink-200'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {rev.comment && (
                  <p className="text-xs text-ink-700 leading-relaxed italic bg-ink-50/50 p-3 rounded-xl">
                    "{rev.comment}"
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <ImageLightbox
        isOpen={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
        images={product.images || []}
        currentIndex={activeImageIndex}
        onIndexChange={setActiveImageIndex}
      />
    </main>
  );
}
