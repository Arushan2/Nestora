<?php

declare(strict_types=1);

function getPhpUploadErrorMessage(int $errorCode): string
{
    switch ($errorCode) {
        case UPLOAD_ERR_INI_SIZE:
            return 'The uploaded file exceeds the server\'s upload_max_filesize limit (usually 2MB). Please resize or compress your image to be under 2MB.';
        case UPLOAD_ERR_FORM_SIZE:
            return 'The uploaded file exceeds the MAX_FILE_SIZE directive.';
        case UPLOAD_ERR_PARTIAL:
            return 'The file was only partially uploaded.';
        case UPLOAD_ERR_NO_TMP_DIR:
            return 'Missing a temporary folder on the server.';
        case UPLOAD_ERR_CANT_WRITE:
            return 'Failed to write file to disk.';
        case UPLOAD_ERR_EXTENSION:
            return 'A server extension stopped the file upload.';
        default:
            return 'Unknown upload error.';
    }
}

function listServiceListings(): void
{
    $myListings = ($_GET['my_listings'] ?? '') === 'true';
    $category = trim($_GET['category'] ?? '');
    $district = trim($_GET['district'] ?? '');
    $userId = (int) ($_GET['user_id'] ?? 0);
    $q = trim($_GET['q'] ?? '');

    $query = 'SELECT s.*, a.business_name, a.business_email, a.business_phone, a.business_address, a.business_city, u.name AS provider_name
              FROM service_listings s
              INNER JOIN users u ON u.id = s.user_id
              LEFT JOIN pro_applications a ON a.user_id = s.user_id';

    $conditions = [];
    $params = [];

    if ($myListings) {
        $user = currentUserOrFail();
        $conditions[] = 's.user_id = :user_id';
        $params['user_id'] = $user['id'];
    } elseif ($userId > 0) {
        $conditions[] = 's.user_id = :user_id';
        $params['user_id'] = $userId;
    }

    if ($category !== '') {
        $conditions[] = 's.category = :category';
        $params['category'] = $category;
    }

    $pricingType = trim($_GET['pricing_type'] ?? '');
    if ($pricingType !== '') {
        $conditions[] = 's.pricing_type = :pricing_type';
        $params['pricing_type'] = $pricingType;
    }

    if ($q !== '') {
        $conditions[] = '(s.title LIKE :q OR s.description LIKE :q)';
        $params['q'] = '%' . $q . '%';
    }

    if ($conditions !== []) {
        $query .= ' WHERE ' . implode(' AND ', $conditions);
    }

    $query .= ' ORDER BY s.created_at DESC';

    $limit = (int)($_GET['limit'] ?? 0);
    if ($limit > 0) {
        $query .= ' LIMIT ' . $limit;
    }

    $statement = database()->prepare($query);
    $statement->execute($params);
    $listings = $statement->fetchAll();

    // If filtering by district client-side is simpler, or we can filter in PHP:
    if ($district !== '') {
        $listings = array_filter($listings, function ($listing) use ($district) {
            $cities = json_decode((string) ($listing['cities'] ?? '[]'), true);
            return is_array($cities) && in_array($district, $cities, true);
        });
        $listings = array_values($listings);
    }

    // Decode JSON strings for output
    foreach ($listings as &$listing) {
        $listing['id'] = (int) $listing['id'];
        $listing['user_id'] = (int) $listing['user_id'];
        $listing['price'] = (float) $listing['price'];
        $listing['cities'] = json_decode((string) ($listing['cities'] ?? '[]'), true);
        $listing['images'] = json_decode((string) ($listing['images'] ?? '[]'), true);
    }

    jsonResponse(200, ['listings' => $listings]);
}

