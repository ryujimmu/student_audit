<?php
session_start();date_default_timezone_set('Asia/Manila');
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');
if(empty($_SESSION['user_id']) || !in_array($_SESSION['role']??'',['auditor','admin'],true)){http_response_code(403);echo json_encode(['status'=>'error','message'=>'Auditor or admin access required.']);exit;}
require_once __DIR__.'/db.php';require_once __DIR__.'/receipt_document_store.php';
function ra_date($value): string {
 $value=rd_text($value,10,true);$d=DateTimeImmutable::createFromFormat('!Y-m-d',$value);
 if(!$d||$d->format('Y-m-d')!==$value||$d>new DateTimeImmutable('today'))throw new InvalidArgumentException('Choose a valid date, today or earlier.');return $value;
}
function ra_amount($value): string {
 if(!is_scalar($value)||!preg_match('/^\d{1,10}(?:\.\d{1,2})?$/D',(string)$value)||(float)$value<=0)throw new InvalidArgumentException('Enter a positive amount with at most two decimals.');return number_format((float)$value,2,'.','');
}
$stored=null;
try{
 $method=$_SERVER['REQUEST_METHOD'];
 if($method==='GET'){
  $rows=$pdo->query('SELECT * FROM auditor_receipt_entries ORDER BY id ASC')->fetchAll(PDO::FETCH_ASSOC);
  foreach($rows as &$r){$r['edit_token']=hash('sha256',json_encode($r,JSON_UNESCAPED_UNICODE));}unset($r);
  echo json_encode(['status'=>'success','entries'=>$rows,'today'=>date('Y-m-d')]);exit;
 }
 if($method!=='POST'){http_response_code(405);echo json_encode(['status'=>'error','message'=>'Method not allowed.']);exit;}
 if(($_SESSION['role']??'')!=='auditor'){http_response_code(403);echo json_encode(['status'=>'error','message'=>'Only the Auditor can record audit working papers.']);exit;}
 if(empty($_SESSION['receipt_documents_csrf'])||!is_string($_POST['csrf']??null)||!hash_equals($_SESSION['receipt_documents_csrf'],$_POST['csrf'])){http_response_code(403);echo json_encode(['status'=>'error','message'=>'Refresh this page before saving.']);exit;}
 $action=$_POST['action']??'';
 if($action==='create_sheet'){
  $event=rd_text($_POST['event_title']??'',200,true);$sheet=rd_text($_POST['sheet_no']??'1',30,true);
  $pdo->beginTransaction();$q=$pdo->prepare('INSERT INTO auditor_receipt_sheets(event_title,sheet_no,created_by_id,created_by,created_at) VALUES(?,?,?,?,?)');
  $q->execute([$event,$sheet,$_SESSION['user_id'],$_SESSION['username']??'Auditor',date('Y-m-d H:i:s')]);$id=$pdo->lastInsertId();rd_log($pdo,'Audit Sheet Created','Sheet #'.$id.' | '.$event.' | '.$sheet);$pdo->commit();echo json_encode(['status'=>'success','id'=>$id]);exit;
 }
 if($action==='void_entry'){
  $id=filter_var($_POST['entry_id']??null,FILTER_VALIDATE_INT);$reason=rd_text($_POST['reason']??'',500,true);
  if(!$id)throw new InvalidArgumentException('Choose an entry to void.');
  $pdo->beginTransaction();$q=$pdo->prepare('SELECT id FROM auditor_receipt_entries WHERE id=? AND voided_at IS NULL FOR UPDATE');$q->execute([$id]);
  if(!$q->fetchColumn())throw new DomainException('Entry not found or already voided.');
  $q=$pdo->prepare('UPDATE auditor_receipt_entries SET voided_at=?,voided_by=?,void_reason=? WHERE id=?');$q->execute([date('Y-m-d H:i:s'),$_SESSION['username']??'Auditor',$reason,$id]);rd_log($pdo,'Audit Entry Voided','Entry #'.$id.' | '.$reason);$pdo->commit();echo json_encode(['status'=>'success']);exit;
 }
 if(!in_array($action,['create_entry','update_entry'],true))throw new InvalidArgumentException('Unknown action.');
 $editing=$action==='update_entry';
 $editId=$editing?filter_var($_POST['entry_id']??null,FILTER_VALIDATE_INT):null;
 if($editing&&!$editId)throw new InvalidArgumentException('Invalid audit entry.');
 $request=rd_text($_POST['request_id']??'',36,true);if(!preg_match('/^[a-f0-9-]{36}$/D',$request))throw new InvalidArgumentException('Invalid save identifier.');
 $sid=filter_var($_POST['sheet_id']??null,FILTER_VALIDATE_INT);if($editing&&!$sid)throw new InvalidArgumentException('Invalid saved entry.');
 $date=ra_date($_POST['entry_date']??'');$type=$_POST['entry_type']??'';
 if(!in_array($type,['advance','refund','disbursement'],true))throw new InvalidArgumentException('Choose advance, refund or disbursement.');
 $amount=ra_amount($_POST['amount']??'');$voucher=rd_text($_POST['voucher_no']??'',100);$or=rd_text($_POST['or_number']??'',120);
 $payee=rd_text($_POST['payee']??'',200,$type==='disbursement');$nature=rd_text($_POST['nature']??'',3000,true);
 $status=$_POST['audit_status']??'pending';if(!in_array($status,['pending','checked','discrepancy'],true))throw new InvalidArgumentException('Invalid audit status.');
 $note=rd_text($_POST['audit_note']??'',1000);if($status==='discrepancy'&&$note==='')throw new InvalidArgumentException('Describe the discrepancy.');
 $docid=null;$raw=$_POST['document_id']??'';
 if($raw!==''){$docid=filter_var($raw,FILTER_VALIDATE_INT);if(!$docid)throw new InvalidArgumentException('Invalid supporting document.');}
 if($docid && isset($_FILES['receipt'])&&$_FILES['receipt']['error']!==UPLOAD_ERR_NO_FILE)throw new InvalidArgumentException('Use either an existing receipt or a new upload.');
 $pdo->beginTransaction();
 if(!$sid){
  // Internal compatibility container only; users enter directly into one register.
  $q=$pdo->prepare('INSERT INTO auditor_receipt_sheets(event_title,sheet_no,created_by_id,created_by,created_at) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)');
  $q->execute(['General audit register','direct-entry-v7',$_SESSION['user_id'],$_SESSION['username']??'Auditor',date('Y-m-d H:i:s')]);$sid=(int)$pdo->lastInsertId();
 }
 $q=$pdo->prepare('SELECT id FROM auditor_receipt_sheets WHERE id=? FOR UPDATE');$q->execute([$sid]);if(!$q->fetchColumn())throw new InvalidArgumentException('The saved entry group is unavailable.');
 $previous=null;
 if($editing){
  $q=$pdo->prepare('SELECT * FROM auditor_receipt_entries WHERE id=? AND sheet_id=? AND voided_at IS NULL FOR UPDATE');$q->execute([$editId,$sid]);$previous=$q->fetch(PDO::FETCH_ASSOC);
  if(!$previous)throw new DomainException('This entry is unavailable or voided. Refresh before editing.');
  $q=$pdo->prepare('SELECT setting_value FROM system_settings WHERE setting_key=?');$q->execute(['audit_edit_'.$request]);
  if($q->fetchColumn()){$pdo->rollBack();echo json_encode(['status'=>'success','id'=>$editId,'duplicate'=>true]);exit;}
  if(!is_string($_POST['edit_token']??null)||!hash_equals(hash('sha256',json_encode($previous,JSON_UNESCAPED_UNICODE)),$_POST['edit_token']))throw new DomainException('This row changed in another session. Refresh and reapply your edits.');
  if(!empty($previous['document_id']) && ((int)$docid!==(int)$previous['document_id'] || (isset($_FILES['receipt'])&&$_FILES['receipt']['error']!==UPLOAD_ERR_NO_FILE)))throw new DomainException('Saved receipt evidence is retained. To replace or remove it, void this entry and create a corrected one.');

 }else{
  $q=$pdo->prepare('SELECT id FROM auditor_receipt_entries WHERE request_id=?');$q->execute([$request]);$existing=$q->fetchColumn();
  if($existing){$pdo->rollBack();echo json_encode(['status'=>'success','id'=>$existing,'duplicate'=>true]);exit;}
 }
 if($docid){$q=$pdo->prepare('SELECT id FROM documents WHERE id=? FOR UPDATE');$q->execute([$docid]);if(!$q->fetchColumn())throw new InvalidArgumentException('Supporting document is unavailable.');}
 if(isset($_FILES['receipt'])&&$_FILES['receipt']['error']!==UPLOAD_ERR_NO_FILE){
  $extension=strtolower(pathinfo($_FILES['receipt']['name'],PATHINFO_EXTENSION));
  if(!in_array($extension,['jpg','jpeg','png','gif','webp','pdf'],true))throw new InvalidArgumentException('Attach a receipt image or PDF.');
  $stored=rd_store($_FILES['receipt']);$docid=rd_insert($pdo,'Receipt — '.$payee.' — '.$date,'Receipts',$stored['path']);
 }
 if($type==='disbursement'&&$status==='checked'&&(!$docid||$or===''))throw new InvalidArgumentException('To mark a disbursement checked, attach a receipt and transcribe its OR/receipt number. Otherwise save it as pending.');
 if($editing){
  $q=$pdo->prepare('UPDATE auditor_receipt_entries SET entry_date=?,entry_type=?,voucher_no=?,or_number=?,payee=?,nature=?,amount=?,document_id=?,audit_status=?,audit_note=? WHERE id=? AND sheet_id=? AND voided_at IS NULL');
  $q->execute([$date,$type,$voucher,$or,$payee,$nature,$amount,$docid,$status,$note,$editId,$sid]);
  rd_log($pdo,'Audit Entry Updated','Entry #'.$editId.' | Prior record: '.json_encode($previous,JSON_UNESCAPED_UNICODE));
  $q=$pdo->prepare('INSERT INTO system_settings(setting_key,setting_value) VALUES(?,?)');$q->execute(['audit_edit_'.$request,(string)$editId]);
  $pdo->commit();$stored=null;echo json_encode(['status'=>'success','id'=>$editId]);exit;
 }
 $q=$pdo->prepare('INSERT INTO auditor_receipt_entries(request_id,sheet_id,entry_date,entry_type,voucher_no,or_number,payee,nature,amount,document_id,audit_status,audit_note,created_by_id,created_by,recorded_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
 $q->execute([$request,$sid,$date,$type,$voucher,$or,$payee,$nature,$amount,$docid,$status,$note,$_SESSION['user_id'],$_SESSION['username']??'Auditor',date('Y-m-d H:i:s')]);$id=$pdo->lastInsertId();
 rd_log($pdo,'Audit Receipt Entry','Entry #'.$id.' | sheet #'.$sid.' | '.$type.' | '.$date.' | '.$amount);$pdo->commit();$stored=null;
 echo json_encode(['status'=>'success','id'=>$id]);
}catch(Throwable $e){
 $rolledBack=false;if($pdo->inTransaction()){$pdo->rollBack();$rolledBack=true;}
 // Retain the file if commit outcome is uncertain; do not discard potential evidence.
 if($stored && $rolledBack){$path=rd_safe_path($stored['path']);if($path)unlink($path);}
 error_log('Auditor receipt register: '.$e->getMessage());
 $known=$e instanceof InvalidArgumentException||$e instanceof DomainException;
 $conflict=$e instanceof PDOException && $e->getCode()==='23000';
 http_response_code($conflict?409:($known?400:500));
 echo json_encode(['status'=>'error','message'=>$conflict?'This event/sheet or save identifier already exists. Refresh the list before retrying.':($known?$e->getMessage():'Could not load or save the audit register. Import 01_AUDITOR_RECEIPT_REGISTER.sql and check the PHP error log.')]);
}
