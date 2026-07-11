<?php

declare(strict_types=1);

function getAdminPayments(): void
{
    adminOnly();

    $db = database();

    // Fetch product sellers with revenue summaries
    $sellersQuery = "
        SELECT 
            u.id AS seller_id,
            u.name,
            u.email,
            pa.business_name,
            pa.bank_name,
            pa.account_holder_name,
            pa.account_number,
            pa.branch,
            -- Total Revenue (shipped/completed)
            COALESCE((
                SELECT SUM(o.amount) 
                FROM orders o 
                WHERE o.seller_id = u.id AND o.status IN ('shipped', 'completed')
            ), 0.00) AS total_revenue,
            
            -- Holdings (shipped < 7 days ago)
            COALESCE((
                SELECT SUM(o.amount) 
                FROM orders o 
                WHERE o.seller_id = u.id AND o.status IN ('shipped', 'completed') AND o.shipped_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
            ), 0.00) AS holdings,

            -- Releaseable (shipped >= 7 days ago)
            COALESCE((
                SELECT SUM(o.amount) 
                FROM orders o 
                WHERE o.seller_id = u.id AND o.status IN ('shipped', 'completed') AND o.shipped_at <= DATE_SUB(NOW(), INTERVAL 7 DAY)
            ), 0.00) AS releaseable,

            -- Settled
            COALESCE((
                SELECT SUM(s.amount) 
                FROM seller_settlements s 
                WHERE s.seller_id = u.id
            ), 0.00) AS total_settled
        FROM users u
        INNER JOIN pro_applications pa ON pa.user_id = u.id AND pa.application_type = 'product_seller'
        WHERE u.role = 'product_seller'
        ORDER BY pa.business_name ASC
    ";
    $sellers = $db->query($sellersQuery)->fetchAll();

    // Map data types
    foreach ($sellers as &$s) {
        $s['seller_id'] = (int) $s['seller_id'];
        $s['total_revenue'] = (float) $s['total_revenue'];
        $s['holdings'] = (float) $s['holdings'];
        $s['releaseable'] = (float) $s['releaseable'];
        $s['total_settled'] = (float) $s['total_settled'];
        $s['available_balance'] = max(0.00, $s['releaseable'] - $s['total_settled']);
    }

    // Fetch recent settlements
    $settlementsQuery = "
        SELECT s.*, u.name AS seller_name, pa.business_name AS seller_business_name
        FROM seller_settlements s
        INNER JOIN users u ON u.id = s.seller_id
        LEFT JOIN pro_applications pa ON pa.user_id = u.id AND pa.application_type = 'product_seller'
        ORDER BY s.created_at DESC
        LIMIT 50
    ";
    $settlements = $db->query($settlementsQuery)->fetchAll();
    foreach ($settlements as &$set) {
        $set['id'] = (int) $set['id'];
        $set['seller_id'] = (int) $set['seller_id'];
        $set['amount'] = (float) $set['amount'];
    }

    jsonResponse(200, [
        'sellers' => $sellers,
        'settlements' => $settlements
    ]);
}

function settlePayment(): void
{
    adminOnly();

    // Check if parameters are in $_POST since we are uploading multipart/form-data
    $sellerId = (int) ($_POST['seller_id'] ?? 0);
    $amount = (float) ($_POST['amount'] ?? 0.0);

    if ($sellerId <= 0 || $amount <= 0.0) {
        jsonResponse(422, ['message' => 'Valid seller ID and amount are required.']);
    }

    if (!isset($_FILES['receipt']) || $_FILES['receipt']['error'] !== UPLOAD_ERR_OK) {
        jsonResponse(422, ['message' => 'Bank receipt image is required.']);
    }

    try {
        $receiptUrl = uploadToCloudinary(
            $_FILES['receipt']['tmp_name'],
            $_FILES['receipt']['name'],
            'Home/Receipts'
        );
    } catch (Throwable $e) {
        jsonResponse(500, ['message' => 'Unable to upload bank receipt.', 'details' => $e->getMessage()]);
    }

    $db = database();

    // Verify available balance
    $stmt = $db->prepare("
        SELECT 
            COALESCE((
                SELECT SUM(o.amount) 
                FROM orders o 
                WHERE o.seller_id = :seller_id AND o.status IN ('shipped', 'completed') AND o.shipped_at <= DATE_SUB(NOW(), INTERVAL 7 DAY)
            ), 0.00) AS releaseable_raw,
            COALESCE((
                SELECT SUM(s.amount) 
                FROM seller_settlements s 
                WHERE s.seller_id = :seller_id
            ), 0.00) AS total_settled
    ");
    $stmt->execute(['seller_id' => $sellerId]);
    $res = $stmt->fetch();
    
    $releaseable = (float) ($res['releaseable_raw'] ?? 0.00);
    $settled = (float) ($res['total_settled'] ?? 0.00);
    $available = max(0.00, $releaseable - $settled);

    if ($amount > $available + 0.01) {
        jsonResponse(422, ['message' => "Settlement amount exceeds available balance. Available: LKR {$available}"]);
    }

    $insert = $db->prepare("
        INSERT INTO seller_settlements (seller_id, amount, receipt_url, created_at)
        VALUES (:seller_id, :amount, :receipt_url, NOW())
    ");
    $insert->execute([
        'seller_id' => $sellerId,
        'amount' => $amount,
        'receipt_url' => $receiptUrl
    ]);

    // Send notification
    createNotification(
        $sellerId,
        'Payment Settled',
        "LKR {$amount} has been settled to your bank account. View receipt in your dashboard.",
        '/dashboard'
    );

    jsonResponse(200, ['message' => 'Payment settled successfully.', 'receipt_url' => $receiptUrl]);
}
