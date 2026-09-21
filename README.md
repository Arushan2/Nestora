# Nestora Application Starter

Nestora is scaffolded here as a full-stack starter with a PHP backend, MySQL database, and a React + Vite frontend using shadcn-style components.

## Tech Stack
- Backend: PHP
- Database: MySQL
- Frontend: React (Vite) with shadcn/ui-style components

## Features
- Sign up and sign in flows
- Admin permissions granted automatically from a configured backend email
- Session-based authentication on the PHP backend
- Role-aware dashboard state on the frontend
- Home page at `/`, auth page at `/auth`, pro application at `/join-as-pro`, dashboard at `/dashboard`, and admin at `/admin`
- Three-step pro application flow with pending request approval

## Backend Setup
1. **Install dependencies**: Install Composer dependencies from the project root:
   ```bash
   composer install
   ```
2. **Environment configuration**: Copy `backend/.env.example` to `backend/.env` and fill in your MySQL credentials, Stripe keys, and Google Calendar details.
3. **Database schema**: Run `php backend/run-schema.php` from the project root to create the database tables.
4. **Start the server**: Start the API server:
   ```bash
   php -S 127.0.0.1:8000 backend/router.php
   ```

## Stripe Webhook Setup
To handle subscription, checkout, and payment events locally, set up the Stripe CLI webhook forwarding:
1. **Login to Stripe**:
   ```bash
   stripe login
   ```
2. **Start the webhook listener**: Forward events to your local backend server:
   ```bash
   stripe listen --forward-to http://127.0.0.1:8000/api/webhooks/stripe
   ```
3. **Save the webhook secret**: Copy the signing secret (`whsec_...`) printed in the terminal after running `stripe listen`, and add it to your `backend/.env` file:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_your_actual_secret_here
   ```

## PayHere Webhook & Payment Setup
Nestora uses PayHere for customer marketplace product purchases, automated stock deductions, and real-time payment notifications.

### 1. Local Development (Webhook Tunnel)
PayHere's cloud servers require a publicly accessible HTTPS endpoint to deliver payment callbacks (`notify_url`) to your machine.

1. **Start the PayHere webhook tunnel** in a separate terminal:
   ```bash
   npx localtunnel --port 8000 --subdomain nestora-dev-payhere
   ```
2. **Configure `backend/.env`**:
   Ensure `PAYHERE_NOTIFY_URL` matches your active tunnel subdomain:
   ```env
   PAYHERE_MODE=sandbox
   PAYHERE_MERCHANT_ID=1236337
   PAYHERE_MERCHANT_SECRET=NestoraprojectgroupCST07
   PAYHERE_NOTIFY_URL=https://nestora-dev-payhere.loca.lt/api/payhere/webhook
   ```
3. **PayHere Sandbox Testing**:
   - **Successful Payment (Visa)**: `4916 2175 0161 1292` (Expiry: any future date e.g. `12/28`, CVV: `123`)
   - **Declined Payment (Visa)**: `4929 7689 0083 7248` (Do Not Honor) or `4024 0071 9434 9121` (Insufficient Funds)
   - Real-time audit logs of incoming callbacks and verification statuses are saved to:
     ```text
     backend/logs/payhere_webhook.log
     ```

### 2. Production Deployment
When hosted on a public domain (e.g. `https://nestora.lk`), no tunnel is needed:
```env
PAYHERE_MODE=live
PAYHERE_MERCHANT_ID=your_live_merchant_id
PAYHERE_MERCHANT_SECRET=your_live_merchant_secret
PAYHERE_NOTIFY_URL=https://nestora.lk/api/payhere/webhook
```

## Frontend Setup
1. Navigate to the `frontend/` directory and install dependencies:
   ```bash
   cd frontend
   npm install
   ```
2. Start the Vite development server:
   ```bash
   npm run dev
   ```
3. The Vite dev server proxies `/api` requests to the PHP backend running on `http://127.0.0.1:8000`.

## Admin Registration
- Set `ADMIN_EMAIL` in `backend/.env`.
- When a user signs up with that email, the backend assigns admin permissions automatically.

## Pro Workflow
1. Sign in first if you are not already authenticated.
2. Open `Join as Pro` from the home page.
3. Choose Service Provider or Product Seller.
4. Fill in business details.
5. Add the business document and submit.
6. Admin reviews the request in `/admin` and approves it.
7. Approved service providers and product sellers are sent to `/dashboard`.

## Folder Structure
- Frontend route pages live under `frontend/src/pages`.
- Dashboard-related views should live under `frontend/src/pages/dashboard`.
- Backend bootstrap and controller files live under `backend/src`.

## Notes
- The backend is intentionally framework-light so it can run on plain PHP.
- The frontend uses shadcn-style component patterns and Tailwind CSS utility classes.