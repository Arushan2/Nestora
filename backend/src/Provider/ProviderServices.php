<?php

declare(strict_types=1);

namespace Nestora\Provider;

use PDO;
use RuntimeException;
use Throwable;

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * OOP Concept 3 & 4: INHERITANCE & POLYMORPHISM
 * Repositories, Polymorphic Calendar Strategies, Domain Services & Provider Controller.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Concrete PDO implementation of ServiceListingRepositoryInterface.
 */
class PdoServiceListingRepository implements ServiceListingRepositoryInterface
{
    private PDO $db;

    public function __construct(?PDO $db = null)
    {
        $this->db = $db ?? database();
    }

    public function findById(int $id): ?ServiceListing
    {
        $query = 'SELECT s.*, a.business_name, a.business_email, a.business_phone, a.business_address, a.business_city, u.name AS provider_name
                  FROM service_listings s
                  INNER JOIN users u ON u.id = s.user_id
                  LEFT JOIN pro_applications a ON a.user_id = s.user_id
                  WHERE s.id = :id';

        $stmt = $this->db->prepare($query);
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();

        return is_array($row) ? new ServiceListing($row) : null;
    }

    public function findAll(array $filters): array
    {
        $myListings = ($filters['my_listings'] ?? '') === 'true';
        $category = trim((string) ($filters['category'] ?? ''));
        $district = trim((string) ($filters['district'] ?? ''));
        $userId = (int) ($filters['user_id'] ?? 0);
        $currentUserId = (int) ($filters['current_user_id'] ?? 0);
        $pricingType = trim((string) ($filters['pricing_type'] ?? ''));
        $q = trim((string) ($filters['q'] ?? ''));
        $limit = (int) ($filters['limit'] ?? 0);

        $query = 'SELECT s.*, a.business_name, a.business_email, a.business_phone, a.business_address, a.business_city, u.name AS provider_name
                  FROM service_listings s
                  INNER JOIN users u ON u.id = s.user_id
                  LEFT JOIN pro_applications a ON a.user_id = s.user_id';

        $conditions = [];
        $params = [];

        if ($myListings && $currentUserId > 0) {
            $conditions[] = 's.user_id = :user_id';
            $params['user_id'] = $currentUserId;
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

        if ($conditions !== []) {
            $query .= ' WHERE ' . implode(' AND ', $conditions);
        }

        $query .= ' ORDER BY s.created_at DESC';

        if ($limit > 0) {
            $query .= ' LIMIT ' . $limit;
        }

        $stmt = $this->db->prepare($query);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        $listings = [];
        foreach ($rows as $row) {
            $listing = new ServiceListing($row);
            if ($district !== '' && !$listing->servesCity($district)) {
                continue;
            }
            $listings[] = $listing;
        }

        return $listings;
    }

    public function create(int $userId, CreateServiceDTO $dto): ServiceListing
    {
        $stmt = $this->db->prepare(
            'INSERT INTO service_listings (user_id, title, category, description, price, pricing_type, cities, images, created_at, updated_at)
             VALUES (:user_id, :title, :category, :description, :price, :pricing_type, :cities, :images, NOW(), NOW())'
        );

        $stmt->execute([
            'user_id' => $userId,
            'title' => $dto->getTitle(),
            'category' => $dto->getCategory(),
            'description' => $dto->getDescription(),
            'price' => $dto->getPrice(),
            'pricing_type' => $dto->getPricingType(),
            'cities' => json_encode($dto->getCities()),
            'images' => json_encode($dto->getPortfolioImages()),
        ]);

        $id = (int) $this->db->lastInsertId();
        $listing = $this->findById($id);

        if ($listing === null) {
            throw new RuntimeException('Failed to load created service listing.');
        }

        return $listing;
    }

    public function update(int $id, UpdateServiceDTO $dto): bool
    {
        $stmt = $this->db->prepare(
            'UPDATE service_listings
             SET title = :title, category = :category, description = :description, price = :price,
                 pricing_type = :pricing_type, cities = :cities, images = :images, updated_at = NOW()
             WHERE id = :id'
        );

        return $stmt->execute([
            'title' => $dto->getTitle(),
            'category' => $dto->getCategory(),
            'description' => $dto->getDescription(),
            'price' => $dto->getPrice(),
            'pricing_type' => $dto->getPricingType(),
            'cities' => json_encode($dto->getCities()),
            'images' => json_encode($dto->getPortfolioImages()),
            'id' => $id,
        ]);
    }

    public function delete(int $id): bool
    {
        $stmt = $this->db->prepare('DELETE FROM service_listings WHERE id = :id');
        return $stmt->execute(['id' => $id]);
    }
}

/**
 * Concrete PDO implementation of ServiceInquiryRepositoryInterface.
 */
class PdoServiceInquiryRepository implements ServiceInquiryRepositoryInterface
{
    private PDO $db;

