<?php
session_start();
date_default_timezone_set('Asia/Manila');
require_once __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
$role = $_SESSION['role'] ?? '';
if (empty($_SESSION['user_id']) || !in_array($role, ['admin','treasurer','auditor'], true)) {
    http_response_code(401); echo json_encode(['status'=>'error','message'=>'Sign in to continue.']); exit;
}
$uid = (int) $_SESSION['user_id'];
function fl_fail(string $message, int $code = 400): never {
    global $pdo; if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
 http_response_code($code); echo json_encode(['status'=>'error','message'=>$message]); exit; }
function fl_date($v): string {
    if (!is_string($v) || !preg_match('/^\d{4}-\d{2}-\d{2}$/D',$v)) fl_fail('Choose a valid date.');
    $d = DateTimeImmutable::createFromFormat('!Y-m-d', $v);
    if (!$d || $d->format('Y-m-d') !== $v || $d > new DateTimeImmutable('today')) fl_fail('Date is invalid or in the future.');
    return $v;
}
function fl_amount($v): string {
    if (!is_scalar($v) || !preg_match('/^\d{1,12}(?:\.\d{1,2})?$/D', trim((string)$v)) || (float)$v <= 0) fl_fail('Amount must be positive, maximum 2 decimals.');
    return number_format((float)$v,2,'.','');
}
function fl_text($v, int $max, bool $required = false): string {
    if (!is_scalar($v) && $v !== null) fl_fail('Invalid text field.');
    $s = trim((string)$v);
    if (($required && $s === '') || strlen($s) > $max) fl_fail('Missing or too-long entry.');
    return $s;
}
function fl_structure(PDO $pdo): array {
    $v=$pdo->query("SELECT setting_value FROM system_settings WHERE setting_key='ui_layout'")->fetchColumn();
    return json_decode($v ?: '{}',true) ?: [];
}
function fl_categories(PDO $pdo): array {
    $v=$pdo->query("SELECT setting_value FROM system_settings WHERE setting_key='collection_categories'")->fetchColumn();
    return json_decode($v ?: '[]',true) ?: [];
}
function fl_section(PDO $pdo, string $key): array {
    $nodes=fl_structure($pdo)['collections'] ?? [];
    foreach ($nodes as $node) {
        if (($node['type'] ?? '') !== 'in') continue;
        $safe=strtolower(preg_replace('/[^a-z0-9]/', '-',strtolower($node['name'] ?? '')));
        $full=($node['parent'] ?? '') ? $node['parent'].'-'.$safe : $safe;
        if ($full !== $key) continue;
        $parent=$node['parent'] ?? null; $parts=[$node['name']]; $guard=0;
        while($parent && $guard++ < 20) { $match=null; foreach($nodes as $n){if(($n['id']??null)===$parent){$match=$n;break;}} if(!$match) break; array_unshift($parts,$match['name']); $parent=$match['parent']??null; }
        return ['key'=>$key,'label'=>implode(' / ',$parts)];
    }
    fl_fail('Section does not exist in the current layout.');
}
function fl_event(PDO $pdo, string $key): array {
    $nodes=fl_structure($pdo)['expenditures'] ?? [];
    foreach($nodes as $n){if(($n['type']??'')!=='out')continue;
        $safe=preg_replace('/[^a-z0-9]/','-',strtolower($n['name']??''));
        $full=($n['parent']??'')?$n['parent'].'-'.$safe:$safe;
        if ($key!==$full) continue;
        $parts=[$n['name']];$parent=$n['parent']??null;$guard=0;
        while($parent&&$guard++<20){$match=null;foreach($nodes as $p){if(($p['id']??null)===$parent){$match=$p;break;}}if(!$match)break;array_unshift($parts,$match['name']);$parent=$match['parent']??null;}
        return ['key'=>$key,'label'=>implode(' / ',$parts)];
    }
    fl_fail('Expenditure item is not in the current Events layout. Add an event/item first.');
}
function fl_balance(PDO $pdo,int $id): float {
    $a=$pdo->prepare("SELECT COALESCE(SUM(IF(movement='advance',amount,-amount)),0) FROM cash_advance_movements WHERE cash_advance_id=?");$a->execute([$id]);
    $b=$pdo->prepare('SELECT COALESCE(SUM(amount),0) FROM expenditure_transactions WHERE cash_advance_id=?');$b->execute([$id]);
    return round((float)$a->fetchColumn()-(float)$b->fetchColumn(),2);
}
function fl_log(PDO $pdo,int $uid,string $action,string $details):void{
    $s=$pdo->prepare('INSERT INTO user_logs (user_id,username,role,action,details) VALUES (?,?,?,?,?)');
    $s->execute([$uid,$_SESSION['username']??'Unknown',$_SESSION['role']??'', $action,$details]);
}
$method=$_SERVER['REQUEST_METHOD'];
try {
    if($method==='GET'){
        $action=$_GET['action']??'overview';
        if($action==='overview'){
            if (!in_array($role, ['treasurer','admin'], true)) fl_fail('Collection and remittance ledgers are restricted to Treasurer and Admin.',403);
            $settings=['structure'=>fl_structure($pdo),'categories'=>fl_categories($pdo)];
            $settings['collections']=$pdo->query('SELECT t.*,u.username AS recorded_by FROM collection_transactions t LEFT JOIN users u ON u.id=t.recorded_by_id ORDER BY t.id DESC LIMIT 200')->fetchAll(PDO::FETCH_ASSOC);
            $settings['remittances']=$pdo->query('SELECT r.*,u.username AS recorded_by FROM daily_remittances r LEFT JOIN users u ON u.id=r.recorded_by_id ORDER BY r.id DESC LIMIT 100')->fetchAll(PDO::FETCH_ASSOC);
            $settings['expenditures']=$pdo->query('SELECT e.*,u.username AS recorded_by FROM expenditure_transactions e LEFT JOIN users u ON u.id=e.recorded_by_id ORDER BY e.id DESC LIMIT 250')->fetchAll(PDO::FETCH_ASSOC);
            $groups=$pdo->query('SELECT * FROM cash_advances ORDER BY id DESC')->fetchAll(PDO::FETCH_ASSOC);
            foreach($groups as &$g){$g['balance']=fl_balance($pdo,(int)$g['id']);}unset($g);
            $settings['advances']=$groups;
            $settings['movements']=$pdo->query('SELECT * FROM cash_advance_movements ORDER BY id DESC LIMIT 250')->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['status'=>'success']+$settings);exit;
        }
        fl_fail('Unknown action.');
    }
    if($method!=='POST')fl_fail('Unsupported request method.',405);
    if(empty($_SESSION['csrf_finance_audit']) || !hash_equals($_SESSION['csrf_finance_audit'], $_SERVER['HTTP_X_CSRF_TOKEN']??'')) fl_fail('Request expired. Refresh the page and try again.',403);
    $in=json_decode(file_get_contents('php://input'),true);
    if(!is_array($in))fl_fail('Invalid JSON data.');
    $action=$in['action']??'';
    if($action==='expense'){
        if($role!=='admin')fl_fail('Only the Admin may record expenditures.',403);
    }elseif($role!=='treasurer'){
        fl_fail('Only the Treasurer may record collections and remittances.',403);
    }
    $pdo->beginTransaction();
    if($action==='collection'){
        $section=fl_section($pdo,fl_text($in['section_key']??null,100,true));
        $catKey=fl_text($in['category_key']??null,100,true);
        $cat=null;foreach(fl_categories($pdo) as $c){if(($c['id']??'')===$catKey){$cat=$c;break;}}
        if(!$cat)fl_fail('Category not found in current collection settings.');
        $amount=fl_amount($in['amount']??null);$date=fl_date($in['date_received']??null);
        // First ensure a row exists; then lock the actual row before reading the JSON.
        // This prevents two simultaneous first payments from overwriting each other.
        $arch=$pdo->prepare('SELECT is_archived FROM collections WHERE item_key=? FOR UPDATE');
        $arch->execute([$section['key']]);$existing=$arch->fetch(PDO::FETCH_ASSOC);
        if($existing && (int)$existing['is_archived']===1) fl_fail('Section is archived. Use a new section key for the next academic year.',409);
        if(!$existing){
            $seed=$pdo->prepare('INSERT INTO collections (item_key,category_data,label,remarks) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE item_key=VALUES(item_key)');
            $seed->execute([$section['key'],'{}',$section['label'],'']);
        }
        $old=$pdo->prepare('SELECT category_data FROM collections WHERE item_key=? AND is_archived=0 FOR UPDATE');
        $old->execute([$section['key']]);$values=json_decode($old->fetchColumn() ?: '{}',true)?:[];
        $values[$catKey]=round(((float)($values[$catKey]??0))+(float)$amount,2);
        $w=$pdo->prepare('UPDATE collections SET category_data=?,label=? WHERE item_key=? AND is_archived=0');
        $w->execute([json_encode($values,JSON_THROW_ON_ERROR),$section['label'],$section['key']]);
        $s=$pdo->prepare('INSERT INTO collection_transactions (section_key,section_label,category_key,category_name,student_name,amount,date_received,note,recorded_by_id) VALUES (?,?,?,?,?,?,?,?,?)');
        $s->execute([$section['key'],$section['label'],$catKey,$cat['name'],fl_text($in['student_name']??'',150)?:null,$amount,$date,fl_text($in['note']??'',500)?:null,$uid]);
        $record=(int)$pdo->lastInsertId();fl_log($pdo,$uid,'Collection Recorded',"COL-$record | {$section['label']} | {$cat['name']} | PHP $amount | Received $date");
    } elseif($action==='remittance'){
        $amount=fl_amount($in['amount']??null);$date=fl_date($in['date_remitted']??null);
        $s=$pdo->prepare('INSERT INTO daily_remittances (date_remitted,amount,remitted_to,reference_no,note,recorded_by_id) VALUES (?,?,?,?,?,?)');
        $s->execute([$date,$amount,fl_text($in['remitted_to']??null,150,true),fl_text($in['reference_no']??'',100)?:null,fl_text($in['note']??'',500)?:null,$uid]);
        $record=(int)$pdo->lastInsertId();fl_log($pdo,$uid,'Remittance Recorded',"REM-$record | PHP $amount | $date (movement only; not new income)");
    } elseif($action==='create_advance'){
        $s=$pdo->prepare('INSERT INTO cash_advances (event_label,purpose,created_by_id) VALUES (?,?,?)');
        $s->execute([fl_text($in['event_label']??null,200,true),fl_text($in['purpose']??'',500)?:null,$uid]);
        $record=(int)$pdo->lastInsertId();fl_log($pdo,$uid,'Cash Advance Created',"Created cash advance account #$record");
    } elseif($action==='advance_movement'){
        $aid=(int)($in['cash_advance_id']??0);$s=$pdo->prepare('SELECT id FROM cash_advances WHERE id=? AND archived_year IS NULL FOR UPDATE');$s->execute([$aid]);if(!$s->fetchColumn())fl_fail('Active cash advance not found.');
        $move=$in['movement']??'';if(!in_array($move,['advance','refund'],true))fl_fail('Invalid cash advance movement.');
        $amount=fl_amount($in['amount']??null);$date=fl_date($in['event_date']??null);
        if($move==='refund' && (float)$amount>fl_balance($pdo,$aid)+0.00001)fl_fail('Refund exceeds the remaining advance balance.');
        if($move==='refund'){
            $first=$pdo->prepare("SELECT MIN(event_date) FROM cash_advance_movements WHERE cash_advance_id=? AND movement='advance'");$first->execute([$aid]);
            if(($earliest=$first->fetchColumn()) && $date<$earliest)fl_fail('Refund date cannot be earlier than the cash advance issue date.');
        }
        $s=$pdo->prepare('INSERT INTO cash_advance_movements (cash_advance_id,movement,amount,event_date,reference_no,recorded_by_id) VALUES (?,?,?,?,?,?)');
        $s->execute([$aid,$move,$amount,$date,fl_text($in['reference_no']??'',100)?:null,$uid]);
        $record=(int)$pdo->lastInsertId();fl_log($pdo,$uid,'Cash Advance Movement',"$move CA-$aid, PHP $amount, $date");
    } elseif($action==='expense'){
        $event=fl_event($pdo,fl_text($in['event_item_key']??null,100,true));
        $amount=fl_amount($in['amount']??null);$date=fl_date($in['date_spent']??null);
        $aid=($in['cash_advance_id']??'')===''?null:(int)$in['cash_advance_id'];
        if($aid!==null){$lock=$pdo->prepare('SELECT id FROM cash_advances WHERE id=? AND archived_year IS NULL FOR UPDATE');$lock->execute([$aid]);if(!$lock->fetchColumn())fl_fail('Cash advance is unavailable.');if((float)$amount>fl_balance($pdo,$aid)+0.00001)fl_fail('Disbursement exceeds available cash advance.');
            $first=$pdo->prepare("SELECT MIN(event_date) FROM cash_advance_movements WHERE cash_advance_id=? AND movement='advance'");$first->execute([$aid]);
            if(($earliest=$first->fetchColumn()) && $date<$earliest)fl_fail('Payment date cannot be earlier than the cash advance issue date.');
        }
        $old=$pdo->prepare('SELECT id,amount FROM expenditures WHERE item_key=? AND is_archived=0 FOR UPDATE');$old->execute([$event['key']]);$existing=$old->fetch(PDO::FETCH_ASSOC);
        if(!$existing){$arch=$pdo->prepare('SELECT 1 FROM expenditures WHERE item_key=? LIMIT 1');$arch->execute([$event['key']]);if($arch->fetchColumn())fl_fail('This event item was archived; use a new item key.',409);}
        $s=$pdo->prepare('INSERT INTO expenditures (item_key,amount,label,remarks) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE amount=amount+VALUES(amount),label=VALUES(label)');
        $s->execute([$event['key'],$amount,$event['label'],'']);
        $s=$pdo->prepare('INSERT INTO expenditure_transactions (event_item_key,event_label,payee,nature,voucher_no,amount,date_spent,cash_advance_id,note,recorded_by_id) VALUES (?,?,?,?,?,?,?,?,?,?)');
        $s->execute([$event['key'],$event['label'],fl_text($in['payee']??null,200,true),fl_text($in['nature']??null,300,true),fl_text($in['voucher_no']??'',100)?:null,$amount,$date,$aid,fl_text($in['note']??'',500)?:null,$uid]);
        $record=(int)$pdo->lastInsertId();fl_log($pdo,$uid,'Expenditure Recorded',"EXP-$record | {$event['label']} | PHP $amount | $date");
    }else{fl_fail('Unknown transaction action.');}
    $pdo->commit();echo json_encode(['status'=>'success','id'=>$record]);exit;
} catch(Throwable $e) {
    if($pdo->inTransaction())$pdo->rollBack();
    error_log('Finance ledger error: '.$e->getMessage());
    http_response_code(500);echo json_encode(['status'=>'error','message'=>'Could not save the transaction. Confirm the migration was imported and check the PHP error log.']);
}
