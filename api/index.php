<?php
/* Orchard Trail Nutrition — every /api route for the GoDaddy build.
   Same JSON contract as the dashboard expects; MySQL instead of D1, files on
   disk instead of R2. Publishing writes index.html. */

declare(strict_types=1);

require __DIR__ . '/lib.php';

/* Never leak a PHP error page into JSON: answer with a plain message instead. */
ini_set('display_errors', '0');
set_exception_handler(function ($error) {
    error_log('OTN error: ' . $error->getMessage());
    if (!headers_sent()) {
        http_response_code(500);
        header('content-type: application/json; charset=utf-8');
    }
    echo json_encode(['error' => 'Something went wrong on the server. Please try again.']);
});

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$path = parse_url((string)($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH) ?: '/';
$path = rtrim($path, '/');
if ($path === '') $path = '/';
$adminPath = rtrim((string)(otn_config()['admin_path'] ?? '/admin'), '/');
$path = preg_replace('#^' . preg_quote($adminPath, '#') . '/api#', '/api', $path) ?: $path;

if (!in_array($method, ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'], true)) {
    otn_fail('Method not allowed', 405);
}
if (!in_array($method, ['GET', 'HEAD'], true) && !otn_same_origin()) {
    otn_fail('That request came from another website.', 403);
}

$defaultContent = json_decode((string)@file_get_contents(__DIR__ . '/default-content.json'), true) ?: [];
if ($defaultContent) {
    otn_seed_if_empty($defaultContent);
}

/* ------------------------------------------------------------ public -- */

if ($path === '/api/site' && in_array($method, ['GET', 'HEAD'], true)) {
    $row = otn_content('published');
    if (!$row) otn_fail('The website has not been published yet.', 404);
    otn_json([
        'content' => $row['data'],
        'version' => (int)$row['version'],
        'publishedAt' => $row['published_at']
    ]);
}

if ($path === '/api/track' && $method === 'POST') {
    $body = otn_read_json();
    if (!$body) otn_fail('Nothing to record', 400);
    otn_track($body);
    otn_json(['ok' => true], 202);
}

/* -------------------------------------------------------------- auth -- */

if ($path === '/api/auth/status' && $method === 'GET') {
    $user = otn_current_user();
    otn_json(['authenticated' => (bool)$user, 'user' => $user, 'needsSetup' => otn_needs_setup()]);
}

if ($path === '/api/auth/setup' && $method === 'POST') {
    if (!otn_needs_setup()) otn_fail('This website already has an owner account.', 409, ['needsSetup' => false]);
    $body = otn_read_json();
    $email = strtolower(trim((string)($body['email'] ?? '')));
    $name = trim((string)($body['name'] ?? ''));
    if (!otn_email_ok($email)) otn_fail('Enter a valid email address.');
    $problem = otn_password_problem($body['password'] ?? '');
    if ($problem) otn_fail($problem);

    $id = otn_uid('usr');
    $recovery = otn_make_recovery_code();
    otn_exec(
        'INSERT INTO users (id, email, name, role, password_hash, created_at) VALUES (?,?,?,?,?,?)',
        [$id, $email, $name ?: 'Owner', 'owner', password_hash((string)$body['password'], PASSWORD_DEFAULT), gmdate('c')]
    );
    otn_store_recovery($id, $recovery);
    $token = otn_start_session($id);
    otn_log($email, 'Owner account created', 'Signed up as the website owner.');
    otn_json(
        ['user' => ['id' => $id, 'email' => $email, 'name' => $name ?: 'Owner', 'role' => 'owner'], 'recoveryCode' => $recovery],
        200,
        ['set-cookie' => otn_session_cookie($token)]
    );
}

if ($path === '/api/auth/login' && $method === 'POST') {
    $body = otn_read_json();
    $email = strtolower(trim((string)($body['email'] ?? '')));
    $password = (string)($body['password'] ?? '');
    $ip = otn_ip();
    $throttled = otn_attempts(otn_db(), $email, $ip) >= OTN_MAX_ATTEMPTS;
    $row = otn_query('SELECT * FROM users WHERE email = ? AND disabled = 0', [$email])->fetch();
    $ok = $row ? password_verify($password, (string)$row['password_hash']) : false;
    otn_record_attempt($email, $ip, $ok);
    if (!$ok) {
        if ($throttled) otn_fail('That password did not match. After several wrong tries, sign-in pauses for 15 minutes.', 429);
        otn_fail('That email and password do not match.', 401);
    }
    otn_clear_attempts($email, $ip);
    otn_exec('UPDATE users SET last_login_at = ? WHERE id = ?', [gmdate('c'), $row['id']]);
    $token = otn_start_session((string)$row['id']);
    otn_json(
        ['user' => ['id' => $row['id'], 'email' => $row['email'], 'name' => $row['name'], 'role' => $row['role']]],
        200,
        ['set-cookie' => otn_session_cookie($token)]
    );
}

if ($path === '/api/auth/logout' && $method === 'POST') {
    $token = $_COOKIE[OTN_COOKIE] ?? '';
    if ($token !== '') otn_exec('DELETE FROM sessions WHERE token_hash = ?', [otn_hash($token)]);
    otn_json(['ok' => true], 200, ['set-cookie' => otn_clear_cookie()]);
}

if ($path === '/api/auth/recover' && $method === 'POST') {
    $body = otn_read_json();
    $ip = otn_ip();
    if (otn_attempts(otn_db(), (string)($body['email'] ?? ''), $ip) >= OTN_MAX_ATTEMPTS) {
        otn_fail('Too many attempts. Please wait 15 minutes and try again.', 429);
    }
    $email = strtolower(trim((string)($body['email'] ?? '')));
    $row = otn_query('SELECT id, recovery_hash FROM users WHERE email = ? AND disabled = 0', [$email])->fetch();
    $code = preg_replace('/\s+/', '', strtoupper((string)($body['code'] ?? '')));
    $matched = $row && $row['recovery_hash'] && hash_equals((string)$row['recovery_hash'], otn_hash($code));
    otn_record_attempt($email, $ip, (bool)$matched);
    if (!$matched) otn_fail('That email and recovery code do not match.', 401);
    $problem = otn_password_problem($body['password'] ?? '');
    if ($problem) otn_fail($problem);
    $recovery = otn_make_recovery_code();
    otn_exec('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash((string)$body['password'], PASSWORD_DEFAULT), $row['id']]);
    otn_store_recovery((string)$row['id'], $recovery);
    otn_exec('DELETE FROM sessions WHERE user_id = ?', [$row['id']]);
    $user = otn_query('SELECT id, email, name, role FROM users WHERE id = ?', [$row['id']])->fetch();
    $token = otn_start_session((string)$row['id']);
    otn_log((string)$user['email'], 'Password reset', 'Signed in with a recovery code and chose a new password.');
    otn_json(['user' => $user, 'recoveryCode' => $recovery], 200, ['set-cookie' => otn_session_cookie($token)]);
}

/* ------------------------------------------------------- signed in -- */

$user = otn_require_user();
$actor = (string)$user['email'];

if ($path === '/api/admin/content' && $method === 'GET') {
    $draft = otn_content('draft');
    $published = otn_content('published');
    $versions = otn_query('SELECT id, version, created_at, created_by, note FROM versions ORDER BY version DESC LIMIT 20')->fetchAll();
    otn_json([
        'draft' => $draft ? [
            'content' => $draft['data'],
            'version' => (int)$draft['version'],
            'updatedAt' => $draft['updated_at'],
            'updatedBy' => $draft['updated_by']
        ] : null,
        'published' => $published ? [
            'version' => (int)$published['version'],
            'publishedAt' => $published['published_at'],
            'publishedBy' => $published['published_by'],
            'pending' => (bool)($draft && (int)$draft['version'] > (int)$published['version'])
        ] : null,
        'versions' => array_map(fn($row) => [
            'id' => $row['id'],
            'version' => (int)$row['version'],
            'created_at' => $row['created_at'],
            'created_by' => $row['created_by'],
            'note' => $row['note']
        ], $versions),
        'user' => $user
    ]);
}

if ($path === '/api/admin/content' && $method === 'PUT') {
    $body = otn_read_json();
    $content = $body['content'] ?? null;
    $problem = otn_validate_content($content);
    if ($problem) otn_fail($problem);
    $current = otn_query('SELECT version FROM content WHERE id = ?', ['draft'])->fetch();
    if (!$current) otn_fail('The draft is missing. Reload the dashboard.', 409);
    if (isset($body['baseVersion']) && (int)$body['baseVersion'] !== (int)$current['version']) {
        otn_fail('Someone else saved changes while you were editing. Reload to see the newest version.', 409, [
            'version' => (int)$current['version']
        ]);
    }
    $next = (int)$current['version'] + 1;
    otn_save_content('draft', $content, $next, $actor);
    $saved = otn_content('draft');
    otn_json(['version' => $next, 'savedAt' => $saved['updated_at']]);
}

if ($path === '/api/admin/publish' && $method === 'POST') {
    $draft = otn_content('draft');
    if (!$draft) otn_fail('There is nothing to publish yet.', 409);
    $body = otn_read_json() ?: [];
    $html = (string)($body['html'] ?? '');
    if (strlen($html) < 2000 || stripos($html, '<html') === false) {
        otn_fail('The page could not be built. Reload the dashboard and publish again.');
    }
    $published = otn_query('SELECT version FROM content WHERE id = ?', ['published'])->fetch();
    $version = (int)($published['version'] ?? 0) + 1;
    $now = gmdate('c');
    otn_save_content('published', $draft['data'], $version, $actor, true);
    otn_exec(
        'INSERT INTO versions (id, version, content_json, note, created_at, created_by) VALUES (?,?,?,?,?,?)',
        [otn_uid('ver'), $version, (string)$draft['content_json'], mb_substr((string)($body['note'] ?? 'Published from the dashboard'), 0, 255), $now, $actor]
    );
    otn_exec('DELETE FROM versions WHERE id NOT IN (SELECT id FROM (SELECT id FROM versions ORDER BY version DESC LIMIT 40) AS keep)');
    otn_write_site($html, $now);
    otn_log($actor, 'Published changes', 'Version ' . $version . ' is now live.');
    otn_exec('DELETE FROM analytics WHERE day < ?', [gmdate('Y-m-d', time() - 400 * 86400)]);
    otn_json(['version' => $version, 'publishedAt' => $now]);
}

if ($path === '/api/admin/versions' && $method === 'GET') {
    $rows = otn_query('SELECT id, version, created_at, created_by, note FROM versions ORDER BY version DESC LIMIT 40')->fetchAll();
    otn_json(['versions' => $rows]);
}

if (preg_match('#^/api/admin/versions/([^/]+)/restore$#', $path, $match) && $method === 'POST') {
    $row = otn_query('SELECT * FROM versions WHERE id = ?', [urldecode($match[1])])->fetch();
    if (!$row) otn_fail('That version no longer exists.', 404);
    $data = json_decode((string)$row['content_json'], true);
    if (!is_array($data)) otn_fail('That version could not be read.', 409);
    $draft = otn_query('SELECT version FROM content WHERE id = ?', ['draft'])->fetch();
    otn_save_content('draft', $data, (int)($draft['version'] ?? 0) + 1, $actor);
    $published = otn_query('SELECT version FROM content WHERE id = ?', ['published'])->fetch();
    $version = (int)($published['version'] ?? 0) + 1;
    $now = gmdate('c');
    otn_save_content('published', $data, $version, $actor, true);
    otn_exec(
        'INSERT INTO versions (id, version, content_json, note, created_at, created_by) VALUES (?,?,?,?,?,?)',
        [otn_uid('ver'), $version, (string)$row['content_json'], 'Restored version ' . $row['version'], $now, $actor]
    );
    $body = otn_read_json() ?: [];
    if (!empty($body['html'])) otn_write_site((string)$body['html'], $now);
    otn_log($actor, 'Restored a previous version', 'Version ' . $row['version'] . ' was published again.');
    otn_json(['version' => $version, 'publishedAt' => $now]);
}

if (preg_match('#^/api/admin/versions/([^/]+)$#', $path, $match) && $method === 'GET') {
    $row = otn_query('SELECT * FROM versions WHERE id = ?', [urldecode($match[1])])->fetch();
    if (!$row) otn_fail('That version no longer exists.', 404);
    otn_json([
        'id' => $row['id'],
        'version' => (int)$row['version'],
        'note' => $row['note'],
        'created_at' => $row['created_at'],
        'content' => json_decode((string)$row['content_json'], true)
    ]);
}

if ($path === '/api/admin/activity' && $method === 'GET') {
    otn_json(['activity' => otn_query('SELECT ts, actor, action, detail FROM activity ORDER BY id DESC LIMIT 25')->fetchAll()]);
}

if ($path === '/api/admin/export' && in_array($method, ['GET', 'HEAD'], true)) {
    $draft = otn_content('draft');
    $published = otn_content('published');
    $versions = otn_query('SELECT version, created_at, content_json FROM versions ORDER BY version DESC')->fetchAll();
    $media = otn_query('SELECT id, media_key, filename, alt, folder, created_at FROM media')->fetchAll();
    $body = json_encode([
        'exportedAt' => gmdate('c'),
        'website' => otn_site_url(),
        'published' => $published['data'] ?? null,
        'draft' => $draft['data'] ?? null,
        'versions' => array_map(fn($row) => [
            'version' => (int)$row['version'],
            'created_at' => $row['created_at'],
            'content' => json_decode((string)$row['content_json'], true)
        ], $versions),
        'media' => $media
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    header('content-type: application/json; charset=utf-8');
    header('content-disposition: attachment; filename="orchard-trail-backup-' . gmdate('Y-m-d') . '.json"');
    header('cache-control: no-store');
    echo $body;
    exit;
}

/* ------------------------------------------------------------- media -- */

if ($path === '/api/admin/media' && $method === 'GET') {
    $q = trim((string)($_GET['q'] ?? ''));
    $folder = trim((string)($_GET['folder'] ?? ''));
    $sql = 'SELECT * FROM media';
    $clauses = [];
    $binds = [];
    if ($q !== '') {
        $clauses[] = '(filename LIKE ? OR original_name LIKE ? OR alt LIKE ?)';
        array_push($binds, "%$q%", "%$q%", "%$q%");
    }
    if ($folder !== '' && $folder !== 'all') {
        $clauses[] = 'folder = ?';
        $binds[] = $folder;
    }
    if ($clauses) $sql .= ' WHERE ' . implode(' AND ', $clauses);
    $sql .= ' ORDER BY created_at DESC LIMIT 300';
    $rows = otn_query($sql, $binds)->fetchAll();
    $folders = otn_query("SELECT DISTINCT folder FROM media WHERE folder IS NOT NULL AND folder != ''")->fetchAll();
    otn_json([
        'media' => array_map(fn($row) => otn_media_row($row), $rows),
        'folders' => array_values(array_filter(array_map(fn($row) => $row['folder'], $folders)))
    ]);
}

if ($path === '/api/admin/media' && $method === 'POST') {
    $files = $_FILES['file'] ?? null;
    if (!$files) otn_fail('The upload did not arrive. Try again.');
    $names = is_array($files['name']) ? $files['name'] : [$files['name']];
    $count = count($names);
    if ($count === 0) otn_fail('Choose at least one image to upload.');
    if ($count > 12) otn_fail('Upload up to 12 images at a time.');
    $folder = mb_substr(trim((string)($_POST['folder'] ?? 'Website')), 0, 40);
    $alt = mb_substr(trim((string)($_POST['alt'] ?? '')), 0, 300);
    $dims = [];
    foreach (explode(';', (string)($_POST['dimensions'] ?? '')) as $entry) {
        [$index, $size] = array_pad(explode(':', $entry, 2), 2, '');
        if ($index === '' || $size === '') continue;
        [$w, $h] = array_pad(explode('x', $size), 2, '0');
        $dims[(int)$index] = ['width' => (int)$w, 'height' => (int)$h];
    }
    $allowed = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
    $directory = otn_root() . '/media';
    if (!is_dir($directory)) @mkdir($directory, 0775, true);
    if (!is_writable($directory)) otn_fail('The media folder is not writable. Set its permissions to 755 or 775 in cPanel.', 500);

    $saved = [];
    for ($i = 0; $i < $count; $i++) {
        $tmp = is_array($files['tmp_name']) ? $files['tmp_name'][$i] : $files['tmp_name'];
        $type = strtolower((string)(is_array($files['type']) ? $files['type'][$i] : $files['type']));
        $size = (int)(is_array($files['size']) ? $files['size'][$i] : $files['size']);
        $originalName = (string)(is_array($files['name']) ? $files['name'][$i] : $files['name']);
        if (!isset($allowed[$type])) otn_fail('"' . $originalName . '" is not a JPEG, PNG or WebP image.', 415);
        if ($size > 8 * 1024 * 1024) otn_fail('"' . $originalName . '" is larger than 8 MB.', 413);
        if (!is_uploaded_file($tmp)) otn_fail('The upload did not arrive. Try again.');
        $base = preg_replace('/\.[a-z0-9]+$/i', '', $originalName);
        $base = trim(preg_replace('/[^a-z0-9]+/', '-', strtolower($base)), '-');
        $base = mb_substr($base ?: 'photo', 0, 48);
        $id = otn_uid('img');
        $key = substr($id, 4) . '-' . $base . '.' . $allowed[$type];
        if (!move_uploaded_file($tmp, $directory . '/' . $key)) otn_fail('That photo could not be saved.', 500);
        $now = gmdate('c');
        $dim = $dims[$i] ?? [];
        otn_exec(
            'INSERT INTO media (id, media_key, filename, original_name, mime, size, width, height, folder, alt, created_at, uploaded_by)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
            [$id, $key, $base . '.' . $allowed[$type], $originalName, $type, $size, $dim['width'] ?? null, $dim['height'] ?? null, $folder, $alt, $now, $actor]
        );
        $saved[] = ['id' => $id, 'key' => $key, 'url' => '/media/' . $key, 'filename' => $base . '.' . $allowed[$type], 'size' => $size, 'folder' => $folder, 'alt' => $alt];
    }
    otn_log($actor, 'Uploaded photos', implode(', ', array_column($saved, 'filename')));
    otn_json(['media' => $saved]);
}

if (preg_match('#^/api/admin/media/([^/]+)$#', $path, $match) && in_array($method, ['PATCH', 'DELETE'], true)) {
    $id = urldecode($match[1]);
    $row = otn_query('SELECT * FROM media WHERE id = ?', [$id])->fetch();
    if (!$row) otn_fail('That photo is no longer in your library.', 404);

    if ($method === 'PATCH') {
        $body = otn_read_json() ?: [];
        $filename = isset($body['filename']) ? mb_substr((string)$body['filename'], 0, 120) : $row['filename'];
        $alt = isset($body['alt']) ? mb_substr((string)$body['alt'], 0, 300) : $row['alt'];
        $folder = isset($body['folder']) ? mb_substr((string)$body['folder'], 0, 40) : $row['folder'];
        otn_exec('UPDATE media SET filename = ?, alt = ?, folder = ? WHERE id = ?', [$filename, $alt, $folder, $id]);
        otn_json(['media' => otn_media_row(array_merge($row, ['filename' => $filename, 'alt' => $alt, 'folder' => $folder]))]);
    }

    $needle = '/media/' . $row['media_key'];
    $used = [];
    foreach ([['draft', 'Draft website'], ['published', 'Published website']] as [$which, $label]) {
        $content = otn_content($which);
        $json = $content ? (string)$content['json'] : '';
        if ($json !== '' && strpos($json, $needle) !== false) $used[] = $label;
    }
    if ($used) otn_fail('This photo is still used on the website. Replace it first, then delete it.', 409, ['usedBy' => $used]);
    @unlink(otn_root() . '/media/' . $row['media_key']);
    otn_exec('DELETE FROM media WHERE id = ?', [$id]);
    otn_log($actor, 'Deleted a photo', (string)$row['filename']);
    otn_json(['ok' => true]);
}

/* ------------------------------------------------------------ people -- */

if ($path === '/api/admin/users' && $method === 'GET') {
    $rows = otn_query('SELECT id, email, name, role, created_at, last_login_at, disabled FROM users ORDER BY created_at')->fetchAll();
    otn_json(['users' => $rows, 'canManage' => $user['role'] === 'owner']);
}

if ($path === '/api/admin/users' && $method === 'POST') {
    if ($user['role'] !== 'owner') otn_fail('Only the owner can add people.', 403);
    $body = otn_read_json() ?: [];
    $email = strtolower(trim((string)($body['email'] ?? '')));
    if (!otn_email_ok($email)) otn_fail('Enter a valid email address.');
    $problem = otn_password_problem($body['password'] ?? '');
    if ($problem) otn_fail($problem);
    if (otn_query('SELECT id FROM users WHERE email = ?', [$email])->fetch()) otn_fail('That email already has an account.', 409);
    $id = otn_uid('usr');
    $role = ($body['role'] ?? '') === 'owner' ? 'owner' : 'editor';
    otn_exec(
        'INSERT INTO users (id, email, name, role, password_hash, created_at) VALUES (?,?,?,?,?,?)',
        [$id, $email, mb_substr((string)($body['name'] ?? 'Team member'), 0, 80), $role, password_hash((string)$body['password'], PASSWORD_DEFAULT), gmdate('c')]
    );
    otn_log($actor, 'Added a team member', $email);
    otn_json(['user' => ['id' => $id, 'email' => $email, 'role' => $role]]);
}

if (preg_match('#^/api/admin/users/([^/]+)$#', $path, $match) && $method === 'DELETE') {
    if ($user['role'] !== 'owner') otn_fail('Only the owner can remove people.', 403);
    $id = urldecode($match[1]);
    if ($id === $user['id']) otn_fail('You cannot remove your own account.', 400);
    $target = otn_query('SELECT email, role FROM users WHERE id = ?', [$id])->fetch();
    $owners = otn_query("SELECT COUNT(*) AS n FROM users WHERE role = 'owner'")->fetch();
    if ($target && $target['role'] === 'owner' && (int)$owners['n'] <= 1) {
        otn_fail('Keep at least one owner account.', 400);
    }
    otn_exec('DELETE FROM users WHERE id = ?', [$id]);
    otn_exec('DELETE FROM sessions WHERE user_id = ?', [$id]);
    otn_log($actor, 'Removed a team member', (string)($target['email'] ?? $id));
    otn_json(['ok' => true]);
}

/* ----------------------------------------------------------- account -- */

if ($path === '/api/auth/password' && $method === 'POST') {
    $body = otn_read_json() ?: [];
    $row = otn_query('SELECT password_hash FROM users WHERE id = ?', [$user['id']])->fetch();
    if (!password_verify((string)($body['current'] ?? ''), (string)$row['password_hash'])) {
        otn_fail('Your current password is not right.', 403);
    }
    $problem = otn_password_problem($body['next'] ?? '');
    if ($problem) otn_fail($problem);
    otn_exec('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash((string)$body['next'], PASSWORD_DEFAULT), $user['id']]);
    $token = $_COOKIE[OTN_COOKIE] ?? '';
    if ($token !== '') otn_exec('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?', [$user['id'], otn_hash($token)]);
    otn_log($actor, 'Changed password');
    otn_json(['ok' => true]);
}

if ($path === '/api/auth/email' && $method === 'POST') {
    $body = otn_read_json() ?: [];
    $row = otn_query('SELECT email, password_hash FROM users WHERE id = ?', [$user['id']])->fetch();
    if (!password_verify((string)($body['current'] ?? ''), (string)$row['password_hash'])) {
        otn_fail('Your current password is not right.', 403);
    }
    $email = strtolower(trim((string)($body['email'] ?? '')));
    if (!otn_email_ok($email)) otn_fail('Enter a valid email address.');
    if ($email !== strtolower((string)$row['email'])) {
        if (otn_query('SELECT id FROM users WHERE email = ? AND id != ?', [$email, $user['id']])->fetch()) {
            otn_fail('Another account already uses that email address.', 409);
        }
        otn_exec('UPDATE users SET email = ? WHERE id = ?', [$email, $user['id']]);
        otn_log($actor, 'Changed sign-in email', $email);
    }
    otn_json(['ok' => true, 'user' => array_merge($user, ['email' => $email])]);
}

if ($path === '/api/auth/recovery-code' && $method === 'POST') {
    $code = otn_make_recovery_code();
    otn_store_recovery((string)$user['id'], $code);
    otn_log($actor, 'Generated a new recovery code');
    otn_json(['recoveryCode' => $code]);
}

/* --------------------------------------------------------- analytics -- */

if ($path === '/api/admin/analytics' && $method === 'GET') {
    otn_json(otn_analytics_report());
}

otn_fail('Not found', 404);

/* ---------------------------------------------------------- helpers -- */

function otn_validate_content($content): ?string
{
    if (!is_array($content)) return 'The website content is missing.';
    foreach (['sections', 'drinks', 'collections'] as $key) {
        if (!isset($content[$key]) || !is_array($content[$key])) {
            return $key === 'sections' ? 'The website sections are missing.'
                : ($key === 'drinks' ? 'The drink list is missing.' : 'The seasonal collections are missing.');
        }
    }
    if (!isset($content['business']) || !is_array($content['business'])) return 'Business information is missing.';
    if (!isset($content['seo']) || !is_array($content['seo'])) return 'Search settings are missing.';
    return null;
}

function otn_media_row(array $row): array
{
    return [
        'id' => $row['id'],
        'key' => $row['media_key'],
        'filename' => $row['filename'],
        'original_name' => $row['original_name'],
        'mime' => $row['mime'],
        'size' => (int)$row['size'],
        'width' => $row['width'] !== null ? (int)$row['width'] : null,
        'height' => $row['height'] !== null ? (int)$row['height'] : null,
        'folder' => $row['folder'],
        'alt' => $row['alt'],
        'created_at' => $row['created_at'],
        'uploaded_by' => $row['uploaded_by'],
        'url' => '/media/' . $row['media_key']
    ];
}

function otn_write_site(string $html, string $now): void
{
    $root = otn_root();
    $temp = $root . '/index.html.tmp';
    if (@file_put_contents($temp, $html) === false || !@rename($temp, $root . '/index.html')) {
        otn_fail('The page could not be written to disk. Check that the site folder is writable (permissions 755).', 500);
    }
    $origin = otn_site_url();
    @file_put_contents(
        $root . '/sitemap.xml',
        '<?xml version="1.0" encoding="UTF-8"?>' . "\n" .
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>' . htmlspecialchars($origin . '/', ENT_XML1) .
        '</loc><lastmod>' . gmdate('c') . '</lastmod><changefreq>weekly</changefreq></url></urlset>'
    );
    @file_put_contents($root . '/robots.txt', "User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api\n\nSitemap: " . $origin . "/sitemap.xml\n");
}

function otn_track(array $body): void
{
    $type = ($body['type'] ?? '') === 'event' ? 'event' : 'pageview';
    $path = mb_substr((string)($body['path'] ?? '/'), 0, 300);
    if (strpos($path, '/admin') === 0 || strpos($path, '/preview') === 0) return;
    $ua = (string)($_SERVER['HTTP_USER_AGENT'] ?? '');
    $salt = (string)(otn_config()['analytics_salt'] ?? 'otn');
    $visitor = substr(otn_hash(otn_ip() . '|' . $ua . '|' . $salt), 0, 22);
    $referrer = '';
    $raw = (string)($body['referrer'] ?? '');
    if ($raw !== '') {
        $host = parse_url($raw, PHP_URL_HOST);
        if ($host) $referrer = preg_replace('/^www\./', '', (string)$host);
    }
    $device = preg_match('/mobile|iphone|android|ipod/i', $ua) ? 'mobile'
        : (preg_match('/ipad|tablet/i', $ua) ? 'tablet' : 'desktop');
    $event = $type === 'event' ? mb_substr((string)($body['event'] ?? 'action'), 0, 40) : 'pageview';
    otn_exec(
        'INSERT INTO analytics (ts, day, path, referrer, device, visitor, visitor_session, event_name, label) VALUES (?,?,?,?,?,?,?,?,?)',
        [
            gmdate('c'),
            gmdate('Y-m-d'),
            $path,
            $referrer,
            $device,
            $visitor,
            mb_substr((string)($body['session'] ?? ''), 0, 40) ?: null,
            $event,
            mb_substr((string)($body['label'] ?? ''), 0, 160)
        ]
    );
}

function otn_analytics_report(): array
{
    $range = (string)($_GET['range'] ?? '30d');
    $today = gmdate('Y-m-d');
    $end = (string)($_GET['to'] ?? $today);
    if ($range === 'custom') {
        $start = (string)($_GET['from'] ?? gmdate('Y-m-d', time() - 30 * 86400));
    } elseif ($range === 'today') {
        $start = $end;
    } else {
        $days = $range === '7d' ? 7 : ($range === '90d' ? 90 : 30);
        $start = gmdate('Y-m-d', strtotime($end . ' -' . ($days - 1) . ' days'));
    }
    $spanDays = max(1, (int)round((strtotime($end) - strtotime($start)) / 86400) + 1);
    $prevEnd = gmdate('Y-m-d', strtotime($start . ' -1 day'));
    $prevStart = gmdate('Y-m-d', strtotime($prevEnd . ' -' . ($spanDays - 1) . ' days'));

    $one = fn(string $sql, array $binds) => otn_query($sql, $binds)->fetch();
    $all = fn(string $sql, array $binds) => otn_query($sql, $binds)->fetchAll();

    $totals = $one("SELECT COUNT(*) AS views, COUNT(DISTINCT visitor) AS visitors, COUNT(DISTINCT visitor_session) AS visits
                      FROM analytics WHERE day >= ? AND day <= ? AND event_name = 'pageview'", [$start, $end]);
    $previous = $one("SELECT COUNT(*) AS views, COUNT(DISTINCT visitor) AS visitors, COUNT(DISTINCT visitor_session) AS visits
                        FROM analytics WHERE day >= ? AND day <= ? AND event_name = 'pageview'", [$prevStart, $prevEnd]);
    $series = $all("SELECT day,
                           SUM(CASE WHEN event_name = 'pageview' THEN 1 ELSE 0 END) AS views,
                           COUNT(DISTINCT visitor) AS visitors
                      FROM analytics WHERE day >= ? AND day <= ? GROUP BY day ORDER BY day", [$start, $end]);
    $pages = $all("SELECT path, COUNT(*) AS views FROM analytics
                    WHERE day >= ? AND day <= ? AND event_name = 'pageview'
                    GROUP BY path ORDER BY views DESC LIMIT 10", [$start, $end]);
    $sources = $all("SELECT CASE WHEN referrer = '' OR referrer IS NULL THEN 'Direct' ELSE referrer END AS source,
                            COUNT(*) AS views FROM analytics
                      WHERE day >= ? AND day <= ? AND event_name = 'pageview'
                      GROUP BY referrer ORDER BY views DESC LIMIT 8", [$start, $end]);
    $devices = $all("SELECT device, COUNT(DISTINCT visitor) AS visitors FROM analytics
                      WHERE day >= ? AND day <= ? AND event_name = 'pageview'
                      GROUP BY device ORDER BY visitors DESC", [$start, $end]);
    $actions = $all("SELECT event_name AS event, COUNT(*) AS clicks FROM analytics
                      WHERE day >= ? AND day <= ? AND event_name != 'pageview'
                      GROUP BY event_name ORDER BY clicks DESC", [$start, $end]);
    $topDrink = $one("SELECT label, COUNT(*) AS clicks FROM analytics
                       WHERE day >= ? AND day <= ? AND event_name = 'drink'
                       GROUP BY label ORDER BY clicks DESC LIMIT 1", [$start, $end]);
    $returning = $one("SELECT COUNT(*) AS n FROM (
                         SELECT visitor FROM analytics WHERE day >= ? AND day <= ?
                          GROUP BY visitor HAVING COUNT(DISTINCT day) > 1) AS repeaters", [$start, $end]);

    /* Session length is worked out here so it behaves the same on SQLite and MySQL. */
    $stamps = $all("SELECT visitor_session AS sid, ts FROM analytics
                     WHERE day >= ? AND day <= ? AND visitor_session IS NOT NULL", [$start, $end]);
    $sessions = [];
    foreach ($stamps as $row) {
        $sid = (string)$row['sid'];
        $time = strtotime((string)$row['ts']);
        if ($time === false) continue;
        $sessions[$sid][] = $time;
    }
    $durations = [];
    foreach ($sessions as $times) {
        if (count($times) < 2) continue;
        $durations[] = max($times) - min($times);
    }
    $engagement = $durations ? (int)round(array_sum($durations) / count($durations)) : 0;

    $mediaCountRow = $one('SELECT COUNT(*) AS n FROM media', []);
    $published = otn_content('published');
    $drinkCount = isset($published['data']['drinks']) && is_array($published['data']['drinks']) ? count($published['data']['drinks']) : 0;

    $percent = function (int $now, int $before): ?int {
        if ($before === 0) return null;
        return (int)round((($now - $before) / $before) * 100);
    };
    $labels = ['today' => 'today', '7d' => 'the last 7 days', '30d' => 'the last 30 days', '90d' => 'the last 90 days'];

    return [
        'range' => $range,
        'start' => $start,
        'end' => $end,
        'label' => $range === 'custom' ? $start . ' to ' . $end : ($labels[$range] ?? 'the last 30 days'),
        'totals' => [
            'views' => (int)$totals['views'],
            'visitors' => (int)$totals['visitors'],
            'visits' => (int)$totals['visits'],
            'engagementSeconds' => $engagement,
            'returning' => (int)$returning['n']
        ],
        'previous' => [
            'views' => (int)$previous['views'],
            'visitors' => (int)$previous['visitors'],
            'visits' => (int)$previous['visits'],
            'comparableDays' => $spanDays
        ],
        'change' => [
            'views' => $percent((int)$totals['views'], (int)$previous['views']),
            'visitors' => $percent((int)$totals['visitors'], (int)$previous['visitors']),
            'enoughData' => (int)$previous['views'] >= 10
        ],
        'series' => array_map(fn($row) => [
            'day' => $row['day'],
            'views' => (int)$row['views'],
            'visitors' => (int)$row['visitors']
        ], $series),
        'pages' => array_map(fn($row) => ['path' => $row['path'], 'views' => (int)$row['views']], $pages),
        'sources' => array_map(fn($row) => ['source' => $row['source'], 'views' => (int)$row['views']], $sources),
        'devices' => array_map(fn($row) => ['device' => $row['device'], 'visitors' => (int)$row['visitors']], $devices),
        'actions' => array_map(fn($row) => ['event' => $row['event'], 'clicks' => (int)$row['clicks']], $actions),
        'topDrinkId' => $topDrink['label'] ?? null,
        'mediaCount' => (int)$mediaCountRow['n'],
        'drinkCount' => $drinkCount,
        'hasData' => (int)$totals['views'] > 0
    ];
}
