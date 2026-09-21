# 4 Testing and Evaluation

## 4.1 Testing Approach
We applied several testing approaches:
- **Unit Testing**: Tested individual functions and components, such as email OTP verification code generation/expiry, password hashing, form inputs, and notification triggers.
- **Integration Testing**: Verified interactions between modules (e.g., customer submitting a pro application $\leftrightarrow$ admin panel displaying the request $\leftrightarrow$ approval generating a Stripe checkout link).
- **System Testing**: Ensured the entire platform worked as a whole, covering end-to-end user journeys from registration, dashboard navigation, to payment processing.
- **User Acceptance Testing (UAT)**: Simulated real-world usage by customers, service providers, product sellers, and platform administrators to validate usability, layout responsiveness, and role access constraints.

## 4.2 Test Cases and Result

### Test Scenario id: TS_ID_001
### Test Scenario: Customer Panel

| Test ID | Test Case | Preconditions | Test Steps | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| CUST001 | Register & OTP Verification | Customer not registered yet | 1. Open registration page<br>2. Enter valid details<br>3. Submit form | OTP code sent via Gmail SMTP & verified successfully | Pass |
| CUST002 | Login | Customer registered | 1. Open login page<br>2. Enter credentials<br>3. Click Login | Dashboard or Home page displayed with active session | Pass |
| CUST003 | Browse & Cart Management | Customer logged in | 1. Browse products<br>2. Add product to cart<br>3. View cart | Product added, cart shows correct items and price totals | Pass |
| CUST004 | Service Inquiry | Customer logged in | 1. Go to service listings<br>2. Select provider<br>3. Click "Inquire Now" and submit | Inquiry details saved, service provider notified | Pass |
| CUST005 | Order & Offer Payment | Order placed / Service offer accepted | 1. Open payment screen<br>2. Click pay with Stripe<br>3. Enter test card details | Stripe payment success, status updated to Paid | Pass |

*Table 1: Customer Test Case and Results*

---

### Test Scenario id: TS_ID_002
### Test Scenario: Service Provider Panel

| Test ID | Test Case | Preconditions | Test Steps | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| PROV001 | Apply as Pro (Service Provider) | Registered user logged in | 1. Open `/join-as-pro`<br>2. Select Service Provider<br>3. Enter details, upload document & choose plan | Application status set to pending | Pass |
| PROV002 | Set Listings & Availability | Provider approved by admin | 1. Open provider dashboard<br>2. Add service listing details<br>3. Set pricing & schedule | Listings published, availability calendar synchronized | Pass |
| PROV003 | Inquiry Estimate & Offer | Customer inquiry received | 1. View inquiry details<br>2. Enter estimate cost<br>3. Generate and send service offer | Offer sent, customer notified | Pass |
| PROV004 | Schedule & Confirm Work | Customer accepted offer | 1. Review accepted offer<br>2. Schedule & confirm slot | Scheduled work confirmed, calendar updated | Pass |
| PROV005 | Mark Job Complete & View Review | Service work completed | 1. Click mark as complete<br>2. Open reviews section | Status updated, customer feedback rating displayed | Pass |

*Table 2: Service Provider Test Case and Results*

---

### Test Scenario id: TS_ID_003
### Test Scenario: Product Seller Panel

| Test ID | Test Case | Preconditions | Test Steps | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| SELL001 | Apply as Pro (Product Seller) | Registered user logged in | 1. Open `/join-as-pro`<br>2. Select Product Seller<br>3. Fill business profile & submit | Application status set to pending | Pass |
| SELL002 | Product Listings Setup | Seller approved by admin | 1. Open seller dashboard<br>2. Enter product info & set stock<br>3. Click Publish | Product listing live on store | Pass |
| SELL003 | Inventory Management | Products listed | 1. Go to stock details<br>2. Modify inventory quantity | Catalog updated with new stock | Pass |
| SELL004 | Order Fulfillment | Customer placed product order | 1. Open order requests<br>2. Confirm & pack order<br>3. Dispatch & enter tracking info | Status updated to Shipped, customer notified | Pass |
| SELL005 | Sales & Review tracking | Orders completed | 1. View sales analytics dashboard<br>2. Check product review section | Revenue reports updated, ratings visible | Pass |

*Table 3: Product Seller Test Case and Results*

---

### Test Scenario id: TS_ID_004
### Test Scenario: Admin Panel

| Test ID | Test Case | Preconditions | Test Steps | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| ADM001 | Admin Login & Permissions | Admin email configured in backend `.env` | 1. Open `/auth`<br>2. Sign in with admin email | Redirection to Admin Panel `/admin` | Pass |
| ADM002 | Pro Application Review & Approval | Pending application exists | 1. Go to pending requests<br>2. Verify documents<br>3. Click Approve | Application approved, Stripe Checkout URL generated | Pass |
| ADM003 | User & Account Management | Admin logged in | 1. Open user management<br>2. Search/filter user accounts<br>3. View details or block user | Account details shown & actions applied | Pass |
| ADM004 | Moderation (Listings & Reviews) | Report/flag received | 1. View reported list<br>2. Approve or remove item | Mod actions updated in db immediately | Pass |
| ADM005 | Platform Revenue Monitoring | Subscriptions & payments active | 1. Open admin main dashboard<br>2. Review platform fees & metrics | Revenue/fee calculations displayed accurately | Pass |

*Table 4: Admin Test Case and Results*

---

## 4.3 Evaluation

- **Performance**: The system responded smoothly under concurrent user testing, with fast page load times using Vite on the frontend and lightweight PHP/PDO queries on the backend.
- **Security**: OTP email verification, secure session-based authentication, password hashing, and role-based access control (RBAC) ensured that user data and access are safe.
- **Usability**: The clean, responsive interface powered by React and Tailwind CSS worked seamlessly across desktop and mobile devices. Multi-step pro application and payment flows were intuitive and easy to navigate.
- **Reliability**: Precise database transactions, automated stock level updates, and robust webhook integration with Stripe ensured a highly reliable booking, checkout, and payment cycle with minimal errors.

Overall, testing confirmed that Nestora met its functional and non-functional requirements, providing a secure, efficient, and user-friendly platform.
