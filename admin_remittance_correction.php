<?php
session_start();
date_default_timezone_set('Asia/Manila');
require_once __DIR__.'/request_guard.php';
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');
if(empty($_SESSION['user_id']) || ($_SESSION['role']??'')!=='admin'){
    http_response_code(403);echo json_encode(['status'=>'error','message'=>'Only the Admin/President can record corrections.']);exit;
}
require_once __DIR__.'/db.php';
require_once __DIR__.'/student_collection_link.php';
require_once __DIR__.'/remittance_corrections.php';
try{
    if(($_SERVER['REQUEST_METHOD']??'')!=='POST'){http_response_code(405);echo json_encode(['status'=>'error','message'=>'Method not allowed.']);exit;}
    $in=json_decode(file_get_contents('php://input'),true,512,JSON_THROW_ON_ERROR);
    if(!is_array($in) || !is_numeric($in['id']??null) || (int)$in['id']<=0)throw new InvalidArgumentException('Choose a remittance.');
    $action=$in['action']??'correct';
    if(!in_array($action,['correct','remove'],true))throw new InvalidArgumentException('Invalid remittance action.');
    $remove=$action==='remove';
    $reason=$in['reason']??null;
    if(!is_string($reason) || trim($reason)==='' || strlen($reason)>500 || preg_match('/[\x00-\x1F\x7F]/u',$reason))throw new InvalidArgumentException('Enter a correction explanation of 1–500 bytes.');
    $reason=trim($reason);
    $signature=hash('sha256',json_encode([$action,$reason,$remove?null:($in['amounts']??null),$in['legacy_covered']??null],JSON_THROW_ON_ERROR));
    $id=(int)$in['id'];$request=$in['request_id']??'';
    if(!is_string($request) || !preg_match('/^[a-f0-9-]{36}$/D',$request))throw new InvalidArgumentException('Invalid correction request.');
    $q=$pdo->prepare('SELECT item_key FROM section_remittances WHERE id=?');$q->execute([$id]);$key=$q->fetchColumn();
    if($key===false)throw new DomainException('Remittance no longer exists. Reload history.');
    $pdo->beginTransaction();$totals=scl_lock_collection($pdo,$key);
    $q=$pdo->prepare('SELECT * FROM section_remittances WHERE id=? FOR UPDATE');$q->execute([$id]);$row=$q->fetch(PDO::FETCH_ASSOC);
    if(!$row)throw new DomainException('Remittance no longer exists. Reload history.');
    $meta=rmc_meta($pdo,$id,true);
    foreach($meta['history']??[] as $entry)if(($entry['request_id']??'')===$request){
        if(!isset($entry['request_signature']) || !hash_equals($entry['request_signature'],$signature))throw new DomainException('This request was already processed with different values. Reload history before making another change.');
        $pdo->rollBack();echo json_encode(['status'=>'success','duplicate'=>true]);exit;
    }
    if(!empty($meta['removed']))throw new DomainException('This remittance was already removed. Reload history.');
    if(!is_string($in['revision']??null) || !hash_equals(rmc_revision($row,$meta),$in['revision']))throw new DomainException('This remittance changed. Reload history before correcting it.');
    $cycle=(int)$pdo->query("SELECT COALESCE(MAX(id),0) FROM user_logs WHERE action='System Reboot'")->fetchColumn();
    $q=$pdo->prepare('SELECT setting_value FROM system_settings WHERE setting_key=?');$q->execute(['sr_clear_'.substr(hash('sha256',$key),0,32).'_'.$cycle]);
    if((int)$row['cycle_id']!==$cycle || $id<=(int)$q->fetchColumn())throw new DomainException('Only active, uncleared remittances can be corrected here.');
    $old=json_decode($row['category_data'],true,512,JSON_THROW_ON_ERROR);$input=$remove?array_fill_keys(array_keys($old),'0.00'):($in['amounts']??null);
    if(!is_array($input) || array_diff(array_keys($old),array_keys($input)) || array_diff(array_keys($input),array_keys($old)))throw new InvalidArgumentException('Correct the existing category breakdown.');
    $new=[];$sum=0;$changed=false;
    foreach($old as $cat=>$value){$cents=sp_cents($input[$cat]);$new[$cat]=sp_money($cents);$sum+=$cents;$changed=$changed||$cents!==sp_cents($value);}
    if(!$changed && !$remove)throw new InvalidArgumentException('Change at least one category amount.');
    if($sum>99999999999999)throw new InvalidArgumentException('Corrected total is too large.');
    $sent=scl_sent($pdo,$cycle,$key);$clearId=scl_clear_id($pdo);$coverage=$meta['covered']??null;$nextCoverage=[];
    if($row['direction']==='classroom' && $coverage===null){
        $coverage=$in['legacy_covered']??null;
        if(!is_array($coverage) || array_diff(array_keys($old),array_keys($coverage)))throw new InvalidArgumentException('For this older remittance, confirm how much was already included in student payments for each category.');
    }
    foreach($old as $cat=>$value){
        $before=sp_cents($value);$after=sp_cents($new[$cat]);$current=sp_cents($totals[$cat]??'0');
        $roster=scl_lock_roster($pdo,$cycle,$key,(string)$cat);$context=scl_context($roster['stored'],$current,$clearId);$pending=$context['pending'];
        if($row['direction']==='classroom'){
            $covered=sp_cents($coverage[$cat]??'0');
            if($covered>$before)throw new InvalidArgumentException('Student-payment coverage cannot exceed the original remittance amount.');
            if($after>=$before){$used=min($after-$before,$pending);$newCurrent=$current+$after-$before-$used;$newPending=$pending-$used;$nextCoverage[$cat]=sp_money($covered+$used);}
            else{$newCovered=min($covered,$after);$restored=$covered-$newCovered;$newCurrent=$current-($before-$after-$restored);$newPending=$pending+$restored;$nextCoverage[$cat]=sp_money($newCovered);}
            if($newCurrent<0 || $newCurrent>999999999999 || $newPending>$newCurrent || $newPending>scl_paid($roster['stored']['entries']??[]))throw new DomainException('The correction conflicts with saved student payments. Reconcile the student list before correcting this transfer.');
            if($newCurrent-$newPending<($sent[$cat]??0))throw new DomainException('This correction would reduce received cash below money already remitted to the custodian. Correct the onward remittance first.');
            $totals[$cat]=sp_money($newCurrent);
            if($roster['raw']!==''){
                $stored=$roster['stored'];$stored['_collection_link']=['version'=>1,'pending_cents'=>$newPending,'clear_id'=>$clearId];
                $pdo->prepare('UPDATE system_settings SET setting_value=? WHERE setting_key=?')->execute([json_encode($stored,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),$roster['key']]);
            }
        }else{
            if(($sent[$cat]??0)-$before+$after>$current-$pending)throw new DomainException('The corrected onward remittance exceeds cash received by the organization.');
        }
    }
    $meta['original']=$meta['original']??$row;
    $meta['covered']=$row['direction']==='classroom'?$nextCoverage:[];
    $meta['history'][]=['request_id'=>$request,'request_signature'=>$signature,'action'=>$action,'before_amounts'=>$old,'after_amounts'=>$new,'reason'=>$reason,
        'admin_id'=>(int)$_SESSION['user_id'],'admin'=>$_SESSION['username']??'Admin','at'=>date('Y-m-d h:i:s A')];
    if($remove)$meta['removed']=end($meta['history']);
    rmc_store($pdo,$id,$meta);
    $pdo->prepare('UPDATE section_remittances SET category_data=?,amount=? WHERE id=?')->execute([json_encode($new,JSON_THROW_ON_ERROR),sp_money($sum),$id]);
    if($row['direction']==='classroom')$pdo->prepare('UPDATE collections SET category_data=? WHERE item_key=? AND is_archived=0')->execute([json_encode($totals,JSON_THROW_ON_ERROR),$key]);
    $pdo->prepare("DELETE FROM system_settings WHERE setting_key='audit_signoff_collections'")->execute();
    $pdo->prepare("INSERT INTO user_logs(user_id,username,role,action,details) VALUES (?,?,'admin',?,?)")->execute([$_SESSION['user_id'],$_SESSION['username']??'Admin',$remove?'Remittance Removed':'Remittance Corrected',json_encode(['remittance_id'=>$id,'original'=>$meta['original'],'correction'=>end($meta['history'])],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]);
    $pdo->commit();echo json_encode(['status'=>'success','message'=>$remove?'Remittance removed from active records. Original entry and explanation retained.':'Correction saved. Original entry and explanation retained.']);
}catch(Throwable $e){
    if($pdo->inTransaction())$pdo->rollBack();$known=$e instanceof InvalidArgumentException||$e instanceof DomainException;
    if(!$known)error_log('Remittance correction: '.$e->getMessage());http_response_code($e instanceof DomainException?409:($known?400:500));
    echo json_encode(['status'=>'error','message'=>$known?$e->getMessage():'Unable to save the correction. No changes were saved.']);
}
