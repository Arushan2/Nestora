# Change Log: PayHere Automated Payment Gateway Integration

## What Changed
- Replaced the manual bank receipt upload form on the checkout page with the secure, automated PayHere Payment Gateway.
- Added dynamic script injection for the official PayHere JS SDK.
- Implemented a payment initiation script on the backend (`payhere_initiate.php`) to validate cart totals, generate cryptographic signatures (MD5 hashes), and create pending orders in the database.
- Created an automated background webhook listener script (`payhere_webhook.php`) to securely verify PayHere's transaction responses and auto-promote orders from `PENDING` to `COMPLETED` upon success.
- Modified the MySQL `orders` table to replace the old manual bank transfer image paths (`receipt_url`) with a string-based primary key `order_id` and a nullable `payhere_payment_id` column.
- Updated customer and seller order history views to display automated PayHere payment credentials (transaction IDs) in place of raw image slip download links.

## Why
Transitioning from manual verification of bank transfer slips to an automated payment gateway improves security, eliminates administrative verification delays, reduces transaction fraud risks, and provides a modern, seamless native user checkout experience.

## Files Updated
- [bootstrap.php](file:///e:/projects/Nestora/backend/src/bootstrap.php)
- [schema.sql](file:///e:/projects/Nestora/backend/schema.sql)
- [payhere_initiate.php](file:///e:/projects/Nestora/backend/public/payhere_initiate.php)
- [payhere_webhook.php](file:///e:/projects/Nestora/backend/public/payhere_webhook.php)
- [index.php](file:///e:/projects/Nestora/backend/public/index.php)
- [orders.php](file:///e:/projects/Nestora/backend/src/controllers/orders.php)
- [CheckoutPage.tsx](file:///e:/projects/Nestora/frontend/src/pages/home/CheckoutPage.tsx)
- [OrdersPage.tsx (Customer)](file:///e:/projects/Nestora/frontend/src/pages/home/OrdersPage.tsx)
- [OrdersPage.tsx (Seller)](file:///e:/projects/Nestora/frontend/src/pages/dashboard/product-seller/OrdersPage.tsx)
