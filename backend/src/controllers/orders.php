<?php

declare(strict_types=1);

// ==========================================
// Cart Operations
// ==========================================

function getCart(): void
{
    $user = currentUserOrFail();
    $db = database();

    $stmt = $db->prepare(
        "SELECT c.id, c.product_id, c.quantity, p.title, p.price, p.unit_type, p.images, p.shipping_districts, p.shipping_fee, p.user_id as seller_id, a.business_name as seller_business_name
         FROM cart_items c
         INNER JOIN product_listings p ON p.id = c.product_id
         LEFT JOIN pro_applications a ON a.user_id = p.user_id
         WHERE c.user_id = :user_id"
    );
    $stmt->execute(['user_id' => $user['id']]);
    $items = $stmt->fetchAll();

    foreach ($items as &$item) {
        $item['id'] = (int) $item['id'];
        $item['product_id'] = (int) $item['product_id'];
        $item['quantity'] = (int) $item['quantity'];
        $item['price'] = (float) $item['price'];
        $item['seller_id'] = (int) $item['seller_id'];
        $item['images'] = json_decode((string)($item['images'] ?? '[]'), true);
        $item['shipping_districts'] = json_decode((string)($item['shipping_districts'] ?? '[]'), true);
        $item['shipping_fee'] = (float) ($item['shipping_fee'] ?? 0.0);
    }

    jsonResponse(200, ['items' => $items]);
}

function updateCart(): void
{
    $user = currentUserOrFail();
    $data = readJson();

    $productId = (int) ($data['product_id'] ?? 0);
    $quantity = (int) ($data['quantity'] ?? 1);

    if ($productId <= 0) {
        jsonResponse(422, ['message' => 'Product ID is required.']);
    }

    $db = database();

    // Verify product exists
    $pStmt = $db->prepare("SELECT id FROM product_listings WHERE id = :id LIMIT 1");
    $pStmt->execute(['id' => $productId]);
    if (!$pStmt->fetch()) {
        jsonResponse(404, ['message' => 'Product not found.']);
    }

    if ($quantity <= 0) {
        $delStmt = $db->prepare("DELETE FROM cart_items WHERE user_id = :user_id AND product_id = :product_id");
        $delStmt->execute(['user_id' => $user['id'], 'product_id' => $productId]);
        jsonResponse(200, ['message' => 'Item removed from cart.']);
    } else {
        $upStmt = $db->prepare(
            "INSERT INTO cart_items (user_id, product_id, quantity)
             VALUES (:user_id, :product_id, :quantity)
             ON DUPLICATE KEY UPDATE quantity = :quantity_update"
        );
        $upStmt->execute([
            'user_id' => $user['id'],
            'product_id' => $productId,
            'quantity' => $quantity,
            'quantity_update' => $quantity
        ]);
        jsonResponse(200, ['message' => 'Cart updated successfully.']);
    }
}

function removeCartItem(): void
{
    $user = currentUserOrFail();
    $data = readJson();

    $productId = (int) ($data['product_id'] ?? 0);
    if ($productId <= 0) {
        jsonResponse(422, ['message' => 'Product ID is required.']);
    }

    $db = database();
    $delStmt = $db->prepare("DELETE FROM cart_items WHERE user_id = :user_id AND product_id = :product_id");
    $delStmt->execute(['user_id' => $user['id'], 'product_id' => $productId]);
    jsonResponse(200, ['message' => 'Item removed from cart.']);
}

// ==========================================
// Favorites Operations
// ==========================================

function listFavorites(): void
{
    $user = currentUserOrFail();
    $db = database();

    $stmt = $db->prepare(
        "SELECT f.id, f.product_id, p.title, p.price, p.unit_type, p.images, p.category, p.brand
         FROM favorites f
         INNER JOIN product_listings p ON p.id = f.product_id
         WHERE f.user_id = :user_id"
    );
    $stmt->execute(['user_id' => $user['id']]);
    $items = $stmt->fetchAll();

    foreach ($items as &$item) {
        $item['id'] = (int) $item['id'];
        $item['product_id'] = (int) $item['product_id'];
        $item['price'] = (float) $item['price'];
        $item['images'] = json_decode((string)($item['images'] ?? '[]'), true);
    }

    jsonResponse(200, ['favorites' => $items]);
}

