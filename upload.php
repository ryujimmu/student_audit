<?php
session_start();header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');
if(empty($_SESSION['user_id'])){http_response_code(401);echo json_encode(['status'=>'error','message'=>'Sign in first.']);exit;}
$role=$_SESSION['role']??'';
if($role!=='auditor'){http_response_code(403);echo json_encode(['status'=>'error','message'=>'Receipt Documents are available only to the Auditor.']);exit;}
require_once __DIR__.'/db.php';require_once __DIR__.'/receipt_document_store.php';
$stored=null;$commitAttempted=false;
try{
 $method=$_SERVER['REQUEST_METHOD'];
 if($method==='GET'){echo json_encode(rd_list($pdo));exit;}
 $in=$method==='DELETE'?json_decode(file_get_contents('php://input'),true):$_POST;
 if(empty($_SESSION['receipt_documents_csrf']) || !is_array($in) || !is_string($in['csrf']??null) || !hash_equals($_SESSION['receipt_documents_csrf'],$in['csrf'])){http_response_code(403);echo json_encode(['status'=>'error','message'=>'Refresh the page before changing documents.']);exit;}
 if($method==='POST'){
  $name=rd_text($in['name']??'',200,true);$category=rd_text($in['category']??'Receipts',200);
  // New document categories must come from the expenditure/item-description list.
  $layoutQuery=$pdo->query("SELECT setting_value FROM system_settings WHERE setting_key='ui_layout'");
  $layout=json_decode($layoutQuery->fetchColumn()?:'{}',true)?:[];
  $allowed=[];
  foreach(($layout['expenditures']??[]) as $item){
   if(in_array($item['type']??'',['toggle','out'],true))$allowed[]=trim((string)($item['name']??''));
  }
  if($category==='' || !in_array($category,$allowed,true))throw new InvalidArgumentException('Select a current item description. Programs, years and sections cannot be upload categories.');
  $stored=rd_store($_FILES['file']??[]);
  $pdo->beginTransaction();$id=rd_insert($pdo,$name,$category,$stored['path']);rd_log($pdo,'Document Uploaded','Document #'.$id.' | '.$name);$commitAttempted=true;$pdo->commit();
  $stored=null;echo json_encode(['status'=>'success','id'=>$id]);exit;
 }
 if($method==='DELETE'){
  $id=filter_var($in['id']??null,FILTER_VALIDATE_INT);if(!$id)throw new InvalidArgumentException('Select a document.');
  $pdo->beginTransaction();
  // Match the register's lock order and retain financial rows when removing an attachment.
  $q=$pdo->prepare('SELECT id,audit_status FROM auditor_receipt_entries WHERE document_id=? FOR UPDATE');$q->execute([$id]);$linked=$q->fetchAll(PDO::FETCH_ASSOC);
  $q=$pdo->prepare('SELECT * FROM documents WHERE id=? FOR UPDATE');$q->execute([$id]);$doc=$q->fetch(PDO::FETCH_ASSOC);
  if(!$doc)throw new InvalidArgumentException('Document not found.');
  $pdo->prepare("UPDATE auditor_receipt_entries SET document_id=NULL,audit_status=CASE WHEN audit_status='checked' THEN 'pending' ELSE audit_status END WHERE document_id=?")->execute([$id]);
  $pdo->prepare('DELETE FROM documents WHERE id=?')->execute([$id]);
  rd_log($pdo,'Document Deleted','Document #'.$id.' | '.$doc['name'].' | uploaded by '.($doc['uploaded_by']??'Unknown').' | detached audit rows: '.json_encode($linked,JSON_UNESCAPED_UNICODE));
  $q=$pdo->prepare('SELECT COUNT(*) FROM documents WHERE file_path=?');$q->execute([$doc['file_path']]);$sharedPath=(int)$q->fetchColumn()>0;
  $pdo->commit();
  if(!$sharedPath){$path=rd_safe_path($doc['file_path']);if($path && !@unlink($path))error_log('Unlinked document file remains: '.$id);}
  echo json_encode(['status'=>'success']);exit;
 }
 http_response_code(405);echo json_encode(['status'=>'error','message'=>'Method not allowed.']);
}catch(Throwable $e){
 $rolledBack=false;if($pdo->inTransaction()){$pdo->rollBack();$rolledBack=true;}
 if($stored && ($rolledBack || !$commitAttempted)){$path=rd_safe_path($stored['path']);if($path)unlink($path);}
 $known=$e instanceof InvalidArgumentException||$e instanceof DomainException;
 http_response_code($e instanceof DomainException?403:($known?400:500));error_log('Receipt Documents: '.$e->getMessage());
 echo json_encode(['status'=>'error','message'=>$known?$e->getMessage():'Could not save documents. Check storage permissions and import the audit register SQL.']);
}
