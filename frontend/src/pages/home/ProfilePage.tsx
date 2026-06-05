import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { HeaderBar } from '../../components/HeaderBar';
import { SriLankaMap } from '../../components/SriLankaMap';
import { ServiceCard } from '../../components/ServiceCard';
import { ProductCard } from '../../components/ProductCard';
import { requestJson } from '../../lib/api';
import type { User, Profile, ServiceListing, ProductListing } from '../../types/session';

interface ProfilePageProps {
  user: User | null;
  onLogout: () => Promise<void>;
}

export function ProfilePage({ user, onLogout }: ProfilePageProps) {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Tab State
  const [activeTab, setActiveTab] = useState<'info' | 'listings'>('info');

  // Listings State
  const [services, setServices] = useState<ServiceListing[]>([]);
  const [products, setProducts] = useState<ProductListing[]>([]);
  const [loadingListings, setLoadingListings] = useState(false);

  useEffect(() => {
    async function fetchProfileDetails() {
      if (!id) return;
      setLoading(true);
      setError('');
      try {
        const response = (await requestJson<unknown>(`/api/profiles/${id}`)) as {
          profile: Profile;
        };
        if (response.profile) {
          setProfile(response.profile);
        } else {
          setError('Profile not found.');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load profile.');
      } finally {
        setLoading(false);
      }
    }
    void fetchProfileDetails();
  }, [id]);

  useEffect(() => {
    async function fetchProfileListings() {
      const activeProfile = profile;
      if (!activeProfile) return;
      setLoadingListings(true);
      try {
        if (activeProfile.role === 'service_provider') {
          const res = (await requestJson<unknown>(`/api/service-listings?user_id=${activeProfile.id}`)) as unknown as { listings: ServiceListing[] };
          setServices(res.listings ?? []);
        } else if (activeProfile.role === 'product_seller') {
          const res = (await requestJson<unknown>(`/api/product-listings?user_id=${activeProfile.id}`)) as unknown as { listings: ProductListing[] };
          setProducts(res.listings ?? []);
        }
      } catch (err) {
        console.error('Failed to load listings for profile', err);
      } finally {
        setLoadingListings(false);
      }
    }
    
    void fetchProfileListings();
  }, [profile]);

  if (loading) {
    return (
      <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 md:px-8 lg:px-10">
        <HeaderBar user={user} onLogout={onLogout} />
        <div className="flex justify-center py-32">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-ink-200 border-t-ink-900" />
            <p className="font-display text-sm font-medium text-ink-600">Retrieving profile...</p>
          </div>
        </div>
      </main>
    );
  }

  if (error || !profile) {
    return (
      <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 md:px-8 lg:px-10">
        <HeaderBar user={user} onLogout={onLogout} />
        <div className="mt-8 rounded-3xl border border-dashed border-red-200 bg-red-50/50 py-16 text-center max-w-2xl mx-auto px-6">
          <p className="text-base font-semibold text-red-950">Profile Unavailable</p>
          <p className="mt-1 text-sm text-red-700">{error || 'The requested profile does not exist.'}</p>
          <Link to="/" className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-ink-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-ink-800 transition-colors">
            ← Return to Homepage
          </Link>
        </div>
      </main>
    );
  }

  const isServiceProvider = profile.role === 'service_provider';
  const nameToUse = profile.business_name || profile.name || 'Pro Business';
  const initials = nameToUse
    .split(' ')
    .map((word) => word[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const isOwner = user && Number(user.id) === Number(profile.id);

  // Calculate Map Coverage districts from the listings dynamically
  const coverageDistricts: string[] = [];
  if (isServiceProvider) {
    services.forEach((s) => {
      if (s.cities && Array.isArray(s.cities)) {
        s.cities.forEach((c) => {
          if (!coverageDistricts.includes(c)) coverageDistricts.push(c);
        });
      }
    });
  } else {
    products.forEach((p) => {
      if (p.shipping_districts && Array.isArray(p.shipping_districts)) {
        p.shipping_districts.forEach((d) => {
          if (!coverageDistricts.includes(d)) coverageDistricts.push(d);
        });
      }
    });
  }

  // Fallback to active business city if no listings exist
  if (coverageDistricts.length === 0 && profile.business_city) {
    coverageDistricts.push(profile.business_city);
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 md:px-8 lg:px-10 pb-20">
      <HeaderBar user={user} onLogout={onLogout} />

      {/* Cover Banner */}
      <div className="relative h-60 w-full overflow-hidden rounded-3xl mt-6">
        {profile.banner_url ? (
          <img
            src={profile.banner_url}
            alt={nameToUse}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-r from-aura-800 via-purple-900 to-ember-800" />
        )}
        <div className="absolute inset-0 bg-black/20" />
      </div>

      {/* Header Info Card overlay */}
      <div className="relative max-w-6xl mx-auto px-6 -mt-16 z-10">
        <div className="rounded-3xl border border-white/80 bg-white/90 p-6 md:p-8 shadow-xl backdrop-blur flex flex-col md:flex-row gap-6 items-start justify-between">
          <div className="flex flex-col md:flex-row gap-5 items-center md:items-start text-center md:text-left">
            <div className="h-24 w-24 rounded-3xl border-4 border-white bg-white shadow-lg overflow-hidden flex items-center justify-center font-display text-2xl font-bold text-ink-800 shrink-0">
              {profile.logo_url ? (
                <img src={profile.logo_url} alt={nameToUse} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-ink-100 to-ink-200 flex items-center justify-center">
                  {initials}
                </div>
              )}
            </div>
            
            <div className="pt-2">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5">
                <h1 className="font-display text-2xl font-bold text-ink-900 md:text-3xl">
                  {nameToUse}
                </h1>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                  ✓ Verified Pro
                </span>
              </div>
              <p className="mt-1 text-sm font-semibold text-aura-600">
                {isServiceProvider ? 'Construction Service Provider' : 'Building Material Seller'}
              </p>
              <p className="mt-1 text-xs text-ink-500">
                Member since {new Date(profile.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 w-full md:w-auto justify-center">
            {profile.business_phone && (
              <a
                href={`tel:${profile.business_phone}`}
                className="inline-flex flex-1 md:flex-initial items-center justify-center gap-2 rounded-full bg-ink-900 px-5 py-3 text-xs font-semibold text-white hover:bg-ink-800 transition-all shadow-sm"
              >
                Call Business
              </a>
            )}
            {profile.business_email && (
              <a
                href={`mailto:${profile.business_email}`}
                className="inline-flex flex-1 md:flex-initial items-center justify-center gap-2 rounded-full border border-ink-200 bg-white px-5 py-3 text-xs font-semibold text-ink-700 hover:bg-ink-50 hover:text-ink-900 transition-all shadow-sm"
              >
                Send Email
              </a>
            )}
            {isOwner && (
              <Link
                to="/dashboard"
                className="inline-flex flex-1 md:flex-initial items-center justify-center gap-2 rounded-full bg-aura-600 px-5 py-3 text-xs font-semibold text-white hover:bg-aura-700 transition-all shadow-sm"
              >
                Edit Profile
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="mt-10 flex justify-center border-b border-ink-200">
        <div className="flex gap-8">
          <button
            onClick={() => setActiveTab('info')}
            className={`pb-4 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'info'
                ? 'border-aura-600 text-aura-600'
                : 'border-transparent text-ink-500 hover:text-ink-950'
            }`}
          >
            About & Information
          </button>
          <button
            onClick={() => setActiveTab('listings')}
            className={`pb-4 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'listings'
                ? 'border-aura-600 text-aura-600'
                : 'border-transparent text-ink-500 hover:text-ink-950'
            }`}
          >
            {isServiceProvider ? 'Our Services' : 'Material Inventory'} ({isServiceProvider ? services.length : products.length})
          </button>
        </div>
      </div>

      {/* Tab Contents */}
      <div className="mt-8">
        {activeTab === 'info' ? (
          <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
            {/* Left Column: Business Bio & Details */}
            <div className="space-y-6">
              {/* About Box */}
              <div className="rounded-3xl border border-white/70 bg-white/80 p-6 md:p-8 shadow-sm backdrop-blur">
                <h3 className="font-display text-lg font-bold text-ink-900 mb-4">About Us</h3>
                <p className="text-sm text-ink-700 leading-relaxed whitespace-pre-line">
                  {profile.business_description || 'No business description provided.'}
                </p>
              </div>

              {/* Business Credentials */}
              <div className="rounded-3xl border border-white/70 bg-white/80 p-6 md:p-8 shadow-sm backdrop-blur space-y-4">
                <h3 className="font-display text-lg font-bold text-ink-900 mb-4">Contact & Location</h3>
                
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-ink-100 bg-white p-4">
                    <p className="text-[10px] text-ink-400 font-semibold uppercase tracking-wider">Business Phone</p>
                    <p className="text-sm font-bold text-ink-900 mt-1">{profile.business_phone || 'N/A'}</p>
                  </div>
                  <div className="rounded-2xl border border-ink-100 bg-white p-4">
                    <p className="text-[10px] text-ink-400 font-semibold uppercase tracking-wider">Business Email</p>
                    <p className="text-sm font-bold text-ink-900 mt-1 line-clamp-1">{profile.business_email || 'N/A'}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-ink-100 bg-white p-4">
                  <p className="text-[10px] text-ink-400 font-semibold uppercase tracking-wider">Head Office Address</p>
                  <p className="text-sm font-bold text-ink-900 mt-1">
                    {profile.business_address || 'N/A'}, {profile.business_city || 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column: Sri Lanka Map / Coverage */}
            <div className="space-y-6">
              <SriLankaMap selectedCities={coverageDistricts} />
              
              <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur">
                <h3 className="font-display text-base font-bold text-ink-900 mb-3">
                  {isServiceProvider ? 'Mobilization Coverage' : 'Shipping Coverage'}
                </h3>
                <p className="text-xs text-ink-500 mb-4">
                  We actively service or deliver to the following districts based on our catalog:
                </p>
                <div className="flex flex-wrap gap-2">
                  {coverageDistricts.length === 0 ? (
                    <span className="text-xs text-ink-400 italic">No coverage area listed.</span>
                  ) : (
                    coverageDistricts.map((city, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-1.5 text-xs font-semibold text-emerald-800 shadow-sm"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        {city}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Listings Tab content */
          <div className="space-y-6">
            {loadingListings ? (
              <div className="flex justify-center py-20">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-ink-200 border-t-ink-900" />
              </div>
            ) : isServiceProvider ? (
              services.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-ink-200 bg-white/60 backdrop-blur-sm py-16 text-center shadow-sm">
                  <p className="text-sm text-ink-500">No services listed by this provider yet.</p>
                </div>
              ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {services.map((service) => (
                    <ServiceCard key={service.id} listing={service} />
                  ))}
                </div>
              )
            ) : (
              products.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-ink-200 bg-white/60 backdrop-blur-sm py-16 text-center shadow-sm">
                  <p className="text-sm text-ink-500">No materials listed by this seller yet.</p>
                </div>
              ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              )
            )}
          </div>
        )}
      </div>
    </main>
  );
}
