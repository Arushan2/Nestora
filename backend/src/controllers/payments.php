<?php

declare(strict_types=1);

function getAdminPayments(): void
{
    adminOnly();

    $db = database();

    // Fetch all product seller accounts
    $sellersQuery = "
        SELECT 
            u.id AS seller_id,
            u.name,
            u.email,
            pa.business_name,
            pa.bank_name,
            pa.account_holder_name,
            pa.account_number,
            pa.branch
        FROM users u
        INNER JOIN pro_applications pa ON pa.user_id = u.id AND pa.application_type = 'product_seller'
        WHERE u.role = 'product_seller'
        ORDER BY pa.business_name ASC
    ";
    $sellers = $db->query($sellersQuery)->fetchAll();

    foreach ($sellers as &$s) {
        $sellerId = (int) $s['seller_id'];
        $s['seller_id'] = $sellerId;

        // Fetch all pending order items for this seller
        $itemsQuery = "
            SELECT 
                oi.id AS item_id,
                oi.price,
                oi.quantity,
                (oi.price * oi.quantity) AS gross_amount,
                o.order_id,
                o.created_at AS order_date,
                o.shipped_at,
                (SELECT COUNT(*) FROM product_reviews pr WHERE pr.product_id = oi.product_id AND pr.user_id = o.customer_id) > 0 AS is_reviewed,
                (o.shipped_at IS NOT NULL AND o.shipped_at <= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS shipped_7d_ago
            FROM order_items oi
            INNER JOIN orders o ON o.order_id = oi.order_id
            WHERE o.seller_id = :seller_id
              AND o.status IN ('shipped', 'completed')
              AND oi.payback_status = 'pending'
        ";
        $stmt = $db->prepare($itemsQuery);
        $stmt->execute(['seller_id' => $sellerId]);
        $pendingItems = $stmt->fetchAll();

        $eligibleGross = 0.00;
        $eligibleCount = 0;
        $holdingsGross = 0.00;
        $holdingsCount = 0;

        foreach ($pendingItems as $item) {
            $gross = (float) $item['gross_amount'];
            $isReviewed = (bool) $item['is_reviewed'];
            $shipped7d = (bool) $item['shipped_7d_ago'];

            if ($isReviewed || $shipped7d) {
                $eligibleGross += $gross;
                $eligibleCount++;
            } else {
                $holdingsGross += $gross;
                $holdingsCount++;
            }
        }

        // Fetch total settled amount for this seller
        $settledStmt = $db->prepare("
            SELECT 
                COALESCE(SUM(gross_amount), 0.00) AS total_settled_gross,
                COALESCE(SUM(commission_amount), 0.00) AS total_commission_paid,
                COALESCE(SUM(amount), 0.00) AS total_settled_net
            FROM seller_settlements
            WHERE seller_id = :seller_id
        ");
        $settledStmt->execute(['seller_id' => $sellerId]);
        $settledRes = $settledStmt->fetch();

        $commission = round($eligibleGross * 0.10, 2);
        $eligibleNet = $eligibleGross - $commission;

        $s['pending_eligible_gross'] = $eligibleGross;
        $s['pending_commission'] = $commission;
        $s['pending_eligible_net'] = $eligibleNet;
        $s['eligible_items_count'] = $eligibleCount;

        $s['holdings_gross'] = $holdingsGross;
        $s['holdings_count'] = $holdingsCount;

        $s['total_settled_gross'] = (float) ($settledRes['total_settled_gross'] ?? 0.00);
        $s['total_commission_paid'] = (float) ($settledRes['total_commission_paid'] ?? 0.00);
        $s['total_settled_net'] = (float) ($settledRes['total_settled_net'] ?? 0.00);

        // Available balance is the net amount eligible for payout
        $s['available_balance'] = $eligibleNet;
    }

    // Fetch recent completed settlements
    $settlementsQuery = "
        SELECT 
            s.id,
            s.seller_id,
            s.gross_amount,
            s.commission_amount,
            s.amount AS net_amount,
            s.receipt_url,
            s.created_at,
            u.name AS seller_name,
            pa.business_name AS seller_business_name,
            (SELECT COUNT(*) FROM order_items oi WHERE oi.seller_settlement_id = s.id) AS items_count
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
        $set['gross_amount'] = (float) ($set['gross_amount'] ?? $set['net_amount']);
        $set['commission_amount'] = (float) ($set['commission_amount'] ?? 0.00);
        $set['net_amount'] = (float) $set['net_amount'];
        $set['items_count'] = (int) $set['items_count'];
    }

    jsonResponse(200, [
        'sellers' => $sellers,
        'settlements' => $settlements
    ]);
}

function getAdminSellerItems(): void
{
    adminOnly();

    $sellerId = (int) ($_GET['seller_id'] ?? 0);
    if ($sellerId <= 0) {
        jsonResponse(422, ['message' => 'Valid seller ID is required.']);
    }

    $db = database();

    $itemsQuery = "
        SELECT 
            oi.id AS item_id,
            oi.order_id,
            oi.product_id,
            oi.title,
            oi.price,
            oi.quantity,
            (oi.price * oi.quantity) AS gross_total,
            oi.payback_status,
            o.created_at AS order_date,
            o.shipped_at,
            (SELECT COUNT(*) FROM product_reviews pr WHERE pr.product_id = oi.product_id AND pr.user_id = o.customer_id) > 0 AS is_reviewed,
            (o.shipped_at IS NOT NULL AND o.shipped_at <= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS shipped_7d_ago
        FROM order_items oi
        INNER JOIN orders o ON o.order_id = oi.order_id
        WHERE o.seller_id = :seller_id
          AND o.status IN ('shipped', 'completed')
          AND oi.payback_status = 'pending'
        ORDER BY o.created_at ASC
    ";
    $stmt = $db->prepare($itemsQuery);
    $stmt->execute(['seller_id' => $sellerId]);
    $rawItems = $stmt->fetchAll();

    $items = [];
    foreach ($rawItems as $item) {
        $gross = (float) $item['gross_total'];
        $commission = round($gross * 0.10, 2);
        $net = $gross - $commission;
        $isReviewed = (bool) $item['is_reviewed'];
        $shipped7d = (bool) $item['shipped_7d_ago'];
        $isEligible = $isReviewed || $shipped7d;

        $items[] = [
            'item_id' => (int) $item['item_id'],
            'order_id' => $item['order_id'],
            'product_id' => (int) $item['product_id'],
            'title' => $item['title'],
            'price' => (float) $item['price'],
            'quantity' => (int) $item['quantity'],
            'gross_total' => $gross,
            'commission' => $commission,
            'net_total' => $net,
            'order_date' => $item['order_date'],
            'shipped_at' => $item['shipped_at'],
            'is_reviewed' => $isReviewed,
            'shipped_7d_ago' => $shipped7d,
            'is_eligible' => $isEligible,
            'can_remove' => !$isReviewed && $shipped7d,
            'eligibility_type' => $isReviewed ? 'reviewed' : ($shipped7d ? 'shipped_7d' : 'locked'),
        ];
    }

    jsonResponse(200, ['items' => $items]);
}

function settlePayment(): void
{
    adminOnly();

    $sellerId = (int) ($_POST['seller_id'] ?? 0);
    $itemIdsRaw = $_POST['item_ids'] ?? null;

    if ($sellerId <= 0) {
        jsonResponse(422, ['message' => 'Valid seller ID is required.']);
    }

    if (!isset($_FILES['receipt']) || $_FILES['receipt']['error'] !== UPLOAD_ERR_OK) {
        jsonResponse(422, ['message' => 'Bank receipt image is required.']);
    }

    $db = database();

    // Parse selected item IDs if provided
    $itemIds = [];
    if (!empty($itemIdsRaw)) {
        if (is_array($itemIdsRaw)) {
            $itemIds = array_map('intval', $itemIdsRaw);
        } else {
            $decoded = json_decode((string) $itemIdsRaw, true);
            if (is_array($decoded)) {
                $itemIds = array_map('intval', $decoded);
            }
        }
    }

    // Fetch candidate pending items for this seller
    if (!empty($itemIds)) {
        $inClause = implode(',', array_fill(0, count($itemIds), '?'));
        $sql = "
            SELECT 
                oi.id AS item_id,
                (oi.price * oi.quantity) AS gross_total,
                (SELECT COUNT(*) FROM product_reviews pr WHERE pr.product_id = oi.product_id AND pr.user_id = o.customer_id) > 0 AS is_reviewed,
                (o.shipped_at IS NOT NULL AND o.shipped_at <= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS shipped_7d_ago
            FROM order_items oi
            INNER JOIN orders o ON o.order_id = oi.order_id
            WHERE o.seller_id = ?
              AND o.status IN ('shipped', 'completed')
              AND oi.payback_status = 'pending'
              AND oi.id IN ($inClause)
        ";
        $params = array_merge([$sellerId], $itemIds);
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
    } else {
        // Fallback: fetch all eligible items for seller
        $sql = "
            SELECT 
                oi.id AS item_id,
                (oi.price * oi.quantity) AS gross_total,
                (SELECT COUNT(*) FROM product_reviews pr WHERE pr.product_id = oi.product_id AND pr.user_id = o.customer_id) > 0 AS is_reviewed,
                (o.shipped_at IS NOT NULL AND o.shipped_at <= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS shipped_7d_ago
            FROM order_items oi
            INNER JOIN orders o ON o.order_id = oi.order_id
            WHERE o.seller_id = ?
              AND o.status IN ('shipped', 'completed')
              AND oi.payback_status = 'pending'
        ";
        $stmt = $db->prepare($sql);
        $stmt->execute([$sellerId]);
    }

    $eligibleItems = $stmt->fetchAll();

    if (empty($eligibleItems)) {
        jsonResponse(422, ['message' => 'No eligible pending items found to settle for this seller.']);
    }

    $selectedItemIds = [];
    $grossTotal = 0.00;

    foreach ($eligibleItems as $item) {
        $isReviewed = (bool) $item['is_reviewed'];
        $shipped7d = (bool) $item['shipped_7d_ago'];
        if ($isReviewed || $shipped7d) {
            $selectedItemIds[] = (int) $item['item_id'];
            $grossTotal += (float) $item['gross_total'];
        }
    }

    if (empty($selectedItemIds) || $grossTotal <= 0.0) {
        jsonResponse(422, ['message' => 'Selected items are not eligible for settlement.']);
    }

    $commissionAmount = round($grossTotal * 0.10, 2);
    $netAmount = round($grossTotal - $commissionAmount, 2);

    try {
        $receiptUrl = uploadToCloudinary(
            $_FILES['receipt']['tmp_name'],
            $_FILES['receipt']['name'],
            'Home/Receipts'
        );
    } catch (Throwable $e) {
        jsonResponse(500, ['message' => 'Unable to upload bank receipt.', 'details' => $e->getMessage()]);
    }

    $db->beginTransaction();
    try {
        // Insert settlement record
        $insert = $db->prepare("
            INSERT INTO seller_settlements (seller_id, gross_amount, commission_amount, amount, receipt_url, created_at)
            VALUES (:seller_id, :gross_amount, :commission_amount, :amount, :receipt_url, NOW())
        ");
        $insert->execute([
            'seller_id' => $sellerId,
            'gross_amount' => $grossTotal,
            'commission_amount' => $commissionAmount,
            'amount' => $netAmount,
            'receipt_url' => $receiptUrl
        ]);
        $settlementId = (int) $db->lastInsertId();

        // Mark items as settled
        $inClause = implode(',', array_fill(0, count($selectedItemIds), '?'));
        $updateItems = $db->prepare("
            UPDATE order_items 
            SET payback_status = 'settled',
                seller_settlement_id = ?,
                settled_at = NOW()
            WHERE id IN ($inClause)
        ");
        $updateItems->execute(array_merge([$settlementId], $selectedItemIds));

        $db->commit();
    } catch (Throwable $e) {
        $db->rollBack();
        jsonResponse(500, ['message' => 'Failed to process settlement transaction.', 'details' => $e->getMessage()]);
    }

    // Send notification
    createNotification(
        $sellerId,
        'Payment Settled',
        "LKR " . number_format($netAmount, 2) . " has been settled to your bank account (10% platform commission deducted: LKR " . number_format($commissionAmount, 2) . "). View details in Payments.",
        '/dashboard?tab=payments'
    );

    jsonResponse(200, [
        'message' => 'Payment settled successfully.',
        'receipt_url' => $receiptUrl,
        'gross_amount' => $grossTotal,
        'commission_amount' => $commissionAmount,
        'net_amount' => $netAmount,
        'settled_items_count' => count($selectedItemIds)
    ]);
}

function getSellerPayments(): void
{
    $user = currentUserOrFail();
    if ($user['role'] !== 'product_seller') {
        jsonResponse(403, ['message' => 'Access denied. Product seller account required.']);
    }

    $sellerId = (int) $user['id'];
    $db = database();

    // Fetch Bank Details from pro_applications
    $appStmt = $db->prepare("
        SELECT bank_name, account_holder_name, account_number, branch, business_name 
        FROM pro_applications 
        WHERE user_id = :seller_id AND application_type = 'product_seller'
        LIMIT 1
    ");
    $appStmt->execute(['seller_id' => $sellerId]);
    $bankDetails = $appStmt->fetch() ?: [
        'bank_name' => '',
        'account_holder_name' => '',
        'account_number' => '',
        'branch' => '',
        'business_name' => ''
    ];

    // Fetch Pending Order Items
    $pendingQuery = "
        SELECT 
            oi.id AS item_id,
            oi.order_id,
            oi.product_id,
            oi.title,
            oi.price,
            oi.quantity,
            (oi.price * oi.quantity) AS gross_amount,
            o.created_at AS order_date,
            o.shipped_at,
            (SELECT COUNT(*) FROM product_reviews pr WHERE pr.product_id = oi.product_id AND pr.user_id = o.customer_id) > 0 AS is_reviewed,
            (o.shipped_at IS NOT NULL AND o.shipped_at <= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS shipped_7d_ago
        FROM order_items oi
        INNER JOIN orders o ON o.order_id = oi.order_id
        WHERE o.seller_id = :seller_id
          AND o.status IN ('shipped', 'completed')
          AND oi.payback_status = 'pending'
        ORDER BY o.created_at DESC
    ";
    $stmt = $db->prepare($pendingQuery);
    $stmt->execute(['seller_id' => $sellerId]);
    $pendingRaw = $stmt->fetchAll();

    $pendingItems = [];
    $totalPendingGross = 0.00;
    $totalPendingCommission = 0.00;
    $totalPendingNet = 0.00;

    foreach ($pendingRaw as $item) {
        $gross = (float) $item['gross_amount'];
        $commission = round($gross * 0.10, 2);
        $net = $gross - $commission;
        $isReviewed = (bool) $item['is_reviewed'];
        $shipped7d = (bool) $item['shipped_7d_ago'];
        $isEligible = $isReviewed || $shipped7d;

        if ($isEligible) {
            $totalPendingGross += $gross;
            $totalPendingCommission += $commission;
            $totalPendingNet += $net;
        }

        $pendingItems[] = [
            'item_id' => (int) $item['item_id'],
            'order_id' => $item['order_id'],
            'product_id' => (int) $item['product_id'],
            'title' => $item['title'],
            'price' => (float) $item['price'],
            'quantity' => (int) $item['quantity'],
            'gross_amount' => $gross,
            'commission' => $commission,
            'net_amount' => $net,
            'order_date' => $item['order_date'],
            'shipped_at' => $item['shipped_at'],
            'is_reviewed' => $isReviewed,
            'shipped_7d_ago' => $shipped7d,
            'is_eligible' => $isEligible,
            'eligibility_status' => $isReviewed ? 'Reviewed by Customer' : ($shipped7d ? 'Shipped 7+ Days Ago' : 'Locked (Pending 7 Days)'),
        ];
    }

    // Fetch Completed Settlements History
    $settlementsQuery = "
        SELECT 
            s.id,
            s.gross_amount,
            s.commission_amount,
            s.amount AS net_amount,
            s.receipt_url,
            s.created_at
        FROM seller_settlements s
        WHERE s.seller_id = :seller_id
        ORDER BY s.created_at DESC
    ";
    $stmtSettlements = $db->prepare($settlementsQuery);
    $stmtSettlements->execute(['seller_id' => $sellerId]);
    $settlementsRaw = $stmtSettlements->fetchAll();

    $settlements = [];
    $totalPaidGross = 0.00;
    $totalPaidCommission = 0.00;
    $totalPaidNet = 0.00;

    foreach ($settlementsRaw as $s) {
        $settlementId = (int) $s['id'];
        $gross = (float) ($s['gross_amount'] ?? $s['net_amount']);
        $comm = (float) ($s['commission_amount'] ?? 0.00);
        $net = (float) $s['net_amount'];

        $totalPaidGross += $gross;
        $totalPaidCommission += $comm;
        $totalPaidNet += $net;

        // Fetch settled order items for this settlement
        $settledItemsStmt = $db->prepare("
            SELECT oi.id AS item_id, oi.order_id, oi.title, oi.price, oi.quantity, (oi.price * oi.quantity) AS gross_amount
            FROM order_items oi
            WHERE oi.seller_settlement_id = :settlement_id
        ");
        $settledItemsStmt->execute(['settlement_id' => $settlementId]);
        $settledItems = $settledItemsStmt->fetchAll();

        foreach ($settledItems as &$si) {
            $si['item_id'] = (int) $si['item_id'];
            $si['price'] = (float) $si['price'];
            $si['quantity'] = (int) $si['quantity'];
            $si['gross_amount'] = (float) $si['gross_amount'];
        }

        $settlements[] = [
            'id' => $settlementId,
            'gross_amount' => $gross,
            'commission_amount' => $comm,
            'net_amount' => $net,
            'receipt_url' => $s['receipt_url'],
            'created_at' => $s['created_at'],
            'items' => $settledItems
        ];
    }

    jsonResponse(200, [
        'bank_details' => [
            'bank_name' => $bankDetails['bank_name'] ?? '',
            'account_holder_name' => $bankDetails['account_holder_name'] ?? '',
            'account_number' => $bankDetails['account_number'] ?? '',
            'branch' => $bankDetails['branch'] ?? '',
            'business_name' => $bankDetails['business_name'] ?? ''
        ],
        'pending_items' => $pendingItems,
        'settlements' => $settlements,
        'summary' => [
            'total_pending_gross' => $totalPendingGross,
            'total_pending_commission' => $totalPendingCommission,
            'total_pending_net' => $totalPendingNet,
            'total_paid_gross' => $totalPaidGross,
            'total_paid_commission' => $totalPaidCommission,
            'total_paid_net' => $totalPaidNet,
        ]
    ]);
}

function updateSellerBankDetails(): void
{
    $user = currentUserOrFail();
    if ($user['role'] !== 'product_seller') {
        jsonResponse(403, ['message' => 'Access denied. Product seller account required.']);
    }

    $data = readJson();
    if (empty($data) && !empty($_POST)) {
        $data = $_POST;
    }

    $bankName = trim((string) ($data['bank_name'] ?? ''));
    $accountHolder = trim((string) ($data['account_holder_name'] ?? ''));
    $accountNumber = trim((string) ($data['account_number'] ?? ''));
    $branch = trim((string) ($data['branch'] ?? ''));

    if ($bankName === '' || $accountHolder === '' || $accountNumber === '' || $branch === '') {
        jsonResponse(422, ['message' => 'All banking details (Bank Name, Account Holder, Account Number, Branch) are required.']);
    }

    $db = database();
    $stmt = $db->prepare("
        UPDATE pro_applications
        SET bank_name = :bank_name,
            account_holder_name = :account_holder_name,
            account_number = :account_number,
            branch = :branch,
            updated_at = NOW()
        WHERE user_id = :seller_id AND application_type = 'product_seller'
    ");
    $stmt->execute([
        'bank_name' => $bankName,
        'account_holder_name' => $accountHolder,
        'account_number' => $accountNumber,
        'branch' => $branch,
        'seller_id' => $user['id']
    ]);

    jsonResponse(200, ['message' => 'Banking details updated successfully.']);
}
