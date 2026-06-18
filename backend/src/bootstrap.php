<?php

declare(strict_types=1);

session_start();

require_once __DIR__ . '/../../vendor/autoload.php';

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
    // For multipart/form-data requests, php://input is not usable — PHP populates $_POST and $_FILES instead.
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    if (str_contains($contentType, 'multipart/form-data')) {
        return [];
    }

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
            logo_url VARCHAR(255) NULL,
            banner_url VARCHAR(255) NULL,
            selected_plan VARCHAR(255) NULL,
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

    try {
        database()->exec("ALTER TABLE pro_applications ADD COLUMN logo_url VARCHAR(255) NULL AFTER document_file");
    } catch (Throwable $e) {
    }

    try {
        database()->exec("ALTER TABLE pro_applications ADD COLUMN banner_url VARCHAR(255) NULL AFTER logo_url");
    } catch (Throwable $e) {
    }

    try {
        database()->exec("ALTER TABLE pro_applications ADD COLUMN selected_plan VARCHAR(255) NULL AFTER banner_url");
    } catch (Throwable $e) {
    }

    try {
        database()->exec("ALTER TABLE pro_applications ADD COLUMN stripe_checkout_url TEXT NULL AFTER selected_plan");
    } catch (Throwable $e) {
    }

    database()->exec(
        "ALTER TABLE users
            MODIFY role ENUM('user', 'admin', 'service_provider', 'product_seller') NOT NULL DEFAULT 'user'"
    );

    try {
        database()->exec("ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR(255) NULL AFTER ban_reason");
    } catch (Throwable $e) {
    }

    try {
        database()->exec("ALTER TABLE users ADD COLUMN stripe_subscription_id VARCHAR(255) NULL AFTER stripe_customer_id");
    } catch (Throwable $e) {
    }

    try {
        database()->exec("ALTER TABLE users ADD COLUMN subscription_status VARCHAR(50) NOT NULL DEFAULT 'inactive' AFTER stripe_subscription_id");
    } catch (Throwable $e) {
    }

    database()->exec(
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

    database()->exec(
        "CREATE TABLE IF NOT EXISTS service_listings (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id INT UNSIGNED NOT NULL,
            title VARCHAR(190) NOT NULL,
            category VARCHAR(120) NOT NULL,
            description TEXT NOT NULL,
            pricing_type ENUM('sqft', 'daily_labor', 'per_point', 'linear_ft') NOT NULL,
            price DECIMAL(10,2) NOT NULL,
            price_details VARCHAR(255) NULL,
            cities TEXT NOT NULL,
            images TEXT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            CONSTRAINT service_listings_user_id_foreign FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    database()->exec(
        "CREATE TABLE IF NOT EXISTS product_listings (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id INT UNSIGNED NOT NULL,
            title VARCHAR(190) NOT NULL,
            category VARCHAR(120) NOT NULL,
            brand VARCHAR(190) NULL,
            description TEXT NOT NULL,
            price DECIMAL(10,2) NOT NULL,
            unit_type VARCHAR(50) NOT NULL,
            shipping_districts JSON NULL,
            delivery_terms VARCHAR(255) NULL,
            unloading_provided BOOLEAN NOT NULL DEFAULT 0,
            images JSON NULL,
            shipping_fee DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            stock_units INT UNSIGNED NOT NULL DEFAULT 0,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            CONSTRAINT product_listings_user_id_foreign FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    // Idempotent column check for product_listings
    try {
        $dbName = env('DB_DATABASE', 'nestora');
        $checkShippingFee = database()->prepare(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'product_listings' AND COLUMN_NAME = 'shipping_fee'"
        );
        $checkShippingFee->execute(['db' => $dbName]);
        if ((int) $checkShippingFee->fetchColumn() === 0) {
            database()->exec('ALTER TABLE product_listings ADD COLUMN shipping_fee DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER images');
        }

        $checkStockUnits = database()->prepare(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'product_listings' AND COLUMN_NAME = 'stock_units'"
        );
        $checkStockUnits->execute(['db' => $dbName]);
        if ((int) $checkStockUnits->fetchColumn() === 0) {
            database()->exec('ALTER TABLE product_listings ADD COLUMN stock_units INT UNSIGNED NOT NULL DEFAULT 0 AFTER shipping_fee');
        }
    } catch (Throwable $e) {
        // Safe fallback if column check fails
    }

    database()->exec(
        "CREATE TABLE IF NOT EXISTS orders (
            order_id VARCHAR(50) NOT NULL,
            customer_id INT UNSIGNED NOT NULL,
            seller_id INT UNSIGNED NULL,
            delivery_address TEXT NOT NULL,
            amount DECIMAL(10,2) NOT NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
            payhere_payment_id VARCHAR(255) NULL,
            courier_name VARCHAR(120) NULL,
            tracking_number VARCHAR(120) NULL,
            seller_note VARCHAR(255) NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (order_id),
            CONSTRAINT orders_customer_id_foreign FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
            CONSTRAINT orders_seller_id_foreign FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    database()->exec(
        "CREATE TABLE IF NOT EXISTS order_items (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            order_id VARCHAR(50) NOT NULL,
            product_id INT UNSIGNED NOT NULL,
            title VARCHAR(190) NOT NULL,
            price DECIMAL(10,2) NOT NULL,
            quantity INT UNSIGNED NOT NULL DEFAULT 1,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            CONSTRAINT order_items_order_id_foreign FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
            CONSTRAINT order_items_product_id_foreign FOREIGN KEY (product_id) REFERENCES product_listings(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    // Idempotent migration to alter tables from manual to automated PayHere schema
    try {
        $dbName = env('DB_DATABASE', 'nestora');
        $checkOldId = database()->prepare(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'id'"
        );
        $checkOldId->execute(['db' => $dbName]);
        if ((int) $checkOldId->fetchColumn() > 0) {
            try {
                database()->exec("ALTER TABLE order_items DROP FOREIGN KEY order_items_order_id_foreign");
            } catch (Throwable $e) {}
            database()->exec("ALTER TABLE order_items MODIFY order_id VARCHAR(50) NOT NULL");
            database()->exec("ALTER TABLE orders MODIFY id INT UNSIGNED NOT NULL");
            database()->exec("ALTER TABLE orders DROP PRIMARY KEY");
            database()->exec("ALTER TABLE orders DROP COLUMN id");
            database()->exec("ALTER TABLE orders CHANGE COLUMN order_number order_id VARCHAR(50) NOT NULL");
            database()->exec("ALTER TABLE orders ADD PRIMARY KEY (order_id)");
            database()->exec("ALTER TABLE order_items ADD CONSTRAINT order_items_order_id_foreign FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE");
        }
        $checkAmount = database()->prepare(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'amount'"
        );
        $checkAmount->execute(['db' => $dbName]);
        if ((int) $checkAmount->fetchColumn() === 0) {
            try {
                database()->exec("ALTER TABLE orders CHANGE COLUMN total_cost amount DECIMAL(10,2) NOT NULL");
            } catch (Throwable $e) {
                database()->exec("ALTER TABLE orders ADD COLUMN amount DECIMAL(10,2) NOT NULL AFTER delivery_address");
            }
        }
        database()->exec("ALTER TABLE orders MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'PENDING'");
        $checkPayhere = database()->prepare(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'payhere_payment_id'"
        );
        $checkPayhere->execute(['db' => $dbName]);
        if ((int) $checkPayhere->fetchColumn() === 0) {
            database()->exec("ALTER TABLE orders ADD COLUMN payhere_payment_id VARCHAR(255) NULL AFTER status");
        }
        $checkReceipt = database()->prepare(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'receipt_url'"
        );
        $checkReceipt->execute(['db' => $dbName]);
        if ((int) $checkReceipt->fetchColumn() > 0) {
            database()->exec("ALTER TABLE orders DROP COLUMN receipt_url");
        }
        database()->exec("ALTER TABLE orders MODIFY COLUMN seller_id INT UNSIGNED NULL");
    } catch (Throwable $e) {
        // Safe fallback if migration encounters a transient DB state issue
    }

    database()->exec(
        "CREATE TABLE IF NOT EXISTS product_reviews (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            product_id INT UNSIGNED NOT NULL,
            user_id INT UNSIGNED NOT NULL,
            rating TINYINT UNSIGNED NOT NULL,
            comment TEXT NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            CONSTRAINT product_reviews_product_id_foreign FOREIGN KEY (product_id) REFERENCES product_listings(id) ON DELETE CASCADE,
            CONSTRAINT product_reviews_user_id_foreign FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    database()->exec(
        "CREATE TABLE IF NOT EXISTS service_inquiries (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            service_id INT UNSIGNED NOT NULL,
            customer_id INT UNSIGNED NOT NULL,
            provider_id INT UNSIGNED NOT NULL,
            status ENUM('pending','details_requested','offered','accepted','work_completed','completed') NOT NULL DEFAULT 'pending',
            survey_plan_url VARCHAR(255) NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            CONSTRAINT service_inquiries_service_id_foreign FOREIGN KEY (service_id) REFERENCES service_listings(id) ON DELETE CASCADE,
            CONSTRAINT service_inquiries_customer_id_foreign FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
            CONSTRAINT service_inquiries_provider_id_foreign FOREIGN KEY (provider_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    try {
        database()->exec("ALTER TABLE service_inquiries ADD COLUMN survey_plan_url VARCHAR(255) NULL AFTER status");
    } catch (PDOException $e) {
        // Column already exists
    }

    database()->exec(
        "CREATE TABLE IF NOT EXISTS inquiry_followups (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            inquiry_id INT UNSIGNED NOT NULL,
            sender_id INT UNSIGNED NOT NULL,
            type ENUM('inquiry_created','details_requested','details_replied','offer_sent','correction_requested','offer_accepted','work_completed','completion_confirmed') NOT NULL,
            content TEXT NULL,
            quoted_price DECIMAL(10,2) NULL,
            images TEXT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            CONSTRAINT inquiry_followups_inquiry_id_foreign FOREIGN KEY (inquiry_id) REFERENCES service_inquiries(id) ON DELETE CASCADE,
            CONSTRAINT inquiry_followups_sender_id_foreign FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    database()->exec(
        "CREATE TABLE IF NOT EXISTS portfolios (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id INT UNSIGNED NOT NULL,
            inquiry_id INT UNSIGNED NULL,
            title VARCHAR(190) NOT NULL,
            category VARCHAR(120) NULL,
            description TEXT NULL,
            images TEXT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            CONSTRAINT portfolios_user_id_foreign FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            CONSTRAINT portfolios_inquiry_id_foreign FOREIGN KEY (inquiry_id) REFERENCES service_inquiries(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    try {
        $dbName = env('DB_DATABASE', 'nestora');
        $checkPortfolioIds = database()->prepare(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'service_listings' AND COLUMN_NAME = 'portfolio_ids'"
        );
        $checkPortfolioIds->execute(['db' => $dbName]);
        if ((int) $checkPortfolioIds->fetchColumn() === 0) {
            database()->exec('ALTER TABLE service_listings ADD COLUMN portfolio_ids TEXT NULL AFTER images');
        }

        // Calendar updates: booking_date in service_inquiries
        $checkBookingDate = database()->prepare(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'service_inquiries' AND COLUMN_NAME = 'booking_date'"
        );
        $checkBookingDate->execute(['db' => $dbName]);
        if ((int) $checkBookingDate->fetchColumn() === 0) {
            database()->exec('ALTER TABLE service_inquiries ADD COLUMN booking_date DATE NULL AFTER survey_plan_url');
        }

        // Calendar updates: teams_count in pro_applications
        $checkTeamsCount = database()->prepare(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'pro_applications' AND COLUMN_NAME = 'teams_count'"
        );
        $checkTeamsCount->execute(['db' => $dbName]);
        if ((int) $checkTeamsCount->fetchColumn() === 0) {
            database()->exec('ALTER TABLE pro_applications ADD COLUMN teams_count INT UNSIGNED NOT NULL DEFAULT 1 AFTER banner_url');
        }

        // Calendar updates: provider_schedules table
        database()->exec(
            "CREATE TABLE IF NOT EXISTS provider_schedules (
                id INT UNSIGNED NOT NULL AUTO_INCREMENT,
                provider_id INT UNSIGNED NOT NULL,
                event_date DATE NOT NULL,
                type ENUM('leave', 'manual_work') NOT NULL,
                notes VARCHAR(255) NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                CONSTRAINT provider_schedules_provider_id_foreign FOREIGN KEY (provider_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE KEY provider_schedules_date_type_unique (provider_id, event_date, type)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
        );

        // Google Calendar updates: users table tokens
        $checkGoogleAccess = database()->prepare(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'google_access_token'"
        );
        $checkGoogleAccess->execute(['db' => $dbName]);
        if ((int) $checkGoogleAccess->fetchColumn() === 0) {
            database()->exec('ALTER TABLE users ADD COLUMN google_access_token TEXT NULL');
        }

        $checkGoogleRefresh = database()->prepare(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'google_refresh_token'"
        );
        $checkGoogleRefresh->execute(['db' => $dbName]);
        if ((int) $checkGoogleRefresh->fetchColumn() === 0) {
            database()->exec('ALTER TABLE users ADD COLUMN google_refresh_token TEXT NULL');
        }

        $checkGoogleExpires = database()->prepare(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'google_token_expires_at'"
        );
        $checkGoogleExpires->execute(['db' => $dbName]);
        if ((int) $checkGoogleExpires->fetchColumn() === 0) {
            database()->exec('ALTER TABLE users ADD COLUMN google_token_expires_at TIMESTAMP NULL DEFAULT NULL');
        }

        // Google Calendar updates: service_inquiries table event IDs
        $checkCustEvent = database()->prepare(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'service_inquiries' AND COLUMN_NAME = 'customer_google_event_id'"
        );
        $checkCustEvent->execute(['db' => $dbName]);
        if ((int) $checkCustEvent->fetchColumn() === 0) {
            database()->exec('ALTER TABLE service_inquiries ADD COLUMN customer_google_event_id VARCHAR(255) NULL');
        }

        $checkProvEvent = database()->prepare(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'service_inquiries' AND COLUMN_NAME = 'provider_google_event_id'"
        );
        $checkProvEvent->execute(['db' => $dbName]);
        if ((int) $checkProvEvent->fetchColumn() === 0) {
            database()->exec('ALTER TABLE service_inquiries ADD COLUMN provider_google_event_id VARCHAR(255) NULL');
        }

        // Google Calendar updates: provider_schedules table event ID
        $checkSchEvent = database()->prepare(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'provider_schedules' AND COLUMN_NAME = 'google_event_id'"
        );
        $checkSchEvent->execute(['db' => $dbName]);
        if ((int) $checkSchEvent->fetchColumn() === 0) {
            database()->exec('ALTER TABLE provider_schedules ADD COLUMN google_event_id VARCHAR(255) NULL');
        }
    } catch (Throwable $e) {
        // Safe fallback
    }
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
        'selected_plan' => $application['selected_plan'] ?? null,
        'stripe_checkout_url' => $application['stripe_checkout_url'] ?? null,
        'status' => $application['status'],
        'review_note' => $application['review_note'],
        'reviewed_at' => $application['reviewed_at'],
        'created_at' => $application['created_at'],
    ];
}

function userById(int $id): ?array
{
    $statement = database()->prepare('SELECT id, name, email, role, created_at, subscription_status FROM users WHERE id = :id LIMIT 1');
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

    // Enforce ban: check live ban status from the database
    $banCheck = database()->prepare(
        'SELECT banned_until, ban_reason FROM users WHERE id = :id LIMIT 1'
    );
    $banCheck->execute(['id' => (int) $user['id']]);
    $banData = $banCheck->fetch();

    if (
        is_array($banData) &&
        !empty($banData['banned_until']) &&
        strtotime((string) $banData['banned_until']) > time()
    ) {
        jsonResponse(403, [
            'banned'       => true,
            'message'      => 'Your account has been temporarily suspended.',
            'ban_reason'   => $banData['ban_reason'],
            'banned_until' => $banData['banned_until'],
        ]);
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

// Cloudinary helper: reads configuration from environment and uploads a file.
function cloudinaryConfig(): array
{
    return [
        'cloud_name' => env('CLOUDINARY_CLOUD_NAME', ''),
        'api_key' => env('CLOUDINARY_API_KEY', ''),
        'api_secret' => env('CLOUDINARY_API_SECRET', ''),
        'upload_folder' => env('CLOUDINARY_UPLOAD_FOLDER', 'Home/Nestora'),
    ];
}

// Fallback MIME type detection when finfo and mime_content_type are unavailable
function detectMimeType(string $filePath): string
{
    $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));

    $mimeTypes = [
        'pdf' => 'application/pdf',
        'doc' => 'application/msword',
        'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls' => 'application/vnd.ms-excel',
        'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'png' => 'image/png',
        'gif' => 'image/gif',
        'webp' => 'image/webp',
        'txt' => 'text/plain',
        'zip' => 'application/zip',
    ];

    return $mimeTypes[$ext] ?? 'application/octet-stream';
}

function uploadToCloudinary(string $filePath, string $originalName, string $folder = ''): string
{
    $config = cloudinaryConfig();

    if ($config['cloud_name'] === '') {
        throw new RuntimeException('Cloudinary not configured. Set CLOUDINARY_CLOUD_NAME env variable.');
    }

    if (!is_file($filePath) || !is_readable($filePath)) {
        throw new RuntimeException('Uploaded file not readable: ' . $filePath);
    }

    $uploadPreset = env('CLOUDINARY_UPLOAD_PRESET', '');
    $fileContent = file_get_contents($filePath);
    $mimeType = detectMimeType($filePath);

    if ($folder === '') {
        $folder = $config['upload_folder'];
    }

    // Build multipart form data
    $boundary = '----FormBoundary' . bin2hex(random_bytes(16));

    $body = '';
    $body .= '--' . $boundary . "\r\n";
    $body .= 'Content-Disposition: form-data; name="file"; filename="' . $originalName . "\"\r\n";
    $body .= 'Content-Type: ' . $mimeType . "\r\n\r\n";
    $body .= $fileContent . "\r\n";

    // If using unsigned upload preset
    if ($uploadPreset !== '') {
        $body .= '--' . $boundary . "\r\n";
        $body .= 'Content-Disposition: form-data; name="upload_preset"' . "\r\n\r\n";
        $body .= $uploadPreset . "\r\n";

        $body .= '--' . $boundary . "\r\n";
        $body .= 'Content-Disposition: form-data; name="folder"' . "\r\n\r\n";
        $body .= $folder . "\r\n";
    } else {
        // Signed upload requires API secret
        if ($config['api_key'] === '' || $config['api_secret'] === '') {
            throw new RuntimeException('Either CLOUDINARY_UPLOAD_PRESET or (CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET) must be configured.');
        }

        $timestamp = time();

        // Create signature for upload
        $toSign = 'folder=' . $folder . '&timestamp=' . $timestamp . $config['api_secret'];
        $signature = sha1($toSign);

        $body .= '--' . $boundary . "\r\n";
        $body .= 'Content-Disposition: form-data; name="api_key"' . "\r\n\r\n";
        $body .= $config['api_key'] . "\r\n";

        $body .= '--' . $boundary . "\r\n";
        $body .= 'Content-Disposition: form-data; name="timestamp"' . "\r\n\r\n";
        $body .= $timestamp . "\r\n";

        $body .= '--' . $boundary . "\r\n";
        $body .= 'Content-Disposition: form-data; name="signature"' . "\r\n\r\n";
        $body .= $signature . "\r\n";

        $body .= '--' . $boundary . "\r\n";
        $body .= 'Content-Disposition: form-data; name="folder"' . "\r\n\r\n";
        $body .= $folder . "\r\n";
    }

    $body .= '--' . $boundary . '--' . "\r\n";

    $url = sprintf('https://api.cloudinary.com/v1_1/%s/auto/upload', $config['cloud_name']);

    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => [
                'Content-Type: multipart/form-data; boundary=' . $boundary,
                'Content-Length: ' . strlen($body),
            ],
            'content' => $body,
            'ignore_errors' => true,
        ],
    ]);

    $response = @file_get_contents($url, false, $context);

    if ($response === false) {
        throw new RuntimeException('Cloudinary upload failed: unable to connect.');
    }

    $decoded = json_decode($response, true);

    if (!is_array($decoded)) {
        throw new RuntimeException('Cloudinary upload failed: invalid response.');
    }

    if (!empty($decoded['error'])) {
        $msg = $decoded['error']['message'] ?? 'Unknown error';
        throw new RuntimeException('Cloudinary upload failed: ' . $msg);
    }

    if (empty($decoded['secure_url'])) {
        throw new RuntimeException('Cloudinary upload failed: no URL returned.');
    }

    return $decoded['secure_url'];
}
