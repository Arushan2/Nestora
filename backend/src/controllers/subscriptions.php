<?php

declare(strict_types=1);

/**
 * POST /api/webhooks/stripe
 */
function handleStripeWebhook(): void
{
    $payload = @file_get_contents('php://input');
    $sigHeader = $_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '';
    $endpointSecret = env('STRIPE_WEBHOOK_SECRET');

    $event = null;

    try {
        if (!empty($endpointSecret) && !empty($sigHeader)) {
            \Stripe\Stripe::setApiKey(env('STRIPE_SECRET_KEY'));
            $event = \Stripe\Webhook::constructEvent(
                $payload, $sigHeader, $endpointSecret
            );
        } else {
            // Parse raw json if signature verification is bypassed for local development testing
            $data = json_decode($payload, true);
            if (is_array($data)) {
                $event = \Stripe\Event::constructFrom($data);
            }
        }
    } catch (\UnexpectedValueException $e) {
        jsonResponse(400, ['message' => 'Invalid payload.', 'error' => $e->getMessage()]);
    } catch (\Stripe\Exception\SignatureVerificationException $e) {
        jsonResponse(400, ['message' => 'Invalid signature.', 'error' => $e->getMessage()]);
    }

    if (!$event) {
        jsonResponse(400, ['message' => 'Event could not be parsed.']);
    }

    $db = database();

    switch ($event->type) {
        case 'checkout.session.completed':
            $session = $event->data->object;
            $userId = (int) ($session->metadata->user_id ?? 0);
            $subscriptionId = $session->subscription ?? null;
            $customerId = $session->customer ?? null;

            if ($userId > 0) {
                // Activate subscription and promote user to service_provider role
                $updateStmt = $db->prepare(
                    'UPDATE users 
                     SET stripe_customer_id = :cust_id, 
                         stripe_subscription_id = :sub_id, 
                         subscription_status = "active", 
                         role = "service_provider" 
                     WHERE id = :user_id'
                );
                $updateStmt->execute([
                    'cust_id' => $customerId,
                    'sub_id' => $subscriptionId,
                    'user_id' => $userId,
                ]);
            }
            break;

        case 'customer.subscription.updated':
            $subscription = $event->data->object;
            $subscriptionId = $subscription->id;
            $status = $subscription->status;

            $updateStmt = $db->prepare(
                'UPDATE users 
                 SET subscription_status = :status 
                 WHERE stripe_subscription_id = :sub_id'
            );
            $updateStmt->execute([
                'status' => $status,
                'sub_id' => $subscriptionId,
            ]);

            // Demote user if subscription becomes unpaid/canceled
            if (in_array($status, ['canceled', 'unpaid'], true)) {
                $demoteStmt = $db->prepare(
                    'UPDATE users 
                     SET role = "user" 
                     WHERE stripe_subscription_id = :sub_id'
                );
                $demoteStmt->execute([
                    'sub_id' => $subscriptionId,
                ]);
            }
            break;

        case 'customer.subscription.deleted':
            $subscription = $event->data->object;
            $subscriptionId = $subscription->id;

            $updateStmt = $db->prepare(
                'UPDATE users 
                 SET subscription_status = "canceled", 
                     role = "user" 
                 WHERE stripe_subscription_id = :sub_id'
            );
            $updateStmt->execute([
                'sub_id' => $subscriptionId,
            ]);
            break;
    }

    jsonResponse(200, ['status' => 'success']);
}

/**
 * POST /api/subscriptions/portal
 */
function createPortalSession(): void
{
    $user = currentUserOrFail();
    
    // Check if the user has a stripe customer id in the database
    // Fetch it directly from the database to be safe
    $stmt = database()->prepare('SELECT stripe_customer_id FROM users WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $user['id']]);
    $dbUser = $stmt->fetch();

    $customerId = $dbUser['stripe_customer_id'] ?? null;

    if (empty($customerId)) {
        jsonResponse(400, ['message' => 'No active Stripe billing information found.']);
    }

    $stripeSecretKey = env('STRIPE_SECRET_KEY');

    if (empty($stripeSecretKey)) {
        jsonResponse(500, ['message' => 'Stripe integration is not configured properly on the server.']);
    }

    try {
        \Stripe\Stripe::setApiKey($stripeSecretKey);
        $session = \Stripe\BillingPortal\Session::create([
            'customer' => $customerId,
            'return_url' => 'http://localhost:5173/profile',
        ]);

        jsonResponse(200, ['url' => $session->url]);
    } catch (Throwable $e) {
        jsonResponse(500, ['message' => 'Failed to create Stripe billing portal session.', 'details' => $e->getMessage()]);
    }
}