function createServiceListing(): void
{
    file_put_contents(__DIR__ . '/../../debug.log', "=== CREATE REQUEST ===\n" . print_r($_FILES, true) . "\n" . print_r($_POST, true) . "\n", FILE_APPEND);
    $user = currentUserOrFail();
    if ($user['role'] !== 'service_provider' && $user['role'] !== 'admin') {
        jsonResponse(403, ['message' => 'Only service providers can list services.']);
    }

    $rawData = readJson();
    $data = $rawData;
    if (empty($data) && !empty($_POST)) {
        $data = $_POST;
    }

    $title = trim((string) ($data['title'] ?? ''));
    $category = trim((string) ($data['category'] ?? ''));
    $description = trim((string) ($data['description'] ?? ''));
    $pricingType = trim((string) ($data['pricing_type'] ?? ''));
    $price = (float) ($data['price'] ?? 0.0);
    $priceDetails = trim((string) ($data['price_details'] ?? ''));

    if ($title === '' || $category === '' || $description === '' || $pricingType === '') {
        jsonResponse(422, ['message' => 'Title, category, description, and pricing type are required.']);
    }

    $allowedPricingTypes = ['sqft', 'daily_labor', 'per_point', 'linear_ft'];
    if (!in_array($pricingType, $allowedPricingTypes, true)) {
        jsonResponse(422, ['message' => 'Invalid pricing type selected.']);
    }

    if ($price <= 0) {
        jsonResponse(422, ['message' => 'Price must be a positive number.']);
    }

    // Handle cities (districts)
    $cities = $data['cities'] ?? '';
    $citiesArray = [];
    if (is_string($cities) && trim($cities) !== '') {
        $decoded = json_decode($cities, true);
        if (is_array($decoded)) {
            $citiesArray = $decoded;
        } else {
            $citiesArray = array_filter(array_map('trim', explode(',', $cities)));
        }
    } else if (is_array($cities)) {
        $citiesArray = $cities;
    }

    if (empty($citiesArray)) {
        jsonResponse(422, ['message' => 'At least one serving district must be selected.']);
    }

    // Validate upload errors for portfolio_images
    if (isset($_FILES['portfolio_images'])) {
        $files = $_FILES['portfolio_images'];
        if (is_array($files['error'])) {
            $count = count($files['error']);
            for ($i = 0; $i < $count; $i++) {
                $err = $files['error'][$i];
                if ($err !== UPLOAD_ERR_OK && $err !== UPLOAD_ERR_NO_FILE) {
                    jsonResponse(400, [
                        'message' => 'Upload error on file "' . ($files['name'][$i] ?? 'image') . '": ' . getPhpUploadErrorMessage($err)
                    ]);
                }
            }
        }
    }

    // Validate upload error for legacy portfolio_image
    if (isset($_FILES['portfolio_image'])) {
        $err = $_FILES['portfolio_image']['error'];
        if ($err !== UPLOAD_ERR_OK && $err !== UPLOAD_ERR_NO_FILE) {
            jsonResponse(400, [
                'message' => 'Upload error on file: ' . getPhpUploadErrorMessage($err)
            ]);
        }
    }

    // Handle portfolio images
    $imagesArray = [];
    if (isset($_FILES['portfolio_images'])) {
        $files = $_FILES['portfolio_images'];
        if (is_array($files['tmp_name'])) {
            $count = count($files['tmp_name']);
            for ($i = 0; $i < $count; $i++) {
                if (is_uploaded_file($files['tmp_name'][$i])) {
                    try {
                        $uploadedUrl = uploadToCloudinary($files['tmp_name'][$i], $files['name'][$i], 'Home/Services');
                        $imagesArray[] = $uploadedUrl;
                    } catch (Throwable $e) {
                        jsonResponse(500, ['message' => 'Unable to upload portfolio image.', 'details' => $e->getMessage()]);
                    }
                }
            }
        } else if (is_uploaded_file($files['tmp_name'])) {
            try {
                $uploadedUrl = uploadToCloudinary($files['tmp_name'], $files['name'], 'Home/Services');
                $imagesArray[] = $uploadedUrl;
            } catch (Throwable $e) {
                jsonResponse(500, ['message' => 'Unable to upload portfolio image.', 'details' => $e->getMessage()]);
            }
        }
    }

    if (isset($_FILES['portfolio_image']) && is_uploaded_file($_FILES['portfolio_image']['tmp_name'])) {
        try {
            $uploadedUrl = uploadToCloudinary($_FILES['portfolio_image']['tmp_name'], $_FILES['portfolio_image']['name'], 'Home/Services');
            $imagesArray[] = $uploadedUrl;
        } catch (Throwable $e) {
            jsonResponse(500, ['message' => 'Unable to upload portfolio image.', 'details' => $e->getMessage()]);
        }
    }

    $statement = database()->prepare(
        'INSERT INTO service_listings (user_id, title, category, description, pricing_type, price, price_details, cities, images, created_at, updated_at)
         VALUES (:user_id, :title, :category, :description, :pricing_type, :price, :price_details, :cities, :images, NOW(), NOW())'
    );

    $statement->execute([
        'user_id' => $user['id'],
        'title' => $title,
        'category' => $category,
        'description' => $description,
        'pricing_type' => $pricingType,
        'price' => $price,
        'price_details' => $priceDetails === '' ? null : $priceDetails,
        'cities' => json_encode(array_values($citiesArray)),
        'images' => json_encode($imagesArray),
    ]);

    jsonResponse(201, ['message' => 'Service listing created successfully.']);
}

