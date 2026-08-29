<?php

declare(strict_types=1);

/**
 * POST /api/webhooks/stripe
 *
 * Handles all Stripe webhook events for the Service Provider membership lifecycle:
 * - checkout.session.completed     → Activate trial (trial_active)
 * - customer.subscription.updated  → Sync cancellation status, send trial reminders
 * - customer.subscription.deleted  → Cancel/expire membership
 * - invoice.paid                   → Convert trial to active, renew annual
 * - invoice.payment_failed         → Payment failure state
 * - customer.subscription.trial_will_end → 3-day reminder email
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

        // ---------------------------------------------------------------
        // Trial activation: provider completes Stripe Checkout
        // ---------------------------------------------------------------
        case 'checkout.session.completed':
            $session = $event->data->object;
            $userId = (int) ($session->metadata->user_id ?? 0);
            $subscriptionId = $session->subscription ?? null;
            $customerId = $session->customer ?? null;

            if ($userId > 0 && $subscriptionId) {
                // Fetch the subscription to get trial dates
                \Stripe\Stripe::setApiKey(env('STRIPE_SECRET_KEY'));
                try {
                    $sub = \Stripe\Subscription::retrieve($subscriptionId);
                    $trialStart = $sub->trial_start ? date('Y-m-d H:i:s', $sub->trial_start) : date('Y-m-d H:i:s');
                    $trialEnd = $sub->trial_end ? date('Y-m-d H:i:s', $sub->trial_end) : date('Y-m-d H:i:s', strtotime('+30 days'));
                    $periodEnd = $sub->current_period_end ? date('Y-m-d H:i:s', $sub->current_period_end) : $trialEnd;
                } catch (Throwable $e) {
                    $trialStart = date('Y-m-d H:i:s');
                    $trialEnd = date('Y-m-d H:i:s', strtotime('+30 days'));
                    $periodEnd = $trialEnd;
                }

                $updateStmt = $db->prepare(
                    'UPDATE users
                     SET stripe_customer_id = :cust_id,
                         stripe_subscription_id = :sub_id,
                         subscription_status = "trialing",
                         membership_status = "trial_active",
                         trial_started_at = :trial_start,
                         trial_ends_at = :trial_end,
                         subscription_ends_at = :period_end,
                         cancel_at_period_end = 0,
                         role = "service_provider"
                     WHERE id = :user_id'
                );
                $updateStmt->execute([
                    'cust_id' => $customerId,
                    'sub_id' => $subscriptionId,
                    'trial_start' => $trialStart,
                    'trial_end' => $trialEnd,
                    'period_end' => $periodEnd,
                    'user_id' => $userId,
                ]);

                // Send trial activation confirmation email
                _sendTrialActivatedEmail($userId, $trialEnd);
            }
            break;

        // ---------------------------------------------------------------
        // Subscription updated: sync cancel_at_period_end, status changes
        // ---------------------------------------------------------------
        case 'customer.subscription.updated':
            $subscription = $event->data->object;
            $subscriptionId = $subscription->id;
            $status = $subscription->status; // trialing, active, past_due, canceled, unpaid
            $cancelAtPeriodEnd = (bool) ($subscription->cancel_at_period_end ?? false);
            $periodEnd = $subscription->current_period_end
                ? date('Y-m-d H:i:s', $subscription->current_period_end)
                : null;

            // Determine business membership_status from Stripe status
            $membershipStatus = _mapStripeToBusiness($status, $cancelAtPeriodEnd);

            $updateStmt = $db->prepare(
                'UPDATE users
                 SET subscription_status = :status,
                     membership_status = :membership_status,
                     cancel_at_period_end = :cancel_at,
                     subscription_ends_at = :period_end
                 WHERE stripe_subscription_id = :sub_id'
            );
            $updateStmt->execute([
                'status' => $status,
                'membership_status' => $membershipStatus,
                'cancel_at' => $cancelAtPeriodEnd ? 1 : 0,
                'period_end' => $periodEnd,
                'sub_id' => $subscriptionId,
            ]);

            // If subscription became past_due or unpaid — keep role for grace period
            // If fully canceled or unpaid beyond grace: demote handled by subscription.deleted

            // Check if we need to send trial reminder emails (7-day, 1-day)
            _checkAndSendTrialReminders($subscriptionId, $subscription);
            break;

        // ---------------------------------------------------------------
        // Subscription deleted: membership cancelled/expired
        // ---------------------------------------------------------------
        case 'customer.subscription.deleted':
            $subscription = $event->data->object;
            $subscriptionId = $subscription->id;
            $canceledAt = $subscription->canceled_at
                ? date('Y-m-d H:i:s', $subscription->canceled_at)
                : date('Y-m-d H:i:s');

            // Look up the user
            $userStmt = $db->prepare('SELECT id, email, name, trial_ends_at FROM users WHERE stripe_subscription_id = :sub_id LIMIT 1');
            $userStmt->execute(['sub_id' => $subscriptionId]);
            $affectedUser = $userStmt->fetch();

            $updateStmt = $db->prepare(
                'UPDATE users
                 SET subscription_status = "canceled",
                     membership_status = "cancelled",
                     cancel_at_period_end = 0,
                     role = "user"
                 WHERE stripe_subscription_id = :sub_id'
            );
            $updateStmt->execute(['sub_id' => $subscriptionId]);

            // Send cancellation confirmed email if we have user data
            if (is_array($affectedUser)) {
                _sendCancellationEmail((int) $affectedUser['id']);
            }
            break;

        // ---------------------------------------------------------------
        // Invoice paid: trial converted to active subscription
        // ---------------------------------------------------------------
        case 'invoice.paid':
            $invoice = $event->data->object;
            $subscriptionId = $invoice->subscription ?? null;
            $billingReason = $invoice->billing_reason ?? '';

            if (!$subscriptionId) {
                break;
            }

            // Only care about subscription cycles (not manual invoices)
            if (!in_array($billingReason, ['subscription_cycle', 'subscription_update', 'subscription_threshold', 'subscription_create'], true)) {
                break;
            }

            // Fetch subscription for period dates
            \Stripe\Stripe::setApiKey(env('STRIPE_SECRET_KEY'));
            try {
                $sub = \Stripe\Subscription::retrieve($subscriptionId);
                $periodStart = $sub->current_period_start ? date('Y-m-d H:i:s', $sub->current_period_start) : date('Y-m-d H:i:s');
                $periodEnd = $sub->current_period_end ? date('Y-m-d H:i:s', $sub->current_period_end) : date('Y-m-d H:i:s', strtotime('+1 year'));
            } catch (Throwable $e) {
                $periodStart = date('Y-m-d H:i:s');
                $periodEnd = date('Y-m-d H:i:s', strtotime('+1 year'));
            }

            // Check current membership_status to determine if this is trial→active conversion
            $userStmt = $db->prepare('SELECT id, membership_status FROM users WHERE stripe_subscription_id = :sub_id LIMIT 1');
            $userStmt->execute(['sub_id' => $subscriptionId]);
            $affectedUser = $userStmt->fetch();

            $wasTrialing = is_array($affectedUser) && $affectedUser['membership_status'] === 'trial_active';

            $updateStmt = $db->prepare(
                'UPDATE users
                 SET subscription_status = "active",
                     membership_status = "active",
                     subscription_started_at = :period_start,
                     subscription_ends_at = :period_end,
                     last_payment_status = "paid",
                     cancel_at_period_end = 0,
                     role = "service_provider"
                 WHERE stripe_subscription_id = :sub_id'
            );
            $updateStmt->execute([
                'period_start' => $periodStart,
                'period_end' => $periodEnd,
                'sub_id' => $subscriptionId,
            ]);

            // Send membership active email
            if (is_array($affectedUser)) {
                _sendMembershipActiveEmail((int) $affectedUser['id'], $periodEnd, $wasTrialing);
            }
            break;

        // ---------------------------------------------------------------
        // Invoice payment failed: enter payment_failed state
        // ---------------------------------------------------------------
        case 'invoice.payment_failed':
            $invoice = $event->data->object;
            $subscriptionId = $invoice->subscription ?? null;

            if (!$subscriptionId) {
                break;
            }

            $userStmt = $db->prepare('SELECT id FROM users WHERE stripe_subscription_id = :sub_id LIMIT 1');
            $userStmt->execute(['sub_id' => $subscriptionId]);
            $affectedUser = $userStmt->fetch();

            $updateStmt = $db->prepare(
                'UPDATE users
                 SET subscription_status = "past_due",
                     membership_status = "payment_failed",
                     last_payment_status = "failed"
                 WHERE stripe_subscription_id = :sub_id'
            );
            $updateStmt->execute(['sub_id' => $subscriptionId]);

            // Send payment failure email
            if (is_array($affectedUser)) {
                _sendPaymentFailedEmail((int) $affectedUser['id']);
            }
            break;

        // ---------------------------------------------------------------
        // Trial will end: send 3-day reminder (Stripe fires this 3 days before)
        // ---------------------------------------------------------------
        case 'customer.subscription.trial_will_end':
            $subscription = $event->data->object;
            $subscriptionId = $subscription->id;
            $trialEnd = $subscription->trial_end
                ? date('Y-m-d H:i:s', $subscription->trial_end)
                : null;

            // Find user and check if 3-day reminder already sent (bit 2 of trial_reminder_sent)
            $userStmt = $db->prepare('SELECT id, trial_reminder_sent FROM users WHERE stripe_subscription_id = :sub_id LIMIT 1');
            $userStmt->execute(['sub_id' => $subscriptionId]);
            $affectedUser = $userStmt->fetch();

            if (is_array($affectedUser) && $trialEnd) {
                $reminderSent = (int) ($affectedUser['trial_reminder_sent'] ?? 0);
                if (!($reminderSent & 2)) { // bit 2 = 3-day reminder
                    _sendTrialReminderEmail((int) $affectedUser['id'], 3, $trialEnd);
                    $db->prepare('UPDATE users SET trial_reminder_sent = trial_reminder_sent | 2 WHERE id = :id')
                        ->execute(['id' => $affectedUser['id']]);
                }
            }
            break;
    }

    jsonResponse(200, ['status' => 'success']);
}

/**
 * GET /api/subscriptions/membership
 * Returns current membership details for the dashboard display.
 */
