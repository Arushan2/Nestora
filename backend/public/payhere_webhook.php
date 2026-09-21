<?php

declare(strict_types=1);

require_once __DIR__ . '/../src/bootstrap.php';

header('Content-Type: application/json; charset=utf-8');

// Ensure log directory exists
$logDir = __DIR__ . '/../logs';
if (!is_dir($logDir)) {
    @mkdir($logDir, 0775, true);
}
$logFile = $logDir . '/payhere_webhook.log';

function logWebhook(string $message): void
{
    global $logFile;
    $timestamp = date('Y-m-d H:i:s');
    @file_put_contents($logFile, "[{$timestamp}] {$message}" . PHP_EOL, FILE_APPEND);
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Only POST requests are allowed.']);
    exit;
}

// Extract variables from POST payload (with fallback to raw input stream)
$rawInput = file_get_contents('php://input');
$params = $_POST;
if (empty($params) && !empty($rawInput)) {
    $json = json_decode($rawInput, true);
    if (is_array($json)) {
        $params = $json;
    } else {
        parse_str($rawInput, $params);
    }
}

$clientIp = $_SERVER['REMOTE_ADDR'] ?? 'UNKNOWN';
logWebhook("Incoming PayHere callback from IP {$clientIp}. Data: " . json_encode($params));

$merchant_id      = trim((string) ($params['merchant_id'] ?? ''));
$order_id         = trim((string) ($params['order_id'] ?? ''));
$payment_id       = trim((string) ($params['payment_id'] ?? ''));
$payhere_amount   = trim((string) ($params['payhere_amount'] ?? ''));
$payhere_currency = strtoupper(trim((string) ($params['payhere_currency'] ?? '')));
$status_code      = trim((string) ($params['status_code'] ?? ''));
$md5sig           = strtoupper(trim((string) ($params['md5sig'] ?? '')));
$status_message   = trim((string) ($params['status_message'] ?? ''));

$configuredMerchantId = (string) env('PAYHERE_MERCHANT_ID', '1236337');
$merchant_secret      = (string) env('PAYHERE_MERCHANT_SECRET', 'NestoraprojectgroupCST07');

// 1. Check required parameters
if ($merchant_id === '' || $order_id === '' || $md5sig === '' || $payhere_amount === '' || $status_code === '') {
    logWebhook("ERROR: Missing required POST parameters for Order {$order_id}.");
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Missing required POST parameters.']);
    exit;
}

// 2. Validate Merchant ID
if ($merchant_id !== $configuredMerchantId) {
    logWebhook("ERROR: Merchant ID mismatch! Received: {$merchant_id}, Configured: {$configuredMerchantId}");
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Merchant ID mismatch.']);
    exit;
}

// 3. Reconstruct MD5 signature to verify integrity
// Formula: uppercase(md5(merchant_id + order_id + payhere_amount + payhere_currency + status_code + uppercase(md5(merchant_secret))))
$secret_hash = strtoupper(md5($merchant_secret));
$local_md5sig = strtoupper(
    md5(
        $merchant_id .
        $order_id .
        $payhere_amount .
        $payhere_currency .
        $status_code .
        $secret_hash
    )
);

if ($local_md5sig !== $md5sig) {
    logWebhook("ERROR: Invalid signature mismatch for Order {$order_id}! Expected: {$local_md5sig}, Received: {$md5sig}");
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Invalid signature: checksum mismatch.']);
    exit;
}

$db = database();

// 4. Retrieve order from database
$orderStmt = $db->prepare('SELECT * FROM orders WHERE order_id = :order_id LIMIT 1');
$orderStmt->execute(['order_id' => $order_id]);
$order = $orderStmt->fetch(PDO::FETCH_ASSOC);

if (!$order) {
    logWebhook("WARNING: Order ID {$order_id} not found in database.");
    // Return 200 with error details so PayHere stops retrying a non-existent order
    http_response_code(200);
    echo json_encode(['status' => 'error', 'message' => "Order {$order_id} not found."]);
    exit;
}

// 5. Verify amount and currency (Fraud Protection)
$expectedAmount = (float) $order['amount'];
$paidAmount = (float) $payhere_amount;

if (abs($expectedAmount - $paidAmount) > 0.01 || $payhere_currency !== 'LKR') {
    logWebhook("CRITICAL: Fraud alert! Amount/Currency mismatch on Order {$order_id}. Expected: {$expectedAmount} LKR, Paid: {$paidAmount} {$payhere_currency}");
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Amount or currency does not match recorded order.']);
    exit;
}

