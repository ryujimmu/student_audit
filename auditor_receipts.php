<?php
// Keep old register links working while using the dashboard navigation.

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if (empty($_SESSION['user_id'])) {
    header('Location: login.php', true, 303);
    exit;
}

$role = $_SESSION['role'] ?? '';

$view = $role === 'auditor'
    ? 'audit-register'
    : 'admin-panel';

header(
    'Location: index.php?view=' . rawurlencode($view),
    true,
    303
);
exit;