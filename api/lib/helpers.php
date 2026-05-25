<?php

function sk_json($data, int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function sk_error(string $message, int $code = 400, ?string $errorCode = null): void {
    $payload = ['error' => $message];
    if ($errorCode) {
        $payload['code'] = $errorCode;
    }
    sk_json($payload, $code);
}

function sk_body(): array {
    $raw = file_get_contents('php://input');
    if (!$raw) {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function sk_bearer_token(): ?string {
    $h = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/Bearer\s+(\S+)/i', $h, $m)) {
        return $m[1];
    }
    return null;
}

function sk_random_token(int $bytes = 32): string {
    return bin2hex(random_bytes($bytes));
}

function sk_user_public(array $row): array {
    return [
        'id' => (int)$row['id'],
        'username' => $row['username'],
        'email' => $row['email'],
        'name' => $row['name'],
        'avatar' => $row['avatar'] ?: '🧑',
        'emailVerified' => (bool)$row['email_verified'],
        'authProvider' => $row['google_id'] ? 'google' : 'local',
        'createdAt' => $row['created_at'],
    ];
}

function sk_validate_email(string $email): bool {
    return (bool)filter_var($email, FILTER_VALIDATE_EMAIL);
}

function sk_validate_username(string $u): bool {
    return (bool)preg_match('/^[a-zA-Z0-9_]{3,30}$/', $u);
}
