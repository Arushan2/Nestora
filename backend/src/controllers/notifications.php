<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

/**
 * GET /api/notifications
 * Retrieves notifications for the logged-in user.
 */
function getMyNotifications(): void
{
    $user = currentUserOrFail();
    $db = database();

    try {
        $stmt = $db->prepare('
            SELECT id, title, description AS `desc`, link, is_read AS `read`, created_at 
            FROM notifications 
            WHERE user_id = :user_id 
            ORDER BY created_at DESC 
            LIMIT 50
        ');
        $stmt->execute(['user_id' => $user['id']]);
        $notifications = $stmt->fetchAll();

        // Cast fields to correct types for frontend consumption
        foreach ($notifications as &$n) {
            $n['id'] = (int) $n['id'];
            $n['read'] = (bool) $n['read'];
        }

        jsonResponse(200, ['notifications' => $notifications]);
    } catch (Throwable $e) {
        jsonResponse(500, ['message' => 'Failed to fetch notifications.', 'details' => $e->getMessage()]);
    }
}

/**
 * POST /api/notifications/mark-read
 * Marks notifications as read. If an 'id' is supplied in the JSON request body,
 * marks only that notification as read. Otherwise, marks all notifications for
 * the current user as read.
 */
function markNotificationsRead(): void
{
    $user = currentUserOrFail();
    $db = database();
    
    $data = readJson();
    $id = isset($data['id']) ? (int) $data['id'] : null;

    try {
        if ($id !== null) {
            $stmt = $db->prepare('
                UPDATE notifications 
                SET is_read = 1 
                WHERE id = :id AND user_id = :user_id
            ');
            $stmt->execute([
                'id' => $id,
                'user_id' => $user['id']
            ]);
        } else {
            $stmt = $db->prepare('
                UPDATE notifications 
                SET is_read = 1 
                WHERE user_id = :user_id
            ');
            $stmt->execute(['user_id' => $user['id']]);
        }

        jsonResponse(200, ['message' => 'Notifications updated successfully.']);
    } catch (Throwable $e) {
        jsonResponse(500, ['message' => 'Failed to update notifications.', 'details' => $e->getMessage()]);
    }
}
