<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/mail.php';

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateOtp(): string
{
    return str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
}

function storeVerification(string $email, string $code, string $purpose, ?string $payload = null): void
{
    // Remove any previous codes for this email + purpose
    $delete = database()->prepare(
        'DELETE FROM email_verifications WHERE email = :email AND purpose = :purpose'
    );
    $delete->execute(['email' => $email, 'purpose' => $purpose]);

    $insert = database()->prepare(
        'INSERT INTO email_verifications (email, code, purpose, payload, expires_at)
         VALUES (:email, :code, :purpose, :payload, DATE_ADD(NOW(), INTERVAL 10 MINUTE))'
    );
    $insert->execute([
        'email'   => $email,
        'code'    => $code,
        'purpose' => $purpose,
        'payload' => $payload,
    ]);
}

function findVerification(string $email, string $code, string $purpose): ?array
{
    $statement = database()->prepare(
        'SELECT * FROM email_verifications
         WHERE email = :email AND code = :code AND purpose = :purpose AND expires_at > NOW()
         ORDER BY id DESC LIMIT 1'
    );
    $statement->execute([
        'email'   => $email,
        'code'    => $code,
        'purpose' => $purpose,
    ]);

    $row = $statement->fetch();

    return is_array($row) ? $row : null;
}

function clearVerifications(string $email, string $purpose): void
{
    $delete = database()->prepare(
        'DELETE FROM email_verifications WHERE email = :email AND purpose = :purpose'
    );
    $delete->execute(['email' => $email, 'purpose' => $purpose]);
}

// ─── Auth Me ────────────────────────────────────────────────────────────────

function authMe(): void
{
    jsonResponse(200, [
        'authenticated' => currentUser() !== null,
        'user' => currentUser(),
    ]);
}

// ─── Sign-Up: Step 1 — Send OTP ────────────────────────────────────────────

function authRegister(): void
{
    $data = readJson();
    $name     = trim((string) ($data['name'] ?? ''));
    $email    = normalizeEmail((string) ($data['email'] ?? ''));
    $password = (string) ($data['password'] ?? '');

    if ($name === '' || $email === '' || $password === '') {
        jsonResponse(422, ['message' => 'Name, email, and password are required.']);
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        jsonResponse(422, ['message' => 'Enter a valid email address.']);
    }

    $existing = database()->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
    $existing->execute(['email' => $email]);

    if ($existing->fetch()) {
        jsonResponse(409, ['message' => 'An account with that email already exists.']);
    }

    // Store registration data as JSON payload alongside the OTP
    $payload = json_encode([
        'name'          => $name,
        'password_hash' => password_hash($password, PASSWORD_DEFAULT),
    ]);

    $otp = generateOtp();
    storeVerification($email, $otp, 'signup', $payload);

    $sent = sendOtpEmail($email, $otp, 'signup');

    if (!$sent) {
        jsonResponse(500, ['message' => 'Unable to send verification email. Please try again.']);
    }

    jsonResponse(200, [
        'message'       => 'Email successfully sent!',
        'requires_otp'  => true,
        'email'         => $email,
    ]);
}

// ─── Sign-Up: Step 2 — Verify OTP & Create Account ─────────────────────────

function authVerifyOtp(): void
{
    $data  = readJson();
    $email = normalizeEmail((string) ($data['email'] ?? ''));
    $code  = trim((string) ($data['code'] ?? ''));

    if ($email === '' || $code === '') {
        jsonResponse(422, ['message' => 'Email and verification code are required.']);
    }

    $verification = findVerification($email, $code, 'signup');

    if ($verification === null) {
        jsonResponse(400, ['message' => 'Invalid or expired verification code.']);
    }

    $payload = json_decode((string) $verification['payload'], true);

    if (!is_array($payload) || !isset($payload['name'], $payload['password_hash'])) {
        jsonResponse(500, ['message' => 'Registration data is corrupted. Please sign up again.']);
    }

    // Check once more that email is not taken (race condition guard)
    $existing = database()->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
    $existing->execute(['email' => $email]);

    if ($existing->fetch()) {
        clearVerifications($email, 'signup');
        jsonResponse(409, ['message' => 'An account with that email already exists.']);
    }

    $role = isAdminEmail($email) ? 'admin' : 'user';

    $insert = database()->prepare(
        'INSERT INTO users (name, email, password_hash, role, created_at)
         VALUES (:name, :email, :password_hash, :role, NOW())'
    );
    $insert->execute([
        'name'          => $payload['name'],
        'email'         => $email,
        'password_hash' => $payload['password_hash'],
        'role'          => $role,
    ]);

    $user = userById((int) database()->lastInsertId());

    if ($user === null) {
        jsonResponse(500, ['message' => 'Unable to create the new account.']);
    }

    clearVerifications($email, 'signup');

    $_SESSION['user_id'] = $user['id'];

    jsonResponse(201, [
        'message' => 'Account created successfully.',
        'user'    => $user,
    ]);
}