function toggleFavorite(): void
{
    $user = currentUserOrFail();
    $data = readJson();

    $productId = (int) ($data['product_id'] ?? 0);
    if ($productId <= 0) {
        jsonResponse(422, ['message' => 'Product ID is required.']);
    }

    $db = database();

    $stmt = $db->prepare("SELECT id FROM favorites WHERE user_id = :user_id AND product_id = :product_id LIMIT 1");
    $stmt->execute(['user_id' => $user['id'], 'product_id' => $productId]);
    $fav = $stmt->fetch();

    if ($fav) {
        $del = $db->prepare("DELETE FROM favorites WHERE id = :id");
        $del->execute(['id' => (int) $fav['id']]);
        jsonResponse(200, ['favorited' => false, 'message' => 'Removed from favorites.']);
    } else {
        $ins = $db->prepare("INSERT INTO favorites (user_id, product_id) VALUES (:user_id, :product_id)");
        $ins->execute(['user_id' => $user['id'], 'product_id' => $productId]);
        jsonResponse(200, ['favorited' => true, 'message' => 'Added to favorites.']);
    }
}

// ==========================================
// Order Flow Operations
// ==========================================

function createOrder(): void
{
    $user = currentUserOrFail();
    
    // Read parameters from multipart form data
    $deliveryAddress = trim((string) ($_POST['delivery_address'] ?? ''));
    $district = trim((string) ($_POST['district'] ?? ''));
    $itemsJson = trim((string) ($_POST['items'] ?? ''));

    if ($deliveryAddress === '' || $district === '') {
        jsonResponse(422, ['message' => 'Delivery address and district are required.']);
    }

    if ($itemsJson === '') {
        jsonResponse(422, ['message' => 'No items specified.']);
    }

    $itemsList = json_decode($itemsJson, true);
    if (!is_array($itemsList) || empty($itemsList)) {
        jsonResponse(422, ['message' => 'Invalid items array.']);
    }

    if (!isset($_FILES['receipt']) || $_FILES['receipt']['error'] !== UPLOAD_ERR_OK) {
        jsonResponse(422, ['message' => 'Payment receipt file is required.']);
    }

    // Upload receipt to Cloudinary
    try {
        $receiptUrl = uploadToCloudinary($_FILES['receipt']['tmp_name'], $_FILES['receipt']['name'], 'Home/Receipts');
    } catch (Throwable $e) {
        jsonResponse(500, ['message' => 'Unable to upload receipt.', 'details' => $e->getMessage()]);
    }

    $db = database();
    
    // Retrieve product details for verification and pricing
    $products = [];
    foreach ($itemsList as $item) {
        $prodId = (int) ($item['product_id'] ?? 0);
        $qty = (int) ($item['quantity'] ?? 1);
        if ($prodId <= 0 || $qty <= 0) {
            jsonResponse(422, ['message' => 'Invalid product id or quantity.']);
        }

        $pStmt = $db->prepare("SELECT * FROM product_listings WHERE id = :id LIMIT 1");
        $pStmt->execute(['id' => $prodId]);
        $prod = $pStmt->fetch();

        if (!$prod) {
            jsonResponse(404, ['message' => "Product ID {$prodId} not found."]);
        }

        $products[] = [
            'listing' => $prod,
            'quantity' => $qty
        ];
    }

    // Group items by seller_id
    $groupedBySeller = [];
    foreach ($products as $p) {
        $sellerId = (int) $p['listing']['user_id'];
        if (!isset($groupedBySeller[$sellerId])) {
            $groupedBySeller[$sellerId] = [];
        }
        $groupedBySeller[$sellerId][] = $p;
    }

    $db->beginTransaction();
    $createdOrders = [];

    try {
        foreach ($groupedBySeller as $sellerId => $sellerProducts) {
            // Find max custom shipping fee for this seller
            $maxCustomFee = 0.0;
            foreach ($sellerProducts as $sp) {
                $itemFee = isset($sp['listing']['shipping_fee']) ? (float) $sp['listing']['shipping_fee'] : 0.0;
                if ($itemFee > $maxCustomFee) {
                    $maxCustomFee = $itemFee;
                }
            }

            $orderShippingFee = $maxCustomFee;
            if ($orderShippingFee <= 0.0) {
                $westernProvince = ['colombo', 'gampaha', 'kalutara'];
                $orderShippingFee = in_array(strtolower($district), $westernProvince, true) ? 350.00 : 550.00;
            }

            // Calculate totals
            $itemsTotal = 0.0;
            foreach ($sellerProducts as $sp) {
                $itemsTotal += ((float) $sp['listing']['price']) * $sp['quantity'];
            }
            $totalCost = $itemsTotal + $orderShippingFee;

            // Generate unique Order Number
            $orderNumber = 'NES-' . date('Ymd') . '-' . mt_rand(1000, 9999) . '-' . mt_rand(10, 99);

            // Create Order record
            $oStmt = $db->prepare(
                "INSERT INTO orders (order_number, customer_id, seller_id, delivery_address, items_total, shipping_fee, total_cost, status, receipt_url, created_at, updated_at)
                 VALUES (:order_number, :customer_id, :seller_id, :delivery_address, :items_total, :shipping_fee, :total_cost, 'awaiting_verification', :receipt_url, NOW(), NOW())"
            );
            $oStmt->execute([
                'order_number' => $orderNumber,
                'customer_id' => $user['id'],
                'seller_id' => $sellerId,
                'delivery_address' => $deliveryAddress . ', ' . $district,
                'items_total' => $itemsTotal,
                'shipping_fee' => $orderShippingFee,
                'total_cost' => $totalCost,
                'receipt_url' => $receiptUrl
            ]);

            $orderId = (int) $db->lastInsertId();

            // Create Order Item records
            foreach ($sellerProducts as $sp) {
                $oiStmt = $db->prepare(
                    "INSERT INTO order_items (order_id, product_id, title, price, quantity, created_at)
                     VALUES (:order_id, :product_id, :title, :price, :quantity, NOW())"
                );
                $oiStmt->execute([
                    'order_id' => $orderId,
                    'product_id' => (int) $sp['listing']['id'],
                    'title' => $sp['listing']['title'],
                    'price' => (float) $sp['listing']['price'],
                    'quantity' => $sp['quantity']
                ]);

                // Remove from cart
                $delCart = $db->prepare("DELETE FROM cart_items WHERE user_id = :user_id AND product_id = :product_id");
                $delCart->execute(['user_id' => $user['id'], 'product_id' => (int) $sp['listing']['id']]);
            }

            $createdOrders[] = $orderNumber;
        }

        $db->commit();
    } catch (Throwable $e) {
        $db->rollBack();
        jsonResponse(500, ['message' => 'Failed to process order creation.', 'details' => $e->getMessage()]);
    }

    jsonResponse(201, ['message' => 'Orders placed successfully.', 'orders' => $createdOrders]);
}

