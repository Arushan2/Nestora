<?php

declare(strict_types=1);

function getProfile(int $userId): void
{
    $statement = database()->prepare('
        SELECT u.id, u.name, u.email, u.role, u.created_at,
               a.business_name, a.business_email, a.business_phone, a.business_address, a.business_city, a.business_description, a.logo_url, a.banner_url
        FROM users u
        LEFT JOIN pro_applications a ON a.user_id = u.id AND a.status = "approved"
        WHERE u.id = :id
    ');
    $statement->execute(['id' => $userId]);
    $profile = $statement->fetch();

    if ($profile === false) {
        jsonResponse(404, ['message' => 'Profile not found.']);
    }

    $currentUser = currentUser();
    $isOwner = $currentUser && (int) $currentUser['id'] === (int) $userId;

    if ($profile['role'] !== 'service_provider' && $profile['role'] !== 'product_seller' && !$isOwner) {
        jsonResponse(404, ['message' => 'Profile not found.']);
    }

    // Conceal contacts unless authorized
    $revealContacts = false;
    if ($isOwner) {
        $revealContacts = true;
    } else if ($currentUser) {
        if ($currentUser['role'] === 'admin') {
            $revealContacts = true;
        } else {
            // Check if there is an accepted, work_completed or completed inquiry between this current user and this profile user
            $inqCheck = database()->prepare(
                'SELECT COUNT(*) FROM service_inquiries 
                 WHERE ((customer_id = :current_user_id AND provider_id = :profile_user_id) 
                    OR (customer_id = :profile_user_id AND provider_id = :current_user_id))
                   AND status IN ("accepted", "work_completed", "completed")'
            );
            $inqCheck->execute([
                'current_user_id' => $currentUser['id'],
                'profile_user_id' => $userId
            ]);
            if ((int) $inqCheck->fetchColumn() > 0) {
                $revealContacts = true;
            }
        }
    }

    if (!$revealContacts) {
        $profile['email'] = '••••••••@••••.•••';
        if ($profile['role'] !== 'user') {
            $profile['business_email'] = '••••••••@••••.•••';
            $profile['business_phone'] = '••••••••••';
            $profile['business_address'] = '••••••••••••••••••••';
        }
    }

    $profile['id'] = (int) $profile['id'];

    jsonResponse(200, ['profile' => $profile]);
}

function updateProfile(): void
{
    $user = currentUserOrFail();
    if ($user['role'] !== 'service_provider' && $user['role'] !== 'product_seller' && $user['role'] !== 'admin') {
        jsonResponse(403, ['message' => 'Only service providers and product sellers can update their business profile.']);
    }

    $data = readJson();
    if (empty($data) && !empty($_POST)) {
        $data = $_POST;
    }

    $businessName = trim((string) ($data['business_name'] ?? ''));
    $businessEmail = normalizeEmail((string) ($data['business_email'] ?? ''));
    $businessPhone = trim((string) ($data['business_phone'] ?? ''));
    $businessAddress = trim((string) ($data['business_address'] ?? ''));
    $businessCity = trim((string) ($data['business_city'] ?? ''));
    $businessDescription = trim((string) ($data['business_description'] ?? ''));

    if ($businessName === '' || $businessEmail === '' || $businessPhone === '' || $businessAddress === '' || $businessCity === '' || $businessDescription === '') {
        jsonResponse(422, ['message' => 'All business details are required.']);
    }

    // Get current record to preserve logo/banner URLs if no new files are uploaded
    $existing = applicationByUserId((int) $user['id']);
    $logoUrl = $existing['logo_url'] ?? null;
    $bannerUrl = $existing['banner_url'] ?? null;

    // Handle logo upload
    if (isset($_FILES['logo_file']) && is_uploaded_file($_FILES['logo_file']['tmp_name'])) {
        try {
            $logoUrl = uploadToCloudinary($_FILES['logo_file']['tmp_name'], $_FILES['logo_file']['name'], 'Home/Profiles');
        } catch (Throwable $e) {
            jsonResponse(500, ['message' => 'Unable to upload logo.', 'details' => $e->getMessage()]);
        }
    }

    // Handle banner upload
    if (isset($_FILES['banner_file']) && is_uploaded_file($_FILES['banner_file']['tmp_name'])) {
        try {
            $bannerUrl = uploadToCloudinary($_FILES['banner_file']['tmp_name'], $_FILES['banner_file']['name'], 'Home/Profiles');
        } catch (Throwable $e) {
            jsonResponse(500, ['message' => 'Unable to upload banner.', 'details' => $e->getMessage()]);
        }
    }

    // Update pro_applications table for this user
    $statement = database()->prepare('
        UPDATE pro_applications
        SET business_name = :business_name,
            business_email = :business_email,
            business_phone = :business_phone,
            business_address = :business_address,
            business_city = :business_city,
            business_description = :business_description,
            logo_url = :logo_url,
            banner_url = :banner_url,
            updated_at = NOW()
        WHERE user_id = :user_id
    ');

    $statement->execute([
        'business_name' => $businessName,
        'business_email' => $businessEmail,
        'business_phone' => $businessPhone,
        'business_address' => $businessAddress,
        'business_city' => $businessCity,
        'business_description' => $businessDescription,
        'logo_url' => $logoUrl,
        'banner_url' => $bannerUrl,
        'user_id' => $user['id']
    ]);

    jsonResponse(200, ['message' => 'Profile updated successfully.']);
}

function listProfiles(): void
{
    $role = trim($_GET['role'] ?? '');
    $q = trim($_GET['q'] ?? '');
    $city = trim($_GET['city'] ?? '');
    $category = trim($_GET['category'] ?? '');

    if ($role !== 'service_provider' && $role !== 'product_seller') {
        jsonResponse(422, ['message' => 'Valid role is required (service_provider or product_seller).']);
    }

    $query = 'SELECT a.user_id AS id, a.user_id, a.business_name, a.business_email, a.business_phone, a.business_address, a.business_city, a.business_description, a.logo_url, a.banner_url, u.role, u.name as user_name
              FROM pro_applications a
              INNER JOIN users u ON u.id = a.user_id
              WHERE a.status = "approved" AND a.application_type = :role';

    $conditions = [];
    $params = ['role' => $role];

    if ($q !== '') {
        $conditions[] = '(a.business_name LIKE :q OR a.business_description LIKE :q OR a.business_city LIKE :q_city)';
        $params['q'] = '%' . $q . '%';
        $params['q_city'] = '%' . $q . '%';
    }

    if ($city !== '') {
        $conditions[] = 'a.business_city = :city';
        $params['city'] = $city;
    }

    if ($category !== '') {
        if ($role === 'service_provider') {
            $conditions[] = 'EXISTS (SELECT 1 FROM service_listings s WHERE s.user_id = a.user_id AND s.category = :category)';
        } else {
            $conditions[] = 'EXISTS (SELECT 1 FROM product_listings p WHERE p.user_id = a.user_id AND p.category = :category)';
        }
        $params['category'] = $category;
    }

    if ($conditions !== []) {
        $query .= ' AND ' . implode(' AND ', $conditions);
    }

    $query .= ' ORDER BY a.business_name ASC';

    $statement = database()->prepare($query);
    $statement->execute($params);
    $profiles = $statement->fetchAll();

    foreach ($profiles as &$profile) {
        $profile['id'] = (int) $profile['id'];
        $profile['user_id'] = (int) $profile['user_id'];
    }

    jsonResponse(200, ['profiles' => $profiles]);
}
