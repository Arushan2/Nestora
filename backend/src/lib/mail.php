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
 * Build and send an OTP email with a styled HTML template matching the Nestora theme.
 */
function sendOtpEmail(string $to, string $otp, string $purpose): bool
{
    $appName = env('APP_NAME', 'Nestora');

    if ($purpose === 'signup') {
        $subject = 'Verify Your Email Address with Nestora';
        $heading = 'Create Your Nestora Account';
        $subheading = 'Email Verification Required';
        $message = 'Thank you for choosing Nestora. To complete your registration and access our marketplace of verified construction professionals, please verify your email address using the secure verification code below.';
        $footerText = 'If you did not initiate this request, you can safely ignore this email.';
    } else {
        $subject = 'Reset Your Password — Nestora';
        $heading = 'Reset Your Password';
        $subheading = 'Authorization Code Request';
        $message = 'We received a request to reset your Nestora account password. Use the secure authorization code below to set a new password. For security, this code should not be shared with anyone.';
        $footerText = 'If you did not request a password reset, please secure your account or contact support.';
    }

    $html = <<<HTML
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>{$subject}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=Space+Grotesk:wght@500;700&display=swap');
        
        body {
          margin: 0;
          padding: 0;
          background-color: #f8fafc;
          font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        
        table {
          border-collapse: collapse;
        }
        
        .font-display {
          font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
        }
      </style>
    </head>
    <body>
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 48px 16px;">
        <tr>
          <td align="center">
            <table width="100%" max-width="500" style="max-width: 500px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.04);">
              <!-- Top Gradient Accent -->
              <tr>
                <td height="6" style="background: linear-gradient(90deg, #06b6d4 0%, #f97316 100%); line-height: 6px; font-size: 1px;">&nbsp;</td>
              </tr>
              
              <!-- Content Area -->
              <tr>
                <td style="padding: 40px;">
                  <!-- Logo Header -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                    <tr>
                      <td>
                        <span class="font-display" style="font-size: 24px; font-weight: 700; color: #0f172a; letter-spacing: -0.02em;">
                          Nestora<span style="color: #06b6d4;">.</span>
                        </span>
                      </td>
                    </tr>
                  </table>
                  
                  <!-- Heading -->
                  <h1 class="font-display" style="margin: 0 0 8px 0; color: #0f172a; font-size: 22px; font-weight: 700; tracking: -0.01em;">
                    {$heading}
                  </h1>
                  
                  <p style="margin: 0 0 24px 0; color: #64748b; font-size: 14px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em;">
                    {$subheading}
                  </p>
                  
                  <!-- Main Body Message -->
                  <p style="margin: 0 0 32px 0; color: #334155; font-size: 15px; line-height: 1.6;">
                    {$message}
                  </p>
                  
                  <!-- Code Box -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 32px;">
                    <tr>
                      <td align="center" style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 20px;">
                        <span class="font-display" style="display: block; font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #0f172a; padding-left: 8px;">
                          {$otp}
                        </span>
                      </td>
                    </tr>
                  </table>
                  
                  <!-- Details -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="border-top: 1px solid #e2e8f0; padding-top: 24px; margin-bottom: 8px;">
                    <tr>
                      <td style="color: #64748b; font-size: 13px; line-height: 1.5;">
                        This verification code is valid for <strong>10 minutes</strong>. For your security, do not share this email or the authorization code with anyone.
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Footer Area -->
              <tr>
                <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 40px; text-align: center;">
                  <p style="margin: 0 0 8px 0; color: #64748b; font-size: 12px; line-height: 1.5;">
                    {$footerText}
                  </p>
                  <p style="margin: 0; color: #94a3b8; font-size: 11px;">
                    &copy; 2026 Nestora. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    HTML;

    return sendMail($to, $subject, $html);
}
