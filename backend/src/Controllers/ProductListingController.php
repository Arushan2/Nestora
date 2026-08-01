<?php

declare(strict_types=1);

namespace Nestora\Controllers;

use Nestora\Core\Base\AbstractController;
use Nestora\Core\Http\Request;
use Nestora\Core\Http\Response;
use Nestora\Core\Services\CloudinaryStorageService;
use Throwable;

class ProductListingController extends AbstractController
{
    private CloudinaryStorageService $storageService;

    public function __construct()
    {
        parent::__construct();
        $this->storageService = new CloudinaryStorageService();
    }

    public function list(Request $request): Response
    {
        $myListings = $request->getQuery('my_listings') === 'true';
        $category = trim((string) $request->getQuery('category', ''));
        $userId = (int) $request->getQuery('user_id', 0);
        $q = trim((string) $request->getQuery('q', ''));

        $query = 'SELECT p.*, u.name AS seller_name
                  FROM product_listings p
                  INNER JOIN users u ON u.id = p.user_id';

        $conditions = [];
        $params = [];

        if ($myListings) {
            $user = $this->currentUserOrFail($request);
            $conditions[] = 'p.user_id = :user_id';
            $params['user_id'] = $user['id'];
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
            $conditions[] = '(p.title LIKE :q OR p.description LIKE :q)';
            $params['q'] = '%' . $q . '%';
        }

        if (!empty($conditions)) {
            $query .= ' WHERE ' . implode(' AND ', $conditions);
        }

        $query .= ' ORDER BY p.created_at DESC';

        $limit = (int) $request->getQuery('limit', 0);
        if ($limit > 0) {
            $query .= ' LIMIT ' . $limit;
        }

        $products = $this->db->fetchAll($query, $params);

        foreach ($products as &$product) {
            $product['id'] = (int) $product['id'];
            $product['user_id'] = (int) $product['user_id'];
            $product['price'] = (float) $product['price'];
            $product['stock'] = (int) ($product['stock_units'] ?? $product['stock'] ?? 0);
            $product['images'] = json_decode((string) ($product['images'] ?? '[]'), true);
        }

        return $this->json(200, ['products' => $products]);
    }

    public function get(Request $request, int $id): Response
    {
        $sql = 'SELECT p.*, u.name AS seller_name
                FROM product_listings p
                INNER JOIN users u ON u.id = p.user_id
                WHERE p.id = :id LIMIT 1';

        $product = $this->db->fetch($sql, ['id' => $id]);
        if (!$product) {
            return $this->error(404, 'Product listing not found.');
        }

        $product['id'] = (int) $product['id'];
        $product['user_id'] = (int) $product['user_id'];
        $product['price'] = (float) $product['price'];
        $product['stock'] = (int) ($product['stock_units'] ?? $product['stock'] ?? 0);
        $product['images'] = json_decode((string) ($product['images'] ?? '[]'), true);

        return $this->json(200, ['product' => $product]);
    }

    public function create(Request $request): Response
    {
        $user = $this->currentUserOrFail($request);
        if ($user['role'] !== 'product_seller' && $user['role'] !== 'admin') {
            return $this->error(403, 'Only approved product sellers can create product listings.');
        }

        $data = $request->getBody();
        $title = trim((string) ($data['title'] ?? ''));
        $category = trim((string) ($data['category'] ?? ''));
        $description = trim((string) ($data['description'] ?? ''));
        $price = (float) ($data['price'] ?? 0);
        $stock = (int) ($data['stock'] ?? 0);

        if ($title === '' || $category === '' || $description === '') {
            return $this->error(422, 'Title, category, and description are required.');
        }

        $images = [];
        $uploadedFile = $request->getFile('image');
        if ($uploadedFile && is_uploaded_file($uploadedFile['tmp_name'])) {
            try {
                $imageUrl = $this->storageService->upload($uploadedFile['tmp_name'], $uploadedFile['name']);
                $images[] = $imageUrl;
            } catch (Throwable $e) {
                return $this->error(500, 'Failed to upload image.', ['details' => $e->getMessage()]);
            }
        }

        if (empty($images) && isset($data['images']) && is_array($data['images'])) {
            $images = $data['images'];
        }

        $sql = 'INSERT INTO product_listings (user_id, title, category, description, price, stock, images, created_at, updated_at)
                VALUES (:user_id, :title, :category, :description, :price, :stock, :images, NOW(), NOW())';

        $this->db->query($sql, [
            'user_id' => $user['id'],
            'title' => $title,
            'category' => $category,
            'description' => $description,
            'price' => $price,
            'stock' => $stock,
            'images' => json_encode($images),
        ]);

        $id = (int) $this->db->lastInsertId();
        return $this->get($request, $id);
    }

