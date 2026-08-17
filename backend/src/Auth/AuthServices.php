<?php

declare(strict_types=1);

namespace Nestora\Auth;

use PDO;
use RuntimeException;
use Throwable;

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * OOP Concept 3 & 4: INHERITANCE & POLYMORPHISM
 * Repositories, Polymorphic Strategies, Domain Services, and Controller.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Concrete PDO implementation of UserRepositoryInterface.
 */
class PdoUserRepository implements UserRepositoryInterface
{
    private PDO $db;

    public function __construct(?PDO $db = null)
    {
        $this->db = $db ?? database();
    }

    public function findByEmail(string $email): ?User
    {
        $stmt = $this->db->prepare('SELECT * FROM users WHERE email = :email LIMIT 1');
        $stmt->execute(['email' => strtolower(trim($email))]);
        $row = $stmt->fetch();

        return is_array($row) ? new User($row) : null;
    }

    public function findById(int $id): ?User
    {
        $stmt = $this->db->prepare('SELECT * FROM users WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();

        return is_array($row) ? new User($row) : null;
    }

    public function create(string $name, string $email, string $passwordHash, string $role): User
    {
        $stmt = $this->db->prepare(
            'INSERT INTO users (name, email, password_hash, role, created_at)
             VALUES (:name, :email, :password_hash, :role, NOW())'
        );
        $stmt->execute([
            'name' => $name,
            'email' => strtolower(trim($email)),
            'password_hash' => $passwordHash,
            'role' => $role,
        ]);

        $id = (int) $this->db->lastInsertId();
        $user = $this->findById($id);

        if ($user === null) {
            throw new RuntimeException('Failed to retrieve newly created user.');
        }

        return $user;
    }

    public function updatePassword(int $userId, string $passwordHash): bool
    {
        $stmt = $this->db->prepare('UPDATE users SET password_hash = :password_hash WHERE id = :id');
        return $stmt->execute([
            'password_hash' => $passwordHash,
            'id' => $userId,
        ]);
    }

    public function updateGoogleTokens(int $userId, string $accessToken, ?string $refreshToken, string $expiresAt): bool
    {
        if ($refreshToken !== null) {
            $stmt = $this->db->prepare('
                UPDATE users 
                SET google_access_token = :access, 
                    google_refresh_token = :refresh, 
                    google_token_expires_at = :expires 
                WHERE id = :id
            ');
            return $stmt->execute([
                'access' => $accessToken,
                'refresh' => $refreshToken,
                'expires' => $expiresAt,
                'id' => $userId,
            ]);
        }

        $stmt = $this->db->prepare('
            UPDATE users 
            SET google_access_token = :access, 
                google_token_expires_at = :expires 
            WHERE id = :id
        ');
        return $stmt->execute([
            'access' => $accessToken,
            'expires' => $expiresAt,
            'id' => $userId,
        ]);
    }

    public function clearGoogleTokens(int $userId): bool
    {
        $stmt = $this->db->prepare('
            UPDATE users 
            SET google_access_token = NULL, 
                google_refresh_token = NULL, 
                google_token_expires_at = NULL 
            WHERE id = :id
        ');
        return $stmt->execute(['id' => $userId]);
    }
}

/**
 * Concrete PDO implementation of VerificationRepositoryInterface.
 */
class PdoVerificationRepository implements VerificationRepositoryInterface
{
    private PDO $db;

    public function __construct(?PDO $db = null)
    {
        $this->db = $db ?? database();
    }

    public function store(string $email, string $code, string $purpose, ?string $payload = null): void
    {
        $this->clear($email, $purpose);

        $stmt = $this->db->prepare(
            'INSERT INTO email_verifications (email, code, purpose, payload, expires_at)
             VALUES (:email, :code, :purpose, :payload, DATE_ADD(NOW(), INTERVAL 10 MINUTE))'
        );
        $stmt->execute([
            'email' => strtolower(trim($email)),
            'code' => trim($code),
            'purpose' => $purpose,
            'payload' => $payload,
        ]);
    }

    public function find(string $email, string $code, string $purpose): ?EmailVerification
    {
        $stmt = $this->db->prepare(
            'SELECT * FROM email_verifications
             WHERE email = :email AND code = :code AND purpose = :purpose AND expires_at > NOW()
             ORDER BY id DESC LIMIT 1'
        );
        $stmt->execute([
            'email' => strtolower(trim($email)),
            'code' => trim($code),
            'purpose' => $purpose,
        ]);

        $row = $stmt->fetch();
        return is_array($row) ? new EmailVerification($row) : null;
    }

    public function clear(string $email, string $purpose): void
    {
        $stmt = $this->db->prepare(
            'DELETE FROM email_verifications WHERE email = :email AND purpose = :purpose'
        );
        $stmt->execute([
            'email' => strtolower(trim($email)),
            'purpose' => $purpose,
        ]);
    }
}

/**
 * Polymorphic Strategy 1: Password Authentication Strategy.
 */
class PasswordAuthStrategy implements AuthenticationStrategyInterface
{
    private UserRepositoryInterface $userRepository;

    public function __construct(UserRepositoryInterface $userRepository)
    {
        $this->userRepository = $userRepository;
    }

    public function authenticate(array $credentials): User
    {
        $email = strtolower(trim((string) ($credentials['email'] ?? '')));
        $password = (string) ($credentials['password'] ?? '');

        $user = $this->userRepository->findByEmail($email);

        if ($user === null || !$user->verifyPassword($password)) {
            throw new InvalidCredentialsException('Invalid email or password.');
        }

        if ($user->isBanned()) {
            throw new UserBannedException(
                'Your account has been temporarily suspended.',
                $user->getBanReason() ?? 'No reason provided.',
                $user->getBannedUntil() ?? ''
            );
        }

        return $user;
    }
}

/**
 * Polymorphic Strategy 2: OTP Verification & Registration Strategy.
 */
class OtpVerificationStrategy implements AuthenticationStrategyInterface
{
    private UserRepositoryInterface $userRepository;
    private VerificationRepositoryInterface $verificationRepository;

    public function __construct(
        UserRepositoryInterface $userRepository,
        VerificationRepositoryInterface $verificationRepository
    ) {
        $this->userRepository = $userRepository;
        $this->verificationRepository = $verificationRepository;
    }

    public function authenticate(array $credentials): User
    {
        $email = strtolower(trim((string) ($credentials['email'] ?? '')));
        $code = trim((string) ($credentials['code'] ?? ''));
        $purpose = (string) ($credentials['purpose'] ?? 'signup');

        $verification = $this->verificationRepository->find($email, $code, $purpose);

        if ($verification === null || $verification->isExpired()) {
            throw new InvalidOtpException('Invalid or expired verification code.');
        }

        $payload = $verification->getDecodedPayload();

        if (!is_array($payload) || !isset($payload['name'], $payload['password_hash'])) {
            throw new ValidationException('Registration data is corrupted. Please sign up again.');
        }

        if ($this->userRepository->findByEmail($email) !== null) {
            $this->verificationRepository->clear($email, $purpose);
            throw new UserAlreadyExistsException('An account with that email already exists.');
        }

        $role = function_exists('isAdminEmail') && isAdminEmail($email) ? 'admin' : 'user';

        $user = $this->userRepository->create(
            (string) $payload['name'],
            $email,
            (string) $payload['password_hash'],
            $role
        );

        $this->verificationRepository->clear($email, $purpose);

        return $user;
    }
}

/**
 * Polymorphic Strategy 3: Google OAuth Authentication Strategy.
 */
class GoogleAuthStrategy implements AuthenticationStrategyInterface
{
    private UserRepositoryInterface $userRepository;

    public function __construct(UserRepositoryInterface $userRepository)
    {
        $this->userRepository = $userRepository;
    }

    public function authenticate(array $credentials): User
    {
        $userId = (int) ($credentials['user_id'] ?? 0);
        $accessToken = (string) ($credentials['access_token'] ?? '');
        $refreshToken = isset($credentials['refresh_token']) ? (string) $credentials['refresh_token'] : null;
        $expiresIn = (int) ($credentials['expires_in'] ?? 3600);

        $user = $this->userRepository->findById($userId);
        if ($user === null) {
            throw new InvalidCredentialsException('User session required for Google OAuth binding.');
        }

        $expiresAt = date('Y-m-d H:i:s', time() + $expiresIn);
        $this->userRepository->updateGoogleTokens($user->getId(), $accessToken, $refreshToken, $expiresAt);

        return $user;
    }
}

/**
 * Abstract Base Authentication Service (Inheritance).
 */
abstract class AbstractAuthService implements AuthServiceInterface
{
    protected UserRepositoryInterface $userRepository;
    protected VerificationRepositoryInterface $verificationRepository;

    public function __construct(
        UserRepositoryInterface $userRepository,
        VerificationRepositoryInterface $verificationRepository
    ) {
        $this->userRepository = $userRepository;
        $this->verificationRepository = $verificationRepository;
    }

    protected function generateOtp(): string
    {
        return str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    }

    protected function setSessionUser(int $userId): void
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            session_start();
        }
        $_SESSION['user_id'] = $userId;
    }

    protected function clearSession(): void
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            session_start();
        }
        session_unset();
        session_destroy();
    }

