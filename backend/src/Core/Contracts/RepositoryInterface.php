<?php

declare(strict_types=1);

namespace Nestora\Core\Contracts;

interface RepositoryInterface
{
    public function find(int $id): ?array;
    public function findAll(array $conditions = [], string $orderBy = 'id DESC'): array;
    public function create(array $data): int;
    public function update(int $id, array $data): bool;
    public function delete(int $id): bool;
}
