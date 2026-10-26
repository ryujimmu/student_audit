<?php
// Read-only administrative database-health report (no automatic data changes).
if (session_status() === PHP_SESSION_NONE) session_start();
if (!isset($_SESSION['user_id'])) { header('Location: login.php'); exit; }
if (($_SESSION['role'] ?? '') !== 'admin') { http_response_code(403); exit('Admin access only.'); }
if (($_GET['embedded'] ?? '') !== '1') { header('Location: index.php?view=database-health'); exit; }
require_once __DIR__ . '/db.php';
header('Cache-Control: no-store, private');
function esc($value): string { return htmlspecialchars((string)$value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
$error = null;
$orphanPayments = $orphanUnpaid = $amountWarnings = $yearWarnings = $duplicateYears = [];
$summary = ['archives' => 0, 'active' => 0, 'late_payments' => 0, 'unpaid' => 0];
try {
    $summary['archives'] = (int)$pdo->query('SELECT (SELECT COUNT(*) FROM collections WHERE is_archived=1) + (SELECT COUNT(*) FROM expenditures WHERE is_archived=1) + (SELECT COUNT(*) FROM budgets WHERE is_archived=1)')->fetchColumn();
    $summary['active'] = (int)$pdo->query('SELECT (SELECT COUNT(*) FROM collections WHERE is_archived=0) + (SELECT COUNT(*) FROM expenditures WHERE is_archived=0) + (SELECT COUNT(*) FROM budgets WHERE is_archived=0)')->fetchColumn();
    $summary['late_payments'] = (int)$pdo->query('SELECT COUNT(*) FROM late_payments')->fetchColumn();
    $summary['unpaid'] = (int)$pdo->query('SELECT COUNT(*) FROM unpaid_students WHERE is_settled=0')->fetchColumn();
    $orphanPayments = $pdo->query("SELECT p.id, p.academic_year, p.item_key, p.student_name, p.amount FROM late_payments p LEFT JOIN collections c ON c.item_key=p.item_key AND c.academic_year=p.academic_year AND c.is_archived=1 WHERE c.id IS NULL ORDER BY p.id DESC LIMIT 200")->fetchAll(PDO::FETCH_ASSOC);
    $orphanUnpaid = $pdo->query("SELECT u.id, u.academic_year, u.item_key, u.student_name FROM unpaid_students u LEFT JOIN collections c ON c.item_key=u.item_key AND c.academic_year=u.academic_year AND c.is_archived=1 WHERE c.id IS NULL ORDER BY u.id DESC LIMIT 200")->fetchAll(PDO::FETCH_ASSOC);

    $archiveCollections = $pdo->query('SELECT item_key, academic_year, label, category_data, category_snapshot, num_students FROM collections WHERE is_archived=1 ORDER BY academic_year DESC, item_key ASC')->fetchAll(PDO::FETCH_ASSOC);
    foreach ($archiveCollections as $collection) {
        $values = json_decode($collection['category_data'] ?? '{}', true);
        $snapshot = json_decode($collection['category_snapshot'] ?? '[]', true);
        $students = $collection['num_students'];
        if (!is_array($values) || !is_array($snapshot) || $students === null || (int)$students < 1) continue;
        foreach ($snapshot as $category) {
            if (!is_array($category)) continue;
            $id = $category['id'] ?? null;
            $price = (float)($category['price'] ?? 0);
            if (!$id || $price <= 0 || !array_key_exists($id, $values)) continue;
            $actual = (float)$values[$id];
            $expected = (int)$students * $price;
            if ($actual > $expected + 0.009) {
                $amountWarnings[] = [
                    'academic_year'=>$collection['academic_year'], 'section'=>$collection['label'] ?: $collection['item_key'],
                    'category'=>$category['name'] ?? $id, 'actual'=>$actual, 'target'=>$expected,
                    'message'=>'Above the snapshot target; could include adjustments or extra payments.'
                ];
            } elseif (abs(($actual / $price) - round($actual / $price)) > 0.0001) {
                $amountWarnings[] = [
                    'academic_year'=>$collection['academic_year'], 'section'=>$collection['label'] ?: $collection['item_key'],
                    'category'=>$category['name'] ?? $id, 'actual'=>$actual, 'target'=>$expected,
                    'message'=>'Not a whole number of listed fees; partial payments may explain it.'
                ];
            }
        }
    }
    $years = $pdo->query("SELECT DISTINCT academic_year FROM (SELECT academic_year FROM collections UNION ALL SELECT academic_year FROM expenditures UNION ALL SELECT academic_year FROM budgets) archive_years WHERE academic_year IS NOT NULL")->fetchAll(PDO::FETCH_COLUMN);
    foreach ($years as $year) {
        if (!preg_match('/^(\d{4})-(\d{4})$/', (string)$year, $m) || (int)$m[2] !== (int)$m[1]+1 || (int)$m[1] > (int)date('Y') + 5) {
            $yearWarnings[] = $year;
        }
    }
    $events = $pdo->query("SELECT details FROM user_logs WHERE action = 'System Reboot'")->fetchAll(PDO::FETCH_COLUMN);
    $counts = [];
    foreach ($events as $event) {
        if (preg_match('/Academic Year:\s*(\d{4}-\d{4})/', (string)$event, $m)) {
            $counts[$m[1]] = ($counts[$m[1]] ?? 0) + 1;
        }
    }
    foreach ($counts as $year => $count) if ($count > 1) $duplicateYears[$year] = $count;
} catch (Throwable $e) {
    error_log('Database health page failed: '.$e->getMessage());
    $error = 'The checks could not be completed. Verify that your original student_audit tables are installed.';
}
?><!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Database Health | NISU CICS Audit</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
:root{--blue:#2455c9;--deep:#0c2047;--light:#f1f6ff;--muted:#637491;--line:#dbe5f6}*{box-sizing:border-box}body{margin:0;background:var(--light);color:var(--deep);font-family:Inter,system-ui,sans-serif;font-size:14px}header{background:var(--deep);color:white;padding:19px max(24px,calc((100vw - 1150px)/2));display:flex;justify-content:space-between;align-items:center;gap:24px}header a{color:#cfdeff;text-decoration:none;font-weight:600}main{max-width:1150px;margin:auto;padding:30px 20px 65px}h1{font-size:30px;margin:0 0 8px}h2{font-size:18px;margin:0 0 12px}p{line-height:1.6}.sub{color:var(--muted);margin:0 0 25px}.notice{background:#fff7e7;border:1px solid #f0d8a6;border-radius:12px;padding:15px 18px;margin-bottom:20px}.cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:15px}.metric,.section{background:#fff;border:1px solid var(--line);border-radius:16px;box-shadow:0 5px 22px #1f448013}.metric{padding:20px}.metric strong{display:block;font-size:27px;color:var(--blue)}.metric span{font-size:12px;color:var(--muted)}.section{padding:23px;margin-top:19px}table{border-collapse:collapse;width:100%;min-width:620px}th{text-align:left;background:#edf3ff;color:#1c438c}th,td{padding:11px 13px;border-bottom:1px solid var(--line);vertical-align:top;font-size:13px}td{overflow-wrap:anywhere}.scroll{overflow:auto}.good{color:#08784e;font-weight:700}.warn{color:#92430e;font-weight:700}.pill{display:inline-block;background:#e9f1ff;color:var(--blue);padding:6px 12px;border-radius:99px;font-weight:700;font-size:12px}small{color:var(--muted)}.heading{display:flex;align-items:center;gap:12px;flex-wrap:wrap} @media(max-width:680px){.cards{grid-template-columns:repeat(2,minmax(0,1fr))}header{padding:18px}h1{font-size:24px}}
</style><link rel="stylesheet" href="workspace-ui.css?v=refined-20261018b">
<script src="workspace-ui.js?v=refined-20261018b" defer></script>
<style>@media screen {
 body[data-workspace-ui]{margin:0!important;min-height:0;background:transparent}
 body>.workspace-sidebar,body>.settings-sidebar,body>header{display:none!important}
 body[data-workspace-ui] main.health-content{margin:0!important;padding:0!important;width:100%;max-width:none;min-height:0}
 body .system-footer,.settings-page-head>a{display:none!important}
}</style></head><body data-workspace-ui="health">
<aside class="workspace-sidebar" aria-label="Admin workspace"><div class="workspace-brand"><img src="nisu_logo.png" alt="NISU"><div><strong>NISU AUDIT</strong><small>Fund &amp; Audit System</small></div></div><p class="workspace-nav-label">ADMIN WORKSPACE</p><nav aria-label="Main navigation"><a href="index.php?view=admin"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10 12 3l9 7v11h-7v-7h-4v7H3z"/></svg><span>Dashboard</span></a><a href="index.php?view=archives"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v11h14V9M9 13h6"/></svg><span>Historical Archives</span></a><a href="recovered_year.php"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7v5h5M4 12a8 8 0 1 1 2 6"/></svg><span>Recovered Years</span></a><a href="health.php" aria-current="page"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h4l3-8 4 16 3-8h4"/></svg><span>Database Health</span></a></nav><div class="workspace-college"><img src="cics_logo.png" alt="CICS"><span>College of Information<br>&amp; Computing Studies</span></div></aside>
<header><div><strong>NISU CICS</strong> &nbsp; / &nbsp; Student Organization Fund &amp; Audit</div><a href="index.php">← Back to dashboard</a></header>
<main class="health-content"><span class="pill">ADMIN ONLY · READ ONLY</span><h1>Database health</h1>
<p class="sub">Checks live MySQL records for questionable historical relationships and financial snapshots. This page makes no database changes.</p>
<div class="notice"><strong>Review, don't auto-correct.</strong> A warning identifies a record worth checking against receipts, archived forms, or other source documents. It does not prove an accounting error.</div>
<?php if ($error): ?><div class="notice"><?=esc($error)?></div><?php else: ?>
<div class="cards"><div class="metric"><strong><?=esc($summary['active'])?></strong><span>Active financial rows</span></div><div class="metric"><strong><?=esc($summary['archives'])?></strong><span>Archived financial rows</span></div><div class="metric"><strong><?=esc($summary['late_payments'])?></strong><span>Late-payment entries</span></div><div class="metric"><strong><?=esc($summary['unpaid'])?></strong><span>Outstanding roster entries</span></div></div>
<section class="section"><div class="heading"><h2>Late payments without an archived collection</h2><span class="pill"><?=count($orphanPayments)?> shown</span></div><p><small>A missing link may result from an old deletion or another historical data issue. Payments are not deleted automatically.</small></p>
<?php if (!$orphanPayments): ?><p class="good">No missing links found.</p><?php else: ?><div class="scroll"><table><thead><tr><th>Payment ID</th><th>Academic year</th><th>Section key</th><th>Student</th><th>Amount</th></tr></thead><tbody><?php foreach($orphanPayments as $r): ?><tr><td><?=esc($r['id'])?></td><td><?=esc($r['academic_year'])?></td><td><?=esc($r['item_key'])?></td><td><?=esc($r['student_name'])?></td><td>₱<?=number_format((float)$r['amount'],2)?></td></tr><?php endforeach; ?></tbody></table></div><?php endif; ?></section>
<section class="section"><div class="heading"><h2>Unpaid-student records without an archived collection</h2><span class="pill"><?=count($orphanUnpaid)?> shown</span></div>
<?php if (!$orphanUnpaid): ?><p class="good">No missing links found.</p><?php else: ?><div class="scroll"><table><thead><tr><th>Record ID</th><th>Academic year</th><th>Section key</th><th>Student</th></tr></thead><tbody><?php foreach($orphanUnpaid as $r): ?><tr><td><?=esc($r['id'])?></td><td><?=esc($r['academic_year'])?></td><td><?=esc($r['item_key'])?></td><td><?=esc($r['student_name'])?></td></tr><?php endforeach; ?></tbody></table></div><?php endif; ?></section>
<section class="section"><div class="heading"><h2>Archived category totals to review</h2><span class="pill"><?=count($amountWarnings)?> warnings</span></div><p><small>Compared to the archived price × archived student count. These are aggregate-based heuristics, not per-student verification.</small></p>
<?php if (!$amountWarnings): ?><p class="good">No total discrepancies detected by this check.</p><?php else: ?><div class="scroll"><table><thead><tr><th>Year / section</th><th>Category</th><th>Recorded</th><th>Snapshot target</th><th>Reason to review</th></tr></thead><tbody><?php foreach($amountWarnings as $r): ?><tr><td><?=esc($r['academic_year'])?><br><?=esc($r['section'])?></td><td><?=esc($r['category'])?></td><td>₱<?=number_format($r['actual'],2)?></td><td>₱<?=number_format($r['target'],2)?></td><td><?=esc($r['message'])?></td></tr><?php endforeach; ?></tbody></table></div><?php endif; ?></section>
<section class="section"><h2>Archiving and year consistency</h2><?php if(!$duplicateYears && !$yearWarnings): ?><p class="good">No duplicate resets or unusual academic-year labels found by these checks.</p><?php else: ?><?php foreach($duplicateYears as $year => $n): ?><p class="warn">Academic year <?=esc($year)?> appears in <?=esc($n)?> system-reboot logs. Review the historical cycle before restoring or re-archiving anything.</p><?php endforeach; ?><?php foreach($yearWarnings as $year): ?><p class="warn">Academic year <?=esc($year)?> is unusual or too far in the future. Review it against original documents; this report will not rename records.</p><?php endforeach; ?><?php endif; ?></section>
<?php endif; ?><p><small>Note: Uploaded files on disk and the validity of individual receipts cannot be checked from SQL alone. Keep this page restricted to administrators.</small></p>
<footer class="system-footer" style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-top:28px;padding-top:20px;border-top:1px solid #e1e9f4"><span>&copy; <?= date('Y') ?> Northern Iloilo State University</span><span>CICS &middot; Fund &amp; Audit System</span></footer></main></body></html>