function getMembershipStatus(): void
{
    $user = currentUserOrFail();

    $stmt = database()->prepare(
        'SELECT stripe_customer_id, stripe_subscription_id, subscription_status, membership_status,
                trial_started_at, trial_ends_at, subscription_started_at, subscription_ends_at,
                cancel_at_period_end, last_payment_status
         FROM users WHERE id = :id LIMIT 1'
    );
    $stmt->execute(['id' => $user['id']]);
    $data = $stmt->fetch();

    if (!is_array($data)) {
        jsonResponse(404, ['message' => 'User not found.']);
    }

    // Calculate days remaining in trial
    $trialDaysRemaining = null;
    if (!empty($data['trial_ends_at'])) {
        $trialEndsTs = strtotime($data['trial_ends_at']);
        $now = time();
        $trialDaysRemaining = max(0, (int) ceil(($trialEndsTs - $now) / 86400));
    }

    // Trigger check for 7-day and 1-day reminders if trial is active
    if (($data['membership_status'] ?? '') === 'trial_active' && !empty($data['trial_ends_at'])) {
        _checkAndSendTrialRemindersByDate(
            (int) $user['id'],
            $data['trial_ends_at'],
            (int) ($data['trial_reminder_sent'] ?? 0)
        );
    }

    jsonResponse(200, [
        'membership_status' => $data['membership_status'] ?? 'not_started',
        'subscription_status' => $data['subscription_status'] ?? 'inactive',
        'trial_started_at' => $data['trial_started_at'],
        'trial_ends_at' => $data['trial_ends_at'],
        'trial_days_remaining' => $trialDaysRemaining,
        'subscription_started_at' => $data['subscription_started_at'],
        'subscription_ends_at' => $data['subscription_ends_at'],
        'cancel_at_period_end' => (bool) ($data['cancel_at_period_end'] ?? false),
        'last_payment_status' => $data['last_payment_status'],
        'has_stripe_customer' => !empty($data['stripe_customer_id']),
    ]);
}

