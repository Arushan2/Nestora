<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/google_calendar.php';

function getProviderSchedule(int $providerId): void
{
    // Fetch provider's teams_count
    $stmt = database()->prepare('SELECT teams_count FROM pro_applications WHERE user_id = :user_id LIMIT 1');
    $stmt->execute(['user_id' => $providerId]);
    $app = $stmt->fetch();
    $teamsCount = $app ? (int) $app['teams_count'] : 1;

    // Fetch active inquiries (ongoing schedule slots)
    $stmt = database()->prepare('
        SELECT id, booking_date, status, customer_id 
        FROM service_inquiries 
        WHERE provider_id = :provider_id AND booking_date IS NOT NULL AND status != "completed"
    ');
    $stmt->execute(['provider_id' => $providerId]);
    $inquiries = $stmt->fetchAll();

    foreach ($inquiries as &$inq) {
        $inq['id'] = (int) $inq['id'];
        $inq['customer_id'] = (int) $inq['customer_id'];
    }

    // Fetch manual schedule overrides (leaves, manual works)
    $stmt = database()->prepare('
        SELECT id, event_date, type, notes 
        FROM provider_schedules 
        WHERE provider_id = :provider_id
    ');
    $stmt->execute(['provider_id' => $providerId]);
    $schedules = $stmt->fetchAll();

    foreach ($schedules as &$sch) {
        $sch['id'] = (int) $sch['id'];
    }

    jsonResponse(200, [
        'teams_count' => $teamsCount,
        'inquiries' => $inquiries,
        'schedules' => $schedules
    ]);
}

function blockProviderDate(): void
{
    $user = currentUserOrFail();
    if ($user['role'] !== 'service_provider') {
        jsonResponse(403, ['message' => 'Only service providers can manage their schedule blocks.']);
    }
    $providerId = (int) $user['id'];

    $data = readJson();
    if (empty($data) && !empty($_POST)) {
        $data = $_POST;
    }

    $eventDate = trim((string) ($data['event_date'] ?? ''));
    $type = trim((string) ($data['type'] ?? '')); // 'leave' or 'manual_work'
    $notes = trim((string) ($data['notes'] ?? ''));

    if ($eventDate === '' || !in_array($type, ['leave', 'manual_work'], true)) {
        jsonResponse(422, ['message' => 'Valid event date and type (leave or manual_work) are required.']);
    }

    // Validate date format YYYY-MM-DD
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $eventDate) !== 1) {
        jsonResponse(422, ['message' => 'Event date must be in YYYY-MM-DD format.']);
    }

    $db = database();

    // Check if there is an existing block to preserve/get the google_event_id
    $checkStmt = $db->prepare('SELECT google_event_id FROM provider_schedules WHERE provider_id = :provider_id AND event_date = :date AND type = :type');
    $checkStmt->execute(['provider_id' => $providerId, 'date' => $eventDate, 'type' => $type]);
    $existing = $checkStmt->fetch();
    $existingEventId = $existing ? $existing['google_event_id'] : null;

    $stmt = $db->prepare('
        INSERT INTO provider_schedules (provider_id, event_date, type, notes)
        VALUES (:provider_id, :event_date, :type, :notes)
        ON DUPLICATE KEY UPDATE notes = :notes
    ');
    $stmt->execute([
        'provider_id' => $providerId,
        'event_date' => $eventDate,
        'type' => $type,
        'notes' => $notes !== '' ? $notes : null
    ]);

    // Google Calendar sync trigger
    try {
        $title = $type === 'leave' ? 'Nestora Block: Leave Day' : 'Nestora Block: Manual Work Booking';
        $desc = $notes !== '' ? $notes : ($type === 'leave' ? 'Provider is on leave / out of office.' : 'Manual work slot booked on Nestora.');
        $googleEventId = syncEventToGoogle($providerId, $title, $eventDate, $desc, $existingEventId);
        
        if ($googleEventId && $googleEventId !== $existingEventId) {
            $upStmt = $db->prepare('UPDATE provider_schedules SET google_event_id = :event_id WHERE provider_id = :provider_id AND event_date = :date AND type = :type');
            $upStmt->execute(['event_id' => $googleEventId, 'provider_id' => $providerId, 'date' => $eventDate, 'type' => $type]);
        }
    } catch (Throwable $syncError) {
        // Safe ignore
    }

    jsonResponse(200, ['message' => 'Schedule updated successfully.']);
}

function unblockProviderDate(): void
{
    $user = currentUserOrFail();
    if ($user['role'] !== 'service_provider') {
        jsonResponse(403, ['message' => 'Only service providers can manage their schedule blocks.']);
    }
    $providerId = (int) $user['id'];

    $data = readJson();
    if (empty($data) && !empty($_POST)) {
        $data = $_POST;
    }

    $eventDate = trim((string) ($data['event_date'] ?? $_GET['event_date'] ?? ''));
    $type = trim((string) ($data['type'] ?? $_GET['type'] ?? ''));

    if ($eventDate === '' || !in_array($type, ['leave', 'manual_work'], true)) {
        jsonResponse(422, ['message' => 'Valid event date and type are required.']);
    }

    $db = database();
    
    // Fetch google_event_id before delete
    $stmt = $db->prepare('SELECT google_event_id FROM provider_schedules WHERE provider_id = :provider_id AND event_date = :date AND type = :type');
    $stmt->execute(['provider_id' => $providerId, 'date' => $eventDate, 'type' => $type]);
    $block = $stmt->fetch();

    if ($block && !empty($block['google_event_id'])) {
        try {
            deleteGoogleEvent($providerId, $block['google_event_id']);
        } catch (Throwable $e) {
            // Safe ignore
        }
    }

    $stmt = $db->prepare('
        DELETE FROM provider_schedules 
        WHERE provider_id = :provider_id AND event_date = :event_date AND type = :type
    ');
    $stmt->execute([
        'provider_id' => $providerId,
        'event_date' => $eventDate,
        'type' => $type
    ]);

    jsonResponse(200, ['message' => 'Schedule block removed successfully.']);
}

function updateProviderTeams(): void
{
    $user = currentUserOrFail();
    if ($user['role'] !== 'service_provider') {
        jsonResponse(403, ['message' => 'Only service providers can set their team capacity.']);
    }
    $providerId = (int) $user['id'];

    $data = readJson();
    if (empty($data) && !empty($_POST)) {
        $data = $_POST;
    }

    $teamsCount = isset($data['teams_count']) ? (int) $data['teams_count'] : 1;

    if ($teamsCount < 1) {
        jsonResponse(422, ['message' => 'Teams count must be at least 1.']);
    }

    $db = database();
    $stmt = $db->prepare('
        UPDATE pro_applications 
        SET teams_count = :teams_count 
        WHERE user_id = :user_id
    ');
    $stmt->execute([
        'teams_count' => $teamsCount,
        'user_id' => $providerId
    ]);

    jsonResponse(200, ['message' => 'Teams capacity updated successfully.']);
}
