<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

function listPortfolios(): void
{
    $userId = (int) ($_GET['user_id'] ?? 0);

    if ($userId <= 0) {
        $user = currentUser();
        if ($user) {
            $userId = (int) $user['id'];
        }
    }

    if ($userId <= 0) {
        jsonResponse(422, ['message' => 'User ID is required to fetch portfolios.']);
    }

    $stmt = database()->prepare('
        SELECT * FROM portfolios 
        WHERE user_id = :user_id 
        ORDER BY created_at DESC
    ');
    $stmt->execute(['user_id' => $userId]);
    $portfolios = $stmt->fetchAll();

    // Decode JSON images array for client
    foreach ($portfolios as &$p) {
        if ($p['images']) {
            $p['images'] = json_decode($p['images'], true);
        } else {
            $p['images'] = [];
        }
    }

    jsonResponse(200, ['portfolios' => $portfolios]);
}
