<?php
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

if (preg_match('#^/api(?:/|$)#', $uri)) {
    $_GET['route'] = preg_replace('#^/api#', '', $uri) ?: '/';
    require __DIR__ . '/api/index.php';
    return true;
}

$file = __DIR__ . $uri;
if ($uri !== '/' && is_file($file)) {
    return false;
}

if (is_file(__DIR__ . '/index.html')) {
    include __DIR__ . '/index.html';
    return true;
}

return false;
