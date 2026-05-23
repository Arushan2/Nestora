# Home and Auth Routes Added

## What Changed
- Moved the login form to `/auth`.
- Made `/` the home page with the app details and a top `Join as Pro` action.
- Added automatic redirect to `/` after successful login.
- Simplified the auth screen so it only shows the login form.

## Why
- The root page should act like a home/landing page for the app.
- The auth page should stay focused and avoid extra frontend content.

## Files Updated
- frontend/package.json
- frontend/src/main.tsx
- frontend/src/App.tsx
- README.md