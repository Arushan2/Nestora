import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { ServiceListingModal } from '../../../components/ServiceListingModal';
import { requestJson } from '../../../lib/api';
import type { User, ServiceListing } from '../../../types/session';

interface ListingsPageProps {
  user: User;
  searchQuery: string;
}

export function ListingsPage({ user, searchQuery }: ListingsPageProps) {
  const [listings, setListings] = useState<ServiceListing[]>([]);
  const [loadingListings, setLoadingListings] = useState(false);
  const [listingsError, setListingsError] = useState('');

  // Modal / Wizard State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingListing, setEditingListing] = useState<ServiceListing | null>(null);

  // Fetch current provider's listings
  async function fetchMyListings() {
    setLoadingListings(true);
    setListingsError('');
    try {
      const response = await requestJson<{ listings: ServiceListing[] }>('/api/service-listings?my_listings=true');
      setListings((response.listings as ServiceListing[]) ?? []);
    } catch (err) {
      setListingsError(err instanceof Error ? err.message : 'Failed to load service listings.');
    } finally {
      setLoadingListings(false);
    }
  }

  useEffect(() => {
    void fetchMyListings();
  }, [user]);

  // Open modal to create a new listing
  function handleOpenCreate() {
    setEditingListing(null);
    setIsModalOpen(true);
  }

  // Open modal to edit listing
  function handleOpenEdit(listing: ServiceListing) {
    setEditingListing(listing);
    setIsModalOpen(true);
  }

  // Delete listing
  async function handleDeleteListing(id: number) {
    if (!confirm('Are you sure you want to delete this listing?')) return;
    try {
      await requestJson(`/api/service-listings/${id}/delete`, {});
      void fetchMyListings();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete listing.');
    }
  }

  const formatPriceType = (type: string) => {
    switch (type) {
      case 'sqft':
        return 'Sqft';
      case 'daily_labor':
        return 'Day';
      case 'per_point':
        return 'Point';
      case 'linear_ft':
        return 'Lft';
      default:
        return '';
    }
  };

  const filteredListings = listings.filter((listing) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      listing.title.toLowerCase().includes(query) ||
      listing.category.toLowerCase().includes(query) ||
      listing.description.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleOpenCreate} className="rounded-full bg-ink-900 text-white hover:bg-ink-800">
          + Create Service Listing
        </Button>
      </div>

      {loadingListings ? (
        <div className="flex py-12 justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-ink-200 border-t-ink-900" />
        </div>
      ) : listingsError ? (
        <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">{listingsError}</div>
      ) : filteredListings.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-ink-200 bg-white/60 backdrop-blur-sm py-16 text-center shadow-sm">
          <svg className="mx-auto h-12 w-12 text-ink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          <h3 className="mt-4 text-base font-semibold text-ink-900">
            {searchQuery ? 'No matching services found' : 'No services listed yet'}
          </h3>
          <p className="mt-2 text-sm text-ink-600">
            {searchQuery ? 'Try adjusting your search keywords.' : 'Get started by listing your first construction service.'}
          </p>
          {!searchQuery && (
            <Button onClick={handleOpenCreate} className="mt-6 rounded-full bg-ink-900 text-white hover:bg-ink-800">
              Add First Service
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredListings.map((listing) => (
            <div key={listing.id} className="group relative flex flex-col overflow-hidden rounded-3xl border border-ink-200 bg-white transition-all duration-300 hover:shadow-md">
              <div className="relative h-44 bg-ink-100">
                {listing.images && listing.images.length > 0 ? (
                  <img src={listing.images[0]} alt={listing.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-aura-500/10 to-ember-500/10">
                    <span className="text-xs font-medium text-ink-400">No Image Uploaded</span>
                  </div>
                )}
                <span className="absolute left-4 top-4 rounded-full bg-ink-900/80 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                  {listing.category}
                </span>
              </div>

              <div className="flex flex-1 flex-col p-5">
                <h3 className="font-display text-lg font-bold text-ink-900 group-hover:text-aura-600 transition-colors">
                  {listing.title}
                </h3>
                <p className="mt-2 text-xs text-ink-500 line-clamp-2 leading-relaxed">
                  {listing.description}
                </p>

                <div className="mt-4 border-t border-ink-100 pt-3">
                  <p className="text-xs text-ink-400 font-semibold uppercase tracking-wider">Pricing Format</p>
                  <p className="mt-1 font-display font-semibold text-ink-900">
                    LKR {Number(listing.price).toLocaleString()} / {formatPriceType(listing.pricing_type)}
                  </p>
                  {listing.price_details && (
                    <p className="text-xs text-ink-500 italic mt-0.5">"{listing.price_details}"</p>
                  )}
                </div>

                <div className="mt-3">
                  <p className="text-xs text-ink-400 font-semibold uppercase tracking-wider">Service Area</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {listing.cities.slice(0, 3).map((c, i) => (
                      <span key={i} className="rounded bg-ink-100 px-2 py-0.5 text-[10px] font-medium text-ink-700">
                        {c}
                      </span>
                    ))}
                    {listing.cities.length > 3 && (
                      <span className="rounded bg-ink-100 px-2 py-0.5 text-[10px] font-medium text-ink-700">
                        +{listing.cities.length - 3} more
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-auto flex gap-2 border-t border-ink-100 pt-4">
                  <Button variant="outline" className="flex-1 rounded-full text-xs py-1" onClick={() => handleOpenEdit(listing)}>
                    Edit
                  </Button>
                  <Button variant="outline" className="rounded-full text-red-600 hover:bg-red-50 border-red-200 hover:text-red-700 text-xs py-1 px-3" onClick={() => void handleDeleteListing(listing.id)}>
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ServiceListingModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        listing={editingListing}
        onSaveSuccess={fetchMyListings}
      />
    </div>
  );
}
