<?php
session_start();
require_once __DIR__.'/db.php';
if(empty($_SESSION['user_id'])||!in_array($_SESSION['role']??'',['admin','auditor'],true)){http_response_code(403);exit('Access denied.');}
$id=filter_input(INPUT_GET,'id',FILTER_VALIDATE_INT);
if(!$id){http_response_code(400);exit('Invalid receipt.');}
$stmt=$pdo->prepare('SELECT stored_filename,original_filename,mime_type FROM audit_receipts WHERE id=?');$stmt->execute([$id]);$r=$stmt->fetch(PDO::FETCH_ASSOC);
if(!$r){http_response_code(404);exit('Receipt unavailable.');}
$path=__DIR__.'/storage/audit_receipts/'.basename($r['stored_filename']);
if(!is_file($path)){http_response_code(404);exit('Receipt file missing.');}
$mime=in_array($r['mime_type'],['image/jpeg','image/png','image/webp','application/pdf'],true)?$r['mime_type']:'application/octet-stream';
header('Content-Type: '.$mime);header('Content-Length: '.filesize($path));header('X-Content-Type-Options: nosniff');header('Cache-Control: private,no-store');
header('Content-Disposition: attachment; filename="receipt-'.(int)$id.'.'.pathinfo($path,PATHINFO_EXTENSION).'"');
readfile($path);
