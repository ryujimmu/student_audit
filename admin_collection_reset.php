<?php
// Temporary test utility. Remove this endpoint and the matching app.js block to retire it.
session_start();
require_once __DIR__ . '/request_guard.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
if (empty($_SESSION['user_id']) || ($_SESSION['role'] ?? '') !== 'admin') {
    http_response_code(403);
    echo json_encode(['status'=>'error','message'=>'Only the Admin can reset Collections test data.']);
    exit;
}
require_once __DIR__ . '/db.php';
function acr_snapshot(PDO $pdo): array {
    // Match the payment endpoints' collection-first lock order.
    $collections=$pdo->query('SELECT * FROM collections WHERE is_archived=0 ORDER BY item_key FOR UPDATE')->fetchAll(PDO::FETCH_ASSOC);
    $settings=$pdo->query('SELECT setting_key,setting_value FROM system_settings ORDER BY setting_key FOR UPDATE')->fetchAll(PDO::FETCH_KEY_PAIR);
    $cycle=(int)$pdo->query("SELECT COALESCE(MAX(id),0) FROM user_logs WHERE action='System Reboot'")->fetchColumn();
    $layout=json_decode($settings['ui_layout']??'{}',true,512,JSON_THROW_ON_ERROR);
    $cats=json_decode($settings['collection_categories']??'[]',true,512,JSON_THROW_ON_ERROR);
    $keys=array_column($collections,'item_key');
    foreach ($layout['collections']??[] as $node) {
        if (($node['type']??'')!=='in') continue;
        $safe=preg_replace('/[^a-z0-9]/','-',strtolower($node['name']??''));
        $keys[]=empty($node['parent'])?$safe:$node['parent'].'-'.$safe;
    }
    $rosters=[]; $students=0;
    foreach(array_unique($keys) as $key) foreach($cats as $cat) {
        $legacy='unpaid_roster_'.hash('sha256',json_encode([$cycle,$key,(string)$cat['id']]));
        foreach(array_unique([substr($legacy,0,46),$legacy]) as $rosterKey) {
            if (!array_key_exists($rosterKey,$settings)) continue;
            $rosters[$rosterKey]=$settings[$rosterKey];
            $saved=json_decode($settings[$rosterKey]?:'{}',true,512,JSON_THROW_ON_ERROR);
            $students+=count($saved['entries']??$saved['names']??[]);
        }
    }
    $markers=[];
    foreach($settings as $key=>$value) if(preg_match('/^sr_clear_[a-f0-9]{32}_'.preg_quote((string)$cycle,'/').'$/D',$key)) $markers[$key]=$value;
    $q=$pdo->prepare('SELECT * FROM section_remittances WHERE cycle_id=? ORDER BY id FOR UPDATE');
    $q->execute([$cycle]); $remittances=$q->fetchAll(PDO::FETCH_ASSOC);
    $data=['cycle_id'=>$cycle,'collections'=>$collections,'rosters'=>$rosters,'clear_markers'=>$markers,'remittances'=>$remittances,
        'layout'=>$settings['ui_layout']??null,'categories'=>$settings['collection_categories']??null];
    return ['data'=>$data,'revision'=>hash('sha256',json_encode($data,JSON_THROW_ON_ERROR)),
        'counts'=>['sections'=>count($collections),'student_entries'=>$students,'remittances'=>count($remittances)]];
}
try {
    $method=$_SERVER['REQUEST_METHOD'];
    if (!in_array($method,['GET','POST'],true)) {http_response_code(405);echo json_encode(['status'=>'error','message'=>'Method not allowed.']);exit;}
    $input=$method==='POST'?json_decode(file_get_contents('php://input'),true):null;
    if ($method==='POST' && (!is_array($input) || ($input['confirmation']??'')!=='RESET COLLECTIONS')) {
        http_response_code(400);echo json_encode(['status'=>'error','message'=>'Type RESET COLLECTIONS to continue.']);exit;
    }
    $pdo->beginTransaction();
    $snapshot=acr_snapshot($pdo);
    if ($method==='GET') {
        $pdo->commit();
        echo json_encode(['status'=>'success','revision'=>$snapshot['revision'],'counts'=>$snapshot['counts'],'backup'=>$snapshot['data']]);exit;
    }
    if (!is_string($input['revision']??null) || !hash_equals($snapshot['revision'],$input['revision'])) {
        $pdo->rollBack();http_response_code(409);echo json_encode(['status'=>'error','message'=>'Collections changed since the preview. Open the reset preview again.']);exit;
    }
    $pdo->exec("UPDATE collections SET category_data='{}',merch=0,tickets=0,penalties=0,other=0,remarks='' WHERE is_archived=0");
    $delete=$pdo->prepare('DELETE FROM system_settings WHERE setting_key=?');
    foreach(array_keys($snapshot['data']['rosters']+$snapshot['data']['clear_markers']) as $key) $delete->execute([$key]);
    $delete->execute(['audit_signoff_collections']);
    $q=$pdo->prepare('DELETE FROM section_remittances WHERE cycle_id=?');$q->execute([$snapshot['data']['cycle_id']]);
    $q=$pdo->prepare("INSERT INTO user_logs(user_id,username,role,action,details) VALUES (?,?,'admin','Financial Inputs Cleared',?)");
    $q->execute([$_SESSION['user_id'],$_SESSION['username']??'Admin',
        'Cleared active collection totals; Admin test reset also removed active student payment lists and current-cycle section remittances. '.json_encode($snapshot['counts'])]);
    $pdo->commit();
    echo json_encode(['status'=>'success','message'=>'Collections test data reset. Refresh any open Treasurer tabs.']);
} catch(Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('Admin collection reset failed: '.$e->getMessage());http_response_code(500);
    echo json_encode(['status'=>'error','message'=>'Reset failed. No changes were saved.']);
}
