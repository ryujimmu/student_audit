<?php
// late_payment.php
// Lets an admin settle a specific student's outstanding due against an
// already-archived academic year, so that student can be cleared to
// enroll. Every payment is logged in `late_payments` (searchable by
// student name) and, where possible, folded back into the archived
// section's totals and remarks.
session_start();
require_once __DIR__ . '/request_guard.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/student_payment_helpers.php';
header('Content-Type: application/json');

$role = $_SESSION['role'] ?? 'auditor';
$method = $_SERVER['REQUEST_METHOD'];

// Recompute a section's auto-generated "X unpaid CATEGORY" remarks the
// same way the live dashboard does, using the headcount and category
// prices that were snapshotted at archive time. Returns null when we
// don't have enough historical data to recompute (e.g. rows archived
// before this feature existed) — callers should leave remarks as-is then.
function recomputeArchivedRemarks($categoryData, $categorySnapshotJson, $numStudents) {
    if ($numStudents === null || $categorySnapshotJson === null || $categorySnapshotJson === '') {
        return null;
    }
    $categories = json_decode($categorySnapshotJson, true);
    if (!is_array($categories) || count($categories) === 0) {
        return null;
    }
    if (intval($numStudents) <= 0) {
        return null;
    }
    $autoRemarks = [];
    foreach ($categories as $cat) {
        $catId = $cat['id'] ?? null;
        $price = floatval($cat['price'] ?? 0);
        $name = $cat['name'] ?? $catId;
        if (!$catId || $price <= 0) continue;
        $cash = floatval($categoryData[$catId] ?? 0);
        $paidStudents = floor($cash / $price);
        $unpaid = intval($numStudents) - intval($paidStudents);
        if ($unpaid > 0) $autoRemarks[] = "$unpaid unpaid $name";
    }
    return count($autoRemarks) > 0 ? implode(', ', $autoRemarks) : 'Fully Paid';
}

