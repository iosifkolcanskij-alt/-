<?php

class AuthController {
    public static function register(array $body): void {
        $username = trim($body['username'] ?? '');
        $email = strtolower(trim($body['email'] ?? ''));
        $password = $body['password'] ?? '';
        $name = trim($body['name'] ?? '') ?: $username;

        if (!sk_validate_username($username)) {
            sk_error('Логин: 3–30 символов, латиница, цифры и _', 400);
        }
        if (!sk_validate_email($email)) {
            sk_error('Некорректный email', 400);
        }
        if (strlen($password) < 8) {
            sk_error('Пароль не менее 8 символов', 400);
        }
        if (Database::findUserByEmail($email)) {
            sk_error('Email уже зарегистрирован', 409);
        }
        if (Database::findUserByUsername($username)) {
            sk_error('Логин занят', 409);
        }

        $token = sk_random_token();
        $expires = date('c', time() + 86400);
        $hash = password_hash($password, PASSWORD_DEFAULT);
        $pdo = Database::pdo();
        $st = $pdo->prepare('INSERT INTO users (username, email, password_hash, name, verification_token, verification_expires) VALUES (?,?,?,?,?,?)');
        $st->execute([$username, $email, $hash, $name, $token, $expires]);

        Mailer::verificationEmail($email, $token);

        sk_json([
            'ok' => true,
            'needsVerification' => true,
            'message' => 'На почту отправлена ссылка для подтверждения. Проверьте входящие и папку «Спам».',
            'email' => $email,
        ]);
    }

    public static function login(array $body): void {
        $email = strtolower(trim($body['email'] ?? ''));
        $password = $body['password'] ?? '';
        $user = Database::findUserByEmail($email);
        if (!$user || !$user['password_hash'] || !password_verify($password, $user['password_hash'])) {
            sk_error('Неверный email или пароль', 401);
        }
        if (!(int)$user['email_verified']) {
            sk_error('Подтвердите email перед входом', 403, 'EMAIL_NOT_VERIFIED');
        }
        self::respondWithToken($user);
    }

    public static function verifyEmailGet(): void {
        $token = $_GET['token'] ?? '';
        if (!$token) {
            self::redirectHome('verify=missing');
            return;
        }
        $pdo = Database::pdo();
        $st = $pdo->prepare('SELECT * FROM users WHERE verification_token = ? LIMIT 1');
        $st->execute([$token]);
        $user = $st->fetch();
        if (!$user) {
            self::redirectHome('verify=invalid');
            return;
        }
        if ($user['verification_expires'] && strtotime($user['verification_expires']) < time()) {
            self::redirectHome('verify=expired');
            return;
        }
        $upd = $pdo->prepare('UPDATE users SET email_verified = 1, verification_token = NULL, verification_expires = NULL WHERE id = ?');
        $upd->execute([$user['id']]);
        self::redirectHome('verified=1');
    }

    public static function resendVerification(array $body): void {
        $email = strtolower(trim($body['email'] ?? ''));
        $user = Database::findUserByEmail($email);
        if (!$user) {
            sk_json(['ok' => true, 'message' => 'Если email зарегистрирован, письмо отправлено']);
            return;
        }
        if ((int)$user['email_verified']) {
            sk_error('Email уже подтверждён', 400);
        }
        $token = sk_random_token();
        $expires = date('c', time() + 86400);
        $pdo = Database::pdo();
        $pdo->prepare('UPDATE users SET verification_token = ?, verification_expires = ? WHERE id = ?')
            ->execute([$token, $expires, $user['id']]);
        Mailer::verificationEmail($email, $token);
        sk_json(['ok' => true, 'message' => 'Письмо отправлено повторно']);
    }

    public static function forgotPassword(array $body): void {
        $email = strtolower(trim($body['email'] ?? ''));
        $user = Database::findUserByEmail($email);
        if ($user && $user['password_hash']) {
            $token = sk_random_token(24);
            $expires = date('c', time() + 3600);
            Database::pdo()->prepare('UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?')
                ->execute([$token, $expires, $user['id']]);
            Mailer::resetEmail($email, $token);
        }
        sk_json(['ok' => true, 'message' => 'Если аккаунт существует, на почту отправлена ссылка для сброса пароля']);
    }

    public static function resetPassword(array $body): void {
        $token = trim($body['token'] ?? '');
        $password = $body['password'] ?? '';
        if (strlen($password) < 8) {
            sk_error('Пароль не менее 8 символов', 400);
        }
        $pdo = Database::pdo();
        $st = $pdo->prepare('SELECT * FROM users WHERE reset_token = ? LIMIT 1');
        $st->execute([$token]);
        $user = $st->fetch();
        if (!$user) {
            sk_error('Ссылка недействительна', 400);
        }
        if ($user['reset_expires'] && strtotime($user['reset_expires']) < time()) {
            sk_error('Ссылка истекла. Запросите сброс снова', 400);
        }
        $hash = password_hash($password, PASSWORD_DEFAULT);
        $pdo->prepare('UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires = NULL, email_verified = 1 WHERE id = ?')
            ->execute([$hash, $user['id']]);
        $user = Database::findUserById((int)$user['id']);
        self::respondWithToken($user);
    }

    public static function me(): void {
        $user = self::requireUser();
        sk_json(['user' => sk_user_public($user)]);
    }

