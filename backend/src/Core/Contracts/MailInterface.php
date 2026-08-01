<?php

declare(strict_types=1);

namespace Nestora\Core\Contracts;

interface MailInterface
{
    public function send(string $toEmail, string $subject, string $htmlBody, string $textBody = ''): bool;
    public function sendOtp(string $toEmail, string $otpCode, string $purpose): bool;
}
