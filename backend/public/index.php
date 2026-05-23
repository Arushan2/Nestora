<?php

declare(strict_types=1);

session_start();

function loadEnvFile(string $path): void
{
    if (!is_file($path)) {
        return;
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

    if ($lines === false) {
        throw new RuntimeException('Unable to read .env file.');
    }

    foreach ($lines as $line) {
        $trimmed = trim($line);

        if ($trimmed === '' || str_starts_with($trimmed, '#') || !str_contains($trimmed, '=')) {
            continue;
        }

        [$key, $value] = array_map('trim', explode('=', $trimmed, 2));
        $value = trim($value, "'\"");

        if ($key !== '' && getenv($key) === false) {
            putenv($key . '=' . $value);
            $_ENV[$key] = $value;
        }
    }
}

loadEnvFile(__DIR__ . '/../.env');

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: http://localhost:5173');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function env(string $key, ?string $default = null): ?string
{
    $value = getenv($key);

    if ($value === false || $value === '') {
        return $default;
    }

    return $value;
}

function jsonResponse(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

function readJson(): array
{
    $raw = file_get_contents('php://input') ?: '';

    if ($raw === '') {
        return [];
    }

    $decoded = json_decode($raw, true);

    if (!is_array($decoded)) {
        jsonResponse(400, ['message' => 'Invalid JSON payload.']);
    }

    return $decoded;
}

function database(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $host = env('DB_HOST', '127.0.0.1');
    $port = env('DB_PORT', '3306');
    $database = env('DB_DATABASE', 'nestora');
    $username = env('DB_USERNAME', 'root');
    $password = env('DB_PASSWORD', '');

    try {
        $pdo = new PDO(
            "mysql:host={$host};port={$port};dbname={$database};charset=utf8mb4",
            $username,
            $password,
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]
        );
    } catch (Throwable $exception) {
        jsonResponse(500, [
            'message' => 'Database connection unavailable.',
            'details' => $exception->getMessage(),
        ]);
    }

    return $pdo;
}

function userById(int $id): ?array
{
    $statement = database()->prepare('SELECT id, name, email, role, created_at FROM users WHERE id = :id LIMIT 1');
    $statement->execute(['id' => $id]);
    $user = $statement->fetch();

    return is_array($user) ? $user : null;
}

function currentUser(): ?array
{
    $id = isset($_SESSION['user_id']) ? (int) $_SESSION['user_id'] : 0;

    if ($id <= 0) {
        return null;
    }

    return userById($id);
}

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET' && $path === '/api/health') {
    jsonResponse(200, ['status' => 'ok']);
}

if ($method === 'GET' && $path === '/api/auth/me') {
    jsonResponse(200, [
        'authenticated' => currentUser() !== null,
        'user' => currentUser(),
    ]);
}

if ($method === 'POST' && $path === '/api/auth/register') {
    $data = readJson();
    $name = trim((string) ($data['name'] ?? ''));
    $email = strtolower(trim((string) ($data['email'] ?? '')));
    $password = (string) ($data['password'] ?? '');
    $role = strtolower(trim((string) ($data['role'] ?? 'user')));
    $adminCode = (string) ($data['adminCode'] ?? '');

    if ($name === '' || $email === '' || $password === '') {
        jsonResponse(422, ['message' => 'Name, email, and password are required.']);
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        jsonResponse(422, ['message' => 'Enter a valid email address.']);
    }

    if (!in_array($role, ['user', 'admin'], true)) {
        $role = 'user';
    }

    if ($role === 'admin') {
        $expectedCode = (string) env('ADMIN_REGISTRATION_KEY', '');

        if ($expectedCode === '' || !hash_equals($expectedCode, $adminCode)) {
            jsonResponse(403, ['message' => 'Admin registration key is required.']);
        }
    }

    $existing = database()->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
    $existing->execute(['email' => $email]);

    if ($existing->fetch()) {
        jsonResponse(409, ['message' => 'An account with that email already exists.']);
    }

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

if ($method === 'POST' && $path === '/api/auth/login') {
    $data = readJson();
    $email = strtolower(trim((string) ($data['email'] ?? '')));
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
        'user' => $user,
    ]);
}

if ($method === 'POST' && $path === '/api/auth/logout') {
    session_unset();
    session_destroy();

    jsonResponse(200, ['message' => 'Signed out successfully.']);
}

jsonResponse(404, ['message' => 'Route not found.']);
