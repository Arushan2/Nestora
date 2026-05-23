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
1. Copy `backend/.env.example` to `backend/.env` and fill in your MySQL credentials.
2. Run `php backend/run-schema.php` from the project root to create the tables.
3. Start the API with `php -S 127.0.0.1:8000 backend/router.php` from the project root.

## Frontend Setup
1. Install dependencies inside `frontend`.
2. Start the app with `npm run dev`.
3. The Vite dev server proxies `/api` requests to the PHP backend.

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