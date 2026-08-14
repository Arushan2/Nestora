<?php

declare(strict_types=1);

namespace Nestora\Seller;

use Exception;
use Throwable;

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * OOP Concept 2: ABSTRACTION
 * Interfaces & Contracts for Product Seller operations, persistence & fulfillment.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Contract for Product Seller product listing management.
 */
interface SellerProductServiceInterface
{
    public function listProducts(array $filters): array;

    public function getProduct(int $id): ProductListing;

    public function createProduct(array $user, CreateProductDTO $dto): array;

    public function updateProduct(int $productId, array $user, UpdateProductDTO $dto): array;

    public function deleteProduct(int $productId, array $user): array;

    public function getProductBatches(int $productId, array $user): array;

    public function addProductBatch(int $productId, array $user, AddBatchDTO $dto): array;
}

/**
 * Contract for Seller Order fulfillment & processing.
 */
interface SellerOrderServiceInterface
{
    public function listSellerOrders(array $user): array;

    public function verifyPayment(string $orderId, array $user): array;

    public function shipOrder(string $orderId, array $user, ShipOrderDTO $dto, string $shippingType): array;
}

/**
 * Data access contract for Product Listings persistence.
 */
interface ProductRepositoryInterface
{
    public function findById(int $id): ?ProductListing;

    public function findAll(array $filters): array;

    public function create(int $userId, CreateProductDTO $dto): ProductListing;

    public function update(int $id, UpdateProductDTO $dto): bool;

    public function delete(int $id): bool;
}

/**
 * Data access contract for Seller Orders persistence.
 */
interface SellerOrderRepositoryInterface
{
    public function findByOrderId(string $orderId): ?SellerOrder;

    public function findBySellerId(int $sellerId): array;

    public function updateStatus(string $orderId, string $status): bool;

    public function updateShippingInfo(string $orderId, string $courierName, string $trackingNumber, string $status): bool;
}

/**
 * Contract for Polymorphic Shipping Strategies.
 */
interface ShippingStrategyInterface
{
    public function fulfill(SellerOrder $order, ShipOrderDTO $dto): array;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * OOP Concept 3: INHERITANCE
 * Custom Exception Hierarchy for Product Seller Domain.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Base Seller Domain Exception.
 */
abstract class SellerException extends Exception
{
    protected int $statusCode = 400;
    protected array $data = [];

    public function __construct(string $message, int $statusCode = 400, array $data = [], int $code = 0, ?Throwable $previous = null)
    {
        parent::__construct($message, $code, $previous);
        $this->statusCode = $statusCode;
        $this->data = $data;
    }

    public function getStatusCode(): int
    {
        return $this->statusCode;
    }

    public function getData(): array
    {
        return $this->data;
    }
}

/**
 * Thrown when a product listing is not found.
 */
class ProductNotFoundException extends SellerException
{
    public function __construct(string $message = 'Product listing not found.')
    {
        parent::__construct($message, 404);
    }
}

/**
 * Thrown when an order is not found.
 */
class OrderNotFoundException extends SellerException
{
    public function __construct(string $message = 'Order not found.')
    {
        parent::__construct($message, 404);
    }
}

/**
 * Thrown when an unauthorized user attempts seller operations.
 */
class UnauthorizedSellerException extends SellerException
{
    public function __construct(string $message = 'Access denied. Product sellers only.')
    {
        parent::__construct($message, 403);
    }
}

/**
 * Thrown when product input validation fails.
 */
class ProductValidationException extends SellerException
{
    public function __construct(string $message = 'Product validation failed.')
    {
        parent::__construct($message, 422);
    }
}

/**
 * Thrown when an order is in an invalid state for an action.
 */
class InvalidOrderStateException extends SellerException
{
    public function __construct(string $message = 'Invalid order state for requested operation.')
    {
        parent::__construct($message, 400);
    }
}
