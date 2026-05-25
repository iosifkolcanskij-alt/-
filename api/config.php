<?php
/**
 * Конфигурация API. Скопируйте config.local.php и задайте свои значения.
 */
$local = __DIR__ . '/config.local.php';
if (is_file($local)) {
    require $local;
}

if (!defined('SK_CONFIG')) {
    define('SK_CONFIG', [
        'db_driver' => getenv('SK_DB_DRIVER') ?: 'mysql',
        'db_host' => getenv('SK_DB_HOST') ?: '127.0.0.1',
        'db_port' => (int)(getenv('SK_DB_PORT') ?: 3306),
        'db_name' => getenv('SK_DB_NAME') ?: 'samopoznanie',
        'db_user' => getenv('SK_DB_USER') ?: 'root',
        'db_pass' => getenv('SK_DB_PASS') ?: '',
        'db_charset' => 'utf8mb4',
        'db_path' => __DIR__ . '/data/app.sqlite',
        'jwt_secret' => getenv('SK_JWT_SECRET') ?: 'samopoznanie-change-this-secret-in-production',
        'jwt_ttl' => 60 * 60 * 24 * 30,
        'app_url' => getenv('SK_APP_URL') ?: (
            (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http')
            . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost')
        ),
        'mail_from' => getenv('SK_MAIL_FROM') ?: 'noreply@localhost',
        'mail_from_name' => 'Самопознание',
        'google_client_id' => getenv('SK_GOOGLE_CLIENT_ID') ?: '',
        'google_client_secret' => getenv('SK_GOOGLE_CLIENT_SECRET') ?: '',
        'dev_log_mail' => true,
    ]);
}

function sk_config(string $key, $default = null) {
    return SK_CONFIG[$key] ?? $default;
}
