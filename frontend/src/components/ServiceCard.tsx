import { Link } from 'react-router-dom';
import type { ServiceListing } from '../types/session';

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

export function ServiceCard({ listing }: { listing: ServiceListing }) {
  return (
    <Link
      to={`/services/${listing.id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-ink-200 bg-white transition-all duration-300 hover:shadow-lg cursor-pointer"
    >
      {/* Photo Header */}
      <div className="relative h-48 bg-ink-100">
        {listing.images && listing.images.length > 0 ? (
          <img
            src={listing.images[0]}
            alt={listing.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-aura-500/10 to-ember-500/10">
            <span className="text-xs font-semibold text-ink-400">No Image Uploaded</span>
          </div>
        )}
        <span className="absolute left-4 top-4 rounded-full bg-ink-900/80 px-3 py-1 text-xs font-semibold text-white backdrop-blur shadow-sm">
          {listing.category}
        </span>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-6">
        <h3 className="font-display text-lg font-bold text-ink-900 group-hover:text-aura-600 transition-colors line-clamp-1">
          {listing.title}
        </h3>

        <div className="mt-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-ink-400 font-semibold uppercase tracking-wider">Estimated Rate</p>
            <p className="mt-0.5 font-display text-lg font-bold text-ink-900">
              LKR {Number(listing.price).toLocaleString()} / {formatPriceType(listing.pricing_type)}
            </p>
          </div>
        </div>

        {/* Provider Meta */}
        <div className="mt-4 flex items-center justify-between border-t border-ink-100 pt-4">
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Provider</span>
            <span className="text-sm font-semibold text-ink-900 line-clamp-1">
              {listing.business_name || listing.provider_name || 'Verified Pro'}
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
