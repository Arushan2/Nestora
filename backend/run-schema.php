<?php

declare(strict_types=1);

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

function env(string $key, ?string $default = null): ?string
{
    $value = getenv($key);

    if ($value === false || $value === '') {
        return $default;
    }

    return $value;
}

function fail(string $message): void
{
    fwrite(STDERR, $message . PHP_EOL);
    exit(1);
}

loadEnvFile(__DIR__ . '/.env');

$schemaPath = $argv[1] ?? __DIR__ . '/schema.sql';

if (!is_file($schemaPath)) {
    fail('Schema file not found: ' . $schemaPath);
}

$host = env('DB_HOST', '127.0.0.1');
$port = env('DB_PORT', '3306');
$database = env('DB_DATABASE', 'nestora');
$username = env('DB_USERNAME', 'root');
$password = env('DB_PASSWORD', '');

try {
    $serverConnection = new PDO(
        "mysql:host={$host};port={$port};charset=utf8mb4",
        $username,
        $password,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );

    $serverConnection->exec(sprintf(
        'CREATE DATABASE IF NOT EXISTS `%s` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
        str_replace('`', '``', $database)
    ));

    $pdo = new PDO(
        "mysql:host={$host};port={$port};dbname={$database};charset=utf8mb4",
        $username,
        $password,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );

    $sql = file_get_contents($schemaPath);

    if ($sql === false || trim($sql) === '') {
        fail('Schema file is empty or unreadable: ' . $schemaPath);
    }

    $pdo->exec($sql);

    $pdo->exec("ALTER TABLE users MODIFY role ENUM('user', 'admin', 'service_provider', 'product_seller') NOT NULL DEFAULT 'user'");

    // Idempotent: add banned_until column if it doesn't already exist
    $checkBannedUntil = $pdo->prepare(
        "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'banned_until'"
    );
    $checkBannedUntil->execute(['db' => $database]);
    if ((int) $checkBannedUntil->fetchColumn() === 0) {
        $pdo->exec('ALTER TABLE users ADD COLUMN banned_until TIMESTAMP NULL DEFAULT NULL AFTER role');
    }

    // Idempotent: add ban_reason column if it doesn't already exist
    $checkBanReason = $pdo->prepare(
        "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'ban_reason'"
    );
    $checkBanReason->execute(['db' => $database]);
    if ((int) $checkBanReason->fetchColumn() === 0) {
        $pdo->exec('ALTER TABLE users ADD COLUMN ban_reason VARCHAR(255) NULL DEFAULT NULL AFTER banned_until');
    }

    $pdo->exec(
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
            bank_name VARCHAR(120) NULL,
            account_holder_name VARCHAR(190) NULL,
            account_number VARCHAR(60) NULL,
            branch VARCHAR(120) NULL,
            review_note VARCHAR(255) NULL,
            reviewed_at TIMESTAMP NULL DEFAULT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY pro_applications_user_unique (user_id),
            CONSTRAINT pro_applications_user_id_foreign FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    // Idempotent column check for pro_applications
    $checkBank = $pdo->prepare(
        "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'pro_applications' AND COLUMN_NAME = 'bank_name'"
    );
    $checkBank->execute(['db' => $database]);
    if ((int) $checkBank->fetchColumn() === 0) {
        $pdo->exec('ALTER TABLE pro_applications ADD COLUMN bank_name VARCHAR(120) NULL AFTER status');
        $pdo->exec('ALTER TABLE pro_applications ADD COLUMN account_holder_name VARCHAR(190) NULL AFTER bank_name');
        $pdo->exec('ALTER TABLE pro_applications ADD COLUMN account_number VARCHAR(60) NULL AFTER account_holder_name');
        $pdo->exec('ALTER TABLE pro_applications ADD COLUMN branch VARCHAR(120) NULL AFTER account_number');
    }

    // Idempotent column check for orders
    $checkOrdersTable = $pdo->prepare(
        "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'orders'"
    );
    $checkOrdersTable->execute(['db' => $database]);
    if ((int) $checkOrdersTable->fetchColumn() > 0) {
        $checkShippedAt = $pdo->prepare(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'shipped_at'"
        );
        $checkShippedAt->execute(['db' => $database]);
        if ((int) $checkShippedAt->fetchColumn() === 0) {
            $pdo->exec('ALTER TABLE orders ADD COLUMN shipped_at TIMESTAMP NULL DEFAULT NULL AFTER status');
        }
    }

    // Create seller_settlements table
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS seller_settlements (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            seller_id INT UNSIGNED NOT NULL,
            gross_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            commission_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            amount DECIMAL(10,2) NOT NULL,
            receipt_url VARCHAR(255) NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            CONSTRAINT seller_settlements_seller_id_foreign FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    // Idempotent column check for seller_settlements
    $checkGross = $pdo->prepare(
        "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'seller_settlements' AND COLUMN_NAME = 'gross_amount'"
    );
    $checkGross->execute(['db' => $database]);
    if ((int) $checkGross->fetchColumn() === 0) {
        $pdo->exec("ALTER TABLE seller_settlements ADD COLUMN gross_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER seller_id");
        $pdo->exec("ALTER TABLE seller_settlements ADD COLUMN commission_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER gross_amount");
    }

    // Idempotent column check for order_items payback tracking
    $checkOrderItemsTable = $pdo->prepare(
        "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'order_items'"
    );
    $checkOrderItemsTable->execute(['db' => $database]);
    if ((int) $checkOrderItemsTable->fetchColumn() > 0) {
        $checkPaybackStatus = $pdo->prepare(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'order_items' AND COLUMN_NAME = 'payback_status'"
        );
        $checkPaybackStatus->execute(['db' => $database]);
        if ((int) $checkPaybackStatus->fetchColumn() === 0) {
            $pdo->exec("ALTER TABLE order_items ADD COLUMN payback_status ENUM('pending', 'settled') NOT NULL DEFAULT 'pending'");
            $pdo->exec("ALTER TABLE order_items ADD COLUMN seller_settlement_id INT UNSIGNED NULL");
            $pdo->exec("ALTER TABLE order_items ADD COLUMN settled_at TIMESTAMP NULL DEFAULT NULL");
        }
    }

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS service_reviews (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            service_id INT UNSIGNED NOT NULL,
            user_id INT UNSIGNED NOT NULL,
            rating TINYINT UNSIGNED NOT NULL,
            comment TEXT NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            CONSTRAINT service_reviews_service_id_foreign FOREIGN KEY (service_id) REFERENCES service_listings(id) ON DELETE CASCADE,
            CONSTRAINT service_reviews_user_id_foreign FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );


    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS email_verifications (

            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            email VARCHAR(190) NOT NULL,
            code VARCHAR(6) NOT NULL,
            purpose ENUM('signup', 'forgot_password') NOT NULL,
            payload TEXT NULL,
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY email_verifications_email_purpose (email, purpose)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
} catch (Throwable $exception) {
    fail('Failed to execute schema: ' . $exception->getMessage());
}

echo 'Schema executed successfully from ' . $schemaPath . PHP_EOL;
