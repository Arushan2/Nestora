<?php

declare(strict_types=1);

/**
 * GET /api/admin/users
 *
 * Query params:
 *   role        = user | admin | service_provider | product_seller
 *   status      = active | banned
 *   pro_status  = pending | approved | rejected
 *   joined      = 7 | 30 | 90   (days ago)
 *   search      = <string>
 */
function listUsers(): void
{
    adminOnly();

    $role      = $_GET['role']       ?? '';
    $status    = $_GET['status']     ?? '';
    $proStatus = $_GET['pro_status'] ?? '';
    $joined    = (int) ($_GET['joined'] ?? 0);
    $search    = trim($_GET['search'] ?? '');

    $conditions = ['1=1'];
    $params     = [];

    if ($role !== '') {
        $allowed = ['user', 'admin', 'service_provider', 'product_seller'];
        if (in_array($role, $allowed, true)) {
            $conditions[] = 'u.role = :role';
            $params['role'] = $role;
        }
    }

    if ($status === 'banned') {
        $conditions[] = 'u.banned_until IS NOT NULL AND u.banned_until > NOW()';
    } elseif ($status === 'active') {
        $conditions[] = '(u.banned_until IS NULL OR u.banned_until <= NOW())';
    }

    if ($proStatus !== '') {
        $allowedPro = ['pending', 'approved', 'rejected'];
        if (in_array($proStatus, $allowedPro, true)) {
            $conditions[] = 'a.status = :pro_status';
            $params['pro_status'] = $proStatus;
        }
    }

    if ($joined > 0) {
        $conditions[] = 'u.created_at >= DATE_SUB(NOW(), INTERVAL :joined_days DAY)';
        $params['joined_days'] = $joined;
    }

    if ($search !== '') {
        $conditions[] = '(u.name LIKE :search OR u.email LIKE :search)';
        $params['search'] = '%' . $search . '%';
    }

    $where = implode(' AND ', $conditions);

    $statement = database()->prepare(
        "SELECT
            u.id,
            u.name,
            u.email,
            u.role,
            u.banned_until,
            u.ban_reason,
            u.created_at,
            a.id            AS application_id,
            a.application_type,
            a.business_name,
            a.status        AS application_status
         FROM users u
         LEFT JOIN pro_applications a ON a.user_id = u.id
         WHERE {$where}
         ORDER BY u.created_at DESC"
    );

    $statement->execute($params);

    jsonResponse(200, [
        'users' => $statement->fetchAll(),
    ]);
}

/**
 * POST /api/admin/users/{id}/ban
 * Body: { reason: string, banned_until: string (ISO datetime) }
 */
function banUser(int $userId): void
{
    adminOnly();

    // Cannot ban another admin
    $target = database()->prepare('SELECT id, role FROM users WHERE id = :id LIMIT 1');
    $target->execute(['id' => $userId]);
    $targetUser = $target->fetch();

    if (!is_array($targetUser)) {
        jsonResponse(404, ['message' => 'User not found.']);
    }

    if ($targetUser['role'] === 'admin') {
        jsonResponse(403, ['message' => 'Cannot ban an administrator account.']);
    }

    $data      = readJson();
    $reason    = trim((string) ($data['reason'] ?? ''));
    $banUntil  = trim((string) ($data['banned_until'] ?? ''));

    if ($reason === '') {
        jsonResponse(422, ['message' => 'A ban reason is required.']);
    }

    if ($banUntil === '') {
        jsonResponse(422, ['message' => 'A ban expiry date is required.']);
    }

    // Validate that the datetime is in the future
    $expiry = strtotime($banUntil);
    if ($expiry === false || $expiry <= time()) {
        jsonResponse(422, ['message' => 'Ban expiry must be a future date and time.']);
    }

    $stmt = database()->prepare(
        'UPDATE users SET banned_until = :banned_until, ban_reason = :ban_reason WHERE id = :id'
    );
    $stmt->execute([
        'banned_until' => date('Y-m-d H:i:s', $expiry),
        'ban_reason'   => $reason,
        'id'           => $userId,
    ]);

    jsonResponse(200, [
        'message'      => 'User has been temporarily banned.',
        'banned_until' => date('Y-m-d H:i:s', $expiry),
    ]);
}

/**
 * POST /api/admin/users/{id}/unban
 */
function unbanUser(int $userId): void
{
    adminOnly();

    $target = database()->prepare('SELECT id FROM users WHERE id = :id LIMIT 1');
    $target->execute(['id' => $userId]);

    if (!is_array($target->fetch())) {
        jsonResponse(404, ['message' => 'User not found.']);
    }

    $stmt = database()->prepare(
        'UPDATE users SET banned_until = NULL, ban_reason = NULL WHERE id = :id'
    );
    $stmt->execute(['id' => $userId]);

    jsonResponse(200, ['message' => 'User ban has been lifted.']);
}