    public function getCurrentUser(): ?User
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            session_start();
        }

        $userId = $_SESSION['user_id'] ?? null;
        if ($userId === null) {
            return null;
        }

        return $this->userRepository->findById((int) $userId);
    }

    protected function sendEmailOtp(string $email, string $otp, string $purpose): bool
    {
        if (function_exists('sendOtpEmail')) {
            return sendOtpEmail($email, $otp, $purpose);
        }
        return false;
    }
}

/**
 * Concrete Authentication Domain Service (Extends AbstractAuthService & implements AuthServiceInterface).
 */
class AuthService extends AbstractAuthService
{
    private AuthenticationStrategyInterface $passwordStrategy;
    private AuthenticationStrategyInterface $otpStrategy;
    private AuthenticationStrategyInterface $googleStrategy;

    public function __construct(
        ?UserRepositoryInterface $userRepository = null,
        ?VerificationRepositoryInterface $verificationRepository = null,
        ?AuthenticationStrategyInterface $passwordStrategy = null,
        ?AuthenticationStrategyInterface $otpStrategy = null,
        ?AuthenticationStrategyInterface $googleStrategy = null
    ) {
        $userRepo = $userRepository ?? new PdoUserRepository();
        $verificationRepo = $verificationRepository ?? new PdoVerificationRepository();

        parent::__construct($userRepo, $verificationRepo);

        $this->passwordStrategy = $passwordStrategy ?? new PasswordAuthStrategy($this->userRepository);
        $this->otpStrategy = $otpStrategy ?? new OtpVerificationStrategy($this->userRepository, $this->verificationRepository);
        $this->googleStrategy = $googleStrategy ?? new GoogleAuthStrategy($this->userRepository);
    }

