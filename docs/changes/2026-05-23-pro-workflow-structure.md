# Pro Workflow Structure Added

## What Changed
- Added route-based frontend pages for home, auth, join-as-pro, dashboard, and admin.
- Added a three-step pro application flow for service providers and product sellers.
- Added an admin approval screen for pending requests.
- Structured backend code into bootstrap and controller files under `backend/src`.

## Why
- The app needs a clear path from home to pro application, approval, and role-specific dashboards.
- Splitting the frontend and backend into dedicated folders keeps the codebase easier to extend.

## Files Added or Updated
- frontend/src/App.tsx
- frontend/src/pages/home/HomePage.tsx
- frontend/src/pages/auth/AuthPage.tsx
- frontend/src/pages/join-as-pro/JoinAsProPage.tsx
- frontend/src/pages/dashboard/DashboardPage.tsx
- frontend/src/pages/admin/AdminPage.tsx
- backend/src/bootstrap.php
- backend/src/controllers/auth.php
- backend/src/controllers/applications.php
- README.md