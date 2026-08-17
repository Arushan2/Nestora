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
