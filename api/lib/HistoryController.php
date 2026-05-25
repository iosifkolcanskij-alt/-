<?php

class HistoryController {
    public static function list(): void {
        $user = AuthController::requireUser();
        $st = Database::pdo()->prepare('SELECT * FROM history WHERE user_id = ? ORDER BY created_at DESC');
        $st->execute([$user['id']]);
        $rows = $st->fetchAll();
        $out = array_map(fn($r) => [
            'id' => (int)$r['id'],
            'type' => $r['type'],
            'title' => $r['title'],
            'result' => $r['result'],
            'createdAt' => $r['created_at'],
        ], $rows);
        sk_json($out);
    }

    public static function create(array $body): void {
        $user = AuthController::requireUser();
        $type = trim($body['type'] ?? '');
        $title = trim($body['title'] ?? '');
        $result = trim($body['result'] ?? '');
        if (!$type || !$title) {
            sk_error('Неполные данные', 400);
        }
        $pdo = Database::pdo();
        $st = $pdo->prepare('INSERT INTO history (user_id, type, title, result) VALUES (?,?,?,?)');
        $st->execute([$user['id'], $type, $title, $result]);
        $id = (int)$pdo->lastInsertId();
        $st = $pdo->prepare('SELECT * FROM history WHERE id = ?');
        $st->execute([$id]);
        $row = $st->fetch();
        sk_json([
            'id' => $id,
            'type' => $row['type'],
            'title' => $row['title'],
            'result' => $row['result'],
            'createdAt' => $row['created_at'],
        ], 201);
    }

    public static function deleteOne(int $id): void {
        $user = AuthController::requireUser();
        $st = Database::pdo()->prepare('DELETE FROM history WHERE id = ? AND user_id = ?');
        $st->execute([$id, $user['id']]);
        sk_json(['ok' => true]);
    }

    public static function deleteAll(): void {
        $user = AuthController::requireUser();
        Database::pdo()->prepare('DELETE FROM history WHERE user_id = ?')->execute([$user['id']]);
        sk_json(['ok' => true]);
    }
}
