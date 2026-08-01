<?php

declare(strict_types=1);

namespace Nestora\Controllers;

use Nestora\Core\Base\AbstractController;
use Nestora\Core\Http\Request;
use Nestora\Core\Http\Response;
use Nestora\Repositories\UserRepository;
use Nestora\Core\Services\MailService;

class AuthController extends AbstractController
{
    private UserRepository $userRepository;
    private MailService $mailService;

    public function __construct()
    {
        parent::__construct();
        $this->userRepository = new UserRepository();
        $this->mailService = new MailService();
    }

    public function me(Request $request): Response
    {
        $user = $this->currentUser($request);
        if (!$user) {
            return $this->json(200, ['authenticated' => false, 'user' => null]);
        }

        unset($user['password_hash']);
        return $this->json(200, ['authenticated' => true, 'user' => $user]);
    }

    public function register(Request $request): Response
    {
        $body = $request->getBody();
        $fullName = trim((string) ($body['fullName'] ?? $body['name'] ?? ''));
        $email = strtolower(trim((string) ($body['email'] ?? '')));
        $password = (string) ($body['password'] ?? '');
        $phone = trim((string) ($body['phone'] ?? ''));

        if ($fullName === '' || $email === '' || $password === '') {
            return $this->error(422, 'Full name, email, and password are required.');
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return $this->error(422, 'Please provide a valid email address.');
        }

        if (strlen($password) < 6) {
            return $this->error(422, 'Password must be at least 6 characters.');
        }

        $existing = $this->userRepository->findByEmail($email);
        if ($existing) {
            return $this->error(409, 'An account with this email already exists.');
        }

        $requireVerification = (bool) (getenv('REQUIRE_EMAIL_VERIFICATION') ?: false);
        if ($requireVerification) {
            $otp = sprintf('%06d', random_int(0, 999999));
            $expiresAt = date('Y-m-d H:i:s', strtotime('+10 minutes'));
            
            $payloadJson = json_encode([
                'name' => $fullName,
                'password_hash' => password_hash($password, PASSWORD_DEFAULT),
                'phone' => $phone
            ]);

            $this->db->query(
                'INSERT INTO email_verifications (email, code, purpose, payload, expires_at) VALUES (:email, :code, "signup", :payload, :expires_at)',
                ['email' => $email, 'code' => $otp, 'payload' => $payloadJson, 'expires_at' => $expiresAt]
            );

            $this->mailService->sendOtp($email, $otp, 'registration');

            return $this->json(200, ['requiresVerification' => true, 'message' => 'Verification code sent to your email.']);
        }

        $configuredAdmin = strtolower(trim((string) (getenv('ADMIN_EMAIL') ?: '')));
        $role = ($configuredAdmin !== '' && $email === $configuredAdmin) ? 'admin' : 'user';

        $userId = $this->userRepository->create([
            'name' => $fullName,
            'email' => $email,
            'password_hash' => password_hash($password, PASSWORD_DEFAULT),
            'phone' => $phone,
            'role' => $role
        ]);

        $request->setSession('user_id', $userId);
        $user = $this->userRepository->find($userId);
        unset($user['password_hash']);

        return $this->json(201, ['user' => $user]);
    }

    public function login(Request $request): Response
    {
        $body = $request->getBody();
        $email = strtolower(trim((string) ($body['email'] ?? '')));
        $password = (string) ($body['password'] ?? '');

        if ($email === '' || $password === '') {
            return $this->error(422, 'Email and password are required.');
        }

        $user = $this->userRepository->findByEmail($email);
        if (!$user || !password_verify($password, (string) ($user['password_hash'] ?? ''))) {
            return $this->error(401, 'Invalid email or password.');
        }

        if (!empty($user['banned_until'])) {
            $bannedUntil = strtotime((string) $user['banned_until']);
            if ($bannedUntil !== false && $bannedUntil > time()) {
                return $this->error(403, 'Your account has been suspended until ' . $user['banned_until'] . '. Reason: ' . ($user['ban_reason'] ?? 'No reason provided'));
            }
        }

        $request->setSession('user_id', (int) $user['id']);
        unset($user['password_hash']);

        return $this->json(200, ['user' => $user]);
    }

    public function logout(Request $request): Response
    {
        $request->unsetSession('user_id');
        return $this->json(200, ['message' => 'Logged out successfully']);
    }

