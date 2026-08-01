<?php

declare(strict_types=1);

namespace Nestora\Controllers;

use Nestora\Core\Base\AbstractController;
use Nestora\Core\Http\Request;
use Nestora\Core\Http\Response;
use Nestora\Repositories\InquiryRepository;

class InquiryController extends AbstractController
{
    private InquiryRepository $inquiryRepository;

    public function __construct()
    {
        parent::__construct();
        $this->inquiryRepository = new InquiryRepository();
    }

    public function create(Request $request): Response
    {
        $user = $this->currentUserOrFail($request);
        $data = $request->getBody();

        $serviceId = (int) ($data['serviceId'] ?? 0);
        $message = trim((string) ($data['message'] ?? ''));
        $preferredDate = trim((string) ($data['preferredDate'] ?? ''));

        if ($serviceId <= 0 || $message === '') {
            return $this->error(422, 'Service ID and message are required.');
        }

        $service = $this->db->fetch('SELECT * FROM service_listings WHERE id = :id LIMIT 1', ['id' => $serviceId]);
        if (!$service) {
            return $this->error(404, 'Service listing not found.');
        }

        $sql = 'INSERT INTO service_inquiries (service_id, customer_id, provider_id, message, preferred_date, status, created_at, updated_at)
                VALUES (:service_id, :customer_id, :provider_id, :message, :preferred_date, "pending", NOW(), NOW())';

        $this->db->query($sql, [
            'service_id' => $serviceId,
            'customer_id' => $user['id'],
            'provider_id' => $service['user_id'],
            'message' => $message,
            'preferred_date' => $preferredDate ?: null,
        ]);

        $id = (int) $this->db->lastInsertId();
        $inquiry = $this->db->fetch('SELECT * FROM service_inquiries WHERE id = :id LIMIT 1', ['id' => $id]);

        return $this->json(201, ['inquiry' => $inquiry, 'message' => 'Inquiry sent successfully.']);
    }

    public function list(Request $request): Response
    {
        $user = $this->currentUserOrFail($request);

        $sql = 'SELECT i.*, s.title as service_title, c.name as customer_name, p.name as provider_name
                FROM service_inquiries i
                JOIN service_listings s ON s.id = i.service_id
                JOIN users c ON c.id = i.customer_id
                JOIN users p ON p.id = i.provider_id
                WHERE i.customer_id = :uid OR i.provider_id = :uid
                ORDER BY i.created_at DESC';

        $inquiries = $this->db->fetchAll($sql, ['uid' => $user['id']]);
        return $this->json(200, ['inquiries' => $inquiries]);
    }

    public function get(Request $request, int $id): Response
    {
        $user = $this->currentUserOrFail($request);

        $sql = 'SELECT i.*, s.title as service_title, c.name as customer_name, p.name as provider_name
                FROM service_inquiries i
                JOIN service_listings s ON s.id = i.service_id
                JOIN users c ON c.id = i.customer_id
                JOIN users p ON p.id = i.provider_id
                WHERE i.id = :id LIMIT 1';

        $inquiry = $this->db->fetch($sql, ['id' => $id]);

        if (!$inquiry) {
            return $this->error(404, 'Inquiry not found.');
        }

        if ((int) $inquiry['customer_id'] !== (int) $user['id'] && (int) $inquiry['provider_id'] !== (int) $user['id'] && $user['role'] !== 'admin') {
            return $this->error(403, 'Forbidden access.');
        }

        return $this->json(200, ['inquiry' => $inquiry]);
    }
}
