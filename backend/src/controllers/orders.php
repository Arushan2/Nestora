<?php

declare(strict_types=1);

function generateOrderReference(): string
{
    return '#NES-' . strtoupper(bin2hex(random_bytes(3)));
}

function createOrder(): void
{
    $user = currentUserOrFail();
    
    $address = trim((string) ($_POST['delivery_address'] ?? ''));
    $itemsJson = trim((string) ($_POST['items'] ?? ''));

    if ($address === '' || $itemsJson === '') {
        jsonResponse(422, ['message' => 'Delivery address and items list are required.']);
    }

    $items = json_decode($itemsJson, true);
    if (!is_array($items) || empty($items)) {
        jsonResponse(422, ['message' => 'Invalid or empty items list.']);
    }

    if (!isset($_FILES['receipt']) || $_FILES['receipt']['error'] !== UPLOAD_ERR_OK) {
        jsonResponse(422, ['message' => 'Bank transfer receipt image or PDF is required.']);
    }

    $sellerGroups = [];
    $db = database();

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

        if ((int) $product['stock_units'] < $quantity) {
            jsonResponse(422, ['message' => "Insufficient stock for product: {$product['title']}. Available: {$product['stock_units']}"]);
        }

        $sellerId = (int) $product['user_id'];
        $sellerGroups[$sellerId][] = [
            'product' => $product,
            'quantity' => $quantity,
            'price' => (float) $product['price']
        ];
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

    $db->beginTransaction();
    try {
        $createdOrders = [];
        foreach ($sellerGroups as $sellerId => $groupItems) {
            $orderNumber = generateOrderReference();
            $shippingFee = 0.0;
            $itemsTotal = 0.0;

            foreach ($groupItems as $gItem) {
                $itemsTotal += $gItem['price'] * $gItem['quantity'];
                $shippingFee += (float) ($gItem['product']['shipping_fee'] ?? 0.0);
            }

            $totalCost = $itemsTotal + $shippingFee;

            // Insert parent order using actual DB column names
            $orderStmt = $db->prepare('
                INSERT INTO orders (order_number, customer_id, seller_id, delivery_address, items_total, shipping_fee, total_cost, status, receipt_url, created_at, updated_at)
                VALUES (:order_number, :customer_id, :seller_id, :delivery_address, :items_total, :shipping_fee, :total_cost, "awaiting_verification", :receipt_url, NOW(), NOW())
            ');
            $orderStmt->execute([
                'order_number' => $orderNumber,
                'customer_id' => $user['id'],
                'seller_id' => $sellerId,
                'delivery_address' => $address,
                'items_total' => $itemsTotal,
                'shipping_fee' => $shippingFee,
                'total_cost' => $totalCost,
                'receipt_url' => $receiptUrl
            ]);

            $orderId = (int) $db->lastInsertId();

            // Insert order items using actual DB column names
            $itemStmt = $db->prepare('
                INSERT INTO order_items (order_id, product_id, title, price, quantity, created_at)
                VALUES (:order_id, :product_id, :title, :price, :quantity, NOW())
            ');

            $inventoryManager = new \Nestora\Inventory\InventoryManager($db);
            foreach ($groupItems as $gItem) {
                $pid = (int) $gItem['product']['id'];
                $qty = (int) $gItem['quantity'];

                $itemStmt->execute([
                    'order_id' => $orderId,
                    'product_id' => $pid,
                    'title' => $gItem['product']['title'],
                    'price' => $gItem['price'],
                    'quantity' => $qty
                ]);

                $inventoryManager->deductStock($pid, $qty);
            }

            $createdOrders[] = [
                'order_number' => $orderNumber,
                'seller_id' => $sellerId,
            ];
        }
        $db->commit();

        // Send notifications
        foreach ($createdOrders as $co) {
            // Notify buyer
            createNotification(
                (int) $user['id'],
                'Order Placed',
                "Your order {$co['order_number']} has been placed and is awaiting payment verification.",
                '/orders'
            );
            // Notify seller
            createNotification(
                (int) $co['seller_id'],
                'New Order Received',
                "New order {$co['order_number']} is awaiting payment verification.",
                '/dashboard?tab=orders'
            );
        }
    } catch (Throwable $e) {
        $db->rollBack();
        jsonResponse(500, ['message' => 'Failed to create order in database.', 'details' => $e->getMessage()]);
    }

    jsonResponse(201, ['message' => 'Order placed successfully. Awaiting payment verification.']);
}

function listMyOrders(): void
{
    $user = currentUserOrFail();
    $db = database();

    $stmt = $db->prepare('SELECT * FROM orders WHERE customer_id = :customer_id ORDER BY created_at DESC');
    $stmt->execute(['customer_id' => $user['id']]);
    $orders = $stmt->fetchAll();

    foreach ($orders as &$order) {
        $order['id'] = $order['order_id'];
        $order['customer_id'] = (int) $order['customer_id'];
        $order['seller_id'] = $order['seller_id'] !== null ? (int) $order['seller_id'] : null;
        $order['shipping_fee'] = (float) ($order['shipping_fee'] ?? 0.0);
        $order['status'] = strtolower($order['status']);
        
        // Map table fields to match frontend keys
        $order['reference'] = $order['order_id'];
        $order['total_price'] = (float) ($order['amount'] ?? 0.0);
        $order['bank_receipt_url'] = $order['payhere_payment_id'];

        // Get items for this order
        $itemsStmt = $db->prepare('
            SELECT oi.*, p.images, p.unit_type, u.name AS seller_name, a.business_name AS seller_business_name,
                   (SELECT COUNT(*) FROM product_reviews pr WHERE pr.product_id = oi.product_id AND pr.user_id = :user_id) > 0 AS reviewed
            FROM order_items oi
            LEFT JOIN product_listings p ON p.id = oi.product_id
            LEFT JOIN users u ON u.id = p.user_id
            LEFT JOIN pro_applications a ON a.user_id = p.user_id
            WHERE oi.order_id = :order_id
        ');
        $itemsStmt->execute([
            'order_id' => $order['order_id'],
            'user_id' => $user['id']
        ]);
        $items = $itemsStmt->fetchAll();

        foreach ($items as &$item) {
            $item['id'] = (int) $item['id'];
            $item['order_id'] = $item['order_id'];
            $item['product_id'] = (int) $item['product_id'];
            $item['quantity'] = (int) $item['quantity'];
            $item['price'] = (float) $item['price'];
            $item['reviewed'] = (bool) $item['reviewed'];
            $item['images'] = json_decode((string) ($item['images'] ?? '[]'), true);
        }

        $order['items'] = $items;
    }

    jsonResponse(200, ['orders' => $orders]);
}

function listSellerOrders(): void
{
    $user = currentUserOrFail();
    if ($user['role'] !== 'product_seller' && $user['role'] !== 'admin') {
        jsonResponse(403, ['message' => 'Access denied. Product sellers only.']);
    }

    $db = database();
    $sellerId = $user['id'];

    $ordersStmt = $db->prepare('
        SELECT o.*, u.name AS customer_name, u.email AS customer_email
        FROM orders o
        INNER JOIN users u ON u.id = o.customer_id
        WHERE o.seller_id = :seller_id AND o.status != "PENDING"
        ORDER BY o.created_at DESC
    ');
    $ordersStmt->execute(['seller_id' => $sellerId]);
    $orders = $ordersStmt->fetchAll();

    foreach ($orders as &$order) {
        $order['id'] = $order['order_id'];
        $order['customer_id'] = (int) $order['customer_id'];
        $order['seller_id'] = $order['seller_id'] !== null ? (int) $order['seller_id'] : null;
        $order['shipping_fee'] = (float) ($order['shipping_fee'] ?? 0.0);
        $order['status'] = strtolower($order['status']);
        
        // Map database fields to frontend keys
        $order['reference'] = $order['order_id'];
        $order['total_price'] = (float) ($order['amount'] ?? 0.0);
        $order['bank_receipt_url'] = $order['payhere_payment_id'];

        $itemsStmt = $db->prepare('
            SELECT oi.*, p.images, p.unit_type
            FROM order_items oi
            LEFT JOIN product_listings p ON p.id = oi.product_id
            WHERE oi.order_id = :order_id
        ');
        $itemsStmt->execute(['order_id' => $order['order_id']]);
        $items = $itemsStmt->fetchAll();

        foreach ($items as &$item) {
            $item['id'] = (int) $item['id'];
            $item['order_id'] = $item['order_id'];
            $item['product_id'] = (int) $item['product_id'];
            $item['quantity'] = (int) $item['quantity'];
            $item['price'] = (float) $item['price'];
            $item['images'] = json_decode((string) ($item['images'] ?? '[]'), true);
        }

        $order['items'] = $items;
    }

    jsonResponse(200, ['orders' => $orders]);
}

function verifyPayment(string $orderId): void
{
    $user = currentUserOrFail();
    if ($user['role'] !== 'product_seller' && $user['role'] !== 'admin') {
        jsonResponse(403, ['message' => 'Access denied. Product sellers only.']);
    }

    $db = database();
    
    $verifyStmt = $db->prepare('SELECT customer_id FROM orders WHERE order_id = :order_id AND seller_id = :seller_id LIMIT 1');
    $verifyStmt->execute([
        'order_id' => $orderId,
        'seller_id' => $user['id']
    ]);
    $order = $verifyStmt->fetch();
    if ($order === false) {
        jsonResponse(403, ['message' => 'You do not have permission to modify this order.']);
    }
    $customerId = (int) $order['customer_id'];

    $stmt = $db->prepare('
        UPDATE orders
        SET status = "processing", updated_at = NOW()
        WHERE order_id = :order_id AND status = "awaiting_verification"
    ');
    $stmt->execute(['order_id' => $orderId]);

    if ($stmt->rowCount() === 0) {
        jsonResponse(400, ['message' => 'Order cannot be set to processing (must be in awaiting verification status).']);
    }

    // Notify Buyer
    createNotification(
        $customerId,
        'Payment Verified',
        "Payment receipt for order {$orderId} has been verified. Your order is now processing.",
        '/orders'
    );

    jsonResponse(200, ['message' => 'Payment verified successfully. Order is now processing.']);
}

function shipOrder(string $orderId): void
{
    $user = currentUserOrFail();
    if ($user['role'] !== 'product_seller' && $user['role'] !== 'admin') {
        jsonResponse(403, ['message' => 'Access denied. Product sellers only.']);
    }

    $data = readJson();
    $courierName = trim((string) ($data['courier_name'] ?? ''));
    $trackingNumber = trim((string) ($data['tracking_number'] ?? ''));

    if ($courierName === '' || $trackingNumber === '') {
        jsonResponse(422, ['message' => 'Both courier name and tracking details are required.']);
    }

    $db = database();
    
    $verifyStmt = $db->prepare('SELECT customer_id, status FROM orders WHERE order_id = :order_id AND seller_id = :seller_id LIMIT 1');
    $verifyStmt->execute([
        'order_id' => $orderId,
        'seller_id' => $user['id']
    ]);
    $order = $verifyStmt->fetch();
    if ($order === false) {
        jsonResponse(403, ['message' => 'You do not have permission to ship this order.']);
    }
    $customerId = (int) $order['customer_id'];
    $previousStatus = strtolower($order['status']);

    $stmt = $db->prepare('
        UPDATE orders
        SET status = "shipped", courier_name = :courier_name, tracking_number = :tracking_number, shipped_at = NOW(), updated_at = NOW()
        WHERE order_id = :order_id AND (status = "processing" OR status = "not_received")
    ');
    $stmt->execute([
        'courier_name' => $courierName,
        'tracking_number' => $trackingNumber,
        'order_id' => $orderId
    ]);

    if ($stmt->rowCount() === 0) {
        jsonResponse(400, ['message' => 'Order cannot be shipped or reshipped (must be in processing or not_received status).']);
    }

    // Determine if this is a dispatch or reshipment
    $isReship = ($previousStatus === 'not_received');
    $notificationTitle = $isReship ? 'Order Reshipped' : 'Order Shipped';
    $notificationMsg = $isReship
        ? "Your order {$orderId} has been reshipped via {$courierName} with a new tracking ID: {$trackingNumber}."
        : "Your order {$orderId} has been shipped via {$courierName}. Tracking Number: {$trackingNumber}.";

    // Notify Buyer
    createNotification(
        $customerId,
        $notificationTitle,
        $notificationMsg,
        '/orders'
    );

    jsonResponse(200, ['message' => $isReship ? 'Order reshipped successfully.' : 'Order marked as shipped successfully.']);
}

function completeOrder(string $orderId): void
{
    $user = currentUserOrFail();
    $db = database();

    // Query seller ID before status update
    $orderStmt = $db->prepare('SELECT seller_id FROM orders WHERE order_id = :order_id LIMIT 1');
    $orderStmt->execute(['order_id' => $orderId]);
    $order = $orderStmt->fetch();
    $sellerId = $order && $order['seller_id'] !== null ? (int) $order['seller_id'] : null;

    $stmt = $db->prepare('
        UPDATE orders
        SET status = "completed", updated_at = NOW()
        WHERE order_id = :order_id AND customer_id = :customer_id AND status = "shipped"
    ');
    $stmt->execute([
        'order_id' => $orderId,
        'customer_id' => $user['id']
      ]);

    if ($stmt->rowCount() === 0) {
        jsonResponse(400, ['message' => 'Order cannot be completed (must be in shipped status and belong to you).']);
    }

    // Notify Seller
    if ($sellerId !== null) {
        createNotification(
            $sellerId,
            'Order Completed',
            "Customer has confirmed receipt for order {$orderId}. The order is now completed.",
            '/dashboard?tab=orders'
        );
    }

    jsonResponse(200, ['message' => 'Order completed. You can now leave a review.']);
}

function flagNotReceived(string $orderId): void
{
    $user = currentUserOrFail();
    $db = database();

    // Query seller ID before status update
    $orderStmt = $db->prepare('SELECT seller_id FROM orders WHERE order_id = :order_id LIMIT 1');
    $orderStmt->execute(['order_id' => $orderId]);
    $order = $orderStmt->fetch();
    $sellerId = $order && $order['seller_id'] !== null ? (int) $order['seller_id'] : null;

    $stmt = $db->prepare('
        UPDATE orders
        SET status = "not_received", updated_at = NOW()
        WHERE order_id = :order_id AND customer_id = :customer_id AND status = "shipped"
    ');
    $stmt->execute([
        'order_id' => $orderId,
        'customer_id' => $user['id']
    ]);

    if ($stmt->rowCount() === 0) {
        jsonResponse(400, ['message' => 'Order cannot be flagged as not received (must be in shipped status).']);
    }

    // Notify Seller
    if ($sellerId !== null) {
        createNotification(
            $sellerId,
            'Order Dispute: Not Received',
            "Customer has flagged order {$orderId} as NOT received. Please check shipment tracking.",
            '/dashboard?tab=orders'
        );
    }

    // Notify Admins
    try {
        $admins = $db->query("SELECT id FROM users WHERE role = 'admin'")->fetchAll();
        foreach ($admins as $admin) {
            createNotification(
                (int) $admin['id'],
                'Order Dispute Filed',
                "Order {$orderId} has been flagged as not received by the customer.",
                '/admin'
            );
        }
    } catch (Throwable $e) {
        error_log('Admin notification error: ' . $e->getMessage());
    }

    jsonResponse(200, ['message' => 'Order has been flagged as not received.']);
}

function createProductReview(int $productId): void
{
    $user = currentUserOrFail();
    $data = readJson();

    $rating = (int) ($data['rating'] ?? 0);
    $comment = trim((string) ($data['comment'] ?? ''));

    if ($rating < 1 || $rating > 5 || $comment === '') {
        jsonResponse(422, ['message' => 'Rating must be between 1 and 5, and comment is required.']);
    }

    $db = database();

    $verifyStmt = $db->prepare('
        SELECT 1
        FROM orders o
        INNER JOIN order_items oi ON oi.order_id = o.order_id
        WHERE o.customer_id = :customer_id AND oi.product_id = :product_id AND o.status = "completed"
        LIMIT 1
    ');
    $verifyStmt->execute([
        'customer_id' => $user['id'],
        'product_id' => $productId
    ]);

    if ($verifyStmt->fetch() === false) {
        jsonResponse(403, ['message' => 'You can only review products you have purchased and received.']);
    }

    $duplicateStmt = $db->prepare('
        SELECT 1 FROM product_reviews
        WHERE product_id = :product_id AND user_id = :user_id
        LIMIT 1
    ');
    $duplicateStmt->execute([
        'product_id' => $productId,
        'user_id' => $user['id']
    ]);

    if ($duplicateStmt->fetch() !== false) {
        jsonResponse(409, ['message' => 'You have already reviewed this product.']);
    }

    $stmt = $db->prepare('
        INSERT INTO product_reviews (product_id, user_id, rating, comment, created_at)
        VALUES (:product_id, :user_id, :rating, :comment, NOW())
    ');
    $stmt->execute([
        'product_id' => $productId,
        'user_id' => $user['id'],
        'rating' => $rating,
        'comment' => $comment
    ]);

    jsonResponse(201, ['message' => 'Review submitted successfully.']);
}

function getProductReviews(int $productId): void
{
    $db = database();

    $stmt = $db->prepare('
        SELECT r.*, u.name AS reviewer_name
        FROM product_reviews r
        INNER JOIN users u ON u.id = r.user_id
        WHERE r.product_id = :product_id
        ORDER BY r.created_at DESC
    ');
    $stmt->execute(['product_id' => $productId]);
    $reviews = $stmt->fetchAll();

    $totalRating = 0;
    foreach ($reviews as &$review) {
        $review['id'] = (int) $review['id'];
        $review['product_id'] = (int) $review['product_id'];
        $review['user_id'] = (int) $review['user_id'];
        $review['rating'] = (int) $review['rating'];
        $totalRating += $review['rating'];
    }

    $count = count($reviews);
    $averageRating = $count > 0 ? round($totalRating / $count, 1) : 0.0;

    jsonResponse(200, [
        'reviews' => $reviews,
        'average_rating' => $averageRating,
        'total_reviews' => $count
    ]);
}

function completeOrderPayment(string $orderId): void
{
    $user = currentUserOrFail();
    $db = database();

    // Query order detail to verify owner and pending status
    $stmt = $db->prepare('SELECT * FROM orders WHERE order_id = :order_id AND customer_id = :customer_id LIMIT 1');
    $stmt->execute([
        'order_id' => $orderId,
        'customer_id' => $user['id']
    ]);
    $order = $stmt->fetch();

    if ($order === false) {
        jsonResponse(404, ['message' => 'Order not found.']);
    }

    $currentStatus = strtolower($order['status']);
    if ($currentStatus !== 'pending') {
        // If it's already processing, shipped or completed, return success (idempotent behavior)
        if (in_array($currentStatus, ['processing', 'shipped', 'completed'])) {
            jsonResponse(200, [
                'message' => 'Payment already processed.',
                'status' => $currentStatus,
                'payhere_payment_id' => $order['payhere_payment_id']
            ]);
        }
        jsonResponse(400, ['message' => 'Order payment cannot be completed in its current state.']);
    }

    // Generate a unique transaction reference for tracking
    $paymentId = 'PAY-' . strtoupper(bin2hex(random_bytes(6)));

    $updateStmt = $db->prepare('
        UPDATE orders
        SET status = "processing", payhere_payment_id = :payment_id, updated_at = NOW()
        WHERE order_id = :order_id AND status = "PENDING"
    ');
    $updateStmt->execute([
        'payment_id' => $paymentId,
        'order_id' => $orderId
    ]);

    if ($updateStmt->rowCount() === 0) {
        jsonResponse(500, ['message' => 'Failed to update order status.']);
    }

    // Deduct stock upon successful payment transition
    try {
        $itemsStmt = $db->prepare('SELECT product_id, quantity FROM order_items WHERE order_id = :order_id');
        $itemsStmt->execute(['order_id' => $orderId]);
        $items = $itemsStmt->fetchAll(PDO::FETCH_ASSOC);

        $inventoryManager = new \Nestora\Inventory\InventoryManager($db);
        foreach ($items as $item) {
            $inventoryManager->deductStock((int) $item['product_id'], (int) $item['quantity']);
        }
    } catch (\Throwable $e) {
        error_log('Failed to deduct stock for order ' . $orderId . ': ' . $e->getMessage());
    }

    // Notify Buyer
    createNotification(
        (int) $user['id'],
        'Payment Completed',
        "Your payment for order {$orderId} has been successfully processed. The seller has been notified to ship your order.",
        '/orders'
    );

    // Notify Seller
    if ($order['seller_id'] !== null) {
        createNotification(
            (int) $order['seller_id'],
            'Payment Verified',
            "Payment for order {$orderId} has been completed via PayHere. Please ship the order.",
            '/dashboard?tab=orders'
        );
    }

    jsonResponse(200, [
        'message' => 'Payment completed successfully. Order is now processing.',
        'payhere_payment_id' => $paymentId
    ]);
}

