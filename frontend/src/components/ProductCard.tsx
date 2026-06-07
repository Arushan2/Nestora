import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import type { ProductListing } from '../types/session';
import { isFavourite, toggleFavourite, subscribe } from '../lib/cartStore';

export function ProductCard({ product }: { product: ProductListing }) {
  const [fav, setFav] = useState(isFavourite(product.id));

  useEffect(() => {
    return subscribe(() => {
      setFav(isFavourite(product.id));
    });
  }, [product.id]);

  return (
    <Link
      to={`/products/${product.id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-ink-200 bg-white transition-all duration-300 hover:shadow-lg cursor-pointer"
    >
      {/* Photo Header */}
      <div className="relative h-48 bg-ink-100">
        {product.images && product.images.length > 0 ? (
          <img
            src={product.images[0]}
            alt={product.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-aura-500/10 to-ember-500/10">
            <span className="text-xs font-semibold text-ink-400">No Image Uploaded</span>
          </div>
        )}
        <span className="absolute left-4 top-4 rounded-full bg-ink-900/80 px-3 py-1 text-xs font-semibold text-white backdrop-blur shadow-sm">
          {product.category}
        </span>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleFavourite(product);
          }}
          className="absolute right-4 top-4 z-10 flex h-8.5 w-8.5 items-center justify-center rounded-full bg-white/90 backdrop-blur border border-ink-200 text-ink-600 shadow-sm transition-all hover:bg-white hover:text-red-500 active:scale-90"
          aria-label="Toggle Favourite"
        >
          <Heart className={`h-4.5 w-4.5 transition-colors ${fav ? 'fill-red-500 text-red-500' : 'text-ink-600'}`} />
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-6">
        {product.brand && (
          <p className="text-[10px] font-bold text-aura-600 uppercase tracking-wider mb-1">
            {product.brand}
          </p>
        )}
        <h3 className="font-display text-lg font-bold text-ink-900 group-hover:text-aura-600 transition-colors line-clamp-1">
          {product.title}
        </h3>

        <div className="mt-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-ink-400 font-semibold uppercase tracking-wider">Price</p>
            <p className="mt-0.5 font-display text-lg font-bold text-ink-900">
              LKR {Number(product.price).toLocaleString()} / {product.unit_type}
            </p>
          </div>
        </div>

        {/* Provider Meta */}
        <div className="mt-4 flex items-center justify-between border-t border-ink-100 pt-4">
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Seller</span>
            <span className="text-sm font-semibold text-ink-900 line-clamp-1">
              {product.business_name || product.seller_name || 'Verified Seller'}
            </span>
          </div>
          <span className="rounded-full bg-ink-900 text-white group-hover:bg-ink-800 text-xs px-4 py-1.5 font-semibold transition-colors">
            View
          </span>
        </div>
      </div>
    </Link>
  );
}
