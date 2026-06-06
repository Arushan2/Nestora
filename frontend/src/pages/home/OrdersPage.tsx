import { useEffect, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { HeaderBar } from '../../components/HeaderBar';
import { requestJson } from '../../lib/api';
import type { User } from '../../types/session';
import { ClipboardList, Star, AlertCircle, RefreshCw, Landmark, Truck, CheckCircle2, ChevronRight, X, AlertTriangle, HelpCircle } from 'lucide-react';

type OrderItem = {
  id: number;
  order_id: number;
  product_id: number;
  quantity: number;
  price: number;
  title: string;
  images: string[];
  unit_type: string;
  seller_name: string;
  seller_business_name: string | null;
  reviewed: boolean;
};

type Order = {
  id: number;
  customer_id: number;
  seller_id: number;
  reference: string;
  delivery_address: string;
  shipping_fee: number;
  total_price: number;
  bank_receipt_url: string;
  status: 'awaiting_verification' | 'processing' | 'shipped' | 'completed' | 'not_received';
  courier_name: string | null;
  tracking_number: string | null;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
};

export function OrdersPage({
  user,
  onLogout,
}: {
  user: User | null;
  onLogout: () => Promise<void>;
}) {
  const location = useLocation();
  const navigate = useNavigate();

  // Redirect if not signed in
  useEffect(() => {
    if (!user) {
      navigate('/auth?redirect=orders');
    }
  }, [user, navigate]);

  // Alert/notice from redirect
  const [notice, setNotice] = useState<string>(
    (location.state as { notice?: string })?.notice ?? ''
  );

  // Clear state so notice doesn't reappear on reload
  useEffect(() => {
    if (location.state) {
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // State
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);

  // Review Modal State
  const [activeReviewItem, setActiveReviewItem] = useState<OrderItem | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState('');

  const fetchOrders = async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = (await requestJson<unknown>('/api/orders')) as { orders: Order[] };
      setOrders(res.orders ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retrieve your order history.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      void fetchOrders();
    }
  }, [user]);

  // Mark Order Completed (Mark as Received)
  const handleMarkReceived = async (orderId: number) => {
    setUpdatingOrderId(orderId);
    setNotice('');
    try {
      await requestJson(`/api/orders/${orderId}/complete`, {});
      setNotice('Order marked as Completed. Please leave a review below!');
      await fetchOrders(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to complete order.');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // Flag Order as Not Received
  const handleMarkNotReceived = async (orderId: number) => {
    const confirmFlag = window.confirm(
      'Are you sure you want to flag this shipment as Not Received? This will notify the seller and support immediately.'
    );
    if (!confirmFlag) return;

    setUpdatingOrderId(orderId);
    setNotice('');
    try {
      await requestJson(`/api/orders/${orderId}/flag-missing`, {});
      setNotice('Order flagged as Not Received. Support will contact you shortly.');
      await fetchOrders(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to flag order.');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // Submit Review Handler
  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReviewItem) return;
    setReviewError('');

    if (reviewComment.trim() === '') {
      setReviewError('Please write your review comment.');
      return;
    }

    setIsSubmittingReview(true);
    try {
      await requestJson(`/api/products/${activeReviewItem.product_id}/reviews`, {
        rating: reviewRating,
        comment: reviewComment,
      });

      // Close modal & reset
      setActiveReviewItem(null);
      setReviewRating(5);
      setReviewComment('');
      
      // Refresh orders
      setNotice('Thank you! Your product review has been submitted.');
      await fetchOrders(true);
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Failed to submit review.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const getStatusBadge = (status: Order['status']) => {
    switch (status) {
      case 'awaiting_verification':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-800 shadow-sm">
            <Landmark className="h-3.5 w-3.5 text-amber-600 animate-pulse" />
            Awaiting Verification
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-200 px-3 py-1 text-xs font-semibold text-indigo-800 shadow-sm">
            <RefreshCw className="h-3.5 w-3.5 text-indigo-600 animate-spin" style={{ animationDuration: '3s' }} />
            Processing / Paid
          </span>
        );
      case 'shipped':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-semibold text-blue-800 shadow-sm">
            <Truck className="h-3.5 w-3.5 text-blue-600" />
            Shipped
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-800 shadow-sm">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            Completed
          </span>
        );
      case 'not_received':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-3 py-1 text-xs font-semibold text-red-800 shadow-sm">
            <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
            Not Received
          </span>
        );
    }
  };

  if (!user) {
    return null;
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 md:px-8 lg:px-10 pb-24 relative">
      <HeaderBar user={user} onLogout={onLogout} />

      {/* Back to Home Button */}
      <div className="mb-6 mt-4">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white/80 px-4 py-2 text-xs font-semibold text-ink-700 hover:text-ink-950 hover:bg-ink-50 shadow-sm backdrop-blur transition-all"
        >
          &larr; Return to Home
        </Link>
      </div>

      <div className="rounded-3xl border border-white/70 bg-white/80 p-6 md:p-8 shadow-sm backdrop-blur space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-aura-600">Customer Lifecycle</p>
            <h1 className="mt-1 font-display text-3xl font-bold text-ink-900 md:text-4xl">My Purchase Orders</h1>
            <p className="mt-1 text-sm text-ink-600">
              Track manual payment verification, carrier dispatch details, and review materials.
            </p>
          </div>
          
          <button
            onClick={() => void fetchOrders()}
            className="self-start sm:self-center flex h-9.5 items-center gap-1.5 rounded-full border border-ink-200 bg-white px-4 text-xs font-semibold text-ink-700 hover:bg-ink-50 transition-colors shadow-sm"
          >
            <RefreshCw className="h-3.5 w-3.5 text-ink-500" />
            Refresh Orders
          </button>
        </div>

        {/* Notice/Toast alerts */}
        {notice && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-xs font-semibold text-emerald-800 leading-relaxed shadow-sm animate-in fade-in zoom-in duration-200 flex justify-between items-center gap-3">
            <span>{notice}</span>
            <button onClick={() => setNotice('')} className="text-emerald-600 hover:text-emerald-800">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {loading ? (
          <div className="space-y-6 animate-pulse py-10">
            <div className="h-28 rounded-2xl bg-ink-100" />
            <div className="h-28 rounded-2xl bg-ink-100" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 flex gap-2 text-sm text-red-800 max-w-xl mx-auto shadow-sm">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink-200 bg-ink-50/30 py-16 px-6 text-center max-w-md mx-auto">
            <ClipboardList className="mx-auto h-12 w-12 text-ink-300" />
            <h3 className="mt-4 text-base font-bold text-ink-900">No orders placed yet</h3>
            <p className="mt-2 text-xs text-ink-500">
              Your purchase history is currently empty. Buy construction materials to view tracking updates here.
            </p>
            <Link
              to="/"
              className="mt-6 inline-flex rounded-full bg-ink-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-ink-800 transition-colors"
            >
              Start Shopping
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {orders.map((order) => (
              <div
                key={order.id}
                className="rounded-2xl border border-ink-200 bg-white shadow-sm overflow-hidden"
              >
                {/* Order Top Panel */}
                <div className="bg-ink-50/70 border-b border-ink-150 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-ink-500 uppercase tracking-wider">Order Reference:</span>
                      <span className="font-display text-sm font-bold text-ink-900">{order.reference}</span>
                      {getStatusBadge(order.status)}
                    </div>
                    <p className="text-[10px] text-ink-400 font-semibold">
                      Placed on: {new Date(order.created_at).toLocaleString()}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-[10px] text-ink-400 font-semibold uppercase tracking-wider">Grand Total</p>
                    <p className="font-display text-base font-bold text-aura-600">
                      LKR {Number(order.total_price).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Order Body Details */}
                <div className="p-5 grid gap-6 md:grid-cols-3">
                  
                  {/* Items List */}
                  <div className="space-y-4 md:col-span-2">
                    <h4 className="text-[11px] font-bold text-ink-400 uppercase tracking-wider border-b border-ink-100 pb-1.5">
                      Items Ordered
                    </h4>

                    <div className="divide-y divide-ink-100 space-y-3">
                      {order.items.map((item) => (
                        <div key={item.id} className="pt-3 first:pt-0 flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            {item.images && item.images.length > 0 ? (
                              <img
                                src={item.images[0]}
                                alt={item.title}
                                className="h-12 w-12 rounded-lg object-cover border border-ink-100 shrink-0"
                              />
                            ) : (
                              <div className="h-12 w-12 rounded-lg bg-ink-100 border border-ink-150 shrink-0" />
                            )}
                            <div className="min-w-0">
                              <Link
                                to={`/products/${item.product_id}`}
                                className="text-xs font-bold text-ink-900 hover:text-aura-600 hover:underline transition-colors block truncate"
                              >
                                {item.title}
                              </Link>
                              <p className="text-[10px] text-ink-400 font-semibold mt-0.5">
                                LKR {item.price.toLocaleString()} x {item.quantity} {item.unit_type}
                              </p>
                              <p className="text-[9px] text-ink-400 italic">
                                Seller: {item.seller_business_name || item.seller_name}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-2 text-right">
                            <span className="text-xs font-bold text-ink-900">
                              LKR {(item.price * item.quantity).toLocaleString()}
                            </span>

                            {/* Reviews controller */}
                            {order.status === 'completed' && (
                              item.reviewed ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                                  Reviewed
                                </span>
                              ) : (
                                <button
                                  onClick={() => setActiveReviewItem(item)}
                                  className="flex items-center gap-1 text-[10px] font-bold text-aura-600 hover:text-aura-700 bg-aura-50 hover:bg-aura-100/50 px-2 py-0.5 rounded border border-aura-100 transition-colors shadow-sm"
                                >
                                  <Star className="h-3 w-3 fill-aura-600" />
                                  Review Item
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Order Shipping/Receipt Details Column */}
                  <div className="space-y-4 rounded-xl bg-ink-50/50 p-4 border border-ink-100/80 text-xs">
                    <div>
                      <span className="font-bold text-ink-400 uppercase tracking-wider text-[9px]">Delivery Address</span>
                      <p className="font-medium text-ink-800 mt-1 whitespace-pre-line leading-relaxed">
                        {order.delivery_address}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-ink-100">
                      <span className="font-bold text-ink-400 uppercase tracking-wider text-[9px]">Carrier Tracking</span>
                      {order.tracking_number ? (
                        <div className="mt-1.5 p-2.5 rounded-lg bg-white border border-ink-200">
                          <span className="text-[9px] text-ink-400 uppercase font-semibold block">
                            {order.courier_name || 'Carrier'}
                          </span>
                          <span className="font-mono text-xs font-bold text-ink-900 select-all block mt-0.5">
                            {order.tracking_number}
                          </span>
                        </div>
                      ) : (
                        <p className="text-ink-500 mt-1 italic">
                          {order.status === 'awaiting_verification' && 'Awaiting payment verification.'}
                          {order.status === 'processing' && 'Packaging... Awaiting courier dispatch.'}
                        </p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-ink-100 flex flex-col gap-3">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-bold text-ink-400 uppercase tracking-wider text-[9px] block">Uploaded Slip</span>
                          <a
                            href={order.bank_receipt_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-flex items-center gap-1 font-bold text-aura-600 hover:underline"
                          >
                            View Receipt Link &rarr;
                          </a>
                        </div>
                      </div>

                      {/* Confirm received or flag missing actions */}
                      {order.status === 'shipped' && (
                        <div className="flex gap-2 w-full pt-2 border-t border-ink-100/50">
                          <button
                            onClick={() => void handleMarkNotReceived(order.id)}
                            disabled={updatingOrderId === order.id}
                            className="flex-1 flex h-8 items-center justify-center rounded-lg border border-red-200 bg-red-50 hover:bg-red-100/50 disabled:opacity-50 text-[10px] font-bold text-red-700 px-2.5 transition-all active:scale-95"
                          >
                            Not Received
                          </button>
                          
                          <button
                            onClick={() => void handleMarkReceived(order.id)}
                            disabled={updatingOrderId === order.id}
                            className="flex-1 flex h-8 items-center justify-center rounded-lg bg-ink-900 hover:bg-ink-800 disabled:opacity-50 text-[10px] font-bold text-white px-2.5 shadow transition-all active:scale-95"
                          >
                            {updatingOrderId === order.id ? 'Updating...' : 'Mark Received'}
                          </button>
                        </div>
                      )}

                      {/* Info banners based on status */}
                      {order.status === 'processing' && (
                        <div className="rounded-lg bg-indigo-50 border border-indigo-150 p-2.5 text-[10px] text-indigo-700 leading-relaxed font-semibold">
                          Payment verified. Seller is packaging your order.
                        </div>
                      )}

                      {order.status === 'not_received' && (
                        <div className="rounded-lg bg-red-50 border border-red-150 p-2.5 text-[10px] text-red-700 leading-relaxed font-semibold flex items-start gap-1">
                          <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0 mt-0.5" />
                          <span>Flagged as Not Received. Support is reviewing this shipment.</span>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Write Review Modal ── */}
      {activeReviewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div
            className="fixed inset-0"
            onClick={() => setActiveReviewItem(null)}
          />
          
          <div className="relative w-full max-w-md rounded-3xl border border-ink-200 bg-white p-6 md:p-8 shadow-2xl animate-in zoom-in-95 duration-200 z-10 space-y-6">
            <button
              onClick={() => setActiveReviewItem(null)}
              className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full border border-ink-100 text-ink-400 hover:bg-ink-50 hover:text-ink-600 transition-colors"
              aria-label="Close modal"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-aura-600 uppercase tracking-wider">Leave Feedback</span>
              <h3 className="font-display text-lg font-bold text-ink-900">Review Building Material</h3>
            </div>

            {/* Product description block */}
            <div className="flex items-center gap-3 rounded-xl bg-ink-50/50 p-3.5 border border-ink-100">
              {activeReviewItem.images && activeReviewItem.images.length > 0 ? (
                <img
                  src={activeReviewItem.images[0]}
                  alt={activeReviewItem.title}
                  className="h-12 w-12 rounded-lg object-cover border border-ink-150"
                />
              ) : (
                <div className="h-12 w-12 rounded-lg bg-ink-100 border border-ink-150" />
              )}
              <div className="min-w-0">
                <p className="text-xs font-bold text-ink-900 truncate">{activeReviewItem.title}</p>
                <p className="text-[10px] text-ink-400 font-semibold mt-0.5">
                  Unit type: {activeReviewItem.unit_type} • Price: LKR {activeReviewItem.price.toLocaleString()}
                </p>
              </div>
            </div>

            <form onSubmit={handleReviewSubmit} className="space-y-5">
              {/* Star selector */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-ink-500 uppercase tracking-wider block">
                  Select Rating Stars
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewRating(star)}
                      className="text-ink-200 hover:scale-110 active:scale-95 transition-transform"
                      aria-label={`Rate ${star} star`}
                    >
                      <Star
                        className={`h-8 w-8 ${
                          star <= reviewRating ? 'fill-amber-400 text-amber-400' : 'text-ink-200'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Comments */}
              <div className="space-y-2">
                <label htmlFor="review-comment" className="text-[10px] font-bold text-ink-500 uppercase tracking-wider block">
                  Share your experience with this material
                </label>
                <textarea
                  id="review-comment"
                  rows={4}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Is the quality good? Did it arrive intact? How was unloading?..."
                  className="w-full rounded-xl border border-ink-200 p-3 text-xs text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-ink-900/10 shadow-inner resize-none min-h-[90px]"
                  required
                />
              </div>

              {reviewError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 flex gap-2">
                  <AlertCircle className="h-4.5 w-4.5 shrink-0 text-red-600" />
                  <span>{reviewError}</span>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmittingReview}
                className="w-full flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-aura-500 to-aura-600 hover:from-aura-600 hover:to-aura-700 disabled:opacity-50 font-semibold text-sm text-white shadow-md transition-all active:scale-95"
              >
                {isSubmittingReview ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Submitting Feedback...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4.5 w-4.5" />
                    Submit Review
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

    </main>
  );
}
