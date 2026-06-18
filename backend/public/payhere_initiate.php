<?php

declare(strict_types=1);

require_once __DIR__ . '/../src/bootstrap.php';

// Enable CORS for React frontend development
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin === 'http://localhost:5173') {
    header('Access-Control-Allow-Origin: http://localhost:5173');
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

header('Content-Type: application/json; charset=utf-8');

// Ensure customer is authenticated
$user = currentUserOrFail();

$data = readJson();
$amount = (float) ($data['amount'] ?? 0.0);
$address = trim((string) ($data['delivery_address'] ?? ''));
$items = $data['items'] ?? [];

if ($amount <= 0.0) {
    jsonResponse(422, ['message' => 'Total amount must be greater than zero.']);
}

if ($address === '') {
    jsonResponse(422, ['message' => 'Delivery address is required.']);
}

if (empty($items)) {
    jsonResponse(422, ['message' => 'Order items list cannot be empty.']);
}

$db = database();

// 1. Resolve product listings and seller
$sellerId = null;
$itemsDetails = [];

foreach ($items as $item) {
    $productId = (int) ($item['productId'] ?? 0);
    $quantity = (int) ($item['quantity'] ?? 0);

    if ($productId <= 0 || $quantity <= 0) {
        jsonResponse(422, ['message' => 'Product ID and quantity must be positive integers.']);
    }

    $stmt = $db->prepare('SELECT * FROM product_listings WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $productId]);
    $product = $stmt->fetch();

    if ($product === false) {
        jsonResponse(404, ['message' => "Product not found: ID {$productId}"]);
    }

    if ($sellerId === null) {
        $sellerId = (int) $product['user_id'];
    }

    $itemsDetails[] = [
        'product_id' => $productId,
        'title'      => $product['title'],
        'price'      => (float) $product['price'],
        'quantity'   => $quantity
    ];
}

// 2. Generate a unique order ID
do {
    $order_id = '#NES-' . strtoupper(bin2hex(random_bytes(3)));
    $stmt = $db->prepare('SELECT COUNT(*) FROM orders WHERE order_id = :order_id');
    $stmt->execute(['order_id' => $order_id]);
    $exists = (int) $stmt->fetchColumn() > 0;
} while ($exists);

// 3. Start Transaction and Insert Order and Items
$db->beginTransaction();
try {
    $orderStmt = $db->prepare('
        INSERT INTO orders (order_id, customer_id, seller_id, delivery_address, amount, status, created_at, updated_at)
        VALUES (:order_id, :customer_id, :seller_id, :delivery_address, :amount, "PENDING", NOW(), NOW())
    ');
    $orderStmt->execute([
        'order_id'         => $order_id,
        'customer_id'      => $user['id'],
        'seller_id'        => $sellerId,
        'delivery_address' => $address,
        'amount'           => $amount
    ]);

    $itemStmt = $db->prepare('
        INSERT INTO order_items (order_id, product_id, title, price, quantity, created_at)
        VALUES (:order_id, :product_id, :title, :price, :quantity, NOW())
    ');

    foreach ($itemsDetails as $detail) {
        $itemStmt->execute([
            'order_id'   => $order_id,
            'product_id' => $detail['product_id'],
            'title'      => $detail['title'],
            'price'      => $detail['price'],
            'quantity'   => $detail['quantity']
        ]);
    }

    $db->commit();
} catch (Throwable $e) {
    $db->rollBack();
    jsonResponse(500, ['message' => 'Failed to initiate order in database.', 'details' => $e->getMessage()]);
}

// 4. Generate PayHere security hash
$merchant_id = env('PAYHERE_MERCHANT_ID', '1236337');
$merchant_secret = env('PAYHERE_MERCHANT_SECRET', 'NestoraprojectgroupCST07');
$currency = 'LKR';

// payhere format: uppercase(md5(merchant_id + order_id + formatted_amount + currency + uppercase(md5(merchant_secret))))
$formatted_amount = number_format($amount, 2, '.', '');
$secret_hash = strtoupper(md5($merchant_secret));
$hash = strtoupper(md5($merchant_id . $order_id . $formatted_amount . $currency . $secret_hash));

// 5. Return JSON payload
jsonResponse(201, [
    'merchant_id' => $merchant_id,
    'order_id'    => $order_id,
    'amount'      => $amount,
    'currency'    => $currency,
    'hash'        => $hash,
    'first_name'  => $user['name'] ?? 'Customer',
    'last_name'   => '',
    'email'       => $user['email'] ?? '',
    'phone'       => '0771234567',
    'address'     => $address,
    'city'        => 'Colombo',
    'country'     => 'Sri Lanka'
]);
