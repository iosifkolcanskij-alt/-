<?php

class Jwt {
    public static function encode(array $payload): string {
        $header = ['alg' => 'HS256', 'typ' => 'JWT'];
        $segments = [
            self::b64(json_encode($header)),
            self::b64(json_encode($payload)),
        ];
        $signing = implode('.', $segments);
        $sig = hash_hmac('sha256', $signing, sk_config('jwt_secret'), true);
        $segments[] = self::b64($sig);
        return implode('.', $segments);
    }

    public static function decode(string $token): ?array {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            return null;
        }
        [$h, $p, $s] = $parts;
        $signing = $h . '.' . $p;
        $expected = self::b64(hash_hmac('sha256', $signing, sk_config('jwt_secret'), true));
        if (!hash_equals($expected, $s)) {
            return null;
        }
        $payload = json_decode(self::ub64($p), true);
        if (!is_array($payload)) {
            return null;
        }
        if (isset($payload['exp']) && time() > $payload['exp']) {
            return null;
        }
        return $payload;
    }

    public static function forUser(int $userId): string {
        $ttl = (int)sk_config('jwt_ttl', 2592000);
        return self::encode([
            'sub' => $userId,
            'iat' => time(),
            'exp' => time() + $ttl,
        ]);
    }

    private static function b64(string $data): string {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function ub64(string $data): string {
        $pad = 4 - (strlen($data) % 4);
        if ($pad < 4) {
            $data .= str_repeat('=', $pad);
        }
        return base64_decode(strtr($data, '-_', '+/')) ?: '';
    }
}
