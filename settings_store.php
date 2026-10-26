<?php
function ws_defaults(): array {
    return ['system_name'=>'NISU AUDIT','organization_name'=>'College of Information and Computing Studies','primary_file'=>null,'secondary_file'=>null];
}
function ws_raw(PDO $pdo,string $key): string {
    $q=$pdo->prepare('SELECT setting_value FROM system_settings WHERE setting_key=?');$q->execute([$key]);return (string)($q->fetchColumn()?:'');
}
function ws_branding(PDO $pdo): array {
    $raw=ws_raw($pdo,'workspace_branding');$saved=json_decode($raw,true);
    $brand=ws_defaults();if(is_array($saved))foreach($brand as $key=>$value)if(array_key_exists($key,$saved))$brand[$key]=$saved[$key];
    foreach(['primary','secondary'] as $kind){
        $file=$brand[$kind.'_file'];
        $brand[$kind.'_logo']=is_string($file)&&preg_match('/^[a-f0-9]{32}\.(png|jpg|webp)$/D',$file)
            ? 'branding_asset.php?asset='.$file : ($kind==='primary'?'nisu_logo.png':'cics_logo.png');
        unset($brand[$kind.'_file']);
    }
    $brand['revision']=hash('sha256',$raw);return $brand;
}
function ws_payload(PDO $pdo): array {
    $theme=ws_raw($pdo,'user_theme_'.(int)$_SESSION['user_id']);
    if(!in_array($theme,['light','dark','system'],true))$theme='light';
    return ['status'=>'success','branding'=>ws_branding($pdo),'theme'=>$theme,
        'notifications'=>ws_notifications($pdo,(int)$_SESSION['user_id']),
        'signatories'=>ws_signatories($pdo),
        'user_id'=>(int)$_SESSION['user_id'],'role'=>$_SESSION['role']??'auditor','csrf'=>$_SESSION['app_csrf']];
}
function ws_notifications(PDO $pdo,int $userId): array {
    $prefs=['messages'=>true,'system'=>true,'password_reset'=>true,'sound'=>false];
    $saved=json_decode(ws_raw($pdo,'user_notifications_'.$userId),true);
    if(is_array($saved))foreach($prefs as $key=>$value)if(isset($saved[$key])&&is_bool($saved[$key]))$prefs[$key]=$saved[$key];
    return $prefs;
}
function ws_signatories(PDO $pdo): array {
    $raw=ws_raw($pdo,'report_signatories');$saved=json_decode($raw,true);$roles=[];
    foreach(['prepared','certified','noted','approved'] as $key)$roles[$key]=[
        'name'=>is_string($saved[$key]['name']??null)?$saved[$key]['name']:'',
        'position'=>is_string($saved[$key]['position']??null)?$saved[$key]['position']:''
    ];
    $preparedByRole=[];
    foreach(['admin'=>'Organization President','treasurer'=>'Organization Treasurer','auditor'=>'Organization Auditor'] as $role=>$title){
        $entry=$saved['_prepared_by_role'][$role]??[];
        $preparedByRole[$role]=[
            'name'=>is_string($entry['name']??null)?$entry['name']:$roles['prepared']['name'],
            'position'=>is_string($entry['position']??null)?$entry['position']:$title
        ];
    }
    if ($preparedByRole['admin']['position'] === 'Organization Administrator') $preparedByRole['admin']['position'] = 'Organization President';
    return ['roles'=>$roles,'prepared_by_role'=>$preparedByRole,'revision'=>hash('sha256',$raw)];
}
function ws_optional_text($value,int $limit,string $label): string {
    if(is_string($value)&&trim($value)==='')return '';
    return ws_name($value,$limit,$label);
}
function ws_name($value,int $limit,string $label): string {
    if(!is_string($value)||trim($value)===''||!preg_match('//u',$value)||preg_match('/[\x00-\x1F\x7F]/u',$value)||preg_match_all('/./us',trim($value))>$limit)throw new InvalidArgumentException($label.' is required and must be at most '.$limit.' characters.');
    return trim($value);
}
function ws_logo(string $field,array &$created): ?string {
    if(!isset($_FILES[$field])||($_FILES[$field]['error']??UPLOAD_ERR_NO_FILE)===UPLOAD_ERR_NO_FILE)return null;
    $file=$_FILES[$field];
    if(($file['error']??1)!==UPLOAD_ERR_OK||($file['size']??0)>2*1024*1024||!is_uploaded_file($file['tmp_name']))throw new InvalidArgumentException('Choose an image up to 2 MB.');
    $mime=(new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
    $allowed=['image/png'=>'png','image/jpeg'=>'jpg','image/webp'=>'webp'];
    $size=@getimagesize($file['tmp_name']);
    if(!isset($allowed[$mime])||!$size||$size[0]<1||$size[1]<1||$size[0]>4096||$size[1]>4096)throw new InvalidArgumentException('Use a PNG, JPG or WebP image, at most 4096 × 4096 pixels.');
    $folder=__DIR__.'/uploads/branding';
    if(!is_dir($folder)&&!mkdir($folder,0755,true)&&!is_dir($folder))throw new RuntimeException('Could not create the branding image folder.');
    $name=bin2hex(random_bytes(16)).'.'.$allowed[$mime];$path=$folder.'/'.$name;
    if(!move_uploaded_file($file['tmp_name'],$path))throw new RuntimeException('Could not save the logo image.');
    $created[]=$path;return $name;
}
