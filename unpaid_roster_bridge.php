<?php
require_once __DIR__ . '/student_payment_helpers.php';
// Shared read model for the Admin archive review and its final transaction.
function aru_roster_preview(PDO $pdo, bool $lock = false): array {
    $query = "SELECT setting_key,setting_value FROM system_settings WHERE setting_key IN ('ui_layout','collection_categories') OR setting_key LIKE 'unpaid_roster_%' ORDER BY setting_key";
    if ($lock) $query .= ' FOR UPDATE';
    $settings = $pdo->query($query)->fetchAll(PDO::FETCH_KEY_PAIR);
    $layout = json_decode($settings['ui_layout'] ?? '{}', true, 512, JSON_THROW_ON_ERROR);
    $categories = json_decode($settings['collection_categories'] ?? '[]', true, 512, JSON_THROW_ON_ERROR);
    $nodes = $layout['collections'] ?? [];
    $byId = [];
    foreach ($nodes as $node) if (isset($node['id'])) $byId[(string)$node['id']] = $node;
    $cycle = (int)$pdo->query("SELECT COALESCE(MAX(id),0) FROM user_logs WHERE action='System Reboot'")->fetchColumn();
    $sections = []; $rows = []; $seen = []; $source = [];
    foreach ($nodes as $node) {
        if (($node['type'] ?? '') !== 'in') continue;
        $safe = preg_replace('/[^a-z0-9]/', '-', strtolower((string)$node['name']));
        $key = empty($node['parent']) ? $safe : $node['parent'].'-'.$safe;
        $names = [(string)$node['name']]; $parent = $node['parent'] ?? ''; $visited = [];
        while ($parent !== '' && isset($byId[$parent]) && !isset($visited[$parent])) {
            $visited[$parent] = true; array_unshift($names, (string)$byId[$parent]['name']);
            $parent = $byId[$parent]['parent'] ?? '';
        }
        $sections[] = ['item_key'=>$key, 'label'=>implode(' > ', $names)];
        foreach ($categories as $cat) {
            $category = (string)$cat['id'];
            $legacy = 'unpaid_roster_'.hash('sha256', json_encode([$cycle,$key,$category]));
            $short = substr($legacy,0,46);
            $raw = $settings[$short] ?? $settings[$legacy] ?? '';
            $source[] = [$key,$category,$raw];
            if ($raw === '') continue;
            $saved = json_decode($raw,true,512,JSON_THROW_ON_ERROR);
            foreach (sp_roster_entries($saved,$cat['price']) as $payment) {
                if ($payment['balance_due'] !== null && sp_cents($payment['balance_due']) === 0) continue;
                $name = $payment['student_name'];
                if (!is_string($name) || trim($name) === '') continue;
                $name = trim($name);
                $identity = aru_flag_identity($key,$category,$name);
                if (isset($seen[$identity])) continue;
                $seen[$identity] = true;
                $rows[] = ['item_key'=>$key,'section_label'=>implode(' > ',$names),
                    'student_name'=>$name,'payment_date'=>$payment['payment_date']??'','category_key'=>$category,'category_name'=>(string)$cat['name'],
                    'remarks'=>'Imported from Collections','fee_amount'=>$payment['fee_amount'],
                    'amount_paid'=>$payment['amount_paid'],'balance_due'=>$payment['balance_due']];
            }
        }
    }
    return ['status'=>'success','cycle_id'=>$cycle,'sections'=>$sections,'categories'=>$categories,'students'=>$rows,
        'revision'=>hash('sha256',json_encode([$cycle,$nodes,$categories,$source],JSON_THROW_ON_ERROR))];
}
function aru_flag_identity(string $section, string $category, string $name): string {
    return json_encode([$section,$category,strtolower(trim($name))],JSON_THROW_ON_ERROR);
}
function aru_validate_flags(array $input, array $preview): array {
    $sections = array_column($preview['sections'],null,'item_key');
    $categories = array_column($preview['categories'],null,'id');
    $result = []; $seen = [];
    foreach ($input as $entry) {
        $entry = is_object($entry) ? get_object_vars($entry) : $entry;
        if (!is_array($entry)) throw new InvalidArgumentException('Invalid unpaid-student row.');
        foreach (['item_key','student_name','category_key','remarks'] as $field) {
            if (!is_string($entry[$field] ?? '')) throw new InvalidArgumentException('Invalid unpaid-student details.');
        }
        $section = trim($entry['item_key'] ?? ''); $name = trim($entry['student_name'] ?? '');
        $category = trim($entry['category_key'] ?? ''); $notes = trim($entry['remarks'] ?? '');
        if (!isset($sections[$section]) || $name === '' || strlen($name)>200 || preg_match('/[\x00-\x1F\x7F]/u',$name) || strlen($notes)>500) {
            throw new InvalidArgumentException('Check each student name, active section and notes (maximum 500 bytes).');
        }
        if ($category !== '' && !isset($categories[$category])) throw new InvalidArgumentException('Choose an active unpaid category.');
        $fee=$category === '' ? sp_cents($entry['fee_amount']??null) : sp_cents($categories[$category]['price']);
        $paid=sp_cents($entry['amount_paid']??null);
        if($paid>$fee)throw new InvalidArgumentException('Amount Paid cannot exceed the fee.');
        if($fee===$paid)continue;
        $identity = aru_flag_identity($section,$category,$name);
        if (isset($seen[$identity])) continue;
        $seen[$identity] = true;
        $result[] = (object)['item_key'=>$section,'student_name'=>$name,'category_key'=>$category,
            'category_name'=>$category === '' ? '' : (string)$categories[$category]['name'],'remarks'=>$notes,
            'fee_amount'=>sp_money($fee),'amount_paid'=>sp_money($paid),'balance_due'=>sp_money($fee-$paid)];
    }
    return $result;
}
