import { useState, useEffect } from 'react';
import type { ProductListing } from '../types/session';

export type CartItem = {
  product: ProductListing;
  quantity: number;
};

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(): void {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (err) {
      console.error('Error in cartStore listener:', err);
    }
  });
}

// ── CART FUNCTIONS ──

export function getCart(): CartItem[] {
  try {
    const raw = localStorage.getItem('nestora_cart');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addToCart(product: ProductListing, quantity: number = 1): void {
  const cart = getCart();
  const existing = cart.find((item) => item.product.id === product.id);

  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({ product, quantity });
  }

  localStorage.setItem('nestora_cart', JSON.stringify(cart));
  notify();
}

export function updateCartQuantity(productId: number, quantity: number): void {
  const cart = getCart();
  const item = cart.find((item) => item.product.id === productId);

  if (item) {
    item.quantity = Math.max(1, quantity);
    localStorage.setItem('nestora_cart', JSON.stringify(cart));
    notify();
  }
}

export function removeFromCart(productId: number): void {
  const cart = getCart();
  const filtered = cart.filter((item) => item.product.id !== productId);
  localStorage.setItem('nestora_cart', JSON.stringify(filtered));
  notify();
}

export function clearCart(): void {
  localStorage.removeItem('nestora_cart');
  notify();
}

// ── FAVOURITES FUNCTIONS ──

export function getFavourites(): ProductListing[] {
  try {
    const raw = localStorage.getItem('nestora_favourites');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function toggleFavourite(product: ProductListing): void {
  const favourites = getFavourites();
  const index = favourites.findIndex((item) => item.id === product.id);

  if (index > -1) {
    favourites.splice(index, 1);
  } else {
    favourites.push(product);
  }

  localStorage.setItem('nestora_favourites', JSON.stringify(favourites));
  notify();
}

export function isFavourite(productId: number): boolean {
  const favourites = getFavourites();
  return favourites.some((item) => item.id === productId);
}

// ── REACT HOOKS ──

export function useCart() {
  const [cart, setCart] = useState<CartItem[]>(getCart());

  useEffect(() => {
    return subscribe(() => {
      setCart(getCart());
    });
  }, []);

  return cart;
}

export function useFavourites() {
  const [favourites, setFavourites] = useState<ProductListing[]>(getFavourites());

  useEffect(() => {
    return subscribe(() => {
      setFavourites(getFavourites());
    });
  }, []);

  return favourites;
}
