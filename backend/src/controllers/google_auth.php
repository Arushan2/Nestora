<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/google_calendar.php';

function redirectToGoogle(): void
{
    // Make sure we have credentials configured
    if (!isGoogleConfigured()) {
        echo "Google Calendar integration client credentials (GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET) are not configured in your environment variables (.env). Please add them to proceed.";
        exit;
    }

    $url = getGoogleAuthUrl();
    header('Location: ' . $url);
    exit;
}

function handleGoogleCallback(): void
{
    $user = currentUser();
    
    // Fallback redirect URL
    $frontendUrl = 'http://localhost:5173/dashboard';

    if (!$user) {
        header('Location: ' . $frontendUrl . '?google_error=session_expired');
        exit;
    }

    $code = $_GET['code'] ?? '';
    if ($code === '') {
        $error = $_GET['error'] ?? 'unknown_error';
        header('Location: ' . $frontendUrl . '?google_error=' . urlencode($error));
        exit;
    }

    try {
        $tokens = exchangeAuthCode($code);

        $db = database();
        $expiresAt = date('Y-m-d H:i:s', time() + (int) ($tokens['expires_in'] ?? 3600));

        // Note: Google only sends the refresh_token on the first authorization.
        // Since we force prompt=consent, it will always send a refresh_token.
        // We preserve the old refresh token if Google didn't send a new one.
        if (isset($tokens['refresh_token'])) {
            $stmt = $db->prepare('
                UPDATE users 
                SET google_access_token = :access, 
                    google_refresh_token = :refresh, 
                    google_token_expires_at = :expires 
                WHERE id = :id
            ');
            $stmt->execute([
                'access' => $tokens['access_token'],
                'refresh' => $tokens['refresh_token'],
                'expires' => $expiresAt,
                'id' => $user['id']
            ]);
        } else {
            $stmt = $db->prepare('
                UPDATE users 
                SET google_access_token = :access, 
                    google_token_expires_at = :expires 
                WHERE id = :id
            ');
            $stmt->execute([
                'access' => $tokens['access_token'],
                'expires' => $expiresAt,
                'id' => $user['id']
            ]);
        }

        // Determine destination based on role (default is dashboard)
        $dest = $frontendUrl . '?tab=calendar&google_success=1';
        header('Location: ' . $dest);
        exit;
    } catch (Throwable $e) {
        header('Location: ' . $frontendUrl . '?google_error=' . urlencode($e->getMessage()));
        exit;
    }
}

function disconnectGoogle(): void
{
    $user = currentUserOrFail();

    $db = database();
    
    // First, let's delete their calendar tokens
    $stmt = $db->prepare('
        UPDATE users 
        SET google_access_token = NULL, 
            google_refresh_token = NULL, 
            google_token_expires_at = NULL 
        WHERE id = :id
    ');
    $stmt->execute(['id' => $user['id']]);

    jsonResponse(200, ['message' => 'Google Calendar disconnected successfully.']);
}

function getGoogleConnectionStatus(): void
{
    $user = currentUser();
    if (!$user) {
        jsonResponse(200, ['connected' => false, 'configured' => isGoogleConfigured()]);
    }

    $db = database();
    $stmt = $db->prepare('SELECT google_refresh_token FROM users WHERE id = :id');
    $stmt->execute(['id' => $user['id']]);
    $u = $stmt->fetch();

    $connected = $u && !empty($u['google_refresh_token']);

    jsonResponse(200, [
        'connected' => $connected,
        'configured' => isGoogleConfigured()
    ]);
}
