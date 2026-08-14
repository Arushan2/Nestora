<?php

declare(strict_types=1);

namespace Nestora\Auth;

use Exception;
use Throwable;

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * OOP Concept 2: ABSTRACTION
 * Interfaces & Contracts defining core domain capabilities.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * High-level contract for Authentication Service operations.
 */
interface AuthServiceInterface
{
    public function getCurrentUser(): ?User;

    public function register(RegisterDTO $dto): array;

    public function verifyOtp(OtpVerifyDTO $dto): array;

    public function login(LoginDTO $dto): array;

    public function forgotPassword(string $email): array;

    public function resetPassword(ResetPasswordDTO $dto): array;

    public function logout(): void;
}

/**
 * Data access contract for User persistence.
 */
interface UserRepositoryInterface
{
    public function findByEmail(string $email): ?User;

    public function findById(int $id): ?User;

    public function create(string $name, string $email, string $passwordHash, string $role): User;

    public function updatePassword(int $userId, string $passwordHash): bool;

    public function updateGoogleTokens(int $userId, string $accessToken, ?string $refreshToken, string $expiresAt): bool;

    public function clearGoogleTokens(int $userId): bool;
}

/**
 * Data access contract for OTP Verification persistence.
 */
interface VerificationRepositoryInterface
{
    public function store(string $email, string $code, string $purpose, ?string $payload = null): void;

    public function find(string $email, string $code, string $purpose): ?EmailVerification;

    public function clear(string $email, string $purpose): void;
}

/**
 * Polymorphic authentication strategy contract.
 */
interface AuthenticationStrategyInterface
{
    public function authenticate(array $credentials): User;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * OOP Concept 3: INHERITANCE
 * Custom Exception Hierarchy extending base PHP Exception.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Base domain exception for Authentication.
 */
abstract class AuthException extends Exception
{
    protected int $statusCode = 400;
    protected array $data = [];

    public function __construct(string $message, int $statusCode = 400, array $data = [], int $code = 0, ?Throwable $previous = null)
    {
        parent::__construct($message, $code, $previous);
        $this->statusCode = $statusCode;
        $this->data = $data;
    }

    public function getStatusCode(): int
    {
        return $this->statusCode;
    }

    public function getData(): array
    {
        return $this->data;
    }
}

/**
 * Thrown when request payload fails validation.
 */
class ValidationException extends AuthException
{
    public function __construct(string $message = 'Validation failed.')
    {
        parent::__construct($message, 422);
    }
}

/**
 * Thrown when credentials (email/password) are incorrect.
 */
class InvalidCredentialsException extends AuthException
{
    public function __construct(string $message = 'Invalid email or password.')
    {
        parent::__construct($message, 401);
    }
}

/**
 * Thrown when user account is suspended or banned.
 */
class UserBannedException extends AuthException
{
    public function __construct(string $message, string $reason, string $until)
    {
        parent::__construct($message, 403, [
            'banned' => true,
            'message' => $message,
            'ban_reason' => $reason,
            'banned_until' => $until,
        ]);
    }
}

/**
 * Thrown when an OTP code is invalid or expired.
 */
class InvalidOtpException extends AuthException
{
    public function __construct(string $message = 'Invalid or expired verification code.')
    {
        parent::__construct($message, 400);
    }
}

/**
 * Thrown when attempting to register an already existing email.
 */
class UserAlreadyExistsException extends AuthException
{
    public function __construct(string $message = 'An account with that email already exists.')
    {
        parent::__construct($message, 409);
    }
}

/**
 * Thrown when a user record cannot be found.
 */
class UserNotFoundException extends AuthException
{
    public function __construct(string $message = 'User not found.')
    {
        parent::__construct($message, 404);
    }
}
