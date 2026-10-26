<?php
// Student payment tracking. Section financial totals are managed separately.
require_once __DIR__ . '/student_payment_helpers.php';
require_once __DIR__ . '/student_collection_link.php';
session_start();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
function cu_fail(string $message, int $status = 400): void {
    http_response_code($status);
    echo json_encode(['status' => 'error', 'message' => $message]);
    exit;
}
if (empty($_SESSION['user_id'])) cu_fail('Please sign in again.', 401);
// Admin can review saved lists for archiving; editing stays Treasurer-only.
if (($_SESSION['role'] ?? '') === 'admin' && ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET' && ($_GET['action'] ?? '') === 'archive_preview') {
    require_once __DIR__ . '/db.php';
    require_once __DIR__ . '/unpaid_roster_bridge.php';
    try { echo json_encode(aru_roster_preview($pdo), JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR); }
    catch (Throwable $e) { error_log('Archive roster preview: '.$e->getMessage()); cu_fail('Could not load saved unpaid lists. Please retry.',500); }
    exit;
}
if (($_SESSION['role'] ?? '') !== 'treasurer') cu_fail('Only the Treasurer can manage these lists.', 403);
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if (!in_array($method, ['GET', 'POST'], true)) cu_fail('Method not allowed.', 405);
require_once __DIR__ . '/db.php';
try {
    $input = $method === 'GET' ? $_GET : json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) throw new InvalidArgumentException('Invalid request.');
    if ($method === 'POST' && (
        empty($_SESSION['section_remittance_csrf']) ||
        !is_string($input['csrf'] ?? null) ||
        !hash_equals($_SESSION['section_remittance_csrf'], $input['csrf'])
    )) cu_fail('Refresh the dashboard before saving.', 403);
    if ($method === 'GET' && ($input['action'] ?? '') === 'all_students') {
        require_once __DIR__ . '/unpaid_roster_bridge.php';
        $preview = aru_roster_preview($pdo);
        $rows = []; $unconfirmed = 0;
        foreach ($preview['students'] as $student) {
            if ($student['amount_paid'] === null || $student['balance_due'] === null) { $unconfirmed++; continue; }
            if (sp_cents($student['balance_due']) === 0) continue;
            $student['payment_status'] = sp_cents($student['amount_paid']) > 0 ? 'partial' : 'unpaid';
            $rows[] = $student;
        }
        echo json_encode(['status'=>'success','rows'=>$rows,'unconfirmed_count'=>$unconfirmed,
            'cycle_id'=>$preview['cycle_id']],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
        exit;
    }
    $key = $input['item_key'] ?? '';
    $category = $input['category_key'] ?? '';
    if (!is_string($key) || $key === '' || strlen($key) > 100 ||
        !is_string($category) || $category === '' || strlen($category) > 100) {
        throw new InvalidArgumentException('Choose a section and category.');
    }
    $setting = $pdo->prepare('SELECT setting_value FROM system_settings WHERE setting_key=?');
    $setting->execute(['ui_layout']);
    $layout = json_decode($setting->fetchColumn() ?: '{}', true);
    $found = false;
    foreach (($layout['collections'] ?? []) as $node) {
        $safe = preg_replace('/[^a-z0-9]/', '-', strtolower($node['name'] ?? ''));
        $candidate = empty($node['parent']) ? $safe : $node['parent'] . '-' . $safe;
        if (($node['type'] ?? '') === 'in' && $candidate === $key) $found = true;
    }
    if (!$found) throw new DomainException('This section is no longer active. Refresh the dashboard.');
    $setting->execute(['collection_categories']);
    $categories = json_decode($setting->fetchColumn() ?: '[]', true);
    $categoryName = null;
    $categoryFee = null;
    foreach ($categories as $cat) {
        if ((string)$cat['id'] === $category) { $categoryName = (string)$cat['name']; $categoryFee = $cat['price']; }
    }
    if ($categoryName === null) throw new DomainException('Categories changed. Refresh the dashboard.');
    $cycle = (int)$pdo->query("SELECT COALESCE(MAX(id),0) FROM user_logs WHERE action='System Reboot'")->fetchColumn();
    // 46 characters: compatible with existing VARCHAR(50) settings keys.
    // Keep the original full key readable so previously saved lists remain available.
    $legacyStorageKey = 'unpaid_roster_' . hash('sha256', json_encode([$cycle, $key, $category]));
    $storageKey = substr($legacyStorageKey, 0, 46);
    if ($method === 'GET') {
        $setting->execute([$storageKey]);
        $value = $setting->fetchColumn();
        if ($value === false) {
            $setting->execute([$legacyStorageKey]);
            $value = $setting->fetchColumn();
        }
        $raw = $value === false ? '' : (string)$value;
        $stored = json_decode($raw, true) ?: [];
        $q=$pdo->prepare('SELECT category_data FROM collections WHERE item_key=? AND is_archived=0');$q->execute([$key]);
        $collectionTotals=json_decode($q->fetchColumn()?:'{}',true)?:[];
        $linkContext=scl_context($stored,sp_cents($collectionTotals[$category]??'0'),scl_clear_id($pdo));
        echo json_encode(['status' => 'success', 'names' => $stored['names'] ?? [],
            'entries'=>sp_roster_entries($stored,$categoryFee),'fee_amount'=>sp_money(sp_cents($categoryFee)),
            'revision' => hash('sha256', $raw), 'cycle_id' => $cycle,
            'collection_totals'=>$collectionTotals,'roster_accounted_amount'=>sp_money($linkContext['accounted']),'pending_student_amount'=>sp_money($linkContext['pending'])]);
        exit;
    }
    if ((string)($input['cycle_id'] ?? '') !== (string)$cycle) {
        throw new DomainException('The system cycle changed. Reopen the section before saving.');
    }
    $entries = $input['entries'] ?? null;
    if (!is_array($entries) || count($entries)>200 || array_values($entries)!==$entries) {
        throw new InvalidArgumentException('Refresh the dashboard and enter at most 200 student payment rows.');
    }
    $clean=[]; $cleanEntries=[]; $seen=[]; $feeCents=sp_cents($categoryFee);
    foreach ($entries as $entry) {
        if (!is_array($entry) || !is_string($entry['student_name']??null)) throw new InvalidArgumentException('Invalid student row.');
        $name=trim($entry['student_name']);
        if ($name==='' || strlen($name)>200 || !preg_match('//u',$name) || preg_match('/[\x00-\x1F\x7F]/u',$name)) throw new InvalidArgumentException('Each student needs a name of at most 200 bytes.');
        $identity=strtolower($name);
        if(isset($seen[$identity]))throw new InvalidArgumentException('Duplicate student name. Add an identifier if two students share a name.');
        $seen[$identity]=true;
        $paid=sp_cents($entry['amount_paid']??null);
        if($paid>$feeCents)throw new InvalidArgumentException('Amount Paid cannot exceed the category fee.');
        $clean[]=$name;
        $cleanEntries[]=['student_name'=>$name,'payment_date'=>sp_record_date($entry['payment_date']??''),'amount_paid'=>sp_money($paid),'fee_amount'=>sp_money($feeCents),'balance_due'=>sp_money($feeCents-$paid)];
    }
    $revision = $input['revision'] ?? '';
    if (!is_string($revision)) throw new InvalidArgumentException('Reload this list before saving.');
    $pdo->beginTransaction();
    $collectionTotals=scl_lock_collection($pdo,$key);
    $currentCycle=(int)$pdo->query("SELECT COALESCE(MAX(id),0) FROM user_logs WHERE action='System Reboot'")->fetchColumn();
    if($currentCycle!==$cycle)throw new DomainException('The school-year cycle changed. Reopen the section.');
    // Seed the short key from a legacy list, then lock the authoritative row.
    // A duplicate short row keeps its own value, including an intentionally empty list.
    $setting->execute([$legacyStorageKey]);
    $legacyRaw = $setting->fetchColumn();
    $seed = $legacyRaw === false ? '' : (string)$legacyRaw;
    $insert = $pdo->prepare("INSERT INTO system_settings (setting_key,setting_value) VALUES (?,?) ON DUPLICATE KEY UPDATE setting_key=VALUES(setting_key)");
    $insert->execute([$storageKey, $seed]);
    $lock = $pdo->prepare('SELECT setting_value FROM system_settings WHERE setting_key=? FOR UPDATE');
    $lock->execute([$storageKey]);
    $raw = (string)($lock->fetchColumn() ?: '');
    if (!hash_equals(hash('sha256', $raw), $revision)) {
        throw new DomainException('This list changed in another session. Copy your edits, select Reload List, then merge and save.');
    }
    $oldEntries=[];
    foreach ((json_decode($raw,true)['entries']??[]) as $oldEntry) $oldEntries[strtolower(trim($oldEntry['student_name']??''))]=$oldEntry;
    foreach ($cleanEntries as $i=>&$cleanEntry) {
        if (!array_key_exists('payment_date',$entries[$i])) {
            $cleanEntry['payment_date']=sp_record_date($oldEntries[strtolower($cleanEntry['student_name'])]['payment_date']??'');
        }
    }
    unset($cleanEntry);
    $stored=json_decode($raw?:'{}',true,512,JSON_THROW_ON_ERROR)?:[];
    $paymentMode=$input['payment_mode']??'new';
    if(!in_array($paymentMode,['new','included'],true))throw new InvalidArgumentException('Choose how these payments should affect collections.');
    $plan=scl_plan($stored,$cleanEntries,sp_cents($collectionTotals[$category]??'0'),scl_clear_id($pdo),$paymentMode==='included');
    $sent=scl_sent($pdo,$cycle,$key);
    if($plan['total']-$plan['link']['pending_cents']<($sent[$category]??0))throw new DomainException('The correction would reduce collections below money already remitted to the custodian. Reconcile those transfers first.');
    $collectionTotals[$category]=sp_money($plan['total']);
    $pdo->prepare('UPDATE collections SET category_data=? WHERE item_key=? AND is_archived=0')->execute([json_encode($collectionTotals,JSON_THROW_ON_ERROR),$key]);
    $next = json_encode(['names' => $clean, 'entries'=>$cleanEntries, '_collection_link'=>$plan['link'], 'category_name' => $categoryName,
        'updated_by' => $_SESSION['username'] ?? 'Treasurer', 'updated_at' => gmdate('c')], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    if (strlen($next) > 60000) throw new InvalidArgumentException('This list is too long. Shorten the student names before saving.');
    $pdo->prepare('UPDATE system_settings SET setting_value=? WHERE setting_key=?')->execute([$next, $storageKey]);
    // Do not report success if MySQL truncated a key/value or matched no row.
    $lock->execute([$storageKey]);
    $verified = $lock->fetchColumn();
    if ($verified === false || (string)$verified !== $next) {
        throw new UnexpectedValueException('The database did not retain this list. Your edits are still on screen. Ask the administrator to check system_settings column sizes.');
    }
    $pdo->prepare("INSERT INTO user_logs (user_id,username,role,action,details) VALUES (?,?,?,'Unpaid Category List Updated',?)")
        ->execute([$_SESSION['user_id'], $_SESSION['username'] ?? 'Treasurer', 'treasurer',
            $key . ' | ' . $categoryName . ' | ' . count($clean) . ' names | cycle ' . $cycle . ' | Collection adjustment: ' . sp_money($plan['delta'])]);
    $pdo->commit();
    echo json_encode(['status' => 'success', 'names' => $clean, 'entries'=>$cleanEntries, 'fee_amount'=>sp_money($feeCents),
        'revision' => hash('sha256', $next), 'cycle_id' => $cycle,
        'collection_totals'=>$collectionTotals,'roster_accounted_amount'=>sp_money(scl_paid($cleanEntries)),'pending_student_amount'=>sp_money($plan['link']['pending_cents'])]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    $known = $e instanceof InvalidArgumentException || $e instanceof DomainException || $e instanceof UnexpectedValueException;
    if (!$known) error_log('Category unpaid list: ' . $e->getMessage());
    http_response_code($e instanceof DomainException ? 409 : ($e instanceof InvalidArgumentException ? 400 : 500));
    echo json_encode(['status' => 'error', 'message' => $known ? $e->getMessage() : 'Could not access this list. Check the PHP error log.']);
}
