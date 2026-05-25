<?php

class Database {
    private static ?PDO $pdo = null;
    private static string $driver = 'mysql';

    public static function driver(): string {
        return self::$driver;
    }

    public static function pdo(): PDO {
        if (self::$pdo) {
            return self::$pdo;
        }

        self::$driver = sk_config('db_driver', 'mysql');

        if (self::$driver === 'mysql') {
            $host = sk_config('db_host', '127.0.0.1');
            $port = (int)sk_config('db_port', 3306);
            $name = sk_config('db_name', 'samopoznanie');
            $user = sk_config('db_user', 'root');
            $pass = sk_config('db_pass', '');
            $charset = sk_config('db_charset', 'utf8mb4');
            $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=%s', $host, $port, $name, $charset);
            self::$pdo = new PDO($dsn, $user, $pass, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::MYSQL_ATTR_INIT_COMMAND => 'SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci',
            ]);
        } else {
            $path = sk_config('db_path');
            $dir = dirname($path);
            if (!is_dir($dir)) {
                mkdir($dir, 0755, true);
            }
            self::$pdo = new PDO('sqlite:' . $path, null, null, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]);
        }

        self::ensureSchema();
        return self::$pdo;
    }

    private static function ensureSchema(): void {
        if (self::$driver === 'mysql') {
            if (!self::tableExists('users')) {
                throw new RuntimeException(
                    'Таблицы MySQL не найдены. Импортируйте api/database/samopoznanie.sql через phpMyAdmin.'
                );
            }
            return;
        }

        $pdo = self::$pdo;
        $pdo->exec('CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT,
            name TEXT,
            avatar TEXT DEFAULT "🧑",
            email_verified INTEGER DEFAULT 0,
            verification_token TEXT,
            verification_expires TEXT,
            reset_token TEXT,
            reset_expires TEXT,
            google_id TEXT UNIQUE,
            profile_json TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )');
        $pdo->exec('CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            result TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )');
        $pdo->exec('CREATE INDEX IF NOT EXISTS idx_history_user ON history(user_id)');
    }

    private static function tableExists(string $table): bool {
        $st = self::$pdo->prepare('SHOW TABLES LIKE ?');
        $st->execute([$table]);
        return (bool)$st->fetchColumn();
    }

    public static function findUserByEmail(string $email): ?array {
        $st = self::pdo()->prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1');
        $st->execute([$email]);
        $row = $st->fetch();
        return $row ?: null;
    }

    public static function findUserById(int $id): ?array {
        $st = self::pdo()->prepare('SELECT * FROM users WHERE id = ?');
        $st->execute([$id]);
        $row = $st->fetch();
        return $row ?: null;
    }

    public static function findUserByGoogleId(string $gid): ?array {
        $st = self::pdo()->prepare('SELECT * FROM users WHERE google_id = ?');
        $st->execute([$gid]);
        $row = $st->fetch();
        return $row ?: null;
    }

    public static function findUserByUsername(string $username): ?array {
        $st = self::pdo()->prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1');
        $st->execute([$username]);
        $row = $st->fetch();
        return $row ?: null;
    }
}
