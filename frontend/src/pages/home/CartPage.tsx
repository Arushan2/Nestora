import { HeaderBar } from '../../components/HeaderBar';
import { useCart, updateCartQuantity, removeFromCart } from '../../lib/cartStore';
import type { User } from '../../types/session';
import { ShoppingCart, Trash2, Plus, Minus, ArrowRight, ShieldCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export function CartPage({
  user,
  onLogout,
}: {
  user: User | null;
  onLogout: () => Promise<void>;
}) {
  const cart = useCart();
  const navigate = useNavigate();

  // Calculate distinct sellers
  const uniqueSellers = Array.from(new Set(cart.map((item) => item.product.user_id)));
  const numSellers = uniqueSellers.length;
  
  // Calculations
  const itemsSubtotal = cart.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  const shippingFee = cart.reduce((acc, item) => acc + (item.product.shipping_fee ?? 0), 0);
  const grandTotal = itemsSubtotal + shippingFee;

  const handleCheckout = () => {
    if (!user) {
      navigate('/auth?redirect=checkout');
    } else {
      navigate('/checkout');
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 md:px-8 lg:px-10 pb-20">
      <HeaderBar user={user} onLogout={onLogout} />

      {/* Breadcrumb / Back Button */}
      <div className="mb-6 mt-4">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white/80 px-4 py-2 text-xs font-semibold text-ink-700 hover:text-ink-950 hover:bg-ink-50 shadow-sm backdrop-blur transition-all"
        >
          &larr; Back to Marketplace
        </Link>
      </div>

      <div className="rounded-3xl border border-white/70 bg-white/80 p-6 md:p-8 shadow-sm backdrop-blur space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-aura-600">Purchase Order</p>
          <h1 className="mt-1 font-display text-3xl font-bold text-ink-900 md:text-4xl">Shopping Cart</h1>
          <p className="mt-1 text-sm text-ink-600">
            Review your construction items and estimate shipping fees prior to checking out.
          </p>
        </div>

        {cart.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink-200 bg-ink-50/30 py-16 px-6 text-center max-w-md mx-auto">
            <ShoppingCart className="mx-auto h-12 w-12 text-ink-300" />
            <h3 className="mt-4 text-base font-bold text-ink-900">Your cart is empty</h3>
            <p className="mt-2 text-xs text-ink-500">
              Go back to the homepage and add materials to your cart to prepare a unified construction order.
            </p>
            <Link
              to="/"
              className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-ink-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-ink-800 transition-colors"
            >
              Browse Materials
            </Link>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-3 pt-2">
            
            {/* Cart Items List */}
            <div className="space-y-4 lg:col-span-2">
              {cart.map((item) => (
                <div
                  key={item.product.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl bg-white p-5 border border-ink-100 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-4 w-full sm:w-auto">
                    {/* Image */}
                    {item.product.images && item.product.images.length > 0 ? (
                      <img
                        src={item.product.images[0]}
                        alt={item.product.title}
                        className="h-16 w-16 rounded-xl object-cover border border-ink-100 shrink-0"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-xl bg-ink-100 border border-ink-150 flex items-center justify-center shrink-0">
                        <span className="text-[9px] font-bold text-ink-400 text-center">No Image</span>
                      </div>
                    )}
                    
                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-bold text-aura-600 uppercase tracking-wider">
                        {item.product.category}
                      </span>
                      <h3 className="font-display text-sm font-bold text-ink-900 truncate">
                        {item.product.title}
                      </h3>
                      <p className="text-xs text-ink-500 font-medium mt-0.5">
                        LKR {Number(item.product.price).toLocaleString()} / {item.product.unit_type}
                      </p>
                      <p className="text-[10px] text-ink-400 font-semibold mt-1">
                        Seller: {item.product.business_name || item.product.seller_name || 'Verified Merchant'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto border-t sm:border-t-0 pt-4 sm:pt-0">
                    {/* Quantity modifier */}
                    <div className="flex items-center gap-2.5 rounded-full border border-ink-200 bg-ink-50/50 p-1">
                      <button
                        onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-white border border-ink-200 text-ink-600 hover:bg-ink-100 transition-colors"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-6 text-center text-xs font-bold text-ink-900">{item.quantity}</span>
                      <button
                        onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-white border border-ink-200 text-ink-600 hover:bg-ink-100 transition-colors"
                        aria-label="Increase quantity"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Subtotal & Delete */}
                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <p className="text-[10px] text-ink-400 font-semibold uppercase tracking-wider">Subtotal</p>
                        <p className="text-sm font-bold text-ink-900">
                          LKR {Number(item.product.price * item.quantity).toLocaleString()}
                        </p>
                      </div>

                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-red-100 bg-red-50/30 text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                        title="Remove Item"
                      >
                        <Trash2 className="h-4.5 w-4.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Checkout Pricing Sidebar */}
            <div className="rounded-2xl border border-ink-200/60 bg-white/95 p-6 shadow-md space-y-6 self-start">
              <h3 className="font-display text-base font-bold text-ink-900 border-b border-ink-100 pb-3">
                Order Estimation
              </h3>

              <div className="space-y-3">
                <div className="flex justify-between text-xs font-semibold text-ink-500">
                  <span>Items Total ({cart.reduce((acc, item) => acc + item.quantity, 0)} items):</span>
                  <span className="text-ink-900">LKR {itemsSubtotal.toLocaleString()}</span>
                </div>
                
                <div className="flex justify-between text-xs font-semibold text-ink-500">
                  <span className="flex flex-col">
                    <span>Manual Shipping Fee:</span>
                    <span className="text-[10px] text-ink-400 italic">Sum of merchant shipping fees</span>
                  </span>
                  <span className="text-ink-900">LKR {shippingFee.toLocaleString()}</span>
                </div>

                <hr className="border-ink-100 mt-4" />

                <div className="flex justify-between items-center pt-2">
                  <span className="text-sm font-bold text-ink-900">Grand Total:</span>
                  <span className="font-display text-xl font-bold text-aura-600">
                    LKR {grandTotal.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Security notice */}
              <div className="flex gap-2.5 rounded-xl bg-ink-50 p-3.5 text-[10px] text-ink-600 leading-relaxed border border-ink-150">
                <ShieldCheck className="h-5 w-5 text-aura-600 shrink-0" />
                <span>
                  <strong>Manual Fulfillment:</strong> Payments are processed via direct bank transfer to Nestora Marketplace. Slip upload is required at checkout to confirm.
                </span>
              </div>

              <button
                onClick={handleCheckout}
                className="w-full flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-aura-500 to-aura-600 hover:from-aura-600 hover:to-aura-700 font-semibold text-sm text-white shadow-md transition-all hover:scale-[1.02] active:scale-95"
              >
                Proceed to Checkout
                <ArrowRight className="h-4.5 w-4.5" />
              </button>
            </div>

          </div>
        )}
      </div>
    </main>
  );
}
