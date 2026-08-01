<?php

declare(strict_types=1);

namespace Nestora\Core\Contracts;

use PDO;
use PDOStatement;

interface DatabaseInterface
{
    public function getPdo(): PDO;
    public function query(string $sql, array $params = []): PDOStatement;
    public function fetch(string $sql, array $params = []): ?array;
    public function fetchAll(string $sql, array $params = []): array;
    public function lastInsertId(): string|int;
    public function beginTransaction(): bool;
    public function commit(): bool;
    public function rollBack(): bool;
}
