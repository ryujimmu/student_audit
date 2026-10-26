<?php
/**
 * Password reset by admin approval, for treasurer and auditor only.
 * Public: POST request, POST redeem. Admin: GET list, POST approve / deny.
 * All endpoints return JSON; no email, SMS, or external API needed.
 * Requires password_reset_migration.sql to be imported once.
 */
session_start();
require_once __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, private');
header('X-Content-Type-Options: nosniff');

function resetResponse(int $code, string $status, string $message, array $extra = []): void {
    http_response_code($code);
    echo json_encode(array_merge(['status' => $status, 'message' => $message], $extra));
    exit;
}
function resetLog(PDO $pdo, ?int $uid, string $username, string $role, string $action, string $details): void {
    $q = $pdo->prepare('INSERT INTO user_logs (user_id, username, role, action, details) VALUES (?, ?, ?, ?, ?)');
    $q->execute([$uid, $username, $role, $action, $details]);
}
function validCsrf(string $expectedKey, array $input): bool {
    return isset($_SESSION[$expectedKey]) && is_string($input['csrf'] ?? null)
        && hash_equals((string)$_SESSION[$expectedKey], $input['csrf']);
}
function oneTimeCode(): string {
    $hex = strtoupper(bin2hex(random_bytes(12))); // 96 random bits
    return 'NISU-' . implode('-', str_split($hex, 4));
}

$method = $_SERVER['REQUEST_METHOD'] ?? '';
$role = $_SESSION['role'] ?? '';
$admin = isset($_SESSION['user_id']) && $role === 'admin';

if ($method === 'GET') {
    if (!$admin) resetResponse(403, 'error', 'Admin access required.');
    if (($_GET['action'] ?? '') !== 'list') resetResponse(400, 'error', 'Invalid action.');
    try {
        $q = $pdo->query("SELECT r.id, r.user_id, r.status, r.requested_at, r.decided_at,
             r.code_expires_at, u.username, u.full_name, u.role
             FROM password_reset_requests r JOIN users u ON u.id = r.user_id
             WHERE r.status IN ('pending','approved','denied','expired','completed')
             ORDER BY (r.status = 'pending') DESC, r.requested_at DESC LIMIT 75");
        resetResponse(200, 'success', 'Requests loaded.', ['requests' => $q->fetchAll(PDO::FETCH_ASSOC)]);
    } catch (Throwable $e) {
        error_log('Reset request listing failed: ' . $e->getMessage());
        resetResponse(500, 'error', 'Cannot load requests. Have you imported password_reset_migration.sql?');
    }
}
if ($method !== 'POST') resetResponse(405, 'error', 'Method not allowed.');
$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) resetResponse(400, 'error', 'Invalid request.');
$action = (string)($input['action'] ?? '');
$publicAction = in_array($action, ['request', 'redeem'], true);
$csrfKey = $publicAction ? 'password_reset_guest_csrf' : 'password_reset_admin_csrf';
if (!validCsrf($csrfKey, $input)) resetResponse(403, 'error', 'Security check failed. Refresh the page and try again.');
if ($publicAction && isset($_SESSION['user_id'])) resetResponse(403, 'error', 'Log out to use account recovery.');
if (!$publicAction && !$admin) resetResponse(403, 'error', 'Admin access required.');

