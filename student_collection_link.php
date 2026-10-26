<?php
require_once __DIR__.'/student_payment_helpers.php';
// Collections and roster rows must be locked in this order by every writer.
function scl_lock_collection(PDO $pdo, string $key): array {
    $pdo->prepare("INSERT INTO collections(item_key,category_data,remarks) VALUES(?,'{}','') ON DUPLICATE KEY UPDATE item_key=VALUES(item_key)")->execute([$key]);
    $q=$pdo->prepare('SELECT category_data,is_archived FROM collections WHERE item_key=? FOR UPDATE');$q->execute([$key]);
    $row=$q->fetch(PDO::FETCH_ASSOC);
    if (!$row || (int)$row['is_archived']===1) throw new DomainException('This section is archived. Reopen an active section.');
    return json_decode($row['category_data']?:'{}',true,512,JSON_THROW_ON_ERROR)?:[];
}
function scl_clear_id(PDO $pdo): int {
    return (int)$pdo->query("SELECT COALESCE(MAX(id),0) FROM user_logs WHERE action='Financial Inputs Cleared' AND details LIKE 'Cleared active collection totals%'")->fetchColumn();
}
function scl_paid(array $entries): int {
    $sum=0;foreach($entries as $entry) if(isset($entry['amount_paid']))$sum+=sp_cents($entry['amount_paid']);return $sum;
}
function scl_context(array $stored, int $current, int $clearId): array {
    $paid=scl_paid($stored['entries']??[]);
    $link=$stored['_collection_link']??[];
    $linked=($link['version']??0)===1;
    // Existing roster payments are presumed included up to the saved collection total.
    // First-time linkage adds only any not-yet-accounted portion, never the entire list again.
    return ['accounted'=>$linked?$paid:min($paid,$current),
        'pending'=>$linked&&(int)($link['clear_id']??0)===$clearId?min($current,max(0,(int)($link['pending_cents']??0))):0];
}
function scl_plan(array $stored, array $entries, int $current, int $clearId, bool $alreadyIncluded = false): array {
    $context=scl_context($stored,$current,$clearId);$paid=scl_paid($entries);
    if($alreadyIncluded){
        if($paid>$current)throw new DomainException('The student payment total exceeds Amount Collected. Choose New payments to add it.');
        return ['total'=>$current,'delta'=>0,'link'=>['version'=>1,'pending_cents'=>min($context['pending'],$paid),'clear_id'=>$clearId]];
    }
    $delta=$paid-$context['accounted'];$total=$current+$delta;
    if($total<0||$total>999999999999)throw new DomainException('The student payment correction would produce an invalid category collection total.');
    return ['total'=>$total,'delta'=>$delta,'link'=>['version'=>1,'pending_cents'=>max(0,$context['pending']+$delta),'clear_id'=>$clearId]];
}
function scl_lock_roster(PDO $pdo,int $cycle,string $key,string $category): array {
    $legacy='unpaid_roster_'.hash('sha256',json_encode([$cycle,$key,$category]));$short=substr($legacy,0,46);
    $q=$pdo->prepare('SELECT setting_value FROM system_settings WHERE setting_key=?');$q->execute([$legacy]);$seed=(string)($q->fetchColumn()?:'');
    $pdo->prepare('INSERT INTO system_settings(setting_key,setting_value) VALUES(?,?) ON DUPLICATE KEY UPDATE setting_key=VALUES(setting_key)')->execute([$short,$seed]);
    $q=$pdo->prepare('SELECT setting_value FROM system_settings WHERE setting_key=? FOR UPDATE');$q->execute([$short]);$raw=(string)($q->fetchColumn()?:'');
    return ['key'=>$short,'raw'=>$raw,'stored'=>json_decode($raw?:'{}',true,512,JSON_THROW_ON_ERROR)?:[]];
}
function scl_sent(PDO $pdo,int $cycle,string $key): array {
    $m=$pdo->prepare('SELECT setting_value FROM system_settings WHERE setting_key=?');$m->execute(['sr_clear_'.substr(hash('sha256',$key),0,32).'_'.$cycle]);$cutoff=(int)$m->fetchColumn();
    $q=$pdo->prepare("SELECT category_data FROM section_remittances WHERE item_key=? AND cycle_id=? AND id>? AND direction='organization'");$q->execute([$key,$cycle,$cutoff]);
    $sent=[];foreach($q->fetchAll(PDO::FETCH_COLUMN) as $json)foreach(json_decode($json,true,512,JSON_THROW_ON_ERROR)?:[] as $id=>$amount)$sent[$id]=($sent[$id]??0)+sp_cents($amount);return $sent;
}
// A classroom remittance is a transfer: consume already-counted student receipts first.
function scl_remit_plan(array $stored,int $amount,int $current,int $clearId): array {
    $context=scl_context($stored,$current,$clearId);$covered=min($amount,$context['pending']);
    return ['additional'=>$amount-$covered,'covered'=>$covered,'link'=>['version'=>1,'pending_cents'=>$context['pending']-$covered,'clear_id'=>$clearId]];
}

// Saved student receipts awaiting an actual classroom-to-organization transfer.
function scl_transfer_balances(PDO $pdo,int $cycle,string $key,array $totals): array {
    $q=$pdo->query("SELECT setting_value FROM system_settings WHERE setting_key='collection_categories'");
    $categories=json_decode($q->fetchColumn()?:'[]',true,512,JSON_THROW_ON_ERROR)?:[];
    $read=$pdo->prepare('SELECT setting_value FROM system_settings WHERE setting_key=?');
    $clearId=scl_clear_id($pdo);$sent=scl_sent($pdo,$cycle,$key);$pending=[];$available=[];
    foreach($categories as $cat){
        $id=(string)$cat['id'];$legacy='unpaid_roster_'.hash('sha256',json_encode([$cycle,$key,$id]));
        $read->execute([substr($legacy,0,46)]);$raw=$read->fetchColumn();
        if($raw===false){$read->execute([$legacy]);$raw=$read->fetchColumn();}
        $stored=json_decode($raw?:'{}',true,512,JSON_THROW_ON_ERROR)?:[];
        $current=sp_cents($totals[$id]??'0');$cents=scl_context($stored,$current,$clearId)['pending'];
        $pending[$id]=sp_money($cents);$available[$id]=sp_money(max(0,$current-$cents-($sent[$id]??0)));
    }
    return ['pending_student_payments'=>$pending,'available_to_custodian'=>$available];
}
