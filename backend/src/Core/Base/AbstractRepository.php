<?php

declare(strict_types=1);

namespace Nestora\Core\Base;

use Nestora\Core\Contracts\RepositoryInterface;
use Nestora\Core\Database\DatabaseConnection;

abstract class AbstractRepository implements RepositoryInterface
{
    protected DatabaseConnection $db;
    protected string $table;
    protected string $primaryKey = 'id';

    public function __construct()
    {
        $this->db = DatabaseConnection::getInstance();
    }

    public function find(int $id): ?array
    {
        $sql = sprintf('SELECT * FROM `%s` WHERE `%s` = :id LIMIT 1', $this->table, $this->primaryKey);
        return $this->db->fetch($sql, ['id' => $id]);
    }

    public function findAll(array $conditions = [], string $orderBy = 'id DESC'): array
    {
        $whereClauses = [];
        $params = [];

        foreach ($conditions as $column => $value) {
            $whereClauses[] = sprintf('`%s` = :%s', $column, $column);
            $params[$column] = $value;
        }

        $sql = sprintf('SELECT * FROM `%s`', $this->table);
        if (!empty($whereClauses)) {
            $sql .= ' WHERE ' . implode(' AND ', $whereClauses);
        }

        if (!empty($orderBy)) {
            $sql .= ' ORDER BY ' . $orderBy;
        }

        return $this->db->fetchAll($sql, $params);
    }

    public function create(array $data): int
    {
        $columns = array_keys($data);
        $placeholders = array_map(fn($col) => ':' . $col, $columns);

        $sql = sprintf(
            'INSERT INTO `%s` (`%s`) VALUES (%s)',
            $this->table,
            implode('`, `', $columns),
            implode(', ', $placeholders)
        );

        $this->db->query($sql, $data);
        return (int) $this->db->lastInsertId();
    }

    public function update(int $id, array $data): bool
    {
        $setClauses = [];
        $params = ['id' => $id];

        foreach ($data as $column => $value) {
            $setClauses[] = sprintf('`%s` = :%s', $column, $column);
            $params[$column] = $value;
        }

        $sql = sprintf(
            'UPDATE `%s` SET %s WHERE `%s` = :id',
            $this->table,
            implode(', ', $setClauses),
            $this->primaryKey
        );

        $stmt = $this->db->query($sql, $params);
        return $stmt->rowCount() > 0;
    }

    public function delete(int $id): bool
    {
        $sql = sprintf('DELETE FROM `%s` WHERE `%s` = :id', $this->table, $this->primaryKey);
        $stmt = $this->db->query($sql, ['id' => $id]);
        return $stmt->rowCount() > 0;
    }
}
