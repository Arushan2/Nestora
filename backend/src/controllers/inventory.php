<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

/**
 * GET /api/inventory/:product_id/batches
 */
function getInventoryBatches(int $productId): void
{
    $user = currentUserOrFail();
    $db = database();

    // Check ownership of the product
    $stmt = $db->prepare('SELECT user_id, has_expiry_date FROM product_listings WHERE id = :id');
    $stmt->execute(['id' => $productId]);
    $product = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$product) {
        jsonResponse(404, ['message' => 'Product listing not found.']);
    }

    if ((int) $product['user_id'] !== (int) $user['id'] && $user['role'] !== 'admin') {
        jsonResponse(403, ['message' => 'You do not have permission to manage this product\'s inventory.']);
    }

    try {
        $manager = new \Nestora\Inventory\InventoryManager($db);
        $batches = $manager->getBatches($productId);

        $result = [];
        foreach ($batches as $batch) {
            $result[] = $batch->toArray();
        }

        jsonResponse(200, [
            'has_expiry_date' => (bool) $product['has_expiry_date'],
            'batches' => $result
        ]);
    } catch (Throwable $e) {
        jsonResponse(500, ['message' => 'Failed to retrieve stock batches.', 'details' => $e->getMessage()]);
    }
}

/**
 * POST /api/inventory/:product_id/batches
 */
function addInventoryBatch(int $productId): void
{
    $user = currentUserOrFail();
    $db = database();

    // Check ownership
    $stmt = $db->prepare('SELECT user_id, has_expiry_date FROM product_listings WHERE id = :id');
    $stmt->execute(['id' => $productId]);
    $product = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$product) {
        jsonResponse(404, ['message' => 'Product listing not found.']);
    }

    if ((int) $product['user_id'] !== (int) $user['id'] && $user['role'] !== 'admin') {
        jsonResponse(403, ['message' => 'You do not have permission to add stock to this product.']);
    }

    $data = readJson();
    $quantity = isset($data['quantity']) ? (int) $data['quantity'] : 0;
    
    // Check if the product has expiry dates enabled. If yes, read the expiry date from request.
    $expiryDate = null;
    if ((int) $product['has_expiry_date'] === 1) {
        $expiryDate = isset($data['expiry_date']) && trim((string)$data['expiry_date']) !== '' ? trim((string)$data['expiry_date']) : null;
    }

    if ($quantity <= 0) {
        jsonResponse(422, ['message' => 'Stock quantity must be a positive integer.']);
    }

    try {
        $manager = new \Nestora\Inventory\InventoryManager($db);
        $batch = $manager->addStockBatch($productId, $quantity, $expiryDate);

        jsonResponse(201, [
            'message' => 'Stock batch added successfully.',
            'batch' => $batch->toArray()
        ]);
    } catch (Throwable $e) {
        jsonResponse(500, ['message' => 'Failed to add stock batch.', 'details' => $e->getMessage()]);
    }
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
    
    // Read optional discounts
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
