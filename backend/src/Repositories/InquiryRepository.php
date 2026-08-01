<?php

declare(strict_types=1);

namespace Nestora\Repositories;

use Nestora\Core\Base\AbstractRepository;

class InquiryRepository extends AbstractRepository
{
    protected string $table = 'service_inquiries';
}
