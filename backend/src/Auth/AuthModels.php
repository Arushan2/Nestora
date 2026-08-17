<?php

declare(strict_types=1);

namespace Nestora\Auth;

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * OOP Concept 1: ENCAPSULATION
 * Data Models & Data Transfer Objects (DTOs) with internal state validation.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * User Entity Model: Encapsulates user table attributes, password verification,
 * and ban status state logic.
 */
class User
{
    private int $id;
    private string $name;
    private string $email;
    private ?string $passwordHash;
    private string $role;
    private string $createdAt;
    private ?string $bannedUntil;
    private ?string $banReason;

    public function __construct(array $data)
    {
        $this->id = (int) ($data['id'] ?? 0);
        $this->name = (string) ($data['name'] ?? '');
        $this->email = strtolower(trim((string) ($data['email'] ?? '')));
        $this->passwordHash = isset($data['password_hash']) && $data['password_hash'] !== null ? (string) $data['password_hash'] : null;
        $this->role = (string) ($data['role'] ?? 'user');
        $this->createdAt = (string) ($data['created_at'] ?? date('Y-m-d H:i:s'));
        $this->bannedUntil = isset($data['banned_until']) && $data['banned_until'] !== null ? (string) $data['banned_until'] : null;
        $this->banReason = isset($data['ban_reason']) && $data['ban_reason'] !== null ? (string) $data['ban_reason'] : null;
    }

    public function getId(): int
    {
        return $this->id;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function getEmail(): string
    {
        return $this->email;
    }

    public function getPasswordHash(): ?string
    {
        return $this->passwordHash;
    }

    public function getRole(): string
    {
        return $this->role;
    }

    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }

    public function getBannedUntil(): ?string
    {
        return $this->bannedUntil;
    }

    public function getBanReason(): ?string
    {
        return $this->banReason;
    }

    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    public function isBanned(): bool
    {
        if ($this->bannedUntil === null || $this->bannedUntil === '') {
            return false;
        }

        return strtotime($this->bannedUntil) > time();
    }

    public function verifyPassword(string $password): bool
    {
        if ($this->passwordHash === null || $this->passwordHash === '') {
            return false;
        }

        return password_verify($password, $this->passwordHash);
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'role' => $this->role,
            'created_at' => $this->createdAt,
            'banned_until' => $this->bannedUntil,
            'ban_reason' => $this->banReason,
        ];
    }
}

/**
 * Email Verification Model: Encapsulates OTP verification tokens, expiration rules,
 * and payload decoding.
 */
class EmailVerification
{
    private int $id;
    private string $email;
    private string $code;
    private string $purpose;
    private ?string $payload;
    private string $expiresAt;

    public function __construct(array $data)
    {
        $this->id = (int) ($data['id'] ?? 0);
        $this->email = strtolower(trim((string) ($data['email'] ?? '')));
        $this->code = trim((string) ($data['code'] ?? ''));
        $this->purpose = (string) ($data['purpose'] ?? '');
        $this->payload = isset($data['payload']) && $data['payload'] !== null ? (string) $data['payload'] : null;
        $this->expiresAt = (string) ($data['expires_at'] ?? '');
    }

    public function getId(): int
    {
        return $this->id;
    }

    public function getEmail(): string
    {
        return $this->email;
    }

    public function getCode(): string
    {
        return $this->code;
    }

    public function getPurpose(): string
    {
        return $this->purpose;
    }

    public function getPayload(): ?string
    {
        return $this->payload;
    }

    public function getDecodedPayload(): ?array
    {
        if ($this->payload === null || $this->payload === '') {
            return null;
        }

        $decoded = json_decode($this->payload, true);
        return is_array($decoded) ? $decoded : null;
    }

    public function getExpiresAt(): string
    {
        return $this->expiresAt;
    }

    public function isExpired(): bool
    {
        if ($this->expiresAt === '') {
            return true;
        }

        return strtotime($this->expiresAt) <= time();
    }

    public function matches(string $email, string $code, string $purpose): bool
    {
        return strtolower(trim($email)) === $this->email &&
            trim($code) === $this->code &&
            $purpose === $this->purpose &&
            !$this->isExpired();
    }
}

/**
 * Register DTO: Encapsulates and validates user sign-up input.
 */
class RegisterDTO
{
    private string $name;
    private string $email;
    private string $password;

    public function __construct(array $data)
    {
        $this->name = trim((string) ($data['name'] ?? ''));
        $this->email = strtolower(trim((string) ($data['email'] ?? '')));
        $this->password = (string) ($data['password'] ?? '');

        $this->validate();
    }

    private function validate(): void
    {
        if ($this->name === '' || $this->email === '' || $this->password === '') {
            throw new ValidationException('Name, email, and password are required.');
        }

        if (!filter_var($this->email, FILTER_VALIDATE_EMAIL)) {
            throw new ValidationException('Enter a valid email address.');
        }
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function getEmail(): string
    {
        return $this->email;
    }

    public function getPassword(): string
    {
        return $this->password;
    }
}

/**
 * Login DTO: Encapsulates and validates sign-in credentials.
 */
class LoginDTO
{
    private string $email;
    private string $password;

    public function __construct(array $data)
    {
        $this->email = strtolower(trim((string) ($data['email'] ?? '')));
        $this->password = (string) ($data['password'] ?? '');

        $this->validate();
    }

    private function validate(): void
    {
        if ($this->email === '' || $this->password === '') {
            throw new ValidationException('Email and password are required.');
        }
    }

    public function getEmail(): string
    {
        return $this->email;
    }

    public function getPassword(): string
    {
        return $this->password;
    }
}

/**
 * OtpVerify DTO: Encapsulates and validates OTP code submission.
 */
class OtpVerifyDTO
{
    private string $email;
    private string $code;

    public function __construct(array $data)
    {
        $this->email = strtolower(trim((string) ($data['email'] ?? '')));
        $this->code = trim((string) ($data['code'] ?? ''));

        $this->validate();
    }

    private function validate(): void
    {
        if ($this->email === '' || $this->code === '') {
            throw new ValidationException('Email and verification code are required.');
        }
    }

    public function getEmail(): string
    {
        return $this->email;
    }

    public function getCode(): string
    {
        return $this->code;
    }
}

/**
 * ResetPassword DTO: Encapsulates and validates password reset submission.
 */
class ResetPasswordDTO
{
    private string $email;
    private string $code;
    private string $newPassword;

    public function __construct(array $data)
    {
        $this->email = strtolower(trim((string) ($data['email'] ?? '')));
        $this->code = trim((string) ($data['code'] ?? ''));
        $this->newPassword = (string) ($data['new_password'] ?? '');

        $this->validate();
    }

    private function validate(): void
    {
        if ($this->email === '' || $this->code === '' || $this->newPassword === '') {
            throw new ValidationException('Email, code, and new password are required.');
        }

        if (strlen($this->newPassword) < 6) {
            throw new ValidationException('Password must be at least 6 characters.');
        }
    }

    public function getEmail(): string
    {
        return $this->email;
    }

    public function getCode(): string
    {
        return $this->code;
    }

    public function getNewPassword(): string
    {
        return $this->newPassword;
    }
}
