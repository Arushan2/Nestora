<?php

declare(strict_types=1);

namespace Nestora\Controllers;

use Nestora\Core\Base\AbstractController;
use Nestora\Core\Http\Request;
use Nestora\Core\Http\Response;
use Nestora\Core\Services\CloudinaryStorageService;
use Throwable;

class ServiceListingController extends AbstractController
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
        $district = trim((string) $request->getQuery('district', ''));
        $userId = (int) $request->getQuery('user_id', 0);
        $q = trim((string) $request->getQuery('q', ''));
        $pricingType = trim((string) $request->getQuery('pricing_type', ''));

        $query = 'SELECT s.*, a.business_name, a.business_email, a.business_phone, a.business_address, a.business_city, u.name AS provider_name
                  FROM service_listings s
                  INNER JOIN users u ON u.id = s.user_id
                  LEFT JOIN pro_applications a ON a.user_id = s.user_id';

        $conditions = [];
        $params = [];

        if ($myListings) {
            $user = $this->currentUserOrFail($request);
            $conditions[] = 's.user_id = :user_id';
            $params['user_id'] = $user['id'];
        } elseif ($userId > 0) {
            $conditions[] = 's.user_id = :user_id';
            $params['user_id'] = $userId;
            $conditions[] = '(u.banned_until IS NULL OR u.banned_until <= NOW())';
        } else {
            $conditions[] = '(u.banned_until IS NULL OR u.banned_until <= NOW())';
        }

        if ($category !== '') {
            $conditions[] = 's.category = :category';
            $params['category'] = $category;
        }

        if ($pricingType !== '') {
            $conditions[] = 's.pricing_type = :pricing_type';
            $params['pricing_type'] = $pricingType;
        }

        if ($q !== '') {
            $conditions[] = '(s.title LIKE :q OR s.description LIKE :q)';
            $params['q'] = '%' . $q . '%';
        }

        if (!empty($conditions)) {
            $query .= ' WHERE ' . implode(' AND ', $conditions);
        }

        $query .= ' ORDER BY s.created_at DESC';

        $limit = (int) $request->getQuery('limit', 0);
        if ($limit > 0) {
            $query .= ' LIMIT ' . $limit;
        }

        $listings = $this->db->fetchAll($query, $params);

        if ($district !== '') {
            $listings = array_filter($listings, function ($listing) use ($district) {
                $cities = json_decode((string) ($listing['cities'] ?? '[]'), true);
                return is_array($cities) && in_array($district, $cities, true);
            });
            $listings = array_values($listings);
        }

        foreach ($listings as &$listing) {
            $listing['id'] = (int) $listing['id'];
            $listing['user_id'] = (int) $listing['user_id'];
            $listing['price'] = (float) $listing['price'];
            $listing['cities'] = json_decode((string) ($listing['cities'] ?? '[]'), true);
            $listing['images'] = json_decode((string) ($listing['images'] ?? '[]'), true);
            $listing['features'] = json_decode((string) ($listing['features'] ?? '[]'), true);
            $listing['packages'] = json_decode((string) ($listing['packages'] ?? '[]'), true);
        }

        return $this->json(200, ['listings' => $listings]);
    }

    public function get(Request $request, int $id): Response
    {
        $sql = 'SELECT s.*, a.business_name, a.business_email, a.business_phone, a.business_address, a.business_city, u.name AS provider_name
                FROM service_listings s
                INNER JOIN users u ON u.id = s.user_id
                LEFT JOIN pro_applications a ON a.user_id = s.user_id
                WHERE s.id = :id LIMIT 1';

        $listing = $this->db->fetch($sql, ['id' => $id]);
        if (!$listing) {
            return $this->error(404, 'Service listing not found.');
        }

        $listing['id'] = (int) $listing['id'];
        $listing['user_id'] = (int) $listing['user_id'];
        $listing['price'] = (float) $listing['price'];
        $listing['cities'] = json_decode((string) ($listing['cities'] ?? '[]'), true);
        $listing['images'] = json_decode((string) ($listing['images'] ?? '[]'), true);
        $listing['features'] = json_decode((string) ($listing['features'] ?? '[]'), true);
        $listing['packages'] = json_decode((string) ($listing['packages'] ?? '[]'), true);

        return $this->json(200, ['listing' => $listing]);
    }

    public function create(Request $request): Response
    {
        $user = $this->currentUserOrFail($request);
        if ($user['role'] !== 'service_provider' && $user['role'] !== 'admin') {
            return $this->error(403, 'Only approved service providers can create service listings.');
        }

        $data = $request->getBody();
        $title = trim((string) ($data['title'] ?? ''));
        $category = trim((string) ($data['category'] ?? ''));
        $description = trim((string) ($data['description'] ?? ''));
        $pricingType = trim((string) ($data['pricingType'] ?? 'fixed'));
        $price = (float) ($data['price'] ?? 0);

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

        $cities = is_array($data['cities'] ?? null) ? $data['cities'] : [];
        $features = is_array($data['features'] ?? null) ? $data['features'] : [];
        $packages = is_array($data['packages'] ?? null) ? $data['packages'] : [];

        $sql = 'INSERT INTO service_listings (user_id, title, category, description, pricing_type, price, cities, images, features, packages, created_at, updated_at)
                VALUES (:user_id, :title, :category, :description, :pricing_type, :price, :cities, :images, :features, :packages, NOW(), NOW())';

        $this->db->query($sql, [
            'user_id' => $user['id'],
            'title' => $title,
            'category' => $category,
            'description' => $description,
            'pricing_type' => $pricingType,
            'price' => $price,
            'cities' => json_encode($cities),
            'images' => json_encode($images),
            'features' => json_encode($features),
            'packages' => json_encode($packages),
        ]);

        $id = (int) $this->db->lastInsertId();
        return $this->get($request, $id);
    }

    public function update(Request $request, int $id): Response
    {
        $user = $this->currentUserOrFail($request);
        $listing = $this->db->fetch('SELECT * FROM service_listings WHERE id = :id LIMIT 1', ['id' => $id]);
        if (!$listing) {
            return $this->error(404, 'Service listing not found.');
        }

        if ((int) $listing['user_id'] !== (int) $user['id'] && $user['role'] !== 'admin') {
            return $this->error(403, 'Forbidden: You do not own this listing.');
        }

        $data = $request->getBody();
        $title = trim((string) ($data['title'] ?? $listing['title']));
        $category = trim((string) ($data['category'] ?? $listing['category']));
        $description = trim((string) ($data['description'] ?? $listing['description']));
        $pricingType = trim((string) ($data['pricingType'] ?? $listing['pricing_type']));
        $price = isset($data['price']) ? (float) $data['price'] : (float) $listing['price'];

        $sql = 'UPDATE service_listings SET title = :title, category = :category, description = :description, pricing_type = :pricing_type, price = :price, updated_at = NOW() WHERE id = :id';
        $this->db->query($sql, [
            'id' => $id,
            'title' => $title,
            'category' => $category,
            'description' => $description,
            'pricing_type' => $pricingType,
            'price' => $price,
        ]);

        return $this->get($request, $id);
    }

    public function delete(Request $request, int $id): Response
    {
        $user = $this->currentUserOrFail($request);
        $listing = $this->db->fetch('SELECT * FROM service_listings WHERE id = :id LIMIT 1', ['id' => $id]);
        if (!$listing) {
            return $this->error(404, 'Service listing not found.');
        }

        if ((int) $listing['user_id'] !== (int) $user['id'] && $user['role'] !== 'admin') {
            return $this->error(403, 'Forbidden: You do not own this listing.');
        }

        $this->db->query('DELETE FROM service_listings WHERE id = :id', ['id' => $id]);
        return $this->json(200, ['message' => 'Service listing deleted successfully.']);
    }
}
