<?php

declare(strict_types=1);

require_once __DIR__ . '/../src/bootstrap.php';
require_once __DIR__ . '/../src/controllers/auth.php';
require_once __DIR__ . '/../src/controllers/applications.php';
require_once __DIR__ . '/../src/controllers/users.php';
require_once __DIR__ . '/../src/controllers/service_listings.php';
require_once __DIR__ . '/../src/controllers/product_listings.php';
require_once __DIR__ . '/../src/controllers/profiles.php';
require_once __DIR__ . '/../src/controllers/orders.php';
require_once __DIR__ . '/../src/controllers/inquiries.php';
require_once __DIR__ . '/../src/controllers/portfolios.php';
require_once __DIR__ . '/../src/controllers/schedules.php';
require_once __DIR__ . '/../src/controllers/google_auth.php';
require_once __DIR__ . '/../src/controllers/subscriptions.php';
require_once __DIR__ . '/../src/controllers/analytics.php';
require_once __DIR__ . '/../src/controllers/notifications.php';

header('Content-Type: application/json; charset=utf-8');

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin === 'http://localhost:5173') {
    header('Access-Control-Allow-Origin: http://localhost:5173');
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
}

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

if ($method === 'POST' && $path === '/api/webhooks/stripe') {
    handleStripeWebhook();
}

if ($method === 'POST' && $path === '/api/subscriptions/portal') {
    createPortalSession();
}

if ($method === 'GET' && $path === '/api/admin/pending-applications') {
    listPendingApplications();
}

if ($method === 'POST' && preg_match('#^/api/admin/applications/(\d+)/approve$#', $path, $matches) === 1) {
    approveApplication((int) $matches[1]);
}

if ($method === 'GET' && $path === '/api/admin/users') {
    listUsers();
}

if ($method === 'POST' && preg_match('#^/api/admin/users/(\d+)/ban$#', $path, $matches) === 1) {
    banUser((int) $matches[1]);
}

if ($method === 'POST' && preg_match('#^/api/admin/users/(\d+)/unban$#', $path, $matches) === 1) {
    unbanUser((int) $matches[1]);
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

if ($method === 'POST' && $path === '/api/analytics/log') {
    logAnalyticsEvent();
}

if ($method === 'GET' && $path === '/api/analytics/dashboard') {
    getAnalyticsDashboard();
}

if ($method === 'POST' && $path === '/api/orders') {
    createOrder();
}

if ($method === 'GET' && $path === '/api/orders') {
    listMyOrders();
}

if ($method === 'GET' && $path === '/api/orders/seller') {
    listSellerOrders();
}

if ($method === 'POST' && preg_match('#^/api/orders/([^/]+)/ship$#', $path, $matches) === 1) {
    shipOrder(urldecode($matches[1]));
}

if ($method === 'POST' && preg_match('#^/api/orders/([^/]+)/verify$#', $path, $matches) === 1) {
    verifyPayment(urldecode($matches[1]));
}

if ($method === 'POST' && preg_match('#^/api/orders/([^/]+)/complete$#', $path, $matches) === 1) {
    completeOrder(urldecode($matches[1]));
}

if ($method === 'POST' && preg_match('#^/api/orders/([^/]+)/flag-missing$#', $path, $matches) === 1) {
    flagNotReceived(urldecode($matches[1]));
}

if ($method === 'POST' && preg_match('#^/api/products/(\d+)/reviews$#', $path, $matches) === 1) {
    createProductReview((int) $matches[1]);
}

if ($method === 'GET' && preg_match('#^/api/products/(\d+)/reviews$#', $path, $matches) === 1) {
    getProductReviews((int) $matches[1]);
}

if ($method === 'POST' && $path === '/api/profile/update') {
    updateProfile();
}

// Service Inquiry Routes
if ($method === 'POST' && $path === '/api/inquiries') {
    createInquiry();
}

if ($method === 'GET' && $path === '/api/inquiries') {
    listInquiries();
}

if ($method === 'GET' && preg_match('#^/api/inquiries/(\d+)$#', $path, $matches) === 1) {
    getInquiry((int) $matches[1]);
}

if ($method === 'POST' && preg_match('#^/api/inquiries/(\d+)/request-details$#', $path, $matches) === 1) {
    requestDetails((int) $matches[1]);
}

if ($method === 'POST' && preg_match('#^/api/inquiries/(\d+)/reply-details$#', $path, $matches) === 1) {
    replyDetails((int) $matches[1]);
}

if ($method === 'POST' && preg_match('#^/api/inquiries/(\d+)/offer$#', $path, $matches) === 1) {
    sendOffer((int) $matches[1]);
}

if ($method === 'POST' && preg_match('#^/api/inquiries/(\d+)/request-correction$#', $path, $matches) === 1) {
    requestCorrection((int) $matches[1]);
}

if ($method === 'POST' && preg_match('#^/api/inquiries/(\d+)/accept$#', $path, $matches) === 1) {
    acceptOffer((int) $matches[1]);
}

if ($method === 'POST' && preg_match('#^/api/inquiries/(\d+)/complete-work$#', $path, $matches) === 1) {
    completeWork((int) $matches[1]);
}

if ($method === 'POST' && preg_match('#^/api/inquiries/(\d+)/confirm$#', $path, $matches) === 1) {
    confirmCompletion((int) $matches[1]);
}

// Portfolio Routes
if ($method === 'GET' && $path === '/api/portfolios') {
    listPortfolios();
}

// Schedule / Calendar Routes
if ($method === 'GET' && preg_match('#^/api/providers/(\d+)/schedule$#', $path, $matches) === 1) {
    getProviderSchedule((int) $matches[1]);
}

if ($method === 'POST' && $path === '/api/provider/schedule/block') {
    blockProviderDate();
}

if ($method === 'POST' && $path === '/api/provider/schedule/unblock') {
    unblockProviderDate();
}

if ($method === 'POST' && $path === '/api/provider/schedule/teams') {
    updateProviderTeams();
}

// Google Auth Routes
if ($method === 'GET' && $path === '/api/auth/google/redirect') {
    redirectToGoogle();
}

if ($method === 'GET' && $path === '/api/auth/google/callback') {
    handleGoogleCallback();
}

if ($method === 'POST' && $path === '/api/auth/google/disconnect') {
    disconnectGoogle();
}

if ($method === 'GET' && $path === '/api/auth/google/status') {
    getGoogleConnectionStatus();
}

// PayHere Payment Gateway Routes
if ($method === 'POST' && $path === '/api/payhere/initiate') {
    require_once __DIR__ . '/payhere_initiate.php';
    exit;
}

if ($method === 'POST' && $path === '/api/payhere/webhook') {
    require_once __DIR__ . '/payhere_webhook.php';
    exit;
}

// Notification Routes
if ($method === 'GET' && $path === '/api/notifications') {
    getMyNotifications();
}

if ($method === 'POST' && $path === '/api/notifications/mark-read') {
    markNotificationsRead();
}

jsonResponse(404, ['message' => 'Route not found.']);
