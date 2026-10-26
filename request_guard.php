<?php
// Include after session_start(), before processing any state-changing request.
function requireAppCsrf(): void {
    if (in_array($_SERVER['REQUEST_METHOD'] ?? 'GET', ['GET','HEAD','OPTIONS'], true)) return;
    $token = $_SERVER['HTTP_X_APP_CSRF'] ?? ($_POST['app_csrf'] ?? null);
    if (!is_string($token) || empty($_SESSION['app_csrf']) || !hash_equals($_SESSION['app_csrf'], $token)) {
        http_response_code(403);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['status'=>'error','message'=>'Refresh the dashboard before saving.']);
        exit;
    }
}
requireAppCsrf();