    public function verifyOtp(Request $request): Response
    {
        $body = $request->getBody();
        $email = strtolower(trim((string) ($body['email'] ?? '')));
        $code = trim((string) ($body['code'] ?? ''));

        if ($email === '' || $code === '') {
            return $this->error(422, 'Email and verification code are required.');
        }

        $verification = $this->db->fetch(
            'SELECT * FROM email_verifications WHERE email = :email AND code = :code AND purpose = "signup" AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
            ['email' => $email, 'code' => $code]
        );

        if (!$verification) {
            return $this->error(400, 'Invalid or expired verification code.');
        }

        $payload = json_decode((string) $verification['payload'], true);
        if (!is_array($payload) || !isset($payload['name'], $payload['password_hash'])) {
            return $this->error(500, 'Registration data is corrupted. Please sign up again.');
        }

        $existing = $this->userRepository->findByEmail($email);
        if ($existing) {
            $this->db->query('DELETE FROM email_verifications WHERE email = :email AND purpose = "signup"', ['email' => $email]);
            return $this->error(409, 'An account with that email already exists.');
        }

        $configuredAdmin = strtolower(trim((string) (getenv('ADMIN_EMAIL') ?: '')));
        $role = ($configuredAdmin !== '' && $email === $configuredAdmin) ? 'admin' : 'user';

        $userId = $this->userRepository->create([
            'name' => $payload['name'],
            'email' => $email,
            'password_hash' => $payload['password_hash'],
            'phone' => $payload['phone'] ?? '',
            'role' => $role,
        ]);

        $this->db->query('DELETE FROM email_verifications WHERE email = :email AND purpose = "signup"', ['email' => $email]);

        $request->setSession('user_id', $userId);
        $user = $this->userRepository->find($userId);
        unset($user['password_hash']);

        return $this->json(201, ['message' => 'Account created successfully.', 'user' => $user]);
    }

    public function forgotPassword(Request $request): Response
    {
        $body = $request->getBody();
        $email = strtolower(trim((string) ($body['email'] ?? '')));

        if ($email === '') {
            return $this->error(422, 'Email is required.');
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return $this->error(422, 'Enter a valid email address.');
        }

        $user = $this->userRepository->findByEmail($email);
        if (!$user) {
            return $this->error(404, 'No account found with this email address.');
        }

        $otp = sprintf('%06d', random_int(0, 999999));
        $expiresAt = date('Y-m-d H:i:s', strtotime('+10 minutes'));

        $this->db->query(
            'INSERT INTO email_verifications (email, code, purpose, expires_at) VALUES (:email, :code, "forgot_password", :expires_at)',
            ['email' => $email, 'code' => $otp, 'expires_at' => $expiresAt]
        );

        $this->mailService->sendOtp($email, $otp, 'forgot_password');

        return $this->json(200, ['message' => 'Email successfully sent!', 'requires_otp' => true, 'email' => $email]);
    }

    public function resetPassword(Request $request): Response
    {
        $body = $request->getBody();
        $email = strtolower(trim((string) ($body['email'] ?? '')));
        $code = trim((string) ($body['code'] ?? ''));
        $newPassword = (string) ($body['new_password'] ?? '');

        if ($email === '' || $code === '' || $newPassword === '') {
            return $this->error(422, 'Email, code, and new password are required.');
        }

        if (strlen($newPassword) < 6) {
            return $this->error(422, 'Password must be at least 6 characters.');
        }

        $verification = $this->db->fetch(
            'SELECT * FROM email_verifications WHERE email = :email AND code = :code AND purpose = "forgot_password" AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
            ['email' => $email, 'code' => $code]
        );

        if (!$verification) {
            return $this->error(400, 'Invalid or expired reset code.');
        }

        $user = $this->userRepository->findByEmail($email);
        if (!$user) {
            return $this->error(404, 'User not found.');
        }

        $this->userRepository->update((int) $user['id'], [
            'password_hash' => password_hash($newPassword, PASSWORD_DEFAULT)
        ]);

        $this->db->query('DELETE FROM email_verifications WHERE email = :email AND purpose = "forgot_password"', ['email' => $email]);

        return $this->json(200, ['message' => 'Password reset successfully. You can now log in.']);
    }
}
