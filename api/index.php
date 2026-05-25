<?php
require __DIR__ . '/config.php';
require __DIR__ . '/lib/helpers.php';
require __DIR__ . '/lib/Jwt.php';
require __DIR__ . '/lib/Database.php';
require __DIR__ . '/lib/Mailer.php';
require __DIR__ . '/lib/AuthController.php';
require __DIR__ . '/lib/HistoryController.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    sk_json(['ok' => true]);
}

$route = $_GET['route'] ?? '';
if ($route === '' || $route === '/') {
    $uri = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) ?: '';
    $route = preg_replace('#^/api#', '', $uri) ?: '/';
}
$route = '/' . trim($route, '/');
$method = $_SERVER['REQUEST_METHOD'];
$body = sk_body();

try {
    if ($route === '/auth/register' && $method === 'POST') {
        AuthController::register($body);
    }
    if ($route === '/auth/login' && $method === 'POST') {
        AuthController::login($body);
    }
    if ($route === '/auth/verify-email' && $method === 'GET') {
        AuthController::verifyEmailGet();
    }
    if ($route === '/auth/resend-verification' && $method === 'POST') {
        AuthController::resendVerification($body);
    }
    if ($route === '/auth/forgot-password' && $method === 'POST') {
        AuthController::forgotPassword($body);
    }
    if ($route === '/auth/reset-password' && $method === 'POST') {
        AuthController::resetPassword($body);
    }
    if ($route === '/auth/me' && $method === 'GET') {
        AuthController::me();
    }
    if ($route === '/auth/profile' && $method === 'PUT') {
        AuthController::updateProfile($body);
    }
    if ($route === '/auth/google' && $method === 'GET') {
        AuthController::googleStart();
    }
    if ($route === '/auth/google/callback' && $method === 'GET') {
        AuthController::googleCallback();
    }

    if ($route === '/history' && $method === 'GET') {
        HistoryController::list();
    }
    if ($route === '/history' && $method === 'POST') {
        HistoryController::create($body);
    }
    if ($route === '/history' && $method === 'DELETE') {
        HistoryController::deleteAll();
    }
    if (preg_match('#^/history/(\d+)$#', $route, $m)) {
        if ($method === 'DELETE') {
            HistoryController::deleteOne((int)$m[1]);
        }
    }

    sk_error('Маршрут не найден', 404);
} catch (Throwable $e) {
    sk_error('Ошибка сервера: ' . $e->getMessage(), 500);
}
