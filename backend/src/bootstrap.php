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

function env(string $key, ?string $default = null): ?string
{
    $value = getenv($key);

    if ($value === false || $value === '') {
        return $default;
    }

    return $value;
}

function normalizeEmail(string $email): string
{
    return strtolower(trim($email));
}

function adminEmail(): string
{
    return normalizeEmail((string) env('ADMIN_EMAIL', ''));
}

function isAdminEmail(string $email): bool
{
    $configuredAdminEmail = adminEmail();

    return $configuredAdminEmail !== '' && normalizeEmail($email) === $configuredAdminEmail;
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

function ensureSchemaCompatibility(): void
{
    database()->exec(
        "CREATE TABLE IF NOT EXISTS pro_applications (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id INT UNSIGNED NOT NULL,
            application_type ENUM('service_provider', 'product_seller') NOT NULL,
            business_name VARCHAR(190) NOT NULL,
            business_email VARCHAR(190) NOT NULL,
            business_phone VARCHAR(60) NOT NULL,
            business_address VARCHAR(255) NOT NULL,
            business_city VARCHAR(120) NOT NULL,
            business_description TEXT NOT NULL,
            document_type VARCHAR(120) NOT NULL,
            document_number VARCHAR(190) NOT NULL,
            document_file VARCHAR(255) NOT NULL,
            status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
            review_note VARCHAR(255) NULL,
            reviewed_at TIMESTAMP NULL DEFAULT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY pro_applications_user_unique (user_id),
            CONSTRAINT pro_applications_user_id_foreign FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    database()->exec(
        "ALTER TABLE users
            MODIFY role ENUM('user', 'admin', 'service_provider', 'product_seller') NOT NULL DEFAULT 'user'"
    );
}

ensureSchemaCompatibility();

function applicationByUserId(int $userId): ?array
{
    $statement = database()->prepare('SELECT * FROM pro_applications WHERE user_id = :user_id LIMIT 1');
    $statement->execute(['user_id' => $userId]);
    $application = $statement->fetch();

    return is_array($application) ? $application : null;
}

function applicationSummary(?array $application): ?array
{
    if (!is_array($application)) {
        return null;
    }

    return [
        'id' => (int) $application['id'],
        'application_type' => $application['application_type'],
        'business_name' => $application['business_name'],
        'status' => $application['status'],
        'review_note' => $application['review_note'],
        'reviewed_at' => $application['reviewed_at'],
        'created_at' => $application['created_at'],
    ];
}

function userById(int $id): ?array
{
    $statement = database()->prepare('SELECT id, name, email, role, created_at FROM users WHERE id = :id LIMIT 1');
    $statement->execute(['id' => $id]);
    $user = $statement->fetch();

    if (!is_array($user)) {
        return null;
    }

    $user['application'] = applicationSummary(applicationByUserId((int) $user['id']));

    return $user;
}

function currentUser(): ?array
{
    $id = isset($_SESSION['user_id']) ? (int) $_SESSION['user_id'] : 0;

    if ($id <= 0) {
        return null;
    }

    $user = userById($id);

    if ($user === null) {
        return null;
    }

    if (isAdminEmail((string) $user['email']) && ($user['role'] ?? 'user') !== 'admin') {
        $statement = database()->prepare('UPDATE users SET role = :role WHERE id = :id');
        $statement->execute([
            'role' => 'admin',
            'id' => (int) $user['id'],
        ]);
        $user['role'] = 'admin';
    }

    return $user;
}

function currentUserOrFail(): array
{
    $user = currentUser();

    if ($user === null) {
        jsonResponse(401, ['message' => 'You must be signed in.']);
    }

    return $user;
}

function adminOnly(): array
{
    $user = currentUserOrFail();

    if (($user['role'] ?? '') !== 'admin') {
        jsonResponse(403, ['message' => 'Admin access required.']);
    }

    return $user;
}
