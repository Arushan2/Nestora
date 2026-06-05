# Nestora - Stripe Subscription Integration Guide

This document contains everything you need to know about how we are planning to integrate Stripe subscriptions into Nestora, what to do on the Stripe website, and how to connect it to our code.

---

## 1. The Integration Plan (How it Works)

We are implementing the **Review then Pay** onboarding flow for Service Providers:

1. **Apply (Steps 1-3)**: The user signs up as a pro, fills out business details, and uploads their registration document.
2. **Select Plan (Step 4)**: The user selects their preferred subscription plan (e.g., Monthly or Yearly) and submits their application. The application goes into `pending` status. **No payment is taken yet.**
3. **Admin Review**: The Admin reviews the application.
4. **Approval & Email**: If the Admin approves, the backend changes the application status to `approved` and sends an email to the user with a payment link.
5. **Stripe Checkout**: The user clicks the link, which opens a secure checkout page hosted by Stripe. They enter their credit card info and subscribe.
6. **Webhook Activation**: Once payment succeeds, Stripe notifies our PHP backend. Our backend updates the user's subscription to `active` and upgrades their account role to `service_provider`.

---

## 2. What to do on the Stripe Website (Dashboard Setup)

You need to set up your Stripe account in **Test Mode** (sandbox environment) and retrieve the API Keys and Price IDs.

### A. Account Creation
1. Go to [Stripe Register](https://dashboard.stripe.com/register) and create an account.
2. Verify your email.
3. Toggle the **"Test mode"** switch in the top-right corner to **ON**.

### B. Retrieve API Keys
1. Navigate to **Developers** > **API keys**.
2. Copy the **Publishable key** (starts with `pk_test_...`).
3. Click **Reveal test key** and copy the **Secret key** (starts with `sk_test_...`).

### C. Create Subscription Plans (Products)
1. Go to **Product catalog** > click **Add product**.
2. Create your first plan (e.g., *Nestora Pro Monthly*):
   * **Pricing**: Select **Recurring** -> **Monthly** -> Set amount (e.g., $15.00).
   * Click **Save product**.
3. Under the Pricing section of the product you just created, copy the **Price ID** (starts with `price_...`).
4. (Optional) Create a yearly plan (e.g., *Nestora Pro Yearly*, recurring annually) and copy its **Price ID**.

---

## 3. How Stripe Connects with Our Code

```
+------------------+                   +--------------------+
|  React Frontend  |                   |    Stripe Hosted   |
| (Selected Plan)  |                   |    Checkout Page   |
+--------+---------+                   +---------+----------+
         |                                       ^
         | 1. Request Payment Link               | 3. Redirect User
         v                                       |
+--------+---------+  2. Create Session   +------+----------+
|   PHP Backend    +--------------------->|   Stripe APIs   |
|  (router.php)    |                      +------+----------+
+--------+---------+                             |
         ^                                       | 4. Notify Payment
         |                                       v    (Webhook)
         +---------------------------------------+
```

We connect Stripe to our code using:
1. **Stripe PHP SDK**: Installed on the backend via Composer. It uses the `Secret Key` to request checkout sessions from Stripe.
2. **Environment Variables**: Stores keys and Price IDs securely in `backend/.env`.
3. **Webhook Endpoint**: A special URL on our PHP backend (`/api/webhooks/stripe`) that Stripe will send a secure POST request to whenever a subscription is paid or cancelled.

---

## 4. What We Need to Do in Our Code

Here is the code checklist we will follow when we are ready to implement:

### Database (MySQL)
* Add columns to `users` to track:
  * `stripe_customer_id` (Stripe's identifier for this user)
  * `stripe_subscription_id` (Stripe's identifier for this subscription)
  * `subscription_status` (e.g., `active`, `past_due`, `canceled`)
  * `subscription_plan` (e.g., `monthly_basic`, `yearly_premium`)
* Add a column to `pro_applications` to track:
  * `selected_plan` (the plan selected during Step 4)

### Backend (PHP)
1. Install Stripe PHP package: `composer require stripe/stripe-php`.
2. Configure `.env` with Stripe keys and Plan Price IDs.
3. Update `createProApplication()` to save the user's `selected_plan`.
4. Update `approveApplication()` to include the Stripe checkout session generation or link email.
5. Create a new file `backend/src/controllers/subscriptions.php` with:
   * `createCheckoutSession()`: Generates the checkout link using Stripe's API.
   * `handleStripeWebhook()`: Receives payment success events from Stripe and updates the user's role and status in the database.
6. Register the endpoints in `backend/router.php`.

### Frontend (React)
1. Modify `JoinAsProPage.tsx` to include Step 4 (Pricing plans choice).
2. Save the selected plan to the application form.
3. Build a success page (`JoinAsProSuccessPage.tsx`) that the user sees when returning from Stripe.
