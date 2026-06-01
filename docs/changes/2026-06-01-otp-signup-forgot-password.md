# Email OTP Verification for Signup and Forgot Password Added

## What Changed
- Added `email_verifications` table in `schema.sql`, `bootstrap.php` (auto-migrations), and `run-schema.php` to securely store 6-digit OTP codes, purposes, JSON payload data, and 10-minute expiry timestamps.
- Added `backend/src/lib/mail.php` containing a PHPMailer-based utility function configured for Gmail SMTP with styled, responsive HTML email templates for signup and forgot password flows.
- Optimized SMTP connectivity by resolving the `smtp.gmail.com` hostname directly to IPv4 to prevent connection timeouts and lags (common under local and macOS routing environments).
- Rewrote the backend `authRegister()` to send a registration verification OTP code instead of immediately saving the user in the database.
- Implemented three new backend routes:
  - `POST /api/auth/verify-otp` to verify the signup code, create the user, and establish the session.
  - `POST /api/auth/forgot-password` to check database presence, generate an OTP, and dispatch the reset email.
  - `POST /api/auth/reset-password` to verify the code and safely update the user's password.
- Rewrote frontend `AuthPage.tsx` using Tailwind CSS and React states to implement a multi-view flow supporting email forgot-password prompts and a beautiful individual-character input block for entering 6-digit OTPs.
- Adjusted frontend `App.tsx`'s `handleSignUp` action to refresh session data on the frontend since the verification route already handles database creation.

## Why
- Enhances application security by verifying the email address is owned by the user before creating an account or resetting a forgotten password.
- Providing a synchronous, highly optimized Gmail SMTP connection prevents the page from shifting into the OTP entering view before the email is successfully dispatched by Gmail, ensuring reliable client-side synchronization and robust UX.

## Files Updated
- backend/schema.sql
- backend/src/bootstrap.php
- backend/run-schema.php
- backend/src/lib/mail.php
- backend/src/controllers/auth.php
- backend/public/index.php
- backend/.env
- backend/.env.example
- frontend/src/pages/auth/AuthPage.tsx
- frontend/src/App.tsx
