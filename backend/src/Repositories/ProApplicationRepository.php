<?php

declare(strict_types=1);

namespace Nestora\Repositories;

use Nestora\Core\Base\AbstractRepository;

class ProApplicationRepository extends AbstractRepository
{
    protected string $table = 'pro_applications';

    public function findByUserId(int $userId): ?array
    {
        return $this->db->fetch('SELECT * FROM pro_applications WHERE user_id = :user_id LIMIT 1', [
            'user_id' => $userId
        ]);
    }

    public function findPendingWithUser(): array
    {
        $sql = 'SELECT a.*, u.name as applicant_name, u.email as applicant_email 
                FROM pro_applications a 
                JOIN users u ON a.user_id = u.id 
                WHERE a.status = "pending" 
                ORDER BY a.created_at DESC';
        return $this->db->fetchAll($sql);
    }
}
