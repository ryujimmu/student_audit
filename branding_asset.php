<?php
session_start();
if(empty($_SESSION['user_id'])){http_response_code(401);exit;}
$name=$_GET['asset']??'';
if(!is_string($name)||!preg_match('/^[a-f0-9]{32}\.(png|jpg|webp)$/D',$name)){http_response_code(404);exit;}
$path=__DIR__.'/uploads/branding/'.$name;
if(!is_file($path)){http_response_code(404);exit;}
$type=['png'=>'image/png','jpg'=>'image/jpeg','webp'=>'image/webp'][pathinfo($name,PATHINFO_EXTENSION)];
header('Content-Type: '.$type);header('X-Content-Type-Options: nosniff');header("Content-Security-Policy: default-src 'none'");
header('Cache-Control: private, max-age=86400');header('Content-Length: '.filesize($path));
session_write_close();readfile($path);
