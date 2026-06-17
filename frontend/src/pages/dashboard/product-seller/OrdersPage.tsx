import { useEffect, useState } from 'react';
import { requestJson } from '../../../lib/api';
import type { User } from '../../../types/session';
import { ShoppingBag, Landmark, Truck, CheckCircle, FileText, AlertCircle, RefreshCw, X, Check, AlertTriangle } from 'lucide-react';

type OrderItem = {
  id: number;
  order_id: number;
  product_id: number;
  quantity: number;
  price: number;
  title: string;
  images: string[];
  unit_type: string;
};

type Order = {
  id: string | number;
  customer_id: number;
  seller_id: number | null;
  reference: string;
  delivery_address: string;
  shipping_fee: number;
  total_price: number;
  bank_receipt_url: string | null;
  status: string;
  courier_name: string | null;
  tracking_number: string | null;
  created_at: string;
  updated_at: string;
  customer_name: string;
  customer_email: string;
  items: OrderItem[];
};

export function SellerOrdersPage({
  user,
  searchQuery = '',
}: {
  user: User;
  searchQuery?: string;
}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Verification State
  const [verifyingOrderId, setVerifyingOrderId] = useState<string | number | null>(null);

  // Shipping Modal/Form State
  const [shippingOrderId, setShippingOrderId] = useState<string | number | null>(null);
  const [courierName, setCourierName] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [isShipping, setIsShipping] = useState(false);
  const [shippingError, setShippingError] = useState('');

  const fetchOrders = async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = (await requestJson<unknown>('/api/orders/seller')) as { orders: Order[] };
      setOrders(res.orders ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retrieve customer orders.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    void fetchOrders();
  }, []);

  // Verify payment action
  const handleVerifyPayment = async (orderId: string | number) => {
    setVerifyingOrderId(orderId);
    setError('');
    try {
      await requestJson(`/api/orders/${encodeURIComponent(orderId)}/verify`, {});
      await fetchOrders(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify payment.');
    } finally {
      setVerifyingOrderId(null);
    }
  };

  // Ship order action
  const handleShipOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shippingOrderId) return;
    setShippingError('');

    if (courierName.trim() === '' || trackingNumber.trim() === '') {
      setShippingError('Both courier carrier and tracking ID are required.');
      return;
    }

    setIsShipping(true);
    try {
      await requestJson(`/api/orders/${encodeURIComponent(shippingOrderId)}/ship`, {
        courier_name: courierName,
        tracking_number: trackingNumber,
      });

      // Clear tracking form & modal
      setShippingOrderId(null);
      setCourierName('');
      setTrackingNumber('');
      
      // Refresh list
      await fetchOrders(true);
    } catch (err) {
      setShippingError(err instanceof Error ? err.message : 'Failed to ship order.');
    } finally {
      setIsShipping(false);
    }
  };

  const getStatusBadge = (status: Order['status']) => {
    const normalizedStatus = (status || '').toLowerCase();
    switch (normalizedStatus) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-semibold text-amber-800">
            <RefreshCw className="h-3 w-3 text-amber-600 animate-spin" style={{ animationDuration: '3s' }} />
            Pending Payment
          </span>
        );
      case 'awaiting_verification':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-semibold text-amber-800">
            <Landmark className="h-3 w-3 text-amber-600 animate-pulse" />
            Awaiting Verification
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-semibold text-emerald-800 font-semibold">
            <CheckCircle className="h-3 w-3 text-emerald-600" />
            Payment Verified
          </span>
        );
      case 'shipped':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-1 text-xs font-semibold text-blue-800">
            <Truck className="h-3 w-3 text-blue-600" />
            Shipped
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-semibold text-emerald-800">
            <CheckCircle className="h-3 w-3 text-emerald-600" />
            Completed
          </span>
        );
      case 'not_received':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-800 font-bold">
            <AlertTriangle className="h-3 w-3 text-red-600 animate-bounce" />
            Not Received
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-ink-50 border border-ink-200 px-2.5 py-1 text-xs font-semibold text-ink-800">
            {status}
          </span>
        );
    }
  };

  const filteredOrders = orders.filter((order) => {
    if (searchQuery === '') return true;
    const query = searchQuery.toLowerCase();
    return (
      order.reference.toLowerCase().includes(query) ||
      order.customer_name.toLowerCase().includes(query) ||
      order.customer_email.toLowerCase().includes(query) ||
      order.delivery_address.toLowerCase().includes(query) ||
      order.items.some((item) => item.title.toLowerCase().includes(query))
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-display text-lg font-bold text-ink-900 flex items-center gap-2">
          <ShoppingBag className="h-5 w-5 text-aura-600" />
          Active Customer Orders
        </h3>
        <button
          onClick={() => void fetchOrders()}
          className="flex h-9 items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3.5 text-xs font-semibold text-ink-700 hover:bg-ink-50 transition-colors shadow-sm"
        >
          <RefreshCw className="h-3.5 w-3.5 text-ink-500" />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="space-y-6 animate-pulse py-6">
          <div className="h-32 rounded-2xl bg-white border border-ink-100" />
          <div className="h-32 rounded-2xl bg-white border border-ink-100" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 flex gap-2 text-sm text-red-800 shadow-sm max-w-xl">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-200 bg-white py-16 px-6 text-center max-w-md mx-auto shadow-sm">
          <ShoppingBag className="mx-auto h-12 w-12 text-ink-300" />
          <h3 className="mt-4 text-sm font-bold text-ink-900">No customer orders found</h3>
          <p className="mt-2 text-xs text-ink-500">
            {searchQuery
              ? 'No orders matched your search keywords.'
              : 'When customers place orders for your building materials, they will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredOrders.map((order) => {
            const sellerSubtotal = order.items.reduce((acc, item) => acc + item.price * item.quantity, 0);
            const sellerShipping = 500.00;
            const sellerTotal = sellerSubtotal + sellerShipping;

            return (
              <div
                key={order.id}
                className="rounded-2xl border border-ink-200 bg-white shadow-sm overflow-hidden"
              >
                {/* Header panel */}
                <div className="bg-ink-50/70 border-b border-ink-150 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-ink-400 uppercase tracking-wider">Ref:</span>
                      <span className="font-display text-sm font-bold text-ink-900">{order.reference}</span>
                      {getStatusBadge(order.status)}
                    </div>
                    <p className="text-[10px] text-ink-400 font-semibold">
                      Ordered: {new Date(order.created_at).toLocaleString()}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-[10px] text-ink-400 font-semibold uppercase tracking-wider">Seller Shipment Total</p>
                    <p className="font-display text-base font-bold text-aura-600">
                      LKR {sellerTotal.toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Body Details */}
                <div className="p-5 grid gap-6 md:grid-cols-3">
                  
                  {/* Ordered items from this seller */}
                  <div className="space-y-3 md:col-span-2">
                    <h4 className="text-[10px] font-bold text-ink-400 uppercase tracking-wider border-b border-ink-100 pb-1.5">
                      Products Ordered
                    </h4>

                    <div className="divide-y divide-ink-100 space-y-2">
                      {order.items.map((item) => (
                        <div key={item.id} className="pt-2 first:pt-0 flex items-start justify-between gap-3 text-xs">
                          <div className="flex items-center gap-3">
                            {item.images && item.images.length > 0 ? (
                              <img
                                src={item.images[0]}
                                alt={item.title}
                                className="h-10 w-10 rounded-lg object-cover border border-ink-100 shrink-0"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-lg bg-ink-50 border border-ink-150 shrink-0" />
                            )}
                            <div>
                              <p className="font-bold text-ink-900">{item.title}</p>
                              <p className="text-[10px] text-ink-400 font-semibold mt-0.5">
                                LKR {item.price.toLocaleString()} x {item.quantity} {item.unit_type}
                              </p>
                            </div>
                          </div>
                          <span className="font-bold text-ink-900 shrink-0 mt-0.5">
                            LKR {(item.price * item.quantity).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                    
                    {/* Invoice math summary */}
                    <div className="bg-ink-50/40 rounded-xl p-3 border border-ink-100 text-xs mt-3 flex justify-between gap-4 text-ink-600 font-medium">
                      <span>Items: LKR {sellerSubtotal.toLocaleString()}</span>
                      <span>Shipping: LKR {sellerShipping.toLocaleString()}</span>
                      <span className="font-bold text-ink-900">Total: LKR {sellerTotal.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Customer shipping details, slip, and status updates */}
                  <div className="space-y-4 rounded-xl bg-ink-50/50 p-4 border border-ink-100/80 text-xs">
                    <div>
                      <span className="font-bold text-ink-400 uppercase tracking-wider text-[9px]">Buyer Details</span>
                      <p className="font-bold text-ink-900 mt-1">{order.customer_name}</p>
                      <p className="text-ink-500 text-[10px] mt-0.5">{order.customer_email}</p>
                      <p className="font-medium text-ink-700 mt-2 whitespace-pre-line leading-relaxed">
                        {order.delivery_address}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-ink-100">
                      <span className="font-bold text-ink-400 uppercase tracking-wider text-[9px] block">PayHere Payment ID</span>
                      {order.bank_receipt_url ? (
                        <span className="font-mono text-xs font-bold text-ink-950 block mt-1 select-all">
                          {order.bank_receipt_url}
                        </span>
                      ) : (
                        <span className="text-ink-500 italic block mt-1">Pending Webhook Call...</span>
                      )}
                    </div>

                    <div className="pt-3 border-t border-ink-100 space-y-2">
                      <span className="font-bold text-ink-400 uppercase tracking-wider text-[9px] block">Shipping & Courier Tracking</span>
                      
                      {/* State 1: Awaiting payment verification */}
                      {order.status === 'awaiting_verification' && (
                        <div className="space-y-2">
                          <p className="text-ink-500 italic">Verify funds have cleared in bank account first.</p>
                          <button
                            onClick={() => void handleVerifyPayment(order.id)}
                            disabled={verifyingOrderId === order.id}
                            className="w-full flex h-8 items-center justify-center gap-1 rounded-lg bg-ink-900 hover:bg-ink-800 disabled:opacity-50 text-[10px] font-bold text-white shadow transition-all active:scale-95"
                          >
                            <Landmark className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                            {verifyingOrderId === order.id ? 'Verifying...' : 'Verify Payment Receipt'}
                          </button>
                        </div>
                      )}

                      {/* State 2: Processing (verify payment completed) */}
                      {order.status === 'processing' && (
                        <div>
                          {shippingOrderId === order.id ? (
                            <form onSubmit={handleShipOrderSubmit} className="space-y-2 p-2.5 rounded-lg bg-white border border-ink-200">
                              <div>
                                <label className="text-[8px] font-bold text-ink-400 uppercase">Carrier/Courier Partner</label>
                                <input
                                  type="text"
                                  value={courierName}
                                  onChange={(e) => setCourierName(e.target.value)}
                                  placeholder="e.g. Pronto Courier / local transport"
                                  className="w-full h-8 px-2 rounded border border-ink-200 text-xs placeholder-ink-400 focus:outline-none focus:ring-1 focus:ring-ink-900 mt-0.5"
                                  required
                                />
                              </div>
                              
                              <div>
                                <label className="text-[8px] font-bold text-ink-400 uppercase">Tracking Number / Note</label>
                                <input
                                  type="text"
                                  value={trackingNumber}
                                  onChange={(e) => setTrackingNumber(e.target.value)}
                                  placeholder="e.g. Tracking #1234 / Driver #077123"
                                  className="w-full h-8 px-2 rounded border border-ink-200 text-xs placeholder-ink-400 focus:outline-none focus:ring-1 focus:ring-ink-900 mt-0.5"
                                  required
                                />
                              </div>

                              {shippingError && <p className="text-[10px] text-red-600">{shippingError}</p>}
                              
                              <div className="flex gap-2 pt-1">
                                <button
                                  type="submit"
                                  disabled={isShipping}
                                  className="flex-1 h-7 bg-ink-900 hover:bg-ink-800 disabled:opacity-50 text-[10px] font-bold text-white rounded shadow transition-all active:scale-95"
                                >
                                  {isShipping ? 'Saving...' : 'Confirm Dispatch'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShippingOrderId(null);
                                    setCourierName('');
                                    setTrackingNumber('');
                                    setShippingError('');
                                  }}
                                  className="h-7 px-3 bg-white border border-ink-200 text-ink-600 hover:bg-ink-100 text-[10px] font-bold rounded"
                                >
                                  Cancel
                                </button>
                              </div>
                            </form>
                          ) : (
                            <button
                              onClick={() => setShippingOrderId(order.id)}
                              className="w-full flex h-8 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-aura-500 to-aura-600 hover:from-aura-600 hover:to-aura-700 text-[10px] font-bold text-white shadow-sm transition-all hover:scale-[1.02] active:scale-95"
                            >
                              <Truck className="h-3.5 w-3.5" />
                              Place Order
                            </button>
                          )}
                        </div>
                      )}

                      {/* State 3: Shipped */}
                      {order.status === 'shipped' && (
                        <div className="p-2.5 rounded-lg bg-white border border-ink-150 space-y-1">
                          <span className="text-[9px] text-ink-400 font-semibold uppercase block">Carrier Logistics</span>
                          <p className="font-bold text-ink-900">{order.courier_name}</p>
                          <p className="font-mono text-[11px] font-semibold text-ink-600 mt-0.5">ID: {order.tracking_number}</p>
                          <span className="text-[9px] text-ink-400 italic block mt-1">Awaiting buyer receipt confirmation.</span>
                        </div>
                      )}

                      {/* State 4: Completed */}
                      {order.status === 'completed' && (
                        <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center gap-1.5 text-emerald-800 font-semibold leading-relaxed">
                          <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
                          <span>Delivery successfully completed & confirmed.</span>
                        </div>
                      )}

                      {/* State 5: Dispute not received */}
                      {order.status === 'not_received' && (
                        <div className="p-2.5 rounded-lg bg-red-50 border border-red-150 text-red-800 flex flex-col gap-1.5 font-semibold">
                          <div className="flex items-center gap-1.5">
                            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
                            <span>Dispute: Flagged as Not Received!</span>
                          </div>
                          <p className="text-[10px] text-red-700 font-medium leading-relaxed">
                            Please verify with your courier/driver ({order.courier_name} - {order.tracking_number}) and contact the customer immediately.
                          </p>
                        </div>
                      )}
                    </div>

                  </div>

                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
