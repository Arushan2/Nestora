import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { HeaderBar } from '../../components/HeaderBar';
import { SriLankaMap } from '../../components/SriLankaMap';
import { requestJson } from '../../lib/api';
import type { User, ProductListing } from '../../types/session';
import { ImageLightbox } from '../../components/ImageLightbox';
import { Heart, Star, ShoppingCart, Plus, Minus, Check, MessageSquare, X } from 'lucide-react';
import { isFavourite, toggleFavourite, addToCart, subscribe } from '../../lib/cartStore';
import { trackEvent } from '../../lib/analytics';
import { Button } from '../../components/ui/button';

type ProductReview = {
  id: number;
  product_id: number;
  user_id: number;
  rating: number;
  comment: string;
  created_at: string;
  reviewer_name: string;
};

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

  // Cart & Favourites States
  const [fav, setFav] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [isAdded, setIsAdded] = useState(false);

  // Reviews States
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [isReviewsModalOpen, setIsReviewsModalOpen] = useState(false);

  useEffect(() => {
    if (product) {
      setFav(isFavourite(product.id));
      const unsubscribeFav = subscribe(() => {
        setFav(isFavourite(product.id));
      });
      return unsubscribeFav;
    }
  }, [product]);

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
          setQuantity(response.listing.stock_units && response.listing.stock_units > 0 ? 1 : 0);
          void trackEvent('product_view', response.listing.user_id, response.listing.id);
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

  useEffect(() => {
    async function fetchReviews() {
      if (!id) return;
      setLoadingReviews(true);
      try {
        const res = (await requestJson<unknown>(`/api/products/${id}/reviews`)) as {
          reviews: ProductReview[];
          average_rating: number;
          total_reviews: number;
        };
        setReviews(res.reviews ?? []);
        setAvgRating(res.average_rating ?? 0);
        setTotalReviews(res.total_reviews ?? 0);
      } catch (err) {
        console.error('Failed to load reviews:', err);
      } finally {
        setLoadingReviews(false);
      }
    }
    void fetchReviews();
  }, [id]);

  const handleAddToCart = () => {
    if (!product) return;
    addToCart(product, quantity);
    void trackEvent('cart_add', product.user_id, product.id);
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2000);
  };

  const handleToggleFavourite = () => {
    if (!product) return;
    toggleFavourite(product);
    if (!fav) { // If it wasn't favourited before, we are adding it
      void trackEvent('favourite_add', product.user_id, product.id);
    }
  };

  const handleBuyNow = () => {
    if (!product) return;
    navigate(`/checkout?buyNow=${product.id}&qty=${quantity}`);
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star
            key={s}
            className={`h-4.5 w-4.5 ${
              s <= rating ? 'fill-amber-400 text-amber-400' : 'text-ink-200'
            }`}
          />
        ))}
      </div>
    );
  };

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
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 md:px-8 lg:px-10 pb-24">
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

      <div className="grid gap-8 lg:grid-cols-2">

        {/* ── Row 1 Left: Title Card ── */}
        <div className="relative rounded-3xl border border-white/70 bg-white/80 p-6 md:p-8 shadow-sm backdrop-blur self-start">
          <div className="flex flex-wrap items-center justify-between gap-4">
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
            
            {/* Heart Favorite Toggle Button */}
            <button
              onClick={handleToggleFavourite}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-ink-200 bg-white text-ink-600 shadow-sm transition-all hover:bg-red-50 hover:text-red-600 active:scale-95"
              aria-label="Toggle Favourite"
            >
              <Heart className={`h-5 w-5 ${fav ? 'fill-red-500 text-red-500' : 'text-ink-600'}`} />
            </button>
          </div>

          <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-ink-900 leading-[1.2]">
            {product.title}
          </h1>

          {/* Average Rating Stars Display */}
          <div className="mt-3 flex items-center gap-2">
            {totalReviews > 0 ? (
              <>
                {renderStars(avgRating)}
                <span className="text-sm font-bold text-ink-900">{avgRating}</span>
                <span className="text-xs text-ink-500">({totalReviews} reviews)</span>
              </>
            ) : (
              <span className="text-xs font-medium text-ink-400">No reviews yet</span>
            )}
          </div>

          <p className="mt-4 text-sm font-semibold text-ink-500">
            Offered by:{' '}
            {product.user_id ? (
              <Link
                to={`/profile/${product.user_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-aura-600 hover:text-aura-700 hover:underline transition-colors"
              >
                {product.business_name || product.seller_name || 'Verified Nestora Merchant'}
              </Link>
            ) : (
              product.business_name || product.seller_name || 'Verified Nestora Merchant'
            )}
          </p>
        </div>

        {/* ── Right Column: Map & Shipping Coverage ── */}
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

        {/* ── Left Column Row 2: Product Images ── */}
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

        {/* ── Left Column Row 3: Pricing & Logistics ── */}
        <div className="rounded-3xl border border-white/70 bg-white/80 p-6 md:p-8 shadow-sm backdrop-blur space-y-8">
          <div>
            <h3 className="font-display text-base font-bold text-ink-900 mb-4">Pricing & Logistics</h3>
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap gap-x-8 gap-y-4 items-center">
                <div>
                  <p className="text-[10px] text-ink-400 font-semibold uppercase tracking-wider">Price per {product.unit_type}</p>
                  <p className="mt-1 font-display text-3xl font-bold text-ink-900">
                    LKR {Number(product.price).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-ink-400 font-semibold uppercase tracking-wider">Available Stock</p>
                  <p className={`mt-1 font-display text-base font-bold ${product.stock_units && product.stock_units > 0 ? 'text-emerald-600 bg-emerald-55/30 px-3 py-1 rounded-xl border border-emerald-100 inline-block' : 'text-rose-600 bg-rose-55/30 px-3 py-1 rounded-xl border border-rose-100 inline-block'}`}>
                    {product.stock_units && product.stock_units > 0 ? `${product.stock_units} ${product.unit_type}s available` : 'Out of Stock'}
                  </p>
                </div>
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

        {/* ── Right Column Row 3: Checkout Control + Contact Card ── */}
        <div className="rounded-3xl border border-white/70 bg-white/80 p-6 md:p-8 shadow-sm backdrop-blur space-y-6 self-start">
          
          {/* Purchase Controls Section */}
          <div className="space-y-4 rounded-2xl bg-ink-50/50 p-5 border border-ink-200/50">
            <h4 className="font-display text-sm font-bold text-ink-900">Configure Purchase Order</h4>
            
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs font-semibold text-ink-600">Select Quantity ({product.unit_type})</span>
              <div className="flex items-center gap-3 rounded-full border border-ink-250 bg-white p-1">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={(product.stock_units ?? 0) <= 0 || quantity <= 1}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-50 hover:bg-ink-100 text-ink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  aria-label="Decrease quantity"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-8 text-center text-sm font-bold text-ink-900">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(product.stock_units ?? 0, q + 1))}
                  disabled={(product.stock_units ?? 0) <= 0 || quantity >= (product.stock_units ?? 0)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-50 hover:bg-ink-100 text-ink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  aria-label="Increase quantity"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Calculated Order Item price */}
            <div className="flex items-center justify-between text-xs font-semibold text-ink-500 pt-2">
              <span>Items Subtotal:</span>
              <span className="text-sm font-bold text-ink-900">
                LKR {Number(product.price * quantity).toLocaleString()}
              </span>
            </div>

             {/* Action Buttons */}
            <div className="grid gap-3 pt-2 sm:grid-cols-2">
              <Button
                onClick={handleAddToCart}
                disabled={(product.stock_units ?? 0) <= 0}
                className={`w-full rounded-full border px-8 py-3 text-xs font-bold shadow-md hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 h-auto ${
                  isAdded
                    ? 'border-emerald-600 bg-emerald-55/35 text-emerald-700 hover:bg-emerald-100/30'
                    : 'border-ink-200 bg-white text-ink-800 hover:bg-ink-100 hover:border-ink-300'
                } disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`}
              >
                {isAdded ? (
                  <>
                    <Check className="h-4.5 w-4.5 text-emerald-600 animate-in zoom-in" />
                    Added to Cart!
                  </>
                ) : (
                  <>
                    <ShoppingCart className="h-4.5 w-4.5 text-ink-600" />
                    {(product.stock_units ?? 0) <= 0 ? 'Out of Stock' : 'Add to Cart'}
                  </>
                )}
              </Button>

              <Button
                onClick={handleBuyNow}
                disabled={(product.stock_units ?? 0) <= 0}
                className="w-full rounded-full bg-aura-600 hover:bg-aura-700 text-white px-8 py-3 text-xs font-bold shadow-md hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 h-auto disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {(product.stock_units ?? 0) <= 0 ? 'Out of Stock' : 'Buy Now'}
              </Button>
            </div>
          </div>

          <hr className="border-ink-100" />

          {/* Customer Reviews & Ratings Summary */}
          <div className="space-y-4">
            <h3 className="font-display text-base font-bold text-ink-900">Customer Ratings</h3>
            
            <div className="rounded-2xl bg-ink-50/50 p-4 border border-ink-200/50 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-ink-400 font-semibold uppercase tracking-wider">Average Rating</p>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="font-display text-2xl font-bold text-ink-900">{avgRating}</span>
                  <span className="text-xs text-ink-400">/ 5</span>
                </div>
              </div>
              <div className="text-right flex flex-col items-end">
                <div>{renderStars(avgRating)}</div>
                <p className="text-[10px] font-semibold text-ink-500 mt-1">Based on {totalReviews} reviews</p>
              </div>
            </div>

            {reviews.length > 0 ? (
              <div className="rounded-2xl bg-white p-4 border border-ink-100 shadow-sm space-y-2.5">
                <p className="text-[10px] text-ink-400 font-semibold uppercase tracking-wider">Latest Review</p>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-ink-900">{reviews[0].reviewer_name}</span>
                  <span className="text-[10px] text-ink-400 font-medium">
                    {new Date(reviews[0].created_at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {renderStars(reviews[0].rating)}
                  <span className="text-[10px] font-bold text-ink-900">{reviews[0].rating} / 5</span>
                </div>
                <p className="text-xs text-ink-700 leading-relaxed italic line-clamp-2">
                  "{reviews[0].comment}"
                </p>
              </div>
            ) : (
              <div className="rounded-2xl bg-white p-4 border border-ink-100/60 text-center py-6">
                <p className="text-xs text-ink-400 font-medium">No reviews yet for this product</p>
              </div>
            )}

            {reviews.length > 0 && (
              <Button
                type="button"
                onClick={() => setIsReviewsModalOpen(true)}
                className="w-full rounded-xl border border-ink-200 bg-white hover:bg-ink-50 text-ink-800 text-xs font-semibold py-2.5 shadow-sm transition-all"
              >
                View All Reviews ({reviews.length})
              </Button>
            )}
          </div>
        </div>

      </div>

      {/* All Customer Reviews Popup Modal */}
      {isReviewsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl rounded-3xl border border-ink-150 bg-white p-6 md:p-8 shadow-2xl animate-in zoom-in duration-300 max-h-[85vh] flex flex-col">
            <button
              onClick={() => setIsReviewsModalOpen(false)}
              className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-ink-50 hover:bg-ink-100 text-ink-600 transition-colors"
              aria-label="Close modal"
            >
              <X className="h-4 w-4" />
            </button>
            
            <h3 className="font-display text-xl font-bold text-ink-900 border-b border-ink-100 pb-4 mb-5 flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-aura-600" />
              All Customer Reviews ({reviews.length})
            </h3>
            
            <div className="overflow-y-auto pr-1 flex-1 space-y-4">
              {reviews.map((review) => (
                <div key={review.id} className="rounded-2xl bg-ink-50/20 p-5 border border-ink-100/70 shadow-sm space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <p className="text-sm font-bold text-ink-900">{review.reviewer_name}</p>
                      <div className="flex items-center gap-1.5">
                        {renderStars(review.rating)}
                        <span className="text-[10px] font-bold text-ink-900">{review.rating} / 5</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold text-ink-400">
                      {new Date(review.created_at).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-ink-700 leading-relaxed">{review.comment}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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