    public function update(Request $request, int $id): Response
    {
        $user = $this->currentUserOrFail($request);
        $product = $this->db->fetch('SELECT * FROM product_listings WHERE id = :id LIMIT 1', ['id' => $id]);
        if (!$product) {
            return $this->error(404, 'Product listing not found.');
        }

        if ((int) $product['user_id'] !== (int) $user['id'] && $user['role'] !== 'admin') {
            return $this->error(403, 'Forbidden: You do not own this product.');
        }

        $data = $request->getBody();
        $title = trim((string) ($data['title'] ?? $product['title']));
        $category = trim((string) ($data['category'] ?? $product['category']));
        $description = trim((string) ($data['description'] ?? $product['description']));
        $price = isset($data['price']) ? (float) $data['price'] : (float) $product['price'];
        $stock = isset($data['stock']) ? (int) $data['stock'] : (int) ($product['stock_units'] ?? $product['stock'] ?? 0);

        $sql = 'UPDATE product_listings SET title = :title, category = :category, description = :description, price = :price, stock = :stock, updated_at = NOW() WHERE id = :id';
        $this->db->query($sql, [
            'id' => $id,
            'title' => $title,
            'category' => $category,
            'description' => $description,
            'price' => $price,
            'stock' => $stock,
        ]);

        return $this->get($request, $id);
    }

    public function delete(Request $request, int $id): Response
    {
        $user = $this->currentUserOrFail($request);
        $product = $this->db->fetch('SELECT * FROM product_listings WHERE id = :id LIMIT 1', ['id' => $id]);
        if (!$product) {
            return $this->error(404, 'Product listing not found.');
        }

        if ((int) $product['user_id'] !== (int) $user['id'] && $user['role'] !== 'admin') {
            return $this->error(403, 'Forbidden: You do not own this product.');
        }

        $this->db->query('DELETE FROM product_listings WHERE id = :id', ['id' => $id]);
        return $this->json(200, ['message' => 'Product deleted successfully.']);
    }

    public function createReview(Request $request, int $productId): Response
    {
        $user = $this->currentUserOrFail($request);
        $data = $request->getBody();

        $rating = (int) ($data['rating'] ?? 5);
        $comment = trim((string) ($data['comment'] ?? ''));

        if ($rating < 1 || $rating > 5) {
            return $this->error(422, 'Rating must be between 1 and 5.');
        }

        $sql = 'INSERT INTO product_reviews (product_id, user_id, rating, comment, created_at)
                VALUES (:product_id, :user_id, :rating, :comment, NOW())';

        $this->db->query($sql, [
            'product_id' => $productId,
            'user_id' => $user['id'],
            'rating' => $rating,
            'comment' => $comment,
        ]);

        return $this->json(201, ['message' => 'Review added successfully.']);
    }

    public function getReviews(Request $request, int $productId): Response
    {
        $sql = 'SELECT r.*, u.name as user_name
                FROM product_reviews r
                JOIN users u ON u.id = r.user_id
                WHERE r.product_id = :product_id
                ORDER BY r.created_at DESC';

        $reviews = $this->db->fetchAll($sql, ['product_id' => $productId]);
        return $this->json(200, ['reviews' => $reviews]);
    }
}