function getCustomerOrders(): void
{
    $user = currentUserOrFail();
    $db = database();

    $stmt = $db->prepare(
        "SELECT o.*, u.name as seller_name, a.business_name as seller_business_name
         FROM orders o
         INNER JOIN users u ON u.id = o.seller_id
         LEFT JOIN pro_applications a ON a.user_id = o.seller_id
         WHERE o.customer_id = :customer_id
         ORDER BY o.created_at DESC"
    );
    $stmt->execute(['customer_id' => $user['id']]);
    $orders = $stmt->fetchAll();

    foreach ($orders as &$order) {
        $order['id'] = (int) $order['id'];
        $order['customer_id'] = (int) $order['customer_id'];
        $order['seller_id'] = (int) $order['seller_id'];
        $order['items_total'] = (float) $order['items_total'];
        $order['shipping_fee'] = (float) $order['shipping_fee'];
        $order['total_cost'] = (float) $order['total_cost'];

        // Get Order Items
        $itemStmt = $db->prepare(
            "SELECT oi.*, p.images
             FROM order_items oi
             LEFT JOIN product_listings p ON p.id = oi.product_id
             WHERE oi.order_id = :order_id"
        );
        $itemStmt->execute(['order_id' => $order['id']]);
        $items = $itemStmt->fetchAll();

        foreach ($items as &$item) {
            $item['id'] = (int) $item['id'];
            $item['order_id'] = (int) $item['order_id'];
            $item['product_id'] = (int) $item['product_id'];
            $item['price'] = (float) $item['price'];
            $item['quantity'] = (int) $item['quantity'];
            $item['images'] = json_decode((string)($item['images'] ?? '[]'), true);

            // Check if reviewed already
            $revStmt = $db->prepare("SELECT id FROM reviews WHERE order_id = :order_id AND product_id = :product_id LIMIT 1");
            $revStmt->execute(['order_id' => $order['id'], 'product_id' => $item['product_id']]);
            $item['reviewed'] = (bool) $revStmt->fetch();
        }

        $order['items'] = $items;
    }

    jsonResponse(200, ['orders' => $orders]);
}

