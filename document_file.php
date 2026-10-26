<?php
session_start();
if(empty($_SESSION['user_id']) || ($_SESSION['role']??'')!=='auditor'){http_response_code(403);exit('Auditor access required.');}
require_once __DIR__.'/db.php';require_once __DIR__.'/receipt_document_store.php';
$id=filter_input(INPUT_GET,'id',FILTER_VALIDATE_INT);
if(!$id){http_response_code(400);exit('Invalid document.');}
$q=$pdo->prepare('SELECT name,file_path FROM documents WHERE id=?');$q->execute([$id]);$row=$q->fetch(PDO::FETCH_ASSOC);
$path=$row?rd_safe_path($row['file_path']):null;
if(!$path){http_response_code(404);exit('Document file unavailable.');}
$mime=(new finfo(FILEINFO_MIME_TYPE))->file($path);
$inline=in_array($mime,['image/jpeg','image/png','image/webp','image/gif','application/pdf'],true) && !isset($_GET['download']);
$ext=strtolower(pathinfo($path,PATHINFO_EXTENSION));
header('Content-Type: '.($inline?$mime:'application/octet-stream'));header('Content-Length: '.filesize($path));
header('Content-Disposition: '.($inline?'inline':'attachment').'; filename="document-'.(int)$id.'.'.preg_replace('/[^a-z0-9]/','',$ext).'"');
header('X-Content-Type-Options: nosniff');header('Cache-Control: private,no-store');
session_write_close();readfile($path);
