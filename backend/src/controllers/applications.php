<?php

declare(strict_types=1);

function createProApplication(): void
{
    $user = currentUserOrFail();
    $rawData = readJson();
    // When the client submits FormData (multipart/form-data), PHP populates $_POST instead of php://input JSON
    $data = $rawData;
    if (empty($data) && !empty($_POST)) {
        $data = $_POST;
    }

    $applicationType = (string) ($data['applicationType'] ?? '');
    $allowedTypes = ['service_provider', 'product_seller'];

    if (!in_array($applicationType, $allowedTypes, true)) {
        jsonResponse(422, ['message' => 'Select a valid application type.']);
    }

    $businessName = trim((string) ($data['businessName'] ?? ''));
    $businessEmail = normalizeEmail((string) ($data['businessEmail'] ?? ''));
    $businessPhone = trim((string) ($data['businessPhone'] ?? ''));
    $businessAddress = trim((string) ($data['businessAddress'] ?? ''));
    $businessCity = trim((string) ($data['businessCity'] ?? ''));
    $businessDescription = trim((string) ($data['businessDescription'] ?? ''));
    $documentType = trim((string) ($data['documentType'] ?? ''));
    $documentNumber = trim((string) ($data['documentNumber'] ?? ''));
    $documentFile = trim((string) ($data['documentFile'] ?? ''));

    // If a file was uploaded from the form input `business_registration_document`, upload to Cloudinary
    if (isset($_FILES['business_registration_document']) && is_uploaded_file($_FILES['business_registration_document']['tmp_name'])) {
        try {
            $uploadedUrl = uploadToCloudinary($_FILES['business_registration_document']['tmp_name'], $_FILES['business_registration_document']['name']);
            $documentFile = $uploadedUrl;
        } catch (Throwable $e) {
            jsonResponse(500, ['message' => 'Unable to upload document.', 'details' => $e->getMessage()]);
        }
    }

    // Require business details and a registration document (either uploaded file or provided link)
    if ($businessName === '' || $businessEmail === '' || $businessPhone === '' || $businessAddress === '' || $businessCity === '' || $businessDescription === '' || $documentFile === '') {
        jsonResponse(422, ['message' => 'Business details and a registration document are required.']);
    }

    $statement = database()->prepare(
        'INSERT INTO pro_applications (
            user_id,
            application_type,
            business_name,
            business_email,
            business_phone,
            business_address,
            business_city,
            business_description,
            document_type,
            document_number,
            document_file,
            status,
            created_at,
            updated_at
        ) VALUES (
            :user_id,
            :application_type,
            :business_name,
            :business_email,
            :business_phone,
            :business_address,
            :business_city,
            :business_description,
            :document_type,
            :document_number,
            :document_file,
            :status,
            NOW(),
            NOW()
        ) ON DUPLICATE KEY UPDATE
            application_type = VALUES(application_type),
            business_name = VALUES(business_name),
            business_email = VALUES(business_email),
            business_phone = VALUES(business_phone),
            business_address = VALUES(business_address),
            business_city = VALUES(business_city),
            business_description = VALUES(business_description),
            document_type = VALUES(document_type),
            document_number = VALUES(document_number),
            document_file = VALUES(document_file),
            status = VALUES(status),
            review_note = NULL,
            reviewed_at = NULL,
            updated_at = NOW()'
    );

    $statement->execute([
        'user_id' => $user['id'],
        'application_type' => $applicationType,
        'business_name' => $businessName,
        'business_email' => $businessEmail,
        'business_phone' => $businessPhone,
        'business_address' => $businessAddress,
        'business_city' => $businessCity,
        'business_description' => $businessDescription,
        'document_type' => $documentType,
        'document_number' => $documentNumber,
        'document_file' => $documentFile,
        'status' => 'pending',
    ]);

    jsonResponse(201, [
        'message' => 'Application submitted successfully.',
        'application' => applicationSummary(applicationByUserId((int) $user['id'])),
    ]);
}

function listPendingApplications(): void
{
    adminOnly();

    $statement = database()->query(
        'SELECT a.*, u.name AS user_name, u.email AS user_email, u.role AS user_role
         FROM pro_applications a
         INNER JOIN users u ON u.id = a.user_id
         WHERE a.status = "pending"
         ORDER BY a.created_at DESC'
    );

    jsonResponse(200, [
        'applications' => $statement->fetchAll(),
    ]);
}

function approveApplication(int $applicationId): void
{
    adminOnly();

    $applicationStatement = database()->prepare('SELECT * FROM pro_applications WHERE id = :id LIMIT 1');
    $applicationStatement->execute(['id' => $applicationId]);
    $application = $applicationStatement->fetch();

    if (!is_array($application)) {
        jsonResponse(404, ['message' => 'Application not found.']);
    }

    if (($application['status'] ?? '') !== 'pending') {
        jsonResponse(409, ['message' => 'Application has already been reviewed.']);
    }

    $userId = (int) $application['user_id'];
    $newRole = (string) $application['application_type'];

    $updateApplication = database()->prepare(
        'UPDATE pro_applications
         SET status = :status, reviewed_at = NOW(), updated_at = NOW()
         WHERE id = :id'
    );
    $updateApplication->execute([
        'status' => 'approved',
        'id' => $applicationId,
    ]);

    $updateUser = database()->prepare('UPDATE users SET role = :role WHERE id = :id');
    $updateUser->execute([
        'role' => $newRole,
        'id' => $userId,
    ]);

    jsonResponse(200, [
        'message' => 'Application approved successfully.',
        'application' => applicationSummary(applicationByUserId($userId)),
        'user' => userById($userId),
    ]);
}
