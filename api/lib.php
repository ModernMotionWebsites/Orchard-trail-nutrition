<?php
/* Orchard Trail Nutrition — shared back end for the GoDaddy build.
   MySQL (or SQLite for local testing), hashed passwords, hashed session
   tokens in a cookie, login throttling, JSON responses. No dependencies. */

declare(strict_types=1);

const OTN_COOKIE = 'otn_session';
const OTN_SESSION_DAYS = 14;
const OTN_MAX_ATTEMPTS = 8;
const OTN_ATTEMPT_WINDOW_MIN = 15;

/* --------------------------------------------------------------- config -- */

function otn_config(): array
{
    static $config = null;
    if ($config !== null) return $config;
    $path = getenv('OTN_CONFIG') ?: (dirname(__DIR__) . '/config.php');
    if (!is_file($path)) {
        otn_fail('This website is not connected to a database yet. Copy config.sample.php to config.php and fill in the MySQL details.', 503);
    }
    $config = require $path;
    return $config;
}

function otn_root(): string
{
    return dirname(__DIR__);
}

function otn_site_url(): string
{
    return rtrim((string)(otn_config()['site_url'] ?? ''), '/');
}

/* ------------------------------------------------------------------- db -- */

function otn_db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;

    $config = otn_config();
    $driver = $config['driver'] ?? 'mysql';

    if ($driver === 'sqlite') {
        $path = $config['sqlite_path'] ?? (otn_root() . '/data/local.sqlite');
        @mkdir(dirname($path), 0775, true);
        $pdo = new PDO('sqlite:' . $path);
        $pdo->exec('PRAGMA journal_mode=WAL');
        $pdo->exec('PRAGMA busy_timeout=5000');
    } else {
        $m = $config['mysql'];
        $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $m['host'], (int)($m['port'] ?? 3306), $m['name']);
        $pdo = new PDO($dsn, $m['user'], $m['pass']);
    }

    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    otn_ensure_schema($pdo, $driver);
    return $pdo;
}

function otn_ensure_schema(PDO $pdo, string $driver): void
{
    static $done = false;
    if ($done) return;

    if ($driver === 'sqlite') {
        $id = 'TEXT';
        $key = 'TEXT';
        $json = 'TEXT';
        $tail = '';
        $auto = 'INTEGER PRIMARY KEY AUTOINCREMENT';
    } else {
        $id = 'VARCHAR(64)';
        $key = 'VARCHAR(190)';
        $json = 'LONGTEXT';
        $tail = ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4';
        $auto = 'INT NOT NULL AUTO_INCREMENT PRIMARY KEY';
    }

    $statements = [
        "CREATE TABLE IF NOT EXISTS users (
            id $id PRIMARY KEY,
            email $key UNIQUE NOT NULL,
            name VARCHAR(160),
            role VARCHAR(20) NOT NULL DEFAULT 'owner',
            password_hash VARCHAR(255) NOT NULL,
            recovery_hash VARCHAR(128),
            recovery_generated_at VARCHAR(40),
            created_at VARCHAR(40) NOT NULL,
            last_login_at VARCHAR(40),
            disabled TINYINT NOT NULL DEFAULT 0
        )$tail",
        "CREATE TABLE IF NOT EXISTS sessions (
            id $id PRIMARY KEY,
            token_hash VARCHAR(128) NOT NULL UNIQUE,
            user_id $id NOT NULL,
            created_at VARCHAR(40) NOT NULL,
            expires_at VARCHAR(40) NOT NULL,
            user_agent VARCHAR(255)
        )$tail",
        "CREATE TABLE IF NOT EXISTS login_attempts (
            id $auto,
            email VARCHAR(190),
            ip VARCHAR(64),
            ok TINYINT NOT NULL DEFAULT 0,
            at VARCHAR(40) NOT NULL
        )$tail",
        "CREATE TABLE IF NOT EXISTS content (
            id VARCHAR(20) PRIMARY KEY,
            content_json $json NOT NULL,
            version INT NOT NULL,
            updated_at VARCHAR(40),
            updated_by VARCHAR(190),
            published_at VARCHAR(40),
            published_by VARCHAR(190)
        )$tail",
        "CREATE TABLE IF NOT EXISTS versions (
            id $id PRIMARY KEY,
            version INT NOT NULL,
            content_json $json NOT NULL,
            note VARCHAR(255),
            created_at VARCHAR(40) NOT NULL,
            created_by VARCHAR(190)
        )$tail",
        "CREATE TABLE IF NOT EXISTS media (
            id $id PRIMARY KEY,
            media_key $key UNIQUE NOT NULL,
            filename VARCHAR(190),
            original_name VARCHAR(255),
            mime VARCHAR(60),
            size INT,
            width INT,
            height INT,
            folder VARCHAR(60),
            alt VARCHAR(300),
            created_at VARCHAR(40) NOT NULL,
            uploaded_by VARCHAR(190)
        )$tail",
        "CREATE TABLE IF NOT EXISTS analytics (
            id $auto,
            ts VARCHAR(40) NOT NULL,
            day VARCHAR(10) NOT NULL,
            path VARCHAR(300),
            referrer VARCHAR(190),
            device VARCHAR(20),
            visitor VARCHAR(40),
            visitor_session VARCHAR(40),
            event_name VARCHAR(40),
            label VARCHAR(190)
        )$tail",
        "CREATE TABLE IF NOT EXISTS activity (
            id $auto,
            ts VARCHAR(40) NOT NULL,
            actor VARCHAR(190),
            action VARCHAR(190) NOT NULL,
            detail VARCHAR(500)
        )$tail",
        "CREATE TABLE IF NOT EXISTS settings (
            setting_key $key PRIMARY KEY,
            setting_value $json
        )$tail",
        'CREATE INDEX IF NOT EXISTS idx_analytics_day ON analytics(day)',
        'CREATE INDEX IF NOT EXISTS idx_analytics_event ON analytics(event_name)',
        'CREATE INDEX IF NOT EXISTS idx_attempts_at ON login_attempts(at)'
    ];

    foreach ($statements as $sql) {
        if ($driver !== 'sqlite' && stripos($sql, 'CREATE INDEX IF NOT EXISTS') === 0) {
            $sql = str_ireplace('CREATE INDEX IF NOT EXISTS', 'CREATE INDEX', $sql);
            try {
                $pdo->exec($sql);
            } catch (PDOException $error) {
                /* 1061 = duplicate key name, i.e. the index is already there */
                if (stripos($error->getMessage(), 'Duplicate key name') === false) throw $error;
            }
            continue;
        }
        if ($driver === 'sqlite' && stripos($sql, 'CREATE INDEX IF NOT EXISTS') === 0) {
            $pdo->exec($sql);
            continue;
        }
        $pdo->exec($sql);
    }

    $done = true;
}