    public function register(RegisterDTO $dto): array
    {
        $existing = $this->userRepository->findByEmail($dto->getEmail());
        if ($existing !== null) {
            throw new UserAlreadyExistsException('An account with that email already exists.');
        }

        $payload = json_encode([
            'name' => $dto->getName(),
            'password_hash' => password_hash($dto->getPassword(), PASSWORD_DEFAULT),
        ]);

        $otp = $this->generateOtp();
        $this->verificationRepository->store($dto->getEmail(), $otp, 'signup', $payload);

        $sent = $this->sendEmailOtp($dto->getEmail(), $otp, 'signup');
        if (!$sent) {
            throw new RuntimeException('Unable to send verification email. Please try again.');
        }

        return [
            'message' => 'Email successfully sent!',
            'requires_otp' => true,
            'email' => $dto->getEmail(),
        ];
    }

    public function verifyOtp(OtpVerifyDTO $dto): array
    {
        // Polymorphically execute OTP strategy
        $user = $this->otpStrategy->authenticate([
            'email' => $dto->getEmail(),
            'code' => $dto->getCode(),
            'purpose' => 'signup',
        ]);

        $this->setSessionUser($user->getId());

        return [
            'message' => 'Account created successfully.',
            'user' => $user->toArray(),
        ];
    }

    public function login(LoginDTO $dto): array
    {
        // Polymorphically execute Password strategy
        $user = $this->passwordStrategy->authenticate([
            'email' => $dto->getEmail(),
            'password' => $dto->getPassword(),
        ]);

        $this->setSessionUser($user->getId());

        return [
            'message' => 'Signed in successfully.',
            'user' => $user->toArray(),
        ];
    }

    public function forgotPassword(string $email): array
    {
        $normalizedEmail = strtolower(trim($email));

        if ($normalizedEmail === '') {
            throw new ValidationException('Email is required.');
        }

        if (!filter_var($normalizedEmail, FILTER_VALIDATE_EMAIL)) {
            throw new ValidationException('Enter a valid email address.');
        }

        $user = $this->userRepository->findByEmail($normalizedEmail);
        if ($user === null) {
            throw new UserNotFoundException('No account found with this email address.');
        }

        $otp = $this->generateOtp();
        $this->verificationRepository->store($normalizedEmail, $otp, 'forgot_password');

        $sent = $this->sendEmailOtp($normalizedEmail, $otp, 'forgot_password');
        if (!$sent) {
            throw new RuntimeException('Unable to send reset email. Please try again.');
        }

        return [
            'message' => 'Email successfully sent!',
            'requires_otp' => true,
            'email' => $normalizedEmail,
        ];
    }

