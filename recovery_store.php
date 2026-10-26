<?php
require_once __DIR__.'/remittance_corrections.php';
// Internal helpers only. No session, routing, or permissions are granted here.
function ry_json($value): string { return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR); }
function ry_decode($value, $fallback = []) {
    if (!is_string($value) || $value === '') return $fallback;
    $decoded = json_decode($value, true, 512, JSON_THROW_ON_ERROR);
    if ($decoded !== null && !is_array($decoded)) throw new DomainException('Saved archive data is not a valid record set.');
    return $decoded ?? $fallback;
}
function ry_year($value): string {
    if (!is_string($value) || !preg_match('/^(\d{4})-(\d{4})$/D', $value, $m) || (int)$m[2] !== (int)$m[1]+1) throw new InvalidArgumentException('Select a valid school year, such as 2025-2026.');
    return $value;
}
function ry_text($value, int $max = 300, bool $required = true): string {
    if (!is_string($value) || !preg_match('//u', $value)) throw new InvalidArgumentException('Invalid text field.');
    $value = trim($value);
    if (($required && $value === '') || strlen($value) > $max || preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', $value)) throw new InvalidArgumentException('A text field is missing or too long.');
    return $value;
}
function ry_cents($value): int {
    if ((!is_string($value) && !is_int($value) && !is_float($value)) || !preg_match('/^\d{1,10}(?:\.\d{1,2})?$/D', (string)$value)) throw new InvalidArgumentException('Amounts must be non-negative, with at most two decimals.');
    $p = explode('.', (string)$value, 2);
    return (int)$p[0]*100 + (int)str_pad($p[1] ?? '', 2, '0');
}
function ry_money($value): string { return number_format(ry_cents($value)/100, 2, '.', ''); }
function ry_historical_money($value): string {
    if (!is_numeric($value) || !is_finite((float)$value) || (float)$value < 0 || (float)$value > 9999999999.99) throw new DomainException('An archived amount is invalid. Review the source record before recovery.');
    return number_format(round((float)$value, 2), 2, '.', '');
}
function ry_rows(PDO $pdo, string $sql, array $params = []): array {
    $q = $pdo->prepare($sql); $q->execute($params); return $q->fetchAll(PDO::FETCH_ASSOC);
}
function ry_optional(PDO $pdo, string $sql, array $params = []): array {
    try { return ry_rows($pdo, $sql, $params); }
    catch (PDOException $e) { if ($e->getCode() !== '42S02') throw $e; return []; }
}
function ry_settings(PDO $pdo): array {
    $q = $pdo->query("SELECT setting_key,setting_value FROM system_settings WHERE setting_key IN ('ui_layout','collection_categories','admin_category_subcategories','expenditure_overall_budget') OR setting_key LIKE 'unpaid_roster_%'");
    return $q->fetchAll(PDO::FETCH_KEY_PAIR);
}
function ry_dated_records(PDO $pdo, array $collections, array $expenses, ?int $cycle = null): array {
    $history = ['collections'=>[], 'expenditures'=>[], 'remittances'=>[]];
    foreach ([['collections',$collections,'collection_transactions','section_key'], ['expenditures',$expenses,'expenditure_transactions','event_item_key']] as [$type,$rows,$table,$column]) {
        $keys = array_values(array_unique(array_column($rows,'item_key')));
        foreach (array_chunk($keys, 300) as $chunk) {
            $marks=implode(',',array_fill(0,count($chunk),'?'));
            $history[$type]=array_merge($history[$type], ry_optional($pdo,"SELECT * FROM $table WHERE $column IN ($marks) ORDER BY id",$chunk));
        }
    }
    if ($cycle !== null) {
        $history['remittances']=ry_optional($pdo,'SELECT * FROM section_remittances WHERE cycle_id=? ORDER BY id',[$cycle]);
        foreach($history['remittances'] as &$remittance) $remittance=rmc_view($pdo,$remittance);
        unset($remittance);
    }
    return $history;
}
function ry_layout_leaves(array $layout, string $branch): array {
    $nodes=$layout[$branch]??[];$byId=[];$leaves=[];$type=$branch==='collections'?'in':'out';
    foreach($nodes as $node){if(isset($node['id']))$byId[$node['id']]=$node;}
    foreach($nodes as $node){
        if(($node['type']??'')!==$type)continue;
        $name=(string)($node['name']??'');$safe=preg_replace('/[^a-z0-9]/','-',strtolower($name));
        $key=empty($node['parent'])?$safe:$node['parent'].'-'.$safe;
        $parts=[$name];$parent=$node['parent']??null;$seen=[];
        while($parent&&isset($byId[$parent])&&!isset($seen[$parent])){$seen[$parent]=true;$item=$byId[$parent];array_unshift($parts,(string)$item['name']);$parent=$item['parent']??null;}
        $leaves[]=['item_key'=>$key,'label'=>implode(' / ',$parts)];
    }
    return $leaves;
}
function ry_capture_current(PDO $pdo, string $year, array $flagged = []): void {
    $settings=ry_settings($pdo);
    $collections=ry_rows($pdo,'SELECT c.*,s.num_students AS snapshot_students FROM collections c LEFT JOIN section_settings s ON s.section_key=c.item_key WHERE c.is_archived=0 ORDER BY c.item_key');
    foreach($collections as &$row){$row['num_students']=(int)($row['snapshot_students']??0);unset($row['snapshot_students']);$row['category_snapshot']=$settings['collection_categories']??'[]';} unset($row);
    $expenses=ry_rows($pdo,'SELECT * FROM expenditures WHERE is_archived=0 ORDER BY item_key');
    $cycle=(int)$pdo->query("SELECT COALESCE(MAX(id),0) FROM user_logs WHERE action='System Reboot'")->fetchColumn();
    $rosters=[];
    $layout=ry_decode($settings['ui_layout']??'{}');
    $sectionCounts=$pdo->query('SELECT section_key,num_students FROM section_settings')->fetchAll(PDO::FETCH_KEY_PAIR);
    $sectionKeys=array_values(array_unique(array_merge(array_column($collections,'item_key'),array_column(ry_layout_leaves($layout,'collections'),'item_key'))));
    foreach($sectionKeys as $sectionKey){foreach(ry_decode($settings['collection_categories']??'[]') as $cat){
        $key='unpaid_roster_'.hash('sha256',json_encode([$cycle,$sectionKey,(string)$cat['id']]));
        $shortKey=substr($key,0,46);
        $rosterKey=array_key_exists($shortKey,$settings)?$shortKey:$key;
        if(isset($settings[$rosterKey]))$rosters[]=['item_key'=>$sectionKey,'category_key'=>(string)$cat['id'],'category_name'=>$cat['name'],'names'=>ry_decode($settings[$rosterKey])['names']??[],'entries'=>ry_decode($settings[$rosterKey])['entries']??null];
    }}
    $overallBudget=ry_decode($settings['expenditure_overall_budget']??'{}');
    $snapshot=['overall_budget'=>(int)($overallBudget['cycle']??-1)===$cycle?(float)($overallBudget['amount']??0):0,'schema'=>1,'school_year'=>$year,'collections'=>$collections,'expenditures'=>$expenses,
        'budgets'=>ry_rows($pdo,'SELECT * FROM budgets WHERE is_archived=0 ORDER BY item_key'),
        'structure'=>$layout,'section_counts'=>$sectionCounts,'categories'=>ry_decode($settings['collection_categories']??'[]'),
        'subcategories'=>ry_decode($settings['admin_category_subcategories']??'{}'),'category_unpaid_lists'=>$rosters,
        'unpaid_reviewed'=>true,'unpaid_students'=>$flagged,'late_payments'=>[],
        'history'=>ry_dated_records($pdo,$collections,$expenses,$cycle),'limitations'=>[]];
    $q=$pdo->prepare('INSERT INTO school_year_snapshots(school_year,snapshot_json,captured_by) VALUES(?,?,?)');
    $q->execute([$year,ry_json($snapshot),$_SESSION['username']??'Admin']);
}
function ry_archive_source(PDO $pdo, string $year): array {
    $q=$pdo->prepare('SELECT snapshot_json FROM school_year_snapshots WHERE school_year=?');$q->execute([$year]);
    $raw=$q->fetchColumn();$source=$raw?ry_decode($raw):['schema'=>1,'school_year'=>$year,'structure'=>[], 'subcategories'=>[], 'category_unpaid_lists'=>[], 'limitations'=>['This older archive has no saved layout or Admin subcategory snapshot. Its available financial records are recovered below.']];
    // Include late payments and flags recorded since the year closed, without changing the source archive.
    foreach(['collections','expenditures','budgets'] as $table)$source[$table]=ry_rows($pdo,"SELECT * FROM $table WHERE is_archived=1 AND academic_year=? ORDER BY item_key",[$year]);
    if(!$source['collections'] && !$source['expenditures'] && !$source['budgets'])throw new DomainException('No archived financial records were found for this school year.');
    $source['unpaid_students']=ry_optional($pdo,'SELECT * FROM unpaid_students WHERE academic_year=? ORDER BY id',[$year]);
    $source['late_payments']=ry_optional($pdo,'SELECT * FROM late_payments WHERE academic_year=? ORDER BY id',[$year]);
    if(empty($source['history']))$source['history']=ry_dated_records($pdo,$source['collections'],$source['expenditures']);
    return $source;
}
function ry_working_data(array $source): array {
    $categories=[];
    foreach(($source['categories']??[]) as $cat)$categories[(string)$cat['id']]=$cat;
    foreach($source['collections'] as $row){foreach(ry_decode($row['category_snapshot']??'[]') as $cat){if(!isset($categories[(string)$cat['id']]))$categories[(string)$cat['id']]=$cat;}}
    $collections=[];
    foreach($source['collections'] as $row){
        $amounts=ry_decode($row['category_data']??'{}');
        foreach($amounts as $id=>$amount){$amounts[$id]=ry_historical_money($amount);if(!isset($categories[(string)$id]))$categories[(string)$id]=['id'=>(string)$id,'name'=>(string)$id,'price'=>null];}
        $collections[]=['key'=>(string)$row['item_key'],'label'=>(string)($row['label']?:$row['item_key']),
            'students'=>isset($row['num_students'])?(int)$row['num_students']:null,'amounts'=>(object)$amounts,'remarks'=>(string)($row['remarks']??'')];
    }
    $cleanCategories=[];
    foreach($categories as $id=>$cat)$cleanCategories[]=['id'=>(string)$id,'name'=>(string)($cat['name']??$id),'price'=>isset($cat['price'])?ry_historical_money($cat['price']):null];
    $budgets=[];foreach($source['budgets'] as $row)$budgets[(string)$row['item_key']]=ry_historical_money($row['allocated_amount']);
    $expenses=[];
    foreach($source['expenditures'] as $row){$key=(string)$row['item_key'];$expenses[$key]=['key'=>$key,'label'=>(string)($row['label']?:$key),'amount'=>ry_historical_money($row['amount']),'budget'=>$budgets[$key]??'0.00','remarks'=>(string)($row['remarks']??'')];}
    foreach($budgets as $key=>$budget){if(!isset($expenses[$key]))$expenses[$key]=['key'=>(string)$key,'label'=>(string)$key,'amount'=>'0.00','budget'=>$budget,'remarks'=>''];}
    // Saved layouts retain zero-activity sections/items that had no financial row yet.
    $known=array_fill_keys(array_column($collections,'key'),true);
    foreach(ry_layout_leaves($source['structure']??[],'collections') as $leaf){
        $key=$leaf['item_key'];if(isset($known[$key]))continue;
        $collections[]=['key'=>$key,'label'=>$leaf['label'],'students'=>(int)($source['section_counts'][$key]??0),'amounts'=>(object)[],'remarks'=>''];$known[$key]=true;
    }
    foreach(ry_layout_leaves($source['structure']??[],'expenditures') as $leaf){
        $key=$leaf['item_key'];if(!isset($expenses[$key]))$expenses[$key]=['key'=>$key,'label'=>$leaf['label'],'amount'=>'0.00','budget'=>$budgets[$key]??'0.00','remarks'=>''];
        elseif($expenses[$key]['label']===$key)$expenses[$key]['label']=$leaf['label'];
    }
    $unpaid=$source['unpaid_students']??[];$seen=[];
    foreach($unpaid as $u)$seen[($u['item_key']??'').'|'.($u['category_key']??'').'|'.($u['student_name']??'')]=true;
    foreach((empty($source['unpaid_reviewed']) ? ($source['category_unpaid_lists']??[]) : []) as $list){foreach(($list['names']??[]) as $name){$k=$list['item_key'].'|'.$list['category_key'].'|'.$name;if(!isset($seen[$k])){$unpaid[]=['item_key'=>$list['item_key'],'category_key'=>$list['category_key'],'category_name'=>$list['category_name'],'student_name'=>$name,'is_settled'=>0];$seen[$k]=true;}}}
    return ['schema'=>1,'school_year'=>$source['school_year'],'categories'=>$cleanCategories,'subcategories'=>$source['subcategories']??[],
        'collections'=>$collections,'expenditures'=>array_values($expenses),'unpaid_students'=>$unpaid,'late_payments'=>$source['late_payments']??[],
        'structure'=>$source['structure']??[],'history'=>$source['history']??[],'limitations'=>$source['limitations']??[]];
}
function ry_visible(array $data, string $role): array {
    if($role!=='admin')unset($data['subcategories']);
    return $data;
}
function ry_log(PDO $pdo,string $year,string $action,array $details): void {
    $pdo->prepare('INSERT INTO recovered_year_activity(school_year,username,actor_role,action,details) VALUES(?,?,?,?,?)')
        ->execute([$year,$_SESSION['username']??'Unknown',$_SESSION['role']??'',$action,ry_json($details)]);
}
