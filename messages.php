<?php
// messages.php
// Conversations + messages API for the internal Messenger-style chat.
// Every authenticated user (any role) can message any other user —
// this is an internal team communication tool, not a financial
// record, so it doesn't follow the admin/treasurer/auditor
// permission split used elsewhere.
session_start();
require_once __DIR__ . '/request_guard.php';
require_once __DIR__ . '/db.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['status' => 'error', 'message' => 'Not authenticated.']);
    exit;
}

$myId = (int)$_SESSION['user_id'];
$myUsername = $_SESSION['username'];
$method = $_SERVER['REQUEST_METHOD'];

function displayName($row, $prefix = '') {
    $full = $row[$prefix . 'full_name'] ?? null;
    $user = $row[$prefix . 'username'] ?? null;
    if ($full && $full !== 'Unassigned') return $full;
    return $user ?: 'Unknown User';
}

// Confirms $myId is a participant of $conversationId. Returns the
// participant row (so callers can read last_read_message_id) or
// false if they're not a member of that conversation.
function requireParticipant($pdo, $conversationId, $myId) {
    $stmt = $pdo->prepare("SELECT * FROM conversation_participants WHERE conversation_id = ? AND user_id = ?");
    $stmt->execute([$conversationId, $myId]);
    return $stmt->fetch(PDO::FETCH_ASSOC);
}

