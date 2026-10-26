<?php
session_start();
require_once __DIR__ . '/request_guard.php';
require_once __DIR__ . '/db.php';

// Only allow Admins to access this script
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_SESSION['role']) && $_SESSION['role'] === 'admin') {
    $delete_id = $_POST['user_id'];

    try {
    $pdo->beginTransaction();
    // Prevent the admin from deleting their own account
    if ($delete_id != $_SESSION['user_id']) {
        // Look up who's being deleted before the row is gone, so the log
        // entry still identifies them afterward.
        $lookupStmt = $pdo->prepare("SELECT username, role FROM users WHERE id = ?");
        $lookupStmt->execute([$delete_id]);
        $targetUser = $lookupStmt->fetch(PDO::FETCH_ASSOC);

        $stmt = $pdo->prepare("DELETE FROM users WHERE id = ?");
        $stmt->execute([$delete_id]);

        if ($targetUser) {
            $logStmt = $pdo->prepare("INSERT INTO user_logs (user_id, username, role, action, details) VALUES (?, ?, ?, 'User Deleted', ?)");
            $logStmt->execute([$_SESSION['user_id'] ?? null, $_SESSION['username'], $_SESSION['role'], "Deleted " . strtoupper($targetUser['role']) . " account: " . $targetUser['username']]);
        }

        $pdo->commit();
        // Redirect back with a success message
        header("Location: index.php?msg=UserDeleted");
        exit();
    }
    $pdo->rollBack();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        error_log('User deletion failed: ' . $e->getMessage());
        header('Location: index.php?view=admin_users&error=DeleteFailed', true, 303); exit;
    }
}
header("Location: index.php");
?>