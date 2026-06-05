import { useEffect, useState } from 'react';
import { Landmark, Truck, FileText, CheckCircle2, XCircle, AlertTriangle, Eye, ShieldCheck, Mail, MapPin } from 'lucide-react';
import { requestJson } from '../../../lib/api';
import type { User, Order } from '../../../types/session';

export function OrdersPage({
  user,
}: {
  user: User;
}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  // Input states for verifying/shipping orders
  const [selectedReceiptUrl, setSelectedReceiptUrl] = useState<string | null>(null);
  
  // Rejection state
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  
  // Shipping details state
  const [shippingId, setShippingId] = useState<number | null>(null);
  const [courierName, setCourierName] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');

  // General notes state (during verification)
  const [sellerNoteId, setSellerNoteId] = useState<number | null>(null);
  const [sellerNote, setSellerNote] = useState('');

  async function fetchOrders() {
    try {
      const response = (await requestJson('/api/orders/seller')) as any;
      if (response.orders) {
        setOrders(response.orders);
      }
    } catch (err) {
      console.error('Failed to load seller orders:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchOrders();
  }, []);

  const handleVerifyPayment = async (orderId: number) => {
    if (!confirm('Verify that you have received this payment in your Nestora dashboard? This will change status to Processing.')) return;
    try {
      const noteToSubmit = sellerNoteId === orderId ? sellerNote : '';
      await requestJson(`/api/orders/${orderId}/verify-payment`, { seller_note: noteToSubmit });
      alert('Payment verified successfully!');
      setSellerNoteId(null);
      setSellerNote('');
      await fetchOrders();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed.');
    }
  };

  const handleRejectPayment = async (orderId: number) => {
    if (!rejectReason.trim()) {
      alert('Please enter a reason for rejecting the receipt.');
      return;
    }
    try {
      await requestJson(`/api/orders/${orderId}/reject-payment`, { reason: rejectReason.trim() });
      alert('Receipt rejected. Customer has been requested to upload a new slip.');
      setRejectId(null);
      setRejectReason('');
      await fetchOrders();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed.');
    }
  };

  const handleShipOrder = async (orderId: number) => {
    if (!courierName.trim()) {
      alert('Courier/delivery dispatch information is required.');
      return;
    }
    try {
      await requestJson(`/api/orders/${orderId}/ship`, {
        courier_name: courierName.trim(),
        tracking_number: trackingNumber.trim()
      });
      alert('Order marked as shipped!');
      setShippingId(null);
      setCourierName('');
      setTrackingNumber('');
      await fetchOrders();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed.');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'awaiting_verification':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'processing':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'shipped':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'completed':
        return 'bg-ink-900 text-white border-ink-900';
      case 'not_received':
        return 'bg-red-50 text-red-800 border-red-200 animate-pulse';
      default:
        return 'bg-ink-50 text-ink-600 border-ink-200';
    }
  };

  const getStatusLabel = (status: string, receiptUrl: string | null) => {
    if (status === 'awaiting_verification' && !receiptUrl) {
      return 'Receipt Rejected - Waiting Re-upload';
    }
    switch (status) {
      case 'awaiting_verification':
        return 'Awaiting Verification';
      case 'processing':
        return 'Paid / Packaging';
      case 'shipped':
        return 'Shipped';
      case 'completed':
        return 'Completed';
      case 'not_received':
        return 'Not Received (Alert)';
      default:
        return status;
    }
  };

  const filteredOrders = orders.filter((order) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'awaiting_verification') {
      return order.status === 'awaiting_verification';
    }
    return order.status === activeFilter;
  });

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-ink-200 border-t-ink-900" />
          <p className="font-display text-sm font-medium text-ink-600">Retrieving incoming sales orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tabs / Filters */}
      <div className="flex flex-wrap gap-2 border-b border-ink-100 pb-4">
        {[
          { id: 'all', label: 'All Orders' },
          { id: 'awaiting_verification', label: 'Awaiting Verification' },
          { id: 'processing', label: 'Paid / Packaging' },
          { id: 'shipped', label: 'Shipped' },
          { id: 'completed', label: 'Completed' },
          { id: 'not_received', label: 'Flagged Issue' },
        ].map((tab) => {
          const count = orders.filter((o) => {
            if (tab.id === 'all') return true;
            return o.status === tab.id;
          }).length;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                activeFilter === tab.id
                  ? 'bg-ink-900 text-white shadow-sm'
                  : 'border border-ink-200 bg-white text-ink-600 hover:bg-ink-50'
              }`}
            >
              {tab.label}
              <span className="ml-1.5 rounded-full bg-ink-100 px-1.5 py-0.5 text-[9px] font-bold text-ink-600">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {filteredOrders.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-ink-200 bg-white p-16 text-center max-w-2xl mx-auto shadow-sm">
          <Landmark className="mx-auto h-12 w-12 text-ink-300" />
          <h3 className="mt-4 font-display text-base font-bold text-ink-900">No matching orders</h3>
          <p className="mt-1 text-sm text-ink-500">There are no customer orders in this status category.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredOrders.map((order) => {
            const isFlagged = order.status === 'not_received';
            const isRejected = order.status === 'awaiting_verification' && !order.receipt_url;

            return (
              <div
                key={order.id}
                className={`rounded-3xl border bg-white p-6 shadow-sm transition-all hover:shadow-md ${
                  isFlagged
                    ? 'border-red-300 bg-red-50/10'
                    : 'border-white/70'
                }`}
              >
                {/* Meta details Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-ink-100 pb-4">
                  <div>
                    <span className="text-[10px] text-ink-400 font-bold uppercase tracking-wider">Order Reference</span>
                    <h4 className="font-mono text-base font-bold text-ink-900 flex items-center gap-2">
                      {order.order_number}
                      <span className={`rounded-full border px-2.5 py-0.5 text-[9px] font-bold uppercase ${getStatusColor(order.status)}`}>
                        {getStatusLabel(order.status, order.receipt_url)}
                      </span>
                    </h4>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    <div>
                      <span className="text-[10px] text-ink-400 font-bold uppercase tracking-wider block font-semibold">Order Date</span>
                      <span className="text-ink-700">
                        {new Date(order.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-ink-400 font-bold uppercase tracking-wider block font-semibold">Total Revenue</span>
                      <span className="font-bold text-emerald-700">LKR {Number(order.total_cost).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Grid layout for Customer Info & Order Items */}
                <div className="grid gap-6 md:grid-cols-2 pt-4">
                  {/* Left Column: Customer details & shipping */}
                  <div className="space-y-3">
                    <h5 className="text-[10px] text-ink-400 font-bold uppercase tracking-wider">Customer Details</h5>
                    
                    <div className="rounded-2xl border border-ink-100 bg-ink-50/30 p-4 space-y-2.5">
                      <div className="flex items-center gap-2 text-xs font-semibold text-ink-900">
                        <ShieldCheck className="h-4 w-4 text-ink-400" />
                        <span>Name: {order.customer_name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-ink-600">
                        <Mail className="h-4 w-4 text-ink-400" />
                        <a href={`mailto:${order.customer_email}`} className="hover:underline">{order.customer_email}</a>
                      </div>
                      <div className="flex items-start gap-2 text-xs text-ink-600">
                        <MapPin className="h-4 w-4 text-ink-400 shrink-0 mt-0.5" />
                        <span>Address: {order.delivery_address}</span>
                      </div>
                    </div>

                    {order.seller_note && (
                      <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
                        <span className="font-bold block">Seller Note:</span>
                        "{order.seller_note}"
                      </div>
                    )}
                  </div>

                  {/* Right Column: Ordered listings */}
                  <div className="space-y-3">
                    <h5 className="text-[10px] text-ink-400 font-bold uppercase tracking-wider">Ordered Products</h5>
                    <div className="divide-y divide-ink-100 border border-ink-100 bg-white rounded-2xl p-4 space-y-2.5 max-h-[180px] overflow-y-auto">
                      {order.items?.map((item) => (
                        <div key={item.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 gap-3">
                          <div className="flex items-center gap-2.5">
                            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-ink-100 bg-ink-50">
                              {item.images && item.images.length > 0 ? (
                                <img src={item.images[0]} alt={item.title} className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-[8px] text-ink-400">N/A</div>
                              )}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-ink-900 leading-snug">{item.title}</p>
                              <p className="text-[10px] text-ink-500">
                                {item.quantity} x LKR {Number(item.price).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <span className="text-xs font-bold text-ink-900">
                            LKR {(item.price * item.quantity).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Fulfillment Actions Card Container */}
                <div className="mt-6 border-t border-ink-100 pt-5 space-y-4">
                  {/* Status 1: Verification Flow */}
                  {order.status === 'awaiting_verification' && order.receipt_url && (
                    <div className="border border-aura-100 bg-aura-50/10 p-5 rounded-3xl space-y-4">
                      <div className="flex items-center justify-between border-b border-aura-100 pb-3">
                        <span className="font-display text-sm font-bold text-ink-900 flex items-center gap-1.5">
                          <Landmark className="h-4.5 w-4.5 text-aura-600" />
                          Verify Manual Payment Receipt
                        </span>
                        
                        <button
                          onClick={() => setSelectedReceiptUrl(order.receipt_url)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-aura-600 hover:underline"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View Receipt Fullscreen
                        </button>
                      </div>

                      <div className="flex flex-col md:flex-row gap-5 items-start">
                        {/* Receipt Thumbnail */}
                        <div
                          onClick={() => setSelectedReceiptUrl(order.receipt_url)}
                          className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl border border-ink-200 bg-ink-50 shadow-sm cursor-zoom-in relative group"
                        >
                          {order.receipt_url.endsWith('.pdf') ? (
                            <div className="flex h-full w-full flex-col items-center justify-center text-center p-2 text-ink-400 bg-white">
                              <FileText className="h-8 w-8 text-aura-500" />
                              <span className="text-[9px] font-bold uppercase mt-1">PDF File</span>
                            </div>
                          ) : (
                            <img src={order.receipt_url} alt="Receipt Slip" className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                          )}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <Eye className="text-white h-5 w-5 drop-shadow" />
                          </div>
                        </div>

                        {/* Note and Actions */}
                        <div className="flex-1 space-y-3 w-full">
                          {rejectId === order.id ? (
                            <div className="space-y-3 bg-red-50/50 p-4 border border-red-200 rounded-2xl animate-in slide-in-from-top-2">
                              <label className="text-[10px] text-red-950 font-bold uppercase tracking-wider block">Reason for rejection</label>
                              <textarea
                                placeholder="E.g. Transaction amount is incorrect, slip is blurry, reference code mismatch..."
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                className="w-full rounded-xl border border-red-200 bg-white p-3 text-xs text-red-900 outline-none"
                                rows={2}
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => void handleRejectPayment(order.id)}
                                  className="rounded-full bg-red-600 hover:bg-red-700 px-4 py-1.5 text-xs font-semibold text-white transition-all"
                                >
                                  Submit Rejection
                                </button>
                                <button
                                  onClick={() => {
                                    setRejectId(null);
                                    setRejectReason('');
                                  }}
                                  className="rounded-full border border-ink-200 bg-white px-4 py-1.5 text-xs font-semibold text-ink-700"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex gap-3">
                                <input
                                  type="text"
                                  placeholder="Add an optional verification note or instruction..."
                                  value={sellerNoteId === order.id ? sellerNote : ''}
                                  onChange={(e) => {
                                    setSellerNoteId(order.id);
                                    setSellerNote(e.target.value);
                                  }}
                                  className="h-10 flex-1 rounded-xl border border-ink-200 bg-white px-3 text-xs outline-none focus:border-ink-400"
                                />
                              </div>
                              <div className="flex flex-wrap gap-2.5">
                                <button
                                  onClick={() => void handleVerifyPayment(order.id)}
                                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 px-5 py-2.5 text-xs font-semibold text-white transition-all shadow"
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                  Approve & Verify Payment
                                </button>
                                <button
                                  onClick={() => {
                                    setRejectId(order.id);
                                    setRejectReason('');
                                  }}
                                  className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 px-5 py-2.5 text-xs font-semibold transition-all"
                                >
                                  <XCircle className="h-4 w-4" />
                                  Reject Payment Slip
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Status 1.5: Waiting for Re-upload */}
                  {isRejected && (
                    <div className="border border-dashed border-amber-200 bg-amber-50/10 p-4 rounded-2xl flex items-center gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                      <p className="text-xs text-amber-800 font-medium">
                        Payment receipt has been rejected. Waiting for the customer to upload a new slip.
                      </p>
                    </div>
                  )}

                  {/* Status 2: Shipping Dispatch Flow */}
                  {order.status === 'processing' && (
                    <div className="border border-blue-100 bg-blue-50/10 p-5 rounded-3xl space-y-4">
                      <div className="flex items-center gap-1.5 border-b border-blue-100 pb-3">
                        <Truck className="h-4.5 w-4.5 text-blue-600" />
                        <span className="font-display text-sm font-bold text-ink-900">Dispatch Material & Courier Shipment</span>
                      </div>

                      {shippingId === order.id ? (
                        <div className="grid gap-4 sm:grid-cols-2 animate-in slide-in-from-top-2">
                          <div>
                            <label className="text-[10px] text-ink-500 font-bold uppercase tracking-wider block">Courier / Dispatch Details</label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. Pronto Courier / Local Transport Truck"
                              value={courierName}
                              onChange={(e) => setCourierName(e.target.value)}
                              className="mt-1.5 h-10 w-full rounded-xl border border-ink-200 bg-white px-3 text-xs outline-none focus:border-ink-400"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-ink-500 font-bold uppercase tracking-wider block">Tracking Code (Optional)</label>
                            <input
                              type="text"
                              placeholder="e.g. PR1029845 / License WP-GB-4592"
                              value={trackingNumber}
                              onChange={(e) => setTrackingNumber(e.target.value)}
                              className="mt-1.5 h-10 w-full rounded-xl border border-ink-200 bg-white px-3 text-xs outline-none focus:border-ink-400"
                            />
                          </div>
                          <div className="sm:col-span-2 flex gap-2 pt-2">
                            <button
                              onClick={() => void handleShipOrder(order.id)}
                              className="rounded-full bg-ink-900 hover:bg-ink-800 text-white px-5 py-2 text-xs font-semibold shadow"
                            >
                              Confirm Dispatch Shipment
                            </button>
                            <button
                              onClick={() => {
                                setShippingId(null);
                                setCourierName('');
                                setTrackingNumber('');
                              }}
                              className="rounded-full border border-ink-200 bg-white px-4 py-2 text-xs font-semibold text-ink-700"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setShippingId(order.id);
                            setCourierName('');
                            setTrackingNumber('');
                          }}
                          className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 text-xs font-semibold shadow transition-all hover:scale-[1.01]"
                        >
                          <Truck className="h-4 w-4" />
                          Mark Order as Shipped (Courier Dispatch)
                        </button>
                      )}
                    </div>
                  )}

                  {/* Status 3/4/5: Dispatched / Shipped info */}
                  {(order.status === 'shipped' || order.status === 'completed' || order.status === 'not_received') && order.courier_name && (
                    <div className="bg-ink-50/50 p-4 rounded-2xl space-y-1">
                      <span className="text-[10px] text-ink-400 font-bold uppercase tracking-wider block font-semibold">Courier / Dispatch Details</span>
                      <p className="text-xs text-ink-700">
                        Courier: <span className="font-bold text-ink-900">{order.courier_name}</span>
                        {order.tracking_number && (
                          <> | Tracking Code: <span className="font-mono bg-white border border-ink-200 px-1.5 py-0.5 rounded text-ink-900 font-bold text-xs">{order.tracking_number}</span></>
                        )}
                      </p>
                    </div>
                  )}

                  {/* Warning if Flagged as Not Received */}
                  {isFlagged && (
                    <div className="border border-red-200 bg-red-50/60 p-4 rounded-2xl flex items-center gap-3">
                      <AlertTriangle className="h-5.5 w-5.5 text-red-600 shrink-0" />
                      <div className="space-y-0.5">
                        <p className="text-xs text-red-950 font-bold">Customer Flagged Order as NOT Received</p>
                        <p className="text-[10px] text-red-800">
                          Please contact the customer or courier service to resolve tracking/logistics issues immediately.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* FULLSCREEN RECEIPT LIGHTBOX */}
      {selectedReceiptUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 px-4 py-10">
          <button
            onClick={() => setSelectedReceiptUrl(null)}
            className="absolute right-6 top-6 rounded-full bg-white/10 hover:bg-white/20 p-3 text-white transition-colors"
          >
            <XCircle className="h-6 w-6" />
          </button>
          
          <div className="max-w-4xl max-h-[85vh] w-full flex items-center justify-center p-4">
            {selectedReceiptUrl.endsWith('.pdf') ? (
              <iframe
                src={selectedReceiptUrl}
                title="Receipt PDF"
                className="w-full h-[80vh] rounded-3xl bg-white"
              />
            ) : (
              <img
                src={selectedReceiptUrl}
                alt="Payment Slip Fullscreen"
                className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl animate-in zoom-in-95"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
