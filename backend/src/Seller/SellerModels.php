<?php

declare(strict_types=1);

namespace Nestora\Seller;

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * OOP Concept 1: ENCAPSULATION
 * Product Seller Domain Entities and Validated Data Transfer Objects (DTOs).
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * ProductListing Model: Encapsulates product properties, pricing, stock levels,
 * district eligibility, and ownership validation.
 */
class ProductListing
{
    private int $id;
    private int $userId;
    private string $title;
    private string $category;
    private ?string $brand;
    private string $description;
    private float $price;
    private string $unitType;
    private array $shippingDistricts;
    private ?string $deliveryTerms;
    private bool $unloadingProvided;
    private array $images;
    private float $shippingFee;
    private int $stockUnits;
    private bool $hasExpiryDate;
    private int $lastStockCheckpoint;
    private string $createdAt;
    private string $updatedAt;
    private ?string $sellerName;
    private ?string $businessName;
    private ?string $businessEmail;
    private ?string $businessPhone;
    private ?string $businessAddress;
    private ?string $businessCity;

    public function __construct(array $data)
    {
        $this->id = (int) ($data['id'] ?? 0);
        $this->userId = (int) ($data['user_id'] ?? 0);
        $this->title = (string) ($data['title'] ?? '');
        $this->category = (string) ($data['category'] ?? '');
        $this->brand = isset($data['brand']) && $data['brand'] !== null && $data['brand'] !== '' ? (string) $data['brand'] : null;
        $this->description = (string) ($data['description'] ?? '');
        $this->price = (float) ($data['price'] ?? 0.0);
        $this->unitType = (string) ($data['unit_type'] ?? '');
        $this->deliveryTerms = isset($data['delivery_terms']) && $data['delivery_terms'] !== null && $data['delivery_terms'] !== '' ? (string) $data['delivery_terms'] : null;
        $this->unloadingProvided = filter_var($data['unloading_provided'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $this->shippingFee = (float) ($data['shipping_fee'] ?? 0.0);
        $this->stockUnits = (int) ($data['stock_units'] ?? 0);
        $this->hasExpiryDate = filter_var($data['has_expiry_date'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $this->lastStockCheckpoint = (int) ($data['last_stock_checkpoint'] ?? 0);
        $this->createdAt = (string) ($data['created_at'] ?? date('Y-m-d H:i:s'));
        $this->updatedAt = (string) ($data['updated_at'] ?? date('Y-m-d H:i:s'));

        // Shipping districts decoding
        $districts = $data['shipping_districts'] ?? [];
        if (is_string($districts)) {
            $decoded = json_decode($districts, true);
            $this->shippingDistricts = is_array($decoded) ? $decoded : [];
        } else {
            $this->shippingDistricts = is_array($districts) ? $districts : [];
        }

        // Images decoding
        $images = $data['images'] ?? [];
        if (is_string($images)) {
            $decoded = json_decode($images, true);
            $this->images = is_array($decoded) ? $decoded : [];
        } else {
            $this->images = is_array($images) ? $images : [];
        }

        // Seller and Business metadata
        $this->sellerName = isset($data['seller_name']) ? (string) $data['seller_name'] : null;
        $this->businessName = isset($data['business_name']) ? (string) $data['business_name'] : null;
        $this->businessEmail = isset($data['business_email']) ? (string) $data['business_email'] : null;
        $this->businessPhone = isset($data['business_phone']) ? (string) $data['business_phone'] : null;
        $this->businessAddress = isset($data['business_address']) ? (string) $data['business_address'] : null;
        $this->businessCity = isset($data['business_city']) ? (string) $data['business_city'] : null;
    }

    public function getId(): int
    {
        return $this->id;
    }

    public function getUserId(): int
    {
        return $this->userId;
    }

    public function getTitle(): string
    {
        return $this->title;
    }

    public function getCategory(): string
    {
        return $this->category;
    }

    public function getBrand(): ?string
    {
        return $this->brand;
    }

    public function getDescription(): string
    {
        return $this->description;
    }

    public function getPrice(): float
    {
        return $this->price;
    }

    public function getUnitType(): string
    {
        return $this->unitType;
    }

    public function getShippingDistricts(): array
    {
        return $this->shippingDistricts;
    }

    public function getDeliveryTerms(): ?string
    {
        return $this->deliveryTerms;
    }

    public function isUnloadingProvided(): bool
    {
        return $this->unloadingProvided;
    }

    public function getImages(): array
    {
        return $this->images;
    }

    public function getShippingFee(): float
    {
        return $this->shippingFee;
    }

    public function getStockUnits(): int
    {
        return $this->stockUnits;
    }

    public function hasExpiryDate(): bool
    {
        return $this->hasExpiryDate;
    }

    public function getLastStockCheckpoint(): int
    {
        return $this->lastStockCheckpoint;
    }

    public function isInStock(): bool
    {
        return $this->stockUnits > 0;
    }

    public function shipsTo(string $district): bool
    {
        return in_array($district, $this->shippingDistricts, true);
    }

    public function isOwnedBy(int $userId): bool
    {
        return $this->userId === $userId;
    }

    public function toArray(): array
    {
        $arr = [
            'id' => $this->id,
            'user_id' => $this->userId,
            'title' => $this->title,
            'category' => $this->category,
            'brand' => $this->brand,
            'description' => $this->description,
            'price' => $this->price,
            'unit_type' => $this->unitType,
            'shipping_districts' => $this->shippingDistricts,
            'delivery_terms' => $this->deliveryTerms,
            'unloading_provided' => $this->unloadingProvided,
            'images' => $this->images,
            'shipping_fee' => $this->shippingFee,
            'stock_units' => $this->stockUnits,
            'has_expiry_date' => $this->hasExpiryDate,
            'last_stock_checkpoint' => $this->lastStockCheckpoint,
            'created_at' => $this->createdAt,
            'updated_at' => $this->updatedAt,
        ];

        if ($this->sellerName !== null) {
            $arr['seller_name'] = $this->sellerName;
        }
        if ($this->businessName !== null) {
            $arr['business_name'] = $this->businessName;
            $arr['business_email'] = $this->businessEmail;
            $arr['business_phone'] = $this->businessPhone;
            $arr['business_address'] = $this->businessAddress;
            $arr['business_city'] = $this->businessCity;
        }

        return $arr;
    }
}

/**
 * SellerOrder Model: Encapsulates seller order entity, line items, and fulfillment states.
 */
class SellerOrder
{
    private string $orderId;
    private int $customerId;
    private ?int $sellerId;
    private float $amount;
    private float $shippingFee;
    private string $status;
    private ?string $paymentId;
    private ?string $courierName;
    private ?string $trackingNumber;
    private string $createdAt;
    private string $updatedAt;
    private ?string $customerName;
    private ?string $customerEmail;
    private array $items;

    public function __construct(array $data, array $items = [])
    {
        $this->orderId = (string) ($data['order_id'] ?? $data['id'] ?? '');
        $this->customerId = (int) ($data['customer_id'] ?? 0);
        $this->sellerId = isset($data['seller_id']) && $data['seller_id'] !== null ? (int) $data['seller_id'] : null;
        $this->amount = (float) ($data['amount'] ?? $data['total_price'] ?? 0.0);
        $this->shippingFee = (float) ($data['shipping_fee'] ?? 0.0);
        $this->status = strtolower((string) ($data['status'] ?? 'pending'));
        $this->paymentId = isset($data['payhere_payment_id']) ? (string) $data['payhere_payment_id'] : null;
        $this->courierName = isset($data['courier_name']) ? (string) $data['courier_name'] : null;
        $this->trackingNumber = isset($data['tracking_number']) ? (string) $data['tracking_number'] : null;
        $this->createdAt = (string) ($data['created_at'] ?? date('Y-m-d H:i:s'));
        $this->updatedAt = (string) ($data['updated_at'] ?? date('Y-m-d H:i:s'));
        $this->customerName = isset($data['customer_name']) ? (string) $data['customer_name'] : null;
        $this->customerEmail = isset($data['customer_email']) ? (string) $data['customer_email'] : null;
        $this->items = $items;
    }

    public function getOrderId(): string
    {
        return $this->orderId;
    }

    public function getCustomerId(): int
    {
        return $this->customerId;
    }

    public function getSellerId(): ?int
    {
        return $this->sellerId;
    }

    public function getAmount(): float
    {
        return $this->amount;
    }

    public function getShippingFee(): float
    {
        return $this->shippingFee;
    }

    public function getStatus(): string
    {
        return $this->status;
    }

    public function getCourierName(): ?string
    {
        return $this->courierName;
    }

    public function getTrackingNumber(): ?string
    {
        return $this->trackingNumber;
    }

    public function getItems(): array
    {
        return $this->items;
    }

    public function canBeVerified(): bool
    {
        return $this->status === 'awaiting_verification';
    }

    public function canBeShipped(): bool
    {
        return in_array($this->status, ['processing', 'awaiting_verification', 'paid'], true);
    }

    public function isCompleted(): bool
    {
        return in_array($this->status, ['completed', 'delivered', 'shipped'], true);
    }

    public function toArray(): array
    {
        return [
            'id' => $this->orderId,
            'order_id' => $this->orderId,
            'reference' => $this->orderId,
            'customer_id' => $this->customerId,
            'seller_id' => $this->sellerId,
            'total_price' => $this->amount,
            'amount' => $this->amount,
            'shipping_fee' => $this->shippingFee,
            'status' => $this->status,
            'bank_receipt_url' => $this->paymentId,
            'payhere_payment_id' => $this->paymentId,
            'courier_name' => $this->courierName,
            'tracking_number' => $this->trackingNumber,
            'customer_name' => $this->customerName,
            'customer_email' => $this->customerEmail,
            'created_at' => $this->createdAt,
            'updated_at' => $this->updatedAt,
            'items' => $this->items,
        ];
    }
}

/**
 * CreateProduct DTO: Encapsulates and validates new product creation parameters.
 */
class CreateProductDTO
{
    private string $title;
    private string $category;
    private string $brand;
    private string $description;
    private string $unitType;
    private float $price;
    private float $shippingFee;
    private int $stockUnits;
    private string $deliveryTerms;
    private bool $unloadingProvided;
    private array $shippingDistricts;
    private array $images;
    private bool $hasExpiryDate;
    private ?string $expiryDate;

    public function __construct(array $data, array $uploadedImages = [])
    {
        $this->title = trim((string) ($data['title'] ?? ''));
        $this->category = trim((string) ($data['category'] ?? ''));
        $this->brand = trim((string) ($data['brand'] ?? ''));
        $this->description = trim((string) ($data['description'] ?? ''));
        $this->unitType = trim((string) ($data['unit_type'] ?? ''));
        $this->price = (float) ($data['price'] ?? 0.0);
        $this->shippingFee = (float) ($data['shipping_fee'] ?? 0.0);
        $this->stockUnits = (int) ($data['stock_units'] ?? 0);
        $this->deliveryTerms = trim((string) ($data['delivery_terms'] ?? ''));
        $this->unloadingProvided = filter_var($data['unloading_provided'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $this->hasExpiryDate = filter_var($data['has_expiry_date'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $this->expiryDate = !empty($data['expiry_date']) ? trim((string) $data['expiry_date']) : null;
        $this->images = $uploadedImages;

        // Parse districts
        $districts = $data['shipping_districts'] ?? '';
        if (is_string($districts) && trim($districts) !== '') {
            $decoded = json_decode($districts, true);
            $this->shippingDistricts = is_array($decoded) ? $decoded : array_filter(array_map('trim', explode(',', $districts)));
        } else if (is_array($districts)) {
            $this->shippingDistricts = $districts;
        } else {
            $this->shippingDistricts = [];
        }

        $this->validate();
    }

    private function validate(): void
    {
        if ($this->title === '' || $this->category === '' || $this->description === '' || $this->unitType === '') {
            throw new ProductValidationException('Title, category, description, and unit type are required.');
        }

        if ($this->price <= 0) {
            throw new ProductValidationException('Price must be a positive number.');
        }

        if (empty($this->shippingDistricts)) {
            throw new ProductValidationException('At least one shipping district must be selected.');
        }
    }

    public function getTitle(): string { return $this->title; }
    public function getCategory(): string { return $this->category; }
    public function getBrand(): ?string { return $this->brand === '' ? null : $this->brand; }
    public function getDescription(): string { return $this->description; }
    public function getUnitType(): string { return $this->unitType; }
    public function getPrice(): float { return $this->price; }
    public function getShippingFee(): float { return $this->shippingFee; }
    public function getStockUnits(): int { return $this->stockUnits; }
    public function getDeliveryTerms(): ?string { return $this->deliveryTerms === '' ? null : $this->deliveryTerms; }
    public function isUnloadingProvided(): bool { return $this->unloadingProvided; }
    public function getShippingDistricts(): array { return array_values($this->shippingDistricts); }
    public function getImages(): array { return $this->images; }
    public function hasExpiryDate(): bool { return $this->hasExpiryDate; }
    public function getExpiryDate(): ?string { return $this->expiryDate; }
}

/**
 * UpdateProduct DTO: Encapsulates and validates product edit parameters.
 */
class UpdateProductDTO
{
    private string $title;
    private string $category;
    private string $brand;
    private string $description;
    private string $unitType;
    private float $price;
    private float $shippingFee;
    private int $stockUnits;
    private string $deliveryTerms;
    private bool $unloadingProvided;
    private array $shippingDistricts;
    private array $images;
    private ?bool $hasExpiryDate;

    public function __construct(array $data, array $existingImages = [], array $newUploadedImages = [])
    {
        $this->title = trim((string) ($data['title'] ?? ''));
        $this->category = trim((string) ($data['category'] ?? ''));
        $this->brand = trim((string) ($data['brand'] ?? ''));
        $this->description = trim((string) ($data['description'] ?? ''));
        $this->unitType = trim((string) ($data['unit_type'] ?? ''));
        $this->price = (float) ($data['price'] ?? 0.0);
        $this->shippingFee = (float) ($data['shipping_fee'] ?? 0.0);
        $this->stockUnits = (int) ($data['stock_units'] ?? 0);
        $this->deliveryTerms = trim((string) ($data['delivery_terms'] ?? ''));
        $this->unloadingProvided = filter_var($data['unloading_provided'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $this->hasExpiryDate = isset($data['has_expiry_date']) ? filter_var($data['has_expiry_date'], FILTER_VALIDATE_BOOLEAN) : null;

        // Merge images
        $clientImages = $data['images'] ?? null;
        if ($clientImages !== null) {
            if (is_string($clientImages)) {
                $decoded = json_decode($clientImages, true);
                $existingImages = is_array($decoded) ? $decoded : $existingImages;
            } elseif (is_array($clientImages)) {
                $existingImages = $clientImages;
            }
        }
        $this->images = array_merge($existingImages, $newUploadedImages);

        // Parse districts
        $districts = $data['shipping_districts'] ?? '';
        if (is_string($districts) && trim($districts) !== '') {
            $decoded = json_decode($districts, true);
            $this->shippingDistricts = is_array($decoded) ? $decoded : array_filter(array_map('trim', explode(',', $districts)));
        } else if (is_array($districts)) {
            $this->shippingDistricts = $districts;
        } else {
            $this->shippingDistricts = [];
        }

        $this->validate();
    }

    private function validate(): void
    {
        if ($this->title === '' || $this->category === '' || $this->description === '' || $this->unitType === '') {
            throw new ProductValidationException('Title, category, description, and unit type are required.');
        }

        if ($this->price <= 0) {
            throw new ProductValidationException('Price must be a positive number.');
        }

        if (empty($this->shippingDistricts)) {
            throw new ProductValidationException('At least one shipping district must be selected.');
        }
    }

    public function getTitle(): string { return $this->title; }
    public function getCategory(): string { return $this->category; }
    public function getBrand(): ?string { return $this->brand === '' ? null : $this->brand; }
    public function getDescription(): string { return $this->description; }
    public function getUnitType(): string { return $this->unitType; }
    public function getPrice(): float { return $this->price; }
    public function getShippingFee(): float { return $this->shippingFee; }
    public function getStockUnits(): int { return $this->stockUnits; }
    public function getDeliveryTerms(): ?string { return $this->deliveryTerms === '' ? null : $this->deliveryTerms; }
    public function isUnloadingProvided(): bool { return $this->unloadingProvided; }
    public function getShippingDistricts(): array { return array_values($this->shippingDistricts); }
    public function getImages(): array { return $this->images; }
    public function getHasExpiryDate(): ?bool { return $this->hasExpiryDate; }
}

/**
 * ShipOrder DTO: Encapsulates courier name and tracking number validation.
 */
class ShipOrderDTO
{
    private string $courierName;
    private string $trackingNumber;

    public function __construct(array $data)
    {
        $this->courierName = trim((string) ($data['courier_name'] ?? ''));
        $this->trackingNumber = trim((string) ($data['tracking_number'] ?? ''));

        $this->validate();
    }

    private function validate(): void
    {
        if ($this->courierName === '' || $this->trackingNumber === '') {
            throw new ProductValidationException('Courier name and tracking number are required.');
        }
    }

    public function getCourierName(): string { return $this->courierName; }
    public function getTrackingNumber(): string { return $this->trackingNumber; }
}

/**
 * AddBatch DTO: Encapsulates stock quantity and expiry date for stock batches.
 */
class AddBatchDTO
{
    private int $quantity;
    private ?string $expiryDate;

    public function __construct(array $data, bool $productHasExpiry = false)
    {
        $this->quantity = (int) ($data['quantity'] ?? 0);
        $expiry = isset($data['expiry_date']) && trim((string) $data['expiry_date']) !== '' ? trim((string) $data['expiry_date']) : null;
        $this->expiryDate = $productHasExpiry ? $expiry : null;

        $this->validate();
    }

    private function validate(): void
    {
        if ($this->quantity <= 0) {
            throw new ProductValidationException('Stock quantity must be a positive integer.');
        }
    }

    public function getQuantity(): int { return $this->quantity; }
    public function getExpiryDate(): ?string { return $this->expiryDate; }
}
