<?php

declare(strict_types=1);

require_once __DIR__ . '/../Auth/AuthContracts.php';
require_once __DIR__ . '/../Auth/AuthModels.php';
require_once __DIR__ . '/../Auth/AuthServices.php';
require_once __DIR__ . '/../lib/mail.php';

use Nestora\Auth\AuthController;

function getAuthController(): AuthController
{
    static $controller = null;
    if ($controller === null) {
        $controller = new AuthController();
    }
    return $controller;
}

// ─── Procedural Delegates to OOP AuthController ───────────────────────────────

function authMe(): void
{
    getAuthController()->handleMe();
}

function authRegister(): void
{
    getAuthController()->handleRegister(readJson());
}

function authVerifyOtp(): void
{
    getAuthController()->handleVerifyOtp(readJson());
}

function authLogin(): void
{
    getAuthController()->handleLogin(readJson());
}

function authForgotPassword(): void
{
    getAuthController()->handleForgotPassword(readJson());
}

function authResetPassword(): void
{
    getAuthController()->handleResetPassword(readJson());
}

function authLogout(): void
{
    getAuthController()->handleLogout();
}
