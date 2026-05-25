<?php

class Mailer {
    public static function send(string $to, string $subject, string $htmlBody): bool {
        $from = sk_config('mail_from');
        $fromName = sk_config('mail_from_name', 'Самопознание');
        $headers = [
            'MIME-Version: 1.0',
            'Content-type: text/html; charset=UTF-8',
            'From: ' . self::encodeAddress($fromName, $from),
            'Reply-To: ' . $from,
            'X-Mailer: PHP/' . PHP_VERSION,
        ];
        $ok = @mail($to, '=?UTF-8?B?' . base64_encode($subject) . '?=', $htmlBody, implode("\r\n", $headers));
        if (!$ok && sk_config('dev_log_mail', true)) {
            $logDir = dirname(sk_config('db_path'));
            $line = date('c') . " TO: $to SUBJ: $subject\n$htmlBody\n---\n";
            file_put_contents($logDir . '/mail.log', $line, FILE_APPEND);
            return true;
        }
        return (bool)$ok;
    }

    private static function encodeAddress(string $name, string $email): string {
        return '=?UTF-8?B?' . base64_encode($name) . '?= <' . $email . '>';
    }

    public static function verificationEmail(string $to, string $token): void {
        $url = rtrim(sk_config('app_url'), '/') . '/api/auth/verify-email?token=' . urlencode($token);
        $html = '<div style="font-family:sans-serif;max-width:520px;margin:0 auto">'
            . '<h2>Подтверждение почты</h2>'
            . '<p>Нажмите кнопку, чтобы завершить регистрацию:</p>'
            . '<p><a href="' . htmlspecialchars($url) . '" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold">Подтвердить email</a></p>'
            . '<p style="color:#666;font-size:13px">Ссылка действует 24 часа.</p></div>';
        self::send($to, 'Подтвердите email — Самопознание', $html);
    }

    public static function resetEmail(string $to, string $token): void {
        $url = rtrim(sk_config('app_url'), '/') . '/?reset=' . urlencode($token);
        $html = '<div style="font-family:sans-serif;max-width:520px;margin:0 auto">'
            . '<h2>Восстановление пароля</h2>'
            . '<p><a href="' . htmlspecialchars($url) . '" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold">Сбросить пароль</a></p>'
            . '<p style="color:#666;font-size:13px">Ссылка действует 1 час.</p></div>';
        self::send($to, 'Восстановление пароля — Самопознание', $html);
    }
}
