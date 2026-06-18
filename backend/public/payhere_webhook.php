<?php

declare(strict_types=1);

require_once __DIR__ . '/../src/bootstrap.php';

header('Content-Type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Only POST requests are allowed.']);
    exit;
}

// Extract variables from POST payload
$merchant_id      = $_POST['merchant_id'] ?? '';
$order_id         = $_POST['order_id'] ?? '';
$payment_id       = $_POST['payment_id'] ?? '';
$payhere_amount   = $_POST['payhere_amount'] ?? '';
$payhere_currency = $_POST['payhere_currency'] ?? '';
$status_code      = $_POST['status_code'] ?? '';
$md5sig           = $_POST['md5sig'] ?? '';

$merchant_secret = env('PAYHERE_MERCHANT_SECRET', 'NestoraprojectgroupCST07');

if ($merchant_id === '' || $order_id === '' || $md5sig === '') {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Missing required POST parameters.']);
    exit;
}

// Reconstruct the md5sig to verify integrity
// Formula: MD5(merchant_id + order_id + payhere_amount + payhere_currency + status_code + MD5(merchant_secret))
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
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Invalid signature signature mismatch.']);
    exit;
}

// status_code 2 indicates success
if ((int)$status_code === 2) {
    $db = database();
    
    $stmt = $db->prepare('
        UPDATE orders
        SET status = "processing", payhere_payment_id = :payment_id, updated_at = NOW()
        WHERE order_id = :order_id AND status = "PENDING"
    ');
    $stmt->execute([
        'payment_id' => $payment_id,
        'order_id'   => $order_id
    ]);

    if ($stmt->rowCount() > 0) {
        http_response_code(200);
        echo json_encode(['status' => 'success', 'message' => 'Payment processed and database state updated successfully.']);
    } else {
        http_response_code(200); // 200 since signature was valid but order was already processed or doesn't exist
        echo json_encode(['status' => 'success', 'message' => 'Signature verified but order not updated (does not exist or already completed).']);
    }
} else {
    // Payment failed or is pending/canceled/etc.
    http_response_code(200);
    echo json_encode(['status' => 'success', 'message' => 'Callback processed but status code was not successful.']);
}
