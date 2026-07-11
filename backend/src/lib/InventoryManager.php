<?php

declare(strict_types=1);

namespace Nestora\Inventory;

use PDO;
use DateTime;
use RuntimeException;

class StockBatch
{
    private int $id;
    private int $productId;
    private int $stockUnits;
    private ?string $expiryDate;
    private ?float $discountPercentage;
    private ?float $discountPrice;
    private string $createdAt;
    private string $updatedAt;

    public function __construct(array $data)
    {
        $this->id = (int) $data['id'];
        $this->productId = (int) $data['product_id'];
        $this->stockUnits = (int) $data['stock_units'];
        $this->expiryDate = $data['expiry_date'] ? (string) $data['expiry_date'] : null;
        $this->discountPercentage = $data['discount_percentage'] !== null ? (float) $data['discount_percentage'] : null;
        $this->discountPrice = $data['discount_price'] !== null ? (float) $data['discount_price'] : null;
        $this->createdAt = (string) $data['created_at'];
        $this->updatedAt = (string) $data['updated_at'];
    }

    public function getId(): int
    {
        return $this->id;
    }

    public function getProductId(): int
    {
        return $this->productId;
    }

    public function getStockUnits(): int
    {
        return $this->stockUnits;
    }

    public function getExpiryDate(): ?string
    {
        return $this->expiryDate;
    }

    public function getDiscountPercentage(): ?float
    {
        return $this->discountPercentage;
    }

    public function getDiscountPrice(): ?float
    {
        return $this->discountPrice;
    }

    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }

    public function getUpdatedAt(): string
    {
        return $this->updatedAt;
    }

    public function isNearExpiry(int $daysBefore = 30): bool
    {
        if (!$this->expiryDate) {
            return false;
        }
        $expiry = new DateTime($this->expiryDate);
        $now = new DateTime();
        $diff = $now->diff($expiry);
        $days = (int) $diff->format('%r%a');
        return $days >= 0 && $days <= $daysBefore;
    }

    public function suggestDiscount(): float
    {
        if (!$this->expiryDate) {
            return 0.0;
        }
        $expiry = new DateTime($this->expiryDate);
        $now = new DateTime();
        $diff = $now->diff($expiry);
        $days = (int) $diff->format('%r%a');

        if ($days < 0) {
            return 70.0; // Expired, heavy discount suggestion
        }
        if ($days <= 5) {
            return 50.0; // <= 5 days: 50% discount
        }
        if ($days <= 15) {
            return 30.0; // <= 15 days: 30% discount
        }
        if ($days <= 30) {
            return 15.0; // <= 30 days: 15% discount
        }
        return 0.0;
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'product_id' => $this->productId,
            'stock_units' => $this->stockUnits,
            'expiry_date' => $this->expiryDate,
            'discount_percentage' => $this->discountPercentage,
            'discount_price' => $this->discountPrice,
            'is_near_expiry' => $this->isNearExpiry(),
            'suggested_discount' => $this->suggestDiscount(),
            'created_at' => $this->createdAt,
            'updated_at' => $this->updatedAt,
        ];
    }
}