// ---------------- GET ----------------
if ($method === 'GET') {
    $action = $_GET['action'] ?? 'conversations';

    // List every other user, for the "New Conversation" picker.
    if ($action === 'users') {
        $stmt = $pdo->prepare("SELECT id, username, full_name, role FROM users WHERE id != ? ORDER BY full_name, username");
        $stmt->execute([$myId]);
        echo json_encode(['status' => 'success', 'users' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
        exit;
    }

    // Full conversation list for the sidebar: other participant(s),
    // last message preview, and an unread count each.
    if ($action === 'conversations') {
        $convStmt = $pdo->prepare(
            "SELECT c.*, cp.last_read_message_id
             FROM conversations c
             JOIN conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id = :me
             ORDER BY c.updated_at DESC"
        );
        $convStmt->execute([':me' => $myId]);
        $conversations = $convStmt->fetchAll(PDO::FETCH_ASSOC);

        $participantsStmt = $pdo->prepare(
            "SELECT u.id, u.username, u.full_name, u.role
             FROM conversation_participants cp
             JOIN users u ON u.id = cp.user_id
             WHERE cp.conversation_id = ?"
        );
        $lastMsgStmt = $pdo->prepare(
            "SELECT id, sender_id, sender_username, body, created_at FROM messages
             WHERE conversation_id = ? ORDER BY id DESC LIMIT 1"
        );
        $unreadStmt = $pdo->prepare(
            "SELECT COUNT(*) FROM messages WHERE conversation_id = ? AND id > ? AND sender_id != ?"
        );

        $out = [];
        foreach ($conversations as $c) {
            $participantsStmt->execute([$c['id']]);
            $participants = $participantsStmt->fetchAll(PDO::FETCH_ASSOC);
            $others = array_values(array_filter($participants, fn($p) => (int)$p['id'] !== (int)$myId));

            $lastMsgStmt->execute([$c['id']]);
            $lastMsg = $lastMsgStmt->fetch(PDO::FETCH_ASSOC);

            $lastReadId = $c['last_read_message_id'] ?? 0;
            $unreadStmt->execute([$c['id'], $lastReadId, $myId]);
            $unreadCount = (int)$unreadStmt->fetchColumn();

            $label = $c['title'];
            if (!$label) {
                if ($c['is_group']) {
                    $names = array_map(fn($p) => displayName($p), $others);
                    $label = count($names) > 0 ? implode(', ', $names) : 'Empty Group';
                } else {
                    $label = count($others) > 0 ? displayName($others[0]) : 'Unknown';
                }
            }

            $out[] = [
                'id' => (int)$c['id'],
                'is_group' => (bool)$c['is_group'],
                'title' => $label,
                'participants' => $others,
                'last_message' => $lastMsg ? [
                    'body' => $lastMsg['body'],
                    'sender_id' => $lastMsg['sender_id'] ? (int)$lastMsg['sender_id'] : null,
                    'sender_username' => $lastMsg['sender_username'],
                    'is_mine' => (int)$lastMsg['sender_id'] === (int)$myId,
                    'created_at' => $lastMsg['created_at'],
                ] : null,
                'unread_count' => $unreadCount,
                'updated_at' => $c['updated_at'],
            ];
        }

        echo json_encode(['status' => 'success', 'conversations' => $out]);
        exit;
    }

    // Message thread for one conversation. Optional after_id for
    // incremental polling (only returns messages newer than that id).
    if ($action === 'thread') {
        $conversationId = intval($_GET['conversation_id'] ?? 0);
        $afterId = intval($_GET['after_id'] ?? 0);
        if (!$conversationId || !requireParticipant($pdo, $conversationId, $myId)) {
            http_response_code(403);
            echo json_encode(['status' => 'error', 'message' => 'You are not part of that conversation.']);
            exit;
        }
        $stmt = $pdo->prepare("SELECT * FROM messages WHERE conversation_id = ? AND id > ? ORDER BY id ASC");
        $stmt->execute([$conversationId, $afterId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $messages = array_map(function ($m) use ($myId) {
            return [
                'id' => (int)$m['id'],
                'sender_id' => $m['sender_id'] ? (int)$m['sender_id'] : null,
                'sender_username' => $m['sender_username'],
                'is_mine' => (int)$m['sender_id'] === (int)$myId,
                'body' => $m['body'],
                'created_at' => $m['created_at'],
            ];
        }, $rows);
        echo json_encode(['status' => 'success', 'messages' => $messages]);
        exit;
    }

    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Unknown action.']);
    exit;
}

// ---------------- POST ----------------
if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $action = $input['action'] ?? 'send';

    // Send a message. Either into an existing conversation_id, or
    // start a new one (recipient_ids: array of user ids to chat with;
    // a single id makes a 1:1 — reusing an existing thread if there
    // already is one — two or more makes a new group).
    if ($action === 'send') {
        $body = trim($input['body'] ?? '');
        if ($body === '') {
            echo json_encode(['status' => 'error', 'message' => 'Message cannot be empty.']);
            exit;
        }

        $conversationId = intval($input['conversation_id'] ?? 0);

        try {
            $pdo->beginTransaction();

            if ($conversationId) {
                if (!requireParticipant($pdo, $conversationId, $myId)) {
                    throw new Exception('You are not part of that conversation.');
                }
            } else {
                $recipientIds = array_values(array_unique(array_map('intval', $input['recipient_ids'] ?? [])));
                $recipientIds = array_values(array_filter($recipientIds, fn($id) => $id > 0 && $id !== $myId));
                if (count($recipientIds) === 0) {
                    throw new Exception('Pick at least one person to message.');
                }

                if (count($recipientIds) === 1) {
                    // Reuse an existing 1:1 conversation if one already exists.
                    $other = $recipientIds[0];
                    $findStmt = $pdo->prepare(
                        "SELECT c.id FROM conversations c
                         JOIN conversation_participants cp1 ON cp1.conversation_id = c.id AND cp1.user_id = :me
                         JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id = :other
                         WHERE c.is_group = 0
                         LIMIT 1"
                    );
                    $findStmt->execute([':me' => $myId, ':other' => $other]);
                    $existing = $findStmt->fetchColumn();
                    if ($existing) {
                        $conversationId = (int)$existing;
                    }
                }

                if (!$conversationId) {
                    $isGroup = count($recipientIds) > 1 ? 1 : 0;
                    $title = $isGroup ? trim($input['title'] ?? '') : null;
                    $createStmt = $pdo->prepare("INSERT INTO conversations (is_group, title, created_by) VALUES (?, ?, ?)");
                    $createStmt->execute([$isGroup, $title !== '' ? $title : null, $myId]);
                    $conversationId = (int)$pdo->lastInsertId();

                    $addParticipant = $pdo->prepare("INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)");
                    $addParticipant->execute([$conversationId, $myId]);
                    foreach ($recipientIds as $rid) {
                        $addParticipant->execute([$conversationId, $rid]);
                    }
                }
            }

            $insertMsg = $pdo->prepare("INSERT INTO messages (conversation_id, sender_id, sender_username, body) VALUES (?, ?, ?, ?)");
            $insertMsg->execute([$conversationId, $myId, $myUsername, $body]);
            $messageId = (int)$pdo->lastInsertId();

            $pdo->prepare("UPDATE conversations SET updated_at = current_timestamp() WHERE id = ?")->execute([$conversationId]);

            // Mark it read for the sender immediately (they obviously just "read" their own message).
            $pdo->prepare("UPDATE conversation_participants SET last_read_message_id = ? WHERE conversation_id = ? AND user_id = ?")
                ->execute([$messageId, $conversationId, $myId]);

            // Notify every other participant.
            $otherParticipants = $pdo->prepare("SELECT user_id FROM conversation_participants WHERE conversation_id = ? AND user_id != ?");
            $otherParticipants->execute([$conversationId, $myId]);
            $preview = function_exists('mb_substr') ? (mb_strlen($body) > 80 ? mb_substr($body, 0, 80) . '…' : $body) : (strlen($body) > 80 ? substr($body, 0, 80) . '…' : $body);
            $notifyStmt = $pdo->prepare(
                "INSERT INTO notifications (user_id, type, title, body, conversation_id) VALUES (?, 'message', ?, ?, ?)"
            );
            foreach ($otherParticipants->fetchAll(PDO::FETCH_COLUMN) as $recipientId) {
                $notifyStmt->execute([$recipientId, "New message from " . ($_SESSION['username'] ?? 'someone'), $preview, $conversationId]);
            }

            $pdo->commit();
            echo json_encode([
                'status' => 'success',
                'conversation_id' => $conversationId,
                'message' => [
                    'id' => $messageId,
                    'sender_id' => $myId,
                    'sender_username' => $myUsername,
                    'is_mine' => true,
                    'body' => $body,
                    'created_at' => date('Y-m-d H:i:s'),
                ]
            ]);
        } catch (Exception $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
        }
        exit;
    }

    // Mark a conversation as read up to its latest message.
    if ($action === 'mark_read') {
        $conversationId = intval($input['conversation_id'] ?? 0);
        if (!$conversationId || !requireParticipant($pdo, $conversationId, $myId)) {
            http_response_code(403);
            echo json_encode(['status' => 'error', 'message' => 'You are not part of that conversation.']);
            exit;
        }
        $latestStmt = $pdo->prepare("SELECT MAX(id) FROM messages WHERE conversation_id = ?");
        $latestStmt->execute([$conversationId]);
        $latestId = $latestStmt->fetchColumn();
        if ($latestId) {
            $pdo->prepare("UPDATE conversation_participants SET last_read_message_id = ? WHERE conversation_id = ? AND user_id = ?")
                ->execute([$latestId, $conversationId, $myId]);
        }
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