/* --------------------------------------------------------------- output -- */

function otn_json($data, int $status = 200, array $headers = []): void
{
    http_response_code($status);
    header('content-type: application/json; charset=utf-8');
    header('cache-control: no-store');
    foreach ($headers as $name => $value) header($name . ': ' . $value);
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function otn_fail(string $message, int $status = 400, array $extra = []): void
{
    otn_json(['error' => $message] + $extra, $status);
}

function otn_read_json(): ?array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') return null;
    $data = json_decode($raw, true);
    return is_array($data) ? $data : null;
}

function otn_ip(): string
{
    foreach (['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR'] as $key) {
        if (!empty($_SERVER[$key])) {
            return trim(explode(',', (string)$_SERVER[$key])[0]);
        }
    }
    return '';
}

function otn_same_origin(): bool
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin === '') return true;
    $host = strtolower((string)parse_url($origin, PHP_URL_HOST));
    $expected = strtolower((string)parse_url(otn_site_url(), PHP_URL_HOST));
    $own = strtolower((string)($_SERVER['HTTP_HOST'] ?? ''));
    return $host !== '' && ($host === $expected || $host === $own);
}

/* ----------------------------------------------------------------- ids -- */

function otn_rand(int $bytes = 24): string
{
    return rtrim(strtr(base64_encode(random_bytes($bytes)), '+/', '-_'), '=');
}

function otn_uid(string $prefix): string
{
    return $prefix . '-' . substr(bin2hex(random_bytes(6)), 0, 12);
}

function otn_hash(string $value): string
{
    return hash('sha256', $value);
}

/* ---------------------------------------------------------------- auth -- */

function otn_current_user(): ?array
{
    $token = $_COOKIE[OTN_COOKIE] ?? '';
    if ($token === '') return null;
    $row = otn_query(
        'SELECT u.id, u.email, u.name, u.role, u.disabled, s.expires_at
           FROM sessions s JOIN users u ON u.id = s.user_id
          WHERE s.token_hash = ?',
        [otn_hash($token)]
    )->fetch();
    if (!$row || (int)$row['disabled'] === 1) return null;
    if (strtotime((string)$row['expires_at']) < time()) {
        otn_exec('DELETE FROM sessions WHERE token_hash = ?', [otn_hash($token)]);
        return null;
    }
    return ['id' => $row['id'], 'email' => $row['email'], 'name' => $row['name'], 'role' => $row['role']];
}

function otn_require_user(): array
{
    $user = otn_current_user();
    if (!$user) otn_fail('Please sign in to continue.', 401);
    return $user;
}

function otn_session_cookie(string $token, int $maxAge = OTN_SESSION_DAYS * 86400): string
{
    $secure = (stripos(otn_site_url(), 'https://') === 0) ? '; Secure' : '';
    return sprintf('%s=%s; Path=/; HttpOnly; SameSite=Lax; Max-Age=%d%s', OTN_COOKIE, rawurlencode($token), $maxAge, $secure);
}

function otn_clear_cookie(): string
{
    return otn_session_cookie('', 0);
}

function otn_start_session(string $userId): string
{
    $token = otn_rand(32);
    otn_exec(
        'INSERT INTO sessions (id, token_hash, user_id, created_at, expires_at, user_agent) VALUES (?,?,?,?,?,?)',
        [
            otn_uid('ses'),
            otn_hash($token),
            $userId,
            gmdate('c'),
            gmdate('c', time() + OTN_SESSION_DAYS * 86400),
            substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 200)
        ]
    );
    return $token;
}

