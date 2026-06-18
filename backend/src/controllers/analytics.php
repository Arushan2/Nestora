<?php

declare(strict_types=1);

function logAnalyticsEvent(): void
{
    $user = currentUser();
    $userId = $user ? $user['id'] : null;
    $data = json_decode(file_get_contents('php://input'), true);

    $targetUserId = $data['target_user_id'] ?? null;
    $eventType = $data['event_type'] ?? null;
    $itemId = $data['item_id'] ?? null;
    
    if (!$targetUserId || !$eventType) {
        jsonResponse(400, ['message' => 'Missing target_user_id or event_type']);
    }

    $validEvents = ['profile_view', 'product_view', 'service_view', 'cart_add', 'favourite_add', 'portfolio_view', 'contact_click', 'checkout_initiated'];
    if (!in_array($eventType, $validEvents)) {
        jsonResponse(400, ['message' => 'Invalid event type']);
    }

    $db = database();
    $viewerIp = $_SERVER['REMOTE_ADDR'] ?? null;

    // Optional: Add simple rate limiting/deduplication based on IP and Item ID within the last hour
    if ($viewerIp) {
        $stmt = $db->prepare('SELECT id FROM analytics_events WHERE event_type = ? AND target_user_id = ? AND item_id <=> ? AND viewer_ip = ? AND created_at > (NOW() - INTERVAL 1 HOUR)');
        $stmt->execute([$eventType, $targetUserId, $itemId, $viewerIp]);
        if ($stmt->fetchColumn()) {
            jsonResponse(200, ['message' => 'Event ignored (duplicate)']);
            return;
        }
    }

    $stmt = $db->prepare('INSERT INTO analytics_events (target_user_id, event_type, item_id, viewer_id, viewer_ip) VALUES (?, ?, ?, ?, ?)');
    $stmt->execute([$targetUserId, $eventType, $itemId, $userId, $viewerIp]);

    jsonResponse(201, ['message' => 'Event logged']);
}

