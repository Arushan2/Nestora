<?php

declare(strict_types=1);

namespace Nestora\Controllers;

use Nestora\Core\Base\AbstractController;
use Nestora\Core\Http\Request;
use Nestora\Core\Http\Response;

class PaymentController extends AbstractController
{
    public function getAdminPayments(Request $request): Response
    {
        $this->requireAdmin($request);

        $sellers = $this->db->fetchAll("
            SELECT u.id as seller_id, u.name as seller_name, u.email as seller_email,
                   pa.bank_name, pa.account_holder_name, pa.account_number, pa.branch,
                   COALESCE(SUM(o.total_cost), 0) as total_earnings
            FROM users u
            JOIN pro_applications pa ON pa.user_id = u.id
            LEFT JOIN orders o ON o.seller_id = u.id AND o.status IN ('completed', 'shipped')
            WHERE u.role = 'product_seller'
            GROUP BY u.id, u.name, u.email, pa.bank_name, pa.account_holder_name, pa.account_number, pa.branch
        ");

        $settlements = $this->db->fetchAll("
            SELECT s.*, u.name as seller_name
            FROM seller_settlements s
            JOIN users u ON u.id = s.seller_id
            ORDER BY s.created_at DESC
        ");

        return $this->json(200, [
            'sellers' => $sellers,
            'settlements' => $settlements
        ]);
    }

    public function settlePayment(Request $request): Response
    {
        $this->requireAdmin($request);
        $body = $request->getBody();

        $sellerId = (int) ($body['sellerId'] ?? 0);
        $amount = (float) ($body['amount'] ?? 0);
        $receiptUrl = trim((string) ($body['receiptUrl'] ?? ''));

        if ($sellerId <= 0 || $amount <= 0 || $receiptUrl === '') {
            return $this->error(422, 'Seller ID, positive amount, and receipt URL are required.');
        }

        $this->db->query(
            'INSERT INTO seller_settlements (seller_id, amount, receipt_url, created_at) VALUES (:seller_id, :amount, :receipt_url, NOW())',
            ['seller_id' => $sellerId, 'amount' => $amount, 'receipt_url' => $receiptUrl]
        );

        return $this->json(201, ['message' => 'Settlement recorded successfully.']);
    }

    public function handleStripeWebhook(Request $request): Response
    {
        $payload = file_get_contents('php://input') ?: '';
        $sigHeader = $request->getHeader('Stripe-Signature') ?? '';
        $secret = (string) (getenv('STRIPE_WEBHOOK_SECRET') ?: '');

        if ($secret !== '') {
            try {
                \Stripe\Stripe::setApiKey((string) getenv('STRIPE_SECRET_KEY'));
                $event = \Stripe\Webhook::constructEvent($payload, $sigHeader, $secret);
            } catch (\Exception $e) {
                return $this->error(400, 'Webhook Error: ' . $e->getMessage());
            }
        }

        return $this->json(200, ['received' => true]);
    }
}
