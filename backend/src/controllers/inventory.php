<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../Seller/SellerContracts.php';
require_once __DIR__ . '/../Seller/SellerModels.php';
require_once __DIR__ . '/../Seller/SellerServices.php';

use Nestora\Seller\SellerController;

function getInventorySellerController(): SellerController
{
    static $controller = null;
    if ($controller === null) {
        $controller = new SellerController();
    }
    return $controller;
}

/**
 * GET /api/inventory/:product_id/batches
 */
function getInventoryBatches(int $productId): void
{
    getInventorySellerController()->handleGetBatches($productId);
}

/**
 * POST /api/inventory/:product_id/batches
 */
function addInventoryBatch(int $productId): void
{
    getInventorySellerController()->handleAddBatch($productId, readJson());
}

/**
 * POST /api/inventory/batches/:batch_id/update
 */
function updateInventoryBatch(int $batchId): void
{
    $user = currentUserOrFail();
    $db = database();

    // Find the batch and verify product ownership
    $stmtBatch = $db->prepare('
        SELECT b.*, p.user_id 
        FROM product_stock_batches b 
        INNER JOIN product_listings p ON p.id = b.product_id 
        WHERE b.id = :id
    ');
    $stmtBatch->execute(['id' => $batchId]);
    $batchData = $stmtBatch->fetch(PDO::FETCH_ASSOC);

    if (!$batchData) {
        jsonResponse(404, ['message' => 'Stock batch not found.']);
    }

    if ((int) $batchData['user_id'] !== (int) $user['id'] && $user['role'] !== 'admin') {
        jsonResponse(403, ['message' => 'You do not have permission to edit this stock batch.']);
    }

    $data = readJson();
    $newQuantity = isset($data['stock_units']) ? (int) $data['stock_units'] : (int) $batchData['stock_units'];
    $discountPercentage = isset($data['discount_percentage']) && $data['discount_percentage'] !== '' ? (float) $data['discount_percentage'] : null;
    $discountPrice = isset($data['discount_price']) && $data['discount_price'] !== '' ? (float) $data['discount_price'] : null;

    if ($newQuantity < 0) {
        jsonResponse(422, ['message' => 'Quantity cannot be negative.']);
    }

    try {
        $manager = new \Nestora\Inventory\InventoryManager($db);
        $manager->updateStockBatch($batchId, $newQuantity, $discountPercentage, $discountPrice);

        jsonResponse(200, ['message' => 'Stock batch updated successfully.']);
    } catch (Throwable $e) {
        jsonResponse(500, ['message' => 'Failed to update stock batch.', 'details' => $e->getMessage()]);
    }
}
