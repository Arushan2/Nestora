<?php

declare(strict_types=1);

namespace Nestora\Controllers;

use Nestora\Core\Base\AbstractController;
use Nestora\Core\Http\Request;
use Nestora\Core\Http\Response;
use Throwable;

class SubscriptionController extends AbstractController
{
    public function createPortalSession(Request $request): Response
    {
        $user = $this->currentUserOrFail($request);

        $dbUser = $this->db->fetch('SELECT stripe_customer_id FROM users WHERE id = :id LIMIT 1', ['id' => $user['id']]);
        $customerId = $dbUser['stripe_customer_id'] ?? null;

        if (empty($customerId)) {
            return $this->error(400, 'No active Stripe billing information found.');
        }

        $stripeSecretKey = (string) getenv('STRIPE_SECRET_KEY');
        if (empty($stripeSecretKey)) {
            return $this->error(500, 'Stripe integration is not configured properly on the server.');
        }

        try {
            \Stripe\Stripe::setApiKey($stripeSecretKey);
            $session = \Stripe\BillingPortal\Session::create([
                'customer' => $customerId,
                'return_url' => 'http://localhost:5173/profile',
            ]);

            return $this->json(200, ['url' => $session->url]);
        } catch (Throwable $e) {
            return $this->error(500, 'Failed to create Stripe billing portal session.', ['details' => $e->getMessage()]);
        }
    }
}