function getSellerOrders(): void
{
    $user = currentUserOrFail();
    if ($user['role'] !== 'product_seller' && $user['role'] !== 'admin') {
        jsonResponse(403, ['message' => 'Only product sellers can access sales orders.']);
    }

    $db = database();

    $stmt = $db->prepare(
        "SELECT o.*, u.name as customer_name, u.email as customer_email
         FROM orders o
         INNER JOIN users u ON u.id = o.customer_id
         WHERE o.seller_id = :seller_id
         ORDER BY o.created_at DESC"
    );
    $stmt->execute(['seller_id' => $user['id']]);
    $orders = $stmt->fetchAll();

    foreach ($orders as &$order) {
        $order['id'] = (int) $order['id'];
        $order['customer_id'] = (int) $order['customer_id'];
        $order['seller_id'] = (int) $order['seller_id'];
        $order['items_total'] = (float) $order['items_total'];
        $order['shipping_fee'] = (float) $order['shipping_fee'];
        $order['total_cost'] = (float) $order['total_cost'];

        // Get Order Items
        $itemStmt = $db->prepare(
            "SELECT oi.*, p.images
             FROM order_items oi
             LEFT JOIN product_listings p ON p.id = oi.product_id
             WHERE oi.order_id = :order_id"
        );
        $itemStmt->execute(['order_id' => $order['id']]);
        $items = $itemStmt->fetchAll();

        foreach ($items as &$item) {
            $item['id'] = (int) $item['id'];
            $item['order_id'] = (int) $item['order_id'];
            $item['product_id'] = (int) $item['product_id'];
            $item['price'] = (float) $item['price'];
            $item['quantity'] = (int) $item['quantity'];
            $item['images'] = json_decode((string)($item['images'] ?? '[]'), true);
        }

        $order['items'] = $items;
    }

    jsonResponse(200, ['orders' => $orders]);
}

// ==========================================
// State Transitions (Backend verification & shipment actions)
// ==========================================

function verifyPayment(int $id): void
{
    $user = currentUserOrFail();
    $db = database();

    $stmt = $db->prepare("SELECT * FROM orders WHERE id = :id LIMIT 1");
    $stmt->execute(['id' => $id]);
    $order = $stmt->fetch();

    if (!$order) {
        jsonResponse(404, ['message' => 'Order not found.']);
    }

    if ((int) $order['seller_id'] !== $user['id'] && $user['role'] !== 'admin') {
        jsonResponse(403, ['message' => 'Unauthorized.']);
    }

    $data = readJson();
    $note = trim((string) ($data['seller_note'] ?? ''));

    $up = $db->prepare("UPDATE orders SET status = 'processing', seller_note = :note, updated_at = NOW() WHERE id = :id");
    $up->execute([
        'note' => $note !== '' ? $note : null,
        'id' => $id
    ]);

    jsonResponse(200, ['message' => 'Payment verified. Order is now being processed/packaged.']);
}

function rejectPayment(int $id): void
{
    $user = currentUserOrFail();
    $db = database();

    $stmt = $db->prepare("SELECT * FROM orders WHERE id = :id LIMIT 1");
    $stmt->execute(['id' => $id]);
    $order = $stmt->fetch();

    if (!$order) {
        jsonResponse(404, ['message' => 'Order not found.']);
    }

    if ((int) $order['seller_id'] !== $user['id'] && $user['role'] !== 'admin') {
        jsonResponse(403, ['message' => 'Unauthorized.']);
    }

    $data = readJson();
    $reason = trim((string) ($data['reason'] ?? 'Payment receipt was invalid or could not be verified. Please upload a clear image/pdf.'));

    $up = $db->prepare("UPDATE orders SET receipt_url = NULL, seller_note = :reason, updated_at = NOW() WHERE id = :id");
    $up->execute([
        'reason' => $reason,
        'id' => $id
    ]);

    jsonResponse(200, ['message' => 'Payment receipt rejected. Customer requested to re-upload.']);
}

