<?php

declare(strict_types=1);

require_once __DIR__ . '/../Seller/SellerContracts.php';
require_once __DIR__ . '/../Seller/SellerModels.php';
require_once __DIR__ . '/../Seller/SellerServices.php';

use Nestora\Seller\SellerController;

function getSellerController(): SellerController
{
    static $controller = null;
    if ($controller === null) {
        $controller = new SellerController();
    }
    return $controller;
}

function processUploadedProductImages(): array
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
                        $uploadedUrl = uploadToCloudinary($files['tmp_name'][$i], $files['name'][$i], 'Home/Products');
                        $imagesArray[] = $uploadedUrl;
                    } catch (Throwable $e) {
                        jsonResponse(500, ['message' => 'Unable to upload image.', 'details' => $e->getMessage()]);
                    }
                }
            }
        } elseif (is_uploaded_file($files['tmp_name'])) {
            try {
                $uploadedUrl = uploadToCloudinary($files['tmp_name'], $files['name'], 'Home/Products');
                $imagesArray[] = $uploadedUrl;
            } catch (Throwable $e) {
                jsonResponse(500, ['message' => 'Unable to upload image.', 'details' => $e->getMessage()]);
            }
        }
    }

    return $imagesArray;
}

function listProductListings(): void
{
    getSellerController()->handleListProducts($_GET);
}

function createProductListing(): void
{
    $data = readJson();
    if (empty($data) && !empty($_POST)) {
        $data = $_POST;
    }

    $uploadedImages = processUploadedProductImages();
    getSellerController()->handleCreateProduct($data, $uploadedImages);
}

function updateProductListing(int $id): void
{
    $data = readJson();
    if (empty($data) && !empty($_POST)) {
        $data = $_POST;
    }

    $newUploadedImages = processUploadedProductImages();
    getSellerController()->handleUpdateProduct($id, $data, [], $newUploadedImages);
}

function deleteProductListing(int $id): void
{
    getSellerController()->handleDeleteProduct($id);
}

function getProductListing(int $id): void
{
    getSellerController()->handleGetProduct($id);
}
