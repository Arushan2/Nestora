<?php

declare(strict_types=1);

namespace Nestora\Controllers;

use Nestora\Core\Base\AbstractController;
use Nestora\Core\Http\Request;
use Nestora\Core\Http\Response;
use Throwable;

class ScheduleController extends AbstractController
{
    public function __construct()
    {
        parent::__construct();
        require_once __DIR__ . '/../lib/google_calendar.php';
    }

    public function getSchedule(Request $request, int $providerId): Response
    {
        $app = $this->db->fetch('SELECT teams_count FROM pro_applications WHERE user_id = :user_id LIMIT 1', ['user_id' => $providerId]);
        $teamsCount = $app ? (int) $app['teams_count'] : 1;

        $inquiries = $this->db->fetchAll('
            SELECT id, booking_date, status, customer_id 
            FROM service_inquiries 
            WHERE provider_id = :provider_id AND booking_date IS NOT NULL AND status != "completed"
        ', ['provider_id' => $providerId]);

        foreach ($inquiries as &$inq) {
            $inq['id'] = (int) $inq['id'];
            $inq['customer_id'] = (int) $inq['customer_id'];
        }

        $schedules = $this->db->fetchAll('
            SELECT id, event_date, type, notes 
            FROM provider_schedules 
            WHERE provider_id = :provider_id
        ', ['provider_id' => $providerId]);

        foreach ($schedules as &$sch) {
            $sch['id'] = (int) $sch['id'];
        }

        return $this->json(200, [
            'teams_count' => $teamsCount,
            'inquiries' => $inquiries,
            'schedules' => $schedules
        ]);
    }

    public function blockDate(Request $request): Response
    {
        $user = $this->currentUserOrFail($request);
        if ($user['role'] !== 'service_provider') {
            return $this->error(403, 'Only service providers can manage their schedule blocks.');
        }

        $providerId = (int) $user['id'];
        $data = $request->getBody();

        $eventDate = trim((string) ($data['event_date'] ?? ''));
        $type = trim((string) ($data['type'] ?? ''));
        $notes = trim((string) ($data['notes'] ?? ''));

        if ($eventDate === '' || !in_array($type, ['leave', 'manual_work'], true)) {
            return $this->error(422, 'Valid event date and type (leave or manual_work) are required.');
        }

        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $eventDate) !== 1) {
            return $this->error(422, 'Event date must be in YYYY-MM-DD format.');
        }

        $existing = $this->db->fetch('SELECT google_event_id FROM provider_schedules WHERE provider_id = :provider_id AND event_date = :date AND type = :type', [
            'provider_id' => $providerId,
            'date' => $eventDate,
            'type' => $type
        ]);
        $existingEventId = $existing ? $existing['google_event_id'] : null;

        $this->db->query('
            INSERT INTO provider_schedules (provider_id, event_date, type, notes)
            VALUES (:provider_id, :event_date, :type, :notes)
            ON DUPLICATE KEY UPDATE notes = :notes
        ', [
            'provider_id' => $providerId,
            'event_date' => $eventDate,
            'type' => $type,
            'notes' => $notes !== '' ? $notes : null
        ]);

        try {
            $title = $type === 'leave' ? 'Nestora Block: Leave Day' : 'Nestora Block: Manual Work Booking';
            $desc = $notes !== '' ? $notes : ($type === 'leave' ? 'Provider is on leave / out of office.' : 'Manual work slot booked on Nestora.');
            $googleEventId = syncEventToGoogle($providerId, $title, $eventDate, $desc, $existingEventId);
            
            if ($googleEventId && $googleEventId !== $existingEventId) {
                $this->db->query('UPDATE provider_schedules SET google_event_id = :event_id WHERE provider_id = :provider_id AND event_date = :date AND type = :type', [
                    'event_id' => $googleEventId,
                    'provider_id' => $providerId,
                    'date' => $eventDate,
                    'type' => $type
                ]);
            }
        } catch (Throwable $syncError) {
            // Ignore optional sync error
        }

        return $this->json(200, ['message' => 'Schedule updated successfully.']);
    }

    public function unblockDate(Request $request): Response
    {
        $user = $this->currentUserOrFail($request);
        if ($user['role'] !== 'service_provider') {
            return $this->error(403, 'Only service providers can manage their schedule blocks.');
        }

        $providerId = (int) $user['id'];
        $data = $request->getBody();

        $eventDate = trim((string) ($data['event_date'] ?? $request->getQuery('event_date', '')));
        $type = trim((string) ($data['type'] ?? $request->getQuery('type', '')));

        if ($eventDate === '' || !in_array($type, ['leave', 'manual_work'], true)) {
            return $this->error(422, 'Valid event date and type are required.');
        }

        $block = $this->db->fetch('SELECT google_event_id FROM provider_schedules WHERE provider_id = :provider_id AND event_date = :date AND type = :type', [
            'provider_id' => $providerId,
            'date' => $eventDate,
            'type' => $type
        ]);

        if ($block && !empty($block['google_event_id'])) {
            try {
                deleteGoogleEvent($providerId, $block['google_event_id']);
            } catch (Throwable $e) {
                // Ignore optional error
            }
        }

        $this->db->query('
            DELETE FROM provider_schedules 
            WHERE provider_id = :provider_id AND event_date = :event_date AND type = :type
        ', [
            'provider_id' => $providerId,
            'event_date' => $eventDate,
            'type' => $type
        ]);

        return $this->json(200, ['message' => 'Schedule block removed successfully.']);
    }

    public function updateTeams(Request $request): Response
    {
        $user = $this->currentUserOrFail($request);
        if ($user['role'] !== 'service_provider') {
            return $this->error(403, 'Only service providers can set their team capacity.');
        }

        $providerId = (int) $user['id'];
        $data = $request->getBody();
        $teamsCount = isset($data['teams_count']) ? (int) $data['teams_count'] : 1;

        if ($teamsCount < 1) {
            return $this->error(422, 'Teams count must be at least 1.');
        }

        $this->db->query('
            UPDATE pro_applications 
            SET teams_count = :teams_count 
            WHERE user_id = :user_id
        ', [
            'teams_count' => $teamsCount,
            'user_id' => $providerId
        ]);

        return $this->json(200, ['message' => 'Teams capacity updated successfully.']);
    }
}
