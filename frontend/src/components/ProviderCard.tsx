import { Link } from 'react-router-dom';
import type { Profile } from '../types/session';

export function ProviderCard({ profile }: { profile: Profile }) {
  const isServiceProvider = profile.role === 'service_provider';
  
  // Get business initials for the placeholder logo
  const nameToUse = profile.business_name || profile.name || 'Pro';
  const initials = nameToUse
    .split(' ')
    .map((word) => word[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <Link
      to={`/profile/${profile.id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-ink-200 bg-white transition-all duration-300 hover:shadow-lg cursor-pointer"
    >
      {/* Banner / Header area */}
      <div className="relative h-28 bg-gradient-to-r from-ink-900 to-ink-800 flex items-center overflow-hidden">
        {profile.banner_url ? (
          <img
            src={profile.banner_url}
            alt={nameToUse}
            className="absolute inset-0 h-full w-full object-cover opacity-80 transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-aura-800 to-ember-800 opacity-60" />
        )}
        
        {/* Role Badge */}
        <span className="absolute right-4 top-4 rounded-full bg-white/95 px-3 py-1 text-[10px] font-bold text-ink-900 shadow-sm backdrop-blur">
          {isServiceProvider ? 'Service Provider' : 'Material Seller'}
        </span>
      </div>

      {/* Avatar overlay */}
      <div className="relative px-6 -mt-8 flex items-end">
        <div className="h-16 w-16 rounded-2xl border-4 border-white bg-white shadow-md overflow-hidden flex items-center justify-center font-display text-lg font-bold text-ink-800">
          {profile.logo_url ? (
            <img src={profile.logo_url} alt={nameToUse} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-ink-50 to-ink-100 flex items-center justify-center">
              {initials}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-6 pt-3">
        <h3 className="font-display text-lg font-bold text-ink-900 group-hover:text-aura-600 transition-colors line-clamp-1">
          {nameToUse}
        </h3>
        
        <p className="mt-1 text-xs text-ink-500 font-medium flex items-center gap-1">
          <svg className="h-3.5 w-3.5 text-ink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {profile.business_city || 'Sri Lanka'}
        </p>

        {profile.business_description && (
          <p className="mt-3 text-xs text-ink-600 line-clamp-2 leading-relaxed">
            {profile.business_description}
          </p>
        )}

        {/* View Profile Meta */}
        <div className="mt-auto pt-4 border-t border-ink-100 flex items-center justify-between mt-4">
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Contact</span>
            <span className="text-xs font-semibold text-ink-700">
              {profile.business_phone || profile.email}
            </span>
          </div>
          <span className="rounded-full bg-ink-900 text-white group-hover:bg-ink-800 text-xs px-4 py-1.5 font-semibold transition-colors">
            View Profile
          </span>
        </div>
      </div>
    </Link>
  );
}
