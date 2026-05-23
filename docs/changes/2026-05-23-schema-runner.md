# Schema Runner Added

## What Changed
- Added a PHP CLI helper at `backend/run-schema.php` to execute `backend/schema.sql`.
- Updated the backend setup instructions to use the helper instead of running the SQL manually.

## Why
- This makes database bootstrap repeatable and easier to run locally.
- It avoids manual copy/paste of the schema into a MySQL client for the initial setup.

## Files Added or Updated
- backend/run-schema.php
- README.md