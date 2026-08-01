<?php

declare(strict_types=1);

namespace Nestora\Core\Base;

use Nestora\Core\Database\DatabaseConnection;
use Nestora\Core\Http\Request;
use Nestora\Core\Http\Response;

abstract class AbstractController
{
    protected DatabaseConnection $db;

    public function __construct()
    {
        $this->db = DatabaseConnection::getInstance();
    }

    protected function json(int $status, array $data = []): Response
    {
        return Response::json($status, $data);
    }

    protected function error(int $status, string $message, array $details = []): Response
    {
        return Response::error($status, $message, $details);
    }

    protected function currentUser(Request $request): ?array
    {
        $userId = $request->getSession('user_id');
        if (!$userId) {
            return null;
        }

        $user = $this->db->fetch('SELECT * FROM users WHERE id = :id', ['id' => $userId]);
        if (!$user) {
            return null;
        }

        if (!empty($user['banned_until'])) {
            $bannedUntil = strtotime((string) $user['banned_until']);
            if ($bannedUntil !== false && $bannedUntil > time()) {
                return null;
            }
        }

        return $user;
    }

    protected function currentUserOrFail(Request $request): array
    {
        $user = $this->currentUser($request);
        if (!$user) {
            $this->error(401, 'Unauthorized access. Please log in.')->send();
        }
        return $user;
    }

    protected function requireAdmin(Request $request): array
    {
        $user = $this->currentUserOrFail($request);
        if (($user['role'] ?? '') !== 'admin') {
            $this->error(403, 'Forbidden: Admin access required.')->send();
        }
        return $user;
    }
}
