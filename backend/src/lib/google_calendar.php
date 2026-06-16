<?php

declare(strict_types=1);

// Get OAuth config
function getGoogleOAuthConfig(): array
{
    // Redirect URI needs to point to the frontend host (localhost:5173) in local development
    // to preserve the user session cookie during the top-level callback redirect.
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost:8000';
    
    if ($host === 'localhost:8000' || $host === '127.0.0.1:8000') {
        $host = 'localhost:5173';
    }
    
    $proto = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http';
    $redirectUri = $proto . '://' . $host . '/api/auth/google/callback';

    return [
        'client_id' => env('GOOGLE_CLIENT_ID', ''),
        'client_secret' => env('GOOGLE_CLIENT_SECRET', ''),
        'redirect_uri' => $redirectUri
    ];
}

// Check if credentials are set
function isGoogleConfigured(): bool
{
    $config = getGoogleOAuthConfig();
    return !empty($config['client_id']) && !empty($config['client_secret']);
}

// Generate redirect authorization URL
function getGoogleAuthUrl(): string
{
    $config = getGoogleOAuthConfig();
    $params = [
        'client_id' => $config['client_id'],
        'redirect_uri' => $config['redirect_uri'],
        'response_type' => 'code',
        'scope' => 'https://www.googleapis.com/auth/calendar.events',
        'access_type' => 'offline',
        'prompt' => 'consent' // Forces consent screen to get a refresh token
    ];
    return 'https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query($params);
}

// Exchange authorization code for tokens
function exchangeAuthCode(string $code): array
{
    $config = getGoogleOAuthConfig();
    $postFields = [
        'code' => $code,
        'client_id' => $config['client_id'],
        'client_secret' => $config['client_secret'],
        'redirect_uri' => $config['redirect_uri'],
        'grant_type' => 'authorization_code'
    ];

    $ch = curl_init('https://oauth2.googleapis.com/token');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($postFields));
    $response = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);

    if ($status !== 200) {
        throw new Exception('Failed to exchange Google OAuth code: ' . $response);
    }

    return json_decode($response, true);
}

// Refresh access token
function refreshGoogleAccessToken(int $userId, string $refreshToken): array
{
    $config = getGoogleOAuthConfig();
    $postFields = [
        'refresh_token' => $refreshToken,
        'client_id' => $config['client_id'],
        'client_secret' => $config['client_secret'],
        'grant_type' => 'refresh_token'
    ];

    $ch = curl_init('https://oauth2.googleapis.com/token');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($postFields));
    $response = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);

    if ($status !== 200) {
        throw new Exception('Failed to refresh Google access token: ' . $response);
    }

    $data = json_decode($response, true);

    // Update DB
    $db = database();
    $expiresAt = date('Y-m-d H:i:s', time() + (int) ($data['expires_in'] ?? 3600));
    $stmt = $db->prepare('
        UPDATE users 
        SET google_access_token = :access_token, 
            google_token_expires_at = :expires_at 
        WHERE id = :id
    ');
    $stmt->execute([
        'access_token' => $data['access_token'],
        'expires_at' => $expiresAt,
        'id' => $userId
    ]);

    return $data;
}

// Get valid access token (refreshes if close to expiring or expired)
function getValidGoogleAccessToken(int $userId): ?string
{
    $db = database();
    $stmt = $db->prepare('SELECT google_access_token, google_refresh_token, google_token_expires_at FROM users WHERE id = :id');
    $stmt->execute(['id' => $userId]);
    $user = $stmt->fetch();

    if (!$user || empty($user['google_refresh_token'])) {
        return null;
    }

    $expiresAt = $user['google_token_expires_at'] ? strtotime($user['google_token_expires_at']) : 0;
    // Refresh if token will expire within 5 minutes (300 seconds)
    if ($expiresAt - time() < 300) {
        try {
            $data = refreshGoogleAccessToken($userId, $user['google_refresh_token']);
            return $data['access_token'];
        } catch (Throwable $e) {
            return null;
        }
    }

    return $user['google_access_token'];
}

// Sync Event (insert/update)
function syncEventToGoogle(int $userId, string $title, string $dateStr, string $description, ?string $existingEventId = null): ?string
{
    $accessToken = getValidGoogleAccessToken($userId);
    if (!$accessToken) {
        return null;
    }

    // Set dates in YYYY-MM-DD format (Google accepts 'date' => 'YYYY-MM-DD' for all-day events)
    $eventData = [
        'summary' => $title,
        'description' => $description,
        'start' => [
            'date' => $dateStr
        ],
        'end' => [
            // All-day events in Google require end date to be the day after
            'date' => date('Y-m-d', strtotime($dateStr . ' +1 day'))
        ]
    ];

    $url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
    $method = 'POST';

    if ($existingEventId !== null && $existingEventId !== '') {
        $url .= '/' . $existingEventId;
        $method = 'PUT';
    }

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $accessToken,
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($eventData));
    $response = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);

    // If PUT fails with 404, fallback to POST (recreate)
    if ($method === 'PUT' && $status === 404) {
        return syncEventToGoogle($userId, $title, $dateStr, $description, null);
    }

    if ($status !== 200 && $status !== 201) {
        error_log('[Nestora GCal] syncEventToGoogle failed. HTTP ' . $status . ' | URL: ' . $url . ' | Response: ' . $response);
        return null;
    }

    $resData = json_decode($response, true);
    error_log('[Nestora GCal] syncEventToGoogle OK. Event ID: ' . ($resData['id'] ?? 'null'));
    return $resData['id'] ?? null;
}

// Delete Event
function deleteGoogleEvent(int $userId, string $eventId): void
{
    $accessToken = getValidGoogleAccessToken($userId);
    if (!$accessToken || $eventId === '') {
        return;
    }

    $url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events/' . $eventId;
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'DELETE');
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $accessToken
    ]);
    curl_exec($ch);
}
