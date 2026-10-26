<?php
session_start();
require_once __DIR__ . '/request_guard.php';
require_once __DIR__ . '/db.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['status' => 'error', 'message' => 'Not authenticated.']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$role = $_SESSION['role'] ?? 'auditor';

// The database schema has UNIQUE(item_key) (and PRIMARY KEY(item_key) for
// budgets). Upserting an old key must never overwrite financial archives.
function assertWritableFinancialKey(PDO $pdo, string $table, $key): void {
    if (!is_string($key) || trim($key) === '' || strlen($key) > 100) {
        throw new InvalidArgumentException('Invalid financial item key.');
    }
    if (!in_array($table, ['collections', 'expenditures', 'budgets'], true)) {
        throw new InvalidArgumentException('Invalid financial record type.');
    }
    $stmt = $pdo->prepare("SELECT is_archived FROM {$table} WHERE item_key = ? FOR UPDATE");
    $stmt->execute([$key]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($row && (int)$row['is_archived'] === 1) {
        throw new DomainException('An archived record already uses this key. Create a new item for the current academic year.');
    }
}

function validateItemDates(array $node): void {
    $start = $node['start_date'] ?? '';
    $end = $node['end_date'] ?? '';
    foreach ([$start, $end] as $date) {
        if (!is_string($date)) throw new InvalidArgumentException('Invalid item date.');
        if ($date === '') continue;
        $parsed = DateTimeImmutable::createFromFormat('!Y-m-d', $date);
        if (!$parsed || $parsed->format('Y-m-d') !== $date || $date < '1000-01-01') {
            throw new InvalidArgumentException('Use a valid item date in YYYY-MM-DD format.');
        }
    }
    if (($start === '') !== ($end === '') || ($start !== '' && $end < $start)) {
        throw new InvalidArgumentException('The end date must be on or after the start date.');
    }
}
function itemScheduleToken(array $node): string {
    if (($node['type'] ?? '') === 'toggle') return 'group:' . ($node['id'] ?? '');
    return 'item:' . (empty($node['parent']) ? '' : $node['parent'] . '-') .
        preg_replace('/[^a-z0-9]/', '-', strtolower($node['name'] ?? ''));
}

// Integer cents ensure that subcategory totals match the public main fee exactly.
function adminCategoryPriceCents($value): int {
    if ((!is_string($value) && !is_int($value) && !is_float($value)) ||
        !preg_match('/^\d{1,10}(?:\.\d{1,2})?$/D', (string)$value)) {
        throw new InvalidArgumentException('Prices must be non-negative with at most two decimal places.');
    }
    $parts = explode('.', (string)$value, 2);
    return ((int)$parts[0] * 100) + (int)str_pad($parts[1] ?? '', 2, '0');
}

function nonNegativeAmount($value): float {
    if (!is_numeric($value) || !is_finite((float)$value) || (float)$value < 0) {
        throw new InvalidArgumentException('Amounts must be valid non-negative numbers.');
    }
    return round((float)$value, 2);
}


// The overall fund is scoped to the active school-year cycle; archives never carry it into a new year.
function currentOverallBudget(PDO $pdo): float {
    $raw = $pdo->query("SELECT setting_value FROM system_settings WHERE setting_key='expenditure_overall_budget'")->fetchColumn();
    $saved = json_decode($raw ?: 'null', true);
    $cycle = (int)$pdo->query("SELECT COALESCE(MAX(id),0) FROM user_logs WHERE action='System Reboot'")->fetchColumn();
    return is_array($saved) && (int)($saved['cycle'] ?? -1) === $cycle
        ? (float)($saved['amount'] ?? 0) : 0.0;
}

// A certification belongs to one exact set of saved financial figures.
// Changing amounts, enrollment, fee categories, budgets or the academic-year
// cycle invalidates it rather than leaving an outdated "certified" stamp.
function financialSnapshotHash(PDO $pdo, string $type): string {
    if (!in_array($type, ['collections', 'expenditures'], true)) {
        throw new InvalidArgumentException('Invalid report type.');
    }
    $rows = $type === 'collections'
        ? $pdo->query('SELECT item_key, category_data, remarks, is_archived FROM collections WHERE is_archived = 0 ORDER BY item_key')->fetchAll(PDO::FETCH_ASSOC)
        : $pdo->query('SELECT item_key, amount, remarks, is_archived FROM expenditures WHERE is_archived = 0 ORDER BY item_key')->fetchAll(PDO::FETCH_ASSOC);
    $settings = $type === 'collections'
        ? $pdo->query('SELECT section_key, num_students FROM section_settings ORDER BY section_key')->fetchAll(PDO::FETCH_ASSOC)
        : $pdo->query('SELECT item_key, allocated_amount FROM budgets WHERE is_archived = 0 ORDER BY item_key')->fetchAll(PDO::FETCH_ASSOC);
    $categories = null;
    if ($type === 'collections') {
        $stmt = $pdo->query("SELECT setting_value FROM system_settings WHERE setting_key = 'collection_categories'");
        $categories = $stmt->fetchColumn();
    }
    $archiveCycle = $pdo->query("SELECT COALESCE(MAX(id), 0) FROM user_logs WHERE action = 'System Reboot'")->fetchColumn();
    $snapshot = [$rows, $settings, $categories, $archiveCycle];
    if ($type === 'expenditures') $snapshot[] = currentOverallBudget($pdo);
    return hash('sha256', json_encode($snapshot, JSON_THROW_ON_ERROR));
}

function verifiedSignOff(PDO $pdo, string $type): ?array {
    $stmt = $pdo->prepare('SELECT setting_value FROM system_settings WHERE setting_key = ?');
    $stmt->execute(['audit_signoff_' . $type]);
    $signOff = json_decode($stmt->fetchColumn() ?: 'null', true);
    if (!is_array($signOff) || !isset($signOff['fingerprint']) || !is_string($signOff['fingerprint']) ||
        !hash_equals($signOff['fingerprint'], financialSnapshotHash($pdo, $type))) return null;
    return ['auditor' => (string)($signOff['auditor'] ?? 'Auditor'),
            'timestamp' => (string)($signOff['timestamp'] ?? '')];
}

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);

    if (!is_array($input)) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Invalid JSON payload.']);
        exit;
    }

    if (($input['action'] ?? '') === 'save_item_dates') {
        if ($role !== 'admin') {
            http_response_code(403);
            echo json_encode(['status'=>'error','message'=>'Only Admin may edit item dates.']);
            exit;
        }
        try {
            validateItemDates($input);
            if (!is_string($input['token'] ?? null)) throw new InvalidArgumentException('Invalid item.');
            $pdo->beginTransaction();
            $query = $pdo->prepare("SELECT setting_value FROM system_settings WHERE setting_key='ui_layout' FOR UPDATE");
            $query->execute();
            $layout = json_decode($query->fetchColumn() ?: '{}', true) ?: [];
            $found = false;
            foreach ($layout['expenditures'] ?? [] as $i => $node) {
                if (itemScheduleToken($node) !== $input['token']) continue;
                $layout['expenditures'][$i]['start_date'] = $input['start_date'] ?? '';
                $layout['expenditures'][$i]['end_date'] = $input['end_date'] ?? '';
                $found = true;
                break;
            }
            if (!$found) throw new DomainException('This item changed. Reload the page and try again.');
            $pdo->prepare("UPDATE system_settings SET setting_value=? WHERE setting_key='ui_layout'")
                ->execute([json_encode($layout, JSON_THROW_ON_ERROR)]);
            $pdo->prepare("INSERT INTO user_logs(user_id,username,role,action,details) VALUES(?,?,?,'Item Dates Updated',?)")
                ->execute([$_SESSION['user_id'],$_SESSION['username'] ?? 'Admin',$role,
                    $input['token'] . ': ' . ($input['start_date'] ?? '') . ' to ' . ($input['end_date'] ?? '')]);
            $pdo->commit();
            echo json_encode(['status'=>'success']);
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            $known = $e instanceof InvalidArgumentException || $e instanceof DomainException;
            http_response_code($e instanceof DomainException ? 409 : ($known ? 400 : 500));
            echo json_encode(['status'=>'error','message'=>$known ? $e->getMessage() : 'Unable to save item dates.']);
        }
        exit;
    }

    // Explicit clearing is separate from autosave, which preserves ledger totals.
    if (($input['action'] ?? '') === 'clear_financial_table') {
        $type = $input['type'] ?? '';
        if (!in_array($type, ['in','out'], true)) {
            http_response_code(400);
            echo json_encode(['status'=>'error','message'=>'Invalid financial table.']);
            exit;
        }
        $requiredRole = $type === 'out' ? 'admin' : 'treasurer';
        if ($role !== $requiredRole) {
            http_response_code(403);
            echo json_encode(['status'=>'error','message'=>$type === 'out'
                ? 'Only the Admin may clear expenditures.'
                : 'Only the Treasurer may clear collections.']);
            exit;
        }
        if (empty($_SESSION['section_remittance_csrf']) || !is_string($input['csrf'] ?? null) ||
            !hash_equals($_SESSION['section_remittance_csrf'], $input['csrf'])) {
            http_response_code(403);
            echo json_encode(['status'=>'error','message'=>'Refresh the page before clearing.']);
            exit;
        }
        try {
            $pdo->beginTransaction();
            if ($type === 'in') {
                $keys = $pdo->query('SELECT item_key FROM collections WHERE is_archived=0 ORDER BY item_key FOR UPDATE')->fetchAll(PDO::FETCH_COLUMN);
                $cycle = (int)$pdo->query("SELECT COALESCE(MAX(id),0) FROM user_logs WHERE action='System Reboot'")->fetchColumn();
                $max = $pdo->prepare('SELECT COALESCE(MAX(id),0) FROM section_remittances WHERE item_key=? AND cycle_id=?');
                $marker = $pdo->prepare('INSERT INTO system_settings (setting_key,setting_value) VALUES (?,?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)');
                foreach ($keys as $key) {
                    $max->execute([$key,$cycle]);
                    $marker->execute(['sr_clear_'.substr(hash('sha256',$key),0,32).'_'.$cycle,(string)$max->fetchColumn()]);
                }
                $pdo->exec("UPDATE collections SET category_data='{}', remarks='' WHERE is_archived=0");
            } else {
                $pdo->query('SELECT item_key FROM expenditures WHERE is_archived=0 ORDER BY item_key FOR UPDATE')->fetchAll();
                $pdo->exec("UPDATE expenditures SET amount=0, remarks='' WHERE is_archived=0");
            }
            $log=$pdo->prepare("INSERT INTO user_logs (user_id,username,role,action,details) VALUES (?,?,?,'Financial Inputs Cleared',?)");
            $log->execute([$_SESSION['user_id'],$_SESSION['username']??'Treasurer',$role,
                $type==='in'?'Cleared active collection totals; earlier section remittances retained as cleared history.':'Cleared active expenditure inputs; allocated budgets retained.']);
            $pdo->commit();
            echo json_encode(['status'=>'success']);
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            error_log('Clear financial table failed: '.$e->getMessage());
            http_response_code(500);
            echo json_encode(['status'=>'error','message'=>'The table could not be cleared. Refresh to check saved values before trying again.']);
        }
        exit;
    }

    // Certification was removed from the Auditor workflow; reject cached clients too.
    if (($input['action'] ?? null) === 'certify_report') {
        http_response_code(410);
        echo json_encode(['status'=>'error', 'message'=>'Report certification has been removed.']);
        exit;
    }

    // Event/item and program structures are managed exclusively by Admin.
    if (($input['action'] ?? null) === 'save_structure') {
        if ($role !== 'admin') {
            http_response_code(403);
            echo json_encode(['status'=>'error','message'=>'Only Admin can add, remove or rename events and items.']);
            exit;
        }
        if (!isset($input['data']['collections'], $input['data']['expenditures']) ||
            !is_array($input['data']['collections']) || !is_array($input['data']['expenditures'])) {
            http_response_code(400);
            echo json_encode(['status'=>'error','message'=>'Invalid layout data.']);
            exit;
        }
        try {
            $pdo->beginTransaction();
            $query=$pdo->prepare("SELECT setting_value FROM system_settings WHERE setting_key='ui_layout' FOR UPDATE");
            $query->execute();
            $previous=json_decode($query->fetchColumn()?:'{}',true)?:[];
            // Older cached clients must not erase schedules when saving the layout.
            $previousDates = [];
            foreach ($previous['expenditures'] ?? [] as $node) $previousDates[itemScheduleToken($node)] = $node;
            foreach ($input['data']['expenditures'] as &$node) {
                if (!is_array($node)) throw new InvalidArgumentException('Invalid item layout.');
                $old = $previousDates[itemScheduleToken($node)] ?? [];
                if (!array_key_exists('start_date', $node)) $node['start_date'] = $old['start_date'] ?? '';
                if (!array_key_exists('end_date', $node)) $node['end_date'] = $old['end_date'] ?? '';
                validateItemDates($node);
            }
            unset($node);
            $expenseKeys=function(array $nodes): array {
                $keys=[];
                foreach($nodes as $node){
                    if(!is_array($node)) throw new InvalidArgumentException('Invalid event/item layout.');
                    if(($node['type']??'')!=='out') continue;
                    if(!is_string($node['name']??null) || trim($node['name'])==='' || strlen($node['name'])>200) throw new InvalidArgumentException('Use a valid item description of at most 200 bytes.');
                    $safe=preg_replace('/[^a-z0-9]/','-',strtolower($node['name']));
                    $key=empty($node['parent'])?$safe:$node['parent'].'-'.$safe;
                    if(strlen($key)>100 || isset($keys[$key])) throw new InvalidArgumentException('Each item needs a unique description within its event and a valid key.');
                    $keys[$key]=true;
                }
                return $keys;
            };
            $before=$expenseKeys($previous['expenditures']??[]);
            $after=$expenseKeys($input['data']['expenditures']);
            $removed=array_diff_key($before,$after);
            foreach($removed as $key=>$_){
                $check=$pdo->prepare('SELECT amount FROM expenditures WHERE item_key=? AND is_archived=0 FOR UPDATE');$check->execute([$key]);
                if(abs((float)$check->fetchColumn())>0.00001) throw new DomainException('Archive the semester before removing an event or item with recorded spending.');
                try {
                    $history=$pdo->prepare('SELECT 1 FROM expenditure_transactions WHERE event_item_key=? LIMIT 1');$history->execute([$key]);
                    if($history->fetchColumn()) throw new DomainException('Archive the semester before removing an event or item with transaction history.');
                } catch(PDOException $e){if($e->getCode()!=='42S02')throw $e;}
                $pdo->prepare('DELETE FROM expenditures WHERE item_key=? AND is_archived=0')->execute([$key]);
                $pdo->prepare('DELETE FROM budgets WHERE item_key=? AND is_archived=0')->execute([$key]);
            }
            $json=json_encode($input['data'],JSON_THROW_ON_ERROR);
            $pdo->prepare("INSERT INTO system_settings(setting_key,setting_value) VALUES('ui_layout',?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)")->execute([$json]);
            $pdo->prepare("INSERT INTO user_logs(user_id,username,role,action,details) VALUES(?,?,?,'Layout Updated',?)")
                ->execute([$_SESSION['user_id'],$_SESSION['username']??'Admin',$role,'Admin updated programs/events/items. Removed item keys: '.implode(', ',array_keys($removed))]);
            $pdo->commit();
            echo json_encode(['status'=>'success']);
        } catch(Throwable $e){
            if($pdo->inTransaction())$pdo->rollBack();
            $known=$e instanceof InvalidArgumentException||$e instanceof DomainException;
            http_response_code($e instanceof DomainException?409:($known?400:500));
            if(!$known)error_log('Layout save failed: '.$e->getMessage());
            echo json_encode(['status'=>'error','message'=>$known?$e->getMessage():'Could not save the layout. Please retry.']);
        }
        exit;
    }

    if (!in_array($role, ['admin', 'treasurer'], true)) {
        http_response_code(403);
        echo json_encode(['status' => 'error', 'message' => 'Unauthorized view-only role.']);
        exit;
    }

    // Reject unauthorized table writes before applying any part of the batch.
    foreach ($input as $row) {
        if (!is_array($row)) continue;
        $rowType = $row['type'] ?? '';
        if (($rowType === 'out' && $role !== 'admin') ||
            ($rowType === 'in' && $role !== 'treasurer') ||
            ($rowType === 'overall_budget' && $role !== 'admin')) {
            http_response_code(403);
            echo json_encode(['status'=>'error','message'=>$rowType === 'in'
                ? 'Only the Treasurer may update collections.'
                : 'Only the Admin may update expenditures and budgets.']);
            exit;
        }
    }

    try {
        $pdo->beginTransaction();
        foreach ($input as $row) {
            if (!is_array($row)) throw new InvalidArgumentException('Invalid financial row.');
            if (($row['type'] ?? '') === 'overall_budget' && $role === 'admin') {
                $cents = adminCategoryPriceCents($row['amount'] ?? null);
                $cycle = (int)$pdo->query("SELECT COALESCE(MAX(id),0) FROM user_logs WHERE action='System Reboot'")->fetchColumn();
                $saveOverall = $pdo->prepare("INSERT INTO system_settings(setting_key,setting_value) VALUES('expenditure_overall_budget',?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)");
                $saveOverall->execute([json_encode(['cycle'=>$cycle,'amount'=>number_format($cents / 100,2,'.','')], JSON_THROW_ON_ERROR)]);
                continue;
            }
            // Dynamic Admin Collection Categories
            if (isset($row['type']) && $row['type'] === 'col_settings' && $role === 'admin') {
                if (!isset($row['data']) || !is_array($row['data']) || count($row['data']) === 0) {
                    throw new InvalidArgumentException('At least one valid category is required.');
                }
                $receivedIds = [];
                foreach ($row['data'] as $category) {
                    if (!is_array($category) || !isset($category['id'], $category['name'], $category['price']) ||
                        !is_string($category['id']) || !preg_match('/^[A-Za-z0-9_-]{1,100}$/', $category['id']) ||
                        isset($receivedIds[$category['id']]) || !is_string($category['name']) ||
                        trim($category['name']) === '' || strlen($category['name']) > 400) {
                        throw new InvalidArgumentException('Each category needs a unique ID and a valid name.');
                    }
                    $receivedIds[$category['id']] = true;
                    nonNegativeAmount($category['price']);
                }
                $settingsStmt = $pdo->prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'collection_categories' FOR UPDATE");
                $settingsStmt->execute();
                $oldCategories = json_decode($settingsStmt->fetchColumn() ?: '[]', true);
                if (is_array($oldCategories)) {
                    $removed = [];
                    foreach ($oldCategories as $category) {
                        $id = $category['id'] ?? null;
                        if (is_string($id) && !isset($receivedIds[$id])) $removed[$id] = true;
                    }
                    if ($removed) {
                        $activeData = $pdo->query('SELECT category_data FROM collections WHERE is_archived = 0')->fetchAll(PDO::FETCH_COLUMN);
                        foreach ($activeData as $json) {
                            $amounts = json_decode($json ?: '{}', true);
                            if (!is_array($amounts)) continue;
                            foreach ($removed as $removedId => $_) {
                                if (abs((float)($amounts[$removedId] ?? 0)) > 0.00001) {
                                    throw new DomainException('Cannot delete a category that contains active collections. Archive or reconcile those amounts first.');
                                }
                            }
                        }
                    }
                }
                // Keep the Admin breakdown separate from shared parent fees.
                if (count($row['data']) > 100) throw new InvalidArgumentException('Use at most 100 main categories.');
                $privateStmt = $pdo->prepare("SELECT setting_value FROM system_settings WHERE setting_key='admin_category_subcategories' FOR UPDATE");
                $privateStmt->execute();
                $storedBreakdowns = json_decode($privateStmt->fetchColumn() ?: '{}', true) ?: [];
                $breakdowns = array_key_exists('admin_subcategories', $row) ? $row['admin_subcategories'] : $storedBreakdowns;
                if (!is_array($breakdowns)) throw new InvalidArgumentException('Invalid subcategory breakdown.');
                foreach ($breakdowns as $parentId => $children) {
                    // Ignore old deleted parents only when preserving an older client's stored map.
                    if (!isset($receivedIds[$parentId]) && array_key_exists('admin_subcategories', $row)) {
                        throw new InvalidArgumentException('A subcategory has no matching main category.');
                    }
                }
                $publicCategories = [];
                $privateCategories = [];
                foreach ($row['data'] as $category) {
                    $children = $breakdowns[$category['id']] ?? [];
                    if (!is_array($children) || array_values($children) !== $children || count($children) > 50) {
                        throw new InvalidArgumentException('Use at most 50 subcategories per main category.');
                    }
                    $cleanChildren = [];
                    $totalCents = 0;
                    foreach ($children as $child) {
                        if (!is_array($child) || !is_string($child['name'] ?? null) ||
                            trim($child['name']) === '' || strlen($child['name']) > 400 ||
                            !preg_match('//u', $child['name']) || preg_match('/[\x00-\x1F\x7F]/u', $child['name'])) {
                            throw new InvalidArgumentException('Every subcategory needs a valid name.');
                        }
                        $cents = adminCategoryPriceCents($child['price'] ?? null);
                        $totalCents += $cents;
                        if ($totalCents > 999999999999) throw new InvalidArgumentException('The main category total is too large.');
                        $cleanChildren[] = ['name' => trim($child['name']), 'price' => number_format($cents / 100, 2, '.', '')];
                    }
                    $parentCents = $children ? $totalCents : adminCategoryPriceCents($category['price']);
                    $publicCategories[] = ['id' => $category['id'], 'name' => trim($category['name']),
                        'price' => number_format($parentCents / 100, 2, '.', '')];
                    if ($cleanChildren) $privateCategories[$category['id']] = $cleanChildren;
                }
                $privateJson = json_encode((object)$privateCategories, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
                if (strlen($privateJson) > 60000) throw new InvalidArgumentException('The subcategory breakdown is too long.');
                $privateSave = $pdo->prepare("INSERT INTO system_settings (setting_key,setting_value) VALUES ('admin_category_subcategories',?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)");
                $privateSave->execute([$privateJson]);
                $jsonCategories = json_encode($publicCategories, JSON_THROW_ON_ERROR);
                $stmt = $pdo->prepare("INSERT INTO system_settings (setting_key, setting_value) VALUES ('collection_categories', :val) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)");
                $stmt->execute([':val' => $jsonCategories]);
                continue;
            }
            // Admin Student Counts
            if (isset($row['type']) && $row['type'] === 'student_counts' && $role === 'admin') {
                if (!isset($row['name']) || !is_string($row['name']) || strlen($row['name']) > 50 || trim($row['name']) === '' || !isset($row['count']) || filter_var($row['count'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 0]]) === false) {
                    throw new InvalidArgumentException('Invalid student count or section key.');
                }
                $stmt = $pdo->prepare("INSERT INTO section_settings (section_key, num_students) VALUES (:key, :amt) ON DUPLICATE KEY UPDATE num_students=VALUES(num_students)");
                $stmt->execute([':key' => $row['name'], ':amt' => $row['count']]);
                continue;
            }
            // Budgets Management
            if (isset($row['type']) && $row['type'] === 'budget' && $role === 'admin') {
                assertWritableFinancialKey($pdo, 'budgets', $row['name'] ?? null);
                $row['budget'] = nonNegativeAmount($row['budget'] ?? null);
                $oldBudgetStmt = $pdo->prepare("SELECT allocated_amount FROM budgets WHERE item_key = ?");
                $oldBudgetStmt->execute([$row['name']]);
                $oldBudget = $oldBudgetStmt->fetchColumn();
                if ($oldBudget !== false && floatval($oldBudget) !== floatval($row['budget'])) {
                    $logMsg = "Updated budget for '" . $row['name'] . "' from " . number_format($oldBudget, 2) . " to " . number_format($row['budget'], 2);
                } else if ($oldBudget === false && floatval($row['budget']) > 0) {
                    $logMsg = "Set initial budget for '" . $row['name'] . "' to " . number_format($row['budget'], 2);
                }
                $stmtB = $pdo->prepare("INSERT INTO budgets (item_key, allocated_amount) VALUES (:key, :amt) ON DUPLICATE KEY UPDATE allocated_amount=VALUES(allocated_amount)");
                $stmtB->execute([':key' => $row['name'], ':amt' => $row['budget']]);
                if (isset($logMsg)) {
                    $logStmt = $pdo->prepare("INSERT INTO user_logs (user_id, username, role, action, details) VALUES (?, ?, ?, 'Budget Update', ?)");
                    $logStmt->execute([$_SESSION['user_id'] ?? null, $_SESSION['username'], $_SESSION['role'], $logMsg]);
                    unset($logMsg);
                }
                continue;
            }
            // Collections (JSON Target Data tracking)
            if (isset($row['type']) && $row['type'] === 'in') {
                assertWritableFinancialKey($pdo, 'collections', $row['name'] ?? null);
                if (!isset($row['category_data']) || !is_array($row['category_data'])) throw new InvalidArgumentException('Invalid collection category data.');
                foreach ($row['category_data'] as $categoryId => $categoryAmount) {
                    $row['category_data'][$categoryId] = nonNegativeAmount($categoryAmount);
                }
                // Collection totals are changed only by dated classroom receipts.
                // Ignore dashboard snapshots so autosave/undo/stale tabs cannot erase the ledger.
                $savedAmounts = $pdo->prepare('SELECT category_data FROM collections WHERE item_key = ? FOR UPDATE');
                $savedAmounts->execute([$row['name']]);
                $existingAmounts = $savedAmounts->fetchColumn();
                $catData = $existingAmounts !== false ? $existingAmounts : '{}';
                $label = $row['label'] ?? null;
                $stmt = $pdo->prepare("INSERT INTO collections (item_key, category_data, remarks, label) VALUES (:key, :cd, :rem, :lbl) ON DUPLICATE KEY UPDATE category_data=VALUES(category_data), remarks=VALUES(remarks), label=VALUES(label)");
                $stmt->execute([':key' => $row['name'], ':cd' => $catData, ':rem' => $row['remark'] ?? '', ':lbl' => $label]);
            }
            // Expenditures
            else if (isset($row['type']) && $row['type'] === 'out') {
                assertWritableFinancialKey($pdo, 'expenditures', $row['name'] ?? null);
                $amount = nonNegativeAmount($row['values'][0] ?? null);
                $label = $row['label'] ?? null;
                $stmt = $pdo->prepare("INSERT INTO expenditures (item_key, amount, remarks, label) VALUES (:key, :amt, :rem, :lbl) ON DUPLICATE KEY UPDATE amount=VALUES(amount), remarks=VALUES(remarks), label=VALUES(label)");
                $stmt->execute([':key' => $row['name'], ':amt' => $amount, ':rem' => $row['remark'] ?? '', ':lbl' => $label]);
            } else {
                throw new InvalidArgumentException('Unknown or unauthorized financial row type.');
            }
        }
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        error_log('Financial save failed: ' . $e->getMessage());
        http_response_code($e instanceof DomainException ? 409 : ($e instanceof InvalidArgumentException ? 400 : 500));
        echo json_encode(['status' => 'error', 'message' => ($e instanceof DomainException || $e instanceof InvalidArgumentException) ? $e->getMessage() : 'Changes could not be saved. Please retry.']);
        exit;
    }
    echo json_encode(['status' => 'success']);
    exit;
}