function updateServiceListing(int $id): void
{
    file_put_contents(__DIR__ . '/../../debug.log', "=== UPDATE REQUEST ===\n" . print_r($_FILES, true) . "\n" . print_r($_POST, true) . "\n", FILE_APPEND);
    $user = currentUserOrFail();
    
    // Check if listing exists and belongs to the user (unless they are admin)
    $existingStatement = database()->prepare('SELECT * FROM service_listings WHERE id = :id LIMIT 1');
    $existingStatement->execute(['id' => $id]);
    $listing = $existingStatement->fetch();

    if (!is_array($listing)) {
        jsonResponse(404, ['message' => 'Service listing not found.']);
    }

    if ((int) $listing['user_id'] !== (int) $user['id'] && $user['role'] !== 'admin') {
        jsonResponse(403, ['message' => 'You do not have permission to modify this listing.']);
    }

    $rawData = readJson();
    $data = $rawData;
    if (empty($data) && !empty($_POST)) {
        $data = $_POST;
    }

    $title = trim((string) ($data['title'] ?? ''));
    $category = trim((string) ($data['category'] ?? ''));
    $description = trim((string) ($data['description'] ?? ''));
    $pricingType = trim((string) ($data['pricing_type'] ?? ''));
    $price = (float) ($data['price'] ?? 0.0);
    $priceDetails = trim((string) ($data['price_details'] ?? ''));

    if ($title === '' || $category === '' || $description === '' || $pricingType === '') {
        jsonResponse(422, ['message' => 'Title, category, description, and pricing type are required.']);
    }

    $allowedPricingTypes = ['sqft', 'daily_labor', 'per_point', 'linear_ft'];
    if (!in_array($pricingType, $allowedPricingTypes, true)) {
        jsonResponse(422, ['message' => 'Invalid pricing type selected.']);
    }

    if ($price <= 0) {
        jsonResponse(422, ['message' => 'Price must be a positive number.']);
    }

    // Handle cities (districts)
    $cities = $data['cities'] ?? '';
    $citiesArray = [];
    if (is_string($cities) && trim($cities) !== '') {
        $decoded = json_decode($cities, true);
        if (is_array($decoded)) {
            $citiesArray = $decoded;
        } else {
            $citiesArray = array_filter(array_map('trim', explode(',', $cities)));
        }
    } else if (is_array($cities)) {
        $citiesArray = $cities;
    }

    if (empty($citiesArray)) {
        jsonResponse(422, ['message' => 'At least one serving district must be selected.']);
    }

    // Handle portfolio images
    $existingImages = json_decode((string) ($listing['images'] ?? '[]'), true);
    if (!is_array($existingImages)) {
        $existingImages = [];
    }

    // If images are sent in data (e.g. to preserve them or remove them), we can process
    if (isset($data['images'])) {
        $clientImages = $data['images'];
        if (is_string($clientImages)) {
            $decoded = json_decode($clientImages, true);
            if (is_array($decoded)) {
                $existingImages = $decoded;
            }
        } else if (is_array($clientImages)) {
            $existingImages = $clientImages;
        }
    }

    // Validate upload errors for portfolio_images
    if (isset($_FILES['portfolio_images'])) {
        $files = $_FILES['portfolio_images'];
        if (is_array($files['error'])) {
            $count = count($files['error']);
            for ($i = 0; $i < $count; $i++) {
                $err = $files['error'][$i];
                if ($err !== UPLOAD_ERR_OK && $err !== UPLOAD_ERR_NO_FILE) {
                    jsonResponse(400, [
                        'message' => 'Upload error on file "' . ($files['name'][$i] ?? 'image') . '": ' . getPhpUploadErrorMessage($err)
                    ]);
                }
            }
        }
    }

    // Validate upload error for legacy portfolio_image
    if (isset($_FILES['portfolio_image'])) {
        $err = $_FILES['portfolio_image']['error'];
        if ($err !== UPLOAD_ERR_OK && $err !== UPLOAD_ERR_NO_FILE) {
            jsonResponse(400, [
                'message' => 'Upload error on file: ' . getPhpUploadErrorMessage($err)
            ]);
        }
    }

    if (isset($_FILES['portfolio_images'])) {
        $files = $_FILES['portfolio_images'];
        if (is_array($files['tmp_name'])) {
            $count = count($files['tmp_name']);
            for ($i = 0; $i < $count; $i++) {
                if (is_uploaded_file($files['tmp_name'][$i])) {
                    try {
                        $uploadedUrl = uploadToCloudinary($files['tmp_name'][$i], $files['name'][$i], 'Home/Services');
                        $existingImages[] = $uploadedUrl;
                    } catch (Throwable $e) {
                        jsonResponse(500, ['message' => 'Unable to upload portfolio image.', 'details' => $e->getMessage()]);
                    }
                }
            }
        } else if (is_uploaded_file($files['tmp_name'])) {
            try {
                $uploadedUrl = uploadToCloudinary($files['tmp_name'], $files['name'], 'Home/Services');
                $existingImages[] = $uploadedUrl;
            } catch (Throwable $e) {
                jsonResponse(500, ['message' => 'Unable to upload portfolio image.', 'details' => $e->getMessage()]);
            }
        }
    }

    if (isset($_FILES['portfolio_image']) && is_uploaded_file($_FILES['portfolio_image']['tmp_name'])) {
        try {
            $uploadedUrl = uploadToCloudinary($_FILES['portfolio_image']['tmp_name'], $_FILES['portfolio_image']['name'], 'Home/Services');
            // Replace the previous image or add to array. Let's make it a single image for simplicity or append.
            // Let's replace/set as the primary image or append it.
            $existingImages[] = $uploadedUrl;
        } catch (Throwable $e) {
            jsonResponse(500, ['message' => 'Unable to upload portfolio image.', 'details' => $e->getMessage()]);
        }
    }

    $statement = database()->prepare(
        'UPDATE service_listings
         SET title = :title, category = :category, description = :description, pricing_type = :pricing_type,
             price = :price, price_details = :price_details, cities = :cities, images = :images, updated_at = NOW()
         WHERE id = :id'
    );

    $statement->execute([
        'title' => $title,
        'category' => $category,
        'description' => $description,
        'pricing_type' => $pricingType,
        'price' => $price,
        'price_details' => $priceDetails === '' ? null : $priceDetails,
        'cities' => json_encode(array_values($citiesArray)),
        'images' => json_encode($existingImages),
        'id' => $id,
    ]);

    jsonResponse(200, ['message' => 'Service listing updated successfully.']);
}

