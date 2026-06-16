<?php

declare(strict_types=1);

require_once __DIR__ . '/../src/bootstrap.php';

// CORS Headers
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: http://localhost:5173');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: POST, OPTIONS');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    jsonResponse(405, ['message' => 'Method not allowed. Use POST.']);
}

// Ensure customer is authenticated
$user = currentUserOrFail();

// Parse input JSON payload
$data = readJson();
$amount = isset($data['amount']) ? (float) $data['amount'] : 0.0;
$deliveryAddress = trim((string) ($data['delivery_address'] ?? ''));
$items = $data['items'] ?? [];

if ($amount <= 0.0) {
    jsonResponse(422, ['message' => 'Valid order amount is required.']);
}

if ($deliveryAddress === '') {
    jsonResponse(422, ['message' => 'Delivery address is required.']);
}

if (!is_array($items) || empty($items)) {
    jsonResponse(422, ['message' => 'Checkout items are required.']);
}

if (!function_exists('generateOrderReference')) {
    function generateOrderReference(): string
    {
        return '#NES-' . strtoupper(bin2hex(random_bytes(3)));
    }
}

$db = database();

// 1. Identify seller_id by querying the first product in checkout items
$sellerId = null;
$firstItem = $items[0];
$productId = (int) ($firstItem['productId'] ?? 0);
if ($productId > 0) {
    $stmt = $db->prepare('SELECT user_id FROM product_listings WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $productId]);
    $sellerId = $stmt->fetchColumn() ?: null;
}

$orderId = generateOrderReference();

$db->beginTransaction();
try {
    // 2. Insert order row with 'PENDING' status
    $orderStmt = $db->prepare('
        INSERT INTO orders (order_id, customer_id, seller_id, delivery_address, amount, status, created_at, updated_at)
        VALUES (:order_id, :customer_id, :seller_id, :delivery_address, :amount, "PENDING", NOW(), NOW())
    ');
    $orderStmt->execute([
        'order_id' => $orderId,
        'customer_id' => $user['id'],
        'seller_id' => $sellerId,
        'delivery_address' => $deliveryAddress,
        'amount' => $amount
    ]);

    // 3. Insert checkout items details into order_items table
    $itemStmt = $db->prepare('
        INSERT INTO order_items (order_id, product_id, title, price, quantity, created_at)
        VALUES (:order_id, :product_id, :title, :price, :quantity, NOW())
    ');

    foreach ($items as $item) {
        $prodId = (int) ($item['productId'] ?? 0);
        $qty = (int) ($item['quantity'] ?? 1);

        $prodQuery = $db->prepare('SELECT title, price FROM product_listings WHERE id = :id LIMIT 1');
        $prodQuery->execute(['id' => $prodId]);
        $product = $prodQuery->fetch();

        if ($product) {
            $itemStmt->execute([
                'order_id' => $orderId,
                'product_id' => $prodId,
                'title' => $product['title'],
                'price' => (float) $product['price'],
                'quantity' => $qty
            ]);
        }
    }

    $db->commit();
} catch (Throwable $e) {
    $db->rollBack();
    jsonResponse(500, ['message' => 'Failed to initiate order in database.', 'details' => $e->getMessage()]);
}

// 4. Generate the secure PayHere MD5 validation hash
$merchantId = '1236337';
$merchantSecret = 'NestoraprojectgroupCST07';
$currency = 'LKR';

// Format amount to 2 decimal places as required by PayHere
$formattedAmount = number_format($amount, 2, '.', '');

$hash = strtoupper(
    md5(
        $merchantId .
        $orderId .
        $formattedAmount .
        $currency .
        strtoupper(md5($merchantSecret))
    )
);

// 5. Return JSON payload to frontend
jsonResponse(200, [
    'merchant_id' => $merchantId,
    'order_id' => $orderId,
    'amount' => $amount,
    'currency' => $currency,
    'hash' => $hash
]);