    public static function updateProfile(array $body): void {
        $user = self::requireUser();
        $name = isset($body['name']) ? trim($body['name']) : $user['name'];
        $avatar = isset($body['avatar']) ? trim($body['avatar']) : $user['avatar'];
        if (strlen($name) > 80) {
            sk_error('Имя слишком длинное', 400);
        }
        if (mb_strlen($avatar) > 8) {
            $avatar = mb_substr($avatar, 0, 4);
        }
        $pdo = Database::pdo();
        $pdo->prepare('UPDATE users SET name = ?, avatar = ? WHERE id = ?')->execute([$name, $avatar, $user['id']]);
        $user = Database::findUserById((int)$user['id']);
        sk_json(['user' => sk_user_public($user)]);
    }

    public static function googleStart(): void {
        $clientId = sk_config('google_client_id');
        if (!$clientId) {
            sk_error('Вход через Google не настроен. Укажите SK_GOOGLE_CLIENT_ID в config.local.php', 503);
        }
        $redirect = rtrim(sk_config('app_url'), '/') . '/api/auth/google/callback';
        $state = sk_random_token(16);
        setcookie('sk_oauth_state', $state, [
            'expires' => time() + 600,
            'path' => '/',
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        $params = http_build_query([
            'client_id' => $clientId,
            'redirect_uri' => $redirect,
            'response_type' => 'code',
            'scope' => 'openid email profile',
            'state' => $state,
            'access_type' => 'online',
            'prompt' => 'select_account',
        ]);
        header('Location: https://accounts.google.com/o/oauth2/v2/auth?' . $params);
        exit;
    }

    public static function googleCallback(): void {
        $clientId = sk_config('google_client_id');
        $clientSecret = sk_config('google_client_secret');
        $state = $_GET['state'] ?? '';
        $cookieState = $_COOKIE['sk_oauth_state'] ?? '';
        setcookie('sk_oauth_state', '', ['expires' => 1, 'path' => '/']);
        if (!$state || !$cookieState || !hash_equals($cookieState, $state)) {
            self::redirectHome('google=state_error');
            return;
        }
        $code = $_GET['code'] ?? '';
        if (!$code) {
            self::redirectHome('google=cancelled');
            return;
        }
        $redirect = rtrim(sk_config('app_url'), '/') . '/api/auth/google/callback';
        $tokenResp = self::httpPost('https://oauth2.googleapis.com/token', [
            'code' => $code,
            'client_id' => $clientId,
            'client_secret' => $clientSecret,
            'redirect_uri' => $redirect,
            'grant_type' => 'authorization_code',
        ]);
        if (empty($tokenResp['access_token'])) {
            self::redirectHome('google=token_error');
            return;
        }
        $profile = self::httpGet('https://www.googleapis.com/oauth2/v2/userinfo', $tokenResp['access_token']);
        if (empty($profile['id']) || empty($profile['email'])) {
            self::redirectHome('google=profile_error');
            return;
        }
        $user = self::findOrCreateGoogleUser($profile);
        $jwt = Jwt::forUser((int)$user['id']);
        self::redirectHome('token=' . urlencode($jwt));
    }

    private static function findOrCreateGoogleUser(array $profile): array {
        $gid = $profile['id'];
        $email = strtolower($profile['email']);
        $user = Database::findUserByGoogleId($gid);
        if ($user) {
            return $user;
        }
        $user = Database::findUserByEmail($email);
        if ($user) {
            Database::pdo()->prepare('UPDATE users SET google_id = ?, email_verified = 1 WHERE id = ?')
                ->execute([$gid, $user['id']]);
            return Database::findUserById((int)$user['id']);
        }
        $name = $profile['name'] ?? explode('@', $email)[0];
        $base = preg_replace('/[^a-zA-Z0-9_]/', '', explode('@', $email)[0]) ?: 'user';
        $username = self::uniqueUsername(substr($base, 0, 20));
        $pdo = Database::pdo();
        $pdo->prepare('INSERT INTO users (username, email, name, google_id, email_verified, avatar) VALUES (?,?,?,?,1,?)')
            ->execute([$username, $email, $name, $gid, '🧑']);
        return Database::findUserById((int)$pdo->lastInsertId());
    }

    private static function uniqueUsername(string $base): string {
        $base = strtolower($base) ?: 'user';
        if (!sk_validate_username($base)) {
            $base = 'user';
        }
        if (!Database::findUserByUsername($base)) {
            return $base;
        }
        for ($i = 1; $i < 1000; $i++) {
            $try = $base . $i;
            if (strlen($try) <= 30 && !Database::findUserByUsername($try)) {
                return $try;
            }
        }
        return $base . sk_random_token(4);
    }

    private static function httpPost(string $url, array $fields): array {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => http_build_query($fields),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 20,
        ]);
        $raw = curl_exec($ch);
        curl_close($ch);
        return json_decode($raw ?: '{}', true) ?: [];
    }

    private static function httpGet(string $url, string $token): array {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $token],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 20,
        ]);
        $raw = curl_exec($ch);
        curl_close($ch);
        return json_decode($raw ?: '{}', true) ?: [];
    }

    public static function requireUser(): array {
        $token = sk_bearer_token();
        if (!$token) {
            sk_error('Требуется авторизация', 401);
        }
        $payload = Jwt::decode($token);
        if (!$payload || empty($payload['sub'])) {
            sk_error('Сессия истекла', 401);
        }
        $user = Database::findUserById((int)$payload['sub']);
        if (!$user) {
            sk_error('Пользователь не найден', 401);
        }
        return $user;
    }

    private static function respondWithToken(array $user): void {
        sk_json([
            'token' => Jwt::forUser((int)$user['id']),
            'user' => sk_user_public($user),
        ]);
    }

    private static function redirectHome(string $query): void {
        $url = rtrim(sk_config('app_url'), '/') . '/?' . $query;
        header('Location: ' . $url);
        exit;
    }
}
