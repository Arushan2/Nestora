<?php

declare(strict_types=1);

require_once __DIR__ . '/../src/bootstrap.php';

// Allow webhook calls from any origin
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: POST, OPTIONS');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    http_response_code(405);
    echo "Method Not Allowed";
    exit;
}

// Retrieve POST parameters from PayHere webhook payload
$merchantId = $_POST['merchant_id'] ?? '';
$orderId = $_POST['order_id'] ?? '';
$payhereAmount = $_POST['payhere_amount'] ?? '';
$payhereCurrency = $_POST['payhere_currency'] ?? '';
$statusCode = $_POST['status_code'] ?? '';
$paymentId = $_POST['payment_id'] ?? '';
$incomingMd5sig = $_POST['md5sig'] ?? '';

$merchantSecret = 'NestoraprojectgroupCST07';

// Compute the expected MD5 signature
$calculatedMd5sig = strtoupper(
    md5(
        $merchantId .
        $orderId .
        $payhereAmount .
        $payhereCurrency .
        $statusCode .
        strtoupper(md5($merchantSecret))
    )
);

// Compare computed MD5 signature with the signature sent by PayHere (case-insensitively)
if (strcasecmp($incomingMd5sig, $calculatedMd5sig) !== 0) {
    http_response_code(400);
    echo "Invalid Signature Verification Failed";
    exit;
}

// status_code == 2 indicates a successful payment transaction
if ((int) $statusCode === 2) {
    $db = database();
    
    try {
        $stmt = $db->prepare('
            UPDATE orders
            SET status = "COMPLETED", payhere_payment_id = :payment_id, updated_at = NOW()
            WHERE order_id = :order_id AND status = "PENDING"
        ');
        $stmt->execute([
            'payment_id' => $paymentId,
            'order_id' => $orderId
        ]);
        
        http_response_code(200);
        echo "Order status successfully updated to COMPLETED";
        exit;
    } catch (Throwable $e) {
        http_response_code(500);
        echo "Database update failure: " . $e->getMessage();
        exit;
    }
} else {
    // Other status codes (like 0 - Pending, -1 - Canceled, -2 - Failed, -3 - Chargedback)
    http_response_code(200);
    echo "Transaction received but not processed (status code is not 2)";
    exit;
}