/**
 * POST /api/subscriptions/portal
 * Redirects to Stripe Customer Portal for subscription management.
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

    $appUrl = rtrim((string) env('APP_URL', 'http://localhost:5173'), '/');

    try {
        \Stripe\Stripe::setApiKey($stripeSecretKey);
        $session = \Stripe\BillingPortal\Session::create([
            'customer' => $customerId,
            'return_url' => $appUrl . '/dashboard?tab=billing',
        ]);

        jsonResponse(200, ['url' => $session->url]);
    } catch (Throwable $e) {
        jsonResponse(500, ['message' => 'Failed to create Stripe billing portal session.', 'details' => $e->getMessage()]);
    }
}

// ---------------------------------------------------------------
// Private helper functions
// ---------------------------------------------------------------

/**
 * Map Stripe subscription status + cancel_at_period_end to our membership_status.
 */
function _mapStripeToBusiness(string $stripeStatus, bool $cancelAtPeriodEnd): string
{
    switch ($stripeStatus) {
        case 'trialing':
            return $cancelAtPeriodEnd ? 'trial_active' : 'trial_active'; // cancel flag shown separately
        case 'active':
            return 'active';
        case 'past_due':
            return 'payment_failed';
        case 'unpaid':
            return 'payment_failed';
        case 'canceled':
            return 'cancelled';
        case 'incomplete':
        case 'incomplete_expired':
            return 'not_started';
        default:
            return 'not_started';
    }
}

