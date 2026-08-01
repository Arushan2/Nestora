<?php

declare(strict_types=1);

namespace Nestora\Controllers;

use Nestora\Core\Base\AbstractController;
use Nestora\Core\Http\Request;
use Nestora\Core\Http\Response;

class InventoryController extends AbstractController
{
    public function getBatches(Request $request, int $productId): Response
    {
        $user = $this->currentUserOrFail($request);

        $product = $this->db->fetch('SELECT * FROM product_listings WHERE id = :id LIMIT 1', ['id' => $productId]);
        if (!$product) {
            return $this->error(404, 'Product not found.');
        }

        if ((int) $product['user_id'] !== (int) $user['id'] && $user['role'] !== 'admin') {
            return $this->error(403, 'Forbidden.');
        }

        $batches = $this->db->fetchAll('SELECT * FROM inventory_batches WHERE product_id = :pid ORDER BY created_at DESC', ['pid' => $productId]);
        return $this->json(200, ['batches' => $batches]);
    }

    public function addBatch(Request $request, int $productId): Response
    {
        $user = $this->currentUserOrFail($request);

        $product = $this->db->fetch('SELECT * FROM product_listings WHERE id = :id LIMIT 1', ['id' => $productId]);
        if (!$product) {
            return $this->error(404, 'Product not found.');
        }

        if ((int) $product['user_id'] !== (int) $user['id'] && $user['role'] !== 'admin') {
            return $this->error(403, 'Forbidden.');
        }

        $body = $request->getBody();
        $batchNumber = trim((string) ($body['batch_number'] ?? 'BATCH-' . time()));
        $unitsReceived = (int) ($body['units_received'] ?? 0);
        $costPerUnit = (float) ($body['cost_per_unit'] ?? 0);

        if ($unitsReceived <= 0) {
            return $this->error(422, 'Units received must be greater than zero.');
        }

        $this->db->query('
            INSERT INTO inventory_batches (product_id, batch_number, units_received, units_remaining, cost_per_unit, created_at)
            VALUES (:pid, :bnum, :urec, :urem, :cost, NOW())
        ', [
            'pid' => $productId,
            'bnum' => $batchNumber,
            'urec' => $unitsReceived,
            'urem' => $unitsReceived,
            'cost' => $costPerUnit,
        ]);

        $this->db->query('UPDATE product_listings SET stock = stock + :qty WHERE id = :id', [
            'qty' => $unitsReceived,
            'id' => $productId
        ]);

        return $this->json(201, ['message' => 'Batch added successfully.']);
    }
}
