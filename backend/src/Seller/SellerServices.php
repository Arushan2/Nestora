<?php

declare(strict_types=1);

namespace Nestora\Seller;

use Nestora\Inventory\InventoryManager;
use PDO;
use RuntimeException;
use Throwable;

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * OOP Concept 3 & 4: INHERITANCE & POLYMORPHISM
 * Repositories, Polymorphic Shipping Strategies, Domain Services & Seller Controller.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Concrete PDO implementation of ProductRepositoryInterface.
 */
class PdoProductRepository implements ProductRepositoryInterface
{
    private PDO $db;

    public function __construct(?PDO $db = null)
    {
        $this->db = $db ?? database();
    }

    public function findById(int $id): ?ProductListing
    {
        $query = 'SELECT p.*, a.business_name, a.business_email, a.business_phone, a.business_address, a.business_city, u.name AS seller_name
                  FROM product_listings p
                  INNER JOIN users u ON u.id = p.user_id
                  LEFT JOIN pro_applications a ON a.user_id = p.user_id
                  WHERE p.id = :id';

        $stmt = $this->db->prepare($query);
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();

        return is_array($row) ? new ProductListing($row) : null;
    }

    public function findAll(array $filters): array
    {
        $myListings = ($filters['my_listings'] ?? '') === 'true';
        $category = trim((string) ($filters['category'] ?? ''));
        $district = trim((string) ($filters['district'] ?? ''));
        $userId = (int) ($filters['user_id'] ?? 0);
        $currentUserId = (int) ($filters['current_user_id'] ?? 0);
        $q = trim((string) ($filters['q'] ?? ''));
        $limit = (int) ($filters['limit'] ?? 0);

        $query = 'SELECT p.*, a.business_name, a.business_email, a.business_phone, a.business_address, a.business_city, u.name AS seller_name
                  FROM product_listings p
                  INNER JOIN users u ON u.id = p.user_id
                  LEFT JOIN pro_applications a ON a.user_id = p.user_id';

        $conditions = [];
        $params = [];

        if ($myListings && $currentUserId > 0) {
            $conditions[] = 'p.user_id = :user_id';
            $params['user_id'] = $currentUserId;
        } elseif ($userId > 0) {
            $conditions[] = 'p.user_id = :user_id';
            $params['user_id'] = $userId;
            $conditions[] = '(u.banned_until IS NULL OR u.banned_until <= NOW())';
        } else {
            $conditions[] = '(u.banned_until IS NULL OR u.banned_until <= NOW())';
        }

        if ($category !== '') {
            $conditions[] = 'p.category = :category';
            $params['category'] = $category;
        }

        if ($q !== '') {
            $conditions[] = '(p.title LIKE :q OR p.description LIKE :q OR p.brand LIKE :q_brand)';
            $params['q'] = '%' . $q . '%';
            $params['q_brand'] = '%' . $q . '%';
        }

        if ($conditions !== []) {
            $query .= ' WHERE ' . implode(' AND ', $conditions);
        }

        $query .= ' ORDER BY p.created_at DESC';

        if ($limit > 0) {
            $query .= ' LIMIT ' . $limit;
        }

        $stmt = $this->db->prepare($query);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        $listings = [];
        foreach ($rows as $row) {
            $listing = new ProductListing($row);
            if ($district !== '' && !$listing->shipsTo($district)) {
                continue;
            }
            $listings[] = $listing;
        }

        return $listings;
    }

