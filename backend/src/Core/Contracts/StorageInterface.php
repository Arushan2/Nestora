<?php

declare(strict_types=1);

namespace Nestora\Core\Contracts;

interface StorageInterface
{
    public function upload(string $filePath, string $originalName): string;
}