function deleteServiceListing(int $id): void
{
    $user = currentUserOrFail();

    $existingStatement = database()->prepare('SELECT * FROM service_listings WHERE id = :id LIMIT 1');
    $existingStatement->execute(['id' => $id]);
    $listing = $existingStatement->fetch();

    if (!is_array($listing)) {
        jsonResponse(404, ['message' => 'Service listing not found.']);
    }

    if ((int) $listing['user_id'] !== (int) $user['id'] && $user['role'] !== 'admin') {
        jsonResponse(403, ['message' => 'You do not have permission to delete this listing.']);
    }

    $statement = database()->prepare('DELETE FROM service_listings WHERE id = :id');
    $statement->execute(['id' => $id]);

    jsonResponse(200, ['message' => 'Service listing deleted successfully.']);
}

function getServiceListing(int $id): void
{
    $query = 'SELECT s.*, a.business_name, a.business_email, a.business_phone, a.business_address, a.business_city, u.name AS provider_name
              FROM service_listings s
              INNER JOIN users u ON u.id = s.user_id
              LEFT JOIN pro_applications a ON a.user_id = s.user_id
              WHERE s.id = :id';

    $statement = database()->prepare($query);
    $statement->execute(['id' => $id]);
    $listing = $statement->fetch();

    if ($listing === false) {
        jsonResponse(404, ['message' => 'Service listing not found.']);
    }

    $listing['id'] = (int) $listing['id'];
    $listing['user_id'] = (int) $listing['user_id'];
    $listing['price'] = (float) $listing['price'];
    $listing['cities'] = json_decode((string) ($listing['cities'] ?? '[]'), true);
    $listing['images'] = json_decode((string) ($listing['images'] ?? '[]'), true);

    jsonResponse(200, ['listing' => $listing]);
}