class InventoryManager
{
    private PDO $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Get all active batches for a product listing.
     * @return StockBatch[]
     */
    public function getBatches(int $productId): array
    {
        $stmt = $this->db->prepare('SELECT * FROM product_stock_batches WHERE product_id = :product_id ORDER BY expiry_date ASC, created_at ASC');
        $stmt->execute(['product_id' => $productId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $batches = [];
        foreach ($rows as $row) {
            $batches[] = new StockBatch($row);
        }
        return $batches;
    }

    /**
     * Add a new stock batch to the database.
     */
    public function addStockBatch(int $productId, int $quantity, ?string $expiryDate): StockBatch
    {
        if ($quantity <= 0) {
            throw new RuntimeException('Quantity must be greater than zero.');
        }

        // Validate expiry date format
        if ($expiryDate !== null) {
            $dateParsed = DateTime::createFromFormat('Y-m-d', $expiryDate);
            if (!$dateParsed) {
                throw new RuntimeException('Expiry date must be in YYYY-MM-DD format.');
            }
        }

        $this->db->beginTransaction();
        try {
            // Check if product exists
            $stmt = $this->db->prepare('SELECT id, stock_units, last_stock_checkpoint FROM product_listings WHERE id = :id');
            $stmt->execute(['id' => $productId]);
            $product = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$product) {
                throw new RuntimeException('Product listing not found.');
            }

            // Insert stock batch
            $stmtInsert = $this->db->prepare('INSERT INTO product_stock_batches (product_id, stock_units, expiry_date, created_at, updated_at) VALUES (:product_id, :stock_units, :expiry_date, NOW(), NOW())');
            $stmtInsert->execute([
                'product_id' => $productId,
                'stock_units' => $quantity,
                'expiry_date' => $expiryDate
            ]);
            $batchId = (int) $this->db->lastInsertId();

            // Fetch newly created batch
            $stmtFetch = $this->db->prepare('SELECT * FROM product_stock_batches WHERE id = :id');
            $stmtFetch->execute(['id' => $batchId]);
            $batchData = $stmtFetch->fetch(PDO::FETCH_ASSOC);
            $batch = new StockBatch($batchData);

            // Re-calculate total stock and update checkpoint
            $this->syncProductStock($productId);

            $this->db->commit();
            return $batch;
        } catch (\Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    /**
     * Update stock batch details (manually decrease count, set discount).
     */
    public function updateStockBatch(int $batchId, int $newQuantity, ?float $discountPercentage, ?float $discountPrice): void
    {
        $this->db->beginTransaction();
        try {
            // Find existing batch
            $stmt = $this->db->prepare('SELECT * FROM product_stock_batches WHERE id = :id');
            $stmt->execute(['id' => $batchId]);
            $batchData = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$batchData) {
                throw new RuntimeException('Stock batch not found.');
            }

            $productId = (int) $batchData['product_id'];

            if ($newQuantity < 0) {
                throw new RuntimeException('Quantity cannot be negative.');
            }

            if ($newQuantity === 0) {
                // If it is depleted, delete the batch
                $stmtDelete = $this->db->prepare('DELETE FROM product_stock_batches WHERE id = :id');
                $stmtDelete->execute(['id' => $batchId]);
            } else {
                $stmtUpdate = $this->db->prepare('UPDATE product_stock_batches SET stock_units = :stock_units, discount_percentage = :discount_percentage, discount_price = :discount_price, updated_at = NOW() WHERE id = :id');
                $stmtUpdate->execute([
                    'stock_units' => $newQuantity,
                    'discount_percentage' => $discountPercentage,
                    'discount_price' => $discountPrice,
                    'id' => $batchId
                ]);
            }

            // Sync product total stock
            $this->syncProductStock($productId);

            $this->db->commit();
        } catch (\Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    /**
     * Recalculates total stock units and sets checkpoint
     */
    public function syncProductStock(int $productId): void
    {
        // Get sum of batch stocks
        $stmtSum = $this->db->prepare('SELECT SUM(stock_units) FROM product_stock_batches WHERE product_id = :product_id');
        $stmtSum->execute(['product_id' => $productId]);
        $totalStock = (int) $stmtSum->fetchColumn();

        // Check if checkpoint needs to be increased (on stock replenishment)
        $stmtProduct = $this->db->prepare('SELECT stock_units, last_stock_checkpoint FROM product_listings WHERE id = :id');
        $stmtProduct->execute(['id' => $productId]);
        $product = $stmtProduct->fetch(PDO::FETCH_ASSOC);

        if ($product) {
            $currentCheckpoint = (int) $product['last_stock_checkpoint'];
            // If total stock is greater than current checkpoint, update checkpoint.
            // Also, if total stock increases, it indicates new stock was added.
            $newCheckpoint = $totalStock > $product['stock_units'] ? $totalStock : $currentCheckpoint;

            // Ensure checkpoint is never less than totalStock when stock is increased
            if ($totalStock > $currentCheckpoint) {
                $newCheckpoint = $totalStock;
            }

            $stmtUpdate = $this->db->prepare('UPDATE product_listings SET stock_units = :stock_units, last_stock_checkpoint = :checkpoint, updated_at = NOW() WHERE id = :id');
            $stmtUpdate->execute([
                'stock_units' => $totalStock,
                'checkpoint' => $newCheckpoint,
                'id' => $productId
            ]);
        }
    }

    /**
     * Deducts stock for a product listing using FIFO (earliest expiry first, then oldest batch).
     */
    public function deductStock(int $productId, int $quantityToDeduct): void
    {
        if ($quantityToDeduct <= 0) {
            return;
        }

        $batches = $this->getBatches($productId);
        $remaining = $quantityToDeduct;

        // Deduct from batches ordered by expiry (null expiry dates sorted last in MySQL typically, but let's separate them)
        // Sort by oldest batch first (FIFO: oldest created_at / lowest id first)
        usort($batches, function (StockBatch $a, StockBatch $b) {
            return $a->getId() <=> $b->getId();
        });

        foreach ($batches as $batch) {
            if ($remaining <= 0) {
                break;
            }

            $available = $batch->getStockUnits();
            if ($available <= $remaining) {
                // Deplete this batch
                $stmtDelete = $this->db->prepare('DELETE FROM product_stock_batches WHERE id = :id');
                $stmtDelete->execute(['id' => $batch->getId()]);
                $remaining -= $available;
            } else {
                // Deduct partially
                $stmtUpdate = $this->db->prepare('UPDATE product_stock_batches SET stock_units = :stock_units, updated_at = NOW() WHERE id = :id');
                $stmtUpdate->execute([
                    'stock_units' => $available - $remaining,
                    'id' => $batch->getId()
                ]);
                $remaining = 0;
            }
        }

        // Update product listing stock count (which syncs total stock)
        $this->syncProductStock($productId);

        // Check low stock and send notification
        $this->checkLowStockNotification($productId);
    }

    /**
     * Checks if product stock is below 20% of checkpoint and alerts seller.
     */
    private function checkLowStockNotification(int $productId): void
    {
        $stmt = $this->db->prepare('SELECT p.id, p.title, p.user_id, p.stock_units, p.last_stock_checkpoint FROM product_listings p WHERE p.id = :id');
        $stmt->execute(['id' => $productId]);
        $product = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($product) {
            $current = (int) $product['stock_units'];
            $checkpoint = (int) $product['last_stock_checkpoint'];
            $userId = (int) $product['user_id'];

            if ($checkpoint > 0 && ($current / $checkpoint) <= 0.2) {
                // Alert the seller
                $title = 'Low Stock Alert!';
                $description = sprintf('Your product "%s" has only %d units left (out of %d checkpoint stock). Please restock.', $product['title'], $current, $checkpoint);
                
                // Add notification
                $stmtNotify = $this->db->prepare('INSERT INTO notifications (user_id, title, description, link, is_read, created_at) VALUES (:user_id, :title, :description, :link, 0, NOW())');
                $stmtNotify->execute([
                    'user_id' => $userId,
                    'title' => $title,
                    'description' => $description,
                    'link' => '/dashboard?tab=inventory'
                ]);
            }
        }
    }

    /**
     * Scan database for expiring batches (<= 30 days) and alert the seller.
     */
    public function scanAndNotifyNearExpiry(int $userId): void
    {
        // Find batches belonging to this user's products that expire in <= 30 days
        $stmt = $this->db->prepare(
            'SELECT b.id as batch_id, b.expiry_date, b.stock_units, p.id as product_id, p.title
             FROM product_stock_batches b
             INNER JOIN product_listings p ON p.id = b.product_id
             WHERE p.user_id = :user_id AND b.expiry_date IS NOT NULL AND b.expiry_date <= DATE_ADD(NOW(), INTERVAL 30 DAY) AND b.stock_units > 0'
        );
        $stmt->execute(['user_id' => $userId]);
        $batches = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($batches as $batch) {
            $expiryDate = $batch['expiry_date'];
            $batchId = $batch['batch_id'];
            $productId = $batch['product_id'];

            // Check if notification already sent for this batch recently (to avoid spam)
            $checkStmt = $this->db->prepare(
                'SELECT COUNT(*) FROM notifications 
                 WHERE user_id = :user_id AND title = :title AND description LIKE :desc'
            );
            $descMatch = '%Batch #' . $batchId . '%';
            $title = 'Near Expiry Alert!';
            $checkStmt->execute([
                'user_id' => $userId,
                'title' => $title,
                'desc' => $descMatch
            ]);

            if ((int) $checkStmt->fetchColumn() === 0) {
                // Send notification
                $daysLeft = (int) (new DateTime())->diff(new DateTime($expiryDate))->format('%r%a');
                $description = sprintf('Batch #%d of "%s" with %d units is expiring in %d days (%s). Suggest adding a discount.', $batchId, $batch['title'], $batch['stock_units'], $daysLeft, $expiryDate);

                $stmtNotify = $this->db->prepare('INSERT INTO notifications (user_id, title, description, link, is_read, created_at) VALUES (:user_id, :title, :description, :link, 0, NOW())');
                $stmtNotify->execute([
                    'user_id' => $userId,
                    'title' => $title,
                    'description' => $description,
                    'link' => '/dashboard?tab=inventory'
                ]);
            }
        }
    }
}
