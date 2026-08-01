<?php

declare(strict_types=1);

namespace Nestora\Models;

use Nestora\Core\Base\AbstractModel;

class User extends AbstractModel
{
    public function getId(): int
    {
        return (int) $this->get('id', 0);
    }

    public function getEmail(): string
    {
        return (string) $this->get('email', '');
    }

    public function getRole(): string
    {
        return (string) $this->get('role', 'user');
    }

    public function isAdmin(): bool
    {
        return $this->getRole() === 'admin';
    }

    public function isServiceProvider(): bool
    {
        return $this->getRole() === 'service_provider';
    }

    public function isProductSeller(): bool
    {
        return $this->getRole() === 'product_seller';
    }

    public function isBanned(): bool
    {
        $bannedUntil = $this->get('banned_until');
        if (!$bannedUntil) {
            return false;
        }
        $timestamp = strtotime((string) $bannedUntil);
        return $timestamp !== false && $timestamp > time();
    }
}
