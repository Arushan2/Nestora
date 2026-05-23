# Schema Runner Creates Database

## What Changed
- Updated `backend/run-schema.php` so it creates the target MySQL database if it does not already exist.
- The helper now connects to the MySQL server first, creates the database, then runs `backend/schema.sql` inside that database.

## Why
- The previous version failed on a fresh machine when the configured database name did not already exist.
- This makes the local bootstrap flow work end to end with a single command.

## Files Updated
- backend/run-schema.php