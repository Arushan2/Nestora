<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

// Helper to decode JSON request body
function getJsonInput(): array
{
    $raw = file_get_contents('php://input');
    if (!$raw) {
        return [];
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function createInquiry(): void
{
    $user = currentUserOrFail();
    $data = getJsonInput();

    $serviceId = (int) ($data['service_id'] ?? $_POST['service_id'] ?? 0);
    $message = trim((string) ($data['message'] ?? $data['content'] ?? $_POST['message'] ?? $_POST['content'] ?? ''));

    if ($serviceId <= 0 || $message === '') {
        jsonResponse(422, ['message' => 'Service ID and initial message are required.']);
    }

    // Process optional survey plan file upload if present
    $surveyPlanUrl = null;
    if (isset($_FILES['survey_plan']) && $_FILES['survey_plan']['error'] === UPLOAD_ERR_OK) {
        try {
            $surveyPlanUrl = uploadToCloudinary($_FILES['survey_plan']['tmp_name'], $_FILES['survey_plan']['name'], 'Home/Inquiries');
        } catch (Throwable $e) {
            jsonResponse(500, ['message' => 'Failed to upload survey plan: ' . $e->getMessage()]);
        }
    }

    // Retrieve service listing
    $stmt = database()->prepare('SELECT * FROM service_listings WHERE id = :id');
    $stmt->execute(['id' => $serviceId]);
    $service = $stmt->fetch();

    if (!$service) {
        jsonResponse(444, ['message' => 'Service listing not found.']);
    }

    $providerId = (int) $service['user_id'];

    if ($providerId === (int) $user['id']) {
        jsonResponse(422, ['message' => 'You cannot inquire about your own service.']);
    }

    // Check if customer already has an ongoing inquiry for the same service
    $ongoingStmt = database()->prepare('
        SELECT id FROM service_inquiries 
        WHERE customer_id = :customer_id AND service_id = :service_id AND status != "completed"
        LIMIT 1
    ');
    $ongoingStmt->execute([
        'customer_id' => $user['id'],
        'service_id' => $serviceId
    ]);
    if ($ongoingStmt->fetch()) {
        jsonResponse(422, ['message' => 'You already have an ongoing inquiry or active project for this service. Please resolve it before creating a new one.']);
    }

    $db = database();
    $db->beginTransaction();

    try {
        // Create inquiry
        $stmt = $db->prepare('
            INSERT INTO service_inquiries (service_id, customer_id, provider_id, status, survey_plan_url)
            VALUES (:service_id, :customer_id, :provider_id, "pending", :survey_plan_url)
        ');
        $stmt->execute([
            'service_id' => $serviceId,
            'customer_id' => $user['id'],
            'provider_id' => $providerId,
            'survey_plan_url' => $surveyPlanUrl
        ]);
        $inquiryId = (int) $db->lastInsertId();

        // Create first followup (inquiry_created)
        $stmt = $db->prepare('
            INSERT INTO inquiry_followups (inquiry_id, sender_id, type, content)
            VALUES (:inquiry_id, :sender_id, "inquiry_created", :content)
        ');
        $stmt->execute([
            'inquiry_id' => $inquiryId,
            'sender_id' => $user['id'],
            'content' => $message
        ]);

        $db->commit();
        jsonResponse(201, ['message' => 'Inquiry submitted successfully.', 'inquiry_id' => $inquiryId]);
    } catch (Throwable $e) {
        $db->rollBack();
        jsonResponse(500, ['message' => 'Failed to create inquiry: ' . $e->getMessage()]);
    }
}

function listInquiries(): void
{
    $user = currentUserOrFail();
    $userId = (int) $user['id'];

    // If query has specific filter: sent vs received
    $type = $_GET['type'] ?? 'all'; // 'sent', 'received', or 'all'

    $query = '
        SELECT si.*, 
               s.title AS service_title, 
               s.category AS service_category,
               u_cust.name AS customer_name,
               u_prov.name AS provider_name
        FROM service_inquiries si
        INNER JOIN service_listings s ON s.id = si.service_id
        INNER JOIN users u_cust ON u_cust.id = si.customer_id
        INNER JOIN users u_prov ON u_prov.id = si.provider_id
    ';

    $conditions = [];
    $params = [];

    if ($type === 'sent') {
        $conditions[] = 'si.customer_id = :user_id';
        $params['user_id'] = $userId;
    } elseif ($type === 'received') {
        $conditions[] = 'si.provider_id = :user_id';
        $params['user_id'] = $userId;
    } else {
        // 'all' - show sent OR received
        $conditions[] = '(si.customer_id = :user_id OR si.provider_id = :user_id)';
        $params['user_id'] = $userId;
    }

    if (!empty($conditions)) {
        $query .= ' WHERE ' . implode(' AND ', $conditions);
    }

    $query .= ' ORDER BY si.updated_at DESC';

    $stmt = database()->prepare($query);
    $stmt->execute($params);
    $inquiries = $stmt->fetchAll();

    jsonResponse(200, ['inquiries' => $inquiries]);
}

function getInquiry(int $id): void
{
    $user = currentUserOrFail();
    $userId = (int) $user['id'];

    // Fetch inquiry
    $stmt = database()->prepare('
        SELECT si.*, 
               s.title AS service_title, 
               s.category AS service_category,
               s.description AS service_description,
               u_cust.name AS customer_name,
               u_cust.email AS customer_email,
               u_prov.name AS provider_name,
               u_prov.email AS provider_email
        FROM service_inquiries si
        INNER JOIN service_listings s ON s.id = si.service_id
        INNER JOIN users u_cust ON u_cust.id = si.customer_id
        INNER JOIN users u_prov ON u_prov.id = si.provider_id
        WHERE si.id = :id
    ');
    $stmt->execute(['id' => $id]);
    $inquiry = $stmt->fetch();

    if (!$inquiry) {
        jsonResponse(404, ['message' => 'Inquiry not found.']);
    }

    // Authorization check
    if ((int) $inquiry['customer_id'] !== $userId && (int) $inquiry['provider_id'] !== $userId && $user['role'] !== 'admin') {
        jsonResponse(403, ['message' => 'Unauthorized access.']);
    }

    // Fetch followups
    $stmt = database()->prepare('
        SELECT f.*, u.name AS sender_name, u.role AS sender_role
        FROM inquiry_followups f
        INNER JOIN users u ON u.id = f.sender_id
        WHERE f.inquiry_id = :inquiry_id
        ORDER BY f.created_at ASC
    ');
    $stmt->execute(['inquiry_id' => $id]);
    $followups = $stmt->fetchAll();

    // Decode JSON images where applicable
    foreach ($followups as &$f) {
        if ($f['images']) {
            $f['images'] = json_decode($f['images'], true);
        }
    }

    // Fetch contact details if status is accepted, work_completed, or completed
    $revealContacts = in_array($inquiry['status'], ['accepted', 'work_completed', 'completed'], true) 
                      || $user['role'] === 'admin';

    $contacts = null;
    if ($revealContacts) {
        // Fetch provider's application or profile info
        $provStmt = database()->prepare('
            SELECT business_name, business_email, business_phone, business_address, business_city
            FROM pro_applications
            WHERE user_id = :user_id
        ');
        $provStmt->execute(['user_id' => $inquiry['provider_id']]);
        $provApp = $provStmt->fetch();

        // Fetch customer's details (e.g. from user profile if they have pro application, otherwise default)
        $custStmt = database()->prepare('
            SELECT business_phone, business_address, business_city
            FROM pro_applications
            WHERE user_id = :user_id
        ');
        $custStmt->execute(['user_id' => $inquiry['customer_id']]);
        $custApp = $custStmt->fetch();

        $contacts = [
            'provider' => [
                'name' => $inquiry['provider_name'],
                'email' => $provApp['business_email'] ?? $inquiry['provider_email'],
                'phone' => $provApp['business_phone'] ?? 'N/A',
                'address' => $provApp['business_address'] ?? 'N/A',
                'city' => $provApp['business_city'] ?? 'N/A'
            ],
            'customer' => [
                'name' => $inquiry['customer_name'],
                'email' => $inquiry['customer_email'],
                'phone' => $custApp['business_phone'] ?? 'N/A',
                'address' => $custApp['business_address'] ?? 'N/A',
                'city' => $custApp['business_city'] ?? 'N/A'
            ]
        ];
    }

    jsonResponse(200, [
        'inquiry' => $inquiry,
        'followups' => $followups,
        'contacts' => $contacts
    ]);
}

function requestDetails(int $id): void
{
    $user = currentUserOrFail();
    $userId = (int) $user['id'];

    $data = getJsonInput();
    $content = trim((string) ($data['content'] ?? ''));

    if ($content === '') {
        jsonResponse(422, ['message' => 'Please provide specific questions/details requested.']);
    }

    $stmt = database()->prepare('SELECT * FROM service_inquiries WHERE id = :id');
    $stmt->execute(['id' => $id]);
    $inquiry = $stmt->fetch();

    if (!$inquiry) {
        jsonResponse(404, ['message' => 'Inquiry not found.']);
    }

    if ((int) $inquiry['provider_id'] !== $userId) {
        jsonResponse(403, ['message' => 'Only the service provider can request details.']);
    }

    $db = database();
    $db->beginTransaction();

    try {
        $stmt = $db->prepare('UPDATE service_inquiries SET status = "details_requested" WHERE id = :id');
        $stmt->execute(['id' => $id]);

        $stmt = $db->prepare('
            INSERT INTO inquiry_followups (inquiry_id, sender_id, type, content)
            VALUES (:inquiry_id, :sender_id, "details_requested", :content)
        ');
        $stmt->execute([
            'inquiry_id' => $id,
            'sender_id' => $userId,
            'content' => $content
        ]);

        $db->commit();
        jsonResponse(200, ['message' => 'Details requested. Status updated.']);
    } catch (Throwable $e) {
        $db->rollBack();
        jsonResponse(500, ['message' => 'Failed to request details: ' . $e->getMessage()]);
    }
}

function replyDetails(int $id): void
{
    $user = currentUserOrFail();
    $userId = (int) $user['id'];

    $data = getJsonInput();
    $content = trim((string) ($data['content'] ?? $_POST['content'] ?? ''));

    if ($content === '') {
        jsonResponse(422, ['message' => 'Please type a reply.']);
    }

    $stmt = database()->prepare('SELECT * FROM service_inquiries WHERE id = :id');
    $stmt->execute(['id' => $id]);
    $inquiry = $stmt->fetch();

    if (!$inquiry) {
        jsonResponse(404, ['message' => 'Inquiry not found.']);
    }

    if ((int) $inquiry['customer_id'] !== $userId) {
        jsonResponse(403, ['message' => 'Only the customer can reply to details request.']);
    }

    // Process file/image uploads if present
    $uploadedUrls = [];
    if (isset($_FILES['images']) && is_array($_FILES['images']['tmp_name'])) {
        $files = $_FILES['images'];
        $count = count($files['tmp_name']);
        for ($i = 0; $i < $count; $i++) {
            if ($files['error'][$i] === UPLOAD_ERR_OK) {
                try {
                    $url = uploadToCloudinary($files['tmp_name'][$i], $files['name'][$i], 'Home/Inquiries');
                    $uploadedUrls[] = $url;
                } catch (Throwable $e) {
                    jsonResponse(500, ['message' => 'Failed to upload attachment: ' . $e->getMessage()]);
                }
            }
        }
    }

    $db = database();
    $db->beginTransaction();

    try {
        $stmt = $db->prepare('UPDATE service_inquiries SET status = "pending" WHERE id = :id');
        $stmt->execute(['id' => $id]);

        $stmt = $db->prepare('
            INSERT INTO inquiry_followups (inquiry_id, sender_id, type, content, images)
            VALUES (:inquiry_id, :sender_id, "details_replied", :content, :images)
        ');
        $stmt->execute([
            'inquiry_id' => $id,
            'sender_id' => $userId,
            'content' => $content,
            'images' => empty($uploadedUrls) ? null : json_encode($uploadedUrls)
        ]);

        $db->commit();
        jsonResponse(200, ['message' => 'Reply sent. Status updated to pending.']);
    } catch (Throwable $e) {
        $db->rollBack();
        jsonResponse(500, ['message' => 'Failed to send reply: ' . $e->getMessage()]);
    }
}

function sendOffer(int $id): void
{
    $user = currentUserOrFail();
    $userId = (int) $user['id'];

    $data = getJsonInput();
    $price = (float) ($data['price'] ?? 0.0);
    $content = trim((string) ($data['content'] ?? ''));

    if ($price <= 0 || $content === '') {
        jsonResponse(422, ['message' => 'Please enter a valid quoted price and quotation details.']);
    }

    $stmt = database()->prepare('SELECT * FROM service_inquiries WHERE id = :id');
    $stmt->execute(['id' => $id]);
    $inquiry = $stmt->fetch();

    if (!$inquiry) {
        jsonResponse(404, ['message' => 'Inquiry not found.']);
    }

    if ((int) $inquiry['provider_id'] !== $userId) {
        jsonResponse(403, ['message' => 'Only the service provider can send quotations.']);
    }

    $db = database();
    $db->beginTransaction();

    try {
        $stmt = $db->prepare('UPDATE service_inquiries SET status = "offered" WHERE id = :id');
        $stmt->execute(['id' => $id]);

        $stmt = $db->prepare('
            INSERT INTO inquiry_followups (inquiry_id, sender_id, type, content, quoted_price)
            VALUES (:inquiry_id, :sender_id, "offer_sent", :content, :price)
        ');
        $stmt->execute([
            'inquiry_id' => $id,
            'sender_id' => $userId,
            'content' => $content,
            'price' => $price
        ]);

        $db->commit();
        jsonResponse(200, ['message' => 'Quotation sent. Status updated to offered.']);
    } catch (Throwable $e) {
        $db->rollBack();
        jsonResponse(500, ['message' => 'Failed to send offer: ' . $e->getMessage()]);
    }
}

function requestCorrection(int $id): void
{
    $user = currentUserOrFail();
    $userId = (int) $user['id'];

    $data = getJsonInput();
    $content = trim((string) ($data['content'] ?? ''));

    if ($content === '') {
        jsonResponse(422, ['message' => 'Please describe the correction/revising requirements.']);
    }

    $stmt = database()->prepare('SELECT * FROM service_inquiries WHERE id = :id');
    $stmt->execute(['id' => $id]);
    $inquiry = $stmt->fetch();

    if (!$inquiry) {
        jsonResponse(404, ['message' => 'Inquiry not found.']);
    }

    if ((int) $inquiry['customer_id'] !== $userId) {
        jsonResponse(403, ['message' => 'Only the customer can request corrections.']);
    }

    $db = database();
    $db->beginTransaction();

    try {
        $stmt = $db->prepare('UPDATE service_inquiries SET status = "pending" WHERE id = :id');
        $stmt->execute(['id' => $id]);

        $stmt = $db->prepare('
            INSERT INTO inquiry_followups (inquiry_id, sender_id, type, content)
            VALUES (:inquiry_id, :sender_id, "correction_requested", :content)
        ');
        $stmt->execute([
            'inquiry_id' => $id,
            'sender_id' => $userId,
            'content' => $content
        ]);

        $db->commit();
        jsonResponse(200, ['message' => 'Correction requested. Status reset to pending.']);
    } catch (Throwable $e) {
        $db->rollBack();
        jsonResponse(500, ['message' => 'Failed to request correction: ' . $e->getMessage()]);
    }
}

function acceptOffer(int $id): void
{
    $user = currentUserOrFail();
    $userId = (int) $user['id'];

    $stmt = database()->prepare('SELECT * FROM service_inquiries WHERE id = :id');
    $stmt->execute(['id' => $id]);
    $inquiry = $stmt->fetch();

    if (!$inquiry) {
        jsonResponse(404, ['message' => 'Inquiry not found.']);
    }

    if ((int) $inquiry['customer_id'] !== $userId) {
        jsonResponse(403, ['message' => 'Only the customer can accept the offer.']);
    }

    $db = database();
    $db->beginTransaction();

    try {
        $stmt = $db->prepare('UPDATE service_inquiries SET status = "accepted" WHERE id = :id');
        $stmt->execute(['id' => $id]);

        $stmt = $db->prepare('
            INSERT INTO inquiry_followups (inquiry_id, sender_id, type, content)
            VALUES (:inquiry_id, :sender_id, "offer_accepted", "The customer has accepted the quotation. Contact details are now visible to coordinate physical execution.")
        ');
        $stmt->execute([
            'inquiry_id' => $id,
            'sender_id' => $userId
        ]);

        $db->commit();
        jsonResponse(200, ['message' => 'Quotation accepted. Status updated to accepted.']);
    } catch (Throwable $e) {
        $db->rollBack();
        jsonResponse(500, ['message' => 'Failed to accept offer: ' . $e->getMessage()]);
    }
}

function completeWork(int $id): void
{
    $user = currentUserOrFail();
    $userId = (int) $user['id'];

    // Note: Since this endpoint receives images, it must support multipart/form-data.
    // So we read from $_POST instead of JSON input.
    $content = trim((string) ($_POST['content'] ?? ''));

    if ($content === '') {
        jsonResponse(422, ['message' => 'Please provide work completion notes.']);
    }

    $stmt = database()->prepare('SELECT * FROM service_inquiries WHERE id = :id');
    $stmt->execute(['id' => $id]);
    $inquiry = $stmt->fetch();

    if (!$inquiry) {
        jsonResponse(404, ['message' => 'Inquiry not found.']);
    }

    if ((int) $inquiry['provider_id'] !== $userId) {
        jsonResponse(403, ['message' => 'Only the service provider can mark the work as completed.']);
    }

    // Process image uploads to Cloudinary
    $uploadedUrls = [];
    if (isset($_FILES['images']) && is_array($_FILES['images']['tmp_name'])) {
        $files = $_FILES['images'];
        $count = count($files['tmp_name']);
        for ($i = 0; $i < $count; $i++) {
            if ($files['error'][$i] === UPLOAD_ERR_OK) {
                try {
                    $url = uploadToCloudinary($files['tmp_name'][$i], $files['name'][$i], 'Home/Inquiries');
                    $uploadedUrls[] = $url;
                } catch (Throwable $e) {
                    jsonResponse(500, ['message' => 'Failed to upload work image: ' . $e->getMessage()]);
                }
            }
        }
    }

    $db = database();
    $db->beginTransaction();

    try {
        $stmt = $db->prepare('UPDATE service_inquiries SET status = "work_completed" WHERE id = :id');
        $stmt->execute(['id' => $id]);

        $stmt = $db->prepare('
            INSERT INTO inquiry_followups (inquiry_id, sender_id, type, content, images)
            VALUES (:inquiry_id, :sender_id, "work_completed", :content, :images)
        ');
        $stmt->execute([
            'inquiry_id' => $id,
            'sender_id' => $userId,
            'content' => $content,
            'images' => json_encode($uploadedUrls)
        ]);

        $db->commit();
        jsonResponse(200, ['message' => 'Work marked as completed. Customer review requested.']);
    } catch (Throwable $e) {
        $db->rollBack();
        jsonResponse(500, ['message' => 'Failed to complete work: ' . $e->getMessage()]);
    }
}

function confirmCompletion(int $id): void
{
    $user = currentUserOrFail();
    $userId = (int) $user['id'];

    $stmt = database()->prepare('
        SELECT si.*, s.title AS service_title, s.category AS service_category 
        FROM service_inquiries si
        INNER JOIN service_listings s ON s.id = si.service_id
        WHERE si.id = :id
    ');
    $stmt->execute(['id' => $id]);
    $inquiry = $stmt->fetch();

    if (!$inquiry) {
        jsonResponse(404, ['message' => 'Inquiry not found.']);
    }

    if ((int) $inquiry['customer_id'] !== $userId) {
        jsonResponse(403, ['message' => 'Only the customer can confirm the work completion.']);
    }

    // Get the work_completed followup to extract notes and images
    $stmt = database()->prepare('
        SELECT * FROM inquiry_followups 
        WHERE inquiry_id = :inquiry_id AND type = "work_completed"
        ORDER BY created_at DESC LIMIT 1
    ');
    $stmt->execute(['inquiry_id' => $id]);
    $workCompletedFollowup = $stmt->fetch();

    if (!$workCompletedFollowup) {
        jsonResponse(422, ['message' => 'Work completion records not found.']);
    }

    $db = database();
    $db->beginTransaction();

    try {
        $stmt = $db->prepare('UPDATE service_inquiries SET status = "completed" WHERE id = :id');
        $stmt->execute(['id' => $id]);

        $stmt = $db->prepare('
            INSERT INTO inquiry_followups (inquiry_id, sender_id, type, content)
            VALUES (:inquiry_id, :sender_id, "completion_confirmed", "The customer has verified and confirmed the successful completion of the work.")
        ');
        $stmt->execute([
            'inquiry_id' => $id,
            'sender_id' => $userId
        ]);

        // Auto-create Portfolio Entry for the provider!
        $stmt = $db->prepare('
            INSERT INTO portfolios (user_id, inquiry_id, title, category, description, images)
            VALUES (:user_id, :inquiry_id, :title, :category, :description, :images)
        ');
        $stmt->execute([
            'user_id' => $inquiry['provider_id'],
            'inquiry_id' => $id,
            'title' => 'Completed Work: ' . $inquiry['service_title'],
            'category' => $inquiry['service_category'],
            'description' => $workCompletedFollowup['content'],
            'images' => $workCompletedFollowup['images']
        ]);

        $db->commit();
        jsonResponse(200, ['message' => 'Work completion confirmed. Portfolio item created.']);
    } catch (Throwable $e) {
        $db->rollBack();
        jsonResponse(500, ['message' => 'Failed to confirm completion: ' . $e->getMessage()]);
    }
}
