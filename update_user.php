<?php
session_start();
require_once __DIR__ . '/request_guard.php';
require_once __DIR__ . '/db.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_SESSION['role']) && $_SESSION['role'] === 'admin') {
    $user_id = $_POST['user_id'];
    $new_username = trim($_POST['update_username']);
    $new_fullname = trim($_POST['update_fullname']); 
    $new_password = $_POST['update_password'];
    $role_name = $_POST['role_name'];

    if (!filter_var($user_id, FILTER_VALIDATE_INT) || $new_username === '' || strlen($new_username) > 50 || strlen($new_fullname) > 200 || ($new_password !== '' && (strlen($new_password) < 8 || strlen($new_password) > 72))) {
        header('Location: index.php?view=admin_users&error=InvalidUserInput', true, 303); exit;
    }
    try {
        $pdo->beginTransaction();
        if (!empty($new_password)) {
            $hashed_pass = password_hash($new_password, PASSWORD_DEFAULT);
            $stmt = $pdo->prepare("UPDATE users SET username = ?, password = ?, full_name = ? WHERE id = ?");
            $stmt->execute([$new_username, $hashed_pass, $new_fullname, $user_id]);
            $logMsg = "Updated credentials and name for " . strtoupper($role_name) . " account.";
        } else {
            $stmt = $pdo->prepare("UPDATE users SET username = ?, full_name = ? WHERE id = ?");
            $stmt->execute([$new_username, $new_fullname, $user_id]);
            $logMsg = "Updated name and username for " . strtoupper($role_name) . " account.";
        }

        $logStmt = $pdo->prepare("INSERT INTO user_logs (user_id, username, role, action, details) VALUES (?, ?, ?, 'Account Update', ?)");
        $logStmt->execute([$_SESSION['user_id'] ?? null, $_SESSION['username'], $_SESSION['role'], $logMsg]);

        $pdo->commit();
        if ($user_id == $_SESSION['user_id']) {
            $_SESSION['username'] = $new_username;
        }

        // NEW: Tell the system exactly where to return!
        header("Location: index.php?view=admin_users&msg=UserUpdated");
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        // NEW: Also return to the right place if there is an error
        header("Location: index.php?view=admin_users&error=UpdateFailed");
    }
    exit();
}

header("Location: index.php");
?>