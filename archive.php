<?php
// archive.php
session_start();
require_once __DIR__ . '/request_guard.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/recovery_store.php';
require_once __DIR__ . '/unpaid_roster_bridge.php';
header('Content-Type: application/json; charset=utf-8');
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'POST required.']);
    exit;
}

// 1. Strict Security Check: Ensure only the Admin can do this
if (!isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
    http_response_code(403);
    echo json_encode(["status" => "error", "message" => "Unauthorized action."]);
    exit();
} // <-- FIXED: Added missing closing brace

try {
    // Get the academic year passed from the frontend (e.g., "2026-2027")
    $data = json_decode(file_get_contents("php://input"));
    $academic_year = $data->academic_year ?? null;

    if (!is_string($academic_year) || !preg_match('/^(\d{4})-(\d{4})$/', $academic_year, $matches) || (int)$matches[2] !== (int)$matches[1] + 1) {
        throw new Exception('Use a valid academic year such as 2026-2027.');
    }
    // Duplicate year closing would mix a new cycle into an earlier archive.
    $exists = $pdo->prepare("SELECT 1 FROM collections WHERE academic_year = ? AND is_archived = 1 LIMIT 1");
    $exists->execute([$academic_year]);
    $alreadyArchived = (bool)$exists->fetchColumn();
    if (!$alreadyArchived) {
        $exists = $pdo->prepare("SELECT 1 FROM expenditures WHERE academic_year = ? AND is_archived = 1 LIMIT 1");
        $exists->execute([$academic_year]);
        $alreadyArchived = (bool)$exists->fetchColumn();
    }
    if (!$alreadyArchived) {
        $exists = $pdo->prepare("SELECT 1 FROM budgets WHERE academic_year = ? AND is_archived = 1 LIMIT 1");
        $exists->execute([$academic_year]);
        $alreadyArchived = (bool)$exists->fetchColumn();
    }
    if ($alreadyArchived) {
        throw new Exception('That academic year has already been archived. Check the year before continuing.');
    }
    // Older databases may contain repeated archive cycles for the same year,
    // including cycles whose rows were subsequently deleted. Logs give us
    // another guard without changing or deleting historic records.
    $previousReset = $pdo->prepare("SELECT 1 FROM user_logs WHERE action = 'System Reboot' AND details LIKE ? LIMIT 1");
    $previousReset->execute(['%Academic Year: ' . $academic_year . '%']);
    if ($previousReset->fetchColumn()) {
        throw new Exception('The audit trail shows this year was already archived. No records were modified.');
    }

    $hasActive = $pdo->query("SELECT
        (SELECT COUNT(*) FROM collections WHERE is_archived = 0) +
        (SELECT COUNT(*) FROM expenditures WHERE is_archived = 0) +
        (SELECT COUNT(*) FROM budgets WHERE is_archived = 0)")->fetchColumn();
    if ((int)$hasActive === 0) {
        throw new Exception('No active financial records were found. Archiving an empty year would clear the layout without creating a usable archive.');
    }

    // Optional list of students the admin flagged as unpaid before locking
    // this year, so the archive keeps a quick-reference roster instead of
    // just aggregate "X unpaid" counts.
    $unpaidStudentsInput = is_array($data->unpaid_students ?? null) ? $data->unpaid_students : [];

    $admin_username = $_SESSION['username'] ?? 'admin';

    sp_ensure_archive_columns($pdo);

    // 2. Begin Transaction
    $pdo->beginTransaction();

    // Recheck the reviewed list while holding the same settings locks used by list saves.
    $preview = aru_roster_preview($pdo, true);
    if (!is_string($data->unpaid_roster_revision ?? null) ||
        !hash_equals($preview['revision'], $data->unpaid_roster_revision)) {
        throw new DomainException('Saved unpaid lists or collection settings changed. Reopen Archive School Year to review the latest names. Nothing was archived.');
    }
    $unpaidStudentsInput = aru_validate_flags($unpaidStudentsInput, $preview);

    // Preserve the closing layout, categories, Admin breakdown and available history.
    // This shares the archive transaction: a failed snapshot leaves the active year intact.
    ry_capture_current($pdo, $academic_year, $unpaidStudentsInput);

    // 3. Archive Active Records
    $archiveQuery = "UPDATE %s SET is_archived = 1, academic_year = :academic_year WHERE is_archived = 0";
    
    $stmt = $pdo->prepare(sprintf($archiveQuery, 'collections'));
    $stmt->execute([':academic_year' => $academic_year]);

    // 3a. Freeze this section's headcount and the category price list as they
    // stood right now, onto the rows we just archived. Without this, a late
    // payment recorded next year would have no reliable way to know how many
    // students there were or what each item cost back when this year closed.
    $catSettingsStmt = $pdo->prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'collection_categories'");
    $catSettingsStmt->execute();
    $categorySnapshotJson = $catSettingsStmt->fetchColumn();
    if ($categorySnapshotJson === false || $categorySnapshotJson === null) {
        $categorySnapshotJson = '[]';
    }
    $snapshotStmt = $pdo->prepare(
        "UPDATE collections c
         LEFT JOIN section_settings s ON s.section_key = c.item_key
         SET c.num_students = COALESCE(s.num_students, 0), c.category_snapshot = :cat_snapshot
         WHERE c.academic_year = :academic_year AND c.is_archived = 1"
    );
    $snapshotStmt->execute([':cat_snapshot' => $categorySnapshotJson, ':academic_year' => $academic_year]);

    $stmt = $pdo->prepare(sprintf($archiveQuery, 'expenditures'));
    $stmt->execute([':academic_year' => $academic_year]);

    $stmt = $pdo->prepare(sprintf($archiveQuery, 'budgets'));
    $stmt->execute([':academic_year' => $academic_year]);

    // 3b. Save the unpaid-student roster flagged for this year.
    $unpaidInsertStmt = $pdo->prepare(
        "INSERT INTO unpaid_students (academic_year, item_key, student_name, category_key, category_name, remarks, recorded_by, fee_amount, amount_paid, balance_due)
         VALUES (:ay, :ik, :sn, :ck, :cn, :rem, :by, :fee, :paid, :due)"
    );
    $unpaidCount = 0;
    foreach ($unpaidStudentsInput as $u) {
        $itemKey = trim($u->item_key ?? '');
        $studentName = trim($u->student_name ?? '');
        if ($itemKey === '' || $studentName === '') continue; // skip incomplete rows rather than failing the whole archive
        $categoryKey = trim($u->category_key ?? '');
        $categoryName = trim($u->category_name ?? '');
        $remarksNote = trim($u->remarks ?? '');
        $unpaidInsertStmt->execute([
            ':ay' => $academic_year,
            ':ik' => $itemKey,
            ':sn' => $studentName,
            ':ck' => $categoryKey !== '' ? $categoryKey : null,
            ':cn' => $categoryName !== '' ? $categoryName : null,
            ':rem' => $remarksNote !== '' ? $remarksNote : null,
            ':by' => $admin_username, ':fee'=>$u->fee_amount, ':paid'=>$u->amount_paid, ':due'=>$u->balance_due
        ]);
        $unpaidCount++;
    }

    // 4. Reset the UI Layout Template
    $emptyLayout = json_encode(["collections" => [], "expenditures" => []]);
    $resetUIQuery = "UPDATE system_settings SET setting_value = :layout WHERE setting_key = 'ui_layout'";
    $stmt = $pdo->prepare($resetUIQuery);
    $stmt->execute([':layout' => $emptyLayout]);

    // 5. Log the Action
    $logDetails = "System rebooted and data archived for Academic Year: " . $academic_year;
    if ($unpaidCount > 0) {
        $logDetails .= " ($unpaidCount unpaid student(s) flagged for follow-up.)";
    }
    $logQuery = "INSERT INTO user_logs (user_id, username, role, action, details) VALUES (:uid, :user, 'admin', 'System Reboot', :details)";
    $stmt = $pdo->prepare($logQuery);
    $stmt->execute([
        ':uid' => $_SESSION['user_id'] ?? null,
        ':user' => $admin_username,
        ':details' => $logDetails
    ]);

    // 6. Commit the Transaction
    $pdo->commit();

    $successMsg = "System successfully rebooted for $academic_year. Data archived.";
    if ($unpaidCount > 0) {
        $successMsg .= " $unpaidCount unpaid student(s) saved to the follow-up roster.";
    }
    echo json_encode(["status" => "success", "message" => $successMsg]);

} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code($e instanceof DomainException ? 409 : ($e instanceof InvalidArgumentException ? 400 : 500));
    error_log('Archive failure: ' . $e->getMessage());
    echo json_encode(["status" => "error", "message" => "Archive failed: " . $e->getMessage()]);
}
?>