    public function create(int $userId, CreateProductDTO $dto): ProductListing
    {
        $stmt = $this->db->prepare(
            'INSERT INTO product_listings (user_id, title, category, brand, description, price, unit_type, shipping_districts, delivery_terms, unloading_provided, images, shipping_fee, stock_units, has_expiry_date, last_stock_checkpoint, created_at, updated_at)
             VALUES (:user_id, :title, :category, :brand, :description, :price, :unit_type, :shipping_districts, :delivery_terms, :unloading_provided, :images, :shipping_fee, :stock_units, :has_expiry_date, :last_stock_checkpoint, NOW(), NOW())'
        );

        $stmt->execute([
            'user_id' => $userId,
            'title' => $dto->getTitle(),
            'category' => $dto->getCategory(),
            'brand' => $dto->getBrand(),
            'description' => $dto->getDescription(),
            'price' => $dto->getPrice(),
            'unit_type' => $dto->getUnitType(),
            'shipping_districts' => json_encode($dto->getShippingDistricts()),
            'delivery_terms' => $dto->getDeliveryTerms(),
            'unloading_provided' => $dto->isUnloadingProvided() ? 1 : 0,
            'images' => json_encode($dto->getImages()),
            'shipping_fee' => $dto->getShippingFee(),
            'stock_units' => $dto->getStockUnits(),
            'has_expiry_date' => $dto->hasExpiryDate() ? 1 : 0,
            'last_stock_checkpoint' => $dto->getStockUnits(),
        ]);

        $productId = (int) $this->db->lastInsertId();

        if ($dto->getStockUnits() > 0) {
            try {
                $manager = new InventoryManager($this->db);
                $stmtReset = $this->db->prepare('UPDATE product_listings SET stock_units = 0 WHERE id = :id');
                $stmtReset->execute(['id' => $productId]);
                $manager->addStockBatch($productId, $dto->getStockUnits(), $dto->hasExpiryDate() ? $dto->getExpiryDate() : null);
            } catch (Throwable $e) {
                // Batch creation handled gracefully
            }
        }

        $created = $this->findById($productId);
        if ($created === null) {
            throw new RuntimeException('Failed to load created product listing.');
        }

        return $created;
    }

    public function update(int $id, UpdateProductDTO $dto): bool
    {
        $existing = $this->findById($id);
        if ($existing === null) {
            return false;
        }

        $hasExpiryDate = $dto->getHasExpiryDate() !== null
            ? ($dto->getHasExpiryDate() ? 1 : 0)
            : ($existing->hasExpiryDate() ? 1 : 0);

        $stmt = $this->db->prepare(
            'UPDATE product_listings
             SET title = :title, category = :category, brand = :brand, description = :description, unit_type = :unit_type,
                 price = :price, delivery_terms = :delivery_terms, unloading_provided = :unloading_provided, shipping_districts = :shipping_districts, images = :images,
                 shipping_fee = :shipping_fee, stock_units = :stock_units, has_expiry_date = :has_expiry_date, updated_at = NOW()
             WHERE id = :id'
        );

        return $stmt->execute([
            'title' => $dto->getTitle(),
            'category' => $dto->getCategory(),
            'brand' => $dto->getBrand(),
            'description' => $dto->getDescription(),
            'unit_type' => $dto->getUnitType(),
            'price' => $dto->getPrice(),
            'delivery_terms' => $dto->getDeliveryTerms(),
            'unloading_provided' => $dto->isUnloadingProvided() ? 1 : 0,
            'shipping_districts' => json_encode($dto->getShippingDistricts()),
            'images' => json_encode($dto->getImages()),
            'shipping_fee' => $dto->getShippingFee(),
            'stock_units' => $dto->getStockUnits(),
            'has_expiry_date' => $hasExpiryDate,
            'id' => $id,
        ]);
    }

    public function delete(int $id): bool
    {
        $stmt = $this->db->prepare('DELETE FROM product_listings WHERE id = :id');
        return $stmt->execute(['id' => $id]);
    }
}

/**
 * Concrete PDO implementation of SellerOrderRepositoryInterface.
 */
class PdoSellerOrderRepository implements SellerOrderRepositoryInterface
{
    private PDO $db;

    public function __construct(?PDO $db = null)
    {
        $this->db = $db ?? database();
    }