if ($method === 'GET') {
    // Fetch Archives Specific Request
    if (isset($_GET['action']) && $_GET['action'] === 'get_archives') {
        if ($role !== 'admin') {
            echo json_encode(['status' => 'error', 'message' => 'Unauthorized']);
            exit;
        }
        $year = $_GET['year'] ?? '';
        if ($year) {
            $colls = $pdo->prepare("SELECT * FROM collections WHERE is_archived = 1 AND academic_year = ?");
            $colls->execute([$year]);
            $exps = $pdo->prepare("SELECT * FROM expenditures WHERE is_archived = 1 AND academic_year = ?");
            $exps->execute([$year]);
            $buds = $pdo->prepare("SELECT * FROM budgets WHERE is_archived = 1 AND academic_year = ?");
            $buds->execute([$year]);
            echo json_encode([
                'collections' => $colls->fetchAll(PDO::FETCH_ASSOC),
                'expenditures' => $exps->fetchAll(PDO::FETCH_ASSOC),
                'budgets' => $buds->fetchAll(PDO::FETCH_ASSOC)
            ]);
        } else {
            $years = $pdo->query("SELECT DISTINCT academic_year FROM collections WHERE is_archived = 1 UNION SELECT DISTINCT academic_year FROM expenditures WHERE is_archived = 1 UNION SELECT DISTINCT academic_year FROM budgets WHERE is_archived = 1")->fetchAll(PDO::FETCH_COLUMN);
            echo json_encode(['years' => $years]);
        }
        exit;
    }
    // Standard Active Dashboard View Queries
    $colls = $pdo->query("SELECT * FROM collections WHERE is_archived = 0")->fetchAll(PDO::FETCH_ASSOC);
    $exps = $pdo->query("SELECT * FROM expenditures WHERE is_archived = 0")->fetchAll(PDO::FETCH_ASSOC);
    $budgets = []; $sys_settings = []; $students = []; $structure = null;

    try {
        $budgets = $pdo->query("SELECT * FROM budgets WHERE is_archived = 0")->fetchAll(PDO::FETCH_ASSOC);
        $sys_settings = $pdo->query("SELECT * FROM system_settings")->fetchAll(PDO::FETCH_KEY_PAIR);
        $students = $pdo->query("SELECT * FROM section_settings")->fetchAll(PDO::FETCH_KEY_PAIR);
        if (isset($sys_settings['ui_layout'])) {
            $structure = json_decode($sys_settings['ui_layout'], true);
        }
    } catch (PDOException $e) { }

    // Do not send Admin-only breakdowns to the Treasurer or Auditor.
    if ($role !== 'admin') unset($sys_settings['admin_category_subcategories']);
    if ($role === 'auditor') unset($sys_settings['audit_signoff_collections'], $sys_settings['audit_signoff_expenditures']);

    echo json_encode([
        'collections' => $colls,
        'expenditures' => $exps,
        'budgets' => $budgets,
        'overall_budget' => currentOverallBudget($pdo),
        'sys_settings' => $sys_settings,
        'students' => $students,
        'structure' => $structure,
        'audit_signoffs' => [
            'collections' => $role === 'auditor' ? null : verifiedSignOff($pdo, 'collections'),
            'expenditures' => $role === 'auditor' ? null : verifiedSignOff($pdo, 'expenditures')
        ]
    ]);
    exit;
}

