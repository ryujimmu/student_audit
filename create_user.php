<?php
session_start();
require_once __DIR__ . '/request_guard.php';
require_once __DIR__ . '/db.php';

// Only allow Admins to access this script
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_SESSION['role']) && $_SESSION['role'] === 'admin') {
    $user = trim((string)($_POST['new_username'] ?? ''));
    $rawPass = (string)($_POST['new_password'] ?? '');
    $role = (string)($_POST['new_role'] ?? '');
    if ($user === '' || strlen($user) > 50 || strlen($rawPass) > 72 || strlen($rawPass) < 8 || !in_array($role, ['admin', 'treasurer', 'auditor'], true)) {
        header('Location: index.php?view=admin_users&error=InvalidUserInput', true, 303);
        exit;
    }
    $pass = password_hash($rawPass, PASSWORD_DEFAULT);

    try {
        $pdo->beginTransaction();
        $stmt = $pdo->prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)");
        $stmt->execute([$user, $pass, $role]);

        $logStmt = $pdo->prepare("INSERT INTO user_logs (user_id, username, role, action, details) VALUES (?, ?, ?, 'User Created', ?)");
        $logStmt->execute([$_SESSION['user_id'] ?? null, $_SESSION['username'], $_SESSION['role'], "Created new " . strtoupper($role) . " account: " . $user]);

        $pdo->commit();
        header("Location: index.php?msg=UserCreated");
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        // Handle duplicate username error gracefully
        header("Location: index.php?error=UserExists");
    }
    exit();
}
header("Location: index.php");
?>