    public function findByOrderId(string $orderId): ?SellerOrder
    {
        $stmt = $this->db->prepare('
            SELECT o.*, u.name AS customer_name, u.email AS customer_email
            FROM orders o
            INNER JOIN users u ON u.id = o.customer_id
            WHERE o.order_id = :order_id LIMIT 1
        ');
        $stmt->execute(['order_id' => $orderId]);
        $row = $stmt->fetch();

        if (!is_array($row)) {
            return null;
        }

        $items = $this->fetchOrderItems($orderId);
        return new SellerOrder($row, $items);
    }

    public function findBySellerId(int $sellerId): array
    {
        $stmt = $this->db->prepare('
            SELECT o.*, u.name AS customer_name, u.email AS customer_email
            FROM orders o
            INNER JOIN users u ON u.id = o.customer_id
            WHERE o.seller_id = :seller_id AND o.status != "PENDING"
            ORDER BY o.created_at DESC
        ');
        $stmt->execute(['seller_id' => $sellerId]);
        $rows = $stmt->fetchAll();

        $orders = [];
        foreach ($rows as $row) {
            $items = $this->fetchOrderItems((string) $row['order_id']);
            $orders[] = new SellerOrder($row, $items);
        }

        return $orders;
    }

    public function updateStatus(string $orderId, string $status): bool
    {
        $stmt = $this->db->prepare('UPDATE orders SET status = :status, updated_at = NOW() WHERE order_id = :order_id');
        return $stmt->execute(['status' => $status, 'order_id' => $orderId]);
    }

    public function updateShippingInfo(string $orderId, string $courierName, string $trackingNumber, string $status = 'shipped'): bool
    {
        $stmt = $this->db->prepare('
            UPDATE orders
            SET status = :status, courier_name = :courier_name, tracking_number = :tracking_number, updated_at = NOW()
            WHERE order_id = :order_id
        ');
        return $stmt->execute([
            'status' => $status,
            'courier_name' => $courierName,
            'tracking_number' => $trackingNumber,
            'order_id' => $orderId,
        ]);
    }

    private function fetchOrderItems(string $orderId): array
    {
        $itemsStmt = $this->db->prepare('
            SELECT oi.*, p.images, p.unit_type
            FROM order_items oi
            LEFT JOIN product_listings p ON p.id = oi.product_id
            WHERE oi.order_id = :order_id
        ');
        $itemsStmt->execute(['order_id' => $orderId]);
        $items = $itemsStmt->fetchAll();

        foreach ($items as &$item) {
            $item['id'] = (int) $item['id'];
            $item['order_id'] = $item['order_id'];
            $item['product_id'] = (int) $item['product_id'];
            $item['quantity'] = (int) $item['quantity'];
            $item['price'] = (float) $item['price'];
            $item['images'] = json_decode((string) ($item['images'] ?? '[]'), true);
        }

        return $items;
    }
}

/**
 * Polymorphic Shipping Strategy 1: Standard Courier carrier dispatch.
 */
class StandardCourierShippingStrategy implements ShippingStrategyInterface
{
    private SellerOrderRepositoryInterface $orderRepository;

    public function __construct(SellerOrderRepositoryInterface $orderRepository)
    {
        $this->orderRepository = $orderRepository;
    }

    public function fulfill(SellerOrder $order, ShipOrderDTO $dto): array
    {
        $this->orderRepository->updateShippingInfo(
            $order->getOrderId(),
            $dto->getCourierName(),
            $dto->getTrackingNumber(),
            'shipped'
        );

        if (function_exists('createNotification')) {
            createNotification(
                $order->getCustomerId(),
                'Order Shipped',
                "Your order {$order->getOrderId()} has been shipped via {$dto->getCourierName()} (Tracking: {$dto->getTrackingNumber()}).",
                '/orders'
            );
        }

        return [
            'message' => 'Order marked as shipped.',
            'order_id' => $order->getOrderId(),
            'courier_name' => $dto->getCourierName(),
            'tracking_number' => $dto->getTrackingNumber(),
        ];
    }
}

/**
 * Polymorphic Shipping Strategy 2: Direct Local Delivery dispatch.
 */
class DirectDeliveryShippingStrategy implements ShippingStrategyInterface
{
    private SellerOrderRepositoryInterface $orderRepository;

    public function __construct(SellerOrderRepositoryInterface $orderRepository)
    {
        $this->orderRepository = $orderRepository;
    }

    public function fulfill(SellerOrder $order, ShipOrderDTO $dto): array
    {
        $courierName = $dto->getCourierName() !== '' ? $dto->getCourierName() : 'Direct Delivery';
        $trackingNumber = $dto->getTrackingNumber() !== '' ? $dto->getTrackingNumber() : 'LOCAL-' . strtoupper(substr(md5(uniqid()), 0, 8));

        $this->orderRepository->updateShippingInfo(
            $order->getOrderId(),
            $courierName,
            $trackingNumber,
            'shipped'
        );

        if (function_exists('createNotification')) {
            createNotification(
                $order->getCustomerId(),
                'Order Out for Delivery',
                "Your order {$order->getOrderId()} is out for direct delivery by the seller.",
                '/orders'
            );
        }

        return [
            'message' => 'Order marked for direct delivery.',
            'order_id' => $order->getOrderId(),
            'courier_name' => $courierName,
            'tracking_number' => $trackingNumber,
        ];
    }
}

/**
 * Abstract Base Seller Service (Inheritance).
 */
abstract class AbstractSellerService
{
    protected function ensureSellerAccess(array $user): void
    {
        $role = $user['role'] ?? '';
        if ($role !== 'product_seller' && $role !== 'admin') {
            throw new UnauthorizedSellerException('Access denied. Product sellers only.');
        }
    }

    protected function ensureProductOwnership(ProductListing $product, array $user): void
    {
        $userId = (int) ($user['id'] ?? 0);
        $role = $user['role'] ?? '';

        if (!$product->isOwnedBy($userId) && $role !== 'admin') {
            throw new UnauthorizedSellerException('You do not have permission to modify this product listing.');
        }
    }
}

/**
 * Product Seller Service implementing SellerProductServiceInterface.
 */
class ProductSellerService extends AbstractSellerService implements SellerProductServiceInterface
{
    private ProductRepositoryInterface $productRepository;

    public function __construct(?ProductRepositoryInterface $productRepository = null)
    {
        $this->productRepository = $productRepository ?? new PdoProductRepository();
    }

    public function listProducts(array $filters): array
    {
        $listings = $this->productRepository->findAll($filters);
        return array_map(fn(ProductListing $p) => $p->toArray(), $listings);
    }

    public function getProduct(int $id): ProductListing
    {
        $product = $this->productRepository->findById($id);
        if ($product === null) {
            throw new ProductNotFoundException('Product listing not found.');
        }
        return $product;
    }

    public function createProduct(array $user, CreateProductDTO $dto): array
    {
        $this->ensureSellerAccess($user);

        $product = $this->productRepository->create((int) $user['id'], $dto);

        return [
            'message' => 'Product listing created successfully.',
            'listing' => $product->toArray(),
        ];
    }

    public function updateProduct(int $productId, array $user, UpdateProductDTO $dto): array
    {
        $product = $this->getProduct($productId);
        $this->ensureProductOwnership($product, $user);

        $this->productRepository->update($productId, $dto);

        return ['message' => 'Product listing updated successfully.'];
    }

    public function deleteProduct(int $productId, array $user): array
    {
        $product = $this->getProduct($productId);
        $this->ensureProductOwnership($product, $user);

        $this->productRepository->delete($productId);

        return ['message' => 'Product listing deleted successfully.'];
    }

    public function getProductBatches(int $productId, array $user): array
    {
        $product = $this->getProduct($productId);
        $this->ensureProductOwnership($product, $user);

        $manager = new InventoryManager(database());
        $batches = $manager->getBatches($productId);

        return [
            'has_expiry_date' => $product->hasExpiryDate(),
            'batches' => array_map(fn($b) => $b->toArray(), $batches),
        ];
    }

    public function addProductBatch(int $productId, array $user, AddBatchDTO $dto): array
    {
        $product = $this->getProduct($productId);
        $this->ensureProductOwnership($product, $user);

        $manager = new InventoryManager(database());
        $batch = $manager->addStockBatch($productId, $dto->getQuantity(), $dto->getExpiryDate());

        return [
            'message' => 'Stock batch added successfully.',
            'batch' => $batch->toArray(),
        ];
    }
}

/**
 * Seller Order Service implementing SellerOrderServiceInterface.
 */
class SellerOrderService extends AbstractSellerService implements SellerOrderServiceInterface
{
    private SellerOrderRepositoryInterface $orderRepository;
    private ShippingStrategyInterface $standardStrategy;
    private ShippingStrategyInterface $directStrategy;

    public function __construct(
        ?SellerOrderRepositoryInterface $orderRepository = null,
        ?ShippingStrategyInterface $standardStrategy = null,
        ?ShippingStrategyInterface $directStrategy = null
    ) {
        $this->orderRepository = $orderRepository ?? new PdoSellerOrderRepository();
        $this->standardStrategy = $standardStrategy ?? new StandardCourierShippingStrategy($this->orderRepository);
        $this->directStrategy = $directStrategy ?? new DirectDeliveryShippingStrategy($this->orderRepository);
    }

    public function listSellerOrders(array $user): array
    {
        $this->ensureSellerAccess($user);

        $orders = $this->orderRepository->findBySellerId((int) $user['id']);
        return array_map(fn(SellerOrder $o) => $o->toArray(), $orders);
    }

    public function verifyPayment(string $orderId, array $user): array
    {
        $this->ensureSellerAccess($user);

        $order = $this->orderRepository->findByOrderId($orderId);
        if ($order === null) {
            throw new OrderNotFoundException('Order not found.');
        }

        if ($order->getSellerId() !== (int) $user['id'] && ($user['role'] ?? '') !== 'admin') {
            throw new UnauthorizedSellerException('You do not have permission to modify this order.');
        }

        if (!$order->canBeVerified()) {
            throw new InvalidOrderStateException('Order cannot be set to processing (must be in awaiting verification status).');
        }

        $this->orderRepository->updateStatus($orderId, 'processing');

        if (function_exists('createNotification')) {
            createNotification(
                $order->getCustomerId(),
                'Payment Verified',
                "Payment receipt for order {$orderId} has been verified. Your order is now processing.",
                '/orders'
            );
        }

        return ['message' => 'Payment verified successfully. Order is now processing.'];
    }

    public function shipOrder(string $orderId, array $user, ShipOrderDTO $dto, string $shippingType = 'courier'): array
    {
        $this->ensureSellerAccess($user);

        $order = $this->orderRepository->findByOrderId($orderId);
        if ($order === null) {
            throw new OrderNotFoundException('Order not found.');
        }

        if ($order->getSellerId() !== (int) $user['id'] && ($user['role'] ?? '') !== 'admin') {
            throw new UnauthorizedSellerException('You do not have permission to modify this order.');
        }

        // Polymorphically fulfill using the designated strategy
        $strategy = $shippingType === 'direct' ? $this->directStrategy : $this->standardStrategy;
        return $strategy->fulfill($order, $dto);
    }
}

/**
 * Primary Controller coordinating Product Seller operations.
 */
class SellerController
{
    private SellerProductServiceInterface $productService;
    private SellerOrderServiceInterface $orderService;

    public function __construct(
        ?SellerProductServiceInterface $productService = null,
        ?SellerOrderServiceInterface $orderService = null
    ) {
        $this->productService = $productService ?? new ProductSellerService();
        $this->orderService = $orderService ?? new SellerOrderService();
    }

    public function handleListProducts(array $queryParams): void
    {
        try {
            $user = function_exists('currentUser') ? currentUser() : null;
            $queryParams['current_user_id'] = $user['id'] ?? 0;

            $listings = $this->productService->listProducts($queryParams);
            $this->jsonResponse(200, ['listings' => $listings]);
        } catch (SellerException $e) {
            $this->jsonResponse($e->getStatusCode(), array_merge(['message' => $e->getMessage()], $e->getData()));
        } catch (Throwable $e) {
            $this->jsonResponse(500, ['message' => $e->getMessage()]);
        }
    }

    public function handleGetProduct(int $id): void
    {
        try {
            $product = $this->productService->getProduct($id);
            $this->jsonResponse(200, ['listing' => $product->toArray()]);
        } catch (SellerException $e) {
            $this->jsonResponse($e->getStatusCode(), array_merge(['message' => $e->getMessage()], $e->getData()));
        } catch (Throwable $e) {
            $this->jsonResponse(500, ['message' => $e->getMessage()]);
        }
    }

    public function handleCreateProduct(array $postData, array $uploadedImages): void
    {
        try {
            $user = currentUserOrFail();
            $dto = new CreateProductDTO($postData, $uploadedImages);
            $response = $this->productService->createProduct($user, $dto);
            $this->jsonResponse(201, $response);
        } catch (SellerException $e) {
            $this->jsonResponse($e->getStatusCode(), array_merge(['message' => $e->getMessage()], $e->getData()));
        } catch (Throwable $e) {
            $this->jsonResponse(500, ['message' => $e->getMessage()]);
        }
    }

    public function handleUpdateProduct(int $id, array $postData, array $existingImages, array $newUploadedImages): void
    {
        try {
            $user = currentUserOrFail();
            $dto = new UpdateProductDTO($postData, $existingImages, $newUploadedImages);
            $response = $this->productService->updateProduct($id, $user, $dto);
            $this->jsonResponse(200, $response);
        } catch (SellerException $e) {
            $this->jsonResponse($e->getStatusCode(), array_merge(['message' => $e->getMessage()], $e->getData()));
        } catch (Throwable $e) {
            $this->jsonResponse(500, ['message' => $e->getMessage()]);
        }
    }

    public function handleDeleteProduct(int $id): void
    {
        try {
            $user = currentUserOrFail();
            $response = $this->productService->deleteProduct($id, $user);
            $this->jsonResponse(200, $response);
        } catch (SellerException $e) {
            $this->jsonResponse($e->getStatusCode(), array_merge(['message' => $e->getMessage()], $e->getData()));
        } catch (Throwable $e) {
            $this->jsonResponse(500, ['message' => $e->getMessage()]);
        }
    }

    public function handleGetBatches(int $productId): void
    {
        try {
            $user = currentUserOrFail();
            $response = $this->productService->getProductBatches($productId, $user);
            $this->jsonResponse(200, $response);
        } catch (SellerException $e) {
            $this->jsonResponse($e->getStatusCode(), array_merge(['message' => $e->getMessage()], $e->getData()));
        } catch (Throwable $e) {
            $this->jsonResponse(500, ['message' => $e->getMessage()]);
        }
    }

    public function handleAddBatch(int $productId, array $inputData): void
    {
        try {
            $user = currentUserOrFail();
            $product = $this->productService->getProduct($productId);
            $dto = new AddBatchDTO($inputData, $product->hasExpiryDate());
            $response = $this->productService->addProductBatch($productId, $user, $dto);
            $this->jsonResponse(201, $response);
        } catch (SellerException $e) {
            $this->jsonResponse($e->getStatusCode(), array_merge(['message' => $e->getMessage()], $e->getData()));
        } catch (Throwable $e) {
            $this->jsonResponse(500, ['message' => $e->getMessage()]);
        }
    }

    public function handleListSellerOrders(): void
    {
        try {
            $user = currentUserOrFail();
            $orders = $this->orderService->listSellerOrders($user);
            $this->jsonResponse(200, ['orders' => $orders]);
        } catch (SellerException $e) {
            $this->jsonResponse($e->getStatusCode(), array_merge(['message' => $e->getMessage()], $e->getData()));
        } catch (Throwable $e) {
            $this->jsonResponse(500, ['message' => $e->getMessage()]);
        }
    }

    public function handleVerifyPayment(string $orderId): void
    {
        try {
            $user = currentUserOrFail();
            $response = $this->orderService->verifyPayment($orderId, $user);
            $this->jsonResponse(200, $response);
        } catch (SellerException $e) {
            $this->jsonResponse($e->getStatusCode(), array_merge(['message' => $e->getMessage()], $e->getData()));
        } catch (Throwable $e) {
            $this->jsonResponse(500, ['message' => $e->getMessage()]);
        }
    }

    public function handleShipOrder(string $orderId, array $inputData): void
    {
        try {
            $user = currentUserOrFail();
            $dto = new ShipOrderDTO($inputData);
            $response = $this->orderService->shipOrder($orderId, $user, $dto, 'courier');
            $this->jsonResponse(200, $response);
        } catch (SellerException $e) {
            $this->jsonResponse($e->getStatusCode(), array_merge(['message' => $e->getMessage()], $e->getData()));
        } catch (Throwable $e) {
            $this->jsonResponse(500, ['message' => $e->getMessage()]);
        }
    }

    private function jsonResponse(int $status, array $payload): void
    {
        if (function_exists('jsonResponse')) {
            jsonResponse($status, $payload);
            return;
        }

        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($payload, JSON_UNESCAPED_SLASHES);
        exit;
    }
}
