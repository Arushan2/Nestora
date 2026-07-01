export type UserRole = 'user' | 'admin' | 'service_provider' | 'product_seller';

export type SessionApplication = {
  id: number;
  application_type: 'service_provider' | 'product_seller';
  business_name: string;
  status: 'pending' | 'approved' | 'rejected';
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  logo_url?: string | null;
  banner_url?: string | null;
  stripe_checkout_url?: string | null;
} | null;

export type User = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  created_at: string;
  application: SessionApplication;
  subscription_status?: string | null;
};

export type Profile = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  created_at: string;
  business_name: string | null;
  business_email: string | null;
  business_phone: string | null;
  business_address: string | null;
  business_city: string | null;
  business_description: string | null;
  logo_url: string | null;
  banner_url: string | null;
};

export type SessionResponse = {
  authenticated: boolean;
  user: User | null;
};

export type ProApplicationPayload = {
  applicationType: 'service_provider' | 'product_seller';
  businessName: string;
  businessEmail: string;
  businessPhone: string;
  businessAddress: string;
  businessCity: string;
  businessDescription: string;
  documentType: string;
  documentNumber: string;
  documentFile: string;
  selectedPlan?: string;
};

export type PendingApplication = {
  id: number;
  user_id: number;
  application_type: 'service_provider' | 'product_seller';
  business_name: string;
  business_email: string;
  business_phone: string;
  business_address: string;
  business_city: string;
  business_description: string;
  document_type: string;
  document_number: string;
  document_file: string;
  logo_url?: string | null;
  banner_url?: string | null;
  selected_plan?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  user_name: string;
  user_email: string;
  user_role: UserRole;
};

export type AdminUser = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  banned_until: string | null;
  ban_reason: string | null;
  created_at: string;
  application_id: number | null;
  application_type: 'service_provider' | 'product_seller' | null;
  business_name: string | null;
  application_status: 'pending' | 'approved' | 'rejected' | null;
};


export type PricingType = 'sqft' | 'daily_labor' | 'per_point' | 'linear_ft';

export type ServiceListing = {
  id: number;
  user_id: number;
  title: string;
  category: string;
  description: string;
  pricing_type: PricingType;
  price: number;
  price_details: string | null;
  cities: string[];
  images: string[];
  portfolio_ids?: number[] | null;
  portfolios?: Portfolio[] | null;
  created_at: string;
  updated_at: string;
  provider_name?: string;
  business_name?: string;
  business_email?: string;
  business_phone?: string;
  business_address?: string;
  business_city?: string;
  has_ongoing_inquiry?: boolean;
};

export type ServiceListingPayload = {
  title: string;
  category: string;
  description: string;
  pricing_type: PricingType;
  price: number;
  price_details: string;
  cities: string[];
  images?: string[];
  portfolio_ids?: number[];
};

export type ProductListing = {
  id: number;
  user_id: number;
  title: string;
  category: string;
  brand: string | null;
  description: string;
  price: number;
  unit_type: string;
  shipping_districts: string[];
  delivery_terms: string | null;
  unloading_provided: boolean;
  images: string[];
  shipping_fee?: number;
  stock_units?: number;
  has_expiry_date?: boolean;
  last_stock_checkpoint?: number;
  created_at: string;
  updated_at: string;
  seller_name?: string;
  business_name?: string;
  business_email?: string;
  business_phone?: string;
  business_address?: string;
  business_city?: string;
};

export type ProductListingPayload = {
  title: string;
  category: string;
  brand: string;
  description: string;
  price: number;
  unit_type: string;
  shipping_districts: string[];
  delivery_terms: string;
  unloading_provided: boolean;
  images?: string[];
  shipping_fee?: number;
  stock_units?: number;
  has_expiry_date?: boolean;
  expiry_date?: string;
};

export type InquiryStatus = 'pending' | 'details_requested' | 'offered' | 'accepted' | 'work_completed' | 'completed';

export type FollowupType =
  | 'inquiry_created'
  | 'details_requested'
  | 'details_replied'
  | 'offer_sent'
  | 'correction_requested'
  | 'offer_accepted'
  | 'work_completed'
  | 'completion_confirmed';

export interface Inquiry {
  id: number;
  service_id: number;
  customer_id: number;
  provider_id: number;
  status: InquiryStatus;
  booking_date?: string;
  created_at: string;
  updated_at: string;
  service_title: string;
  service_category: string;
  service_description?: string;
  customer_name: string;
  customer_email?: string;
  provider_name: string;
  provider_email?: string;
  survey_plan_url?: string;
}

export interface InquiryFollowup {
  id: number;
  inquiry_id: number;
  sender_id: number;
  type: FollowupType;
  content: string | null;
  quoted_price: number | null;
  images: string[] | null;
  created_at: string;
  sender_name: string;
  sender_role: UserRole;
}

export interface ContactInfo {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
}

export interface InquiryContacts {
  provider: ContactInfo;
  customer: ContactInfo;
}

export interface Portfolio {
  id: number;
  user_id: number;
  inquiry_id: number | null;
  title: string;
  category: string | null;
  description: string | null;
  images: string[];
  created_at: string;
}