// 6. Idempotency check: If order is already completed or processing
$currentStatus = strtolower((string) $order['status']);
if (in_array($currentStatus, ['processing', 'shipped', 'completed'], true)) {
    logWebhook("IDEMPOTENT: Order {$order_id} is already in '{$currentStatus}' status. Skipping duplicate update.");
    http_response_code(200);
    echo json_encode([
        'status' => 'success',
        'message' => "Order is already {$currentStatus}. Callback acknowledged."
    ]);
    exit;
}

// 7. Process based on PayHere status_code
// status_code: 2 = Success, 0 = Pending, -1 = Canceled, -2 = Failed, -3 = Chargedback
$statusCodeInt = (int) $status_code;

if ($statusCodeInt === 2) {
    // Payment Successful
    $updateStmt = $db->prepare('
        UPDATE orders
        SET status = "processing", payhere_payment_id = :payment_id, updated_at = NOW()
        WHERE order_id = :order_id AND (status = "PENDING" OR status = "pending")
    ');
    $updateStmt->execute([
        'payment_id' => $payment_id,
        'order_id'   => $order_id
    ]);

    if ($updateStmt->rowCount() > 0) {
        logWebhook("SUCCESS: Order {$order_id} marked as processing. PayHere Payment ID: {$payment_id}");

        // Deduct inventory stock
        try {
            $itemsStmt = $db->prepare('SELECT product_id, quantity FROM order_items WHERE order_id = :order_id');
            $itemsStmt->execute(['order_id' => $order_id]);
            $items = $itemsStmt->fetchAll(PDO::FETCH_ASSOC);

            $inventoryManager = new \Nestora\Inventory\InventoryManager($db);
            foreach ($items as $item) {
                $inventoryManager->deductStock((int) $item['product_id'], (int) $item['quantity']);
            }
            logWebhook("Stock deducted for items in order {$order_id}.");
        } catch (\Throwable $e) {
            logWebhook("ERROR: Failed to deduct stock for order {$order_id}: " . $e->getMessage());
        }

        // Notify Buyer
        if (!empty($order['customer_id'])) {
            createNotification(
                (int) $order['customer_id'],
                'Payment Completed',
                "Your payment of LKR " . number_format($paidAmount, 2) . " for order {$order_id} has been verified via PayHere. The seller has been notified to prepare shipment.",
                '/orders'
            );
        }

        // Notify Seller
        if (!empty($order['seller_id'])) {
            createNotification(
                (int) $order['seller_id'],
                'Payment Verified',
                "Payment for order {$order_id} (LKR " . number_format($paidAmount, 2) . ") was completed via PayHere. Please fulfill and ship the order.",
                '/dashboard?tab=orders'
            );
        }

        http_response_code(200);
        echo json_encode([
            'status' => 'success',
            'message' => 'Payment processed, stock updated, and notifications sent.'
        ]);
        exit;
    } else {
        logWebhook("NOTICE: Order {$order_id} was already updated or not in pending state.");
        http_response_code(200);
        echo json_encode(['status' => 'success', 'message' => 'Order state already updated.']);
        exit;
    }
} elseif ($statusCodeInt === -1 || $statusCodeInt === -2) {
    // Payment Canceled or Failed
    $statusName = ($statusCodeInt === -1) ? 'canceled' : 'failed';
    logWebhook("PAYMENT FAILED: Order {$order_id} payment {$statusName} with status_code {$statusCodeInt}. Reason: {$status_message}");

    $failStmt = $db->prepare('
        UPDATE orders
        SET status = :status, updated_at = NOW()
        WHERE order_id = :order_id AND (status = "PENDING" OR status = "pending")
    ');
    $failStmt->execute([
        'status'   => $statusName,
        'order_id' => $order_id
    ]);

    if (!empty($order['customer_id'])) {
        createNotification(
            (int) $order['customer_id'],
            'Payment ' . ucfirst($statusName),
            "Payment for order {$order_id} was {$statusName} (status: {$status_code}). You may re-order from checkout.",
            '/checkout'
        );
    }

    http_response_code(200);
    echo json_encode([
        'status' => 'success',
        'message' => "Order marked as {$statusName}."
    ]);
    exit;
} else {
    // Status 0 (Pending) or others
    logWebhook("NOTICE: Order {$order_id} received non-final status_code {$statusCodeInt}.");
    http_response_code(200);
    echo json_encode([
        'status' => 'success',
        'message' => 'Status callback noted; order remains in current state.'
    ]);
    exit;
}

