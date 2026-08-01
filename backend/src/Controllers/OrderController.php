<?php

declare(strict_types=1);

namespace Nestora\Controllers;

use Nestora\Core\Base\AbstractController;
use Nestora\Core\Http\Request;
use Nestora\Core\Http\Response;
use Nestora\Core\Services\CloudinaryStorageService;
use Throwable;

class OrderController extends AbstractController
{
    private CloudinaryStorageService $storageService;

    public function __construct()
    {
        parent::__construct();
        $this->storageService = new CloudinaryStorageService();
    }

    private function generateOrderReference(): string
    {
        return '#NES-' . strtoupper(bin2hex(random_bytes(3)));
    }

    public function create(Request $request): Response
    {
        $user = $this->currentUserOrFail($request);

        $body = $request->getBody();
        $address = trim((string) ($body['delivery_address'] ?? ''));
        $itemsJson = trim((string) ($body['items'] ?? ''));

        if ($address === '' || $itemsJson === '') {
            return $this->error(422, 'Delivery address and items list are required.');
        }

        $items = json_decode($itemsJson, true);
        if (!is_array($items) || empty($items)) {
            return $this->error(422, 'Invalid or empty items list.');
        }

        $receiptFile = $request->getFile('receipt');
        if (!$receiptFile || $receiptFile['error'] !== UPLOAD_ERR_OK) {
            return $this->error(422, 'Bank transfer receipt image or PDF is required.');
        }

        $sellerGroups = [];

        foreach ($items as $item) {
            $productId = (int) ($item['productId'] ?? 0);
            $quantity = (int) ($item['quantity'] ?? 0);

            if ($productId <= 0 || $quantity <= 0) {
                return $this->error(422, 'Product ID and quantity must be positive integers.');
            }

            $product = $this->db->fetch('SELECT * FROM product_listings WHERE id = :id LIMIT 1', ['id' => $productId]);

            if (!$product) {
                return $this->error(404, "Product not found: ID {$productId}");
            }

            $stock = (int) ($product['stock_units'] ?? $product['stock'] ?? 0);
            if ($stock < $quantity) {
                return $this->error(422, "Insufficient stock for product: {$product['title']}. Available: {$stock}");
            }

            $sellerId = (int) $product['user_id'];
            $sellerGroups[$sellerId][] = [
                'product' => $product,
                'quantity' => $quantity,
                'price' => (float) $product['price']
            ];
        }

        try {
            $receiptUrl = $this->storageService->upload($receiptFile['tmp_name'], $receiptFile['name']);
        } catch (Throwable $e) {
            return $this->error(500, 'Unable to upload bank receipt.', ['details' => $e->getMessage()]);
        }

        $this->db->beginTransaction();
        try {
            $createdOrders = [];
            foreach ($sellerGroups as $sellerId => $groupItems) {
                $orderNumber = $this->generateOrderReference();
                $shippingFee = 0.0;
                $itemsTotal = 0.0;

                foreach ($groupItems as $gItem) {
                    $itemsTotal += $gItem['price'] * $gItem['quantity'];
                    $shippingFee += (float) ($gItem['product']['shipping_fee'] ?? 0.0);
                }

                $totalCost = $itemsTotal + $shippingFee;

                $this->db->query('
                    INSERT INTO orders (order_number, customer_id, seller_id, delivery_address, items_total, shipping_fee, total_cost, status, receipt_url, created_at, updated_at)
                    VALUES (:order_number, :customer_id, :seller_id, :delivery_address, :items_total, :shipping_fee, :total_cost, "awaiting_verification", :receipt_url, NOW(), NOW())
                ', [
                    'order_number' => $orderNumber,
                    'customer_id' => $user['id'],
                    'seller_id' => $sellerId,
                    'delivery_address' => $address,
                    'items_total' => $itemsTotal,
                    'shipping_fee' => $shippingFee,
                    'total_cost' => $totalCost,
                    'receipt_url' => $receiptUrl
                ]);

                $orderId = (int) $this->db->lastInsertId();

                foreach ($groupItems as $gItem) {
                    $this->db->query('
                        INSERT INTO order_items (order_id, product_id, title, price, quantity)
                        VALUES (:order_id, :product_id, :title, :price, :quantity)
                    ', [
                        'order_id' => $orderId,
                        'product_id' => $gItem['product']['id'],
                        'title' => $gItem['product']['title'],
                        'price' => $gItem['price'],
                        'quantity' => $gItem['quantity']
                    ]);
                }

                $createdOrders[] = $orderNumber;
            }

