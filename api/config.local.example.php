<?php
define('SK_CONFIG', [
    'db_driver' => 'mysql',
    'db_host' => '127.0.0.1',
    'db_port' => 3306,
    'db_name' => 'samopoznanie',
    'db_user' => 'root',
    'db_pass' => '',
    'db_charset' => 'utf8mb4',
    'jwt_secret' => 'замените-на-длинную-случайную-строку',
    'jwt_ttl' => 60 * 60 * 24 * 30,
    'app_url' => 'http://localhost:8080',
    'mail_from' => 'noreply@ваш-домен.ru',
    'mail_from_name' => 'Самопознание',
    'google_client_id' => '',
    'google_client_secret' => '',
    'dev_log_mail' => true,
]);
