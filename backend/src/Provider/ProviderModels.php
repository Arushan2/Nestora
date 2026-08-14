<?php

declare(strict_types=1);

namespace Nestora\Provider;

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * OOP Concept 1: ENCAPSULATION
 * Service Provider Domain Entities and Validated Data Transfer Objects (DTOs).
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * ServiceListing Entity Model: Encapsulates service listing properties,
 * pricing types, city coverage, portfolio images, and ownership validation.
 */
class ServiceListing
{
    private int $id;
    private int $userId;
    private string $title;
    private string $category;
    private string $description;
    private float $price;
    private string $pricingType;
    private array $cities;
    private array $portfolioImages;
    private string $createdAt;
    private string $updatedAt;
    private ?string $providerName;
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
        $this->description = (string) ($data['description'] ?? '');
        $this->price = (float) ($data['price'] ?? 0.0);
        $this->pricingType = (string) ($data['pricing_type'] ?? 'fixed');
        $this->createdAt = (string) ($data['created_at'] ?? date('Y-m-d H:i:s'));
        $this->updatedAt = (string) ($data['updated_at'] ?? date('Y-m-d H:i:s'));

        // Cities array decoding
        $cities = $data['cities'] ?? [];
        if (is_string($cities)) {
            $decoded = json_decode($cities, true);
            $this->cities = is_array($decoded) ? $decoded : [];
        } else {
            $this->cities = is_array($cities) ? $cities : [];
        }

        // Portfolio images decoding
        $images = $data['portfolio_images'] ?? $data['images'] ?? [];
        if (is_string($images)) {
            $decoded = json_decode($images, true);
            $this->portfolioImages = is_array($decoded) ? $decoded : [];
        } else {
            $this->portfolioImages = is_array($images) ? $images : [];
        }

        // Provider and Business metadata
        $this->providerName = isset($data['provider_name']) ? (string) $data['provider_name'] : null;
        $this->businessName = isset($data['business_name']) ? (string) $data['business_name'] : null;
        $this->businessEmail = isset($data['business_email']) ? (string) $data['business_email'] : null;
        $this->businessPhone = isset($data['business_phone']) ? (string) $data['business_phone'] : null;
        $this->businessAddress = isset($data['business_address']) ? (string) $data['business_address'] : null;
        $this->businessCity = isset($data['business_city']) ? (string) $data['business_city'] : null;
    }

    public function getId(): int { return $this->id; }
    public function getUserId(): int { return $this->userId; }
    public function getTitle(): string { return $this->title; }
    public function getCategory(): string { return $this->category; }
    public function getDescription(): string { return $this->description; }
    public function getPrice(): float { return $this->price; }
    public function getPricingType(): string { return $this->pricingType; }
    public function getCities(): array { return $this->cities; }
    public function getPortfolioImages(): array { return $this->portfolioImages; }
    public function getCreatedAt(): string { return $this->createdAt; }
    public function getUpdatedAt(): string { return $this->updatedAt; }

    public function servesCity(string $city): bool
    {
        return in_array($city, $this->cities, true);
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
            'description' => $this->description,
            'price' => $this->price,
            'pricing_type' => $this->pricingType,
            'cities' => $this->cities,
            'portfolio_images' => $this->portfolioImages,
            'images' => $this->portfolioImages,
            'created_at' => $this->createdAt,
            'updated_at' => $this->updatedAt,
        ];

        if ($this->providerName !== null) {
            $arr['provider_name'] = $this->providerName;
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
 * ServiceInquiry Model: Encapsulates service inquiry details, offer pricing,
 * and negotiation status transitions.
 */
class ServiceInquiry
{
    private int $id;
    private int $serviceId;
    private int $customerId;
    private int $providerId;
    private string $status;
    private ?string $bookingDate;
    private ?string $surveyPlanUrl;
    private ?float $offerPrice;
    private ?string $offerNotes;
    private ?string $offerSentAt;
    private string $createdAt;
    private string $updatedAt;
    private ?string $customerName;
    private ?string $customerEmail;
    private ?string $serviceTitle;
    private ?string $providerName;
    private ?string $providerEmail;

    public function __construct(array $data)
    {
        $this->id = (int) ($data['id'] ?? 0);
        $this->serviceId = (int) ($data['service_id'] ?? 0);
        $this->customerId = (int) ($data['customer_id'] ?? 0);
        $this->providerId = (int) ($data['provider_id'] ?? 0);
        $this->status = strtolower((string) ($data['status'] ?? 'pending'));
        $this->bookingDate = isset($data['booking_date']) && $data['booking_date'] !== null ? (string) $data['booking_date'] : null;
        $this->surveyPlanUrl = isset($data['survey_plan_url']) ? (string) $data['survey_plan_url'] : null;
        $this->offerPrice = isset($data['offer_price']) && $data['offer_price'] !== null ? (float) $data['offer_price'] : null;
        $this->offerNotes = isset($data['offer_notes']) ? (string) $data['offer_notes'] : null;
        $this->offerSentAt = isset($data['offer_sent_at']) ? (string) $data['offer_sent_at'] : null;
        $this->createdAt = (string) ($data['created_at'] ?? date('Y-m-d H:i:s'));
        $this->updatedAt = (string) ($data['updated_at'] ?? date('Y-m-d H:i:s'));

        $this->customerName = isset($data['customer_name']) ? (string) $data['customer_name'] : null;
        $this->customerEmail = isset($data['customer_email']) ? (string) $data['customer_email'] : null;
        $this->serviceTitle = isset($data['service_title']) ? (string) $data['service_title'] : null;
        $this->providerName = isset($data['provider_name']) ? (string) $data['provider_name'] : null;
        $this->providerEmail = isset($data['provider_email']) ? (string) $data['provider_email'] : null;
    }

    public function getId(): int { return $this->id; }
    public function getServiceId(): int { return $this->serviceId; }
    public function getCustomerId(): int { return $this->customerId; }
    public function getProviderId(): int { return $this->providerId; }
    public function getStatus(): string { return $this->status; }
    public function getBookingDate(): ?string { return $this->bookingDate; }
    public function getSurveyPlanUrl(): ?string { return $this->surveyPlanUrl; }
    public function getOfferPrice(): ?float { return $this->offerPrice; }
    public function getOfferNotes(): ?string { return $this->offerNotes; }

    public function canRequestDetails(): bool
    {
        return in_array($this->status, ['pending', 'details_replied'], true);
    }

    public function canSendOffer(): bool
    {
        return in_array($this->status, ['pending', 'details_replied', 'details_requested', 'correction_requested'], true);
    }

    public function canCompleteWork(): bool
    {
        return $this->status === 'accepted';
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'service_id' => $this->serviceId,
            'customer_id' => $this->customerId,
            'provider_id' => $this->providerId,
            'status' => $this->status,
            'booking_date' => $this->bookingDate,
            'survey_plan_url' => $this->surveyPlanUrl,
            'offer_price' => $this->offerPrice,
            'offer_notes' => $this->offerNotes,
            'offer_sent_at' => $this->offerSentAt,
            'created_at' => $this->createdAt,
            'updated_at' => $this->updatedAt,
            'customer_name' => $this->customerName,
            'customer_email' => $this->customerEmail,
            'service_title' => $this->serviceTitle,
            'provider_name' => $this->providerName,
            'provider_email' => $this->providerEmail,
        ];
    }
}

