<?php
// Shared correction metadata; the original receipt and every amendment remain stored.
function rmc_meta(PDO $pdo,int $id,bool $lock=false): array {
    $q=$pdo->prepare('SELECT setting_value FROM system_settings WHERE setting_key=?'.($lock?' FOR UPDATE':''));
    $q->execute(['sr_meta_'.$id]);$raw=$q->fetchColumn();
    return json_decode($raw?:'{}',true,512,JSON_THROW_ON_ERROR)?:[];
}
function rmc_store(PDO $pdo,int $id,array $meta): void {
    $q=$pdo->prepare('INSERT INTO system_settings(setting_key,setting_value) VALUES(?,?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)');
    $q->execute(['sr_meta_'.$id,json_encode($meta,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]);
}
function rmc_revision(array $row,array $meta): string {
    return hash('sha256',json_encode([$row,$meta],JSON_THROW_ON_ERROR));
}
function rmc_view(PDO $pdo,array $row): array {
    $meta=rmc_meta($pdo,(int)$row['id']);
    $row['correction_revision']=rmc_revision($row,$meta);
    $row['original_record']=$meta['original']??$row;
    $row['corrections']=$meta['history']??[];
    $row['student_coverage']=$meta['covered']??null;
    $row['is_removed']=!empty($meta['removed']);
    foreach($row['corrections'] as $entry){
        $names=json_decode($row['category_names']?:'{}',true)?:[];$details=[];
        foreach($entry['after_amounts'] as $id=>$amount) $details[]=($names[$id]??$id).': '.($entry['before_amounts'][$id]??'0.00').' → '.$amount;
        $row['note'].="\n".(($entry['action']??'correct')==='remove'?'Removed: ':'Correction: ').implode('; ',$details).'. '.$entry['reason'].' — '.$entry['admin'].' ('.$entry['at'].' PHT)';
    }
    return $row;
}
