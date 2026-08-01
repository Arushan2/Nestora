<?php

declare(strict_types=1);

namespace Nestora\Controllers;

use Nestora\Core\Base\AbstractController;
use Nestora\Core\Http\Request;
use Nestora\Core\Http\Response;

class NotificationController extends AbstractController
{
    public function getNotifications(Request $request): Response
    {
        $user = $this->currentUserOrFail($request);

        $notifications = $this->db->fetchAll('SELECT * FROM notifications WHERE user_id = :uid ORDER BY created_at DESC LIMIT 50', [
            'uid' => $user['id']
        ]);

        return $this->json(200, ['notifications' => $notifications]);
    }

    public function markRead(Request $request): Response
    {
        $user = $this->currentUserOrFail($request);
        $this->db->query('UPDATE notifications SET is_read = 1 WHERE user_id = :uid', ['uid' => $user['id']]);

        return $this->json(200, ['message' => 'Notifications marked as read.']);
    }
}