/**
 * ProviderSchedule Model: Encapsulates provider calendar events, blocks, and leaves.
 */
class ProviderSchedule
{
    private int $id;
    private int $providerId;
    private string $eventDate;
    private string $type;
    private ?string $notes;
    private ?string $googleEventId;

    public function __construct(array $data)
    {
        $this->id = (int) ($data['id'] ?? 0);
        $this->providerId = (int) ($data['provider_id'] ?? 0);
        $this->eventDate = (string) ($data['event_date'] ?? '');
        $this->type = (string) ($data['type'] ?? 'leave');
        $this->notes = isset($data['notes']) ? (string) $data['notes'] : null;
        $this->googleEventId = isset($data['google_event_id']) ? (string) $data['google_event_id'] : null;
    }

    public function getId(): int { return $this->id; }
    public function getProviderId(): int { return $this->providerId; }
    public function getEventDate(): string { return $this->eventDate; }
    public function getType(): string { return $this->type; }
    public function getNotes(): ?string { return $this->notes; }
    public function getGoogleEventId(): ?string { return $this->googleEventId; }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'provider_id' => $this->providerId,
            'event_date' => $this->eventDate,
            'type' => $this->type,
            'notes' => $this->notes,
            'google_event_id' => $this->googleEventId,
        ];
    }
}

/**
 * CreateService DTO: Encapsulates and validates service listing creation inputs.
 */
class CreateServiceDTO
{
    private string $title;
    private string $category;
    private string $description;
    private float $price;
    private string $pricingType;
    private array $cities;
    private array $portfolioImages;

    public function __construct(array $data, array $uploadedImages = [])
    {
        $this->title = trim((string) ($data['title'] ?? ''));
        $this->category = trim((string) ($data['category'] ?? ''));
        $this->description = trim((string) ($data['description'] ?? ''));
        $this->price = (float) ($data['price'] ?? 0.0);
        $this->pricingType = trim((string) ($data['pricing_type'] ?? 'fixed'));
        $this->portfolioImages = $uploadedImages;

        // Parse cities
        $cities = $data['cities'] ?? '';
        if (is_string($cities) && trim($cities) !== '') {
            $decoded = json_decode($cities, true);
            $this->cities = is_array($decoded) ? $decoded : array_filter(array_map('trim', explode(',', $cities)));
        } elseif (is_array($cities)) {
            $this->cities = $cities;
        } else {
            $this->cities = [];
        }

        $this->validate();
    }

