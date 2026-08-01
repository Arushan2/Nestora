<?php

declare(strict_types=1);

namespace Nestora\Core\Services;

use Nestora\Core\Contracts\MailInterface;
use PHPMailer\PHPMailer\PHPMailer;

class MailService implements MailInterface
{
    private function createMailer(): PHPMailer
    {
        $mail = new PHPMailer(true);
        $mail->isSMTP();
        $mail->Host = getenv('MAIL_HOST') ?: 'smtp.gmail.com';
        $mail->SMTPAuth = true;
        $mail->Username = getenv('MAIL_USERNAME') ?: '';
        $mail->Password = getenv('MAIL_PASSWORD') ?: '';
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port = (int) (getenv('MAIL_PORT') ?: 587);

        $fromAddress = getenv('MAIL_FROM_ADDRESS') ?: 'noreply@nestora.com';
        $fromName = getenv('MAIL_FROM_NAME') ?: 'Nestora';
        $mail->setFrom($fromAddress, $fromName);

        return $mail;
    }

    public function send(string $toEmail, string $subject, string $htmlBody, string $textBody = ''): bool
    {
        try {
            $mail = $this->createMailer();
            $mail->addAddress($toEmail);
            $mail->isHTML(true);
            $mail->Subject = $subject;
            $mail->Body = $htmlBody;
            $mail->AltBody = $textBody ?: strip_tags($htmlBody);

            return $mail->send();
        } catch (\Throwable $e) {
            error_log('MailService error: ' . $e->getMessage());
            return false;
        }
    }

    public function sendOtp(string $toEmail, string $otpCode, string $purpose): bool
    {
        $subject = 'Nestora Verification Code';
        $htmlBody = sprintf(
            '<div style="font-family: sans-serif; padding: 20px; color: #333;">' .
            '<h2>Verification Code</h2>' .
            '<p>Your verification code for <strong>%s</strong> is:</p>' .
            '<div style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #4F46E5; margin: 20px 0;">%s</div>' .
            '<p>This code will expire in 10 minutes. If you did not request this code, please ignore this email.</p>' .
            '</div>',
            htmlspecialchars($purpose),
            htmlspecialchars($otpCode)
        );

        return $this->send($toEmail, $subject, $htmlBody);
    }
}
