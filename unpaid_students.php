<?php
// unpaid_students.php
// Manages the "who didn't pay" roster attached to archived academic
// years. Entries are normally created in bulk by archive.php when a
// year is closed, but this endpoint also lets an admin add someone
// who was missed, search across every year by name, or remove a
// wrongly-flagged entry.
session_start();
require_once __DIR__ . '/request_guard.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/student_payment_helpers.php';
header('Content-Type: application/json');

$role = $_SESSION['role'] ?? 'auditor';
$method = $_SERVER['REQUEST_METHOD'];

// ---------------- GET: roster for a year, or search by student name (admin only) ----------------
if ($method === 'GET') {
    if ($role !== 'admin') {
        echo json_encode(['status' => 'error', 'message' => 'Unauthorized.']);
        exit;
    }
    $academicYear = $_GET['academic_year'] ?? null;
    $itemKey = $_GET['item_key'] ?? null;
    $search = trim($_GET['student_name'] ?? '');

    // Joined back to collections to pick up the human-readable section label
    // that was frozen there at archive time, since unpaid_students only
    // stores the raw item_key.
    $sql = "SELECT u.*, c.label AS section_label FROM unpaid_students u
            LEFT JOIN collections c ON c.item_key = u.item_key AND c.academic_year = u.academic_year AND c.is_archived = 1
            WHERE 1=1";
    $params = [];
    if ($academicYear) { $sql .= " AND u.academic_year = :ay"; $params[':ay'] = $academicYear; }
    if ($itemKey) { $sql .= " AND u.item_key = :ik"; $params[':ik'] = $itemKey; }
    if ($search !== '') { $sql .= " AND u.student_name LIKE :sn"; $params[':sn'] = '%' . $search . '%'; }
    $sql .= " ORDER BY u.is_settled ASC, u.created_at ASC";

    try {
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $students=$stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach($students as &$student){$summary=sp_late_summary($pdo,$student);if($summary!==null)$student=array_merge($student,$summary);}unset($student);
        echo json_encode(['status' => 'success', 'students' => $students]);
    } catch (PDOException $e) {
        echo json_encode(['status' => 'error', 'message' => 'Could not load the unpaid-student roster.']);
    }
    exit;
}

// ---------------- POST: add a student to the roster of an already-archived year (admin only) ----------------
if ($method === 'POST') {
    if ($role !== 'admin') {
        echo json_encode(['status' => 'error', 'message' => 'Unauthorized. Only admins can flag unpaid students.']);
        exit;
    }
    $input = json_decode(file_get_contents('php://input'), true);
    $academicYear = trim($input['academic_year'] ?? '');
    $itemKey = trim($input['item_key'] ?? '');
    $studentName = trim($input['student_name'] ?? '');
    $categoryKey = trim($input['category_key'] ?? '');
    $categoryName = trim($input['category_name'] ?? '');
    $note = trim($input['remarks'] ?? '');

    if ($academicYear === '' || $itemKey === '' || $studentName === '') {
        echo json_encode(['status' => 'error', 'message' => 'Academic year, section, and student name are required.']);
        exit;
    }

    try {
        $pdo->beginTransaction();
        $checkStmt = $pdo->prepare("SELECT 1 FROM collections WHERE item_key = :ik AND academic_year = :ay AND is_archived = 1");
        $checkStmt->execute([':ik' => $itemKey, ':ay' => $academicYear]);
        if (!$checkStmt->fetchColumn()) {
            throw new Exception("That section isn't part of the archived records for that academic year.");
        }

        $stmt = $pdo->prepare(
            "INSERT INTO unpaid_students (academic_year, item_key, student_name, category_key, category_name, remarks, recorded_by)
             VALUES (:ay, :ik, :sn, :ck, :cn, :rem, :by)"
        );
        $stmt->execute([
            ':ay' => $academicYear,
            ':ik' => $itemKey,
            ':sn' => $studentName,
            ':ck' => $categoryKey !== '' ? $categoryKey : null,
            ':cn' => $categoryName !== '' ? $categoryName : null,
            ':rem' => $note !== '' ? $note : null,
            ':by' => $_SESSION['username'] ?? 'admin'
        ]);

        $entryId = $pdo->lastInsertId();
        $auditDetails = "Flagged " . $studentName . " as unpaid for '" . $itemKey . "', AY " . $academicYear . ".";
        $auditStmt = $pdo->prepare("INSERT INTO user_logs (user_id, username, role, action, details) VALUES (?, ?, ?, 'Unpaid Student Flagged', ?)");
        $auditStmt->execute([$_SESSION['user_id'] ?? null, $_SESSION['username'] ?? 'admin', $_SESSION['role'] ?? 'admin', $auditDetails]);

        $pdo->commit();
        echo json_encode(['status' => 'success', 'id' => $entryId]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
    }
    exit;
}

// ---------------- DELETE: remove a wrongly-flagged entry (admin only) ----------------
if ($method === 'DELETE') {
    if ($role !== 'admin') {
        echo json_encode(['status' => 'error', 'message' => 'Unauthorized.']);
        exit;
    }
    $input = json_decode(file_get_contents('php://input'), true);
    $id = intval($input['id'] ?? 0);
    if (!$id) {
        echo json_encode(['status' => 'error', 'message' => 'Missing entry id.']);
        exit;
    }

    try {
        $pdo->beginTransaction();
        $stmt = $pdo->prepare("SELECT * FROM unpaid_students WHERE id = ? FOR UPDATE");
        $stmt->execute([$id]);
        $entry = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$entry) {
            throw new Exception("Entry not found.");
        }

        $pdo->prepare("DELETE FROM unpaid_students WHERE id = ?")->execute([$id]);

        $auditDetails = "Removed unpaid flag for " . $entry['student_name'] . " ('" . $entry['item_key'] . "', AY " . $entry['academic_year'] . ").";
        $auditStmt = $pdo->prepare("INSERT INTO user_logs (user_id, username, role, action, details) VALUES (?, ?, ?, 'Unpaid Student Flag Removed', ?)");
        $auditStmt->execute([$_SESSION['user_id'] ?? null, $_SESSION['username'] ?? 'admin', $_SESSION['role'] ?? 'admin', $auditDetails]);

        $pdo->commit();
        echo json_encode(['status' => 'success']);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
    }
    exit;
}

echo json_encode(['status' => 'error', 'message' => 'Invalid request method.']);
?>