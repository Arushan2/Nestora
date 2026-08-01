<?php

declare(strict_types=1);

namespace Nestora\Controllers;

use Nestora\Core\Base\AbstractController;
use Nestora\Core\Http\Request;
use Nestora\Core\Http\Response;

class ProfileController extends AbstractController
{
    public function list(Request $request): Response
    {
        $profiles = $this->db->fetchAll('
            SELECT u.id, u.name, u.email, u.role, u.avatar_url, p.business_name, p.business_city, p.business_description
            FROM users u
            LEFT JOIN pro_applications p ON p.user_id = u.id AND p.status = "approved"
            WHERE u.role IN ("service_provider", "product_seller")
        ');

        return $this->json(200, ['profiles' => $profiles]);
    }

    public function get(Request $request, int $id): Response
    {
        $profile = $this->db->fetch('
            SELECT u.id, u.name, u.email, u.role, u.avatar_url, p.business_name, p.business_email, p.business_phone, p.business_address, p.business_city, p.business_description
            FROM users u
            LEFT JOIN pro_applications p ON p.user_id = u.id
            WHERE u.id = :id LIMIT 1
        ', ['id' => $id]);

        if (!$profile) {
            return $this->error(404, 'Profile not found.');
        }

        return $this->json(200, ['profile' => $profile]);
    }

    public function update(Request $request): Response
    {
        $user = $this->currentUserOrFail($request);
        $body = $request->getBody();

        $fullName = trim((string) ($body['name'] ?? $body['full_name'] ?? $user['name']));
        $phone = trim((string) ($body['phone'] ?? $user['phone'] ?? ''));

        $this->db->query('UPDATE users SET name = :fn, phone = :phone WHERE id = :id', [
            'fn' => $fullName,
            'phone' => $phone,
            'id' => $user['id']
        ]);

        return $this->json(200, ['message' => 'Profile updated successfully.']);
    }
}
