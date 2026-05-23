# Admin Email Permission Rule Added

## What Changed
- Removed the admin registration key flow from the app.
- Added `ADMIN_EMAIL` as the backend environment setting that grants admin permissions.
- Updated the backend so the configured email is promoted to admin on registration and login.
- Simplified the frontend signup form to remove the admin key controls.

## Why
- Admin access is easier to manage when it is tied to a single environment-based email address.
- This avoids sharing or validating a separate registration key in the UI.

## Files Updated
- backend/public/index.php
- backend/.env.example
- frontend/src/App.tsx
- README.md