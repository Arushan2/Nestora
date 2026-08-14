<?php

declare(strict_types=1);

namespace Nestora\Provider;

use Exception;
use Throwable;

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * OOP Concept 2: ABSTRACTION
 * Interfaces & Contracts for Service Provider operations, persistence & calendar.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Contract for Service Provider service listing management.
 */
interface ServiceProviderServiceInterface
{
    public function listServices(array $filters): array;

    public function getService(int $id): ServiceListing;

    public function createService(array $user, CreateServiceDTO $dto): array;

    public function updateService(int $serviceId, array $user, UpdateServiceDTO $dto): array;

    public function deleteService(int $serviceId, array $user): array;
}

/**
 * Contract for Service Inquiry lifecycle and negotiation.
 */
interface ProviderInquiryServiceInterface
{
    public function listInquiries(array $user, ?string $status = null): array;

    public function getInquiry(int $id, array $user): array;

    public function requestDetails(int $id, array $user, string $content): array;

    public function sendOffer(int $id, array $user, SendOfferDTO $dto): array;

    public function completeWork(int $id, array $user, array $proofImages): array;
}

/**
 * Contract for Provider Calendar schedule management.
 */
interface ProviderScheduleServiceInterface
{
    public function getSchedule(int $providerId): array;

    public function blockDate(array $user, BlockDateDTO $dto): array;

    public function unblockDate(array $user, string $eventDate, string $type): array;

    public function updateTeamsCount(array $user, int $teamsCount): array;
}

/**
 * Data access contract for Service Listings persistence.
 */
interface ServiceListingRepositoryInterface
{
    public function findById(int $id): ?ServiceListing;

    public function findAll(array $filters): array;

    public function create(int $userId, CreateServiceDTO $dto): ServiceListing;

    public function update(int $id, UpdateServiceDTO $dto): bool;

    public function delete(int $id): bool;
}

/**
 * Data access contract for Service Inquiries persistence.
 */
interface ServiceInquiryRepositoryInterface
{
    public function findById(int $id): ?ServiceInquiry;

    public function findAllForUser(int $userId, ?string $status = null): array;

    public function updateStatus(int $id, string $status): bool;

    public function saveOffer(int $id, float $price, string $notes): bool;

    public function addFollowup(int $inquiryId, int $senderId, string $type, string $content, array $images = []): int;

    public function getFollowups(int $inquiryId): array;
}

/**
 * Data access contract for Provider Schedules persistence.
 */
interface ProviderScheduleRepositoryInterface
{
    public function findByProviderId(int $providerId): array;

    public function saveBlock(int $providerId, string $eventDate, string $type, ?string $notes, ?string $googleEventId = null): bool;

    public function deleteBlock(int $providerId, string $eventDate, string $type): ?string;

    public function updateTeamsCount(int $providerId, int $teamsCount): bool;
}

/**
 * Contract for Polymorphic Calendar Sync Strategies.
 */
interface CalendarSyncStrategyInterface
{
    public function syncBlock(int $providerId, string $title, string $eventDate, string $description, ?string $existingEventId = null): ?string;

    public function removeBlock(int $providerId, string $googleEventId): void;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * OOP Concept 3: INHERITANCE
 * Custom Exception Hierarchy for Service Provider Domain.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Base Service Provider Domain Exception.
 */
abstract class ProviderException extends Exception
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
 * Thrown when a service listing cannot be found.
 */
class ServiceNotFoundException extends ProviderException
{
    public function __construct(string $message = 'Service listing not found.')
    {
        parent::__construct($message, 404);
    }
}

/**
 * Thrown when an inquiry cannot be found.
 */
class InquiryNotFoundException extends ProviderException
{
    public function __construct(string $message = 'Inquiry not found.')
    {
        parent::__construct($message, 404);
    }
}

/**
 * Thrown when an unauthorized user attempts provider actions.
 */
class UnauthorizedProviderException extends ProviderException
{
    public function __construct(string $message = 'Access denied. Service providers only.')
    {
        parent::__construct($message, 403);
    }
}

/**
 * Thrown when provider input validation fails.
 */
class ProviderValidationException extends ProviderException
{
    public function __construct(string $message = 'Validation failed.')
    {
        parent::__construct($message, 422);
    }
}

/**
 * Thrown when an inquiry is in an invalid state for an action.
 */
class InvalidInquiryStateException extends ProviderException
{
    public function __construct(string $message = 'Invalid inquiry state for requested action.')
    {
        parent::__construct($message, 400);
    }
}