/**
 * Check subscription object and send 7-day or 1-day reminders if not yet sent.
 */
function _checkAndSendTrialReminders(string $subscriptionId, object $subscription): void
{
    if (!isset($subscription->trial_end)) {
        return;
    }

    $trialEnd = date('Y-m-d H:i:s', $subscription->trial_end);
    $db = database();
    $userStmt = $db->prepare('SELECT id, membership_status, trial_reminder_sent FROM users WHERE stripe_subscription_id = :sub_id LIMIT 1');
    $userStmt->execute(['sub_id' => $subscriptionId]);
    $affectedUser = $userStmt->fetch();

    if (!is_array($affectedUser) || ($affectedUser['membership_status'] ?? '') !== 'trial_active') {
        return;
    }

    _checkAndSendTrialRemindersByDate(
        (int) $affectedUser['id'],
        $trialEnd,
        (int) ($affectedUser['trial_reminder_sent'] ?? 0)
    );
}

/**
 * Check days until trial end and send 7-day or 1-day reminder emails.
 */
function _checkAndSendTrialRemindersByDate(int $userId, string $trialEnd, int $reminderSentBitmask): void
{
    $db = database();
    $trialEndsTs = strtotime($trialEnd);
    $now = time();
    $daysLeft = (int) ceil(($trialEndsTs - $now) / 86400);

    // 7-day reminder (bit 1)
    if ($daysLeft <= 7 && $daysLeft > 3 && !($reminderSentBitmask & 1)) {
        _sendTrialReminderEmail($userId, 7, $trialEnd);
        $db->prepare('UPDATE users SET trial_reminder_sent = trial_reminder_sent | 1 WHERE id = :id')
            ->execute(['id' => $userId]);
    }

    // 1-day reminder (bit 4)
    if ($daysLeft <= 1 && $daysLeft >= 0 && !($reminderSentBitmask & 4)) {
        _sendTrialReminderEmail($userId, 1, $trialEnd);
        $db->prepare('UPDATE users SET trial_reminder_sent = trial_reminder_sent | 4 WHERE id = :id')
            ->execute(['id' => $userId]);
    }
}

/**
 * Send trial activated confirmation email.
 */
