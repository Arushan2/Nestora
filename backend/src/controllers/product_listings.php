<?php

declare(strict_types=1);

function listProductListings(): void
{
    $myListings = ($_GET['my_listings'] ?? '') === 'true';
    $category = trim($_GET['category'] ?? '');
    $district = trim($_GET['district'] ?? '');
    $userId = (int) ($_GET['user_id'] ?? 0);
    $q = trim($_GET['q'] ?? '');

    $query = 'SELECT p.*, a.business_name, a.business_email, a.business_phone, a.business_address, a.business_city, u.name AS seller_name
              FROM product_listings p
              INNER JOIN users u ON u.id = p.user_id
              LEFT JOIN pro_applications a ON a.user_id = p.user_id';

    $conditions = [];
    $params = [];

    if ($myListings) {
        $user = currentUserOrFail();
        $conditions[] = 'p.user_id = :user_id';
        $params['user_id'] = $user['id'];
    } elseif ($userId > 0) {
        $conditions[] = 'p.user_id = :user_id';
        $params['user_id'] = $userId;
        // Hide listings from banned sellers on public profile views
        $conditions[] = '(u.banned_until IS NULL OR u.banned_until <= NOW())';
    } else {
        // Public marketplace: hide listings from banned sellers
        $conditions[] = '(u.banned_until IS NULL OR u.banned_until <= NOW())';
    }

    if ($category !== '') {
        $conditions[] = 'p.category = :category';
        $params['category'] = $category;
    }

    if ($q !== '') {
        $conditions[] = '(p.title LIKE :q OR p.description LIKE :q OR p.brand LIKE :q_brand)';
        $params['q'] = '%' . $q . '%';
        $params['q_brand'] = '%' . $q . '%';
    }

    if ($conditions !== []) {
        $query .= ' WHERE ' . implode(' AND ', $conditions);
    }

    $query .= ' ORDER BY p.created_at DESC';

    $limit = (int)($_GET['limit'] ?? 0);
    if ($limit > 0) {
        $query .= ' LIMIT ' . $limit;
    }

    $statement = database()->prepare($query);
    $statement->execute($params);
    $listings = $statement->fetchAll();

    if ($district !== '') {
        $listings = array_filter($listings, function ($listing) use ($district) {
            $districts = json_decode((string) ($listing['shipping_districts'] ?? '[]'), true);
            return is_array($districts) && in_array($district, $districts, true);
        });
        $listings = array_values($listings);
    }

    foreach ($listings as &$listing) {
        $listing['id'] = (int) $listing['id'];
        $listing['user_id'] = (int) $listing['user_id'];
        $listing['price'] = (float) $listing['price'];
        $listing['shipping_fee'] = (float) ($listing['shipping_fee'] ?? 0.0);
        $listing['stock_units'] = (int) ($listing['stock_units'] ?? 0);
        $listing['unloading_provided'] = (bool) $listing['unloading_provided'];
        $listing['shipping_districts'] = json_decode((string) ($listing['shipping_districts'] ?? '[]'), true);
        $listing['images'] = json_decode((string) ($listing['images'] ?? '[]'), true);
    }

    jsonResponse(200, ['listings' => $listings]);
}

