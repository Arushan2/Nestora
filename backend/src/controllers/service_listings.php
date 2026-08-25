<?php

declare(strict_types=1);

require_once __DIR__ . '/../Provider/ProviderContracts.php';
require_once __DIR__ . '/../Provider/ProviderModels.php';
require_once __DIR__ . '/../Provider/ProviderServices.php';

use Nestora\Provider\ProviderController;

function getProviderController(): ProviderController
{
    static $controller = null;
    if ($controller === null) {
        $controller = new ProviderController();
    }
    return $controller;
}

function processUploadedServiceImages(): array
{
    $imagesArray = [];

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

        if (is_array($files['tmp_name'])) {
            $count = count($files['tmp_name']);
            for ($i = 0; $i < $count; $i++) {
                if (is_uploaded_file($files['tmp_name'][$i])) {
                    try {
                        $uploadedUrl = uploadToCloudinary($files['tmp_name'][$i], $files['name'][$i], 'Home/Services');
                        $imagesArray[] = $uploadedUrl;
                    } catch (Throwable $e) {
                        jsonResponse(500, ['message' => 'Unable to upload image.', 'details' => $e->getMessage()]);
                    }
                }
            }
        } elseif (is_uploaded_file($files['tmp_name'])) {
            try {
                $uploadedUrl = uploadToCloudinary($files['tmp_name'], $files['name'], 'Home/Services');
                $imagesArray[] = $uploadedUrl;
            } catch (Throwable $e) {
                jsonResponse(500, ['message' => 'Unable to upload image.', 'details' => $e->getMessage()]);
            }
        }
    }

    return $imagesArray;
}

function listServiceListings(): void
{
    getProviderController()->handleListServices($_GET);
}

function getServiceListing(int $id): void
{
    getProviderController()->handleGetService($id);
}

function createServiceListing(): void
{
    $data = readJson();
    if (empty($data) && !empty($_POST)) {
        $data = $_POST;
    }

    $uploadedImages = processUploadedServiceImages();
    getProviderController()->handleCreateService($data, $uploadedImages);
}

function updateServiceListing(int $id): void
{
    $data = readJson();
    if (empty($data) && !empty($_POST)) {
        $data = $_POST;
    }

    $newUploadedImages = processUploadedServiceImages();
    getProviderController()->handleUpdateService($id, $data, [], $newUploadedImages);
}

function deleteServiceListing(int $id): void
{
    getProviderController()->handleDeleteService($id);
}

function createServiceReview(int $serviceId): void
{
    $user = currentUserOrFail();
    $data = readJson();

    $rating = (int) ($data['rating'] ?? 0);
    $comment = trim((string) ($data['comment'] ?? ''));

    if ($rating < 1 || $rating > 5 || $comment === '') {
        jsonResponse(422, ['message' => 'Rating must be between 1 and 5, and comment is required.']);
    }

    $db = database();

    // Verify service listing exists
    $svcStmt = $db->prepare('SELECT id FROM service_listings WHERE id = :id LIMIT 1');
    $svcStmt->execute(['id' => $serviceId]);
    if ($svcStmt->fetch() === false) {
        jsonResponse(404, ['message' => 'Service listing not found.']);
    }

    // Verify customer has an inquiry for this service with an accepted or completed status
    $verifyStmt = $db->prepare('
        SELECT id FROM service_inquiries
        WHERE customer_id = :customer_id AND service_id = :service_id AND status IN ("accepted", "work_completed", "completed")
        LIMIT 1
    ');
    $verifyStmt->execute([
        'customer_id' => $user['id'],
        'service_id' => $serviceId
    ]);

    if ($verifyStmt->fetch() === false) {
        jsonResponse(403, ['message' => 'You can only review services you have inquired about and hired/completed.']);
    }

    // Check duplicate review
    $duplicateStmt = $db->prepare('
        SELECT 1 FROM service_reviews
        WHERE service_id = :service_id AND user_id = :user_id
        LIMIT 1
    ');
    $duplicateStmt->execute([
        'service_id' => $serviceId,
        'user_id' => $user['id']
    ]);

    if ($duplicateStmt->fetch() !== false) {
        jsonResponse(409, ['message' => 'You have already reviewed this service.']);
    }

    $stmt = $db->prepare('
        INSERT INTO service_reviews (service_id, user_id, rating, comment, created_at)
        VALUES (:service_id, :user_id, :rating, :comment, NOW())
    ');
    $stmt->execute([
        'service_id' => $serviceId,
        'user_id' => $user['id'],
        'rating' => $rating,
        'comment' => $comment
    ]);

    jsonResponse(201, ['message' => 'Service review submitted successfully.']);
}

function getServiceReviews(int $serviceId): void
{
    $db = database();

    $stmt = $db->prepare('
        SELECT r.*, u.name AS reviewer_name
        FROM service_reviews r
        INNER JOIN users u ON u.id = r.user_id
        WHERE r.service_id = :service_id
        ORDER BY r.created_at DESC
    ');
    $stmt->execute(['service_id' => $serviceId]);
    $reviews = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $totalReviews = count($reviews);
    $ratingSum = 0;
    $ratingCounts = [5 => 0, 4 => 0, 3 => 0, 2 => 0, 1 => 0];

    foreach ($reviews as &$review) {
        $review['id'] = (int) $review['id'];
        $review['service_id'] = (int) $review['service_id'];
        $review['user_id'] = (int) $review['user_id'];
        $review['rating'] = (int) $review['rating'];

        $ratingSum += $review['rating'];
        if (isset($ratingCounts[$review['rating']])) {
            $ratingCounts[$review['rating']]++;
        }
    }

    $avgRating = $totalReviews > 0 ? round($ratingSum / $totalReviews, 1) : 0.0;

    jsonResponse(200, [
        'reviews' => $reviews,
        'summary' => [
            'total_reviews' => $totalReviews,
            'avg_rating' => $avgRating,
            'rating_counts' => $ratingCounts
        ]
    ]);
}