    public function resetPassword(ResetPasswordDTO $dto): array
    {
        $verification = $this->verificationRepository->find($dto->getEmail(), $dto->getCode(), 'forgot_password');
        if ($verification === null || $verification->isExpired()) {
            throw new InvalidOtpException('Invalid or expired reset code.');
        }

        $user = $this->userRepository->findByEmail($dto->getEmail());
        if ($user === null) {
            throw new UserNotFoundException('User not found.');
        }

        $newHash = password_hash($dto->getNewPassword(), PASSWORD_DEFAULT);
        $this->userRepository->updatePassword($user->getId(), $newHash);
        $this->verificationRepository->clear($dto->getEmail(), 'forgot_password');

        $this->setSessionUser($user->getId());

        return [
            'message' => 'Password reset successfully.',
            'user' => $user->toArray(),
        ];
    }

    public function logout(): void
    {
        $this->clearSession();
    }
}

/**
 * Primary OOP Controller for Authentication HTTP endpoints.
 */
class AuthController
{
    private AuthServiceInterface $authService;

    public function __construct(?AuthServiceInterface $authService = null)
    {
        $this->authService = $authService ?? new AuthService();
    }

    public function handleMe(): void
    {
        $user = $this->authService->getCurrentUser();
        $this->jsonResponse(200, [
            'authenticated' => $user !== null,
            'user' => $user !== null ? $user->toArray() : null,
        ]);
    }

    public function handleRegister(array $inputData): void
    {
        try {
            $dto = new RegisterDTO($inputData);
            $response = $this->authService->register($dto);
            $this->jsonResponse(200, $response);
        } catch (AuthException $e) {
            $this->jsonResponse($e->getStatusCode(), array_merge(['message' => $e->getMessage()], $e->getData()));
        } catch (Throwable $e) {
            $this->jsonResponse(500, ['message' => $e->getMessage()]);
        }
    }

    public function handleVerifyOtp(array $inputData): void
    {
        try {
            $dto = new OtpVerifyDTO($inputData);
            $response = $this->authService->verifyOtp($dto);
            $this->jsonResponse(201, $response);
        } catch (AuthException $e) {
            $this->jsonResponse($e->getStatusCode(), array_merge(['message' => $e->getMessage()], $e->getData()));
        } catch (Throwable $e) {
            $this->jsonResponse(500, ['message' => $e->getMessage()]);
        }
    }

    public function handleLogin(array $inputData): void
    {
        try {
            $dto = new LoginDTO($inputData);
            $response = $this->authService->login($dto);
            $this->jsonResponse(200, $response);
        } catch (AuthException $e) {
            $this->jsonResponse($e->getStatusCode(), array_merge(['message' => $e->getMessage()], $e->getData()));
        } catch (Throwable $e) {
            $this->jsonResponse(500, ['message' => $e->getMessage()]);
        }
    }

    public function handleForgotPassword(array $inputData): void
    {
        try {
            $email = (string) ($inputData['email'] ?? '');
            $response = $this->authService->forgotPassword($email);
            $this->jsonResponse(200, $response);
        } catch (AuthException $e) {
            $this->jsonResponse($e->getStatusCode(), array_merge(['message' => $e->getMessage()], $e->getData()));
        } catch (Throwable $e) {
            $this->jsonResponse(500, ['message' => $e->getMessage()]);
        }
    }

    public function handleResetPassword(array $inputData): void
    {
        try {
            $dto = new ResetPasswordDTO($inputData);
            $response = $this->authService->resetPassword($dto);
            $this->jsonResponse(200, $response);
        } catch (AuthException $e) {
            $this->jsonResponse($e->getStatusCode(), array_merge(['message' => $e->getMessage()], $e->getData()));
        } catch (Throwable $e) {
            $this->jsonResponse(500, ['message' => $e->getMessage()]);
        }
    }

    public function handleLogout(): void
    {
        $this->authService->logout();
        $this->jsonResponse(200, ['message' => 'Signed out successfully.']);
    }

    private function jsonResponse(int $status, array $payload): void
    {
        if (function_exists('jsonResponse')) {
            jsonResponse($status, $payload);
            return;
        }

        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($payload, JSON_UNESCAPED_SLASHES);
        exit;
    }
}
