<?php

declare(strict_types=1);

function authMe(): void
{
    jsonResponse(200, [
        'authenticated' => currentUser() !== null,
        'user' => currentUser(),
    ]);
}

function authRegister(): void
{
    $data = readJson();
    $name = trim((string) ($data['name'] ?? ''));
    $email = normalizeEmail((string) ($data['email'] ?? ''));
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

    $role = isAdminEmail($email) ? 'admin' : 'user';

    $insert = database()->prepare(
        'INSERT INTO users (name, email, password_hash, role, created_at)
         VALUES (:name, :email, :password_hash, :role, NOW())'
    );
    $insert->execute([
        'name' => $name,
        'email' => $email,
        'password_hash' => password_hash($password, PASSWORD_DEFAULT),
        'role' => $role,
    ]);

    $user = userById((int) database()->lastInsertId());

    if ($user === null) {
        jsonResponse(500, ['message' => 'Unable to create the new account.']);
    }

    $_SESSION['user_id'] = $user['id'];

    jsonResponse(201, [
        'message' => 'Account created successfully.',
        'user' => $user,
    ]);
}

function authLogin(): void
{
    $data = readJson();
    $email = normalizeEmail((string) ($data['email'] ?? ''));
    $password = (string) ($data['password'] ?? '');

    if ($email === '' || $password === '') {
        jsonResponse(422, ['message' => 'Email and password are required.']);
    }

    $statement = database()->prepare('SELECT id, name, email, password_hash, role, created_at FROM users WHERE email = :email LIMIT 1');
    $statement->execute(['email' => $email]);
    $user = $statement->fetch();

    if (!is_array($user) || !password_verify($password, (string) $user['password_hash'])) {
        jsonResponse(401, ['message' => 'Invalid email or password.']);
    }

    unset($user['password_hash']);
    $_SESSION['user_id'] = (int) $user['id'];

    jsonResponse(200, [
        'message' => 'Signed in successfully.',
        'user' => userById((int) $user['id']),
    ]);
}

function authLogout(): void
{
    session_unset();
    session_destroy();

    jsonResponse(200, ['message' => 'Signed out successfully.']);
}