    private function validate(): void
    {
        if ($this->title === '' || $this->category === '' || $this->description === '') {
            throw new ProviderValidationException('Title, category, and description are required.');
        }

        if ($this->price <= 0) {
            throw new ProviderValidationException('Price must be a positive number.');
        }

        if (empty($this->cities)) {
            throw new ProviderValidationException('At least one operational city must be selected.');
        }
    }

    public function getTitle(): string { return $this->title; }
    public function getCategory(): string { return $this->category; }
    public function getDescription(): string { return $this->description; }
    public function getPrice(): float { return $this->price; }
    public function getPricingType(): string { return $this->pricingType; }
    public function getCities(): array { return array_values($this->cities); }
    public function getPortfolioImages(): array { return $this->portfolioImages; }
}

/**
 * UpdateService DTO: Encapsulates and validates service listing update inputs.
 */
class UpdateServiceDTO
{
    private string $title;
    private string $category;
    private string $description;
    private float $price;
    private string $pricingType;
    private array $cities;
    private array $portfolioImages;

    public function __construct(array $data, array $existingImages = [], array $newUploadedImages = [])
    {
        $this->title = trim((string) ($data['title'] ?? ''));
        $this->category = trim((string) ($data['category'] ?? ''));
        $this->description = trim((string) ($data['description'] ?? ''));
        $this->price = (float) ($data['price'] ?? 0.0);
        $this->pricingType = trim((string) ($data['pricing_type'] ?? 'fixed'));

        // Merge images
        $clientImages = $data['portfolio_images'] ?? $data['images'] ?? null;
        if ($clientImages !== null) {
            if (is_string($clientImages)) {
                $decoded = json_decode($clientImages, true);
                $existingImages = is_array($decoded) ? $decoded : $existingImages;
            } elseif (is_array($clientImages)) {
                $existingImages = $clientImages;
            }
        }
        $this->portfolioImages = array_merge($existingImages, $newUploadedImages);

        // Parse cities
        $cities = $data['cities'] ?? '';
        if (is_string($cities) && trim($cities) !== '') {
            $decoded = json_decode($cities, true);
            $this->cities = is_array($decoded) ? $decoded : array_filter(array_map('trim', explode(',', $cities)));
        } elseif (is_array($cities)) {
            $this->cities = $cities;
        } else {
            $this->cities = [];
        }

        $this->validate();
    }

    private function validate(): void
    {
        if ($this->title === '' || $this->category === '' || $this->description === '') {
            throw new ProviderValidationException('Title, category, and description are required.');
        }

        if ($this->price <= 0) {
            throw new ProviderValidationException('Price must be a positive number.');
        }

        if (empty($this->cities)) {
            throw new ProviderValidationException('At least one operational city must be selected.');
        }
    }

    public function getTitle(): string { return $this->title; }
    public function getCategory(): string { return $this->category; }
    public function getDescription(): string { return $this->description; }
    public function getPrice(): float { return $this->price; }
    public function getPricingType(): string { return $this->pricingType; }
    public function getCities(): array { return array_values($this->cities); }
    public function getPortfolioImages(): array { return $this->portfolioImages; }
}

/**
 * SendOffer DTO: Encapsulates offer price and terms validation.
 */
class SendOfferDTO
{
    private float $offerPrice;
    private string $offerNotes;

    public function __construct(array $data)
    {
        $this->offerPrice = (float) ($data['offer_price'] ?? $data['price'] ?? 0.0);
        $this->offerNotes = trim((string) ($data['offer_notes'] ?? $data['notes'] ?? ''));

        $this->validate();
    }

    private function validate(): void
    {
        if ($this->offerPrice <= 0) {
            throw new ProviderValidationException('Offer price must be greater than zero.');
        }

        if ($this->offerNotes === '') {
            throw new ProviderValidationException('Offer notes/scope of work details are required.');
        }
    }

    public function getOfferPrice(): float { return $this->offerPrice; }
    public function getOfferNotes(): string { return $this->offerNotes; }
}

/**
 * BlockDate DTO: Encapsulates provider schedule block parameters.
 */
class BlockDateDTO
{
    private string $eventDate;
    private string $type;
    private ?string $notes;

    public function __construct(array $data)
    {
        $this->eventDate = trim((string) ($data['event_date'] ?? ''));
        $this->type = trim((string) ($data['type'] ?? 'leave'));
        $notes = trim((string) ($data['notes'] ?? ''));
        $this->notes = $notes !== '' ? $notes : null;

        $this->validate();
    }

    private function validate(): void
    {
        if ($this->eventDate === '' || !in_array($this->type, ['leave', 'manual_work'], true)) {
            throw new ProviderValidationException('Valid event date and type (leave or manual_work) are required.');
        }

        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $this->eventDate) !== 1) {
            throw new ProviderValidationException('Event date must be in YYYY-MM-DD format.');
        }
    }

    public function getEventDate(): string { return $this->eventDate; }
    public function getType(): string { return $this->type; }
    public function getNotes(): ?string { return $this->notes; }
}