    public function __construct(?PDO $db = null)
    {
        $this->db = $db ?? database();
    }

    public function findById(int $id): ?ServiceInquiry
    {
        $query = 'SELECT i.*, 
                         s.title AS service_title,
                         c.name AS customer_name, c.email AS customer_email,
                         p.name AS provider_name, p.email AS provider_email
                  FROM service_inquiries i
                  INNER JOIN service_listings s ON s.id = i.service_id
                  INNER JOIN users c ON c.id = i.customer_id
                  INNER JOIN users p ON p.id = i.provider_id
                  WHERE i.id = :id LIMIT 1';

        $stmt = $this->db->prepare($query);
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();

        return is_array($row) ? new ServiceInquiry($row) : null;
    }

    public function findAllForUser(int $userId, ?string $status = null): array
    {
        $query = 'SELECT i.*, 
                         s.title AS service_title,
                         c.name AS customer_name, c.email AS customer_email,
                         p.name AS provider_name, p.email AS provider_email
                  FROM service_inquiries i
                  INNER JOIN service_listings s ON s.id = i.service_id
                  INNER JOIN users c ON c.id = i.customer_id
                  INNER JOIN users p ON p.id = i.provider_id
                  WHERE (i.customer_id = :user_id OR i.provider_id = :user_id)';

        $params = ['user_id' => $userId];

        if ($status !== null && $status !== '') {
            $query .= ' AND i.status = :status';
            $params['status'] = $status;
        }

        $query .= ' ORDER BY i.created_at DESC';

        $stmt = $this->db->prepare($query);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        return array_map(fn($r) => new ServiceInquiry($r), $rows);
    }

    public function updateStatus(int $id, string $status): bool
    {
        $stmt = $this->db->prepare('UPDATE service_inquiries SET status = :status, updated_at = NOW() WHERE id = :id');
        return $stmt->execute(['status' => $status, 'id' => $id]);
    }

