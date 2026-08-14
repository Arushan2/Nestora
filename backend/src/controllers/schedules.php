<?php

declare(strict_types=1);

require_once __DIR__ . '/../Provider/ProviderContracts.php';
require_once __DIR__ . '/../Provider/ProviderModels.php';
require_once __DIR__ . '/../Provider/ProviderServices.php';

use Nestora\Provider\ProviderController;

function getSchedulesProviderController(): ProviderController
{
    static $controller = null;
    if ($controller === null) {
        $controller = new ProviderController();
    }
    return $controller;
}

function getProviderSchedule(int $providerId): void
{
    getSchedulesProviderController()->handleGetSchedule($providerId);
}

function blockProviderDate(): void
{
    $data = readJson();
    if (empty($data) && !empty($_POST)) {
        $data = $_POST;
    }
    getSchedulesProviderController()->handleBlockDate($data);
}

function unblockProviderDate(): void
{
    $data = readJson();
    if (empty($data) && !empty($_POST)) {
        $data = $_POST;
    }
    getSchedulesProviderController()->handleUnblockDate($data);
}

function updateProviderTeams(): void
{
    $data = readJson();
    if (empty($data) && !empty($_POST)) {
        $data = $_POST;
    }
    getSchedulesProviderController()->handleUpdateTeams($data);
}
