import { useState, useEffect, useRef } from 'react';
import { requestJson, requestForm } from '../lib/api';
import type { User, Inquiry, InquiryFollowup, InquiryContacts } from '../types/session';
import { FileUpload } from './ui/file-upload';
import { Button } from './ui/button';
import { AlertModal } from './ui/AlertModal';
import { ConfirmModal } from './ui/ConfirmModal';
import { AvailabilityCalendar } from './AvailabilityCalendar';
import { 
  Search, MessageSquare, DollarSign, Calendar, FileText, CheckCircle2, 
  AlertCircle, ChevronRight, Phone, Mail, MapPin, Building, Image as ImageIcon,
  CheckCircle, ArrowLeft, Send
} from 'lucide-react';

interface InquiryListAndDetailProps {
  user: User;
  onBackToDashboard?: () => void;
}

export function InquiryListAndDetail({ user, onBackToDashboard }: InquiryListAndDetailProps) {
  const isPro = user.role === 'service_provider' || user.role === 'product_seller';
  const showTabs = user.role === 'service_provider';

  // State
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [inquiryDetail, setInquiryDetail] = useState<Inquiry | null>(null);
  const [followups, setFollowups] = useState<InquiryFollowup[]>([]);
  const [contacts, setContacts] = useState<InquiryContacts | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Tab state for service providers who can have both customer sent inquiries and provider received inquiries
  const [activeTab, setActiveTab] = useState<'received' | 'sent'>(showTabs ? 'received' : 'sent');

  // Custom Modal States
  const [confirmConfig, setConfirmConfig] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const [alertConfig, setAlertConfig] = useState<{ title: string; message: string; type?: 'info' | 'error' | 'success' } | null>(null);

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmConfig({ title, message, onConfirm });
  };
  const showAlert = (title: string, message: string, type: 'info' | 'error' | 'success' = 'info') => {
    setAlertConfig({ title, message, type });
  };

  // Modal / Action states
  const [actionModal, setActionModal] = useState<'request_details' | 'reply_details' | 'send_offer' | 'request_correction' | 'complete_work' | null>(null);
  const [actionContent, setActionContent] = useState('');
  const [actionPrice, setActionPrice] = useState('');
  const [actionImages, setActionImages] = useState<File[]>([]);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [actionError, setActionError] = useState('');

  // Reschedule state on conflict
  const [rescheduleInquiryId, setRescheduleInquiryId] = useState<number | null>(null);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState<string>('');
  const [submittingReschedule, setSubmittingReschedule] = useState(false);

  const timelineEndRef = useRef<HTMLDivElement>(null);

  // Fetch inquiries list
  const fetchInquiries = async () => {
    try {
      setLoadingList(true);
      const url = showTabs 
        ? `/api/inquiries?type=${activeTab}`
        : '/api/inquiries?type=sent';
      const res = (await requestJson(url)) as any;
      setInquiries(res.inquiries || []);
    } catch (err) {
      console.error('Error fetching inquiries:', err);
    } finally {
      setLoadingList(false);
    }
  };

  // Fetch single inquiry details + followups + contact info
  const fetchInquiryDetail = async (id: number) => {
    try {
      setLoadingDetail(true);
      const res = (await requestJson(`/api/inquiries/${id}`)) as any;
      setInquiryDetail(res.inquiry);
      setFollowups(res.followups || []);
      setContacts(res.contacts || null);
    } catch (err) {
      console.error('Error fetching inquiry details:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Trigger loading list on mount or tab switch
  useEffect(() => {
    fetchInquiries();
    setSelectedId(null);
    setInquiryDetail(null);
    setFollowups([]);
    setContacts(null);
  }, [activeTab]);

  // Fetch details when selected inquiry changes
  useEffect(() => {
    if (selectedId) {
      fetchInquiryDetail(selectedId);
    }
  }, [selectedId]);

  // Scroll to bottom of timeline when details load or new follow-ups are added
  useEffect(() => {
    timelineEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [followups]);

  // Handle workflow actions (Request details, reply, send offer, etc.)
  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;

    setActionError('');
    setSubmittingAction(true);

    try {
      let response;
      if (actionModal === 'complete_work' || actionModal === 'reply_details') {
        // Multipart/form-data upload
        const formData = new FormData();
        formData.append('content', actionContent);
        actionImages.forEach((img) => {
          formData.append('images[]', img);
        });

        const endpoint = actionModal === 'complete_work'
          ? `/api/inquiries/${selectedId}/complete-work`
          : `/api/inquiries/${selectedId}/reply-details`;

        response = await requestForm(endpoint, formData);
      } else {
        // Standard JSON requests
        let payload: any = { content: actionContent };
        let endpoint = '';

        if (actionModal === 'request_details') {
          endpoint = `/api/inquiries/${selectedId}/request-details`;
        } else if (actionModal === 'request_correction') {
          endpoint = `/api/inquiries/${selectedId}/request-correction`;
        } else if (actionModal === 'send_offer') {
          endpoint = `/api/inquiries/${selectedId}/offer`;
          payload.price = parseFloat(actionPrice);
          if (isNaN(payload.price) || payload.price <= 0) {
            throw new Error('Please enter a valid price');
          }
        }

        response = await requestJson(endpoint, payload);
      }

      // Refresh data
      await fetchInquiryDetail(selectedId);
      await fetchInquiries();

      // Reset action states
      setActionModal(null);
      setActionContent('');
      setActionPrice('');
      setActionImages([]);
    } catch (err: any) {
      setActionError(err.message || 'Operation failed. Please try again.');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Fast action triggers (Accept offer, Confirm completion) without modals
  const handleDirectAction = (action: 'accept' | 'confirm') => {
    if (!selectedId) return;
    const actionVerb = action === 'accept' ? 'accept this quotation' : 'confirm completion of this work';
    
    showConfirm(
      'Confirm Action',
      `Are you sure you want to ${actionVerb}?`,
      async () => {
        setLoadingDetail(true);
        try {
          const endpoint = `/api/inquiries/${selectedId}/${action}`;
          await requestJson(endpoint, {});
          await fetchInquiryDetail(selectedId);
          await fetchInquiries();
        } catch (err: any) {
          if (action === 'accept' && err.message && err.message.includes('fully booked or unavailable')) {
            setRescheduleInquiryId(selectedId);
            setIsRescheduleModalOpen(true);
          } else {
            showAlert('Action Failed', err.message || 'Action failed.', 'error');
          }
        } finally {
          setLoadingDetail(false);
        }
      }
    );
  };

  // Filter inquiries based on search query
  const filteredInquiries = inquiries.filter((inq) => {
    const term = searchQuery.toLowerCase();
    const serviceName = inq.service_title.toLowerCase();
    const otherParty = (activeTab === 'received' ? inq.customer_name : inq.provider_name).toLowerCase();
    return serviceName.includes(term) || otherParty.includes(term);
  });

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-100 text-amber-800';
      case 'details_requested': return 'bg-blue-100 text-blue-800';
      case 'offered': return 'bg-purple-100 text-purple-800';
      case 'accepted': return 'bg-indigo-100 text-indigo-800';
      case 'work_completed': return 'bg-teal-100 text-teal-800';
      case 'completed': return 'bg-green-100 text-green-800';
      default: return 'bg-ink-100 text-ink-800';
    }
  };

  const formatStatus = (status: string) => {
    return status.replace('_', ' ').toUpperCase();
  };

  const getFollowupIcon = (type: string) => {
    switch (type) {
      case 'inquiry_created': return <MessageSquare className="h-4 w-4 text-amber-500" />;
      case 'details_requested': return <FileText className="h-4 w-4 text-blue-500" />;
      case 'details_replied': return <MessageSquare className="h-4 w-4 text-cyan-500" />;
      case 'offer_sent': return <DollarSign className="h-4 w-4 text-purple-500" />;
      case 'correction_requested': return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'offer_accepted': return <CheckCircle2 className="h-4 w-4 text-indigo-500" />;
      case 'work_completed': return <ImageIcon className="h-4 w-4 text-teal-500" />;
      case 'completion_confirmed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      default: return <MessageSquare className="h-4 w-4 text-ink-500" />;
    }
  };

  const getStepProgressIndex = (status: string) => {
    switch (status) {
      case 'pending': return 1;
      case 'details_requested': return 2;
      case 'offered': return 3;
      case 'accepted': return 4;
      case 'work_completed': return 5;
      case 'completed': return 6;
      default: return 0;
    }
  };

  return (
    <div className="flex h-[calc(100vh-220px)] lg:h-[calc(100vh-200px)] min-h-[500px] overflow-hidden rounded-3xl border border-ink-100 bg-white shadow-xl">
      {/* Left panel: List */}
      <div className={`w-full md:w-80 flex-shrink-0 flex flex-col border-r border-ink-50 bg-ink-50/30 ${selectedId ? 'hidden md:flex' : 'flex'}`}>
        
        {/* Workspace header & tabs */}
        <div className="p-4 border-b border-ink-50 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-ink-900">Service Inquiries</h2>
            {onBackToDashboard && (
              <Button variant="ghost" onClick={onBackToDashboard} className="text-[11px] font-bold px-2.5 py-1.5 h-auto">
                Dashboard
              </Button>
            )}
          </div>

          {showTabs && (
            <div className="flex rounded-full bg-ink-100 p-0.5">
              <button
                onClick={() => setActiveTab('received')}
                className={`flex-1 rounded-full py-1 text-center text-xs font-bold transition-all ${
                  activeTab === 'received' ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-800'
                }`}
              >
                Received
              </button>
              <button
                onClick={() => setActiveTab('sent')}
                className={`flex-1 rounded-full py-1 text-center text-xs font-bold transition-all ${
                  activeTab === 'sent' ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-800'
                }`}
              >
                Sent Inquiries
              </button>
            </div>
          )}

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-ink-400" />
            <input
              type="text"
              placeholder="Search by listing or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-ink-100 bg-white py-1.5 pl-8 pr-3 text-xs font-medium text-ink-700 placeholder:text-ink-400 focus:outline-none focus:ring-1 focus:ring-aura-500"
            />
          </div>
        </div>

        {/* List items */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loadingList ? (
            <div className="flex flex-col items-center justify-center py-10 space-y-2">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-ink-200 border-t-ink-900" />
              <p className="text-[10px] font-bold text-ink-400">Loading inquiries...</p>
            </div>
          ) : filteredInquiries.length === 0 ? (
            <div className="text-center py-12 text-ink-400 space-y-1">
              <MessageSquare className="mx-auto h-8 w-8 opacity-40" />
              <p className="text-xs font-semibold">No inquiries found</p>
              <p className="text-[10px]">Your service inquiries will list here.</p>
            </div>
          ) : (
            filteredInquiries.map((inq) => {
              const active = inq.id === selectedId;
              const otherParty = activeTab === 'received' ? inq.customer_name : inq.provider_name;
              return (
                <button
                  key={inq.id}
                  onClick={() => setSelectedId(inq.id)}
                  className={`w-full text-left p-3 rounded-2xl transition-all flex items-start justify-between gap-3 ${
                    active 
                      ? 'bg-white border-2 border-aura-500 shadow-md translate-x-1' 
                      : 'hover:bg-white border-2 border-transparent hover:shadow-sm'
                  }`}
                >
                  <div className="space-y-1 min-w-0">
                    <p className="font-display text-xs font-bold text-ink-900 truncate">
                      {inq.service_title}
                    </p>
                    <p className="text-[10px] text-ink-500 font-medium truncate">
                      {activeTab === 'received' ? `From: ${otherParty}` : `To: ${otherParty}`}
                    </p>
                    <span className={`inline-block rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${getStatusBadgeClass(inq.status)}`}>
                      {formatStatus(inq.status)}
                    </span>
                  </div>
                  <ChevronRight className={`h-4 w-4 text-ink-300 flex-shrink-0 self-center transition-transform ${active ? 'rotate-90 text-aura-500' : ''}`} />
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right panel: Timeline & Details */}
      <div className={`flex-1 flex flex-col min-w-0 ${!selectedId ? 'hidden md:flex' : 'flex'}`}>
        {loadingDetail ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-3">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-ink-100 border-t-aura-600" />
            <p className="font-display text-sm font-semibold text-ink-600">Loading timeline...</p>
          </div>
        ) : !inquiryDetail ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-ink-400 space-y-2">
            <MessageSquare className="h-12 w-12 opacity-30 text-ink-300" />
            <h3 className="font-display text-base font-bold text-ink-900">Inquiry Workspace</h3>
            <p className="text-xs max-w-sm">
              Select an inquiry from the sidebar to coordinate pricing details, accept offers, and track project status.
            </p>
          </div>
        ) : (
          <>
            {/* Detail Header */}
            <div className="p-4 border-b border-ink-50 flex items-center justify-between gap-4 flex-wrap bg-white">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => setSelectedId(null)}
                  className="md:hidden flex h-8 w-8 items-center justify-center rounded-full border border-ink-100 hover:bg-ink-50"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div className="min-w-0">
                  <h3 className="font-display text-base font-bold text-ink-900 truncate">
                    {inquiryDetail.service_title}
                  </h3>
                  <p className="text-[10px] text-ink-500 font-semibold uppercase tracking-wider">
                    {inquiryDetail.service_category}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {inquiryDetail.booking_date && (
                  <span className="rounded-full bg-white border border-ink-150 px-2.5 py-1 text-[9px] font-bold text-ink-700 uppercase tracking-wider flex items-center gap-1 shadow-sm">
                    <Calendar className="h-3 w-3 text-aura-600" />
                    <span>Booking Date: {inquiryDetail.booking_date}</span>
                  </span>
                )}
                <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold tracking-wider uppercase ${getStatusBadgeClass(inquiryDetail.status)}`}>
                  {formatStatus(inquiryDetail.status)}
                </span>
              </div>
            </div>

            {/* Workflow Progress Steps */}
            <div className="px-6 py-3 border-b border-ink-50 bg-ink-50/20 hidden sm:block">
              <div className="flex items-center justify-between max-w-2xl mx-auto text-[9px] font-bold uppercase tracking-wider text-ink-400">
                {[
                  { step: 1, label: 'Inquiry' },
                  { step: 2, label: 'Details' },
                  { step: 3, label: 'Quotation' },
                  { step: 4, label: 'Agreement' },
                  { step: 5, label: 'Execution' },
                  { step: 6, label: 'Completed' }
                ].map((s) => {
                  const currentIndex = getStepProgressIndex(inquiryDetail.status);
                  const isDone = s.step <= currentIndex;
                  const isCurrent = s.step === currentIndex;
                  return (
                    <div key={s.step} className="flex flex-col items-center gap-1.5 flex-1 relative last:flex-none">
                      <div className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all ${
                        isCurrent 
                          ? 'border-aura-500 bg-aura-50 text-aura-600 scale-110 shadow' 
                          : isDone 
                          ? 'border-green-500 bg-green-50 text-green-600' 
                          : 'border-ink-200 bg-white text-ink-400'
                      }`}>
                        {isDone && !isCurrent ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <span>{s.step}</span>
                        )}
                      </div>
                      <span className={isCurrent ? 'text-aura-600 font-extrabold' : isDone ? 'text-ink-800' : 'text-ink-400'}>
                        {s.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Timeline Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-ink-50/20 space-y-6">
              
              {/* Service Description Info Card */}
              {inquiryDetail.service_description && (
                <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-sm max-w-xl mx-auto space-y-2">
                  <h4 className="text-xs font-bold text-ink-800 uppercase tracking-wider">Service Detail Reference</h4>
                  <p className="text-xs text-ink-600 leading-relaxed italic">
                    "{inquiryDetail.service_description}"
                  </p>
                </div>
              )}

              {/* Revealed Contact Information (Accepted stage onwards) */}
              {contacts && (
                <div className="rounded-3xl border border-emerald-100 bg-emerald-50/50 p-5 shadow-sm max-w-2xl mx-auto space-y-4 animate-in fade-in zoom-in-95 duration-300">
                  <div className="flex items-center gap-2 text-emerald-800">
                    <CheckCircle className="h-5 w-5 flex-shrink-0" />
                    <h4 className="font-display text-sm font-extrabold tracking-tight">Contractor Coordinates Revealed</h4>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Provider Coordinates */}
                    <div className="bg-white border border-emerald-100 p-4 rounded-2xl space-y-2.5">
                      <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-xs uppercase tracking-wider border-b border-emerald-50 pb-1.5">
                        <Building className="h-3.5 w-3.5" />
                        <span>Service Provider</span>
                      </div>
                      <div className="space-y-1.5 text-xs text-ink-700">
                        <p className="font-bold text-ink-900">{contacts.provider.name}</p>
                        <p className="flex items-center gap-2"><Phone className="h-3 w-3 text-emerald-600" /> {contacts.provider.phone}</p>
                        <p className="flex items-center gap-2 truncate"><Mail className="h-3 w-3 text-emerald-600" /> {contacts.provider.email}</p>
                        <p className="flex items-center gap-2"><MapPin className="h-3 w-3 text-emerald-600" /> {contacts.provider.address}, {contacts.provider.city}</p>
                      </div>
                    </div>

                    {/* Customer Coordinates */}
                    <div className="bg-white border border-emerald-100 p-4 rounded-2xl space-y-2.5">
                      <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-xs uppercase tracking-wider border-b border-emerald-50 pb-1.5">
                        <Building className="h-3.5 w-3.5" />
                        <span>Customer Details</span>
                      </div>
                      <div className="space-y-1.5 text-xs text-ink-700">
                        <p className="font-bold text-ink-900">{contacts.customer.name}</p>
                        <p className="flex items-center gap-2"><Phone className="h-3 w-3 text-emerald-600" /> {contacts.customer.phone}</p>
                        <p className="flex items-center gap-2 truncate"><Mail className="h-3 w-3 text-emerald-600" /> {contacts.customer.email}</p>
                        <p className="flex items-center gap-2"><MapPin className="h-3 w-3 text-emerald-600" /> {contacts.customer.address}, {contacts.customer.city}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Vertical Followups Timeline */}
              <div className="max-w-xl mx-auto relative pl-6 border-l-2 border-ink-100 space-y-6 py-4">
                {followups.map((f, index) => {
                  const isOwn = f.sender_id === user.id;
                  
                  return (
                    <div key={f.id} className="relative group animate-in fade-in slide-in-from-left-4 duration-200">
                      
                      {/* Timeline Dot with Action Icon */}
                      <span className="absolute -left-9.5 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-white border border-ink-200 shadow-sm z-10">
                        {getFollowupIcon(f.type)}
                      </span>

                      {/* Timeline Message Bubble */}
                      <div className={`p-4 rounded-3xl border shadow-sm space-y-2 ${
                        isOwn 
                          ? 'bg-white border-ink-150' 
                          : 'bg-aura-50/30 border-aura-100'
                      }`}>
                        
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-[10px] font-bold text-ink-800">
                            {f.sender_name} <span className="font-normal text-ink-400">({f.sender_role === 'service_provider' ? 'Provider' : 'Customer'})</span>
                          </span>
                          <span className="text-[9px] font-semibold text-ink-400">
                            {new Date(f.created_at).toLocaleString()}
                          </span>
                        </div>

                        {/* Specific timeline layouts */}
                        {f.type === 'inquiry_created' && (
                          <div className="space-y-2">
                            <p className="text-xs font-bold text-ink-900">Inquiry Created</p>
                            <p className="text-xs text-ink-600 leading-relaxed">"{f.content}"</p>
                            {inquiryDetail?.survey_plan_url && (
                              <div className="pt-1.5">
                                <a 
                                  href={inquiryDetail.survey_plan_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2 rounded-xl border border-ink-150 bg-ink-50 hover:bg-ink-100 px-3 py-1.5 text-[11px] font-bold text-ink-800 transition-all shadow-xs"
                                >
                                  <FileText className="h-3.5 w-3.5 text-aura-600" />
                                  <span>Attached Survey Plan</span>
                                </a>
                              </div>
                            )}
                          </div>
                        )}

                        {f.type === 'details_requested' && (
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-blue-900">Details Requested</p>
                            <p className="text-xs text-blue-800 bg-blue-50/50 p-2.5 rounded-xl border border-blue-100 leading-relaxed">"{f.content}"</p>
                          </div>
                        )}

                        {f.type === 'details_replied' && (
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-cyan-900">Additional details shared</p>
                            <p className="text-xs text-cyan-800 bg-cyan-50/50 p-2.5 rounded-xl border border-cyan-100 leading-relaxed">"{f.content}"</p>
                            {f.images && f.images.length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                {f.images.map((url, i) => {
                                  const fileName = url.substring(url.lastIndexOf('/') + 1);
                                  return (
                                    <a 
                                      href={url} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      key={i}
                                      className="inline-flex items-center gap-2 rounded-xl border border-ink-150 bg-ink-50 hover:bg-ink-100 px-3 py-1.5 text-[11px] font-bold text-ink-800 transition-all shadow-xs"
                                    >
                                      <FileText className="h-3.5 w-3.5 text-cyan-600" />
                                      <span className="truncate max-w-[150px]">{fileName.split('_').slice(1).join('_') || 'Attached File'}</span>
                                    </a>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}

                        {f.type === 'offer_sent' && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between bg-purple-50 border border-purple-100 p-3 rounded-2xl">
                              <span className="text-xs font-bold text-purple-900">Quoted Price:</span>
                              <span className="font-display text-sm font-extrabold text-purple-800">LKR {f.quoted_price?.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <p className="text-xs text-ink-600 leading-relaxed">"{f.content}"</p>
                          </div>
                        )}

                        {f.type === 'correction_requested' && (
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-red-900">Correction / Revision Requested</p>
                            <p className="text-xs text-red-800 bg-red-50/50 p-2.5 rounded-xl border border-red-100 leading-relaxed">"{f.content}"</p>
                          </div>
                        )}

                        {f.type === 'offer_accepted' && (
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-indigo-900">Agreement Confirmed</p>
                            <p className="text-xs text-indigo-800 leading-relaxed">"{f.content}"</p>
                          </div>
                        )}

                        {f.type === 'work_completed' && (
                          <div className="space-y-3">
                            <div className="space-y-1">
                              <p className="text-xs font-bold text-teal-900">Work Marked Completed</p>
                              <p className="text-xs text-teal-800 bg-teal-50/50 p-2.5 rounded-xl border border-teal-100 leading-relaxed">"{f.content}"</p>
                            </div>
                            
                            {/* Images Grid */}
                            {f.images && f.images.length > 0 && (
                              <div className="grid grid-cols-2 gap-2 mt-2">
                                {f.images.map((url, i) => (
                                  <a 
                                    href={url} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    key={i}
                                    className="relative aspect-[4/3] rounded-xl overflow-hidden border border-ink-150 bg-black group-hover:opacity-95"
                                  >
                                    <img src={url} alt={`Completed work photo ${i}`} className="h-full w-full object-cover" />
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {f.type === 'completion_confirmed' && (
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-green-900">Project Verified & Finished</p>
                            <p className="text-xs text-green-800 leading-relaxed">"{f.content}"</p>
                          </div>
                        )}

                      </div>
                    </div>
                  );
                })}
                <div ref={timelineEndRef} />
              </div>
            </div>

            {/* Bottom Actions Area */}
            <div className="p-4 border-t border-ink-50 bg-white">
              
              {/* Dynamic Dialog modals/action panels based on state */}
              {actionModal ? (
                <form onSubmit={handleActionSubmit} className="max-w-xl mx-auto border border-ink-150 p-4 rounded-3xl bg-ink-50/50 space-y-4 animate-in slide-in-from-bottom-4 duration-300">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-ink-900 uppercase tracking-wider">
                      {actionModal === 'request_details' && 'Ask details/questions'}
                      {actionModal === 'reply_details' && 'Reply details'}
                      {actionModal === 'send_offer' && 'Submit Quotation'}
                      {actionModal === 'request_correction' && 'Describe requested correction'}
                      {actionModal === 'complete_work' && 'Upload project photos & finish'}
                    </h4>
                    <button 
                      type="button" 
                      onClick={() => setActionModal(null)} 
                      className="text-xs font-bold text-ink-400 hover:text-ink-900"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="space-y-3">
                    {actionModal === 'send_offer' && (
                      <div className="relative">
                        <span className="absolute left-3.5 top-2.5 text-xs font-bold text-ink-400">LKR</span>
                        <input
                          type="number"
                          placeholder="0.00"
                          value={actionPrice}
                          onChange={(e) => setActionPrice(e.target.value)}
                          required
                          min="1"
                          step="0.01"
                          className="w-full pl-11 pr-4 py-2 border border-ink-100 rounded-2xl text-xs font-bold text-ink-800 focus:outline-none focus:ring-1 focus:ring-aura-500"
                        />
                      </div>
                    )}

                    {actionModal === 'complete_work' && (
                      <div className="bg-white p-3 rounded-2xl border border-ink-100">
                        <FileUpload
                          id="completion_photos"
                          label="Work Completion Photos (Optional)"
                          multiple={true}
                          onChangeMultiple={(files) => setActionImages(files)}
                        />
                      </div>
                    )}

                    {actionModal === 'reply_details' && (
                      <div className="bg-white p-3 rounded-2xl border border-ink-100">
                        <FileUpload
                          id="reply_files"
                          label="Additional Files / Documents (Optional)"
                          multiple={true}
                          onChangeMultiple={(files) => setActionImages(files)}
                        />
                      </div>
                    )}

                    <textarea
                      placeholder={
                        actionModal === 'complete_work' 
                          ? 'Provide work details, warranty if any, or completion report...'
                          : 'Type your detailed message here...'
                      }
                      value={actionContent}
                      onChange={(e) => setActionContent(e.target.value)}
                      required
                      rows={3}
                      className="w-full border border-ink-100 rounded-2xl p-3 text-xs font-semibold text-ink-700 placeholder:text-ink-400 focus:outline-none focus:ring-1 focus:ring-aura-500"
                    />
                  </div>

                  {actionError && <p className="text-xs font-bold text-red-600">{actionError}</p>}

                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setActionModal(null)}
                      disabled={submittingAction}
                      className="px-3 py-1.5 text-xs h-auto rounded-full"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={submittingAction}
                      className="bg-ink-900 text-white hover:bg-ink-800 flex items-center gap-1.5 px-3 py-1.5 text-xs h-auto rounded-full"
                    >
                      <Send className="h-3 w-3" />
                      <span>{
                        submittingAction ? 'Sending...' : 
                        actionModal === 'send_offer' ? 'Send Quotation' :
                        actionModal === 'complete_work' ? 'Mark as Completed' :
                        actionModal === 'reply_details' ? 'Send Details' :
                        actionModal === 'request_details' ? 'Request Details' :
                        actionModal === 'request_correction' ? 'Request Revision' :
                        'Send Message'
                      }</span>
                    </Button>
                  </div>
                </form>
              ) : (
                /* Interactive action workflow buttons based on roles and current status */
                <div className="flex justify-center gap-3 flex-wrap">
                  
                  {/* Status: PENDING / DETAILS_REQUESTED (Provider's options) */}
                  {(inquiryDetail.status === 'pending' || inquiryDetail.status === 'details_requested') && Number(inquiryDetail.provider_id) === user.id && (
                    <>
                      <Button
                        onClick={() => setActionModal('request_details')}
                        variant="outline"
                        className="rounded-full px-5 text-xs font-bold border-blue-200 text-blue-700 hover:bg-blue-50"
                      >
                        Request Details
                      </Button>
                      <Button
                        onClick={() => setActionModal('send_offer')}
                        className="rounded-full bg-aura-600 text-white hover:bg-aura-700 px-5 text-xs font-bold shadow-md hover:-translate-y-0.5 transition-all"
                      >
                        Submit Quotation
                      </Button>
                    </>
                  )}

                  {/* Status: DETAILS_REQUESTED (Customer options) */}
                  {inquiryDetail.status === 'details_requested' && Number(inquiryDetail.customer_id) === user.id && (
                    <Button
                      onClick={() => setActionModal('reply_details')}
                      className="rounded-full bg-blue-600 text-white hover:bg-blue-700 px-5 text-xs font-bold shadow-md hover:-translate-y-0.5 transition-all"
                    >
                      Reply Details
                    </Button>
                  )}

                  {/* Status: OFFERED (Customer options) */}
                  {inquiryDetail.status === 'offered' && Number(inquiryDetail.customer_id) === user.id && (
                    <>
                      <Button
                        onClick={() => setActionModal('request_correction')}
                        variant="outline"
                        className="rounded-full px-5 text-xs font-bold border-red-200 text-red-700 hover:bg-red-50"
                      >
                        Request Revision
                      </Button>
                      <Button
                        onClick={() => handleDirectAction('accept')}
                        className="rounded-full bg-indigo-600 text-white hover:bg-indigo-700 px-5 text-xs font-bold shadow-md hover:-translate-y-0.5 transition-all"
                      >
                        Accept & Hire Provider
                      </Button>
                    </>
                  )}

                  {/* Status: ACCEPTED (Provider options) */}
                  {inquiryDetail.status === 'accepted' && Number(inquiryDetail.provider_id) === user.id && (
                    <Button
                      onClick={() => setActionModal('complete_work')}
                      className="rounded-full bg-teal-600 text-white hover:bg-teal-700 px-5 text-xs font-bold shadow-md hover:-translate-y-0.5 transition-all"
                    >
                      Mark Work Completed
                    </Button>
                  )}

                  {/* Status: WORK_COMPLETED (Customer options) */}
                  {inquiryDetail.status === 'work_completed' && Number(inquiryDetail.customer_id) === user.id && (
                    <Button
                      onClick={() => handleDirectAction('confirm')}
                      className="rounded-full bg-green-600 text-white hover:bg-green-700 px-5 text-xs font-bold shadow-md hover:-translate-y-0.5 transition-all animate-pulse"
                    >
                      Verify & Confirm Project Completion
                    </Button>
                  )}

                  {/* Status: COMPLETED (No further actions) */}
                  {inquiryDetail.status === 'completed' && (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-green-700">
                      <CheckCircle className="h-4.5 w-4.5" />
                      <span>This project is completed and stored as portfolio entry.</span>
                    </div>
                  )}

                </div>
              )}

            </div>
          </>
        )}
      </div>

      {confirmConfig && (
        <ConfirmModal
          isOpen={true}
          title={confirmConfig.title}
          message={confirmConfig.message}
          onConfirm={() => {
            confirmConfig.onConfirm();
            setConfirmConfig(null);
          }}
          onCancel={() => setConfirmConfig(null)}
        />
      )}

      {alertConfig && (
        <AlertModal
          isOpen={true}
          title={alertConfig.title}
          message={alertConfig.message}
          type={alertConfig.type}
          onClose={() => setAlertConfig(null)}
        />
      )}

      {isRescheduleModalOpen && inquiryDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-ink-150 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-ink-100 pb-3">
              <div>
                <h3 className="font-display text-base font-bold text-ink-900">Date Conflict Rescheduling</h3>
                <p className="text-[10px] text-ink-500 font-semibold uppercase tracking-wider mt-0.5">
                  Reschedule & Accept Offer
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsRescheduleModalOpen(false);
                  setRescheduleInquiryId(null);
                  setRescheduleDate('');
                }}
                className="text-xs font-bold text-ink-400 hover:text-ink-900 transition-colors"
              >
                Cancel
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 p-3.5 rounded-2xl font-bold flex items-start gap-2.5">
                <AlertCircle className="h-4.5 w-4.5 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  The originally selected date is fully booked or blocked by the contractor. 
                  Please choose another available date below to reschedule and complete the acceptance of this quotation.
                </span>
              </p>

              <AvailabilityCalendar
                providerId={Number(inquiryDetail.provider_id)}
                interactive={true}
                selectedDate={rescheduleDate}
                onDateSelect={setRescheduleDate}
              />

              <div className="flex justify-end gap-2.5 pt-2 border-t border-ink-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsRescheduleModalOpen(false);
                    setRescheduleInquiryId(null);
                    setRescheduleDate('');
                  }}
                  disabled={submittingReschedule}
                  className="rounded-full text-xs"
                >
                  Close
                </Button>
                <Button
                  type="button"
                  disabled={submittingReschedule || !rescheduleDate}
                  onClick={async () => {
                    if (!rescheduleInquiryId || !rescheduleDate) return;
                    setSubmittingReschedule(true);
                    try {
                      const endpoint = `/api/inquiries/${rescheduleInquiryId}/accept`;
                      await requestJson(endpoint, { new_booking_date: rescheduleDate });
                      setIsRescheduleModalOpen(false);
                      setRescheduleInquiryId(null);
                      setRescheduleDate('');
                      showAlert('Quotation Accepted', 'You have successfully rescheduled and accepted the quotation!', 'success');
                      await fetchInquiryDetail(rescheduleInquiryId);
                      await fetchInquiries();
                    } catch (err: any) {
                      showAlert('Reschedule Failed', err.message || 'Unable to reschedule.', 'error');
                    } finally {
                      setSubmittingReschedule(false);
                    }
                  }}
                  className="rounded-full bg-aura-600 hover:bg-aura-700 text-white text-xs font-bold"
                >
                  {submittingReschedule ? 'Processing...' : 'Reschedule & Accept'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