            $this->db->commit();
            return $this->json(201, [
                'message' => 'Order created successfully.',
                'orders' => $createdOrders
            ]);
        } catch (Throwable $e) {
            $this->db->rollBack();
            return $this->error(500, 'Database error creating order.', ['details' => $e->getMessage()]);
        }
    }

    public function listMyOrders(Request $request): Response
    {
        $user = $this->currentUserOrFail($request);

        $sql = 'SELECT o.*, u.name as seller_name
                FROM orders o
                LEFT JOIN users u ON u.id = o.seller_id
                WHERE o.customer_id = :customer_id
                ORDER BY o.created_at DESC';

        $orders = $this->db->fetchAll($sql, ['customer_id' => $user['id']]);

        foreach ($orders as &$order) {
            $order['items'] = $this->db->fetchAll('SELECT * FROM order_items WHERE order_id = :order_id', ['order_id' => $order['id']]);
        }

        return $this->json(200, ['orders' => $orders]);
    }

    public function listSellerOrders(Request $request): Response
    {
        $user = $this->currentUserOrFail($request);

        $sql = 'SELECT o.*, u.name as customer_name
                FROM orders o
                LEFT JOIN users u ON u.id = o.customer_id
                WHERE o.seller_id = :seller_id
                ORDER BY o.created_at DESC';

        $orders = $this->db->fetchAll($sql, ['seller_id' => $user['id']]);

        foreach ($orders as &$order) {
            $order['items'] = $this->db->fetchAll('SELECT * FROM order_items WHERE order_id = :order_id', ['order_id' => $order['id']]);
        }

        return $this->json(200, ['orders' => $orders]);
    }

    public function shipOrder(Request $request, string $orderNumber): Response
    {
        $user = $this->currentUserOrFail($request);
        $order = $this->db->fetch('SELECT * FROM orders WHERE order_number = :num LIMIT 1', ['num' => $orderNumber]);

        if (!$order) {
            return $this->error(404, 'Order not found.');
        }

        if ((int) $order['seller_id'] !== (int) $user['id'] && $user['role'] !== 'admin') {
            return $this->error(403, 'Forbidden: You are not the seller of this order.');
        }

        $this->db->query('UPDATE orders SET status = "shipped", shipped_at = NOW(), updated_at = NOW() WHERE id = :id', ['id' => $order['id']]);
        return $this->json(200, ['message' => 'Order marked as shipped.']);
    }

    public function completeOrder(Request $request, string $orderNumber): Response
    {
        $user = $this->currentUserOrFail($request);
        $order = $this->db->fetch('SELECT * FROM orders WHERE order_number = :num LIMIT 1', ['num' => $orderNumber]);

        if (!$order) {
            return $this->error(404, 'Order not found.');
        }

        if ((int) $order['customer_id'] !== (int) $user['id'] && $user['role'] !== 'admin') {
            return $this->error(403, 'Forbidden: You are not the customer of this order.');
        }

        $this->db->query('UPDATE orders SET status = "completed", updated_at = NOW() WHERE id = :id', ['id' => $order['id']]);
        return $this->json(200, ['message' => 'Order completed successfully.']);
    }

    public function flagNotReceived(Request $request, string $orderNumber): Response
    {
        $user = $this->currentUserOrFail($request);
        $order = $this->db->fetch('SELECT * FROM orders WHERE order_number = :num LIMIT 1', ['num' => $orderNumber]);

        if (!$order) {
            return $this->error(404, 'Order not found.');
        }

        if ((int) $order['customer_id'] !== (int) $user['id']) {
            return $this->error(403, 'Forbidden.');
        }

        $this->db->query('UPDATE orders SET status = "flagged_missing", updated_at = NOW() WHERE id = :id', ['id' => $order['id']]);
        return $this->json(200, ['message' => 'Order flagged as not received.']);
    }
}
