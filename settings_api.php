<?php
session_start();
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');
function ws_fail(string $message,int $code): void {http_response_code($code);echo json_encode(['status'=>'error','message'=>$message]);exit;}
if(empty($_SESSION['user_id'])||!in_array($_SESSION['role']??'',['admin','treasurer','auditor'],true))ws_fail('Please sign in again.',401);
if(empty($_SESSION['app_csrf']))$_SESSION['app_csrf']=bin2hex(random_bytes(32));
require_once __DIR__.'/request_guard.php';require_once __DIR__.'/db.php';require_once __DIR__.'/settings_store.php';
$method=$_SERVER['REQUEST_METHOD']??'GET';$created=[];
try{
    if($method==='GET'){echo json_encode(ws_payload($pdo),JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);exit;}
    if($method!=='POST')ws_fail('Method not allowed.',405);
    $input=strpos($_SERVER['CONTENT_TYPE']??'','application/json')!==false?json_decode(file_get_contents('php://input'),true):$_POST;
    if(!is_array($input))throw new InvalidArgumentException('Invalid settings request.');
    $action=$input['action']??'';
    if($action==='theme'){
        $theme=$input['theme']??'';
        if(!in_array($theme,['light','dark','system'],true))throw new InvalidArgumentException('Choose Light, Dark or Match device.');
        $pdo->prepare('INSERT INTO system_settings(setting_key,setting_value) VALUES(?,?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)')->execute(['user_theme_'.(int)$_SESSION['user_id'],$theme]);
    }elseif($action==='notifications'){
        $prefs=[];
        foreach(['messages','system','password_reset','sound'] as $key){
            $value=$input[$key]??null;
            if(!in_array($value,['0','1',false,true,0,1],true))throw new InvalidArgumentException('Invalid notification preference.');
            $prefs[$key]=in_array($value,['1',true,1],true);
        }
        $pdo->prepare('INSERT INTO system_settings(setting_key,setting_value) VALUES(?,?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)')->execute(['user_notifications_'.(int)$_SESSION['user_id'],json_encode($prefs,JSON_THROW_ON_ERROR)]);
    }elseif($action==='signatories'){
        if($_SESSION['role']!=='admin')ws_fail('Only Admin can change default report signatories.',403);
        $roles=[];
        foreach(['prepared','certified','noted','approved'] as $key)$roles[$key]=[
            'name'=>ws_optional_text($input[$key.'_name']??'',150,'Signatory name'),
            'position'=>ws_optional_text($input[$key.'_position']??'',100,'Position')
        ];
        $revision=$input['revision']??'';if(!is_string($revision))throw new InvalidArgumentException('Reload Settings before saving.');
        $pdo->beginTransaction();
        $pdo->prepare("INSERT INTO system_settings(setting_key,setting_value) VALUES('report_signatories','') ON DUPLICATE KEY UPDATE setting_key=VALUES(setting_key)")->execute();
        $raw=(string)$pdo->query("SELECT setting_value FROM system_settings WHERE setting_key='report_signatories' FOR UPDATE")->fetchColumn();
        if(!hash_equals(hash('sha256',$raw),$revision))throw new DomainException('Default signatories changed in another session. Reload Settings before saving.');
        $previous=json_decode($raw,true)?:[];
        if(!array_key_exists('prepared_name',$input))$roles['prepared']=$previous['prepared']??['name'=>'','position'=>''];
        $roleDefaults=is_array($previous['_prepared_by_role']??null)?$previous['_prepared_by_role']:[];
        foreach(['admin','treasurer','auditor'] as $reportRole){
            $prefix='prepared_'.$reportRole;
            if(array_key_exists($prefix.'_name',$input)||array_key_exists($prefix.'_position',$input)){
                $roleDefaults[$reportRole]=[
                    'name'=>ws_optional_text($input[$prefix.'_name']??'',150,'Preparer name'),
                    'position'=>ws_optional_text($input[$prefix.'_position']??'',100,'Preparer position')
                ];
            }
        }
        $roles['_prepared_by_role']=$roleDefaults;
        $pdo->prepare("UPDATE system_settings SET setting_value=? WHERE setting_key='report_signatories'")->execute([json_encode($roles,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]);
        $pdo->prepare("INSERT INTO user_logs(user_id,username,role,action,details) VALUES(?,?,'admin','Report Signatories Updated',?)")->execute([$_SESSION['user_id'],$_SESSION['username']??'Admin','Default names and positions updated.']);
        $pdo->commit();
    }elseif($action==='branding'){
        if($_SESSION['role']!=='admin')ws_fail('Only Admin can change the names and logos.',403);
        $system=ws_name($input['system_name']??null,60,'System name');$org=ws_name($input['organization_name']??null,160,'Organization name');
        $revision=$input['revision']??'';if(!is_string($revision))throw new InvalidArgumentException('Reload Settings before saving.');
        $primary=ws_logo('primary_logo',$created);$secondary=ws_logo('secondary_logo',$created);
        $pdo->beginTransaction();
        $pdo->prepare("INSERT INTO system_settings(setting_key,setting_value) VALUES('workspace_branding','') ON DUPLICATE KEY UPDATE setting_key=VALUES(setting_key)")->execute();
        $q=$pdo->query("SELECT setting_value FROM system_settings WHERE setting_key='workspace_branding' FOR UPDATE");$raw=(string)$q->fetchColumn();
        if(!hash_equals(hash('sha256',$raw),$revision))throw new DomainException('Branding changed in another session. Reload Settings before saving your changes.');
        $brand=array_merge(ws_defaults(),json_decode($raw,true)?:[]);$brand['system_name']=$system;$brand['organization_name']=$org;
        foreach(['primary','secondary'] as $kind){
            if(($input['reset_'.$kind]??'')==='1')$brand[$kind.'_file']=null;
            $upload=$kind==='primary'?$primary:$secondary;if($upload!==null)$brand[$kind.'_file']=$upload;
        }
        $json=json_encode($brand,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
        $pdo->prepare("UPDATE system_settings SET setting_value=? WHERE setting_key='workspace_branding'")->execute([$json]);
        $pdo->prepare("INSERT INTO user_logs(user_id,username,role,action,details) VALUES(?,?,'admin','Workspace Branding Updated',?)")->execute([$_SESSION['user_id'],$_SESSION['username']??'Admin','System: '.$system.' | Organization: '.$org]);
        $pdo->commit();$created=[];
    }else throw new InvalidArgumentException('Unknown settings action.');
    echo json_encode(ws_payload($pdo),JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
}catch(Throwable $e){
    if($pdo->inTransaction())$pdo->rollBack();foreach($created as $path)if(is_file($path))unlink($path);
    $known=$e instanceof InvalidArgumentException||$e instanceof DomainException;
    if(!$known)error_log('Workspace settings: '.$e->getMessage());
    ws_fail($known?$e->getMessage():'Could not save settings. Please try again.',$e instanceof DomainException?409:($known?400:500));
}