// ---------------- GET: list history for a section, or search by student name (admin only) ----------------
if ($method === 'GET') {
    if ($role !== 'admin') {
        echo json_encode(['status' => 'error', 'message' => 'Unauthorized.']);
        exit;
    }
    $academicYear = $_GET['academic_year'] ?? null;
    $itemKey = $_GET['item_key'] ?? null;
    $search = trim($_GET['student_name'] ?? '');

    // Joined back to collections to pick up the human-readable section label
    // that was frozen there at archive time, since late_payments only
    // stores the raw item_key.
    $sql = "SELECT p.*, c.label AS section_label FROM late_payments p
            LEFT JOIN collections c ON c.item_key = p.item_key AND c.academic_year = p.academic_year AND c.is_archived = 1
            WHERE 1=1";
    $params = [];
    if ($academicYear) { $sql .= " AND p.academic_year = :ay"; $params[':ay'] = $academicYear; }
    if ($itemKey) { $sql .= " AND p.item_key = :ik"; $params[':ik'] = $itemKey; }
    if ($search !== '') { $sql .= " AND p.student_name LIKE :sn"; $params[':sn'] = '%' . $search . '%'; }
    $sql .= " ORDER BY p.created_at DESC";

    try {
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        echo json_encode(['status' => 'success', 'payments' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
    } catch (PDOException $e) {
        echo json_encode(['status' => 'error', 'message' => 'Could not load payment records.']);
    }
    exit;
}

// ---------------- POST: record a late payment (admin only) ----------------
if ($method === 'POST') {
    if ($role !== 'admin') {
        echo json_encode(['status' => 'error', 'message' => 'Unauthorized. Only admins can record late payments.']);
        exit;
    }
    $input = json_decode(file_get_contents('php://input'), true);
    $academicYear = trim($input['academic_year'] ?? '');
    $itemKey = trim($input['item_key'] ?? '');
    $studentName = trim($input['student_name'] ?? '');
    $categoryKey = trim($input['category_key'] ?? '');
    $categoryName = trim($input['category_name'] ?? '');
    $amount = floatval($input['amount'] ?? 0);
    $note = trim($input['remarks'] ?? '');
    $unpaidStudentId = intval($input['unpaid_student_id'] ?? 0);

    if ($academicYear === '' || $itemKey === '' || $studentName === '') {
        echo json_encode(['status' => 'error', 'message' => 'Academic year, section, and student name are required.']);
        exit;
    }
    if (!is_finite($amount) || $amount <= 0 || $amount > 9999999999999.99) {
        echo json_encode(['status' => 'error', 'message' => 'Enter a payment amount greater than zero.']);
        exit;
    }

    if ($categoryKey === '') {
        echo json_encode(['status' => 'error', 'message' => 'Select a collection category to ensure the payment is reflected in the financial totals.']);
        exit;
    }
    try {
        $pdo->beginTransaction();

        $rowStmt = $pdo->prepare("SELECT * FROM collections WHERE item_key = :ik AND academic_year = :ay AND is_archived = 1 FOR UPDATE");
        $rowStmt->execute([':ik' => $itemKey, ':ay' => $academicYear]);
        $row = $rowStmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            throw new Exception("Archived record not found for that section and academic year.");
        }

        if ($unpaidStudentId>0) {
            $flagQuery=$pdo->prepare('SELECT * FROM unpaid_students WHERE id=? FOR UPDATE');
            $flagQuery->execute([$unpaidStudentId]);$flag=$flagQuery->fetch(PDO::FETCH_ASSOC);
            if(!$flag || $flag['academic_year']!==$academicYear || $flag['item_key']!==$itemKey || $flag['student_name']!==$studentName || ($flag['category_key']??'')!==$categoryKey || (int)$flag['is_settled']===1) throw new Exception('Refresh the unpaid-student roster before recording this payment.');
            $summary=sp_late_summary($pdo,$flag);
            if($summary!==null && sp_cents(number_format($amount,2,'.',''))>sp_cents($summary['current_due']))throw new Exception('The payment exceeds this student’s remaining balance.');
        }

        $categoryData = json_decode($row['category_data'] ?? '{}', true);
        if (!is_array($categoryData)) $categoryData = [];
        $archivedCategories = json_decode($row['category_snapshot'] ?? '[]', true);
        $categoryIsKnown = array_key_exists($categoryKey, $categoryData);
        if (is_array($archivedCategories)) {
            foreach ($archivedCategories as $archiveCategory) {
                if (($archiveCategory['id'] ?? null) === $categoryKey) $categoryIsKnown = true;
            }
        }
        if (!$categoryIsKnown) throw new Exception('This category does not exist in the archived section.');
        if ($categoryKey !== '') {
            $categoryData[$categoryKey] = floatval($categoryData[$categoryKey] ?? 0) + $amount;
        }
        $newCategoryDataJson = json_encode($categoryData);

        $newRemarks = recomputeArchivedRemarks($categoryData, $row['category_snapshot'], $row['num_students']);
        if ($newRemarks === null) $newRemarks = $row['remarks'];

        $updateStmt = $pdo->prepare("UPDATE collections SET category_data = :cd, remarks = :rem WHERE item_key = :ik AND academic_year = :ay AND is_archived = 1");
        $updateStmt->execute([':cd' => $newCategoryDataJson, ':rem' => $newRemarks, ':ik' => $itemKey, ':ay' => $academicYear]);

        $logStmt = $pdo->prepare("INSERT INTO late_payments (academic_year, item_key, student_name, category_key, category_name, amount, remarks, processed_by) VALUES (:ay, :ik, :sn, :ck, :cn, :amt, :rem, :by)");
        $logStmt->execute([
            ':ay' => $academicYear,
            ':ik' => $itemKey,
            ':sn' => $studentName,
            ':ck' => $categoryKey !== '' ? $categoryKey : null,
            ':cn' => $categoryName !== '' ? $categoryName : null,
            ':amt' => $amount,
            ':rem' => $note !== '' ? $note : null,
            ':by' => $_SESSION['username'] ?? 'admin'
        ]);
        $newPaymentId = $pdo->lastInsertId();

        if ($unpaidStudentId>0 && !isset($flag['balance_due'])) {
            // Keep legacy name-only behavior where no opening balance is known.
            $pdo->prepare('UPDATE unpaid_students SET is_settled=1,settled_payment_id=?,settled_at=CURRENT_TIMESTAMP WHERE id=?')->execute([$newPaymentId,$unpaidStudentId]);
        }
        sp_refresh_late_flags($pdo,['academic_year'=>$academicYear,'item_key'=>$itemKey,'student_name'=>$studentName,'category_key'=>$categoryKey],$newPaymentId);

        $auditDetails = $studentName . " paid " . ($categoryName !== '' ? $categoryName : 'a fee') .
            " (₱" . number_format($amount, 2) . ") for '" . $itemKey . "', AY " . $academicYear . ".";
        $auditStmt = $pdo->prepare("INSERT INTO user_logs (user_id, username, role, action, details) VALUES (?, ?, ?, 'Late Payment', ?)");
        $auditStmt->execute([$_SESSION['user_id'] ?? null, $_SESSION['username'] ?? 'admin', $_SESSION['role'] ?? 'admin', $auditDetails]);

        $pdo->commit();
        echo json_encode([
            'status' => 'success',
            'message' => $studentName . " is cleared for " . ($categoryName !== '' ? $categoryName : 'this item') . ".",
            'remarks' => $newRemarks
        ]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
    }
    exit;
}

// ---------------- DELETE: undo a mistaken late payment entry (admin only) ----------------
if ($method === 'DELETE') {
    if ($role !== 'admin') {
        echo json_encode(['status' => 'error', 'message' => 'Unauthorized.']);
        exit;
    }
    $input = json_decode(file_get_contents('php://input'), true);
    $id = intval($input['id'] ?? 0);
    if (!$id) {
        echo json_encode(['status' => 'error', 'message' => 'Missing payment id.']);
        exit;
    }

    try {
        $pdo->beginTransaction();

        $payStmt = $pdo->prepare("SELECT * FROM late_payments WHERE id = ? FOR UPDATE");
        $payStmt->execute([$id]);
        $payment = $payStmt->fetch(PDO::FETCH_ASSOC);
        if (!$payment) {
            throw new Exception("Payment record not found.");
        }

        $rowStmt = $pdo->prepare("SELECT * FROM collections WHERE item_key = :ik AND academic_year = :ay AND is_archived = 1 FOR UPDATE");
        $rowStmt->execute([':ik' => $payment['item_key'], ':ay' => $payment['academic_year']]);
        $row = $rowStmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            throw new Exception('The matching archived collection is missing. Reversal was blocked to preserve the payment audit trail; investigate the archive first.');
        }

        if ($row && $payment['category_key']) {
            $categoryData = json_decode($row['category_data'] ?? '{}', true);
            if (!is_array($categoryData)) $categoryData = [];
            $previousAmount = (float)($categoryData[$payment['category_key']] ?? 0);
            if ($previousAmount + 0.005 < (float)$payment['amount']) {
                throw new Exception('Reversal exceeds the amount available in the archived category. Investigate previous adjustments first.');
            }
            $categoryData[$payment['category_key']] = max(0, $previousAmount - (float)$payment['amount']);

            $newRemarks = recomputeArchivedRemarks($categoryData, $row['category_snapshot'], $row['num_students']);
            if ($newRemarks === null) $newRemarks = $row['remarks'];

            $updateStmt = $pdo->prepare("UPDATE collections SET category_data = :cd, remarks = :rem WHERE item_key = :ik AND academic_year = :ay AND is_archived = 1");
            $updateStmt->execute([':cd' => json_encode($categoryData), ':rem' => $newRemarks, ':ik' => $payment['item_key'], ':ay' => $payment['academic_year']]);
        }

        // Undo also reopens any unpaid-roster entry this payment had closed out.
        $pdo->prepare("UPDATE unpaid_students SET is_settled = 0, settled_payment_id = NULL, settled_at = NULL WHERE settled_payment_id = ?")->execute([$id]);

        $pdo->prepare("DELETE FROM late_payments WHERE id = ?")->execute([$id]);
        sp_refresh_late_flags($pdo,$payment);

        $auditDetails = "Reversed late payment: " . $payment['student_name'] . " / " .
            ($payment['category_name'] ?: 'fee') . " (₱" . number_format($payment['amount'], 2) . ") for '" .
            $payment['item_key'] . "', AY " . $payment['academic_year'] . ".";
        $auditStmt = $pdo->prepare("INSERT INTO user_logs (user_id, username, role, action, details) VALUES (?, ?, ?, 'Late Payment Reversed', ?)");
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