function createProductListing(): void
{
    $user = currentUserOrFail();
    if ($user['role'] !== 'product_seller' && $user['role'] !== 'admin') {
        jsonResponse(403, ['message' => 'Only product sellers can list products.']);
    }

    $data = readJson();
    if (empty($data) && !empty($_POST)) {
        $data = $_POST;
    }

    $title = trim((string) ($data['title'] ?? ''));
    $category = trim((string) ($data['category'] ?? ''));
    $brand = trim((string) ($data['brand'] ?? ''));
    $description = trim((string) ($data['description'] ?? ''));
    $unitType = trim((string) ($data['unit_type'] ?? ''));
    $price = (float) ($data['price'] ?? 0.0);
    $shippingFee = (float) ($data['shipping_fee'] ?? 0.0);
    $stockUnits = (int) ($data['stock_units'] ?? 0);
    $deliveryTerms = trim((string) ($data['delivery_terms'] ?? ''));
    $unloadingProvided = filter_var($data['unloading_provided'] ?? false, FILTER_VALIDATE_BOOLEAN);

    if ($title === '' || $category === '' || $description === '' || $unitType === '') {
        jsonResponse(422, ['message' => 'Title, category, description, and unit type are required.']);
    }

    if ($price <= 0) {
        jsonResponse(422, ['message' => 'Price must be a positive number.']);
    }

    $districts = $data['shipping_districts'] ?? '';
    $districtsArray = [];
    if (is_string($districts) && trim($districts) !== '') {
        $decoded = json_decode($districts, true);
        if (is_array($decoded)) {
            $districtsArray = $decoded;
        } else {
            $districtsArray = array_filter(array_map('trim', explode(',', $districts)));
        }
    } else if (is_array($districts)) {
        $districtsArray = $districts;
    }

    if (empty($districtsArray)) {
        jsonResponse(422, ['message' => 'At least one shipping district must be selected.']);
    }

    if (isset($_FILES['portfolio_images'])) {
        $files = $_FILES['portfolio_images'];
        if (is_array($files['error'])) {
            $count = count($files['error']);
            for ($i = 0; $i < $count; $i++) {
                $err = $files['error'][$i];
                if ($err !== UPLOAD_ERR_OK && $err !== UPLOAD_ERR_NO_FILE) {
                    jsonResponse(400, ['message' => 'Upload error: ' . getPhpUploadErrorMessage($err)]);
                }
            }
        }
    }

    $imagesArray = [];
    if (isset($_FILES['portfolio_images'])) {
        $files = $_FILES['portfolio_images'];
        if (is_array($files['tmp_name'])) {
            $count = count($files['tmp_name']);
            for ($i = 0; $i < $count; $i++) {
                if (is_uploaded_file($files['tmp_name'][$i])) {
                    try {
                        $uploadedUrl = uploadToCloudinary($files['tmp_name'][$i], $files['name'][$i], 'Home/Products');
                        $imagesArray[] = $uploadedUrl;
                    } catch (Throwable $e) {
                        jsonResponse(500, ['message' => 'Unable to upload image.', 'details' => $e->getMessage()]);
                    }
                }
            }
        } else if (is_uploaded_file($files['tmp_name'])) {
            try {
                $uploadedUrl = uploadToCloudinary($files['tmp_name'], $files['name'], 'Home/Products');
                $imagesArray[] = $uploadedUrl;
            } catch (Throwable $e) {
                jsonResponse(500, ['message' => 'Unable to upload image.', 'details' => $e->getMessage()]);
            }
        }
    }

    $statement = database()->prepare(
        'INSERT INTO product_listings (user_id, title, category, brand, description, price, unit_type, shipping_districts, delivery_terms, unloading_provided, images, shipping_fee, stock_units, created_at, updated_at)
         VALUES (:user_id, :title, :category, :brand, :description, :price, :unit_type, :shipping_districts, :delivery_terms, :unloading_provided, :images, :shipping_fee, :stock_units, NOW(), NOW())'
    );

    $statement->execute([
        'user_id' => $user['id'],
        'title' => $title,
        'category' => $category,
        'brand' => $brand === '' ? null : $brand,
        'description' => $description,
        'price' => $price,
        'unit_type' => $unitType,
        'shipping_districts' => json_encode(array_values($districtsArray)),
        'delivery_terms' => $deliveryTerms === '' ? null : $deliveryTerms,
        'unloading_provided' => (int) $unloadingProvided,
        'images' => json_encode($imagesArray),
        'shipping_fee' => $shippingFee,
        'stock_units' => $stockUnits,
    ]);

    jsonResponse(201, ['message' => 'Product listing created successfully.']);
}

