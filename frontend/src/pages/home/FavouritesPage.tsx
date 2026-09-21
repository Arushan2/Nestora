import { HeaderBar } from '../../components/HeaderBar';
import { ProductCard } from '../../components/ProductCard';
import { ServiceCard } from '../../components/ServiceCard';
import { useFavourites, useServiceFavourites } from '../../lib/cartStore';
import type { User } from '../../types/session';
import { Heart, Package, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';

export function FavouritesPage({
  user,
  onLogout,
}: {
  user: User | null;
  onLogout: () => Promise<void>;
}) {
  const favourites = useFavourites();
  const serviceFavourites = useServiceFavourites();
  const hasAny = favourites.length > 0 || serviceFavourites.length > 0;

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

      <div className="rounded-3xl border border-white/70 bg-white/80 p-6 md:p-8 shadow-sm backdrop-blur space-y-10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-aura-600">Saved Items</p>
          <h1 className="mt-1 font-display text-3xl font-bold text-ink-900 md:text-4xl">My Favourites</h1>
          <p className="mt-1 text-sm text-ink-600">
            Keep track of the services and materials you're interested in for your next construction phase.
          </p>
        </div>

        {!hasAny ? (
          <div className="rounded-2xl border border-dashed border-ink-200 bg-ink-50/30 py-16 px-6 text-center max-w-md mx-auto">
            <Heart className="mx-auto h-12 w-12 text-ink-300" />
            <h3 className="mt-4 text-base font-bold text-ink-900">Your favourites is empty</h3>
            <p className="mt-2 text-xs text-ink-500">
              Explore construction services and materials on the homepage and click the heart icon on any listing to save them here.
            </p>
            <Link
              to="/"
              className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-ink-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-ink-800 transition-colors"
            >
              Start Exploring
            </Link>
          </div>
        ) : (
          <div className="space-y-10">

            {/* Saved Services */}
            {serviceFavourites.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-aura-600" />
                  <h2 className="font-display text-base font-bold text-ink-900">
                    Saved Services
                    <span className="ml-2 text-xs font-semibold text-ink-400">({serviceFavourites.length})</span>
                  </h2>
                </div>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {serviceFavourites.map((service) => (
                    <ServiceCard key={service.id} listing={service} />
                  ))}
                </div>
              </section>
            )}

            {/* Saved Products */}
            {favourites.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-ember-600" />
                  <h2 className="font-display text-base font-bold text-ink-900">
                    Saved Materials
                    <span className="ml-2 text-xs font-semibold text-ink-400">({favourites.length})</span>
                  </h2>
                </div>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {favourites.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              </section>
            )}

          </div>
        )}
      </div>
    </main>
  );
}