function _sendTrialActivatedEmail(int $userId, string $trialEnd): void
{
    try {
        require_once __DIR__ . '/../lib/mail.php';
        $db = database();
        $stmt = $db->prepare('SELECT name, email FROM users WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $userId]);
        $u = $stmt->fetch();
        if (!is_array($u)) return;

        $appUrl = rtrim((string) env('APP_URL', 'http://localhost:5173'), '/');
        $trialEndFormatted = date('F j, Y', strtotime($trialEnd));
        $userName = htmlspecialchars($u['name']);
        $subject = 'Your 30-Day Free Trial is Now Active — Nestora';
        $body = <<<HTML
<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}
</style></head><body>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:48px 16px;">
<tr><td align="center">
<table width="100%" style="max-width:520px;background:#fff;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;">
<tr><td height="6" style="background:linear-gradient(90deg,#06b6d4 0%,#f97316 100%);line-height:6px;font-size:1px;">&nbsp;</td></tr>
<tr><td style="padding:40px;">
<p style="margin:0 0 20px;font-size:24px;font-weight:700;color:#0f172a;">Nestora<span style="color:#06b6d4;">.</span></p>
<h1 style="margin:0 0 16px;color:#0f172a;font-size:21px;">Your Free Trial is Active! 🎉</h1>
<p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.7;">Hi {$userName},</p>
<p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.7;">Your 30-day free trial has started. You now have full Service Provider access on Nestora. Create listings, receive inquiries, and build your profile.</p>
<table width="100%" style="margin-bottom:24px;"><tr>
<td style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:12px;padding:16px 20px;">
<p style="margin:0 0 4px;color:#0f172a;font-size:13px;font-weight:600;">Trial ends on</p>
<p style="margin:0;color:#059669;font-size:18px;font-weight:700;">{$trialEndFormatted}</p>
<p style="margin:8px 0 0;color:#64748b;font-size:12px;">After your trial: $29.99/year &bull; Cancel any time before to avoid charge</p>
</td></tr></table>
<table cellpadding="0" cellspacing="0" style="margin:0 auto 20px;">
<tr><td align="center" style="border-radius:12px;background:#06b6d4;">
<a href="{$appUrl}/dashboard" style="display:inline-block;padding:14px 32px;color:#fff;font-size:15px;font-weight:700;text-decoration:none;border-radius:12px;">Go to Dashboard &rarr;</a>
</td></tr></table>
<p style="margin:0;color:#64748b;font-size:12px;line-height:1.6;border-top:1px solid #e2e8f0;padding-top:16px;">Your saved payment method will be charged $29.99 USD on {$trialEndFormatted} unless you cancel before then.</p>
</td></tr>
<tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;">
<p style="margin:0;color:#94a3b8;font-size:11px;">&copy; 2026 Nestora. All rights reserved.</p>
</td></tr>
</table></td></tr></table></body></html>
HTML;
        sendMail($u['email'], $subject, $body);
    } catch (Throwable $e) {
        error_log('Trial activation email error: ' . $e->getMessage());
    }
}

/**
 * Send trial reminder email (7, 3, or 1 day before end).
 */
