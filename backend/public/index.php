<?php

declare(strict_types=1);

require_once __DIR__ . '/../src/bootstrap.php';
require_once __DIR__ . '/../src/controllers/auth.php';
require_once __DIR__ . '/../src/controllers/applications.php';
require_once __DIR__ . '/../src/controllers/service_listings.php';
require_once __DIR__ . '/../src/controllers/product_listings.php';
require_once __DIR__ . '/../src/controllers/profiles.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: http://localhost:5173');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET' && $path === '/api/health') {
    jsonResponse(200, ['status' => 'ok']);
}

if ($method === 'GET' && $path === '/api/auth/me') {
    authMe();
}

if ($method === 'POST' && $path === '/api/auth/register') {
    authRegister();
}

if ($method === 'POST' && $path === '/api/auth/login') {
    authLogin();
}

if ($method === 'POST' && $path === '/api/auth/logout') {
    authLogout();
}

if ($method === 'POST' && $path === '/api/auth/verify-otp') {
    authVerifyOtp();
}

if ($method === 'POST' && $path === '/api/auth/forgot-password') {
    authForgotPassword();
}

if ($method === 'POST' && $path === '/api/auth/reset-password') {
    authResetPassword();
}

if ($method === 'POST' && $path === '/api/pro-applications') {
    createProApplication();
}

if ($method === 'GET' && $path === '/api/admin/pending-applications') {
    listPendingApplications();
}

if ($method === 'POST' && preg_match('#^/api/admin/applications/(\d+)/approve$#', $path, $matches) === 1) {
    approveApplication((int) $matches[1]);
}

if ($method === 'GET' && $path === '/api/service-listings') {
    listServiceListings();
}

if ($method === 'GET' && preg_match('#^/api/service-listings/(\d+)$#', $path, $matches) === 1) {
    getServiceListing((int) $matches[1]);
}

if ($method === 'POST' && $path === '/api/service-listings') {
    createServiceListing();
}

if ($method === 'POST' && preg_match('#^/api/service-listings/(\d+)/update$#', $path, $matches) === 1) {
    updateServiceListing((int) $matches[1]);
}

if ($method === 'POST' && preg_match('#^/api/service-listings/(\d+)/delete$#', $path, $matches) === 1) {
    deleteServiceListing((int) $matches[1]);
}

if ($method === 'GET' && $path === '/api/product-listings') {
    listProductListings();
}

if ($method === 'GET' && preg_match('#^/api/product-listings/(\d+)$#', $path, $matches) === 1) {
    getProductListing((int) $matches[1]);
}

if ($method === 'POST' && $path === '/api/product-listings') {
    createProductListing();
}

if ($method === 'POST' && preg_match('#^/api/product-listings/(\d+)/update$#', $path, $matches) === 1) {
    updateProductListing((int) $matches[1]);
}

if ($method === 'POST' && preg_match('#^/api/product-listings/(\d+)/delete$#', $path, $matches) === 1) {
    deleteProductListing((int) $matches[1]);
}

if ($method === 'GET' && $path === '/api/profiles') {
    listProfiles();
}

if ($method === 'GET' && preg_match('#^/api/profiles/(\d+)$#', $path, $matches) === 1) {
    getProfile((int) $matches[1]);
}

if ($method === 'POST' && $path === '/api/profile/update') {
    updateProfile();
}

jsonResponse(404, ['message' => 'Route not found.']);
