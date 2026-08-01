<?php

declare(strict_types=1);

use Nestora\Core\Http\Request;
use Nestora\Core\Routing\Router;
use Nestora\Controllers\AuthController;
use Nestora\Controllers\ApplicationController;
use Nestora\Controllers\UserController;
use Nestora\Controllers\ServiceListingController;
use Nestora\Controllers\ProductListingController;
use Nestora\Controllers\OrderController;
use Nestora\Controllers\InquiryController;
use Nestora\Controllers\PaymentController;
use Nestora\Controllers\InventoryController;
use Nestora\Controllers\AnalyticsController;
use Nestora\Controllers\NotificationController;
use Nestora\Controllers\ProfileController;
use Nestora\Controllers\GoogleAuthController;
use Nestora\Controllers\PortfolioController;
use Nestora\Controllers\ScheduleController;
use Nestora\Controllers\SubscriptionController;

require_once __DIR__ . '/../src/bootstrap.php';

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

$request = new Request();
$router = new Router();

// Health Check
$router->get('/api/health', fn() => ['status' => 'ok']);

// Authentication Routes
$router->get('/api/auth/me', [AuthController::class, 'me']);
$router->post('/api/auth/register', [AuthController::class, 'register']);
$router->post('/api/auth/login', [AuthController::class, 'login']);
$router->post('/api/auth/logout', [AuthController::class, 'logout']);
$router->post('/api/auth/verify-otp', [AuthController::class, 'verifyOtp']);
$router->post('/api/auth/forgot-password', [AuthController::class, 'forgotPassword']);
$router->post('/api/auth/reset-password', [AuthController::class, 'resetPassword']);

// Pro Applications
$router->post('/api/pro-applications', [ApplicationController::class, 'create']);
$router->get('/api/admin/pending-applications', [ApplicationController::class, 'listPending']);
$router->post('/api/admin/applications/{id}/approve', fn($req, $id) => (new ApplicationController())->approve($req, (int) $id));

// Admin User Management
$router->get('/api/admin/users', [UserController::class, 'list']);
$router->post('/api/admin/users/{id}/ban', fn($req, $id) => (new UserController())->ban($req, (int) $id));
$router->post('/api/admin/users/{id}/unban', fn($req, $id) => (new UserController())->unban($req, (int) $id));

// Service Listings
$router->get('/api/service-listings', [ServiceListingController::class, 'list']);
$router->get('/api/service-listings/{id}', fn($req, $id) => (new ServiceListingController())->get($req, (int) $id));
$router->post('/api/service-listings', [ServiceListingController::class, 'create']);
$router->post('/api/service-listings/{id}/update', fn($req, $id) => (new ServiceListingController())->update($req, (int) $id));
$router->post('/api/service-listings/{id}/delete', fn($req, $id) => (new ServiceListingController())->delete($req, (int) $id));

// Product Listings & Reviews
$router->get('/api/product-listings', [ProductListingController::class, 'list']);
$router->get('/api/product-listings/{id}', fn($req, $id) => (new ProductListingController())->get($req, (int) $id));
$router->post('/api/product-listings', [ProductListingController::class, 'create']);
$router->post('/api/product-listings/{id}/update', fn($req, $id) => (new ProductListingController())->update($req, (int) $id));
$router->post('/api/product-listings/{id}/delete', fn($req, $id) => (new ProductListingController())->delete($req, (int) $id));
$router->post('/api/products/{id}/reviews', fn($req, $id) => (new ProductListingController())->createReview($req, (int) $id));
$router->get('/api/products/{id}/reviews', fn($req, $id) => (new ProductListingController())->getReviews($req, (int) $id));

// Orders
$router->post('/api/orders', [OrderController::class, 'create']);
$router->get('/api/orders', [OrderController::class, 'listMyOrders']);
$router->get('/api/orders/seller', [OrderController::class, 'listSellerOrders']);
$router->post('/api/orders/{ref}/ship', fn($req, $ref) => (new OrderController())->shipOrder($req, $ref));
$router->post('/api/orders/{ref}/complete', fn($req, $ref) => (new OrderController())->completeOrder($req, $ref));
$router->post('/api/orders/{ref}/flag-missing', fn($req, $ref) => (new OrderController())->flagNotReceived($req, $ref));

// Inquiries
$router->post('/api/inquiries', [InquiryController::class, 'create']);
$router->get('/api/inquiries', [InquiryController::class, 'list']);
$router->get('/api/inquiries/{id}', fn($req, $id) => (new InquiryController())->get($req, (int) $id));

// Admin Payments & Webhooks
$router->get('/api/admin/payments', [PaymentController::class, 'getAdminPayments']);
$router->post('/api/admin/payments/settle', [PaymentController::class, 'settlePayment']);
$router->post('/api/webhooks/stripe', [PaymentController::class, 'handleStripeWebhook']);
$router->post('/api/subscriptions/portal', [SubscriptionController::class, 'createPortalSession']);

// Profiles
$router->get('/api/profiles', [ProfileController::class, 'list']);
$router->get('/api/profiles/{id}', fn($req, $id) => (new ProfileController())->get($req, (int) $id));
$router->post('/api/profile/update', [ProfileController::class, 'update']);

// Inventory
$router->get('/api/inventory/{id}/batches', fn($req, $id) => (new InventoryController())->getBatches($req, (int) $id));
$router->post('/api/inventory/{id}/batches', fn($req, $id) => (new InventoryController())->addBatch($req, (int) $id));

// Analytics
$router->post('/api/analytics/log', [AnalyticsController::class, 'logEvent']);
$router->get('/api/analytics/dashboard', [AnalyticsController::class, 'dashboard']);

// Notifications
$router->get('/api/notifications', [NotificationController::class, 'getNotifications']);
$router->post('/api/notifications/mark-read', [NotificationController::class, 'markRead']);

// Schedules
$router->get('/api/providers/{id}/schedule', fn($req, $id) => (new ScheduleController())->getSchedule($req, (int) $id));
$router->post('/api/provider/schedule/block', [ScheduleController::class, 'blockDate']);
$router->post('/api/provider/schedule/unblock', [ScheduleController::class, 'unblockDate']);
$router->post('/api/provider/schedule/teams', [ScheduleController::class, 'updateTeams']);

// Google Auth
$router->get('/api/auth/google/redirect', [GoogleAuthController::class, 'redirect']);
$router->get('/api/auth/google/callback', [GoogleAuthController::class, 'callback']);
$router->post('/api/auth/google/disconnect', [GoogleAuthController::class, 'disconnect']);
$router->get('/api/auth/google/status', [GoogleAuthController::class, 'status']);

// Portfolios
$router->get('/api/portfolios', [PortfolioController::class, 'list']);

$response = $router->dispatch($request);
$response->send();
