<?php

declare(strict_types=1);

namespace Nestora\Controllers;

use Nestora\Core\Base\AbstractController;
use Nestora\Core\Http\Request;
use Nestora\Core\Http\Response;

class AnalyticsController extends AbstractController
{
    public function logEvent(Request $request): Response
    {
        $body = $request->getBody();
        $eventType = trim((string) ($body['event_type'] ?? ''));
        $metadata = is_array($body['metadata'] ?? null) ? json_encode($body['metadata']) : null;

        if ($eventType === '') {
            return $this->error(422, 'Event type required.');
        }

        $user = $this->currentUser($request);
        $userId = $user ? (int) $user['id'] : null;

        $this->db->query('INSERT INTO analytics_events (user_id, event_type, metadata, created_at) VALUES (:uid, :etype, :meta, NOW())', [
            'uid' => $userId,
            'etype' => $eventType,
            'meta' => $metadata
        ]);

        return $this->json(201, ['message' => 'Event logged']);
    }

    public function dashboard(Request $request): Response
    {
        $this->requireAdmin($request);

        $totalUsers = (int) ($this->db->fetch('SELECT COUNT(*) as c FROM users')['c'] ?? 0);
        $totalOrders = (int) ($this->db->fetch('SELECT COUNT(*) as c FROM orders')['c'] ?? 0);
        $totalRevenue = (float) ($this->db->fetch('SELECT SUM(total_cost) as s FROM orders WHERE status = "completed"')['s'] ?? 0);

        return $this->json(200, [
            'dashboard' => [
                'total_users' => $totalUsers,
                'total_orders' => $totalOrders,
                'total_revenue' => $totalRevenue,
            ]
        ]);
    }
}
