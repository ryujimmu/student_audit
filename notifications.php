<?php
// Per-account notification feed. Muting hides alerts without deleting them.
session_start();
require_once __DIR__ . '/request_guard.php';
require_once __DIR__ . '/db.php';
header('Content-Type: application/json');
header('Cache-Control: no-store');
require_once __DIR__ . '/settings_store.php';

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['status' => 'error', 'message' => 'Not authenticated.']);
    exit;
}

$myId = $_SESSION['user_id'];
$method = $_SERVER['REQUEST_METHOD'];
// Preferences filter the feed, never erase alerts or affect access to messages.
$prefs=ws_notifications($pdo,(int)$myId);
$filters=[];
if(!$prefs['messages'])$filters[]="COALESCE(type,'') <> 'message'";
if(!$prefs['password_reset'] || ($_SESSION['role']??'')!=='admin')$filters[]="COALESCE(type,'') <> 'password_reset'";
if(!$prefs['system'])$filters[]="type IN ('message','password_reset')";
$feedWhere=$filters?' AND '.implode(' AND ',$filters):'';

if ($method === 'GET') {
    $action = $_GET['action'] ?? 'list';

    // Cheap polling target: just the unread count.
    if ($action === 'count') {
        $stmt = $pdo->prepare("SELECT COUNT(*) AS total, COALESCE(MAX(id),0) AS latest_id FROM notifications WHERE user_id = ? AND is_read = 0{$feedWhere}");
        $stmt->execute([$myId]);
        $counts=$stmt->fetch(PDO::FETCH_ASSOC);
        echo json_encode(['status'=>'success','unread_count'=>(int)$counts['total'],'latest_unread_id'=>(int)$counts['latest_id'],'preferences'=>$prefs]);
        exit;
    }

    // Recent notifications for the dropdown.
    if ($action === 'list') {
        $stmt = $pdo->prepare("SELECT * FROM notifications WHERE user_id = ?{$feedWhere} ORDER BY created_at DESC, id DESC LIMIT 30");
        $stmt->execute([$myId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $countStmt = $pdo->prepare("SELECT COUNT(*) AS total, COALESCE(MAX(id),0) AS latest_id FROM notifications WHERE user_id = ? AND is_read = 0{$feedWhere}");
        $countStmt->execute([$myId]);
        $counts=$countStmt->fetch(PDO::FETCH_ASSOC);
        echo json_encode([
            'status' => 'success',
            'notifications' => array_map(function ($n) {
                return [
                    'id' => (int)$n['id'],
                    'type' => $n['type'],
                    'title' => $n['title'],
                    'body' => $n['body'],
                    'conversation_id' => $n['conversation_id'] ? (int)$n['conversation_id'] : null,
                    'is_read' => (bool)$n['is_read'],
                    'created_at' => $n['created_at'],
                ];
            }, $rows),
            'unread_count' => (int)$counts['total'],
        ]);
        exit;
    }

    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Unknown action.']);
    exit;
}

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $action = $input['action'] ?? '';

    if ($action === 'mark_read') {
        $id = intval($input['id'] ?? 0);
        if (!$id) {
            echo json_encode(['status' => 'error', 'message' => 'Missing notification id.']);
            exit;
        }
        $stmt = $pdo->prepare("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?");
        $stmt->execute([$id, $myId]);
        echo json_encode(['status' => 'success']);
        exit;
    }

    if ($action === 'mark_all_read') {
        $stmt = $pdo->prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0{$feedWhere}");
        $stmt->execute([$myId]);
        echo json_encode(['status' => 'success']);
        exit;
    }

    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Unknown action.']);
    exit;
}

http_response_code(405);
echo json_encode(['status' => 'error', 'message' => 'Invalid request method.']);
?>
