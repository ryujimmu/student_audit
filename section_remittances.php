<?php
session_start();
date_default_timezone_set('Asia/Manila');
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/student_collection_link.php';
require_once __DIR__ . '/remittance_corrections.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
function sr_fail(string $message, int $code = 400): void {
    global $pdo; if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();

    http_response_code($code);
    echo json_encode(['status'=>'error', 'message'=>$message]);
    exit;
}
function sr_text($value, int $limit, bool $required = true): string {
    if (!is_string($value)) throw new InvalidArgumentException('Invalid text field.');
    $value = trim($value);
    if (($required && $value === '') || strlen($value) > $limit) throw new InvalidArgumentException('A name or text field is missing or too long.');
    return $value;
}
function sr_cents($value): int {
    if (!is_scalar($value) || !preg_match('/^\d{1,10}(?:\.\d{1,2})?$/D', (string)$value)) throw new InvalidArgumentException('Amounts must be non-negative with at most two decimal places.');
    return (int)round((float)$value * 100);
}
if (empty($_SESSION['user_id'])) sr_fail('Please sign in again.',401);
$role = $_SESSION['role'] ?? '';
if (!in_array($role, ['treasurer','auditor','admin'], true)) sr_fail('Access denied.',403);
$method = $_SERVER['REQUEST_METHOD'];
if (!in_array($method, ['GET','POST'], true)) sr_fail('Method not allowed.',405);
try {
    if ($method === 'GET') {
        $all = ($_GET['action'] ?? '') === 'all';
        $pdo->beginTransaction();
        $key = $all ? null : sr_text($_GET['item_key'] ?? '',100);
        $cycle = (int)$pdo->query("SELECT COALESCE(MAX(id),0) FROM user_logs WHERE action='System Reboot'")->fetchColumn();
        $q=$pdo->prepare($all
            ? 'SELECT * FROM section_remittances ORDER BY date_remitted DESC,id DESC'
            : 'SELECT * FROM section_remittances WHERE item_key=? ORDER BY date_remitted DESC,id DESC');
        $q->execute($all ? [] : [$key]);
        $rows=$q->fetchAll(PDO::FETCH_ASSOC);
        $cutoffs=[];
        $m=$pdo->prepare('SELECT setting_value FROM system_settings WHERE setting_key=?');
        foreach($rows as &$row){
            $c=(int)$row['cycle_id'];
            $markerKey='sr_clear_'.substr(hash('sha256',$row['item_key']),0,32).'_'.$c;
            if(!array_key_exists($markerKey,$cutoffs)){
                $m->execute([$markerKey]);
                $cutoffs[$markerKey]=(int)$m->fetchColumn();
            }
            $row=rmc_view($pdo,$row);
            $row['is_cleared']=(int)$row['id'] <= $cutoffs[$markerKey];
        }
        unset($row);
        $totals=[];
        if (!$all) {
            $s=$pdo->prepare('SELECT category_data FROM collections WHERE item_key=? AND is_archived=0');$s->execute([$key]);
            $totals=json_decode($s->fetchColumn()?:'{}',true)?:[];
        }
        $balances=$all?[]:scl_transfer_balances($pdo,$cycle,$key,$totals);
        $pdo->commit();
        echo json_encode(['status'=>'success','cycle_id'=>$cycle,'rows'=>$rows,'totals'=>$totals,'today'=>date('Y-m-d')]+$balances);
        exit;
    }
    if ($role !== 'treasurer') sr_fail('Only the organization Treasurer can record remittances.',403);
    $in=json_decode(file_get_contents('php://input'),true);
    if (!is_array($in)) throw new InvalidArgumentException('Invalid request.');
    if (empty($_SESSION['section_remittance_csrf']) || !is_string($in['csrf'] ?? null) || !hash_equals($_SESSION['section_remittance_csrf'],$in['csrf'])) sr_fail('Refresh this page before saving.',403);
    $key=sr_text($in['item_key']??'',100);
    $request=sr_text($in['request_id']??'',36);
    if (!preg_match('/^[a-f0-9-]{36}$/D',$request)) throw new InvalidArgumentException('Invalid request identifier.');
    $direction=$in['direction']??'';
    if (!in_array($direction,['classroom','organization'],true)) throw new InvalidArgumentException('Choose a remittance movement.');
    $date=sr_text($in['date_remitted']??'',10);
    $parsed=DateTimeImmutable::createFromFormat('!Y-m-d',$date);
    if (!$parsed || $parsed->format('Y-m-d')!==$date || $date>date('Y-m-d')) throw new InvalidArgumentException('Choose a valid remittance date, today or earlier.');
    $from=sr_text($in['remitted_by']??'',150); $to=sr_text($in['received_by']??'',150);
    $reference=sr_text($in['reference_no']??'',100,false); $note=sr_text($in['note']??'',500,false);
    $amounts=$in['amounts']??null;
    if (!is_array($amounts) || !$amounts) throw new InvalidArgumentException('Enter category amounts.');
    $pdo->beginTransaction();
    // Lock the section first: concurrent receipts serialize and archive updates wait.
    $lockedTotals=scl_lock_collection($pdo,$key);
    $existing=['category_data'=>json_encode($lockedTotals,JSON_THROW_ON_ERROR)];
    $s=$pdo->prepare('SELECT id FROM section_remittances WHERE request_id=?');$s->execute([$request]);
    if ($s->fetchColumn()) { $pdo->rollBack(); echo json_encode(['status'=>'success','duplicate'=>true]);exit; }
    $cycle=(int)$pdo->query("SELECT COALESCE(MAX(id),0) FROM user_logs WHERE action='System Reboot'")->fetchColumn();
    $layout=json_decode($pdo->query("SELECT setting_value FROM system_settings WHERE setting_key='ui_layout'")->fetchColumn()?:'{}',true);
    $nodes=$layout['collections']??[]; $section=null;
    foreach($nodes as $node){
        $safe=preg_replace('/[^a-z0-9]/','-',strtolower($node['name']??''));
        $candidate=empty($node['parent'])?$safe:$node['parent'].'-'.$safe;
        if (($node['type']??'')==='in' && $candidate===$key){$section=$node;break;}
    }
    if (!$section) throw new DomainException('Section is not in the active layout. Save the layout and reopen the section.');
    $parts=[$section['name']];$parent=$section['parent']??null;$seen=[];
    while($parent && !isset($seen[$parent])){
        $seen[$parent]=true;$match=null;foreach($nodes as $node){if(($node['id']??null)===$parent){$match=$node;break;}}
        if (!$match) break;array_unshift($parts,$match['name']);$parent=$match['parent']??null;
    }
    $label=sr_text(implode(' / ',$parts),600);
    $cats=json_decode($pdo->query("SELECT setting_value FROM system_settings WHERE setting_key='collection_categories'")->fetchColumn()?:'[]',true);
    $names=[];foreach($cats as $cat){$names[(string)$cat['id']]=(string)$cat['name'];}
    $clean=[];$snapNames=[];$total=0;
    foreach($amounts as $id=>$value){
        if (!array_key_exists((string)$id,$names)) throw new InvalidArgumentException('Fee categories changed. Refresh this page.');
        $cents=sr_cents($value);if($cents===0)continue;
        $total+=$cents;$clean[$id]=number_format($cents/100,2,'.','');$snapNames[$id]=$names[$id];
    }
    if ($total<=0 || $total>99999999999999) throw new InvalidArgumentException('Enter a positive total within the allowed amount range.');
    $current=json_decode($existing['category_data']??'{}',true)?:[];
    $sent=[];
    $m=$pdo->prepare('SELECT setting_value FROM system_settings WHERE setting_key=?');
    $m->execute(['sr_clear_'.substr(hash('sha256',$key),0,32).'_'.$cycle]);
    $cutoff=(int)$m->fetchColumn();
    $s=$pdo->prepare("SELECT category_data FROM section_remittances WHERE item_key=? AND cycle_id=? AND id>? AND direction='organization'");$s->execute([$key,$cycle,$cutoff]);
    foreach($s->fetchAll(PDO::FETCH_COLUMN) as $json){foreach(json_decode($json,true)?:[] as $id=>$v){$sent[$id]=($sent[$id]??0)+sr_cents($v);}}
    $clearId=scl_clear_id($pdo);
    $rosterCovered=[];
    foreach($clean as $id=>$value){
        $balance=sr_cents((string)($current[$id]??0));$cents=sr_cents($value);
        $roster=scl_lock_roster($pdo,$cycle,$key,(string)$id);
        $pending=scl_context($roster['stored'],$balance,$clearId)['pending'];
        if($direction==='classroom' && isset($in['expected_pending']) && (!is_array($in['expected_pending']) || !array_key_exists($id,$in['expected_pending']) || sr_cents($in['expected_pending'][$id])!==$pending)) throw new DomainException('Student payments or remittances changed. Reload the section before recording this transfer.');
        if($direction==='organization' && $cents>$balance-$pending-($sent[$id]??0)) throw new DomainException('The outgoing amount exceeds collections received by the organization for '.$names[$id].'. Record the classroom-to-organization transfer first.');
        if($direction==='classroom'){
            $plan=scl_remit_plan($roster['stored'],$cents,$balance,$clearId);
            if ($balance+$plan['additional']>999999999999) throw new InvalidArgumentException('Category total exceeds the allowed range.');
            $current[$id]=number_format(($balance+$plan['additional'])/100,2,'.','');
            if($roster['raw']!=='') {
                $stored=$roster['stored'];$stored['_collection_link']=$plan['link'];
                $next=json_encode($stored,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
                $pdo->prepare('UPDATE system_settings SET setting_value=? WHERE setting_key=?')->execute([$next,$roster['key']]);
            }
            $rosterCovered[$id]=sp_money($plan['covered']);
        }
    }
    if($direction==='classroom'){
        $s=$pdo->prepare("INSERT INTO collections (item_key,category_data,remarks,label) VALUES (?,?,'',?) ON DUPLICATE KEY UPDATE category_data=VALUES(category_data),label=VALUES(label)");
        $s->execute([$key,json_encode($current,JSON_THROW_ON_ERROR),$label]);
    }
    $s=$pdo->prepare('INSERT INTO section_remittances (request_id,cycle_id,item_key,section_label,direction,date_remitted,remitted_by,received_by,category_data,category_names,amount,reference_no,note,recorded_by_id,recorded_by,encoded_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    $s->execute([$request,$cycle,$key,$label,$direction,$date,$from,$to,json_encode($clean,JSON_THROW_ON_ERROR),json_encode($snapNames,JSON_THROW_ON_ERROR),number_format($total/100,2,'.',''),$reference,$note,$_SESSION['user_id'],$_SESSION['username']??'Treasurer',date('Y-m-d H:i:s')]);
    $id=$pdo->lastInsertId();
    $q=$pdo->prepare('SELECT * FROM section_remittances WHERE id=?');$q->execute([$id]);
    rmc_store($pdo,(int)$id,['original'=>$q->fetch(PDO::FETCH_ASSOC),'covered'=>$rosterCovered,'history'=>[]]);
    $s=$pdo->prepare("INSERT INTO user_logs (user_id,username,role,action,details) VALUES (?,?,?,'Section Remittance',?)");
    $s->execute([$_SESSION['user_id'],$_SESSION['username']??'Treasurer',$role,"SR-$id | $direction | $key | $date | ".number_format($total/100,2,'.','')]);
    $pdo->commit();
    echo json_encode(['status'=>'success','id'=>$id,'collection_totals'=>$current,'student_payments_already_counted'=>$rosterCovered]);
} catch(Throwable $e){
    if($pdo->inTransaction())$pdo->rollBack();
    error_log('Section remittance: '.$e->getMessage());
    $known=$e instanceof InvalidArgumentException || $e instanceof DomainException;
    http_response_code($e instanceof DomainException?409:($known?400:500));
    echo json_encode(['status'=>'error','message'=>$known?$e->getMessage():'Could not access remittances. Import 01_ADD_REMITTANCE_TABLE.sql and retry; check the PHP error log if it persists.']);
}
