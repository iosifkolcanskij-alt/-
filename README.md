# Самопознание

Репозиторий: https://github.com/iosifkolcanskij-alt/-

Секреты (`api/config.local.php`, база SQLite, логи) в репозиторий не попадают — см. `.gitignore`.

## Запуск сайта

```bash
php -S localhost:8080 router.php
```

Откройте http://localhost:8080

## База данных MySQL (phpMyAdmin)

1. Откройте **phpMyAdmin** (обычно http://localhost/phpmyadmin).
2. Создайте базу `samopoznanie` (кодировка **utf8mb4_unicode_ci**), если её ещё нет.
3. Выберите базу → вкладка **Импорт** → файл  
   `api/database/samopoznanie.sql` → **Вперёд**.
4. Скопируйте `api/config.local.example.php` → `api/config.local.php`.
5. Укажите доступ к MySQL:

```php
'db_driver' => 'mysql',
'db_host' => '127.0.0.1',
'db_port' => 3306,
'db_name' => 'samopoznanie',
'db_user' => 'root',
'db_pass' => '',  // пароль MySQL в XAMPP/OpenServer
```

### Таблицы

| Таблица | Назначение |
|---------|------------|
| `users` | Аккаунты, email, пароль, Google ID, подтверждение почты |
| `history` | Результаты тестов пользователя |

Просмотр и правка данных — через phpMyAdmin (вкладки «Обзор», «SQL», «Вставить»).

## SQLite (без phpMyAdmin)

В `config.local.php` укажите:

```php
'db_driver' => 'sqlite',
```

Таблицы создадутся автоматически в `api/data/app.sqlite`.

## Авторизация

- Регистрация с подтверждением email
- Восстановление пароля
- Вход через Google (нужны `google_client_id` и `google_client_secret`)
- Письма в dev пишутся в `api/data/mail.log`, если `mail()` недоступен

## Главная страница

После блока статистики отображаются: **Инструменты**, **О сервисе**, **Как это работает**, **FAQ**, полоса конфиденциальности, затем справочные разделы A–I.