function reuploadReceipt(int $id): void
{
    $user = currentUserOrFail();
    $db = database();

    $stmt = $db->prepare("SELECT * FROM orders WHERE id = :id LIMIT 1");
    $stmt->execute(['id' => $id]);
    $order = $stmt->fetch();

    if (!$order) {
        jsonResponse(404, ['message' => 'Order not found.']);
    }

    if ((int) $order['customer_id'] !== $user['id']) {
        jsonResponse(403, ['message' => 'Unauthorized.']);
    }

    if (!isset($_FILES['receipt']) || $_FILES['receipt']['error'] !== UPLOAD_ERR_OK) {
        jsonResponse(422, ['message' => 'Payment receipt file is required.']);
    }

    // Upload receipt to Cloudinary
    try {
        $receiptUrl = uploadToCloudinary($_FILES['receipt']['tmp_name'], $_FILES['receipt']['name'], 'Home/Receipts');
    } catch (Throwable $e) {
        jsonResponse(500, ['message' => 'Unable to upload receipt.', 'details' => $e->getMessage()]);
    }

    $up = $db->prepare("UPDATE orders SET receipt_url = :url, seller_note = NULL, updated_at = NOW() WHERE id = :id");
    $up->execute([
        'url' => $receiptUrl,
        'id' => $id
    ]);

    jsonResponse(200, ['message' => 'Receipt re-uploaded successfully for verification.']);
}

function shipOrder(int $id): void
{
    $user = currentUserOrFail();
    $db = database();

    $stmt = $db->prepare("SELECT * FROM orders WHERE id = :id LIMIT 1");
    $stmt->execute(['id' => $id]);
    $order = $stmt->fetch();

    if (!$order) {
        jsonResponse(404, ['message' => 'Order not found.']);
    }

    if ((int) $order['seller_id'] !== $user['id'] && $user['role'] !== 'admin') {
        jsonResponse(403, ['message' => 'Unauthorized.']);
    }

    $data = readJson();
    $courierName = trim((string) ($data['courier_name'] ?? ''));
    $trackingNumber = trim((string) ($data['tracking_number'] ?? ''));

    if ($courierName === '') {
        jsonResponse(422, ['message' => 'Courier or dispatch delivery description is required.']);
    }

    $up = $db->prepare(
        "UPDATE orders 
         SET status = 'shipped', courier_name = :courier, tracking_number = :tracking, updated_at = NOW() 
         WHERE id = :id"
    );
    $up->execute([
        'courier' => $courierName,
        'tracking' => $trackingNumber !== '' ? $trackingNumber : null,
        'id' => $id
    ]);

    jsonResponse(200, ['message' => 'Order marked as shipped.']);
}

function completeOrder(int $id): void
{
    $user = currentUserOrFail();
    $db = database();

    $stmt = $db->prepare("SELECT * FROM orders WHERE id = :id LIMIT 1");
    $stmt->execute(['id' => $id]);
    $order = $stmt->fetch();

    if (!$order) {
        jsonResponse(404, ['message' => 'Order not found.']);
    }

    if ((int) $order['customer_id'] !== $user['id']) {
        jsonResponse(403, ['message' => 'Unauthorized.']);
    }

    $up = $db->prepare("UPDATE orders SET status = 'completed', updated_at = NOW() WHERE id = :id");
    $up->execute(['id' => $id]);

    jsonResponse(200, ['message' => 'Order marked as completed. Feedback can now be provided.']);
}

