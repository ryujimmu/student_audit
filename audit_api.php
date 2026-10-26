<?php
session_start();
date_default_timezone_set('Asia/Manila');
require_once __DIR__.'/db.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
$role=$_SESSION['role']??''; $uid=(int)($_SESSION['user_id']??0);
if(!$uid||!in_array($role,['admin','auditor'],true)){http_response_code(403);echo json_encode(['status'=>'error','message'=>'Auditor or admin access required.']);exit;}
function ar_fail(string $s,int $code=400):never{
    global $pdo; if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
http_response_code($code);echo json_encode(['status'=>'error','message'=>$s]);exit;}
function ar_amount($v):string{if(!is_scalar($v)||!preg_match('/^\d{1,12}(?:\.\d{1,2})?$/D',trim((string)$v))||(float)$v<=0)ar_fail('Enter a positive receipt amount (2 decimals max).');return number_format((float)$v,2,'.','');}
function ar_date($v):string{if(!is_string($v)||!preg_match('/^\d{4}-\d{2}-\d{2}$/D',$v))ar_fail('Invalid receipt date.');$d=DateTimeImmutable::createFromFormat('!Y-m-d',$v);if(!$d||$d->format('Y-m-d')!==$v||$d>new DateTimeImmutable('today'))ar_fail('Invalid or future receipt date.');return $v;}
function ar_string($v,int $length,bool $required=false):string{if(!is_scalar($v)&&$v!==null)ar_fail('Invalid text.');$s=trim((string)$v);if(($required&&$s==='')||strlen($s)>$length)ar_fail('Required field is blank or too long.');return $s;}
function ar_log(PDO $pdo,int $uid,string $event,string $details):void{$s=$pdo->prepare('INSERT INTO user_logs(user_id,username,role,action,details) VALUES(?,?,?,?,?)');$s->execute([$uid,$_SESSION['username']??'Unknown',$_SESSION['role']??'',$event,$details]);}
try{
 if($_SERVER['REQUEST_METHOD']==='GET'){
  $list=$pdo->query("SELECT e.*, u.username AS treasurer,
    (SELECT COUNT(*) FROM audit_receipts r WHERE r.expenditure_id=e.id) AS receipt_count,
    (SELECT COALESCE(SUM(receipt_amount),0) FROM audit_receipts r WHERE r.expenditure_id=e.id) AS receipt_total,
    (SELECT decision FROM audit_reviews v WHERE v.expenditure_id=e.id ORDER BY id DESC LIMIT 1) AS decision,
    (SELECT finding FROM audit_reviews v WHERE v.expenditure_id=e.id ORDER BY id DESC LIMIT 1) AS finding
    FROM expenditure_transactions e LEFT JOIN users u ON u.id=e.recorded_by_id ORDER BY e.date_spent DESC,e.id DESC")->fetchAll(PDO::FETCH_ASSOC);
  $receipts=$pdo->query('SELECT r.*,u.username AS uploaded_by FROM audit_receipts r LEFT JOIN users u ON u.id=r.uploaded_by_id ORDER BY r.id DESC')->fetchAll(PDO::FETCH_ASSOC);
  $reviews=$pdo->query('SELECT v.*,u.username AS reviewed_by FROM audit_reviews v LEFT JOIN users u ON u.id=v.reviewed_by_id ORDER BY v.id DESC')->fetchAll(PDO::FETCH_ASSOC);
  $advances=$pdo->query('SELECT * FROM cash_advances ORDER BY id DESC')->fetchAll(PDO::FETCH_ASSOC);
  $movements=$pdo->query('SELECT * FROM cash_advance_movements ORDER BY event_date, id')->fetchAll(PDO::FETCH_ASSOC);
  echo json_encode(['status'=>'success','expenditures'=>$list,'receipts'=>$receipts,'reviews'=>$reviews,'advances'=>$advances,'movements'=>$movements]);exit;
 }
 if($_SERVER['REQUEST_METHOD']!=='POST')ar_fail('Unsupported HTTP method.',405);
 if($role!=='auditor')ar_fail('Only an Auditor can upload receipts or issue audit findings.',403);
 if(empty($_SESSION['csrf_finance_audit']) || !hash_equals($_SESSION['csrf_finance_audit'], $_POST['csrf']??'')) ar_fail('Request expired. Refresh the page and try again.',403);
 $action=$_POST['action']??'';
 if($action==='upload_receipt'){
   $eid=(int)($_POST['expenditure_id']??0);$or=ar_string($_POST['or_number']??null,120,true);$date=ar_date($_POST['receipt_date']??null);$amount=ar_amount($_POST['receipt_amount']??null);$merchant=ar_string($_POST['merchant']??'',200);
   $exp=$pdo->prepare('SELECT id,archived_year FROM expenditure_transactions WHERE id=?');$exp->execute([$eid]);$row=$exp->fetch(PDO::FETCH_ASSOC);if(!$row)ar_fail('Expenditure record not found.');// Auditor can add evidence to historical transactions without changing Treasurer amounts.
   if(!isset($_FILES['receipt'])||$_FILES['receipt']['error']!==UPLOAD_ERR_OK)ar_fail('Choose an image or PDF receipt.');
   $file=$_FILES['receipt'];if($file['size']<=0||$file['size']>8*1024*1024)ar_fail('Receipt must be 8 MB or smaller.');
   $mime=(new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
   $supported=['application/pdf'=>'pdf','image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp'];
   if(!isset($supported[$mime]))ar_fail('Receipts must be PDF, JPEG, PNG or WebP.');
   $base=__DIR__.'/storage/audit_receipts';if(!is_dir($base)&&!mkdir($base,0700,true))ar_fail('Receipt storage is not writable.',500);
   // Deny direct web access: downloads go through authenticated audit_file.php only.
   $storageParent=__DIR__.'/storage';
   foreach([$storageParent,$base] as $folder){$deny=$folder.'/.htaccess';if(!file_exists($deny))file_put_contents($deny,"Require all denied\n");}
   $stored=bin2hex(random_bytes(20)).'.'.$supported[$mime];$dest=$base.'/'.$stored;
   if(!move_uploaded_file($file['tmp_name'],$dest))ar_fail('Failed to store receipt. Check folder permissions.',500);
   $original=basename($file['name']);$original=substr(preg_replace('/[\x00-\x1F\x7F]/','',$original),0,255);
   try{$pdo->beginTransaction();
     $lock=$pdo->prepare('SELECT id FROM expenditure_transactions WHERE id=? FOR UPDATE');$lock->execute([$eid]);if(!$lock->fetchColumn())throw new RuntimeException('Expenditure no longer exists.');
     $stmt=$pdo->prepare('INSERT INTO audit_receipts(expenditure_id,or_number,receipt_date,receipt_amount,merchant,original_filename,stored_filename,mime_type,uploaded_by_id) VALUES(?,?,?,?,?,?,?,?,?)');
     $stmt->execute([$eid,$or,$date,$amount,$merchant?:null,$original,$stored,$mime,$uid]);$rid=(int)$pdo->lastInsertId();
     // A new OR changes the evidence set; any previous verification needs a fresh review.
     $prior=$pdo->prepare('SELECT id FROM audit_reviews WHERE expenditure_id=? LIMIT 1');$prior->execute([$eid]);
     if($prior->fetchColumn()){
         $invalidate=$pdo->prepare("INSERT INTO audit_reviews (expenditure_id,decision,finding,reviewed_by_id) VALUES (?, 'clarification', ?, ?)");
         $invalidate->execute([$eid,'New receipt uploaded: review evidence again before verification.',$uid]);
     }
     ar_log($pdo,$uid,'Receipt Uploaded',"Receipt #$rid, OR $or linked to EXP-$eid, PHP $amount");
     $pdo->commit();echo json_encode(['status'=>'success','id'=>$rid]);exit;
   }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();@unlink($dest);throw $e;}
 }
 if($action==='review'){
   $eid=(int)($_POST['expenditure_id']??0);$decision=$_POST['decision']??'';
   if(!in_array($decision,['verified','discrepancy','clarification'],true))ar_fail('Invalid review decision.');
   $finding=ar_string($_POST['finding']??'',1000);
   if($decision!=='verified'&&$finding==='')ar_fail('Explain the discrepancy or clarification needed.');
   $pdo->beginTransaction();
   $exp=$pdo->prepare('SELECT id,amount,archived_year FROM expenditure_transactions WHERE id=? FOR UPDATE');$exp->execute([$eid]);$row=$exp->fetch(PDO::FETCH_ASSOC);
   if(!$row)ar_fail('Expenditure not found.',404);// Reviewing archived expenditures appends an audit opinion; financial data remains frozen.
   $stmt=$pdo->prepare('SELECT COUNT(*) AS qty, COALESCE(SUM(receipt_amount),0) AS amount FROM audit_receipts WHERE expenditure_id=?');$stmt->execute([$eid]);$tot=$stmt->fetch(PDO::FETCH_ASSOC);
   if($decision==='verified'&&((int)$tot['qty']===0||abs((float)$tot['amount']-(float)$row['amount'])>0.009))ar_fail('Cannot verify: a receipt is missing or receipt totals do not match the expenditure. Flag a discrepancy or request clarification instead.');
   $stmt=$pdo->prepare('INSERT INTO audit_reviews(expenditure_id,decision,finding,reviewed_by_id) VALUES(?,?,?,?)');$stmt->execute([$eid,$decision,$finding?:null,$uid]);$rid=(int)$pdo->lastInsertId();
   ar_log($pdo,$uid,'Expenditure Audit Review',"EXP-$eid | $decision | review #$rid");
   $pdo->commit();echo json_encode(['status'=>'success','id'=>$rid]);exit;
 }
 ar_fail('Unknown audit action.');
}catch(PDOException $e){if($pdo->inTransaction())$pdo->rollBack();error_log('Audit DB: '.$e->getMessage());if($e->getCode()==='23000')ar_fail('That OR number is already attached to this expenditure.',409);ar_fail('Database error. Confirm the SQL migration was imported.',500);
}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();error_log('Audit: '.$e->getMessage());ar_fail('Audit request failed. See PHP error log.',500);}
