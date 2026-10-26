<?php
session_start();
require_once __DIR__ . '/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: login.php', true, 303);
    exit;
}

$user = trim((string)($_POST['username'] ?? ''));
$pass = (string)($_POST['password'] ?? '');
if ($user === '' || $pass === '') {
    $_SESSION['login_error'] = 'Please enter your username and password.';
    $_SESSION['login_username'] = $user;
    header('Location: login.php', true, 303);
    exit;
}

try {
    $stmt = $pdo->prepare('SELECT * FROM users WHERE username = ? LIMIT 1');
    $stmt->execute([$user]);
    $foundUser = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($foundUser && password_verify($pass, $foundUser['password'])) {
        session_regenerate_id(true);
        unset($_SESSION['login_error'], $_SESSION['login_username']);
        $_SESSION['user_id'] = $foundUser['id'];
        $_SESSION['username'] = $foundUser['username'];
        $_SESSION['role'] = $foundUser['role'];
        try {
            $logStmt = $pdo->prepare("INSERT INTO user_logs (user_id, username, role, action, details) VALUES (?, ?, ?, 'System Login', 'User authenticated and logged in.')");
            $logStmt->execute([$_SESSION['user_id'], $_SESSION['username'], $_SESSION['role']]);
        } catch (PDOException $logError) {
            // A logging-table issue must not turn a valid login into a failure.
            error_log('Login audit logging failed: ' . $logError->getMessage());
        }
        header('Location: index.php', true, 303);
        exit;
    }
    $_SESSION['login_error'] = 'Incorrect username or password. Please try again.';
} catch (PDOException $e) {
    error_log('Authentication database error: ' . $e->getMessage());
    $_SESSION['login_error'] = 'Sign in is temporarily unavailable. Please try again later.';
}
$_SESSION['login_username'] = $user;
header('Location: login.php', true, 303);
exit;
