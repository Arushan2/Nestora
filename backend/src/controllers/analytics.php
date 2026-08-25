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
    $userId = (int) $user['id'];
    $isAdmin = $user['role'] === 'admin';

    $db = database();

    $startDate = $_GET['start_date'] ?? date('Y-m-d', strtotime('-30 days'));
    $endDate = $_GET['end_date'] ?? date('Y-m-d');
    
    $endDateQuery = $endDate . ' 23:59:59';
    $startDateQuery = $startDate . ' 00:00:00';

    // 1. Engagement events
    if ($isAdmin) {
        $stmt = $db->prepare('
            SELECT event_type, COUNT(*) as count 
            FROM analytics_events 
            WHERE created_at BETWEEN ? AND ?
            GROUP BY event_type
        ');
        $stmt->execute([$startDateQuery, $endDateQuery]);
    } else {
        $stmt = $db->prepare('
            SELECT event_type, COUNT(*) as count 
            FROM analytics_events 
            WHERE target_user_id = ? AND created_at BETWEEN ? AND ?
            GROUP BY event_type
        ');
        $stmt->execute([$userId, $startDateQuery, $endDateQuery]);
    }
    $engagement = $stmt->fetchAll(PDO::FETCH_KEY_PAIR) ?: [];

    // 2. Orders Data
    if ($isAdmin) {
        $stmt = $db->prepare('
            SELECT status, COUNT(*) as count, COALESCE(SUM(amount), 0) as total_amount
            FROM orders
            WHERE created_at BETWEEN ? AND ?
            GROUP BY status
        ');
        $stmt->execute([$startDateQuery, $endDateQuery]);
    } else {
        $stmt = $db->prepare('
            SELECT status, COUNT(*) as count, COALESCE(SUM(amount), 0) as total_amount
            FROM orders
            WHERE seller_id = ? AND created_at BETWEEN ? AND ?
            GROUP BY status
        ');
        $stmt->execute([$userId, $startDateQuery, $endDateQuery]);
    }
    $ordersData = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    
    $totalOrdersCount = 0;
    $totalRevenue = 0.0;
    foreach ($ordersData as $row) {
        $totalOrdersCount += (int)$row['count'];
        $statusLower = strtolower((string)$row['status']);
        if (in_array($statusLower, ['completed', 'shipped', 'processing'])) {
            $totalRevenue += (float)$row['total_amount'];
        }
    }

    // 3. Service Inquiries Data
    if ($isAdmin) {
        $stmt = $db->prepare('
            SELECT status, COUNT(*) as count
            FROM service_inquiries
            WHERE created_at BETWEEN ? AND ?
            GROUP BY status
        ');
        $stmt->execute([$startDateQuery, $endDateQuery]);
    } else {
        $stmt = $db->prepare('
            SELECT status, COUNT(*) as count
            FROM service_inquiries
            WHERE provider_id = ? AND created_at BETWEEN ? AND ?
            GROUP BY status
        ');
        $stmt->execute([$userId, $startDateQuery, $endDateQuery]);
    }
    $inquiriesData = $stmt->fetchAll(PDO::FETCH_KEY_PAIR) ?: [];
    $totalInquiriesCount = array_sum($inquiriesData);

    // 4. Time-series data
    if ($isAdmin) {
        $stmt = $db->prepare('
            SELECT DATE(created_at) as date, event_type, COUNT(*) as count
            FROM analytics_events
            WHERE created_at BETWEEN ? AND ?
            GROUP BY DATE(created_at), event_type
            ORDER BY date ASC
        ');
        $stmt->execute([$startDateQuery, $endDateQuery]);
    } else {
        $stmt = $db->prepare('
            SELECT DATE(created_at) as date, event_type, COUNT(*) as count
            FROM analytics_events
            WHERE target_user_id = ? AND created_at BETWEEN ? AND ?
            GROUP BY DATE(created_at), event_type
            ORDER BY date ASC
        ');
        $stmt->execute([$userId, $startDateQuery, $endDateQuery]);
    }
    $timeSeriesEvents = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    // Orders over time
    if ($isAdmin) {
        $stmt = $db->prepare('
            SELECT DATE(created_at) as date, COUNT(*) as orders_count
            FROM orders
            WHERE created_at BETWEEN ? AND ?
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        ');
        $stmt->execute([$startDateQuery, $endDateQuery]);
    } else {
        $stmt = $db->prepare('
            SELECT DATE(created_at) as date, COUNT(*) as orders_count
            FROM orders
            WHERE seller_id = ? AND created_at BETWEEN ? AND ?
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        ');
        $stmt->execute([$userId, $startDateQuery, $endDateQuery]);
    }
    $timeSeriesOrders = $stmt->fetchAll(PDO::FETCH_KEY_PAIR) ?: [];

    // Inquiries over time
    if ($isAdmin) {
        $stmt = $db->prepare('
            SELECT DATE(created_at) as date, COUNT(*) as inquiries_count
            FROM service_inquiries
            WHERE created_at BETWEEN ? AND ?
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        ');
        $stmt->execute([$startDateQuery, $endDateQuery]);
    } else {
        $stmt = $db->prepare('
            SELECT DATE(created_at) as date, COUNT(*) as inquiries_count
            FROM service_inquiries
            WHERE provider_id = ? AND created_at BETWEEN ? AND ?
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        ');
        $stmt->execute([$userId, $startDateQuery, $endDateQuery]);
    }
    $timeSeriesInquiries = $stmt->fetchAll(PDO::FETCH_KEY_PAIR) ?: [];

    // 5. Sales by Category
    if ($isAdmin) {
        $stmt = $db->prepare('
            SELECT pl.category, COALESCE(SUM(oi.price * oi.quantity), 0) as revenue
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.order_id
            JOIN product_listings pl ON oi.product_id = pl.id
            WHERE LOWER(o.status) IN ("completed", "shipped", "processing") AND o.created_at BETWEEN ? AND ?
            GROUP BY pl.category
        ');
        $stmt->execute([$startDateQuery, $endDateQuery]);
    } else {
        $stmt = $db->prepare('
            SELECT pl.category, COALESCE(SUM(oi.price * oi.quantity), 0) as revenue
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.order_id
            JOIN product_listings pl ON oi.product_id = pl.id
            WHERE o.seller_id = ? AND LOWER(o.status) IN ("completed", "shipped", "processing") AND o.created_at BETWEEN ? AND ?
            GROUP BY pl.category
        ');
        $stmt->execute([$userId, $startDateQuery, $endDateQuery]);
    }
    $salesByCategory = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    // 6. Review Sentiment
    if ($isAdmin) {
        $stmt = $db->prepare('
            SELECT rating, COUNT(*) as count
            FROM product_reviews pr
            WHERE pr.created_at BETWEEN ? AND ?
            GROUP BY rating
        ');
        $stmt->execute([$startDateQuery, $endDateQuery]);
    } else {
        $stmt = $db->prepare('
            SELECT rating, COUNT(*) as count
            FROM product_reviews pr
            JOIN product_listings pl ON pr.product_id = pl.id
            WHERE pl.user_id = ? AND pr.created_at BETWEEN ? AND ?
            GROUP BY rating
        ');
        $stmt->execute([$userId, $startDateQuery, $endDateQuery]);
    }
    $reviewSentiment = $stmt->fetchAll(PDO::FETCH_KEY_PAIR) ?: [];

    // Aggregate into a single chart data array
    $chartData = [];
    foreach ($timeSeriesEvents as $row) {
        $date = (string)$row['date'];
        if (!isset($chartData[$date])) {
            $chartData[$date] = [
                'date' => $date,
                'profile_view' => 0, 'product_view' => 0, 'service_view' => 0,
                'cart_add' => 0, 'favourite_add' => 0, 'portfolio_view' => 0,
                'contact_click' => 0, 'checkout_initiated' => 0,
                'orders_count' => 0, 'inquiries_count' => 0
            ];
        }
        $chartData[$date][(string)$row['event_type']] = (int)$row['count'];
    }

    foreach ($timeSeriesOrders as $date => $count) {
        $d = (string)$date;
        if (!isset($chartData[$d])) {
            $chartData[$d] = [
                'date' => $d,
                'profile_view' => 0, 'product_view' => 0, 'service_view' => 0,
                'cart_add' => 0, 'favourite_add' => 0, 'portfolio_view' => 0,
                'contact_click' => 0, 'checkout_initiated' => 0,
                'orders_count' => 0, 'inquiries_count' => 0
            ];
        }
        $chartData[$d]['orders_count'] = (int)$count;
    }

    foreach ($timeSeriesInquiries as $date => $count) {
        $d = (string)$date;
        if (!isset($chartData[$d])) {
            $chartData[$d] = [
                'date' => $d,
                'profile_view' => 0, 'product_view' => 0, 'service_view' => 0,
                'cart_add' => 0, 'favourite_add' => 0, 'portfolio_view' => 0,
                'contact_click' => 0, 'checkout_initiated' => 0,
                'orders_count' => 0, 'inquiries_count' => 0
            ];
        }
        $chartData[$d]['inquiries_count'] = (int)$count;
    }

    ksort($chartData);
    $chartData = array_values($chartData);

    // Platform 10% Commission stats
    $commStmt = $db->prepare('
        SELECT 
            COALESCE(SUM(gross_amount), 0) as total_gross,
            COALESCE(SUM(commission_amount), 0) as total_commission,
            COALESCE(SUM(amount), 0) as total_net_payout
        FROM seller_settlements
        WHERE created_at BETWEEN ? AND ?
    ');
    $commStmt->execute([$startDateQuery, $endDateQuery]);
    $commRes = $commStmt->fetch(PDO::FETCH_ASSOC);

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
            'total_platform_commission' => (float)($commRes['total_commission'] ?? 0.0),
            'total_platform_gross' => (float)($commRes['total_gross'] ?? 0.0),
            'total_platform_payout' => (float)($commRes['total_net_payout'] ?? 0.0),
        ],
        'platform_commission' => [
            'total_gross' => (float)($commRes['total_gross'] ?? 0.0),
            'total_commission' => (float)($commRes['total_commission'] ?? 0.0),
            'total_net_payout' => (float)($commRes['total_net_payout'] ?? 0.0),
        ],
        'orders_breakdown' => $ordersData,
        'inquiries_breakdown' => $inquiriesData,
        'sales_by_category' => $salesByCategory,
        'review_sentiment' => $reviewSentiment,
        'chart_data' => $chartData
    ]);
}
