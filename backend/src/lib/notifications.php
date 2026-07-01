<?php

declare(strict_types=1);

/**
 * Creates and stores a notification in the database for a specific user.
 *
 * @param int $userId Target user ID
 * @param string $title Notification title
 * @param string $description Notification detailed description
 * @param string|null $link Optional redirection URL for the frontend
 */
function createNotification(int $userId, string $title, string $description, ?string $link = null): void
{
    $db = database();
    try {
        $stmt = $db->prepare('
            INSERT INTO notifications (user_id, title, description, link, is_read, created_at)
            VALUES (:user_id, :title, :description, :link, 0, NOW())
        ');
        $stmt->execute([
            'user_id' => $userId,
            'title' => $title,
            'description' => $description,
            'link' => $link
        ]);
    } catch (Throwable $e) {
        // Log error silently or let it fallback so notification errors don't crash main transactions
        error_log('Failed to create notification: ' . $e->getMessage());
    }
}
