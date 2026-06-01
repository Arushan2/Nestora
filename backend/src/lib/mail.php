<?php

declare(strict_types=1);

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

require_once __DIR__ . '/../../../vendor/autoload.php';

/**
 * Send an email synchronously using PHPMailer with Gmail SMTP.
 * Bypasses IPv6 connection timeouts by resolving hostname to IPv4.
 */
function sendMail(string $to, string $subject, string $htmlBody): bool
{
    $mail = new PHPMailer(true);

    try {
        $mail->isSMTP();
        
        $host = env('MAIL_HOST', 'smtp.gmail.com');
        if ($host === 'smtp.gmail.com') {
            // Resolve smtp.gmail.com to IPv4 to prevent 30-second IPv6 DNS/routing timeout on local/macOS environments
            $ipv4 = gethostbyname('smtp.gmail.com');
            if ($ipv4 !== 'smtp.gmail.com') {
                $mail->Host = $ipv4;
                // Since we connect to an IP, configure SSL context to verify the certificate against the domain
                $mail->SMTPOptions = [
                    'ssl' => [
                        'peer_name' => 'smtp.gmail.com',
                        'verify_peer' => true,
                        'verify_peer_name' => true,
                    ]
                ];
            } else {
                $mail->Host = $host;
            }
        } else {
            $mail->Host = $host;
        }

        $mail->SMTPAuth   = true;
        $mail->Username   = env('MAIL_USERNAME', '');
        $mail->Password   = env('MAIL_PASSWORD', '');
        $mail->SMTPSecure = env('MAIL_ENCRYPTION', 'tls') === 'ssl'
            ? PHPMailer::ENCRYPTION_SMTPS
            : PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = (int) env('MAIL_PORT', '587');
        
        // Timeout configuration
        $mail->Timeout    = 10; // Connect timeout in seconds

        $mail->setFrom(
            env('MAIL_FROM_ADDRESS', env('MAIL_USERNAME', 'noreply@nestora.com')),
            env('MAIL_FROM_NAME', env('APP_NAME', 'Nestora'))
        );
        $mail->addAddress($to);

        $mail->isHTML(true);
        $mail->Subject = $subject;
        $mail->Body    = $htmlBody;
        $mail->AltBody = strip_tags(str_replace(['<br>', '<br/>', '<br />'], "\n", $htmlBody));

        $mail->send();
        return true;
    } catch (Exception $e) {
        error_log('Mail send failed: ' . $mail->ErrorInfo);
        return false;
    }
}

/**
 * Build and send an OTP email with a styled HTML template.
 */
function sendOtpEmail(string $to, string $otp, string $purpose): bool
{
    $appName = env('APP_NAME', 'Nestora');

    if ($purpose === 'signup') {
        $subject = 'Verify your email — ' . $appName;
        $heading = 'Welcome to ' . $appName . '!';
        $message = 'Use the code below to verify your email address and complete your registration.';
    } else {
        $subject = 'Password reset — ' . $appName;
        $heading = 'Password Reset Request';
        $message = 'Use the code below to reset your password. If you did not request this, you can safely ignore this email.';
    }

    $html = <<<HTML
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin:0;padding:0;background:#f4f4f7;font-family:'Segoe UI',Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:40px 0;">
        <tr><td align="center">
          <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
            <tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 40px;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">{$heading}</h1>
            </td></tr>
            <tr><td style="padding:32px 40px;">
              <p style="margin:0 0 24px;color:#51545e;font-size:15px;line-height:1.6;">{$message}</p>
              <div style="text-align:center;margin:24px 0;">
                <span style="display:inline-block;background:#f4f4f7;border:2px dashed #6366f1;border-radius:8px;padding:16px 32px;font-size:32px;font-weight:700;letter-spacing:8px;color:#1a1a2e;">{$otp}</span>
              </div>
              <p style="margin:24px 0 0;color:#9ca3af;font-size:13px;line-height:1.5;">This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
            </td></tr>
            <tr><td style="background:#f9fafb;padding:20px 40px;text-align:center;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">&copy; {$appName}</p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
    HTML;

    return sendMail($to, $subject, $html);
}
