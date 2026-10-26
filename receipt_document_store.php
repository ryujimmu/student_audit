<?php
// Shared receipt-document storage. Does not start sessions or grant access.
function rd_text($value, int $max, bool $required=false): string {
    if (!is_string($value)) throw new InvalidArgumentException('Invalid text field.');
    $s=trim($value);
    if (($required && $s==='') || strlen($s)>$max) throw new InvalidArgumentException('A required field is blank or too long.');
    return $s;
}
function rd_log(PDO $pdo,string $action,string $details): void {
    $q=$pdo->prepare('INSERT INTO user_logs(user_id,username,role,action,details) VALUES(?,?,?,?,?)');
    $q->execute([$_SESSION['user_id'],$_SESSION['username']??'Auditor',$_SESSION['role']??'', $action,$details]);
}
function rd_store(array $file): array {
    if (($file['error']??UPLOAD_ERR_NO_FILE)!==UPLOAD_ERR_OK) throw new InvalidArgumentException('Choose a file and wait for the upload to finish.');
    if (($file['size']??0)<=0 || $file['size']>8*1024*1024) throw new InvalidArgumentException('Files must be 8 MB or smaller.');
    $ext=strtolower(pathinfo($file['name'],PATHINFO_EXTENSION));
    $types=['jpg'=>['image/jpeg'],'jpeg'=>['image/jpeg'],'png'=>['image/png'],'webp'=>['image/webp'],'gif'=>['image/gif'],'pdf'=>['application/pdf'],'txt'=>['text/plain'],'csv'=>['text/plain','text/csv'],'doc'=>['application/msword','application/x-ole-storage','application/CDFV2'],'xls'=>['application/vnd.ms-excel','application/x-ole-storage','application/CDFV2'],'docx'=>['application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/zip'],'xlsx'=>['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/zip']];
    $mime=(new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
    if (!isset($types[$ext]) || !in_array($mime,$types[$ext],true)) throw new InvalidArgumentException('File content does not match an allowed image, PDF or document type.');
    $dir=__DIR__.'/storage/receipt_documents';
    if (!is_dir($dir) && !mkdir($dir,0700,true)) throw new RuntimeException('Cannot create receipt storage.');
    foreach([__DIR__.'/storage',$dir] as $folder){
        if (!is_file($folder.'/.htaccess') && file_put_contents($folder.'/.htaccess',"Require all denied\n")===false) throw new RuntimeException('Cannot protect receipt storage.');
    }
    $relative='storage/receipt_documents/'.bin2hex(random_bytes(20)).'.'.$ext;
    if (!move_uploaded_file($file['tmp_name'],__DIR__.'/'.$relative)) throw new RuntimeException('Cannot store uploaded document.');
    return ['path'=>$relative,'mime'=>$mime,'extension'=>$ext];
}
function rd_insert(PDO $pdo,string $name,string $category,string $path): int {
    $q=$pdo->prepare('INSERT INTO documents(name,category,file_path,uploaded_by_id,uploaded_by,uploaded_by_role) VALUES(?,?,?,?,?,?)');
    $q->execute([$name,$category,$path,$_SESSION['user_id'],$_SESSION['username']??'Auditor',$_SESSION['role']]);
    return (int)$pdo->lastInsertId();
}
function rd_safe_path(string $relative): ?string {
    $file=realpath(__DIR__.'/'.$relative);
    if (!$file || !is_file($file)) return null;
    foreach(['uploads','storage/receipt_documents'] as $folder){
        $root=realpath(__DIR__.'/'.$folder);
        if ($root && strncmp($file,$root.DIRECTORY_SEPARATOR,strlen($root)+1)===0) return $file;
    }
    return null;
}
function rd_list(PDO $pdo): array {
    $rows=$pdo->query('SELECT * FROM documents ORDER BY upload_date DESC,id DESC')->fetchAll(PDO::FETCH_ASSOC);
    foreach($rows as &$row){
        $row['extension']=strtolower(pathinfo($row['file_path'],PATHINFO_EXTENSION));
        $row['file_path']='document_file.php?id='.(int)$row['id'];
    }
    unset($row);return $rows;
}
