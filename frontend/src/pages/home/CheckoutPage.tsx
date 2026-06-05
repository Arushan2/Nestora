import { useEffect, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { MapPin, Landmark, UploadCloud, FileText, CheckCircle2, ArrowRight, ArrowLeft, Plus, Minus } from 'lucide-react';
import { HeaderBar } from '../../components/HeaderBar';
import { requestJson, requestForm } from '../../lib/api';
import type { User, CartItem, ProductListing } from '../../types/session';
import districts from '../../lib/districts.json';

interface CheckoutItem {
  product_id: number;
  quantity: number;
  title: string;
  price: number;
  unit_type: string;
  images: string[];
  seller_id: number;
  seller_business_name: string | null;
  shipping_districts: string[];
  shipping_fee: number;
}

export function CheckoutPage({
  user,
  onLogout,
}: {
  user: User | null;
  onLogout: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const location = useLocation();

  // Parse Query Parameters (Buy Now)
  const queryParams = new URLSearchParams(location.search);
  const buyNowProductId = queryParams.get('buyNow');
  const buyNowQty = parseInt(queryParams.get('qty') ?? '1', 10);

  // States
  const [items, setItems] = useState<CheckoutItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(1); // 1: Address & Review, 2: Payment, 3: Receipt Upload

  // Form Fields
  const [streetAddress, setStreetAddress] = useState('');
  const [city, setCity] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  // Generated Master Reference for Bank Transfer
  const [referenceCode] = useState(() => {
    const random = Math.floor(1000 + Math.random() * 9000);
    return `NES-${random}`;
  });

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    async function loadCheckoutData() {
      setLoading(true);
      try {
        if (buyNowProductId) {
          // Direct Buy Now flow - fetch single product listing
          const response = (await requestJson(`/api/product-listings/${buyNowProductId}`)) as any;
          if (response.listing) {
            const list = response.listing;
            setItems([
              {
                product_id: list.id,
                quantity: buyNowQty,
                title: list.title,
                price: list.price,
                unit_type: list.unit_type,
                images: list.images,
                seller_id: list.user_id,
                seller_business_name: list.business_name ?? null,
                shipping_districts: list.shipping_districts ?? [],
                shipping_fee: list.shipping_fee ?? 0
              }
            ]);
          }
        } else {
          // Normal Cart checkout flow
          const response = (await requestJson('/api/cart')) as any;
          if (response.items && response.items.length > 0) {
            setItems(
              response.items.map((item: any) => ({
                product_id: item.product_id,
                quantity: item.quantity,
                title: item.title,
                price: item.price,
                unit_type: item.unit_type,
                images: item.images,
                seller_id: item.seller_id,
                seller_business_name: item.seller_business_name,
                shipping_districts: item.shipping_districts ?? [],
                shipping_fee: item.shipping_fee ?? 0
              }))
            );
          } else {
            alert('Your cart is empty.');
            navigate('/cart');
          }
        }
      } catch (err) {
        console.error('Failed to load checkout details:', err);
      } finally {
        setLoading(false);
      }
    }

    void loadCheckoutData();
  }, [user, buyNowProductId, buyNowQty]);

  // Unique Sellers count
  const uniqueSellersCount = new Set(items.map(item => item.seller_id)).size;

  // Determine shipping districts that can fulfill ALL products in this checkout
  const availableDistricts = districts.filter(d => {
    if (items.length === 0) return true;
    return items.every(item => {
      return item.shipping_districts?.some(sd => sd.toLowerCase() === d.toLowerCase());
    });
  });

  // Calculate Shipping Fee per seller: Use max custom shipping fee from seller's items in checkout.
  // If no custom fee is set (all 0), fall back to province-based default: Colombo, Gampaha, Kalutara = 350, others = 550.
  const getShippingFeeForSeller = (sellerId: number) => {
    if (!selectedDistrict) return 0;
    const sellerItems = items.filter(item => item.seller_id === sellerId);
    const customFees = sellerItems.map(item => Number(item.shipping_fee || 0));
    const maxCustomFee = Math.max(...customFees, 0);
    if (maxCustomFee > 0) {
      return maxCustomFee;
    }
    const westernProvince = ['colombo', 'gampaha', 'kalutara'];
    return westernProvince.includes(selectedDistrict.toLowerCase()) ? 350.00 : 550.00;
  };

  const totalShippingFee = Array.from(new Set(items.map(item => item.seller_id)))
    .reduce((sum, sellerId) => sum + getShippingFeeForSeller(sellerId), 0);
  const itemsTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const grandTotal = itemsTotal + totalShippingFee;

  const handleNextStep = () => {
    if (step === 1) {
      if (!streetAddress.trim() || !city.trim() || !selectedDistrict || !postalCode.trim()) {
        alert('Please complete all fields in the delivery address form.');
        return;
      }
    }
    setStep(prev => prev + 1);
  };

  const handlePrevStep = () => {
    setStep(prev => prev - 1);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setReceiptFile(e.target.files[0]);
    }
  };

  const handleUpdateItemQuantity = (productId: number, newQty: number) => {
    if (newQty < 1) return;
    setItems(prev => prev.map(item => {
      if (item.product_id === productId) {
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const handleSubmitOrder = async () => {
    if (!receiptFile) {
      alert('Please upload your bank transfer payment receipt.');
      return;
    }

    setSubmitting(true);
    try {
      const fullAddress = `${streetAddress}, ${city}, ${postalCode}`;
      const formData = new FormData();
      formData.append('delivery_address', fullAddress);
      formData.append('district', selectedDistrict);
      formData.append('receipt', receiptFile);
      
      const orderItemsPayload = items.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity
      }));
      formData.append('items', JSON.stringify(orderItemsPayload));

      // Append reference code as verification metadata if needed
      formData.append('reference_code', referenceCode);

      const response = await requestForm('/api/orders', formData);
      alert(response.message ?? 'Order placed successfully!');
      window.dispatchEvent(new Event('cart-updated')); // refresh cart count
      navigate('/my-orders');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to submit order.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 md:px-8 lg:px-10">
        <HeaderBar user={user} onLogout={onLogout} />
        <div className="flex justify-center py-32">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-ink-200 border-t-ink-900" />
            <p className="font-display text-sm font-medium text-ink-600">Preparing checkout page...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 md:px-8 lg:px-10">
      <HeaderBar user={user} onLogout={onLogout} />

      {/* Progress Indicator */}
      <div className="max-w-4xl mx-auto my-8">
        <div className="relative flex items-center justify-between">
          {/* Progress Line */}
          <div className="absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2 bg-ink-200 -z-10" />
          <div
            className="absolute left-0 top-1/2 h-0.5 -translate-y-1/2 bg-aura-600 transition-all duration-300 -z-10"
            style={{ width: `${((step - 1) / 2) * 100}%` }}
          />

          {/* Steps */}
          {[
            { num: 1, label: 'Delivery Address', icon: MapPin },
            { num: 2, label: 'Bank Details', icon: Landmark },
            { num: 3, label: 'Receipt Confirmation', icon: UploadCloud },
          ].map((s) => {
            const StepIcon = s.icon;
            const isCompleted = step > s.num;
            const isActive = step === s.num;

            return (
              <div key={s.num} className="flex flex-col items-center gap-2">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full border transition-all duration-300 ${
                    isCompleted
                      ? 'border-emerald-500 bg-emerald-500 text-white shadow-md'
                      : isActive
                      ? 'border-aura-600 bg-aura-600 text-white ring-4 ring-aura-100 shadow-md'
                      : 'border-ink-200 bg-white text-ink-400'
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : <StepIcon className="h-5 w-5" />}
                </div>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider transition-colors duration-300 ${
                    isActive ? 'text-aura-600' : isCompleted ? 'text-emerald-600' : 'text-ink-400'
                  }`}
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main Step Containers */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* STEP 1: Address Coordinates */}
          {step === 1 && (
            <div className="rounded-3xl border border-white/70 bg-white/80 p-6 md:p-8 shadow-sm backdrop-blur space-y-6 animate-in fade-in duration-300">
              <h2 className="font-display text-xl font-bold text-ink-900 flex items-center gap-2">
                <MapPin className="h-5.5 w-5.5 text-aura-600" />
                Step 1: Delivery Address & Order Review
              </h2>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-ink-700 uppercase tracking-wider">Street Address</label>
                  <input
                    type="text"
                    required
                    placeholder="No. 123, Galle Road"
                    value={streetAddress}
                    onChange={(e) => setStreetAddress(e.target.value)}
                    className="mt-1.5 h-11 w-full rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-900 placeholder-ink-400 outline-none transition-all focus:border-ink-400 focus:ring-2 focus:ring-ink-900/10"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-ink-700 uppercase tracking-wider">City</label>
                  <input
                    type="text"
                    required
                    placeholder="Colombo 03"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="mt-1.5 h-11 w-full rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-900 placeholder-ink-400 outline-none transition-all focus:border-ink-400 focus:ring-2 focus:ring-ink-900/10"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-ink-700 uppercase tracking-wider">Postal Code</label>
                  <input
                    type="text"
                    required
                    placeholder="00300"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    className="mt-1.5 h-11 w-full rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-900 placeholder-ink-400 outline-none transition-all focus:border-ink-400 focus:ring-2 focus:ring-ink-900/10"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-ink-700 uppercase tracking-wider">District</label>
                  <select
                    required
                    value={selectedDistrict}
                    onChange={(e) => setSelectedDistrict(e.target.value)}
                    className="mt-1.5 h-11 w-full rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-900 outline-none transition-all focus:border-ink-400 focus:ring-2 focus:ring-ink-900/10"
                  >
                    <option value="">-- Select District --</option>
                    {availableDistricts.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-ink-100">
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="inline-flex items-center gap-2 rounded-2xl bg-ink-900 px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-ink-800 shadow-md"
                >
                  Continue to Payment Details
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Payment Instructions & Bank Details */}
          {step === 2 && (
            <div className="rounded-3xl border border-white/70 bg-white/80 p-6 md:p-8 shadow-sm backdrop-blur space-y-6 animate-in fade-in duration-300">
              <h2 className="font-display text-xl font-bold text-ink-900 flex items-center gap-2">
                <Landmark className="h-5.5 w-5.5 text-aura-600" />
                Step 2: Bank Transfer Payment Instructions
              </h2>

              <div className="rounded-2xl border border-aura-100 bg-gradient-to-br from-white to-aura-50/20 p-5 space-y-4 shadow-inner">
                <div className="flex items-center gap-2.5 pb-3 border-b border-aura-100">
                  <Landmark className="h-5 w-5 text-aura-600" />
                  <span className="font-display text-sm font-bold text-aura-900">Platform Banking Details</span>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 text-sm leading-relaxed">
                  <div>
                    <span className="text-[10px] text-ink-400 font-bold uppercase tracking-wider block">Bank Name</span>
                    <span className="font-semibold text-ink-900">Commercial Bank of Ceylon</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-ink-400 font-bold uppercase tracking-wider block">Branch</span>
                    <span className="font-semibold text-ink-900">Colombo Fort Branch</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-ink-400 font-bold uppercase tracking-wider block">Account Name</span>
                    <span className="font-semibold text-ink-900">Nestora Marketplace</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-ink-400 font-bold uppercase tracking-wider block">Account Number</span>
                    <span className="font-mono font-bold text-ink-950">1000876543</span>
                  </div>
                  <div className="sm:col-span-2 bg-ink-900/5 p-3.5 rounded-xl border border-ink-200">
                    <span className="text-[10px] text-aura-700 font-bold uppercase tracking-wider block">Unique Transfer Reference Code</span>
                    <span className="font-mono text-base font-bold text-aura-950 block mt-0.5">{referenceCode}</span>
                    <p className="text-[10px] text-ink-500 mt-1">
                      * IMPORTANT: Please specify this code exactly in your bank transfer description/reference field so we can map your slip instantly.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50/50 border border-amber-200 p-4 rounded-2xl text-xs text-amber-900 leading-relaxed">
                <span className="font-bold block mb-0.5">Payment Commitment Notice:</span>
                Please transfer the total amount of <span className="font-bold">LKR {grandTotal.toLocaleString()}</span> to the bank account listed above. Once done, make sure to save the transaction receipt (screenshot or PDF) to upload in the next step to confirm your purchase commitment.
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-ink-100">
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="inline-flex items-center gap-1.5 rounded-2xl border border-ink-200 bg-white px-5 py-3 text-sm font-semibold text-ink-700 hover:bg-ink-50 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Address details
                </button>
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="inline-flex items-center gap-2 rounded-2xl bg-ink-900 px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-ink-800 shadow-md"
                >
                  Proceed to Upload Receipt
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Receipt Upload */}
          {step === 3 && (
            <div className="rounded-3xl border border-white/70 bg-white/80 p-6 md:p-8 shadow-sm backdrop-blur space-y-6 animate-in fade-in duration-300">
              <h2 className="font-display text-xl font-bold text-ink-900 flex items-center gap-2">
                <UploadCloud className="h-5.5 w-5.5 text-aura-600" />
                Step 3: Upload Bank Receipt Confirmation
              </h2>

              <div className="space-y-4">
                <label className="text-xs font-bold text-ink-700 uppercase tracking-wider block">Bank Slip / Transaction Receipt</label>
                
                <div className="relative border-2 border-dashed border-ink-200 rounded-3xl p-8 bg-white/40 hover:bg-white/60 hover:border-aura-400 transition-all flex flex-col items-center justify-center text-center cursor-pointer group">
                  <input
                    type="file"
                    required
                    accept="image/*,application/pdf"
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <div className="rounded-full bg-aura-100 p-4 text-aura-600 group-hover:scale-110 transition-transform shadow-sm">
                    <UploadCloud className="h-7 w-7" />
                  </div>
                  <p className="mt-3.5 text-sm font-bold text-ink-900">
                    {receiptFile ? receiptFile.name : 'Select or drag your receipt file here'}
                  </p>
                  <p className="mt-1 text-xs text-ink-400">
                    Supports JPG, PNG, WEBP, or PDF file types (max 10MB)
                  </p>

                  {receiptFile && (
                    <div className="mt-4 flex items-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-100 px-4 py-2 rounded-xl text-xs font-semibold">
                      <FileText className="h-4 w-4" />
                      <span>Ready to upload: {(receiptFile.size / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-ink-100">
                <button
                  type="button"
                  onClick={handlePrevStep}
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 rounded-2xl border border-ink-200 bg-white px-5 py-3 text-sm font-semibold text-ink-700 hover:bg-ink-50 disabled:opacity-50 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Payment instructions
                </button>
                <button
                  type="button"
                  onClick={handleSubmitOrder}
                  disabled={!receiptFile || submitting}
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-7 py-3.5 text-sm font-semibold text-white transition-all hover:shadow-lg hover:shadow-emerald-600/20 disabled:opacity-50 shadow-md hover:scale-[1.01]"
                >
                  {submitting ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Submitting Order...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4.5 w-4.5 text-emerald-200" />
                      <span>Place Order Confirmation</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Order Items & Summary Column */}
        <div className="space-y-6">
          
          {/* Order Review List */}
          <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur space-y-4">
            <h3 className="font-display text-base font-bold text-ink-900 border-b border-ink-100 pb-3 flex items-center justify-between">
              <span>Order Items</span>
              <span className="text-xs bg-ink-100 px-2.5 py-1 rounded-full text-ink-600 font-semibold">{items.length} items</span>
            </h3>

            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
              {items.map((item, idx) => (
                <div key={idx} className="flex gap-3 text-sm border-b border-ink-50 pb-3 last:border-b-0 last:pb-0">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-ink-100 bg-ink-50">
                    {item.images && item.images.length > 0 ? (
                      <img src={item.images[0]} alt={item.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-ink-400">N/A</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate font-semibold text-ink-900">{item.title}</h4>
                    <p className="text-[10px] text-ink-400 mt-0.5">Merchant: {item.seller_business_name ?? 'Seller'}</p>
                    {step === 1 && (
                      <p className="text-[10px] text-ink-500 font-medium mt-0.5">LKR {Number(item.price).toLocaleString()} / {item.unit_type}</p>
                    )}
                    <div className="flex items-center justify-between mt-1.5">
                      {step === 1 ? (
                        <div className="flex items-center gap-1 rounded-full border border-ink-200 bg-white p-0.5 scale-90 origin-left">
                          <button
                            type="button"
                            onClick={() => handleUpdateItemQuantity(item.product_id, item.quantity - 1)}
                            disabled={item.quantity <= 1}
                            className="flex h-5 w-5 items-center justify-center rounded-full text-ink-500 transition-colors hover:bg-ink-100 disabled:opacity-30"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-8 text-center text-[10px] font-bold text-ink-900">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateItemQuantity(item.product_id, item.quantity + 1)}
                            className="flex h-5 w-5 items-center justify-center rounded-full text-ink-500 transition-colors hover:bg-ink-100"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                          <span className="text-[9px] text-ink-400 font-semibold pr-1.5">{item.unit_type}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-ink-600 font-semibold">
                          {item.quantity} {item.unit_type}(s) x LKR {Number(item.price).toLocaleString()}
                        </span>
                      )}
                      <span className="text-xs font-bold text-ink-900">LKR {(item.price * item.quantity).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing Calculations Details */}
          <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur space-y-4">
            <h3 className="font-display text-base font-bold text-ink-900 border-b border-ink-100 pb-3">
              Cost Calculation
            </h3>

            <div className="space-y-3.5 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-500 font-medium">Items Subtotal</span>
                <span className="text-ink-950 font-bold">LKR {itemsTotal.toLocaleString()}</span>
              </div>
              
              <div className="flex flex-col gap-1 border-t border-ink-100 pt-3.5">
                <div className="flex justify-between">
                  <span className="text-ink-500 font-medium">Fulfillment Shipments</span>
                  <span className="text-ink-950 font-bold">{uniqueSellersCount} {uniqueSellersCount === 1 ? 'merchant order' : 'merchant orders'}</span>
                </div>
                {selectedDistrict && Array.from(new Set(items.map(item => item.seller_id))).map((sellerId) => {
                  const sellerName = items.find(item => item.seller_id === sellerId)?.seller_business_name ?? 'Verified Seller';
                  const sellerFee = getShippingFeeForSeller(sellerId);
                  return (
                    <div key={sellerId} className="flex justify-between text-xs text-ink-500 mt-1">
                      <span>Shipping ({sellerName}):</span>
                      <span className="font-semibold">LKR {sellerFee.toLocaleString()}</span>
                    </div>
                  );
                })}
                {selectedDistrict && (
                  <div className="flex justify-between text-xs font-bold text-ink-900 mt-1 border-t border-ink-50 pt-1.5">
                    <span>Combined Shipping Fee:</span>
                    <span>LKR {totalShippingFee.toLocaleString()}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-between text-base font-bold border-t border-ink-100 pt-4">
                <span className="text-ink-900">Grand Total</span>
                <span className="text-lg text-aura-700 font-display">LKR {grandTotal.toLocaleString()}</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}
