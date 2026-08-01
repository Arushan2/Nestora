<?php

declare(strict_types=1);

namespace Nestora\Models;

use Nestora\Core\Base\AbstractModel;

class ProApplication extends AbstractModel
{
    public function getId(): int
    {
        return (int) $this->get('id', 0);
    }

    public function getUserId(): int
    {
        return (int) $this->get('user_id', 0);
    }

    public function getApplicationType(): string
    {
        return (string) $this->get('application_type', '');
    }

    public function getStatus(): string
    {
        return (string) $this->get('status', 'pending');
    }

    public function isPending(): bool
    {
        return $this->getStatus() === 'pending';
    }

    public function isApproved(): bool
    {
        return $this->getStatus() === 'approved';
    }
}
