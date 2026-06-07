import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { HeaderBar } from '../../components/HeaderBar';
import { requestJson, requestForm } from '../../lib/api';
import { getCart, clearCart } from '../../lib/cartStore';
import type { User, ProductListing } from '../../types/session';
import { Upload, HelpCircle, Landmark, ShieldCheck, AlertCircle, FileText, CheckCircle } from 'lucide-react';

type CheckoutItem = {
  product: ProductListing;
  quantity: number;
};

export function CheckoutPage({
  user,
  onLogout,
}: {
  user: User | null;
  onLogout: () => Promise<void>;
}) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Redirect if not signed in
  useEffect(() => {
    if (!user) {
      navigate('/auth?redirect=checkout');
    }
  }, [user, navigate]);

  // Checkout Items State
  const [checkoutItems, setCheckoutItems] = useState<CheckoutItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [itemsError, setItemsError] = useState('');

  // Form States
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryDistrict, setDeliveryDistrict] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  
  // Submission States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Unique Order Reference Code (generated once on mount)
  const [referenceCode] = useState(() => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '#NES-';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  });

  // Resolve Checkout Mode (Buy Now query vs. Cart items)
  useEffect(() => {
    const buyNowId = searchParams.get('buyNow');
    const buyNowQty = parseInt(searchParams.get('qty') ?? '1', 10);

    async function loadCheckoutData() {
      setLoadingItems(true);
      setItemsError('');

      if (buyNowId) {
        // Buy Now Mode: Fetch single product listing from API
        try {
          const res = (await requestJson<unknown>(`/api/product-listings/${buyNowId}`)) as {
            listing: ProductListing;
          };
          if (res.listing) {
            setCheckoutItems([{ product: res.listing, quantity: buyNowQty }]);
          } else {
            setItemsError('Product listing not found.');
          }
        } catch (err) {
          setItemsError(err instanceof Error ? err.message : 'Failed to retrieve product details.');
        } finally {
          setLoadingItems(false);
        }
      } else {
        // Cart Mode: Load stacked items from local storage
        const cart = getCart();
        setCheckoutItems(cart);
        setLoadingItems(false);
      }
    }

    void loadCheckoutData();
  }, [searchParams]);

  // Calculations
  const uniqueSellers = Array.from(new Set(checkoutItems.map((item) => item.product.user_id)));
  const numSellers = uniqueSellers.length;
  const itemsSubtotal = checkoutItems.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  const shippingFee = checkoutItems.reduce((acc, item) => acc + (item.product.shipping_fee ?? 0), 0);
  const grandTotal = itemsSubtotal + shippingFee;

  // Calculate allowable districts: intersection of shipping districts of all items
  const allowedDistricts = checkoutItems.length > 0
    ? checkoutItems.reduce<string[]>((acc, item) => {
        const itemDistricts = item.product.shipping_districts || [];
        if (acc.length === 0) return itemDistricts;
        return acc.filter((d) => itemDistricts.includes(d));
      }, [])
    : [];

  // File Upload Handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReceiptFile(file);
      setSubmitError('');

      // Preview (only if image)
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setReceiptPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setReceiptPreview(null);
      }
    }
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (!deliveryDistrict) {
      setSubmitError('Please select a delivery district.');
      return;
    }

    if (deliveryAddress.trim() === '') {
      setSubmitError('Please enter a delivery address.');
      return;
    }

    if (!receiptFile) {
      setSubmitError('Please transfer the payment and upload your receipt confirmation.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Map checkout items list
      const itemsList = checkoutItems.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
      }));

      const form = new FormData();
      form.append('delivery_address', `${deliveryDistrict}, ${deliveryAddress}`);
      form.append('items', JSON.stringify(itemsList));
      form.append('receipt', receiptFile);

      const res = await requestForm('/api/orders', form);

      // If checkout was via cart, clear it
      const buyNowId = searchParams.get('buyNow');
      if (!buyNowId) {
        clearCart();
      }

      // Redirect to Order History with success message
      navigate('/orders', { state: { notice: res.message ?? 'Order placed successfully!' } });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'An error occurred during order submission.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 md:px-8 lg:px-10 pb-24">
      <HeaderBar user={user} onLogout={onLogout} />

      {/* Back Button */}
      <div className="mb-6 mt-4">
        <Link
          to={searchParams.get('buyNow') ? `/products/${searchParams.get('buyNow')}` : '/cart'}
          className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white/80 px-4 py-2 text-xs font-semibold text-ink-700 hover:text-ink-950 hover:bg-ink-50 shadow-sm backdrop-blur transition-all"
        >
          &larr; Return to {searchParams.get('buyNow') ? 'Product Details' : 'Shopping Cart'}
        </Link>
      </div>

      <div className="rounded-3xl border border-white/70 bg-white/80 p-6 md:p-8 shadow-sm backdrop-blur space-y-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-aura-600">Manual Payment Fulfillment</p>
          <h1 className="mt-1 font-display text-3xl font-bold text-ink-900 md:text-4xl">Order Checkout</h1>
          <p className="mt-1 text-sm text-ink-600">
            Submit your shipping details, transfer the total payment, and upload your receipt below to finalize.
          </p>
        </div>

        {loadingItems ? (
          <div className="flex justify-center py-20 animate-pulse">
            <span className="text-sm text-ink-500 font-medium">Retrieving order details...</span>
          </div>
        ) : itemsError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center max-w-md mx-auto">
            <AlertCircle className="h-10 w-10 text-red-600 mx-auto" />
            <h4 className="mt-3 text-sm font-bold text-red-950">Unable to load checkout</h4>
            <p className="mt-1 text-xs text-red-700">{itemsError}</p>
            <Link to="/" className="mt-6 inline-flex rounded-full bg-ink-900 px-5 py-2 text-xs font-semibold text-white hover:bg-ink-800">
              Return Home
            </Link>
          </div>
        ) : checkoutItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink-200 bg-ink-50/30 py-16 px-6 text-center max-w-md mx-auto">
            <HelpCircle className="mx-auto h-12 w-12 text-ink-300" />
            <h3 className="mt-4 text-base font-bold text-ink-900">No items to check out</h3>
            <p className="mt-2 text-xs text-ink-500">Add products to your cart from the marketplace first.</p>
            <Link to="/" className="mt-6 inline-flex rounded-full bg-ink-900 px-5 py-2 text-xs font-semibold text-white hover:bg-ink-800">
              Go to Marketplace
            </Link>
          </div>
        ) : (
          <form onSubmit={handlePlaceOrder} className="grid gap-8 lg:grid-cols-3">
            
            {/* Left Columns: Step 1 Address & Step 3 Receipt */}
            <div className="space-y-6 lg:col-span-2">
              
              {/* Step 1: Delivery Address */}
              <div className="rounded-2xl border border-ink-150 bg-white p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2.5 pb-3 border-b border-ink-100">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink-900 text-[10px] font-bold text-white">
                    1
                  </span>
                  <h3 className="font-display text-base font-bold text-ink-900">Delivery Address</h3>
                </div>

                <div className="space-y-2">
                  <label htmlFor="delivery-district" className="text-xs font-bold text-ink-600 uppercase tracking-wider block">
                    Delivery District
                  </label>
                  <select
                    id="delivery-district"
                    value={deliveryDistrict}
                    onChange={(e) => setDeliveryDistrict(e.target.value)}
                    className="flex h-11 w-full rounded-2xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-ink-950"
                    required
                  >
                    <option value="">Select a district...</option>
                    {allowedDistricts.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                  
                  {allowedDistricts.length > 0 ? (
                    <div className="mt-2 text-xs text-ink-600">
                      <span className="font-semibold text-aura-600 block mb-1">
                        This product can be shipped to the following districts. Other districts are not selectable:
                      </span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {allowedDistricts.map((d) => (
                          <span key={d} className="inline-block bg-ink-100 px-2 py-0.5 rounded text-[11px] font-medium text-ink-700">
                            {d}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-red-500 font-semibold mt-2">
                      Warning: No overlapping shipping districts found for these products. They cannot be shipped to the same destination.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label htmlFor="address" className="text-xs font-bold text-ink-600 uppercase tracking-wider block">
                    Shipping Destination Details (Street, City, Contact Info)
                  </label>
                  <textarea
                    id="address"
                    rows={4}
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Enter full name, contact number, street address, and city..."
                    className="w-full rounded-xl border border-ink-200 p-3.5 text-sm text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-ink-900/10 shadow-inner resize-none min-h-[100px]"
                    required
                  />
                  <p className="text-[10px] text-ink-400">
                    Provide exact delivery address details. Sellers will arrange dispatch based on this destination.
                  </p>
                </div>
              </div>

              {/* Step 2: Payment Instructions */}
              <div className="rounded-2xl border border-ink-150 bg-white p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2.5 pb-3 border-b border-ink-100">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink-900 text-[10px] font-bold text-white">
                    2
                  </span>
                  <h3 className="font-display text-base font-bold text-ink-900">Bank Transfer Payment Instructions</h3>
                </div>

                <div className="rounded-2xl bg-amber-50/50 border border-amber-100 p-5 space-y-4">
                  <div className="flex items-center gap-3 text-amber-800">
                    <Landmark className="h-6 w-6 shrink-0 text-amber-600" />
                    <div>
                      <h4 className="text-sm font-bold">Manual Bank Slip Upload Model</h4>
                      <p className="text-[11px] text-amber-700 font-medium">
                        Transfer the exact amount to the bank account below. Ensure your reference matches exactly.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 rounded-xl bg-white p-4 border border-amber-100/70 text-xs shadow-sm sm:grid-cols-2">
                    <div className="space-y-1">
                      <span className="font-semibold text-ink-400 uppercase tracking-wider text-[9px]">Bank Name</span>
                      <p className="font-bold text-ink-900">Commercial Bank / Bank of Ceylon</p>
                    </div>
                    <div className="space-y-1">
                      <span className="font-semibold text-ink-400 uppercase tracking-wider text-[9px]">Account Name</span>
                      <p className="font-bold text-ink-900">Nestora Marketplace</p>
                    </div>
                    <div className="space-y-1">
                      <span className="font-semibold text-ink-400 uppercase tracking-wider text-[9px]">Account Number</span>
                      <p className="font-bold text-ink-900">1000 2847 1922</p>
                    </div>
                    <div className="space-y-1">
                      <span className="font-semibold text-ink-400 uppercase tracking-wider text-[9px]">Branch Name</span>
                      <p className="font-bold text-ink-900">Colombo Fort Branch</p>
                    </div>
                  </div>

                  <div className="rounded-xl bg-ink-900 text-white p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-inner">
                    <div>
                      <span className="text-[9px] font-semibold text-aura-400 uppercase tracking-wider">Transfer Reference Code</span>
                      <p className="font-display text-lg font-bold tracking-wide mt-0.5">{referenceCode}</p>
                    </div>
                    <div className="text-[10px] text-ink-300 max-w-xs leading-relaxed font-medium">
                      Important: Paste this reference code into your bank app's transfer remarks section so we can match your transfer.
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 3: Receipt Upload */}
              <div className="rounded-2xl border border-ink-150 bg-white p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2.5 pb-3 border-b border-ink-100">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink-900 text-[10px] font-bold text-white">
                    3
                  </span>
                  <h3 className="font-display text-base font-bold text-ink-900">Upload Transfer Slip / Receipt</h3>
                </div>

                <div className="space-y-3">
                  <p className="text-xs text-ink-600">
                    Please upload a clear screenshot of your transaction confirmation or photo of your physical deposit slip (PNG, JPG, JPEG, or PDF):
                  </p>
                  
                  <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-ink-200 hover:border-aura-500 bg-ink-50/50 p-6 text-center cursor-pointer transition-colors relative group min-h-[160px]">
                    <input
                      type="file"
                      id="receipt"
                      accept="image/*,.pdf"
                      onChange={handleFileChange}
                      className="absolute inset-0 opacity-0 cursor-pointer z-10"
                      required
                    />
                    
                    {receiptFile ? (
                      <div className="space-y-2 z-20">
                        {receiptPreview ? (
                          <img
                            src={receiptPreview}
                            alt="Receipt Preview"
                            className="mx-auto h-24 max-w-[200px] object-contain rounded-xl border border-ink-200 shadow-sm"
                          />
                        ) : (
                          <FileText className="mx-auto h-12 w-12 text-aura-500" />
                        )}
                        <p className="text-xs font-bold text-ink-800 truncate max-w-[300px]">
                          {receiptFile.name}
                        </p>
                        <p className="text-[10px] text-ink-400 font-semibold">
                          {(receiptFile.size / 1024 / 1024).toFixed(2)} MB • Click to replace file
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1.5 text-ink-600">
                        <Upload className="mx-auto h-10 w-10 text-ink-400 group-hover:text-aura-600 transition-colors" />
                        <p className="text-xs font-bold text-ink-700">Click or drag receipt file here</p>
                        <p className="text-[10px] text-ink-400">Supports JPEG, PNG, or PDF up to 10MB</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>

            {/* Right Sidebar: Checkout Summary & Submit */}
            <div className="space-y-6 self-start">
              
              {/* Order Review List */}
              <div className="rounded-2xl border border-ink-150 bg-white p-5 shadow-sm space-y-4">
                <h3 className="font-display text-sm font-bold text-ink-900 border-b border-ink-100 pb-2.5">
                  Order Items Review
                </h3>

                <div className="divide-y divide-ink-100 max-h-60 overflow-y-auto pr-1">
                  {checkoutItems.map((item) => (
                    <div key={item.product.id} className="py-3 flex items-start justify-between gap-3 text-xs">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-ink-900 truncate">{item.product.title}</p>
                        <p className="text-[10px] text-ink-400 font-semibold mt-0.5">
                          LKR {item.product.price.toLocaleString()} x {item.quantity} {item.product.unit_type}
                        </p>
                        <p className="text-[9px] text-ink-400 italic">
                          Seller: {item.product.business_name || item.product.seller_name}
                        </p>
                      </div>
                      <span className="font-bold text-ink-900 shrink-0">
                        LKR {(item.product.price * item.quantity).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-ink-100 pt-3 space-y-2">
                  <div className="flex justify-between text-xs text-ink-500">
                    <span>Subtotal:</span>
                    <span className="font-semibold text-ink-800">LKR {itemsSubtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs text-ink-500">
                    <span className="flex flex-col">
                      <span>Shipping Fee:</span>
                      <span className="text-[9px] text-ink-400 italic">Sum of merchant shipping fees</span>
                    </span>
                    <span className="font-semibold text-ink-800">LKR {shippingFee.toLocaleString()}</span>
                  </div>
                  
                  <hr className="border-ink-100 my-2" />
                  
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-ink-900">Total Commitment:</span>
                    <span className="font-display text-base font-bold text-aura-600">
                      LKR {grandTotal.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Safety notice */}
              <div className="flex gap-2.5 rounded-xl bg-ink-50 p-4 text-[10px] text-ink-600 leading-relaxed border border-ink-150">
                <ShieldCheck className="h-5 w-5 text-aura-600 shrink-0 animate-pulse" />
                <span>
                  By placing the order, you commit to purchase. Sellers will verify this receipt before dispatching. Fraudulent slips will cause permanent user ban.
                </span>
              </div>

              {/* Error messages */}
              {submitError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 flex gap-2 text-xs text-red-800 leading-relaxed">
                  <AlertCircle className="h-4.5 w-4.5 shrink-0 text-red-600" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Place Order Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-aura-500 to-aura-600 hover:from-aura-600 hover:to-aura-700 disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed font-semibold text-sm text-white shadow-md transition-all hover:scale-[1.02] active:scale-95"
              >
                {isSubmitting ? (
                  <>
                    <div className="h-4.5 w-4.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Submitting Receipt...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4.5 w-4.5" />
                    Confirm & Place Order
                  </>
                )}
              </button>
            </div>

          </form>
        )}
      </div>
    </main>
  );
}
