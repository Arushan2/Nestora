<?php

declare(strict_types=1);

namespace Nestora\Controllers;

use Nestora\Core\Base\AbstractController;
use Nestora\Core\Http\Request;
use Nestora\Core\Http\Response;
use Nestora\Repositories\UserRepository;

class UserController extends AbstractController
{
    private UserRepository $userRepository;

    public function __construct()
    {
        parent::__construct();
        $this->userRepository = new UserRepository();
    }

    public function list(Request $request): Response
    {
        $this->requireAdmin($request);
        $users = $this->db->fetchAll(
            'SELECT id, name, email, role, phone, avatar_url, banned_until, ban_reason, created_at FROM users ORDER BY created_at DESC'
        );
        return $this->json(200, ['users' => $users]);
    }

    public function ban(Request $request, int $id): Response
    {
        $this->requireAdmin($request);
        $user = $this->userRepository->find($id);
        if (!$user) {
            return $this->error(404, 'User not found.');
        }

        if ($user['role'] === 'admin') {
            return $this->error(400, 'Cannot ban an admin user.');
        }

        $body = $request->getBody();
        $days = (int) ($body['days'] ?? 7);
        $reason = trim((string) ($body['reason'] ?? 'Violation of terms'));
        $bannedUntil = date('Y-m-d H:i:s', strtotime("+{$days} days"));

        $this->userRepository->banUser($id, $bannedUntil, $reason);

        return $this->json(200, [
            'message' => "User banned for {$days} days.",
            'banned_until' => $bannedUntil
        ]);
    }

    public function unban(Request $request, int $id): Response
    {
        $this->requireAdmin($request);
        $user = $this->userRepository->find($id);
        if (!$user) {
            return $this->error(404, 'User not found.');
        }

        $this->userRepository->unbanUser($id);
        return $this->json(200, ['message' => 'User unbanned successfully.']);
    }
}