    public function saveOffer(int $id, float $price, string $notes): bool
    {
        $stmt = $this->db->prepare('
            UPDATE service_inquiries 
            SET status = "offer_sent", offer_price = :price, offer_notes = :notes, offer_sent_at = NOW(), updated_at = NOW()
            WHERE id = :id
        ');
        return $stmt->execute(['price' => $price, 'notes' => $notes, 'id' => $id]);
    }

    public function addFollowup(int $inquiryId, int $senderId, string $type, string $content, array $images = []): int
    {
        $stmt = $this->db->prepare('
            INSERT INTO inquiry_followups (inquiry_id, sender_id, type, content, images, created_at)
            VALUES (:inquiry_id, :sender_id, :type, :content, :images, NOW())
        ');
        $stmt->execute([
            'inquiry_id' => $inquiryId,
            'sender_id' => $senderId,
            'type' => $type,
            'content' => $content,
            'images' => !empty($images) ? json_encode($images) : null,
        ]);

        return (int) $this->db->lastInsertId();
    }

    public function getFollowups(int $inquiryId): array
    {
        $stmt = $this->db->prepare('
            SELECT f.*, u.name AS sender_name, u.role AS sender_role
            FROM inquiry_followups f
            INNER JOIN users u ON u.id = f.sender_id
            WHERE f.inquiry_id = :inquiry_id
            ORDER BY f.created_at ASC
        ');
        $stmt->execute(['inquiry_id' => $inquiryId]);
        $rows = $stmt->fetchAll();

        foreach ($rows as &$r) {
            if (!empty($r['images'])) {
                $r['images'] = json_decode((string) $r['images'], true);
            }
        }

        return $rows;
    }
}

/**
 * Concrete PDO implementation of ProviderScheduleRepositoryInterface.
 */
class PdoProviderScheduleRepository implements ProviderScheduleRepositoryInterface
{
    private PDO $db;

    public function __construct(?PDO $db = null)
    {
        $this->db = $db ?? database();
    }

    public function findByProviderId(int $providerId): array
    {
        // 1. Teams count
        $stmt = $this->db->prepare('SELECT teams_count FROM pro_applications WHERE user_id = :user_id LIMIT 1');
        $stmt->execute(['user_id' => $providerId]);
        $app = $stmt->fetch();
        $teamsCount = $app ? (int) $app['teams_count'] : 1;

        // 2. Active inquiries booking slots
        $stmt = $this->db->prepare('
            SELECT id, booking_date, status, customer_id 
            FROM service_inquiries 
            WHERE provider_id = :provider_id AND booking_date IS NOT NULL AND status != "completed"
        ');
        $stmt->execute(['provider_id' => $providerId]);
        $inquiries = $stmt->fetchAll();

        // 3. Manual schedule overrides
        $stmt = $this->db->prepare('
            SELECT id, provider_id, event_date, type, notes, google_event_id 
            FROM provider_schedules 
            WHERE provider_id = :provider_id
        ');
        $stmt->execute(['provider_id' => $providerId]);
        $schedules = $stmt->fetchAll();

        return [
            'teams_count' => $teamsCount,
            'inquiries' => $inquiries,
            'schedules' => $schedules,
        ];
    }

    public function saveBlock(int $providerId, string $eventDate, string $type, ?string $notes, ?string $googleEventId = null): bool
    {
        $stmt = $this->db->prepare('
            INSERT INTO provider_schedules (provider_id, event_date, type, notes, google_event_id)
            VALUES (:provider_id, :event_date, :type, :notes, :google_event_id)
            ON DUPLICATE KEY UPDATE notes = :notes_update, google_event_id = COALESCE(:google_event_id_update, google_event_id)
        ');

        return $stmt->execute([
            'provider_id' => $providerId,
            'event_date' => $eventDate,
            'type' => $type,
            'notes' => $notes,
            'google_event_id' => $googleEventId,
            'notes_update' => $notes,
            'google_event_id_update' => $googleEventId,
        ]);
    }

    public function deleteBlock(int $providerId, string $eventDate, string $type): ?string
    {
        $checkStmt = $this->db->prepare('SELECT google_event_id FROM provider_schedules WHERE provider_id = :provider_id AND event_date = :date AND type = :type');
        $checkStmt->execute(['provider_id' => $providerId, 'date' => $eventDate, 'type' => $type]);
        $existing = $checkStmt->fetch();
        $googleEventId = $existing ? (string) $existing['google_event_id'] : null;

        $stmt = $this->db->prepare('DELETE FROM provider_schedules WHERE provider_id = :provider_id AND event_date = :date AND type = :type');
        $stmt->execute(['provider_id' => $providerId, 'date' => $eventDate, 'type' => $type]);

        return $googleEventId;
    }

    public function updateTeamsCount(int $providerId, int $teamsCount): bool
    {
        $stmt = $this->db->prepare('UPDATE pro_applications SET teams_count = :teams WHERE user_id = :user_id');
        return $stmt->execute(['teams' => $teamsCount, 'user_id' => $providerId]);
    }
}

/**
 * Polymorphic Calendar Strategy 1: Google Calendar OAuth synchronization.
 */
class GoogleCalendarSyncStrategy implements CalendarSyncStrategyInterface
{
    public function syncBlock(int $providerId, string $title, string $eventDate, string $description, ?string $existingEventId = null): ?string
    {
        if (function_exists('syncEventToGoogle')) {
            try {
                return syncEventToGoogle($providerId, $title, $eventDate, $description, $existingEventId);
            } catch (Throwable $e) {
                return null;
            }
        }
        return null;
    }

    public function removeBlock(int $providerId, string $googleEventId): void
    {
        if (function_exists('deleteEventFromGoogle') && $googleEventId !== '') {
            try {
                deleteEventFromGoogle($providerId, $googleEventId);
            } catch (Throwable $e) {
                // Handled gracefully
            }
        }
    }
}

/**
 * Polymorphic Calendar Strategy 2: Local Database Calendar synchronization.
 */
class LocalCalendarSyncStrategy implements CalendarSyncStrategyInterface
{
    public function syncBlock(int $providerId, string $title, string $eventDate, string $description, ?string $existingEventId = null): ?string
    {
        return 'LOCAL-SYNC-' . md5($providerId . $eventDate);
    }

    public function removeBlock(int $providerId, string $googleEventId): void
    {
        // No-op for local database sync
    }
}

/**
 * Abstract Base Service Provider Service (Inheritance).
 */
abstract class AbstractProviderService
{
    protected function ensureProviderAccess(array $user): void
    {
        $role = $user['role'] ?? '';
        if ($role !== 'service_provider' && $role !== 'admin') {
            throw new UnauthorizedProviderException('Access denied. Service providers only.');
        }
    }

    protected function ensureServiceOwnership(ServiceListing $service, array $user): void
    {
        $userId = (int) ($user['id'] ?? 0);
        $role = $user['role'] ?? '';

        if (!$service->isOwnedBy($userId) && $role !== 'admin') {
            throw new UnauthorizedProviderException('You do not have permission to modify this service listing.');
        }
    }
}

/**
 * Service Provider Service implementing ServiceProviderServiceInterface.
 */
class ServiceProviderService extends AbstractProviderService implements ServiceProviderServiceInterface
{
    private ServiceListingRepositoryInterface $serviceRepository;

    public function __construct(?ServiceListingRepositoryInterface $serviceRepository = null)
    {
        $this->serviceRepository = $serviceRepository ?? new PdoServiceListingRepository();
    }

    public function listServices(array $filters): array
    {
        $listings = $this->serviceRepository->findAll($filters);
        return array_map(fn(ServiceListing $s) => $s->toArray(), $listings);
    }

    public function getService(int $id): ServiceListing
    {
        $service = $this->serviceRepository->findById($id);
        if ($service === null) {
            throw new ServiceNotFoundException('Service listing not found.');
        }
        return $service;
    }

    public function createService(array $user, CreateServiceDTO $dto): array
    {
        $this->ensureProviderAccess($user);
        $service = $this->serviceRepository->create((int) $user['id'], $dto);

        return [
            'message' => 'Service listing created successfully.',
            'listing' => $service->toArray(),
        ];
    }

    public function updateService(int $serviceId, array $user, UpdateServiceDTO $dto): array
    {
        $service = $this->getService($serviceId);
        $this->ensureServiceOwnership($service, $user);

        $this->serviceRepository->update($serviceId, $dto);

        return ['message' => 'Service listing updated successfully.'];
    }

    public function deleteService(int $serviceId, array $user): array
    {
        $service = $this->getService($serviceId);
        $this->ensureServiceOwnership($service, $user);

        $this->serviceRepository->delete($serviceId);

        return ['message' => 'Service listing deleted successfully.'];
    }
}

/**
 * Provider Inquiry Service implementing ProviderInquiryServiceInterface.
 */
class ProviderInquiryService extends AbstractProviderService implements ProviderInquiryServiceInterface
{
    private ServiceInquiryRepositoryInterface $inquiryRepository;

    public function __construct(?ServiceInquiryRepositoryInterface $inquiryRepository = null)
    {
        $this->inquiryRepository = $inquiryRepository ?? new PdoServiceInquiryRepository();
    }

    public function listInquiries(array $user, ?string $status = null): array
    {
        $userId = (int) ($user['id'] ?? 0);
        $inquiries = $this->inquiryRepository->findAllForUser($userId, $status);

        return array_map(fn(ServiceInquiry $i) => $i->toArray(), $inquiries);
    }

    public function getInquiry(int $id, array $user): array
    {
        $inquiry = $this->inquiryRepository->findById($id);
        if ($inquiry === null) {
            throw new InquiryNotFoundException('Inquiry not found.');
        }

        $userId = (int) ($user['id'] ?? 0);
        if ($inquiry->getCustomerId() !== $userId && $inquiry->getProviderId() !== $userId && ($user['role'] ?? '') !== 'admin') {
            throw new UnauthorizedProviderException('Unauthorized access to inquiry.');
        }

        $followups = $this->inquiryRepository->getFollowups($id);

        return [
            'inquiry' => $inquiry->toArray(),
            'followups' => $followups,
        ];
    }

    public function requestDetails(int $id, array $user, string $content): array
    {
        $this->ensureProviderAccess($user);

        $inquiry = $this->inquiryRepository->findById($id);
        if ($inquiry === null) {
            throw new InquiryNotFoundException('Inquiry not found.');
        }

        if ($inquiry->getProviderId() !== (int) $user['id']) {
            throw new UnauthorizedProviderException('Only the service provider can request details.');
        }

        $trimmed = trim($content);
        if ($trimmed === '') {
            throw new ProviderValidationException('Please provide specific questions/details requested.');
        }

        $this->inquiryRepository->updateStatus($id, 'details_requested');
        $this->inquiryRepository->addFollowup($id, (int) $user['id'], 'details_requested', $trimmed);

        if (function_exists('createNotification')) {
            createNotification(
                $inquiry->getCustomerId(),
                'Details Requested',
                "Service provider has requested additional details for your inquiry.",
                '/inquiries'
            );
        }

        return ['message' => 'Details requested. Status updated.'];
    }

    public function sendOffer(int $id, array $user, SendOfferDTO $dto): array
    {
        $this->ensureProviderAccess($user);

        $inquiry = $this->inquiryRepository->findById($id);
        if ($inquiry === null) {
            throw new InquiryNotFoundException('Inquiry not found.');
        }

        if ($inquiry->getProviderId() !== (int) $user['id']) {
            throw new UnauthorizedProviderException('Only the service provider can send an offer.');
        }

        if (!$inquiry->canSendOffer()) {
            throw new InvalidInquiryStateException('Cannot send offer in current inquiry status.');
        }

        $this->inquiryRepository->saveOffer($id, $dto->getOfferPrice(), $dto->getOfferNotes());

        $content = "Official Offer: LKR " . number_format($dto->getOfferPrice(), 2) . "\nNotes/Scope: " . $dto->getOfferNotes();
        $this->inquiryRepository->addFollowup($id, (int) $user['id'], 'offer_sent', $content);

        if (function_exists('createNotification')) {
            createNotification(
                $inquiry->getCustomerId(),
                'Offer Received',
                "You have received an official offer of LKR " . number_format($dto->getOfferPrice(), 2) . " for your service inquiry.",
                '/inquiries'
            );
        }

        return ['message' => 'Offer sent to client successfully.'];
    }

    public function completeWork(int $id, array $user, array $proofImages): array
    {
        $this->ensureProviderAccess($user);

        $inquiry = $this->inquiryRepository->findById($id);
        if ($inquiry === null) {
            throw new InquiryNotFoundException('Inquiry not found.');
        }

        if ($inquiry->getProviderId() !== (int) $user['id']) {
            throw new UnauthorizedProviderException('Only the assigned service provider can complete this work.');
        }

        if (!$inquiry->canCompleteWork()) {
            throw new InvalidInquiryStateException('Work cannot be marked complete unless the project is accepted.');
        }

        $this->inquiryRepository->updateStatus($id, 'work_completed');
        $this->inquiryRepository->addFollowup(
            $id,
            (int) $user['id'],
            'work_completed',
            'Service provider has marked the project as complete. Please inspect and confirm.',
            $proofImages
        );

        if (function_exists('createNotification')) {
            createNotification(
                $inquiry->getCustomerId(),
                'Work Completed',
                "Service provider has finished the work. Please review and confirm completion.",
                '/inquiries'
            );
        }

        return ['message' => 'Work marked as completed. Awaiting client confirmation.'];
    }
}

/**
 * Provider Schedule Service implementing ProviderScheduleServiceInterface.
 */
class ProviderScheduleService extends AbstractProviderService implements ProviderScheduleServiceInterface
{
    private ProviderScheduleRepositoryInterface $scheduleRepository;
    private CalendarSyncStrategyInterface $calendarStrategy;

    public function __construct(
        ?ProviderScheduleRepositoryInterface $scheduleRepository = null,
        ?CalendarSyncStrategyInterface $calendarStrategy = null
    ) {
        $this->scheduleRepository = $scheduleRepository ?? new PdoProviderScheduleRepository();
        $this->calendarStrategy = $calendarStrategy ?? new GoogleCalendarSyncStrategy();
    }

    public function getSchedule(int $providerId): array
    {
        return $this->scheduleRepository->findByProviderId($providerId);
    }

    public function blockDate(array $user, BlockDateDTO $dto): array
    {
        $this->ensureProviderAccess($user);
        $providerId = (int) $user['id'];

        $title = $dto->getType() === 'leave' ? 'Nestora Block: Leave Day' : 'Nestora Block: Manual Work Booking';
        $desc = $dto->getNotes() ?? ($dto->getType() === 'leave' ? 'Provider is on leave / out of office.' : 'Manual work slot booked on Nestora.');

        // Polymorphic calendar synchronization
        $googleEventId = $this->calendarStrategy->syncBlock($providerId, $title, $dto->getEventDate(), $desc);

        $this->scheduleRepository->saveBlock($providerId, $dto->getEventDate(), $dto->getType(), $dto->getNotes(), $googleEventId);

        return [
            'message' => 'Date successfully blocked.',
            'google_synced' => $googleEventId !== null,
        ];
    }

    public function unblockDate(array $user, string $eventDate, string $type): array
    {
        $this->ensureProviderAccess($user);
        $providerId = (int) $user['id'];

        $googleEventId = $this->scheduleRepository->deleteBlock($providerId, $eventDate, $type);
        if ($googleEventId !== null && $googleEventId !== '') {
            $this->calendarStrategy->removeBlock($providerId, $googleEventId);
        }

        return ['message' => 'Date block removed successfully.'];
    }

    public function updateTeamsCount(array $user, int $teamsCount): array
    {
        $this->ensureProviderAccess($user);

        if ($teamsCount < 1) {
            throw new ProviderValidationException('Teams count must be at least 1.');
        }

        $this->scheduleRepository->updateTeamsCount((int) $user['id'], $teamsCount);

        return [
            'message' => 'Teams capacity updated successfully.',
            'teams_count' => $teamsCount,
        ];
    }
}

/**
 * Primary Controller coordinating Service Provider operations.
 */
class ProviderController
{
    private ServiceProviderServiceInterface $serviceService;
    private ProviderInquiryServiceInterface $inquiryService;
    private ProviderScheduleServiceInterface $scheduleService;

    public function __construct(
        ?ServiceProviderServiceInterface $serviceService = null,
        ?ProviderInquiryServiceInterface $inquiryService = null,
        ?ProviderScheduleServiceInterface $scheduleService = null
    ) {
        $this->serviceService = $serviceService ?? new ServiceProviderService();
        $this->inquiryService = $inquiryService ?? new ProviderInquiryService();
        $this->scheduleService = $scheduleService ?? new ProviderScheduleService();
    }

    public function handleListServices(array $queryParams): void
    {
        try {
            $user = function_exists('currentUser') ? currentUser() : null;
            $queryParams['current_user_id'] = $user['id'] ?? 0;

            $listings = $this->serviceService->listServices($queryParams);
            $this->jsonResponse(200, ['listings' => $listings]);
        } catch (ProviderException $e) {
            $this->jsonResponse($e->getStatusCode(), array_merge(['message' => $e->getMessage()], $e->getData()));
        } catch (Throwable $e) {
            $this->jsonResponse(500, ['message' => $e->getMessage()]);
        }
    }

    public function handleGetService(int $id): void
    {
        try {
            $service = $this->serviceService->getService($id);
            $this->jsonResponse(200, ['listing' => $service->toArray()]);
        } catch (ProviderException $e) {
            $this->jsonResponse($e->getStatusCode(), array_merge(['message' => $e->getMessage()], $e->getData()));
        } catch (Throwable $e) {
            $this->jsonResponse(500, ['message' => $e->getMessage()]);
        }
    }

    public function handleCreateService(array $postData, array $uploadedImages): void
    {
        try {
            $user = currentUserOrFail();
            $dto = new CreateServiceDTO($postData, $uploadedImages);
            $response = $this->serviceService->createService($user, $dto);
            $this->jsonResponse(201, $response);
        } catch (ProviderException $e) {
            $this->jsonResponse($e->getStatusCode(), array_merge(['message' => $e->getMessage()], $e->getData()));
        } catch (Throwable $e) {
            $this->jsonResponse(500, ['message' => $e->getMessage()]);
        }
    }

    public function handleUpdateService(int $id, array $postData, array $existingImages, array $newUploadedImages): void
    {
        try {
            $user = currentUserOrFail();
            $dto = new UpdateServiceDTO($postData, $existingImages, $newUploadedImages);
            $response = $this->serviceService->updateService($id, $user, $dto);
            $this->jsonResponse(200, $response);
        } catch (ProviderException $e) {
            $this->jsonResponse($e->getStatusCode(), array_merge(['message' => $e->getMessage()], $e->getData()));
        } catch (Throwable $e) {
            $this->jsonResponse(500, ['message' => $e->getMessage()]);
        }
    }

    public function handleDeleteService(int $id): void
    {
        try {
            $user = currentUserOrFail();
            $response = $this->serviceService->deleteService($id, $user);
            $this->jsonResponse(200, $response);
        } catch (ProviderException $e) {
            $this->jsonResponse($e->getStatusCode(), array_merge(['message' => $e->getMessage()], $e->getData()));
        } catch (Throwable $e) {
            $this->jsonResponse(500, ['message' => $e->getMessage()]);
        }
    }

    public function handleListInquiries(?string $status = null): void
    {
        try {
            $user = currentUserOrFail();
            $inquiries = $this->inquiryService->listInquiries($user, $status);
            $this->jsonResponse(200, ['inquiries' => $inquiries]);
        } catch (ProviderException $e) {
            $this->jsonResponse($e->getStatusCode(), array_merge(['message' => $e->getMessage()], $e->getData()));
        } catch (Throwable $e) {
            $this->jsonResponse(500, ['message' => $e->getMessage()]);
        }
    }

    public function handleGetInquiry(int $id): void
    {
        try {
            $user = currentUserOrFail();
            $response = $this->inquiryService->getInquiry($id, $user);
            $this->jsonResponse(200, $response);
        } catch (ProviderException $e) {
            $this->jsonResponse($e->getStatusCode(), array_merge(['message' => $e->getMessage()], $e->getData()));
        } catch (Throwable $e) {
            $this->jsonResponse(500, ['message' => $e->getMessage()]);
        }
    }

    public function handleRequestDetails(int $id, array $inputData): void
    {
        try {
            $user = currentUserOrFail();
            $content = (string) ($inputData['content'] ?? '');
            $response = $this->inquiryService->requestDetails($id, $user, $content);
            $this->jsonResponse(200, $response);
        } catch (ProviderException $e) {
            $this->jsonResponse($e->getStatusCode(), array_merge(['message' => $e->getMessage()], $e->getData()));
        } catch (Throwable $e) {
            $this->jsonResponse(500, ['message' => $e->getMessage()]);
        }
    }

    public function handleSendOffer(int $id, array $inputData): void
    {
        try {
            $user = currentUserOrFail();
            $dto = new SendOfferDTO($inputData);
            $response = $this->inquiryService->sendOffer($id, $user, $dto);
            $this->jsonResponse(200, $response);
        } catch (ProviderException $e) {
            $this->jsonResponse($e->getStatusCode(), array_merge(['message' => $e->getMessage()], $e->getData()));
        } catch (Throwable $e) {
            $this->jsonResponse(500, ['message' => $e->getMessage()]);
        }
    }

    public function handleCompleteWork(int $id, array $proofImages): void
    {
        try {
            $user = currentUserOrFail();
            $response = $this->inquiryService->completeWork($id, $user, $proofImages);
            $this->jsonResponse(200, $response);
        } catch (ProviderException $e) {
            $this->jsonResponse($e->getStatusCode(), array_merge(['message' => $e->getMessage()], $e->getData()));
        } catch (Throwable $e) {
            $this->jsonResponse(500, ['message' => $e->getMessage()]);
        }
    }

    public function handleGetSchedule(int $providerId): void
    {
        try {
            $schedule = $this->scheduleService->getSchedule($providerId);
            $this->jsonResponse(200, $schedule);
        } catch (ProviderException $e) {
            $this->jsonResponse($e->getStatusCode(), array_merge(['message' => $e->getMessage()], $e->getData()));
        } catch (Throwable $e) {
            $this->jsonResponse(500, ['message' => $e->getMessage()]);
        }
    }

    public function handleBlockDate(array $inputData): void
    {
        try {
            $user = currentUserOrFail();
            $dto = new BlockDateDTO($inputData);
            $response = $this->scheduleService->blockDate($user, $dto);
            $this->jsonResponse(200, $response);
        } catch (ProviderException $e) {
            $this->jsonResponse($e->getStatusCode(), array_merge(['message' => $e->getMessage()], $e->getData()));
        } catch (Throwable $e) {
            $this->jsonResponse(500, ['message' => $e->getMessage()]);
        }
    }

    public function handleUnblockDate(array $inputData): void
    {
        try {
            $user = currentUserOrFail();
            $eventDate = trim((string) ($inputData['event_date'] ?? ''));
            $type = trim((string) ($inputData['type'] ?? ''));
            $response = $this->scheduleService->unblockDate($user, $eventDate, $type);
            $this->jsonResponse(200, $response);
        } catch (ProviderException $e) {
            $this->jsonResponse($e->getStatusCode(), array_merge(['message' => $e->getMessage()], $e->getData()));
        } catch (Throwable $e) {
            $this->jsonResponse(500, ['message' => $e->getMessage()]);
        }
    }

    public function handleUpdateTeams(array $inputData): void
    {
        try {
            $user = currentUserOrFail();
            $teamsCount = (int) ($inputData['teams_count'] ?? 1);
            $response = $this->scheduleService->updateTeamsCount($user, $teamsCount);
            $this->jsonResponse(200, $response);
        } catch (ProviderException $e) {
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
