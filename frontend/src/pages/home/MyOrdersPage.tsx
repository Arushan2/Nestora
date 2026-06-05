import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Package, ShieldAlert, CheckCircle2, Clock, Truck, Award, Star, UploadCloud, Copy, Check } from 'lucide-react';
import { HeaderBar } from '../../components/HeaderBar';
import { requestJson, requestForm } from '../../lib/api';
import type { User, Order, OrderItem } from '../../types/session';

export function MyOrdersPage({
  user,
  onLogout,
}: {
  user: User | null;
  onLogout: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Review Modal state
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewOrder, setReviewOrder] = useState<Order | null>(null);
  const [reviewItem, setReviewItem] = useState<OrderItem | null>(null);
  const [productRating, setProductRating] = useState(5);
  const [sellerRating, setSellerRating] = useState(5);
  const [comment, setComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  // Receipt Reupload state
  const [reuploadingOrderId, setReuploadingOrderId] = useState<number | null>(null);
  const [reuploadFile, setReuploadFile] = useState<File | null>(null);
  const [reuploadSubmitting, setReuploadSubmitting] = useState(false);

  // Copy tracking state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function fetchOrders() {
    try {
      const response = (await requestJson('/api/orders/customer')) as any;
      if (response.orders) {
        setOrders(response.orders);
      }
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    void fetchOrders();
  }, [user]);

  const handleMarkAsReceived = async (orderId: number, order: Order) => {
    if (!confirm('Mark this order as received? This will set status to Completed and open the review form.')) return;
    try {
      await requestJson(`/api/orders/${orderId}/receive`, {});
      await fetchOrders();
      
      // Auto open review modal for the first item
      if (order.items && order.items.length > 0) {
        setReviewOrder(order);
        setReviewItem(order.items[0]);
        setProductRating(5);
        setSellerRating(5);
        setComment('');
        setShowReviewModal(true);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed.');
    }
  };

  const handleFlagAsNotReceived = async (orderId: number) => {
    if (!confirm('Are you sure you want to flag this order as NOT received? This will alert the merchant and Nestora admins.')) return;
    try {
      await requestJson(`/api/orders/${orderId}/flag`, {});
      await fetchOrders();
      alert('Order flagged as Not Received. Support is reviewing this transaction.');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed.');
    }
  };

  const handleOpenReviewModal = (order: Order, item: OrderItem) => {
    setReviewOrder(order);
    setReviewItem(item);
    setProductRating(5);
    setSellerRating(5);
    setComment('');
    setShowReviewModal(true);
  };

  const handleSubmitReview = async () => {
    if (!reviewOrder || !reviewItem) return;
    setReviewSubmitting(true);
    try {
      await requestJson('/api/reviews', {
        order_id: reviewOrder.id,
        product_id: reviewItem.product_id,
        product_rating: productRating,
        seller_rating: sellerRating,
        comment: comment.trim()
      });
      alert('Thank you for your review!');
      setShowReviewModal(false);
      await fetchOrders();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to submit review.');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleReuploadFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setReuploadFile(e.target.files[0]);
    }
  };

  const handleReuploadReceipt = async (orderId: number) => {
    if (!reuploadFile) {
      alert('Please select a payment receipt file first.');
      return;
    }
    setReuploadSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('receipt', reuploadFile);
      await requestForm(`/api/orders/${orderId}/reupload-receipt`, formData);
      alert('Receipt re-uploaded successfully.');
      setReuploadingOrderId(null);
      setReuploadFile(null);
      await fetchOrders();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to upload receipt.');
    } finally {
      setReuploadSubmitting(false);
    }
  };

  const handleCopyTracking = (trackingNum: string) => {
    navigator.clipboard.writeText(trackingNum).then(() => {
      setCopiedId(trackingNum);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'awaiting_verification':
        return 'bg-amber-100 border border-amber-200 text-amber-800';
      case 'processing':
        return 'bg-blue-100 border border-blue-200 text-blue-800';
      case 'shipped':
        return 'bg-emerald-100 border border-emerald-200 text-emerald-800';
      case 'completed':
        return 'bg-ink-900 border border-ink-900 text-white';
      case 'not_received':
        return 'bg-red-100 border border-red-200 text-red-800 animate-pulse';
      default:
        return 'bg-ink-100 border border-ink-200 text-ink-600';
    }
  };

  const getStatusLabel = (status: string, sellerNote: string | null, receiptUrl: string | null) => {
    if (status === 'awaiting_verification' && !receiptUrl && sellerNote) {
      return 'Payment Rejected - Upload Required';
    }
    switch (status) {
      case 'awaiting_verification':
        return 'Awaiting Verification';
      case 'processing':
        return 'Paid / Processing';
      case 'shipped':
        return 'Dispatched / Shipped';
      case 'completed':
        return 'Completed';
      case 'not_received':
        return 'Not Received / Flagged';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 md:px-8 lg:px-10">
        <HeaderBar user={user} onLogout={onLogout} />
        <div className="flex justify-center py-32">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-ink-200 border-t-ink-900" />
            <p className="font-display text-sm font-medium text-ink-600">Retrieving order history...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 md:px-8 lg:px-10">
      <HeaderBar user={user} onLogout={onLogout} />

      <div className="mb-6 mt-4">
        <h1 className="font-display text-3xl font-bold text-ink-900 flex items-center gap-2.5">
          <Package className="h-8 w-8 text-aura-600" />
          My Orders History
        </h1>
        <p className="text-sm text-ink-500 mt-1">Track manual payment verifications and courier deliveries of your materials.</p>
      </div>

      {orders.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-ink-200 bg-white p-16 text-center max-w-2xl mx-auto shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-ink-50 text-ink-400">
            <Package className="h-8 w-8" />
          </div>
          <h2 className="mt-4 font-display text-lg font-bold text-ink-900">No orders found</h2>
          <p className="mt-1 text-sm text-ink-500">You haven't placed any orders on Nestora Marketplace yet.</p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-ink-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-ink-800 transition-colors shadow-md"
          >
            Explore Materials
          </Link>
        </div>
      ) : (
        <div className="space-y-6 max-w-4xl mx-auto">
          {orders.map((order) => {
            const isRejected = order.status === 'awaiting_verification' && !order.receipt_url && order.seller_note;
            return (
              <div
                key={order.id}
                className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur space-y-6 transition-all hover:shadow-md animate-in fade-in"
              >
                {/* Order Meta Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-ink-100 pb-4">
                  <div className="space-y-1">
                    <span className="text-[10px] text-ink-400 font-bold uppercase tracking-wider">Order Reference</span>
                    <h3 className="font-mono text-base font-bold text-ink-900 flex items-center gap-2">
                      {order.order_number}
                      <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase ${getStatusBadgeClass(order.status)}`}>
                        {getStatusLabel(order.status, order.seller_note, order.receipt_url)}
                      </span>
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    <div>
                      <span className="text-[10px] text-ink-400 font-bold uppercase tracking-wider block">Ordered Date</span>
                      <span className="font-semibold text-ink-700">
                        {new Date(order.created_at).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-ink-400 font-bold uppercase tracking-wider block">Seller Name</span>
                      <span className="font-semibold text-ink-700">
                        {order.seller_business_name ?? order.seller_name}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-ink-400 font-bold uppercase tracking-wider block">Grand Total</span>
                      <span className="font-bold text-aura-700">LKR {Number(order.total_cost).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Milestone Progress Bar */}
                {!isRejected && order.status !== 'not_received' && (
                  <div className="py-2">
                    <div className="relative flex items-center justify-between">
                      {/* Grey Background Line */}
                      <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 bg-ink-100 -z-10 rounded-full" />
                      
                      {/* Active colored line */}
                      <div
                        className="absolute left-0 top-1/2 h-1 -translate-y-1/2 bg-aura-500 transition-all duration-500 rounded-full -z-10"
                        style={{
                          width:
                            order.status === 'awaiting_verification'
                              ? '0%'
                              : order.status === 'processing'
                              ? '33.3%'
                              : order.status === 'shipped'
                              ? '66.6%'
                              : order.status === 'completed'
                              ? '100%'
                              : '0%',
                        }}
                      />

                      {/* Milestones */}
                      {[
                        { key: 'verification', label: 'Payment Review', icon: Clock, active: true },
                        { key: 'paid', label: 'Paid / Packaging', icon: CheckCircle2, active: order.status !== 'awaiting_verification' },
                        { key: 'shipped', label: 'Dispatched / Courier', icon: Truck, active: order.status === 'shipped' || order.status === 'completed' },
                        { key: 'completed', label: 'Completed', icon: Award, active: order.status === 'completed' },
                      ].map((m, idx) => {
                        const Icon = m.icon;
                        return (
                          <div key={m.key} className="flex flex-col items-center gap-1.5">
                            <div
                              className={`flex h-8 w-8 items-center justify-center rounded-full border transition-all duration-300 ${
                                m.active
                                  ? 'border-aura-500 bg-aura-500 text-white shadow-sm'
                                  : 'border-ink-200 bg-white text-ink-400'
                              }`}
                            >
                              <Icon className="h-4.5 w-4.5" />
                            </div>
                            <span
                              className={`text-[9px] font-bold uppercase tracking-wider ${
                                m.active ? 'text-ink-900' : 'text-ink-400'
                              }`}
                            >
                              {m.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Rejected Receipt Notice & Re-uploader */}
                {isRejected && (
                  <div className="border border-red-200 bg-red-50/40 p-5 rounded-2xl space-y-4">
                    <div className="flex gap-3">
                      <ShieldAlert className="h-5.5 w-5.5 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-bold text-red-950">Payment Verification Rejected</h4>
                        <p className="text-xs text-red-800 leading-relaxed mt-1">
                          Reason: <span className="font-semibold">"{order.seller_note}"</span>
                        </p>
                      </div>
                    </div>

                    {reuploadingOrderId === order.id ? (
                      <div className="space-y-3 pt-3 border-t border-red-100">
                        <label className="text-[10px] text-red-950 font-bold uppercase tracking-wider block">Upload New Transaction Receipt</label>
                        <div className="flex flex-col sm:flex-row gap-3">
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={handleReuploadFileChange}
                            className="text-xs text-ink-600 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-ink-900 file:text-white hover:file:bg-ink-800 cursor-pointer"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => void handleReuploadReceipt(order.id)}
                              disabled={!reuploadFile || reuploadSubmitting}
                              className="rounded-full bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-semibold text-white transition-all disabled:opacity-50"
                            >
                              {reuploadSubmitting ? 'Uploading...' : 'Submit Receipt'}
                            </button>
                            <button
                              onClick={() => setReuploadingOrderId(null)}
                              className="rounded-full border border-ink-200 bg-white hover:bg-ink-50 px-4 py-2 text-xs font-semibold text-ink-700"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setReuploadingOrderId(order.id);
                          setReuploadFile(null);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-full bg-red-600 hover:bg-red-700 px-4 py-2 text-xs font-semibold text-white transition-all"
                      >
                        <UploadCloud className="h-4 w-4" />
                        Re-upload New Payment Receipt
                      </button>
                    )}
                  </div>
                )}

                {/* Shipped Courier Details */}
                {order.status === 'shipped' && order.courier_name && (
                  <div className="border border-emerald-100 bg-emerald-50/30 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider block">Courier / Delivery Info</span>
                      <p className="text-xs font-semibold text-ink-900 leading-relaxed">
                        Shipment Method: <span className="font-bold text-emerald-950">{order.courier_name}</span>
                        {order.tracking_number && (
                          <>
                            {' '} | Tracking Code:{' '}
                            <span className="font-mono bg-white border border-emerald-100 px-1.5 py-0.5 rounded text-emerald-950 font-bold text-xs">{order.tracking_number}</span>
                          </>
                        )}
                      </p>
                    </div>

                    {order.tracking_number && (
                      <button
                        onClick={() => handleCopyTracking(order.tracking_number!)}
                        className="inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-white px-3 py-1.5 text-xs text-emerald-800 hover:bg-emerald-50 transition-colors self-start sm:self-auto"
                      >
                        {copiedId === order.tracking_number ? (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            Copy Code
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}

                {/* Order Items List */}
                <div className="space-y-3">
                  <span className="text-[10px] text-ink-400 font-bold uppercase tracking-wider block">Order Items</span>
                  <div className="divide-y divide-ink-50">
                    {order.items?.map((item) => (
                      <div key={item.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 gap-4">
                        <div className="flex items-center gap-3">
                          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-ink-100 bg-ink-50">
                            {item.images && item.images.length > 0 ? (
                              <img src={item.images[0]} alt={item.title} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[10px] text-ink-400">N/A</div>
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-ink-900 leading-tight">{item.title}</p>
                            <p className="text-[10px] text-ink-400 mt-0.5">
                              {item.quantity} units @ LKR {Number(item.price).toLocaleString()}
                            </p>
                          </div>
                        </div>

                        {/* Review Item Button */}
                        {order.status === 'completed' && (
                          <div>
                            {item.reviewed ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
                                <Check className="h-3 w-3" />
                                Reviewed
                              </span>
                            ) : (
                              <button
                                onClick={() => handleOpenReviewModal(order, item)}
                                className="inline-flex items-center gap-1 rounded-full border border-ink-200 bg-white hover:bg-ink-50 hover:text-aura-600 hover:border-aura-300 px-3 py-1.5 text-[10px] font-semibold text-ink-700 transition-colors shadow-sm"
                              >
                                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                Review Product
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Order Footer Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-ink-50 pt-4">
                  <div className="text-[10px] text-ink-400 leading-relaxed max-w-md">
                    Delivery Address: <span className="font-semibold text-ink-800">{order.delivery_address}</span>
                  </div>

                  {/* Customer Milestones Actions */}
                  <div className="flex gap-2 justify-end">
                    {order.status === 'shipped' && (
                      <>
                        <button
                          onClick={() => handleFlagAsNotReceived(order.id)}
                          className="rounded-full border border-red-200 text-red-700 bg-red-50/50 hover:bg-red-50 hover:border-red-300 px-4 py-2 text-xs font-semibold transition-colors"
                        >
                          Not Received
                        </button>
                        <button
                          onClick={() => void handleMarkAsReceived(order.id, order)}
                          className="rounded-full bg-ink-900 hover:bg-ink-800 text-white px-5 py-2 text-xs font-semibold shadow transition-all hover:scale-[1.01]"
                        >
                          Mark as Received
                        </button>
                      </>
                    )}
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* RATINGS & REVIEWS MODAL */}
      {showReviewModal && reviewOrder && reviewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm px-4">
          <div className="absolute inset-0" onClick={() => setShowReviewModal(false)} />
          
          <div className="relative z-10 w-full max-w-md rounded-3xl border border-white/70 bg-white/95 p-6 md:p-8 shadow-xl backdrop-blur animate-in zoom-in-95 duration-200">
            <h3 className="font-display text-lg font-bold text-ink-900 mb-2">Write Product & Seller Review</h3>
            <p className="text-xs text-ink-500 mb-6">Your feedback helps other homebuilders make reliable vendor decisions.</p>

            <div className="space-y-5">
              {/* Product Info */}
              <div className="flex items-center gap-3 bg-ink-50/60 p-3 rounded-2xl border border-ink-100">
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-ink-200 bg-white">
                  {reviewItem.images && reviewItem.images.length > 0 ? (
                    <img src={reviewItem.images[0]} alt={reviewItem.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[8px] text-ink-400">N/A</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-ink-900">{reviewItem.title}</p>
                  <p className="text-[10px] text-ink-400">Merchant: {reviewOrder.seller_business_name ?? reviewOrder.seller_name}</p>
                </div>
              </div>

              {/* Rating 1: Product Quality */}
              <div>
                <label className="text-[10px] text-ink-500 font-bold uppercase tracking-wider block mb-1.5">Product Quality Rating</label>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setProductRating(star)}
                      className="text-amber-400 hover:scale-110 transition-transform focus:outline-none"
                    >
                      <Star className={`h-8 w-8 ${star <= productRating ? 'fill-amber-400' : 'text-ink-200'}`} />
                    </button>
                  ))}
                  <span className="text-xs text-ink-600 font-bold ml-2">{productRating} / 5</span>
                </div>
              </div>

              {/* Rating 2: Seller Communication/Logistics */}
              <div>
                <label className="text-[10px] text-ink-500 font-bold uppercase tracking-wider block mb-1.5">Merchant Service Rating</label>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setSellerRating(star)}
                      className="text-amber-400 hover:scale-110 transition-transform focus:outline-none"
                    >
                      <Star className={`h-8 w-8 ${star <= sellerRating ? 'fill-amber-400' : 'text-ink-200'}`} />
                    </button>
                  ))}
                  <span className="text-xs text-ink-600 font-bold ml-2">{sellerRating} / 5</span>
                </div>
              </div>

              {/* Text Review */}
              <div>
                <label className="text-[10px] text-ink-500 font-bold uppercase tracking-wider block mb-1.5">Write Review Comments</label>
                <textarea
                  rows={3}
                  placeholder="Share details of your experience (e.g. material quality, delivery speed, site unloading behavior...)"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full rounded-xl border border-ink-200 bg-white p-3 text-xs text-ink-900 placeholder-ink-400 outline-none transition-all focus:border-ink-400 focus:ring-2 focus:ring-ink-900/10"
                />
              </div>
            </div>

            <div className="flex gap-2.5 mt-6 border-t border-ink-100 pt-5">
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                disabled={reviewSubmitting}
                className="flex-1 rounded-full border border-ink-200 bg-white hover:bg-ink-50 py-3 text-xs font-semibold text-ink-700 transition-colors"
              >
                Skip Review
              </button>
              <button
                type="button"
                onClick={handleSubmitReview}
                disabled={reviewSubmitting}
                className="flex-1 rounded-full bg-ink-900 hover:bg-ink-800 py-3 text-xs font-semibold text-white transition-all shadow shadow-ink-900/20"
              >
                {reviewSubmitting ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