function _sendTrialReminderEmail(int $userId, int $daysLeft, string $trialEnd): void
{
    try {
        require_once __DIR__ . '/../lib/mail.php';
        $db = database();
        $stmt = $db->prepare('SELECT name, email FROM users WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $userId]);
        $u = $stmt->fetch();
        if (!is_array($u)) return;

        $appUrl = rtrim((string) env('APP_URL', 'http://localhost:5173'), '/');
        $trialEndFormatted = date('F j, Y', strtotime($trialEnd));
        $userName = htmlspecialchars($u['name']);
        $dayWord = $daysLeft === 1 ? 'day' : 'days';
        $subject = "Your Nestora free trial ends in {$daysLeft} {$dayWord}";
        $body = <<<HTML
<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:48px 16px;">
<tr><td align="center">
<table width="100%" style="max-width:520px;background:#fff;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;">
<tr><td height="6" style="background:linear-gradient(90deg,#06b6d4 0%,#f97316 100%);line-height:6px;font-size:1px;">&nbsp;</td></tr>
<tr><td style="padding:40px;">
<p style="margin:0 0 20px;font-size:24px;font-weight:700;color:#0f172a;">Nestora<span style="color:#06b6d4;">.</span></p>
<h1 style="margin:0 0 16px;color:#0f172a;font-size:21px;">Your free trial ends in {$daysLeft} {$dayWord}</h1>
<p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.7;">Hi {$userName},</p>
<p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.7;">Your Service Provider free trial on Nestora ends on <strong>{$trialEndFormatted}</strong>. Your Annual Service Provider Membership will automatically begin at <strong>$29.99 USD/year</strong> on that date.</p>
<p style="margin:0 0 24px;color:#334155;font-size:15px;line-height:1.7;">If you do not want to continue, cancel before the trial ends to avoid being charged.</p>
<table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
<tr><td align="center" style="border-radius:12px;background:#06b6d4;">
<a href="{$appUrl}/dashboard?tab=billing" style="display:inline-block;padding:14px 32px;color:#fff;font-size:15px;font-weight:700;text-decoration:none;border-radius:12px;">Manage Membership</a>
</td></tr></table>
<p style="margin:0;color:#64748b;font-size:12px;line-height:1.6;border-top:1px solid #e2e8f0;padding-top:16px;">To cancel, click Manage Membership above and select Cancel Subscription in the billing portal.</p>
</td></tr>
<tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;">
<p style="margin:0;color:#94a3b8;font-size:11px;">&copy; 2026 Nestora. All rights reserved.</p>
</td></tr>
</table></td></tr></table></body></html>
HTML;
        sendMail($u['email'], $subject, $body);
    } catch (Throwable $e) {
        error_log('Trial reminder email error: ' . $e->getMessage());
    }
}

/**
 * Send membership active email (trial converted or annual renewed).
 */
function _sendMembershipActiveEmail(int $userId, string $periodEnd, bool $wasTrialing): void
{
    try {
        require_once __DIR__ . '/../lib/mail.php';
        $db = database();
        $stmt = $db->prepare('SELECT name, email FROM users WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $userId]);
        $u = $stmt->fetch();
        if (!is_array($u)) return;

        $appUrl = rtrim((string) env('APP_URL', 'http://localhost:5173'), '/');
        $periodEndFormatted = date('F j, Y', strtotime($periodEnd));
        $userName = htmlspecialchars($u['name']);
        $heading = $wasTrialing
            ? 'Your Annual Membership is Now Active!'
            : 'Your Annual Membership Has Been Renewed';
        $subject = $wasTrialing
            ? 'Your Service Provider Annual Membership is Active — Nestora'
            : 'Membership Renewed — Nestora';

        $body = <<<HTML
<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:48px 16px;">
<tr><td align="center">
<table width="100%" style="max-width:520px;background:#fff;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;">
<tr><td height="6" style="background:linear-gradient(90deg,#06b6d4 0%,#f97316 100%);line-height:6px;font-size:1px;">&nbsp;</td></tr>
<tr><td style="padding:40px;">
<p style="margin:0 0 20px;font-size:24px;font-weight:700;color:#0f172a;">Nestora<span style="color:#06b6d4;">.</span></p>
<h1 style="margin:0 0 16px;color:#0f172a;font-size:21px;">{$heading}</h1>
<p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.7;">Hi {$userName},</p>
<p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.7;">Your Service Provider Annual Membership is now active on Nestora.</p>
<table width="100%" style="margin-bottom:24px;"><tr>
<td style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:12px;padding:16px 20px;">
<p style="margin:0 0 4px;color:#0f172a;font-size:13px;font-weight:600;">Payment received</p>
<p style="margin:0;color:#059669;font-size:18px;font-weight:700;">$29.99 USD</p>
<p style="margin:8px 0 0;color:#64748b;font-size:12px;">Membership active until {$periodEndFormatted}</p>
</td></tr></table>
<p style="margin:0 0 24px;color:#334155;font-size:15px;line-height:1.7;">You have full Service Provider access. Your membership automatically renews annually.</p>
<table cellpadding="0" cellspacing="0" style="margin:0 auto 20px;">
<tr><td align="center" style="border-radius:12px;background:#06b6d4;">
<a href="{$appUrl}/dashboard" style="display:inline-block;padding:14px 32px;color:#fff;font-size:15px;font-weight:700;text-decoration:none;border-radius:12px;">Go to Dashboard &rarr;</a>
</td></tr></table>
</td></tr>
<tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;">
<p style="margin:0;color:#94a3b8;font-size:11px;">&copy; 2026 Nestora. All rights reserved.</p>
</td></tr>
</table></td></tr></table></body></html>
HTML;
        sendMail($u['email'], $subject, $body);
    } catch (Throwable $e) {
        error_log('Membership active email error: ' . $e->getMessage());
    }
}

/**
 * Send payment failed email.
 */
function _sendPaymentFailedEmail(int $userId): void
{
    try {
        require_once __DIR__ . '/../lib/mail.php';
        $db = database();
        $stmt = $db->prepare('SELECT name, email FROM users WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $userId]);
        $u = $stmt->fetch();
        if (!is_array($u)) return;

        $appUrl = rtrim((string) env('APP_URL', 'http://localhost:5173'), '/');
        $userName = htmlspecialchars($u['name']);
        $subject = 'Payment Failed — Action Required for Your Nestora Membership';
        $body = <<<HTML
<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:48px 16px;">
<tr><td align="center">
<table width="100%" style="max-width:520px;background:#fff;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;">
<tr><td height="6" style="background:linear-gradient(90deg,#f97316 0%,#ef4444 100%);line-height:6px;font-size:1px;">&nbsp;</td></tr>
<tr><td style="padding:40px;">
<p style="margin:0 0 20px;font-size:24px;font-weight:700;color:#0f172a;">Nestora<span style="color:#06b6d4;">.</span></p>
<h1 style="margin:0 0 16px;color:#991b1b;font-size:21px;">Payment Failed</h1>
<p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.7;">Hi {$userName},</p>
<p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.7;">We could not process your annual membership payment of <strong>$29.99 USD</strong>. Please update your payment method to continue your Service Provider membership.</p>
<table width="100%" style="margin-bottom:24px;"><tr>
<td style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:16px 20px;">
<p style="margin:0;color:#991b1b;font-size:14px;font-weight:600;">Action required: Update your payment method to avoid losing access.</p>
</td></tr></table>
<table cellpadding="0" cellspacing="0" style="margin:0 auto 20px;">
<tr><td align="center" style="border-radius:12px;background:#06b6d4;">
<a href="{$appUrl}/dashboard?tab=billing" style="display:inline-block;padding:14px 32px;color:#fff;font-size:15px;font-weight:700;text-decoration:none;border-radius:12px;">Update Payment Method</a>
</td></tr></table>
<p style="margin:0;color:#64748b;font-size:12px;line-height:1.6;border-top:1px solid #e2e8f0;padding-top:16px;">Stripe will automatically retry your payment. If it remains unsuccessful, your Service Provider membership will be suspended.</p>
</td></tr>
<tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;">
<p style="margin:0;color:#94a3b8;font-size:11px;">&copy; 2026 Nestora. All rights reserved.</p>
</td></tr>
</table></td></tr></table></body></html>
HTML;
        sendMail($u['email'], $subject, $body);
    } catch (Throwable $e) {
        error_log('Payment failed email error: ' . $e->getMessage());
    }
}

/**
 * Send cancellation confirmed email.
 */
function _sendCancellationEmail(int $userId): void
{
    try {
        require_once __DIR__ . '/../lib/mail.php';
        $db = database();
        $stmt = $db->prepare('SELECT name, email, subscription_ends_at, trial_ends_at FROM users WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $userId]);
        $u = $stmt->fetch();
        if (!is_array($u)) return;

        $appUrl = rtrim((string) env('APP_URL', 'http://localhost:5173'), '/');
        $userName = htmlspecialchars($u['name']);
        $subject = 'Your Nestora Membership Has Been Cancelled';
        $body = <<<HTML
<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:48px 16px;">
<tr><td align="center">
<table width="100%" style="max-width:520px;background:#fff;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;">
<tr><td height="6" style="background:linear-gradient(90deg,#06b6d4 0%,#f97316 100%);line-height:6px;font-size:1px;">&nbsp;</td></tr>
<tr><td style="padding:40px;">
<p style="margin:0 0 20px;font-size:24px;font-weight:700;color:#0f172a;">Nestora<span style="color:#06b6d4;">.</span></p>
<h1 style="margin:0 0 16px;color:#0f172a;font-size:21px;">Membership Cancelled</h1>
<p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.7;">Hi {$userName},</p>
<p style="margin:0 0 24px;color:#334155;font-size:15px;line-height:1.7;">Your Service Provider membership on Nestora has been cancelled. Your business information and profile data remain saved.</p>
<p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.7;">If you would like to rejoin as a Service Provider in the future, you can re-apply from your account.</p>
</td></tr>
<tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;">
<p style="margin:0;color:#94a3b8;font-size:11px;">&copy; 2026 Nestora. All rights reserved.</p>
</td></tr>
</table></td></tr></table></body></html>
HTML;
        sendMail($u['email'], $subject, $body);
    } catch (Throwable $e) {
        error_log('Cancellation email error: ' . $e->getMessage());
    }
}