function getAnalyticsDashboard(): void
{
    $user = currentUserOrFail();
    $userId = $user['id'];

    if (!$userId) {
        jsonResponse(401, ['message' => 'Unauthorized']);
    }

    $db = database();

    $startDate = $_GET['start_date'] ?? date('Y-m-d', strtotime('-30 days'));
    $endDate = $_GET['end_date'] ?? date('Y-m-d');
    
    // Ensure endDate is inclusive by adding 1 day or appending time
    $endDateQuery = $endDate . ' 23:59:59';
    $startDateQuery = $startDate . ' 00:00:00';

    // 1. Fetch Views & Engagement Metrics from analytics_events
    $stmt = $db->prepare('
        SELECT event_type, COUNT(*) as count 
        FROM analytics_events 
        WHERE target_user_id = ? AND created_at BETWEEN ? AND ?
        GROUP BY event_type
    ');
    $stmt->execute([$userId, $startDateQuery, $endDateQuery]);
    $engagement = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

    // 2. Fetch Orders Data
    $stmt = $db->prepare('
        SELECT status, COUNT(*) as count, COALESCE(SUM(amount), 0) as total_amount
        FROM orders
        WHERE seller_id = ? AND created_at BETWEEN ? AND ?
        GROUP BY status
    ');
    $stmt->execute([$userId, $startDateQuery, $endDateQuery]);
    $ordersData = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $totalOrdersCount = 0;
    $totalRevenue = 0;
    foreach ($ordersData as $row) {
        $totalOrdersCount += (int)$row['count'];
        // Compute revenue only from completed/verified orders (adjust status logic as needed)
        if (in_array($row['status'], ['COMPLETED', 'SHIPPED', 'PAYMENT_VERIFIED'])) {
            $totalRevenue += (float)$row['total_amount'];
        }
    }

    // 3. Fetch Service Inquiries Data
    $stmt = $db->prepare('
        SELECT status, COUNT(*) as count
        FROM service_inquiries
        WHERE provider_id = ? AND created_at BETWEEN ? AND ?
        GROUP BY status
    ');
    $stmt->execute([$userId, $startDateQuery, $endDateQuery]);
    $inquiriesData = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
    
    $totalInquiriesCount = array_sum($inquiriesData);

    // 4. Time-series data for the primary chart
    // We will group by DATE(created_at)
    $stmt = $db->prepare('
        SELECT DATE(created_at) as date, event_type, COUNT(*) as count
        FROM analytics_events
        WHERE target_user_id = ? AND created_at BETWEEN ? AND ?
        GROUP BY DATE(created_at), event_type
        ORDER BY date ASC
    ');
    $stmt->execute([$userId, $startDateQuery, $endDateQuery]);
    $timeSeriesEvents = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Also get orders over time
    $stmt = $db->prepare('
        SELECT DATE(created_at) as date, COUNT(*) as orders_count
        FROM orders
        WHERE seller_id = ? AND created_at BETWEEN ? AND ?
        GROUP BY DATE(created_at)
        ORDER BY date ASC
    ');
    $stmt->execute([$userId, $startDateQuery, $endDateQuery]);
    $timeSeriesOrders = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

    // Also get inquiries over time
    $stmt = $db->prepare('
        SELECT DATE(created_at) as date, COUNT(*) as inquiries_count
        FROM service_inquiries
        WHERE provider_id = ? AND created_at BETWEEN ? AND ?
        GROUP BY DATE(created_at)
        ORDER BY date ASC
    ');
    $stmt->execute([$userId, $startDateQuery, $endDateQuery]);
    $timeSeriesInquiries = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

    // 5. Sales by Category
    $stmt = $db->prepare('
        SELECT pl.category, COALESCE(SUM(oi.price * oi.quantity), 0) as revenue
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.order_id
        JOIN product_listings pl ON oi.product_id = pl.id
        WHERE o.seller_id = ? AND o.status IN ("COMPLETED", "SHIPPED", "PAYMENT_VERIFIED") AND o.created_at BETWEEN ? AND ?
        GROUP BY pl.category
    ');
    $stmt->execute([$userId, $startDateQuery, $endDateQuery]);
    $salesByCategory = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 6. Review Sentiment
    $stmt = $db->prepare('
        SELECT rating, COUNT(*) as count
        FROM product_reviews pr
        JOIN product_listings pl ON pr.product_id = pl.id
        WHERE pl.user_id = ? AND pr.created_at BETWEEN ? AND ?
        GROUP BY rating
    ');
    $stmt->execute([$userId, $startDateQuery, $endDateQuery]);
    $reviewSentiment = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

    // Aggregate into a single chart data array
    $chartData = [];
    foreach ($timeSeriesEvents as $row) {
        $date = $row['date'];
        if (!isset($chartData[$date])) {
            $chartData[$date] = [
                'date' => $date,
                'profile_view' => 0,
                'product_view' => 0,
                'service_view' => 0,
                'cart_add' => 0,
                'favourite_add' => 0,
                'portfolio_view' => 0,
                'contact_click' => 0,
                'checkout_initiated' => 0,
                'orders_count' => 0,
                'inquiries_count' => 0
            ];
        }
        $chartData[$date][$row['event_type']] = (int)$row['count'];
    }

    // Merge orders into chart data
    foreach ($timeSeriesOrders as $date => $count) {
        if (!isset($chartData[$date])) {
            $chartData[$date] = [
                'date' => $date,
                'profile_view' => 0, 'product_view' => 0, 'service_view' => 0,
                'cart_add' => 0, 'favourite_add' => 0, 'portfolio_view' => 0,
                'contact_click' => 0, 'checkout_initiated' => 0,
                'orders_count' => 0, 'inquiries_count' => 0
            ];
        }
        $chartData[$date]['orders_count'] = (int)$count;
    }

    // Merge inquiries into chart data
    foreach ($timeSeriesInquiries as $date => $count) {
        if (!isset($chartData[$date])) {
            $chartData[$date] = [
                'date' => $date,
                'profile_view' => 0, 'product_view' => 0, 'service_view' => 0,
                'cart_add' => 0, 'favourite_add' => 0, 'portfolio_view' => 0,
                'contact_click' => 0, 'checkout_initiated' => 0,
                'orders_count' => 0, 'inquiries_count' => 0
            ];
        }
        $chartData[$date]['inquiries_count'] = (int)$count;
    }

    // Sort by date
    ksort($chartData);
    $chartData = array_values($chartData);

    // Respond with consolidated data
    jsonResponse(200, [
        'overview' => [
            'total_profile_views' => (int)($engagement['profile_view'] ?? 0),
            'total_product_views' => (int)($engagement['product_view'] ?? 0),
            'total_service_views' => (int)($engagement['service_view'] ?? 0),
            'total_portfolio_views' => (int)($engagement['portfolio_view'] ?? 0),
            'total_favorites' => (int)($engagement['favourite_add'] ?? 0),
            'total_cart_adds' => (int)($engagement['cart_add'] ?? 0),
            'total_contact_clicks' => (int)($engagement['contact_click'] ?? 0),
            'total_checkout_initiated' => (int)($engagement['checkout_initiated'] ?? 0),
            'total_orders' => $totalOrdersCount,
            'total_revenue' => $totalRevenue,
            'total_inquiries' => $totalInquiriesCount,
            'aov' => $totalOrdersCount > 0 ? $totalRevenue / $totalOrdersCount : 0,
        ],
        'orders_breakdown' => $ordersData,
        'inquiries_breakdown' => $inquiriesData,
        'sales_by_category' => $salesByCategory,
        'review_sentiment' => $reviewSentiment,
        'chart_data' => $chartData
    ]);
}
