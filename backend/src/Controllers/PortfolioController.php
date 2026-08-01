<?php

declare(strict_types=1);

namespace Nestora\Controllers;

use Nestora\Core\Base\AbstractController;
use Nestora\Core\Http\Request;
use Nestora\Core\Http\Response;

class PortfolioController extends AbstractController
{
    public function list(Request $request): Response
    {
        $userId = (int) $request->getQuery('user_id', 0);

        if ($userId <= 0) {
            $user = $this->currentUser($request);
            if ($user) {
                $userId = (int) $user['id'];
            }
        }

        if ($userId <= 0) {
            return $this->error(422, 'User ID is required to fetch portfolios.');
        }

        $portfolios = $this->db->fetchAll('
            SELECT * FROM portfolios 
            WHERE user_id = :user_id 
            ORDER BY created_at DESC
        ', ['user_id' => $userId]);

        foreach ($portfolios as &$p) {
            if (!empty($p['images'])) {
                $p['images'] = json_decode((string) $p['images'], true);
            } else {
                $p['images'] = [];
            }
        }

        return $this->json(200, ['portfolios' => $portfolios]);
    }
}
