<?php
// Student-level tracking is informational: these amounts never add to section receipts.
function sp_cents($value): int {
    if ((!is_string($value) && !is_int($value) && !is_float($value)) || !preg_match('/^\d{1,10}(?:\.\d{1,2})?$/D',(string)$value)) {
        throw new InvalidArgumentException('Enter a non-negative amount with up to two decimal places.');
    }
    $parts=explode('.',(string)$value,2);
    return (int)$parts[0]*100+(int)str_pad($parts[1]??'',2,'0');
}
function sp_money(int $cents): string { return number_format($cents/100,2,'.',''); }
function sp_record_date($value): string {
    if ($value === null || $value === '') return '';
    if (!is_string($value)) throw new InvalidArgumentException('Use a valid student record date.');
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
    $today = (new DateTimeImmutable('now', new DateTimeZone('Asia/Manila')))->format('Y-m-d');
    if (!$date || $date->format('Y-m-d') !== $value || $value < '1000-01-01' || $value > $today) {
        throw new InvalidArgumentException('Student record date must be a valid date on or before today.');
    }
    return $value;
}
function sp_roster_entries(array $stored, $fee): array {
    $feeCents=sp_cents($fee); $entries=[];
    $source=$stored['entries']??array_map(fn($name)=>['student_name'=>$name,'amount_paid'=>null],$stored['names']??[]);
    foreach($source as $row){
        if(!is_array($row)||!is_string($row['student_name']??null))throw new InvalidArgumentException('Invalid saved student record.');
        $paid=isset($row['amount_paid'])?sp_cents($row['amount_paid']):null;
        $entries[]=['student_name'=>$row['student_name'],'payment_date'=>sp_record_date($row['payment_date']??''),'fee_amount'=>sp_money($feeCents),
            'amount_paid'=>$paid===null?null:sp_money($paid),'balance_due'=>$paid===null?null:sp_money(max(0,$feeCents-$paid))];
    }
    return $entries;
}
function sp_ensure_archive_columns(PDO $pdo): void {
    // Run before the archive transaction: ALTER TABLE commits implicitly in MySQL.
    $columns=array_column($pdo->query('SHOW COLUMNS FROM unpaid_students')->fetchAll(PDO::FETCH_ASSOC),'Field');
    $missing=[];
    foreach(['fee_amount','amount_paid','balance_due'] as $column){
        if(!in_array($column,$columns,true))$missing[]="ADD COLUMN `$column` DECIMAL(12,2) NULL DEFAULT NULL";
    }
    if($missing)$pdo->exec('ALTER TABLE unpaid_students '.implode(', ',$missing));
}
function sp_late_summary(PDO $pdo, array $flag): ?array {
    if (!isset($flag['balance_due'])) return null; // Historical name-only flags remain unknown.
    $q=$pdo->prepare("SELECT COALESCE(SUM(amount),0) FROM late_payments WHERE academic_year=? AND item_key=? AND student_name=? AND COALESCE(category_key,'')=? AND created_at>=?");
    $q->execute([$flag['academic_year'],$flag['item_key'],$flag['student_name'],$flag['category_key']??'',$flag['created_at']]);
    $late=sp_cents(number_format((float)$q->fetchColumn(),2,'.',''));
    return ['late_paid'=>sp_money($late),'current_due'=>sp_money(max(0,sp_cents($flag['balance_due'])-$late))];
}
function sp_refresh_late_flags(PDO $pdo, array $payment, $paymentId = null): void {
    $q=$pdo->prepare("SELECT * FROM unpaid_students WHERE academic_year=? AND item_key=? AND student_name=? AND COALESCE(category_key,'')=? FOR UPDATE");
    $q->execute([$payment['academic_year'],$payment['item_key'],$payment['student_name'],$payment['category_key']??'']);
    foreach($q->fetchAll(PDO::FETCH_ASSOC) as $flag){
        $summary=sp_late_summary($pdo,$flag);if($summary===null)continue;
        $settled=sp_cents($summary['current_due'])===0;
        $pdo->prepare('UPDATE unpaid_students SET is_settled=?,settled_payment_id=?,settled_at=? WHERE id=?')
            ->execute([$settled?1:0,$settled?($paymentId??$flag['settled_payment_id']):null,$settled?($flag['settled_at']??date('Y-m-d H:i:s')):null,$flag['id']]);
    }
}
