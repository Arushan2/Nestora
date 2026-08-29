<?php

declare(strict_types=1);

function createProApplication(): void
{
    $user = currentUserOrFail();
    $rawData = readJson();
    // When the client submits FormData (multipart/form-data), PHP populates $_POST instead of php://input JSON
    $data = $rawData;
    if (empty($data) && !empty($_POST)) {
        $data = $_POST;
    }

    $applicationType = (string) ($data['applicationType'] ?? '');
    $allowedTypes = ['service_provider', 'product_seller'];

    if (!in_array($applicationType, $allowedTypes, true)) {
        jsonResponse(422, ['message' => 'Select a valid application type.']);
    }

    $businessName = trim((string) ($data['businessName'] ?? ''));
    $businessEmail = normalizeEmail((string) ($data['businessEmail'] ?? ''));
    $businessPhone = trim((string) ($data['businessPhone'] ?? ''));
    $businessAddress = trim((string) ($data['businessAddress'] ?? ''));
    $businessCity = trim((string) ($data['businessCity'] ?? ''));
    $businessDescription = trim((string) ($data['businessDescription'] ?? ''));
    $documentType = trim((string) ($data['documentType'] ?? ''));
    $documentNumber = trim((string) ($data['documentNumber'] ?? ''));
    $documentFile = trim((string) ($data['documentFile'] ?? ''));
    $selectedPlan = trim((string) ($data['selectedPlan'] ?? ''));

    // For service providers, require explicit terms acceptance for the free trial
    if ($applicationType === 'service_provider') {
        $termsRaw = $data['termsAccepted'] ?? false;
        $termsAccepted = ($termsRaw === true || $termsRaw === 'true' || $termsRaw === '1' || $termsRaw === 1);
        if (!$termsAccepted) {
            jsonResponse(422, ['message' => 'You must accept the Free Trial terms and conditions to apply as a Service Provider.']);
        }
        // Default to annual_trial plan
        if ($selectedPlan === '') {
            $selectedPlan = 'annual_trial';
        }
    }

    // If a file was uploaded from the form input `business_registration_document`, upload to Cloudinary
    if (isset($_FILES['business_registration_document']) && is_uploaded_file($_FILES['business_registration_document']['tmp_name'])) {
        try {
            $uploadedUrl = uploadToCloudinary($_FILES['business_registration_document']['tmp_name'], $_FILES['business_registration_document']['name']);
            $documentFile = $uploadedUrl;
        } catch (Throwable $e) {
            jsonResponse(500, ['message' => 'Unable to upload document.', 'details' => $e->getMessage()]);
        }
    }

    $bankName = trim((string) ($data['bankName'] ?? ''));
    $accountHolderName = trim((string) ($data['accountHolderName'] ?? ''));
    $accountNumber = trim((string) ($data['accountNumber'] ?? ''));
    $branch = trim((string) ($data['branch'] ?? ''));

    // Require business details and a registration document (either uploaded file or provided link)
    if ($businessName === '' || $businessEmail === '' || $businessPhone === '' || $businessAddress === '' || $businessCity === '' || $businessDescription === '' || $documentFile === '') {
        jsonResponse(422, ['message' => 'Business details and a registration document are required.']);
    }

    if ($applicationType === 'product_seller') {
        if ($bankName === '' || $accountHolderName === '' || $accountNumber === '' || $branch === '') {
            jsonResponse(422, ['message' => 'Bank Name, Account Holder Name, Account Number, and Branch details are required for Product Sellers.']);
        }
    }

    $existing = applicationByUserId((int) $user['id']);
    if ($existing) {
        if ($existing['status'] === 'pending') {
            jsonResponse(409, ['message' => 'You already have a pending Pro application under review.']);
        }
        if ($existing['status'] === 'approved') {
            jsonResponse(409, ['message' => 'Your Pro application has already been approved.']);
        }
    }

    $statement = database()->prepare(
        'INSERT INTO pro_applications (
            user_id,
            application_type,
            business_name,
            business_email,
            business_phone,
            business_address,
            business_city,
            business_description,
            document_type,
            document_number,
            document_file,
            selected_plan,
            status,
            bank_name,
            account_holder_name,
            account_number,
            branch,
            created_at,
            updated_at
        ) VALUES (
            :user_id,
            :application_type,
            :business_name,
            :business_email,
            :business_phone,
            :business_address,
            :business_city,
            :business_description,
            :document_type,
            :document_number,
            :document_file,
            :selected_plan,
            :status,
            :bank_name,
            :account_holder_name,
            :account_number,
            :branch,
            NOW(),
            NOW()
        ) ON DUPLICATE KEY UPDATE
            application_type = VALUES(application_type),
            business_name = VALUES(business_name),
            business_email = VALUES(business_email),
            business_phone = VALUES(business_phone),
            business_address = VALUES(business_address),
            business_city = VALUES(business_city),
            business_description = VALUES(business_description),
            document_type = VALUES(document_type),
            document_number = VALUES(document_number),
            document_file = VALUES(document_file),
            selected_plan = VALUES(selected_plan),
            status = VALUES(status),
            bank_name = VALUES(bank_name),
            account_holder_name = VALUES(account_holder_name),
            account_number = VALUES(account_number),
            branch = VALUES(branch),
            review_note = NULL,
            reviewed_at = NULL,
            updated_at = NOW()'
    );

    $statement->execute([
        'user_id' => $user['id'],
        'application_type' => $applicationType,
        'business_name' => $businessName,
        'business_email' => $businessEmail,
        'business_phone' => $businessPhone,
        'business_address' => $businessAddress,
        'business_city' => $businessCity,
        'business_description' => $businessDescription,
        'document_type' => $documentType,
        'document_number' => $documentNumber,
        'document_file' => $documentFile,
        'selected_plan' => $selectedPlan !== '' ? $selectedPlan : null,
        'status' => 'pending',
        'bank_name' => $applicationType === 'product_seller' ? $bankName : null,
        'account_holder_name' => $applicationType === 'product_seller' ? $accountHolderName : null,
        'account_number' => $applicationType === 'product_seller' ? $accountNumber : null,
        'branch' => $applicationType === 'product_seller' ? $branch : null,
    ]);

    // Notify Admins
    try {
        $admins = database()->query("SELECT id FROM users WHERE role = 'admin'")->fetchAll();
        foreach ($admins as $admin) {
            createNotification(
                (int) $admin['id'],
                'New Pro Application',
                "{$businessName} has applied to join as a " . ($applicationType === 'service_provider' ? 'Service Provider' : 'Product Seller') . ".",
                '/admin'
            );
        }
    } catch (Throwable $e) {
        error_log('Admin notification error: ' . $e->getMessage());
    }

    jsonResponse(201, [
        'message' => 'Application submitted successfully.',
        'application' => applicationSummary(applicationByUserId((int) $user['id'])),
    ]);
}

