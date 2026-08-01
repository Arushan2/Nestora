<?php

declare(strict_types=1);

namespace Nestora\Core\Contracts;

interface PaymentGatewayInterface
{
    public function createPaymentSession(array $orderData): array;
    public function verifyWebhookSignature(string $payload, string $signatureHeader): bool;
    public function handleWebhook(array $eventPayload): void;
}
