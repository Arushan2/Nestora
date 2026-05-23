# Application Starter Scaffold Added

## What Changed
- Added a new full-stack starter for Nestora with a PHP backend and a React + Vite frontend.
- Added MySQL schema and backend auth routes for sign up, sign in, sign out, and session lookup.
- Added an admin registration option in the frontend and backend, controlled by a configurable registration key.
- Added shadcn-style UI primitives and a polished auth screen layout.
- Updated `.gitignore` for frontend and backend generated files.

## Why
- The workspace previously contained only documentation, so the application itself needed a real starting structure.
- The new scaffold gives a working base for authentication and future Nestora workflows.

## Files Added or Updated
- README.md
- .gitignore
- backend/.env.example
- backend/schema.sql
- backend/router.php
- backend/public/index.php
- frontend/package.json
- frontend/package-lock.json
- frontend/tsconfig.json
- frontend/tsconfig.node.json
- frontend/vite.config.ts
- frontend/index.html
- frontend/postcss.config.js
- frontend/tailwind.config.ts
- frontend/src/main.tsx
- frontend/src/index.css
- frontend/src/lib/utils.ts
- frontend/src/components/ui/button.tsx
- frontend/src/components/ui/input.tsx
- frontend/src/components/ui/label.tsx
- frontend/src/components/ui/card.tsx
- frontend/src/components/ui/tabs.tsx
- frontend/src/App.tsx