try {
    if ($action === 'request') {
        $username = trim((string)($input['username'] ?? ''));
        if ($username === '' || strlen($username) > 50) resetResponse(422, 'error', 'Enter your username.');
        // Keep response indistinguishable for nonexistent users, admins, and valid officer accounts.
        $generic = 'If this is a treasurer or auditor account, the request has been sent to the administrator. Please contact the admin to verify your identity.';
        $ipHash = hash('sha256', (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown'));
        $pdo->beginTransaction();
        $check = $pdo->prepare('SELECT COUNT(*) FROM password_reset_rate_limits WHERE ip_hash = ? AND attempted_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)');
        $check->execute([$ipHash]);
        $count = (int)$check->fetchColumn();
        if ($count >= 10) {
            $pdo->commit();
            resetResponse(200, 'success', $generic);
        }
        $rate = $pdo->prepare('INSERT INTO password_reset_rate_limits (ip_hash) VALUES (?)');
        $rate->execute([$ipHash]);
        $q = $pdo->prepare("SELECT id, username, role, full_name FROM users WHERE username = ? AND role IN ('treasurer','auditor') LIMIT 1 FOR UPDATE");
        $q->execute([$username]);
        $user = $q->fetch(PDO::FETCH_ASSOC);
        if ($user) {
            $uid = (int)$user['id'];
            // An approved code stays valid until expiration; no repeated notifications.
            $pdo->prepare("UPDATE password_reset_requests SET status='expired', code_hash=NULL WHERE user_id=? AND status='approved' AND code_expires_at <= NOW()")->execute([$uid]);
            $active = $pdo->prepare("SELECT id FROM password_reset_requests WHERE user_id = ? AND status IN ('pending','approved') LIMIT 1");
            $active->execute([$uid]);
            $recent = $pdo->prepare('SELECT id FROM password_reset_requests WHERE user_id=? AND requested_at > DATE_SUB(NOW(), INTERVAL 10 MINUTE) LIMIT 1');
            $recent->execute([$uid]);
            if (!$active->fetchColumn() && !$recent->fetchColumn()) {
                $ins = $pdo->prepare('INSERT INTO password_reset_requests (user_id) VALUES (?)');
                $ins->execute([$uid]);
                $requestId = (int)$pdo->lastInsertId();
                $admins = $pdo->query("SELECT id FROM users WHERE role='admin'")->fetchAll(PDO::FETCH_COLUMN);
                $notify = $pdo->prepare("INSERT INTO notifications (user_id,type,title,body) VALUES (?, 'password_reset', ?, ?)");
                $display = trim((string)($user['full_name'] ?? ''));
                if ($display === '' || $display === 'Unassigned') $display = $user['username'];
                foreach ($admins as $adminId) {
                    $notify->execute([(int)$adminId, 'Password reset requested',
                        ucfirst($user['role']) . ' · ' . mbOrSubstr($display, 80) . ' (' . $user['username'] . ') · Request #' . $requestId]);
                }
                resetLog($pdo, $uid, $user['username'], $user['role'], 'Password Reset Requested', 'Officer requested admin approval for password recovery.');
            }
        }
        $pdo->commit();
        resetResponse(200, 'success', $generic);
    }

    if (in_array($action, ['approve','reissue','deny'], true)) {
        $id = filter_var($input['id'] ?? null, FILTER_VALIDATE_INT);
        if (!$id || $id < 1) resetResponse(422, 'error', 'Invalid request ID.');
        $pdo->beginTransaction();
        $q = $pdo->prepare("SELECT r.*, u.username, u.role FROM password_reset_requests r JOIN users u ON u.id=r.user_id WHERE r.id=? FOR UPDATE");
        $q->execute([$id]);
        $r = $q->fetch(PDO::FETCH_ASSOC);
        $allowedStatus = $action === 'reissue' ? 'approved' : 'pending';
        if (!$r || $r['status'] !== $allowedStatus || !in_array($r['role'], ['treasurer','auditor'], true)) {
            $pdo->rollBack();
            resetResponse(409, 'error', 'This request is no longer pending. Refresh the list.');
        }
        if ($action === 'deny') {
            $pdo->prepare("UPDATE password_reset_requests SET status='denied', decided_at=NOW(), approved_by=? WHERE id=?")->execute([$_SESSION['user_id'], $id]);
            resetLog($pdo, (int)$_SESSION['user_id'], $_SESSION['username'], 'admin', 'Password Reset Denied', 'Denied request #' . $id . ' for ' . $r['username']);
            $pdo->commit();
            resetResponse(200, 'success', 'Request denied.');
        }
        $code = oneTimeCode();
        $pdo->prepare("UPDATE password_reset_requests SET status='approved', failed_attempts=0, decided_at=NOW(), approved_by=?, code_hash=?, code_expires_at=DATE_ADD(NOW(), INTERVAL 30 MINUTE) WHERE id=?")
            ->execute([$_SESSION['user_id'], hash('sha256', $code), $id]);
        resetLog($pdo, (int)$_SESSION['user_id'], $_SESSION['username'], 'admin', $action === 'reissue' ? 'Password Reset Code Reissued' : 'Password Reset Approved', ($action === 'reissue' ? 'Reissued reset code for request #' : 'Approved reset request #') . $id . ' for ' . $r['username'] . ' (code shown only once).');
        $pdo->commit();
        resetResponse(200, 'success', 'Approved. Verify the officer in person and share the code privately.', ['code' => $code, 'expires_in_minutes' => 30]);
    }

    if ($action === 'redeem') {
        $username = trim((string)($input['username'] ?? ''));
        $code = strtoupper(trim((string)($input['code'] ?? '')));
        $newPass = (string)($input['new_password'] ?? '');
        $confirm = (string)($input['confirm_password'] ?? '');
        if ($username === '' || strlen($username) > 50 || strlen($code) > 70) resetResponse(422, 'error', 'Enter your username and reset code.');
        if (strlen($newPass) < 12 || strlen($newPass) > 128) resetResponse(422, 'error', 'Choose a password between 12 and 128 characters.');
        if (!hash_equals($newPass, $confirm)) resetResponse(422, 'error', 'Passwords do not match.');
        $pdo->beginTransaction();
        $q = $pdo->prepare("SELECT r.*, u.username, (r.code_expires_at > NOW()) AS code_valid FROM password_reset_requests r JOIN users u ON u.id=r.user_id WHERE u.username=? AND u.role IN ('treasurer','auditor') AND r.status='approved' ORDER BY r.id DESC LIMIT 1 FOR UPDATE");
        $q->execute([$username]);
        $r = $q->fetch(PDO::FETCH_ASSOC);
        if (!$r) {
            $pdo->rollBack();
            resetResponse(400, 'error', 'Invalid or expired reset code. Ask the admin for a new one.');
        }
        if ((int)($r['code_valid'] ?? 0) !== 1 || (int)$r['failed_attempts'] >= 5) {
            $pdo->prepare("UPDATE password_reset_requests SET status='expired', code_hash=NULL WHERE id=?")->execute([$r['id']]);
            $pdo->commit();
            resetResponse(400, 'error', 'Invalid or expired reset code. Ask the admin for a new one.');
        }
        if (!hash_equals((string)$r['code_hash'], hash('sha256', $code))) {
            $attempts = (int)$r['failed_attempts'] + 1;
            $locked = $attempts >= 5;
            $pdo->prepare("UPDATE password_reset_requests SET failed_attempts=?, status=?, code_hash=? WHERE id=?")
                ->execute([$attempts, $locked ? 'expired' : 'approved', $locked ? null : $r['code_hash'], $r['id']]);
            $pdo->commit();
            resetResponse(400, 'error', 'Invalid or expired reset code. Ask the admin for a new one.');
        }
        $passwordHash = password_hash($newPass, PASSWORD_DEFAULT);
        $pdo->prepare('UPDATE users SET password=? WHERE id=?')->execute([$passwordHash, $r['user_id']]);
        $pdo->prepare("UPDATE password_reset_requests SET status='completed', code_hash=NULL, completed_at=NOW() WHERE id=?")->execute([$r['id']]);
        resetLog($pdo, (int)$r['user_id'], $r['username'], 'officer', 'Password Reset Completed', 'Password was reset with an approved one-time code.');
        $pdo->commit();
        resetResponse(200, 'success', 'Password updated. You can now sign in with your new password.');
    }
    resetResponse(400, 'error', 'Unknown action.');
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('Password reset endpoint error: ' . $e->getMessage());
    resetResponse(500, 'error', 'The password reset service is temporarily unavailable. Ask the admin to check the migration and PHP error log.');
}

function mbOrSubstr(string $value, int $length): string {
    return function_exists('mb_substr') ? mb_substr($value, 0, $length) : substr($value, 0, $length);
}