if ($method === 'DELETE') {
    if ($role !== 'admin' && $role !== 'treasurer') {
        echo json_encode(['status' => 'error', 'message' => 'Unauthorized. Only admins and treasurers can delete items.']);
        exit;
    }
    $input = json_decode(file_get_contents('php://input'), true);
    $key = $input['item_key'] ?? '';
    $type = $input['type'] ?? '';
    if ($type === 'out' && $role !== 'admin') {
        http_response_code(403);
        echo json_encode(['status'=>'error','message'=>'Only Admin can remove expenditure items.']);
        exit;
    }
    if (is_string($key) && trim($key) !== '' && in_array($type, ['in', 'out'], true)) {
        $table = $type === 'in' ? 'collections' : 'expenditures';
        $check = $pdo->prepare("SELECT is_archived FROM {$table} WHERE item_key = ?");
        $check->execute([$key]);
        $existing = $check->fetch(PDO::FETCH_ASSOC);
        if ($existing && (int)$existing['is_archived'] === 1) {
            http_response_code(409);
            echo json_encode(['status'=>'error', 'message'=>'This record is archived and cannot be deleted.']);
            exit;
        }
        $ledgerTable = $type === 'in' ? 'collection_transactions' : 'expenditure_transactions';
        $ledgerKey = $type === 'in' ? 'section_key' : 'event_item_key';
        try {
            $ledgerHistory = $pdo->prepare("SELECT 1 FROM {$ledgerTable} WHERE {$ledgerKey}=? LIMIT 1");
            $ledgerHistory->execute([$key]);
            if ($ledgerHistory->fetchColumn()) {
                http_response_code(409);
                echo json_encode(['status'=>'error','message'=>'This item has transaction history. Archive it instead of deleting its financial total.']); exit;
            }
        } catch (PDOException $e) {
            // The separate transaction portal is optional on older installations.
            if ($e->getCode() !== '42S02') throw $e;
        }
        if ($type === 'in') {
            $history = $pdo->prepare('SELECT 1 FROM section_remittances WHERE item_key = ? LIMIT 1');
            $history->execute([$key]);
            if ($history->fetchColumn()) {
                http_response_code(409);
                echo json_encode(['status'=>'error','message'=>'This section has remittance history. Archive the academic year instead of deleting its financial record.']);
                exit;
            }
            $pdo->prepare("DELETE FROM collections WHERE item_key = ? AND is_archived = 0")->execute([$key]);
        } else if ($type === 'out') {
            $pdo->prepare("DELETE FROM expenditures WHERE item_key = ? AND is_archived = 0")->execute([$key]);
            $pdo->prepare("DELETE FROM budgets WHERE item_key = ? AND is_archived = 0")->execute([$key]);
        }
        if ($existing) {
            $logStmt = $pdo->prepare("INSERT INTO user_logs (user_id, username, role, action, details) VALUES (?, ?, ?, 'Item Deleted', ?)");
            $logStmt->execute([$_SESSION['user_id'] ?? null, $_SESSION['username'], $_SESSION['role'], "Deleted item record: " . $key]);
        }
    }
    else {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'A valid item key and type are required.']);
        exit;
    }
    echo json_encode(['status' => 'success']);
    exit;
}
?>