function listPendingApplications(): void
{
    adminOnly();

    $statement = database()->query(
        'SELECT a.*, u.name AS user_name, u.email AS user_email, u.role AS user_role
         FROM pro_applications a
         INNER JOIN users u ON u.id = a.user_id
         WHERE a.status = "pending"
         ORDER BY a.created_at DESC'
    );

    jsonResponse(200, [
        'applications' => $statement->fetchAll(),
    ]);
}

function approveApplication(int $applicationId): void
{
    adminOnly();

    $applicationStatement = database()->prepare('SELECT * FROM pro_applications WHERE id = :id LIMIT 1');
    $applicationStatement->execute(['id' => $applicationId]);
    $application = $applicationStatement->fetch();

    if (!is_array($application)) {
        jsonResponse(404, ['message' => 'Application not found.']);
    }

    if (($application['status'] ?? '') !== 'pending') {
        jsonResponse(409, ['message' => 'Application has already been reviewed.']);
    }

    $userId = (int) $application['user_id'];
    $newRole = (string) $application['application_type'];

    $userStatement = database()->prepare('SELECT name, email, stripe_customer_id FROM users WHERE id = :id LIMIT 1');
    $userStatement->execute(['id' => $userId]);
    $dbUser = $userStatement->fetch();

    if (!is_array($dbUser)) {
        jsonResponse(404, ['message' => 'User associated with application not found.']);
    }

    $stripeCheckoutUrl = null;
    $appUrl = rtrim((string) env('APP_URL', 'http://localhost:5173'), '/');

    if ($newRole === 'service_provider') {
        $stripeSecretKey = env('STRIPE_SECRET_KEY');
        // Use new annual trial price; fall back to old starter plan for compatibility
        $stripePriceId = env('STRIPE_PRICE_ANNUAL_TRIAL') ?: env('STRIPE_PRICE_STARTER_PLAN');

        if (empty($stripeSecretKey) || empty($stripePriceId)) {
            jsonResponse(500, ['message' => 'Stripe integration keys are not properly configured on the server.']);
        }

        // Don't create checkout for placeholder price ID
        if ($stripePriceId === 'price_REPLACE_WITH_YOUR_ANNUAL_PRICE_ID') {
            jsonResponse(500, ['message' => 'STRIPE_PRICE_ANNUAL_TRIAL is not yet configured. Please create the annual price in the Stripe Dashboard and update the .env file.']);
        }

        try {
            \Stripe\Stripe::setApiKey($stripeSecretKey);

            $checkoutSessionParams = [
                'mode' => 'subscription',
                'success_url' => $appUrl . '/join-as-pro/success?session_id={CHECKOUT_SESSION_ID}',
                'cancel_url' => $appUrl . '/join-as-pro/cancel',
                'line_items' => [[
                    'price' => $stripePriceId,
                    'quantity' => 1,
                ]],
                // Collect payment method upfront — $0 charged today
                'payment_method_collection' => 'always',
                'subscription_data' => [
                    'trial_period_days' => 30,
                    'metadata' => [
                        'user_id' => (string) $userId,
                        'application_id' => (string) $applicationId,
                    ],
                ],
                'metadata' => [
                    'user_id' => (string) $userId,
                    'application_id' => (string) $applicationId,
                ],
            ];

            if (!empty($dbUser['stripe_customer_id'])) {
                $checkoutSessionParams['customer'] = $dbUser['stripe_customer_id'];
            } else {
                $checkoutSessionParams['customer_email'] = $dbUser['email'];
            }

            $session = \Stripe\Checkout\Session::create($checkoutSessionParams);
            $stripeCheckoutUrl = $session->url;
        } catch (Throwable $e) {
            jsonResponse(500, ['message' => 'Failed to generate Stripe checkout session.', 'details' => $e->getMessage()]);
        }
    }

    $updateApplication = database()->prepare(
        'UPDATE pro_applications
         SET status = :status, stripe_checkout_url = :checkout_url, reviewed_at = NOW(), updated_at = NOW()
         WHERE id = :id'
    );
    $updateApplication->execute([
        'status' => 'approved',
        'checkout_url' => $stripeCheckoutUrl,
        'id' => $applicationId,
    ]);

    // Product sellers upgrade immediately. Service providers wait for Stripe trial activation.
    if ($newRole !== 'service_provider') {
        $updateUser = database()->prepare('UPDATE users SET role = :role WHERE id = :id');
        $updateUser->execute([
            'role' => $newRole,
            'id' => $userId,
        ]);
    }

    // In-app notification
    if ($newRole === 'service_provider') {
        createNotification(
            $userId,
            'Application Approved',
            'Your Service Provider application was approved! Activate your 30-day free trial to get started — no charge today.',
            '/join-as-pro'
        );
    } else {
        createNotification(
            $userId,
            'Application Approved',
            'Your Product Seller application was approved! You can now manage your store inventory.',
            '/dashboard'
        );
    }

    // Send approval email with free trial activation link for service providers
    if ($newRole === 'service_provider' && $stripeCheckoutUrl) {
        require_once __DIR__ . '/../lib/mail.php';
        $userName = htmlspecialchars((string) ($dbUser['name'] ?? 'there'));
        $emailSubject = 'Your Service Provider Application Has Been Approved';
        $emailBody = <<<HTML
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Application Approved</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=Space+Grotesk:wght@500;700&display=swap');
    body { margin: 0; padding: 0; background-color: #f8fafc; font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; -webkit-font-smoothing: antialiased; }
    table { border-collapse: collapse; }
  </style>
</head>
<body>
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 48px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width: 520px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(15,23,42,0.04);">
          <tr>
            <td height="6" style="background: linear-gradient(90deg, #06b6d4 0%, #f97316 100%); line-height: 6px; font-size: 1px;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 24px 0; font-size: 24px; font-weight: 700; color: #0f172a; font-family: 'Space Grotesk', sans-serif; letter-spacing: -0.02em;">Nestora<span style="color: #06b6d4;">.</span></p>
              <h1 style="margin: 0 0 8px 0; color: #0f172a; font-size: 22px; font-weight: 700; font-family: 'Space Grotesk', sans-serif;">Your Application is Approved!</h1>
              <p style="margin: 0 0 24px 0; color: #64748b; font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em;">Service Provider &mdash; Free Trial Ready</p>
              <p style="margin: 0 0 16px 0; color: #334155; font-size: 15px; line-height: 1.7;">Hi {$userName},</p>
              <p style="margin: 0 0 20px 0; color: #334155; font-size: 15px; line-height: 1.7;">Your Service Provider application has been reviewed and approved. Activate your <strong>30-day free trial</strong> to start listing your services on Nestora.</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="background-color: #f0fdfa; border: 1px solid #99f6e4; border-radius: 12px; padding: 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="50%" style="padding: 4px 0;">
                          <p style="margin: 0; color: #0f172a; font-size: 13px; font-weight: 600;">Due today</p>
                          <p style="margin: 4px 0 0 0; color: #059669; font-size: 22px; font-weight: 700; font-family: 'Space Grotesk', sans-serif;">$0.00</p>
                        </td>
                        <td width="50%" style="padding: 4px 0; text-align: right;">
                          <p style="margin: 0; color: #0f172a; font-size: 13px; font-weight: 600;">After 30-day trial</p>
                          <p style="margin: 4px 0 0 0; color: #0f172a; font-size: 22px; font-weight: 700; font-family: 'Space Grotesk', sans-serif;">$29.99/year</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 28px 0; color: #334155; font-size: 15px; line-height: 1.7;">Click the button below to add your payment method. You will <strong>not be charged today</strong>. Your annual membership ($29.99/year) begins automatically after the 30-day trial unless you cancel.</p>
              <table cellpadding="0" cellspacing="0" style="margin: 0 auto 28px auto;">
                <tr>
                  <td align="center" style="border-radius: 12px; background-color: #06b6d4;">
                    <a href="{$stripeCheckoutUrl}" style="display: inline-block; padding: 14px 32px; color: #ffffff; font-size: 15px; font-weight: 700; font-family: 'Space Grotesk', sans-serif; text-decoration: none; border-radius: 12px; letter-spacing: 0.01em;">Activate My Free Trial &rarr;</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0; color: #64748b; font-size: 12px; line-height: 1.6; border-top: 1px solid #e2e8f0; padding-top: 20px;">By activating, you confirm your saved payment method will be automatically charged <strong>$29.99 USD</strong> after 30 days for one year of Service Provider membership. Cancel any time before the trial ends to avoid being charged.</p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 40px; text-align: center;">
              <p style="margin: 0 0 8px 0; color: #64748b; font-size: 12px; line-height: 1.5;">If you have any questions, reply to this email and our team will help.</p>
              <p style="margin: 0; color: #94a3b8; font-size: 11px;">&copy; 2026 Nestora. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
HTML;

        sendMail($dbUser['email'], $emailSubject, $emailBody);
    }

    jsonResponse(200, [
        'message' => $newRole === 'service_provider' ? 'Application approved. Free trial checkout URL generated.' : 'Application approved successfully.',
        'application' => applicationSummary(applicationByUserId($userId)),
        'user' => userById($userId),
    ]);
}

function rejectApplication(int $applicationId): void
{
    adminOnly();

    $rawData = readJson();
    $reason = trim((string) ($rawData['reason'] ?? $rawData['reviewNote'] ?? ''));

    if ($reason === '') {
        jsonResponse(422, ['message' => 'Rejection reason is required.']);
    }

    $applicationStatement = database()->prepare('SELECT * FROM pro_applications WHERE id = :id LIMIT 1');
    $applicationStatement->execute(['id' => $applicationId]);
    $application = $applicationStatement->fetch();

    if (!is_array($application)) {
        jsonResponse(404, ['message' => 'Application not found.']);
    }

    if (($application['status'] ?? '') !== 'pending') {
        jsonResponse(409, ['message' => 'Application has already been reviewed.']);
    }

    $userId = (int) $application['user_id'];
    $userStatement = database()->prepare('SELECT name, email FROM users WHERE id = :id LIMIT 1');
    $userStatement->execute(['id' => $userId]);
    $dbUser = $userStatement->fetch();

    if (!is_array($dbUser)) {
        jsonResponse(404, ['message' => 'User associated with application not found.']);
    }

    $updateApplication = database()->prepare(
        'UPDATE pro_applications
         SET status = :status, review_note = :review_note, reviewed_at = NOW(), updated_at = NOW()
         WHERE id = :id'
    );
    $updateApplication->execute([
        'status' => 'rejected',
        'review_note' => $reason,
        'id' => $applicationId,
    ]);

    // In-app Notification
    createNotification(
        $userId,
        'Application Rejected',
        "Your Pro application was rejected. Reason: {$reason}",
        '/join-as-pro'
    );

    // Send email notification
    require_once __DIR__ . '/../lib/mail.php';
    $emailSubject = 'Update on your Nestora Pro Application';
    $businessName = htmlspecialchars((string) ($application['business_name'] ?? 'Your Business'));
    $appType = ($application['application_type'] ?? '') === 'service_provider' ? 'Service Provider' : 'Product Seller';
    $escapedReason = htmlspecialchars($reason);
    $userName = htmlspecialchars((string) ($dbUser['name'] ?? 'Applicant'));
    $appUrl = rtrim((string) env('APP_URL', 'http://localhost:5173'), '/');

    $emailBody = <<<HTML
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Application Status Update</title>
  <style>
    body { font-family: sans-serif; background-color: #f8fafc; color: #0f172a; padding: 20px; }
    .card { max-width: 550px; margin: 0 auto; background: white; padding: 40px; border-radius: 20px; border: 1px solid #e2e8f0; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.04); }
    .reason-box { background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 16px; margin: 20px 0; color: #991b1b; }
    .btn { display: inline-block; padding: 12px 24px; background-color: #0f172a; color: white; text-decoration: none; border-radius: 12px; font-weight: bold; margin-top: 15px; }
  </style>
</head>
<body>
  <div class="card">
    <h2 style="color: #991b1b; margin-top: 0;">Nestora Pro Application Update</h2>
    <p>Hi {$userName},</p>
    <p>Thank you for your interest in joining Nestora as a <strong>{$appType}</strong> for <strong>{$businessName}</strong>.</p>
    <p>After reviewing your application, our team is unable to approve your request at this time for the following reason:</p>
    <div class="reason-box">
      <strong>Reason for Rejection:</strong><br>
      <span style="display: inline-block; margin-top: 6px;">{$escapedReason}</span>
    </div>
    <p>You are welcome to update your information or documents and re-apply anytime by visiting your Nestora dashboard.</p>
    <div style="text-align: center; margin-top: 25px;">
      <a href="{$appUrl}/join-as-pro" class="btn" style="color: white;">Re-apply as Pro</a>
    </div>
    <p style="margin-top: 30px; font-size: 12px; color: #64748b;">If you have any questions or need further clarification, please feel free to reply to this email.</p>
  </div>
</body>
</html>
HTML;

    sendMail($dbUser['email'], $emailSubject, $emailBody);

    jsonResponse(200, [
        'message' => 'Application rejected successfully.',
        'application' => applicationSummary(applicationByUserId($userId)),
    ]);
}
