import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { HeaderBar } from '../../components/HeaderBar';
import { SriLankaMap } from '../../components/SriLankaMap';
import { requestJson, requestForm } from '../../lib/api';
import type { User, ServiceListing } from '../../types/session';
import { Button } from '../../components/ui/button';
import { ImageLightbox } from '../../components/ImageLightbox';
import { MessageSquare, Phone, Mail, MapPin, CheckCircle, X, ShieldAlert } from 'lucide-react';
import { FileUpload } from '../../components/ui/file-upload';
import { AvailabilityCalendar } from '../../components/AvailabilityCalendar';

export function ServiceDetailPage({
  user,
  onLogout,
}: {
  user: User | null;
  onLogout: () => Promise<void>;
}) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [listing, setListing] = useState<ServiceListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // Inquiry Modal state
  const [isInquiryModalOpen, setIsInquiryModalOpen] = useState(false);
  const [inquiryText, setInquiryText] = useState('');
  const [surveyPlanFile, setSurveyPlanFile] = useState<File | null>(null);
  const [submittingInquiry, setSubmittingInquiry] = useState(false);
  const [inquiryError, setInquiryError] = useState('');
  const [selectedBookingDate, setSelectedBookingDate] = useState<string | undefined>(undefined);

  useEffect(() => {
    async function fetchListingDetail() {
      if (!id) return;
      setLoading(true);
      setError('');
      try {
        const response = (await requestJson<unknown>(`/api/service-listings/${id}`)) as {
          listing: ServiceListing;
        };
        if (response.listing) {
          setListing(response.listing);
        } else {
          setError('Service listing data not found.');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load service details.');
      } finally {
        setLoading(false);
      }
    }
    void fetchListingDetail();
  }, [id]);

  const getFormatLabel = (type: string) => {
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
        return 'Unit';
    }
  };

  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      navigate('/auth');
      return;
    }
    if (!listing) return;

    setInquiryError('');
    setSubmittingInquiry(true);

    try {
      const formData = new FormData();
      formData.append('service_id', String(listing.id));
      formData.append('content', inquiryText);
      formData.append('message', inquiryText); // backward compatibility
      if (surveyPlanFile) {
        formData.append('survey_plan', surveyPlanFile);
      }
      if (!selectedBookingDate) {
        throw new Error('Please select a booking date first.');
      }
      formData.append('booking_date', selectedBookingDate);

      await requestForm('/api/inquiries', formData);

      // Reset states
      setSurveyPlanFile(null);
      setInquiryText('');

      // Redirect to correct page based on role
      if (user.role === 'service_provider' || user.role === 'product_seller') {
        navigate('/dashboard?tab=services');
      } else {
        navigate('/inquiries');
      }
    } catch (err: any) {
      setInquiryError(err.message || 'Failed to submit inquiry. Please try again.');
    } finally {
      setSubmittingInquiry(false);
    }
  };

  if (loading) {
    return (
      <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 md:px-8 lg:px-10">
        <HeaderBar user={user} onLogout={onLogout} />
        <div className="flex justify-center py-32">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-ink-200 border-t-ink-900" />
            <p className="font-display text-sm font-medium text-ink-600">Retrieving service details...</p>
          </div>
        </div>
      </main>
    );
  }

  if (error || !listing) {
    return (
      <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 md:px-8 lg:px-10">
        <HeaderBar user={user} onLogout={onLogout} />
        <div className="mt-8 rounded-3xl border border-dashed border-red-200 bg-red-50/50 py-16 text-center max-w-2xl mx-auto px-6">
          <p className="text-base font-semibold text-red-950">Failed to load service</p>
          <p className="mt-1 text-sm text-red-700">{error || 'The requested service listing does not exist.'}</p>
          <Link to="/" className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-ink-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-ink-800 transition-colors">
            ← Return to Homepage
          </Link>
        </div>
      </main>
    );
  }

  const isOwner = user && user.id === listing.user_id;
  const isContactsConcealed = listing.business_phone?.includes('••');

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 md:px-8 lg:px-10 pb-24">
      <HeaderBar user={user} onLogout={onLogout} />

      {/* Back Button */}
      <div className="mb-6 mt-4">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white/80 px-4 py-2 text-xs font-semibold text-ink-700 hover:text-ink-950 hover:bg-ink-50 shadow-sm backdrop-blur transition-all"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Marketplace
        </Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        {/* Left Column: Details, Images, Contact */}
        <div className="space-y-6">
          {/* Main Info Card */}
          <div className="rounded-3xl border border-white/70 bg-white/80 p-6 md:p-8 shadow-sm backdrop-blur">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-aura-100 px-3 py-1 text-xs font-semibold text-aura-800">
                <span className="h-1.5 w-1.5 rounded-full bg-aura-500" />
                {listing.category}
              </span>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                Verified Provider
              </span>
            </div>

            <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-ink-900 md:text-4xl leading-[1.2]">
              {listing.title}
            </h1>

            <p className="mt-2 text-sm font-semibold text-ink-500">
              Offered by:{' '}
              {listing.user_id ? (
                <Link
                  to={`/profile/${listing.user_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-aura-600 hover:text-aura-700 hover:underline transition-colors"
                >
                  {listing.business_name || listing.provider_name || 'Verified Nestora Contractor'}
                </Link>
              ) : (
                listing.business_name || listing.provider_name || 'Verified Nestora Contractor'
              )}
            </p>

            <div className="mt-6 border-y border-ink-100 py-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[10px] text-ink-400 font-semibold uppercase tracking-wider">Estimated Base Rate</p>
                <p className="mt-1 font-display text-2xl font-bold text-ink-900">
                  LKR {Number(listing.price).toLocaleString()} <span className="text-sm font-normal text-ink-500">/ {getFormatLabel(listing.pricing_type)}</span>
                </p>
              </div>
              {listing.price_details && (
                <div className="max-w-md bg-ink-50 border border-ink-100 px-4 py-2.5 rounded-2xl">
                  <p className="text-[10px] text-ink-400 font-semibold uppercase tracking-wider">Price Details & Conditions</p>
                  <p className="text-xs text-ink-700 italic mt-0.5">"{listing.price_details}"</p>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="mt-6">
              <h3 className="font-display text-base font-bold text-ink-900 mb-2">Service Description</h3>
              <p className="text-sm text-ink-700 leading-relaxed whitespace-pre-line">
                {listing.description}
              </p>
            </div>

            {/* Inquiry Action Trigger */}
            {!isOwner && (
              <div className="mt-8 border-t border-ink-100 pt-6 space-y-6">
                {!listing.has_ongoing_inquiry && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <h4 className="font-display text-sm font-bold text-ink-900">Check Availability & Book</h4>
                      <span className="text-[9px] bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">Live Calendar</span>
                    </div>
                    <p className="text-xs text-ink-500">
                      Select an available date below to proceed with your booking inquiry.
                    </p>
                    <AvailabilityCalendar
                      providerId={listing.user_id}
                      interactive={true}
                      selectedDate={selectedBookingDate}
                      onDateSelect={(date) => {
                        setSelectedBookingDate(date);
                        setIsInquiryModalOpen(true);
                      }}
                    />
                  </div>
                )}

                {listing.has_ongoing_inquiry ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-xs font-semibold text-amber-800 leading-relaxed shadow-sm flex items-start gap-2.5">
                    <ShieldAlert className="h-4.5 w-4.5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-bold">Ongoing Inquiry / Active Project Exists</p>
                      <p className="text-[11px] text-amber-700 font-medium">
                        You already have an active inquiry or ongoing project for this service listing. Before starting another one, please resolve or complete the existing workspace transaction.
                      </p>
                      <Link to="/inquiries" className="inline-block mt-2 font-bold text-aura-600 hover:underline">
                        View Existing Inquiries &rarr;
                      </Link>
                    </div>
                  </div>
                ) : (
                  <Button
                    onClick={() => {
                      if (!user) {
                        navigate('/auth');
                      } else {
                        setIsInquiryModalOpen(true);
                      }
                    }}
                    className="w-full sm:w-auto rounded-full bg-aura-600 hover:bg-aura-700 text-white px-8 py-3 text-xs font-bold shadow-md hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                  >
                    <MessageSquare className="h-4 w-4" />
                    <span>
                      {selectedBookingDate 
                        ? `Inquire Service for ${selectedBookingDate}` 
                        : 'Inquire Service / Ask Pricing Details'}
                    </span>
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Portfolio Images Gallery */}
          <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur">
            <h3 className="font-display text-base font-bold text-ink-900 mb-4">Work Portfolio & Projects</h3>
            {listing.images && listing.images.length > 0 ? (
              <div className="space-y-4">
                {/* Active Image */}
                <button
                  onClick={() => setIsLightboxOpen(true)}
                  className="relative h-96 w-full overflow-hidden rounded-2xl bg-ink-50 border border-ink-100 group focus:outline-none focus:ring-2 focus:ring-aura-600 focus:ring-offset-2"
                  aria-label="Enlarge image"
                >
                  <img
                    src={listing.images[activeImageIndex]}
                    alt={`${listing.title} work index ${activeImageIndex + 1}`}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 cursor-zoom-in"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-white rounded-full p-3 backdrop-blur shadow-lg">
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                      </svg>
                    </span>
                  </div>
                  <div className="absolute bottom-4 right-4 rounded-full bg-ink-900/70 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur z-10">
                    {activeImageIndex + 1} / {listing.images.length}
                  </div>
                </button>

                {/* Thumbnails */}
                {listing.images.length > 1 && (
                  <div className="flex flex-wrap gap-3">
                    {listing.images.map((img, index) => (
                      <button
                        key={index}
                        onClick={() => setActiveImageIndex(index)}
                        className={`relative h-20 w-20 overflow-hidden rounded-xl border-2 transition-all ${
                          activeImageIndex === index
                            ? 'border-aura-600 ring-2 ring-aura-600/30 scale-95'
                            : 'border-ink-200 hover:border-ink-300'
                        }`}
                      >
                        <img
                          src={img}
                          alt={`${listing.title} thumbnail ${index + 1}`}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex h-64 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-ink-200 bg-ink-50/50">
                <svg className="h-10 w-10 text-ink-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="mt-2 text-xs font-semibold text-ink-400">No portfolio images uploaded by provider</p>
              </div>
            )}
          </div>

          {/* Contact Information block */}
          {isContactsConcealed ? (
            <div className="rounded-3xl border border-amber-100 bg-amber-50/50 p-6 md:p-8 shadow-sm backdrop-blur text-center flex flex-col items-center justify-center space-y-3">
              <ShieldAlert className="h-7 w-7 text-amber-600 animate-bounce" />
              <h4 className="font-display text-sm font-bold text-ink-900 uppercase tracking-wider">Contact Coordinates Protected</h4>
              <p className="text-xs text-ink-600 max-w-sm leading-relaxed">
                Provider phone, email, and exact office address details are locked. Inquire and accept their quotation to unlock direct communication channels.
              </p>
            </div>
          ) : (
            <div className="rounded-3xl border border-white/70 bg-white/80 p-6 md:p-8 shadow-sm backdrop-blur space-y-4">
              <h3 className="font-display text-base font-bold text-ink-900">Direct Contact & Scheduling</h3>
              <p className="text-xs text-ink-500">
                Get in touch with {listing.business_name || listing.provider_name || 'the contractor'} directly. Nestora listings do not charge booking fees.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Phone */}
                {listing.business_phone && (
                  <a
                    href={`tel:${listing.business_phone}`}
                    className="flex items-center gap-3.5 rounded-2xl border border-ink-200 bg-white p-4 transition-all hover:bg-ink-50"
                  >
                    <div className="rounded-full bg-aura-100 p-2.5 text-aura-600 shadow-sm">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-[10px] text-ink-400 font-semibold uppercase tracking-wider">Phone Call</p>
                      <p className="text-sm font-bold text-ink-900">{listing.business_phone}</p>
                    </div>
                  </a>
                )}

                {/* Email */}
                {listing.business_email && (
                  <a
                    href={`mailto:${listing.business_email}`}
                    className="flex items-center gap-3.5 rounded-2xl border border-ink-200 bg-white p-4 transition-all hover:bg-ink-50"
                  >
                    <div className="rounded-full bg-ember-100 p-2.5 text-ember-600 shadow-sm">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-[10px] text-ink-400 font-semibold uppercase tracking-wider">Email Business</p>
                      <p className="text-sm font-bold text-ink-900 line-clamp-1">{listing.business_email}</p>
                    </div>
                  </a>
                )}
              </div>

              {/* Address */}
              <div className="flex items-center gap-3.5 rounded-2xl border border-ink-200 bg-white p-4">
                <div className="rounded-full bg-ink-100 p-2.5 text-ink-600">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] text-ink-400 font-semibold uppercase tracking-wider">Base Office Address</p>
                  <p className="text-sm font-bold text-ink-900">
                    {listing.business_address || 'N/A'}, {listing.business_city || 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Sri Lanka Map / Coverage */}
        <div className="space-y-6">
          {/* Map Coverage */}
          <SriLankaMap selectedCities={listing.cities} />

          {/* List of Served Districts */}
          <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur">
            <h3 className="font-display text-base font-bold text-ink-900 mb-3">Mobilization Cities & Districts</h3>
            <p className="text-xs text-ink-500 mb-4">
              This provider actively travels to and works within the following Sri Lankan districts:
            </p>
            <div className="flex flex-wrap gap-2">
              {listing.cities.map((city, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-1.5 text-xs font-semibold text-emerald-800 shadow-sm"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {city}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Linked Nestora portfolios displays */}
      {listing.portfolios && listing.portfolios.length > 0 && (
        <div className="mt-10 rounded-3xl border border-white/70 bg-white/80 p-6 md:p-8 shadow-sm backdrop-blur space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-aura-600">Verified Completed Projects</p>
            <h3 className="font-display text-2xl font-bold text-ink-900">Contractor's Nestora Portfolios</h3>
            <p className="text-xs text-ink-500">
              Review real construction and installation projects completed by this contractor on Nestora.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {listing.portfolios.map((portfolio: any) => (
              <div key={portfolio.id} className="border border-ink-100 rounded-3xl p-5 bg-white shadow-sm hover:shadow transition-shadow flex flex-col justify-between space-y-3">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-display text-sm font-extrabold text-ink-900">{portfolio.title}</h4>
                    <span className="text-[10px] text-ink-400 font-semibold">{new Date(portfolio.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-xs text-ink-600 leading-relaxed italic">"{portfolio.description}"</p>
                  {portfolio.images && portfolio.images.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 pt-2">
                      {portfolio.images.map((img: string, idx: number) => (
                        <a 
                          href={img}
                          target="_blank" 
                          rel="noopener noreferrer"
                          key={idx} 
                          className="relative aspect-square overflow-hidden rounded-xl border border-ink-100 bg-ink-50 hover:opacity-90 transition-opacity"
                        >
                          <img src={img} alt={`${portfolio.title} photo ${idx + 1}`} className="h-full w-full object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inquire Now Modal */}
      {isInquiryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-ink-150 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-ink-100 pb-3">
              <div>
                <h3 className="font-display text-base font-bold text-ink-900">Initiate Service Inquiry</h3>
                <p className="text-[10px] text-ink-500 uppercase tracking-wider font-semibold">{listing.title}</p>
              </div>
              <button
                onClick={() => setIsInquiryModalOpen(false)}
                className="rounded-full p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-900 transition-all"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <form onSubmit={handleInquirySubmit} className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-ink-800">
                  Project Requirements & Description
                </label>
                <textarea
                  required
                  rows={4}
                  value={inquiryText}
                  onChange={(e) => setInquiryText(e.target.value)}
                  placeholder="Describe your construction timeline, service requirements, site location details, and request a detailed quotation..."
                  className="w-full rounded-2xl border border-ink-100 p-3.5 text-xs font-semibold text-ink-700 placeholder:text-ink-400 focus:outline-none focus:ring-1 focus:ring-aura-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-ink-800">
                  Requested Booking Date
                </label>
                <input
                  type="date"
                  required
                  value={selectedBookingDate || ''}
                  onChange={(e) => setSelectedBookingDate(e.target.value)}
                  className="w-full rounded-2xl border border-ink-100 px-3.5 py-2.5 text-xs font-bold text-ink-800 focus:outline-none focus:ring-1 focus:ring-aura-500"
                />
              </div>

              <div className="space-y-1.5">
                <FileUpload
                  id="survey-plan"
                  label="Upload Survey Plan (Optional)"
                  accept="image/*,application/pdf"
                  onChange={(file) => setSurveyPlanFile(file)}
                />
              </div>

              {inquiryError && <p className="text-xs font-bold text-red-600">{inquiryError}</p>}

              <div className="flex justify-end gap-2.5 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsInquiryModalOpen(false)}
                  disabled={submittingInquiry}
                  className="rounded-full text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submittingInquiry}
                  className="rounded-full bg-aura-600 hover:bg-aura-700 text-white text-xs font-bold"
                >
                  {submittingInquiry ? 'Submitting...' : 'Send Inquiry'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ImageLightbox
        isOpen={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
        images={listing.images || []}
        currentIndex={activeImageIndex}
        onIndexChange={setActiveImageIndex}
      />
    </main>
  );
}
