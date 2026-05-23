# Nestora Application Starter

Nestora is scaffolded here as a full-stack starter with a PHP backend, MySQL database, and a React + Vite frontend using shadcn-style components.

## Tech Stack
- Backend: PHP
- Database: MySQL
- Frontend: React (Vite) with shadcn/ui-style components

## Features
- Sign up and sign in flows
- Admin registration option with a configurable admin key
- Session-based authentication on the PHP backend
- Role-aware dashboard state on the frontend

## Backend Setup
1. Copy `backend/.env.example` to `backend/.env` and fill in your MySQL credentials.
2. Run `php backend/run-schema.php` from the project root to create the tables.
3. Start the API with `php -S 127.0.0.1:8000 backend/router.php` from the project root.

## Frontend Setup
1. Install dependencies inside `frontend`.
2. Start the app with `npm run dev`.
3. The Vite dev server proxies `/api` requests to the PHP backend.

## Admin Registration
- Set `ADMIN_REGISTRATION_KEY` in `backend/.env`.
- When the sign-up form is switched to admin mode, the matching key must be provided.

## Notes
- The backend is intentionally framework-light so it can run on plain PHP.
- The frontend uses shadcn-style component patterns and Tailwind CSS utility classes.