function updateProductListing(int $id): void
{
    $user = currentUserOrFail();
    
    $existingStatement = database()->prepare('SELECT * FROM product_listings WHERE id = :id LIMIT 1');
    $existingStatement->execute(['id' => $id]);
    $listing = $existingStatement->fetch();

    if (!is_array($listing)) {
        jsonResponse(404, ['message' => 'Product listing not found.']);
    }

    if ((int) $listing['user_id'] !== (int) $user['id'] && $user['role'] !== 'admin') {
        jsonResponse(403, ['message' => 'You do not have permission to modify this listing.']);
    }

    $data = readJson();
    if (empty($data) && !empty($_POST)) {
        $data = $_POST;
    }

    $title = trim((string) ($data['title'] ?? ''));
    $category = trim((string) ($data['category'] ?? ''));
    $brand = trim((string) ($data['brand'] ?? ''));
    $description = trim((string) ($data['description'] ?? ''));
    $unitType = trim((string) ($data['unit_type'] ?? ''));
    $price = (float) ($data['price'] ?? 0.0);
    $shippingFee = (float) ($data['shipping_fee'] ?? 0.0);
    $stockUnits = (int) ($data['stock_units'] ?? 0);
    $deliveryTerms = trim((string) ($data['delivery_terms'] ?? ''));
    $unloadingProvided = filter_var($data['unloading_provided'] ?? false, FILTER_VALIDATE_BOOLEAN);

    if ($title === '' || $category === '' || $description === '' || $unitType === '') {
        jsonResponse(422, ['message' => 'Title, category, description, and unit type are required.']);
    }

    if ($price <= 0) {
        jsonResponse(422, ['message' => 'Price must be a positive number.']);
    }

    $districts = $data['shipping_districts'] ?? '';
    $districtsArray = [];
    if (is_string($districts) && trim($districts) !== '') {
        $decoded = json_decode($districts, true);
        if (is_array($decoded)) {
            $districtsArray = $decoded;
        } else {
            $districtsArray = array_filter(array_map('trim', explode(',', $districts)));
        }
    } else if (is_array($districts)) {
        $districtsArray = $districts;
    }

    if (empty($districtsArray)) {
        jsonResponse(422, ['message' => 'At least one shipping district must be selected.']);
    }

    $existingImages = json_decode((string) ($listing['images'] ?? '[]'), true);
    if (!is_array($existingImages)) {
        $existingImages = [];
    }

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

    if (isset($_FILES['portfolio_images'])) {
        $files = $_FILES['portfolio_images'];
        if (is_array($files['error'])) {
            $count = count($files['error']);
            for ($i = 0; $i < $count; $i++) {
                $err = $files['error'][$i];
                if ($err !== UPLOAD_ERR_OK && $err !== UPLOAD_ERR_NO_FILE) {
                    jsonResponse(400, ['message' => 'Upload error: ' . getPhpUploadErrorMessage($err)]);
                }
            }
        }
    }

    if (isset($_FILES['portfolio_images'])) {
        $files = $_FILES['portfolio_images'];
        if (is_array($files['tmp_name'])) {
            $count = count($files['tmp_name']);
            for ($i = 0; $i < $count; $i++) {
                if (is_uploaded_file($files['tmp_name'][$i])) {
                    try {
                        $uploadedUrl = uploadToCloudinary($files['tmp_name'][$i], $files['name'][$i], 'Home/Products');
                        $existingImages[] = $uploadedUrl;
                    } catch (Throwable $e) {
                        jsonResponse(500, ['message' => 'Unable to upload image.', 'details' => $e->getMessage()]);
                    }
                }
            }
        } else if (is_uploaded_file($files['tmp_name'])) {
            try {
                $uploadedUrl = uploadToCloudinary($files['tmp_name'], $files['name'], 'Home/Products');
                $existingImages[] = $uploadedUrl;
            } catch (Throwable $e) {
                jsonResponse(500, ['message' => 'Unable to upload image.', 'details' => $e->getMessage()]);
            }
        }
    }

    $statement = database()->prepare(
        'UPDATE product_listings
         SET title = :title, category = :category, brand = :brand, description = :description, unit_type = :unit_type,
             price = :price, delivery_terms = :delivery_terms, unloading_provided = :unloading_provided, shipping_districts = :shipping_districts, images = :images,
             shipping_fee = :shipping_fee, stock_units = :stock_units, updated_at = NOW()
         WHERE id = :id'
    );

    $statement->execute([
        'title' => $title,
        'category' => $category,
        'brand' => $brand === '' ? null : $brand,
        'description' => $description,
        'unit_type' => $unitType,
        'price' => $price,
        'delivery_terms' => $deliveryTerms === '' ? null : $deliveryTerms,
        'unloading_provided' => (int) $unloadingProvided,
        'shipping_districts' => json_encode(array_values($districtsArray)),
        'images' => json_encode($existingImages),
        'shipping_fee' => $shippingFee,
        'stock_units' => $stockUnits,
        'id' => $id,
    ]);

    jsonResponse(200, ['message' => 'Product listing updated successfully.']);
}

function deleteProductListing(int $id): void
{
    $user = currentUserOrFail();

    $existingStatement = database()->prepare('SELECT * FROM product_listings WHERE id = :id LIMIT 1');
    $existingStatement->execute(['id' => $id]);
    $listing = $existingStatement->fetch();

    if (!is_array($listing)) {
        jsonResponse(404, ['message' => 'Product listing not found.']);
    }

    if ((int) $listing['user_id'] !== (int) $user['id'] && $user['role'] !== 'admin') {
        jsonResponse(403, ['message' => 'You do not have permission to delete this listing.']);
    }

    $statement = database()->prepare('DELETE FROM product_listings WHERE id = :id');
    $statement->execute(['id' => $id]);

    jsonResponse(200, ['message' => 'Product listing deleted successfully.']);
}

function getProductListing(int $id): void
{
    $query = 'SELECT p.*, a.business_name, a.business_email, a.business_phone, a.business_address, a.business_city, u.name AS seller_name
              FROM product_listings p
              INNER JOIN users u ON u.id = p.user_id
              LEFT JOIN pro_applications a ON a.user_id = p.user_id
              WHERE p.id = :id';

    $statement = database()->prepare($query);
    $statement->execute(['id' => $id]);
    $listing = $statement->fetch();

    if ($listing === false) {
        jsonResponse(404, ['message' => 'Product listing not found.']);
    }

    $listing['id'] = (int) $listing['id'];
    $listing['user_id'] = (int) $listing['user_id'];
    $listing['price'] = (float) $listing['price'];
    $listing['shipping_fee'] = (float) ($listing['shipping_fee'] ?? 0.0);
    $listing['stock_units'] = (int) ($listing['stock_units'] ?? 0);
    $listing['unloading_provided'] = (bool) $listing['unloading_provided'];
    $listing['shipping_districts'] = json_decode((string) ($listing['shipping_districts'] ?? '[]'), true);
    $listing['images'] = json_decode((string) ($listing['images'] ?? '[]'), true);

    jsonResponse(200, ['listing' => $listing]);
}
