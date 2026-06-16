CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('user', 'admin', 'service_provider', 'product_seller') NOT NULL DEFAULT 'user',
  banned_until TIMESTAMP NULL DEFAULT NULL,
  ban_reason VARCHAR(255) NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY users_email_unique (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pro_applications (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  application_type ENUM('service_provider', 'product_seller') NOT NULL,
  business_name VARCHAR(190) NOT NULL,
  business_email VARCHAR(190) NOT NULL,
  business_phone VARCHAR(60) NOT NULL,
  business_address VARCHAR(255) NOT NULL,
  business_city VARCHAR(120) NOT NULL,
  business_description TEXT NOT NULL,
  document_type VARCHAR(120) NOT NULL,
  document_number VARCHAR(190) NOT NULL,
  document_file VARCHAR(255) NOT NULL,
  logo_url VARCHAR(255) NULL,
  banner_url VARCHAR(255) NULL,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  review_note VARCHAR(255) NULL,
  reviewed_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY pro_applications_user_unique (user_id),
  CONSTRAINT pro_applications_user_id_foreign FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS email_verifications (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(190) NOT NULL,
  code VARCHAR(6) NOT NULL,
  purpose ENUM('signup', 'forgot_password') NOT NULL,
  payload TEXT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY email_verifications_email_purpose (email, purpose)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS service_listings (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  title VARCHAR(190) NOT NULL,
  category VARCHAR(120) NOT NULL,
  description TEXT NOT NULL,
  pricing_type ENUM('sqft', 'daily_labor', 'per_point', 'linear_ft') NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  price_details VARCHAR(255) NULL,
  cities TEXT NOT NULL,
  images TEXT NULL,
  portfolio_ids TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT service_listings_user_id_foreign FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_listings (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  title VARCHAR(190) NOT NULL,
  category VARCHAR(120) NOT NULL,
  brand VARCHAR(190) NULL,
  description TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  unit_type VARCHAR(50) NOT NULL,
  shipping_districts JSON NULL,
  delivery_terms VARCHAR(255) NULL,
  unloading_provided BOOLEAN NOT NULL DEFAULT 0,
  images JSON NULL,
  shipping_fee DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  stock_units INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT product_listings_user_id_foreign FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  order_id VARCHAR(50) NOT NULL,
  customer_id INT UNSIGNED NOT NULL,
  seller_id INT UNSIGNED NULL,
  delivery_address TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  payhere_payment_id VARCHAR(100) NULL,
  courier_name VARCHAR(120) NULL,
  tracking_number VARCHAR(120) NULL,
  seller_note VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (order_id),
  CONSTRAINT orders_customer_id_foreign FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT orders_seller_id_foreign FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id VARCHAR(50) NOT NULL,
  product_id INT UNSIGNED NOT NULL,
  title VARCHAR(190) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  quantity INT UNSIGNED NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT order_items_order_id_foreign FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  CONSTRAINT order_items_product_id_foreign FOREIGN KEY (product_id) REFERENCES product_listings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_reviews (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  rating TINYINT UNSIGNED NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT product_reviews_product_id_foreign FOREIGN KEY (product_id) REFERENCES product_listings(id) ON DELETE CASCADE,
  CONSTRAINT product_reviews_user_id_foreign FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS service_inquiries (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  service_id INT UNSIGNED NOT NULL,
  customer_id INT UNSIGNED NOT NULL,
  provider_id INT UNSIGNED NOT NULL,
  status ENUM('pending','details_requested','offered','accepted','work_completed','completed') NOT NULL DEFAULT 'pending',
  survey_plan_url VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT service_inquiries_service_id_foreign FOREIGN KEY (service_id) REFERENCES service_listings(id) ON DELETE CASCADE,
  CONSTRAINT service_inquiries_customer_id_foreign FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT service_inquiries_provider_id_foreign FOREIGN KEY (provider_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inquiry_followups (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  inquiry_id INT UNSIGNED NOT NULL,
  sender_id INT UNSIGNED NOT NULL,
  type ENUM('inquiry_created','details_requested','details_replied','offer_sent','correction_requested','offer_accepted','work_completed','completion_confirmed') NOT NULL,
  content TEXT NULL,
  quoted_price DECIMAL(10,2) NULL,
  images TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT inquiry_followups_inquiry_id_foreign FOREIGN KEY (inquiry_id) REFERENCES service_inquiries(id) ON DELETE CASCADE,
  CONSTRAINT inquiry_followups_sender_id_foreign FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS portfolios (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  inquiry_id INT UNSIGNED NULL,
  title VARCHAR(190) NOT NULL,
  category VARCHAR(120) NULL,
  description TEXT NULL,
  images TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT portfolios_user_id_foreign FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT portfolios_inquiry_id_foreign FOREIGN KEY (inquiry_id) REFERENCES service_inquiries(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
