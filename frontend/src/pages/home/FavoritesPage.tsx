import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Heart, ArrowLeft } from 'lucide-react';
import { HeaderBar } from '../../components/HeaderBar';
import { ProductCard } from '../../components/ProductCard';
import { requestJson } from '../../lib/api';
import type { User, Favorite, ProductListing } from '../../types/session';

export function FavoritesPage({
  user,
  onLogout,
}: {
  user: User | null;
  onLogout: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchFavorites() {
    try {
      const response = (await requestJson('/api/favorites')) as any;
      if (response.favorites) {
        setFavorites(response.favorites);
      }
    } catch (err) {
      console.error('Failed to fetch favorites:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    void fetchFavorites();
  }, [user]);

  if (loading) {
    return (
      <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 md:px-8 lg:px-10">
        <HeaderBar user={user} onLogout={onLogout} />
        <div className="flex justify-center py-32">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-ink-200 border-t-ink-900" />
            <p className="font-display text-sm font-medium text-ink-600">Retrieving saved items...</p>
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
          <Heart className="h-8 w-8 text-red-500 fill-red-500" />
          My Saved Favourites
        </h1>
        <p className="text-sm text-ink-500 mt-1">Review your saved construction materials and add them to your cart when ready.</p>
      </div>

      {favorites.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-ink-200 bg-white p-16 text-center max-w-2xl mx-auto shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-ink-50 text-ink-400">
            <Heart className="h-8 w-8 text-ink-300" />
          </div>
          <h2 className="mt-4 font-display text-lg font-bold text-ink-900">No saved favorites yet</h2>
          <p className="mt-1 text-sm text-ink-500">Click the heart icon on any material listing to add it to this list.</p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-ink-900 px-6 py-3 text-sm font-semibold text-white hover:bg-ink-800 transition-all shadow-md"
          >
            <ArrowLeft className="h-4 w-4" />
            Explore Materials
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {favorites.map((fav) => {
            // Map Favorite to ProductListing to make it compatible with ProductCard
            const listing: ProductListing = {
              id: fav.product_id,
              user_id: 0, // not used in ProductCard
              title: fav.title,
              category: fav.category,
              brand: fav.brand,
              description: '',
              price: fav.price,
              unit_type: fav.unit_type,
              shipping_districts: [],
              delivery_terms: null,
              unloading_provided: false,
              images: fav.images,
              shipping_fee: 0,
              stock_units: 0,
              created_at: '',
              updated_at: '',
            };

            return <ProductCard key={fav.id} product={listing} />;
          })}
        </div>
      )}
    </main>
  );
}
