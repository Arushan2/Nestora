export type UserRole = 'user' | 'admin' | 'service_provider' | 'product_seller';

export type SessionApplication = {
  id: number;
  application_type: 'service_provider' | 'product_seller';
  business_name: string;
  status: 'pending' | 'approved' | 'rejected';
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
} | null;

export type User = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  created_at: string;
  application: SessionApplication;
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
  status: 'pending' | 'approved' | 'rejected';
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  user_name: string;
  user_email: string;
  user_role: UserRole;
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
  created_at: string;
  updated_at: string;
  provider_name?: string;
  business_name?: string;
  business_email?: string;
  business_phone?: string;
  business_address?: string;
  business_city?: string;
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
};
