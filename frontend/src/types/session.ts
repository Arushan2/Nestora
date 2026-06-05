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
} | null;

export type User = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  created_at: string;
  application: SessionApplication;
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
  shipping_fee: number;
  stock_units: number;
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
  shipping_fee: number;
  stock_units: number;
  images?: string[];
};

export interface Favorite {
  id: number;
  product_id: number;
  title: string;
  price: number;
  unit_type: string;
  images: string[];
  category: string;
  brand: string | null;
}

export interface CartItem {
  id: number;
  product_id: number;
  quantity: number;
  title: string;
  price: number;
  unit_type: string;
  images: string[];
  seller_id: number;
  seller_business_name: string | null;
  shipping_fee?: number;
  shipping_districts?: string[];
}

export type OrderStatus = 'awaiting_verification' | 'processing' | 'shipped' | 'completed' | 'not_received';

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  title: string;
  price: number;
  quantity: number;
  images?: string[];
  reviewed?: boolean;
}

export interface Order {
  id: number;
  order_number: string;
  customer_id: number;
  seller_id: number;
  delivery_address: string;
  items_total: number;
  shipping_fee: number;
  total_cost: number;
  status: OrderStatus;
  receipt_url: string | null;
  courier_name: string | null;
  tracking_number: string | null;
  seller_note: string | null;
  created_at: string;
  updated_at: string;
  seller_name?: string;
  seller_business_name?: string | null;
  customer_name?: string;
  customer_email?: string;
  items?: OrderItem[];
}

export interface Review {
  id: number;
  order_id: number;
  product_id: number;
  customer_id: number;
  product_rating: number;
  seller_rating: number;
  comment: string | null;
  created_at: string;
  customer_name?: string;
}