function otn_password_problem($password): ?string
{
    if (!is_string($password) || strlen($password) < 10) return 'Use at least 10 characters.';
    if (!preg_match('/[a-zA-Z]/', $password)) return 'Include at least one letter.';
    if (!preg_match('/[0-9!@#$%^&*()_+\-=\[\]{};\':",.<>\/?\\\\|`~]/', $password)) return 'Include at least one number or symbol.';
    return null;
}

function otn_email_ok($email): bool
{
    return (bool)preg_match('/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/', trim((string)$email));
}

function otn_attempts(PDO $pdo, ?string $email, string $ip): int
{
    $since = gmdate('c', time() - OTN_ATTEMPT_WINDOW_MIN * 60);
    $row = otn_query(
        'SELECT COUNT(*) AS n FROM login_attempts WHERE ok = 0 AND at > ? AND (email = ? OR ip = ?)',
        [$since, strtolower((string)$email), $ip]
    )->fetch();
    return (int)($row['n'] ?? 0);
}

function otn_record_attempt(?string $email, string $ip, bool $ok): void
{
    otn_exec(
        'INSERT INTO login_attempts (email, ip, ok, at) VALUES (?,?,?,?)',
        [strtolower((string)$email), $ip, $ok ? 1 : 0, gmdate('c')]
    );
}

function otn_clear_attempts(?string $email, string $ip): void
{
    otn_exec('DELETE FROM login_attempts WHERE email = ? OR ip = ?', [strtolower((string)$email), $ip]);
}

function otn_make_recovery_code(): string
{
    $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $chars = '';
    for ($i = 0; $i < 12; $i++) $chars .= $alphabet[random_int(0, strlen($alphabet) - 1)];
    return 'OTN-' . substr($chars, 0, 4) . '-' . substr($chars, 4, 8) . '-' . substr($chars, 8, 12);
}

function otn_store_recovery(string $userId, string $code): void
{
    otn_exec(
        'UPDATE users SET recovery_hash = ?, recovery_generated_at = ? WHERE id = ?',
        [otn_hash(preg_replace('/\s+/', '', strtoupper($code))), gmdate('c'), $userId]
    );
}

/* ----------------------------------------------------------------- sql -- */

function otn_query(string $sql, array $params = []): PDOStatement
{
    $statement = otn_db()->prepare($sql);
    $statement->execute($params);
    return $statement;
}

function otn_exec(string $sql, array $params = []): void
{
    otn_query($sql, $params);
}

function otn_content(string $id): ?array
{
    $row = otn_query('SELECT * FROM content WHERE id = ?', [$id])->fetch();
    if (!$row) return null;
    $row['data'] = json_decode((string)$row['content_json'], true);
    return $row;
}

function otn_save_content(string $id, array $data, int $version, ?string $actor, bool $publish = false): void
{
    $now = gmdate('c');
    $pdo = otn_db();
    $exists = otn_query('SELECT id FROM content WHERE id = ?', [$id])->fetch();
    if ($exists) {
        if ($publish) {
            otn_exec(
                'UPDATE content SET content_json = ?, version = ?, published_at = ?, published_by = ? WHERE id = ?',
                [json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), $version, $now, $actor, $id]
            );
        } else {
            otn_exec(
                'UPDATE content SET content_json = ?, version = ?, updated_at = ?, updated_by = ? WHERE id = ?',
                [json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), $version, $now, $actor, $id]
            );
        }
        return;
    }
    otn_exec(
        'INSERT INTO content (id, content_json, version, updated_at, updated_by, published_at, published_by) VALUES (?,?,?,?,?,?,?)',
        [
            $id,
            json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            $version,
            $now,
            $actor,
            $publish ? $now : null,
            $publish ? $actor : null
        ]
    );
}

function otn_log(?string $actor, string $action, string $detail = ''): void
{
    otn_exec('INSERT INTO activity (ts, actor, action, detail) VALUES (?,?,?,?)',
        [gmdate('c'), $actor ?: 'system', $action, mb_substr($detail, 0, 500)]);
}

/* ------------------------------------------------------------ install -- */

function otn_needs_setup(): bool
{
    $row = otn_query('SELECT COUNT(*) AS n FROM users')->fetch();
    return (int)($row['n'] ?? 0) === 0;
}

function otn_seed_if_empty(array $defaultContent): void
{
    if (otn_content('draft')) return;
    otn_save_content('draft', $defaultContent, 1, 'setup');
    otn_save_content('published', $defaultContent, 1, 'setup', true);
    otn_exec(
        'INSERT INTO versions (id, version, content_json, note, created_at, created_by) VALUES (?,?,?,?,?,?)',
        [otn_uid('ver'), 1, json_encode($defaultContent, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), 'Initial website', gmdate('c'), 'setup']
    );
    otn_log('setup', 'Website created', 'Imported the existing Orchard Trail Nutrition website.');
}
