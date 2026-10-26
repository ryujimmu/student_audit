<?php
session_start();
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');
$role=$_SESSION['role']??'';
if(empty($_SESSION['user_id']) || $role!=='admin'){http_response_code(403);echo json_encode(['status'=>'error','message'=>'Recovered Years is available to Admin only.']);exit;}
require_once __DIR__.'/request_guard.php';
require_once __DIR__.'/db.php';
require_once __DIR__.'/recovery_store.php';
try{
 $method=$_SERVER['REQUEST_METHOD']??'GET';
 if($method==='GET'){
  if(($_GET['action']??'')==='list'){
   echo ry_json(['status'=>'success','years'=>ry_rows($pdo,'SELECT school_year,revision,recovered_by,recovered_at,updated_at FROM recovered_school_years ORDER BY school_year DESC')]);exit;
  }
  $year=ry_year($_GET['year']??'');
  $q=$pdo->prepare('SELECT * FROM recovered_school_years WHERE school_year=?');$q->execute([$year]);$row=$q->fetch(PDO::FETCH_ASSOC);
  if(!$row){http_response_code(404);echo ry_json(['status'=>'error','message'=>'Admin must recover this school year first.']);exit;}
  $data=ry_visible(ry_decode($row['working_data']),$role);
  $activity=ry_rows($pdo,'SELECT id,username,actor_role,action,details,recorded_at FROM recovered_year_activity WHERE school_year=? ORDER BY id DESC LIMIT 50',[$year]);
  foreach($activity as &$event){$detail=ry_decode($event['details']);$event['summary']=$detail['reason']??$detail['label']??$detail['source']??'Setup and allocations updated.';unset($event['details']);}unset($event);
  echo ry_json(['status'=>'success','year'=>$year,'revision'=>(int)$row['revision'],'data'=>$data,'activity'=>$activity,'recovered_by'=>$row['recovered_by'],'recovered_at'=>$row['recovered_at']]);exit;
 }
 if($method!=='POST'){http_response_code(405);echo ry_json(['status'=>'error','message'=>'POST required.']);exit;}
 $raw=file_get_contents('php://input');if(strlen($raw)>2000000)throw new InvalidArgumentException('The update is too large.');
 $in=json_decode($raw,true,512,JSON_THROW_ON_ERROR);if(!is_array($in))throw new InvalidArgumentException('Invalid request.');
 $year=ry_year($in['year']??'');$action=$in['action']??'';
 if($action==='recover'){
  if($role!=='admin'){http_response_code(403);echo ry_json(['status'=>'error','message'=>'Only Admin can recover a school year.']);exit;}
  $pdo->beginTransaction();
  $q=$pdo->prepare('SELECT school_year FROM recovered_school_years WHERE school_year=? FOR UPDATE');$q->execute([$year]);
  if($q->fetchColumn()){$pdo->commit();echo ry_json(['status'=>'success','already_recovered'=>true,'year'=>$year]);exit;}
  $source=ry_archive_source($pdo,$year);$working=ry_working_data($source);
  $q=$pdo->prepare('INSERT INTO recovered_school_years(school_year,source_snapshot,working_data,recovered_by) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE school_year=VALUES(school_year)');
  $q->execute([$year,ry_json($source),ry_json($working),$_SESSION['username']??'Admin']);
  ry_log($pdo,$year,'School Year Recovered',['source'=>'Separate copy of archived records; current-year tables unchanged.']);
  $pdo->commit();echo ry_json(['status'=>'success','year'=>$year]);exit;
 }
 $setupActions=['save_setup','add_section','add_item','add_category'];
 if(in_array($action,$setupActions,true) && $role!=='admin'){http_response_code(403);echo ry_json(['status'=>'error','message'=>'Only Admin can manage recovered-year setup and budgets.']);exit;}
 if($action==='save_financials' && $role!=='treasurer'){http_response_code(403);echo ry_json(['status'=>'error','message'=>'Only Treasurer can change recovered-year collections and spending.']);exit;}
 if(!in_array($action,array_merge($setupActions,['save_financials']),true))throw new InvalidArgumentException('Unknown recovery action.');
 $pdo->beginTransaction();
 $q=$pdo->prepare('SELECT working_data,revision FROM recovered_school_years WHERE school_year=? FOR UPDATE');$q->execute([$year]);$row=$q->fetch(PDO::FETCH_ASSOC);
 if(!$row)throw new DomainException('The recovered school year is unavailable.');
 if(!isset($in['revision']) || (string)$in['revision']!==(string)$row['revision'])throw new DomainException('This recovered year changed in another session. Copy your edits, reload, and reapply them.');
 $data=ry_decode($row['working_data']);$before=$data;
 if($action==='save_financials'){
  $reason=ry_text($in['reason']??'',500);
  foreach(['collections','expenditures'] as $type){
   $updates=$in[$type]??null;if(!is_array($updates) || count($updates)!==count($data[$type]))throw new InvalidArgumentException('The financial row list changed. Reload the year.');
   $map=[];foreach($updates as $update){$key=ry_text($update['key']??'',150);if(isset($map[$key]))throw new InvalidArgumentException('Duplicate financial row.');$map[$key]=$update;}
   foreach($data[$type] as &$item){
    if(!isset($map[$item['key']]))throw new InvalidArgumentException('A financial row is missing.');$update=$map[$item['key']];
    if($type==='collections'){
     $amounts=$update['amounts']??null;if(!is_array($amounts))throw new InvalidArgumentException('Invalid fee amounts.');
     $allowed=array_map('strval',array_column($data['categories'],'id'));
     foreach($amounts as $id=>$amount){if(!in_array((string)$id,$allowed,true))throw new InvalidArgumentException('Unknown fee category.');}
     $clean=[];foreach($allowed as $id)$clean[$id]=ry_money($amounts[$id]??($item['amounts'][$id]??'0'));
     $item['amounts']=(object)$clean;
    }else $item['amount']=ry_money($update['amount']??null);
   }unset($item);
  }
  $detail=['reason'=>$reason,'before'=>['collections'=>$before['collections'],'expenditures'=>$before['expenditures']],'after'=>['collections'=>$data['collections'],'expenditures'=>$data['expenditures']]];
 }elseif($action==='save_setup'){
  $cats=$in['categories']??null;$subs=$in['subcategories']??[];
  if(!is_array($cats)||count($cats)!==count($data['categories'])||!is_array($subs))throw new InvalidArgumentException('Invalid categories. Reload the year.');
  $oldIds=array_map('strval',array_column($data['categories'],'id'));$seen=[];$cleanSubs=[];$cleanCats=[];
  foreach($cats as $cat){
   $id=ry_text($cat['id']??'',100);if(!in_array($id,$oldIds,true)||isset($seen[$id]))throw new InvalidArgumentException('Unknown or repeated category.');$seen[$id]=true;
   $children=$subs[$id]??[];if(!is_array($children)||count($children)>50)throw new InvalidArgumentException('Use at most 50 subcategories.');
   $total=0;$clean=[];
   foreach($children as $child){$amount=ry_money($child['price']??null);$total+=ry_cents($amount);if($total>999999999999)throw new InvalidArgumentException('Category total is too large.');$clean[]=['name'=>ry_text($child['name']??'',200),'price'=>$amount];}
   if($clean)$cleanSubs[$id]=$clean;
   $price=$clean?number_format($total/100,2,'.',''):(($cat['price']??null)===null||$cat['price']===''?null:ry_money($cat['price']));
   $cleanCats[]=['id'=>$id,'name'=>ry_text($cat['name']??'',200),'price'=>$price];
  }
  $data['categories']=$cleanCats;$data['subcategories']=(object)$cleanSubs;
  foreach(['collections','expenditures'] as $type){
   $updates=$in[$type]??null;if(!is_array($updates)||count($updates)!==count($data[$type]))throw new InvalidArgumentException('The setup rows changed. Reload the year.');
   $map=[];foreach($updates as $u){$key=ry_text($u['key']??'',150);if(isset($map[$key]))throw new InvalidArgumentException('Duplicate setup row.');$map[$key]=$u;}
   foreach($data[$type] as &$item){
    if(!isset($map[$item['key']]))throw new InvalidArgumentException('A setup row is missing.');$u=$map[$item['key']];$item['label']=ry_text($u['label']??'',600);
    if($type==='collections'){
     $count=$u['students']??null;
     if($count!==null && filter_var($count,FILTER_VALIDATE_INT,['options'=>['min_range'=>0,'max_range'=>100000]])===false)throw new InvalidArgumentException('Use a valid student count, or leave unknown counts blank.');
     $item['students']=$count===null?null:(int)$count;
    }else $item['budget']=ry_money($u['budget']??null);
   }unset($item);
  }
  $detail=['before'=>['categories'=>$before['categories'],'subcategories'=>$before['subcategories']??[],'collections'=>$before['collections'],'expenditures'=>$before['expenditures']],'after'=>['categories'=>$data['categories'],'subcategories'=>$data['subcategories'],'collections'=>$data['collections'],'expenditures'=>$data['expenditures']]];
 }else{
  $label=ry_text($in['label']??'',300);$id='rec_'.bin2hex(random_bytes(12));
  if($action==='add_section')$data['collections'][]=['key'=>$id,'label'=>$label,'students'=>0,'amounts'=>(object)[],'remarks'=>''];
  elseif($action==='add_item')$data['expenditures'][]=['key'=>$id,'label'=>$label,'amount'=>'0.00','budget'=>'0.00','remarks'=>''];
  else $data['categories'][]=['id'=>$id,'name'=>$label,'price'=>'0.00'];
  $detail=['added_key'=>$id,'label'=>$label];
 }
 if(count($data['collections'])>3000||count($data['expenditures'])>3000||count($data['categories'])>100)throw new InvalidArgumentException('Recovered-year row limit reached.');
 $pdo->prepare('UPDATE recovered_school_years SET working_data=?,revision=revision+1 WHERE school_year=?')->execute([ry_json($data),$year]);
 ry_log($pdo,$year,$action==='save_financials'?'Recovered Financial Figures Updated':($action==='save_setup'?'Recovered Setup Updated':'Recovered Row Added'),$detail);
 $pdo->commit();echo ry_json(['status'=>'success','revision'=>(int)$row['revision']+1]);
}catch(Throwable $e){
 if(isset($pdo)&&$pdo->inTransaction())$pdo->rollBack();
 $known=$e instanceof InvalidArgumentException||$e instanceof DomainException||$e instanceof JsonException;
 $missing=$e instanceof PDOException && $e->getCode()==='42S02';
 http_response_code($e instanceof DomainException?409:($known?400:500));
 error_log('School-year recovery: '.$e->getMessage());
 echo json_encode(['status'=>'error','message'=>$missing?'Import 01_INSTALL_RECOVERY.sql in your system database first.':($known?$e->getMessage():'The recovery request failed. Check the PHP error log. No current-year records were changed.')]);
}
