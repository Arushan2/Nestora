<?php

declare(strict_types=1);

namespace Nestora\Repositories;

use Nestora\Core\Base\AbstractRepository;

class UserRepository extends AbstractRepository
{
    protected string $table = 'users';

    public function findByEmail(string $email): ?array
    {
        return $this->db->fetch('SELECT * FROM users WHERE email = :email LIMIT 1', [
            'email' => strtolower(trim($email))
        ]);
    }

    public function updateRole(int $id, string $role): bool
    {
        return $this->update($id, ['role' => $role]);
    }

    public function banUser(int $id, ?string $bannedUntil, ?string $reason): bool
    {
        return $this->update($id, [
            'banned_until' => $bannedUntil,
            'ban_reason' => $reason
        ]);
    }

    public function unbanUser(int $id): bool
    {
        return $this->update($id, [
            'banned_until' => null,
            'ban_reason' => null
        ]);
    }
}