function flagOrder(int $id): void
{
    $user = currentUserOrFail();
    $db = database();

    $stmt = $db->prepare("SELECT * FROM orders WHERE id = :id LIMIT 1");
    $stmt->execute(['id' => $id]);
    $order = $stmt->fetch();

    if (!$order) {
        jsonResponse(404, ['message' => 'Order not found.']);
    }

    if ((int) $order['customer_id'] !== $user['id']) {
        jsonResponse(403, ['message' => 'Unauthorized.']);
    }

    $up = $db->prepare("UPDATE orders SET status = 'not_received', updated_at = NOW() WHERE id = :id");
    $up->execute(['id' => $id]);

    jsonResponse(200, ['message' => 'Order flagged as not received. Support has been notified.']);
}

// ==========================================
// Ratings & Reviews Operations
// ==========================================

function createReview(): void
{
    $user = currentUserOrFail();
    $data = readJson();

    $orderId = (int) ($data['order_id'] ?? 0);
    $productId = (int) ($data['product_id'] ?? 0);
    $productRating = (int) ($data['product_rating'] ?? 5);
    $sellerRating = (int) ($data['seller_rating'] ?? 5);
    $comment = trim((string) ($data['comment'] ?? ''));

    if ($orderId <= 0 || $productId <= 0) {
        jsonResponse(422, ['message' => 'Order ID and Product ID are required.']);
    }

    if ($productRating < 1 || $productRating > 5 || $sellerRating < 1 || $sellerRating > 5) {
        jsonResponse(422, ['message' => 'Ratings must be between 1 and 5.']);
    }

    $db = database();

    // Verify order exists, belongs to user, and is completed
    $oStmt = $db->prepare("SELECT * FROM orders WHERE id = :id AND customer_id = :customer_id LIMIT 1");
    $oStmt->execute(['id' => $orderId, 'customer_id' => $user['id']]);
    $order = $oStmt->fetch();

    if (!$order) {
        jsonResponse(404, ['message' => 'Order not found or unauthorized.']);
    }

    if ($order['status'] !== 'completed') {
        jsonResponse(400, ['message' => 'Reviews can only be written for completed/received orders.']);
    }

    // Verify product is in this order
    $itemStmt = $db->prepare("SELECT id FROM order_items WHERE order_id = :order_id AND product_id = :product_id LIMIT 1");
    $itemStmt->execute(['order_id' => $orderId, 'product_id' => $productId]);
    if (!$itemStmt->fetch()) {
        jsonResponse(400, ['message' => 'Product was not part of this order.']);
    }

    // Check if reviewed already
    $rStmt = $db->prepare("SELECT id FROM reviews WHERE order_id = :order_id AND product_id = :product_id LIMIT 1");
    $rStmt->execute(['order_id' => $orderId, 'product_id' => $productId]);
    if ($rStmt->fetch()) {
        jsonResponse(400, ['message' => 'You have already reviewed this product for this order.']);
    }

    $ins = $db->prepare(
        "INSERT INTO reviews (order_id, product_id, customer_id, product_rating, seller_rating, comment, created_at)
         VALUES (:order_id, :product_id, :customer_id, :product_rating, :seller_rating, :comment, NOW())"
    );
    $ins->execute([
        'order_id' => $orderId,
        'product_id' => $productId,
        'customer_id' => $user['id'],
        'product_rating' => $productRating,
        'seller_rating' => $sellerRating,
        'comment' => $comment !== '' ? $comment : null
    ]);

    jsonResponse(201, ['message' => 'Feedback submitted successfully. Thank you!']);
}

function getProductReviews(int $productId): void
{
    $db = database();

    $stmt = $db->prepare(
        "SELECT r.*, u.name as customer_name
         FROM reviews r
         INNER JOIN users u ON u.id = r.customer_id
         WHERE r.product_id = :product_id
         ORDER BY r.created_at DESC"
    );
    $stmt->execute(['product_id' => $productId]);
    $reviews = $stmt->fetchAll();

    foreach ($reviews as &$rev) {
        $rev['id'] = (int) $rev['id'];
        $rev['order_id'] = (int) $rev['order_id'];
        $rev['product_id'] = (int) $rev['product_id'];
        $rev['customer_id'] = (int) $rev['customer_id'];
        $rev['product_rating'] = (int) $rev['product_rating'];
        $rev['seller_rating'] = (int) $rev['seller_rating'];
    }

    jsonResponse(200, ['reviews' => $reviews]);
}
