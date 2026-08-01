<?php

declare(strict_types=1);

namespace Nestora\Controllers;

use Nestora\Core\Base\AbstractController;
use Nestora\Core\Http\Request;
use Nestora\Core\Http\Response;
use Throwable;

class GoogleAuthController extends AbstractController
{
    public function __construct()
    {
        parent::__construct();
        require_once __DIR__ . '/../lib/google_calendar.php';
    }

    public function redirect(Request $request): Response
    {
        if (!isGoogleConfigured()) {
            return $this->error(500, 'Google Calendar client credentials (GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET) are not configured.');
        }

        $url = getGoogleAuthUrl();
        header('Location: ' . $url);
        exit;
    }

    public function callback(Request $request): Response
    {
        $user = $this->currentUser($request);
        $frontendUrl = 'http://localhost:5173/dashboard';

        if (!$user) {
            header('Location: ' . $frontendUrl . '?google_error=session_expired');
            exit;
        }

        $code = (string) $request->getQuery('code', '');
        if ($code === '') {
            $error = (string) $request->getQuery('error', 'unknown_error');
            header('Location: ' . $frontendUrl . '?google_error=' . urlencode($error));
            exit;
        }

        try {
            $tokens = exchangeAuthCode($code);
            $expiresAt = date('Y-m-d H:i:s', time() + (int) ($tokens['expires_in'] ?? 3600));

            if (isset($tokens['refresh_token'])) {
                $this->db->query('
                    UPDATE users 
                    SET google_access_token = :access, 
                        google_refresh_token = :refresh, 
                        google_token_expires_at = :expires 
                    WHERE id = :id
                ', [
                    'access' => $tokens['access_token'],
                    'refresh' => $tokens['refresh_token'],
                    'expires' => $expiresAt,
                    'id' => $user['id']
                ]);
            } else {
                $this->db->query('
                    UPDATE users 
                    SET google_access_token = :access, 
                        google_token_expires_at = :expires 
                    WHERE id = :id
                ', [
                    'access' => $tokens['access_token'],
                    'expires' => $expiresAt,
                    'id' => $user['id']
                ]);
            }

            $dest = $frontendUrl . '?tab=calendar&google_success=1';
            header('Location: ' . $dest);
            exit;
        } catch (Throwable $e) {
            header('Location: ' . $frontendUrl . '?google_error=' . urlencode($e->getMessage()));
            exit;
        }
    }

    public function disconnect(Request $request): Response
    {
        $user = $this->currentUserOrFail($request);

        $this->db->query('
            UPDATE users 
            SET google_access_token = NULL, 
                google_refresh_token = NULL, 
                google_token_expires_at = NULL 
            WHERE id = :id
        ', ['id' => $user['id']]);

        return $this->json(200, ['message' => 'Google Calendar disconnected successfully.']);
    }

    public function status(Request $request): Response
    {
        $user = $this->currentUser($request);
        if (!$user) {
            return $this->json(200, ['connected' => false, 'configured' => isGoogleConfigured()]);
        }

        $u = $this->db->fetch('SELECT google_refresh_token FROM users WHERE id = :id', ['id' => $user['id']]);
        $connected = $u && !empty($u['google_refresh_token']);

        return $this->json(200, [
            'connected' => $connected,
            'configured' => isGoogleConfigured()
        ]);
    }
}