// ─── Sign In ────────────────────────────────────────────────────────────────

function authLogin(): void
{
    $data     = readJson();
    $email    = normalizeEmail((string) ($data['email'] ?? ''));
    $password = (string) ($data['password'] ?? '');

    if ($email === '' || $password === '') {
        jsonResponse(422, ['message' => 'Email and password are required.']);
    }

    $statement = database()->prepare(
        'SELECT id, name, email, password_hash, role, created_at FROM users WHERE email = :email LIMIT 1'
    );
    $statement->execute(['email' => $email]);
    $user = $statement->fetch();

    if (!is_array($user) || !password_verify($password, (string) $user['password_hash'])) {
        jsonResponse(401, ['message' => 'Invalid email or password.']);
    }

    unset($user['password_hash']);
    $_SESSION['user_id'] = (int) $user['id'];

    jsonResponse(200, [
        'message' => 'Signed in successfully.',
        'user'    => userById((int) $user['id']),
    ]);
}

// ─── Forgot Password: Step 1 — Send OTP ────────────────────────────────────

function authForgotPassword(): void
{
    $data  = readJson();
    $email = normalizeEmail((string) ($data['email'] ?? ''));

    if ($email === '') {
        jsonResponse(422, ['message' => 'Email is required.']);
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        jsonResponse(422, ['message' => 'Enter a valid email address.']);
    }

    $existing = database()->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
    $existing->execute(['email' => $email]);

    if (!$existing->fetch()) {
        jsonResponse(404, ['message' => 'No account found with this email address.']);
    }

    $otp = generateOtp();
    storeVerification($email, $otp, 'forgot_password');

    $sent = sendOtpEmail($email, $otp, 'forgot_password');

    if (!$sent) {
        jsonResponse(500, ['message' => 'Unable to send reset email. Please try again.']);
    }

    jsonResponse(200, [
        'message'      => 'Email successfully sent!',
        'requires_otp' => true,
        'email'        => $email,
    ]);
}

// ─── Forgot Password: Step 2 — Verify OTP & Set New Password ───────────────

function authResetPassword(): void
{
    $data        = readJson();
    $email       = normalizeEmail((string) ($data['email'] ?? ''));
    $code        = trim((string) ($data['code'] ?? ''));
    $newPassword = (string) ($data['new_password'] ?? '');

    if ($email === '' || $code === '' || $newPassword === '') {
        jsonResponse(422, ['message' => 'Email, code, and new password are required.']);
    }

    if (strlen($newPassword) < 6) {
        jsonResponse(422, ['message' => 'Password must be at least 6 characters.']);
    }

    $verification = findVerification($email, $code, 'forgot_password');

    if ($verification === null) {
        jsonResponse(400, ['message' => 'Invalid or expired reset code.']);
    }

    $userStatement = database()->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
    $userStatement->execute(['email' => $email]);
    $user = $userStatement->fetch();

    if (!is_array($user)) {
        jsonResponse(404, ['message' => 'User not found.']);
    }

    $update = database()->prepare('UPDATE users SET password_hash = :password_hash WHERE id = :id');
    $update->execute([
        'password_hash' => password_hash($newPassword, PASSWORD_DEFAULT),
        'id'            => (int) $user['id'],
    ]);

    clearVerifications($email, 'forgot_password');

    $_SESSION['user_id'] = (int) $user['id'];

    jsonResponse(200, [
        'message' => 'Password reset successfully.',
        'user'    => userById((int) $user['id']),
    ]);
}

// ─── Sign Out ───────────────────────────────────────────────────────────────

function authLogout(): void
{
    session_unset();
    session_destroy();

    jsonResponse(200, ['message' => 'Signed out successfully.']);
}
