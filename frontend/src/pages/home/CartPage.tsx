import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Trash2, Plus, Minus, ArrowRight, ArrowLeft } from 'lucide-react';
import { HeaderBar } from '../../components/HeaderBar';
import { requestJson } from '../../lib/api';
import type { User, CartItem } from '../../types/session';

export function CartPage({
  user,
  onLogout,
}: {
  user: User | null;
  onLogout: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  async function fetchCart() {
    try {
      const response = (await requestJson('/api/cart')) as any;
      if (response.items) {
        setCartItems(response.items);
      }
    } catch (err) {
      console.error('Failed to fetch cart:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    void fetchCart();
  }, [user]);

  async function handleUpdateQuantity(productId: number, currentQty: number, newQty: number) {
    if (newQty < 1) return;
    setUpdatingId(productId);
    try {
      await requestJson('/api/cart', { product_id: productId, quantity: newQty });
      await fetchCart();
      window.dispatchEvent(new Event('cart-updated'));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update quantity.');
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleRemoveItem(productId: number) {
    if (!confirm('Are you sure you want to remove this item from your cart?')) return;
    setUpdatingId(productId);
    try {
      await requestJson('/api/cart/remove', { product_id: productId });
      await fetchCart();
      window.dispatchEvent(new Event('cart-updated'));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove item.');
    } finally {
      setUpdatingId(null);
    }
  }

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  if (loading) {
    return (
      <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 md:px-8 lg:px-10">
        <HeaderBar user={user} onLogout={onLogout} />
        <div className="flex justify-center py-32">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-ink-200 border-t-ink-900" />
            <p className="font-display text-sm font-medium text-ink-600">Loading your cart...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 md:px-8 lg:px-10">
      <HeaderBar user={user} onLogout={onLogout} />

      <div className="mb-6 mt-4">
        <h1 className="font-display text-3xl font-bold text-ink-900 flex items-center gap-3">
          <ShoppingCart className="h-8 w-8 text-aura-600" />
          Shopping Cart
        </h1>
        <p className="text-sm text-ink-500 mt-1">Review the materials and quantities before proceeding to checkout.</p>
      </div>

      {cartItems.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-ink-200 bg-white p-16 text-center max-w-2xl mx-auto shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-ink-50 text-ink-400">
            <ShoppingCart className="h-8 w-8" />
          </div>
          <h2 className="mt-4 font-display text-lg font-bold text-ink-900">Your cart is empty</h2>
          <p className="mt-1 text-sm text-ink-500">You haven't added any construction materials to your cart yet.</p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-ink-900 px-6 py-3 text-sm font-semibold text-white hover:bg-ink-800 transition-all shadow-md"
          >
            <ArrowLeft className="h-4 w-4" />
            Continue Shopping
          </Link>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Cart Items List */}
          <div className="lg:col-span-2 space-y-4">
            {cartItems.map((item) => (
              <div
                key={item.id}
                className="flex flex-col sm:flex-row items-center gap-4 rounded-3xl border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur transition-all hover:shadow-md"
              >
                {/* Product Image */}
                <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-ink-100 bg-ink-50">
                  {item.images && item.images.length > 0 ? (
                    <img
                      src={item.images[0]}
                      alt={item.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-ink-400 font-medium">
                      No Image
                    </div>
                  )}
                </div>

                {/* Product Meta */}
                <div className="flex-1 min-w-0 text-center sm:text-left">
                  <h3 className="truncate font-display text-base font-bold text-ink-900">
                    {item.title}
                  </h3>
                  <p className="text-xs text-ink-400 mt-0.5">
                    Merchant: <span className="font-semibold text-ink-600">{item.seller_business_name ?? 'Verified Seller'}</span>
                  </p>
                  <p className="text-sm font-bold text-aura-700 mt-2">
                    LKR {Number(item.price).toLocaleString()} <span className="text-[10px] text-ink-400 font-medium">/ {item.unit_type}</span>
                  </p>
                </div>

                {/* Quantity Controls & Deletion */}
                <div className="flex items-center gap-4 border-t sm:border-t-0 pt-4 sm:pt-0 w-full sm:w-auto justify-between sm:justify-end">
                  <div className="flex items-center gap-2.5 rounded-full border border-ink-200 bg-white p-1">
                    <button
                      onClick={() => handleUpdateQuantity(item.product_id, item.quantity, item.quantity - 1)}
                      disabled={item.quantity <= 1 || updatingId === item.product_id}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-ink-500 transition-colors hover:bg-ink-100 disabled:opacity-30"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-8 text-center text-xs font-bold text-ink-900">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => handleUpdateQuantity(item.product_id, item.quantity, item.quantity + 1)}
                      disabled={updatingId === item.product_id}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-ink-500 transition-colors hover:bg-ink-100 disabled:opacity-30"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Subtotal */}
                  <div className="text-right min-w-[100px] hidden sm:block">
                    <p className="text-[10px] text-ink-400 font-semibold uppercase tracking-wider">Subtotal</p>
                    <p className="text-sm font-bold text-ink-900">
                      LKR {(item.price * item.quantity).toLocaleString()}
                    </p>
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={() => handleRemoveItem(item.product_id)}
                    disabled={updatingId === item.product_id}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-ink-100 bg-white text-ink-400 transition-all hover:bg-red-50 hover:text-red-500 hover:border-red-100 shadow-sm"
                    title="Remove from cart"
                  >
                    <Trash2 className="h-4.5 w-4.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Cart Summary Card */}
          <div>
            <div className="rounded-3xl border border-white/70 bg-white/80 p-6 md:p-8 shadow-sm backdrop-blur sticky top-6 space-y-6">
              <h3 className="font-display text-lg font-bold text-ink-900 border-b border-ink-100 pb-3">
                Order Summary
              </h3>

              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-ink-500 font-medium">Subtotal</span>
                  <span className="text-ink-950 font-bold">LKR {subtotal.toLocaleString()}</span>
                </div>
                <div className="flex flex-col gap-1 text-sm border-t border-ink-100 pt-3">
                  <div className="flex justify-between">
                    <span className="text-ink-500 font-medium">Shipping Fee</span>
                    <span className="text-ink-400 text-xs italic">Calculated at checkout</span>
                  </div>
                  <p className="text-[10px] text-ink-400 leading-relaxed mt-1">
                    * Note: Orders are split by merchant. A flat shipping fee applies per merchant (LKR 350 for WP, LKR 550 for other districts).
                  </p>
                </div>

                <div className="flex justify-between text-base font-bold border-t border-ink-100 pt-4">
                  <span className="text-ink-900">Estimated Total</span>
                  <span className="text-lg text-aura-700 font-display">LKR {subtotal.toLocaleString()}</span>
                </div>
              </div>

              <button
                onClick={() => navigate('/checkout')}
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-ink-900 py-4 text-sm font-semibold text-white transition-all hover:bg-ink-800 shadow-md hover:scale-[1.01]"
              >
                Proceed to Checkout
                <ArrowRight className="h-4 w-4" />
              </button>

              <Link
                to="/"
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-ink-200 bg-white py-3.5 text-xs font-semibold text-ink-600 transition-colors hover:bg-ink-50"
              >
                ← Continue Shopping
              </Link>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
