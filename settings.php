<?php
session_start();
if(empty($_SESSION['user_id'])||!in_array($_SESSION['role']??'',['admin','treasurer','auditor'],true)){header('Location: login.php');exit;}
if(empty($_SESSION['app_csrf']))$_SESSION['app_csrf']=bin2hex(random_bytes(32));
if (($_GET['embedded'] ?? '') !== '1') { header('Location: index.php?view=settings'); exit; }
require_once __DIR__.'/db.php';require_once __DIR__.'/settings_store.php';
$boot=ws_payload($pdo);$admin=$_SESSION['role']==='admin';
function ws_esc($value){return htmlspecialchars((string)$value,ENT_QUOTES,'UTF-8');}
?><!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="app-csrf" content="<?= ws_esc($_SESSION['app_csrf']) ?>"><title>Settings | <?= ws_esc($boot['branding']['system_name']) ?></title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
<link rel="stylesheet" href="workspace-ui.css?v=settings-options-20261021">
<script>window.workspaceSettingsBoot=<?= json_encode($boot,JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT) ?>;</script>
<script src="settings.js?v=theme-sync-20261026" data-workspace-settings defer></script>
<script src="workspace-ui.js?v=fixed-print-logos-20261021" defer></script><style>@media screen {
 body[data-workspace-ui]{margin:0!important;min-height:0;background:transparent}
 body>.workspace-sidebar,body>.settings-sidebar,body>header{display:none!important}
 body[data-workspace-ui] main.settings-main{margin:0!important;padding:0!important;width:100%;max-width:none;min-height:0}
 body .system-footer,.settings-page-head>a{display:none!important}
}</style></head>
<body data-workspace-ui="settings">
<aside class="settings-sidebar"><a href="index.php" class="settings-brand"><img src="<?= ws_esc($boot['branding']['primary_logo']) ?>" data-brand-logo="primary" alt="System logo"><span><strong data-brand-system><?= ws_esc($boot['branding']['system_name']) ?></strong><small><?= ws_esc($_SESSION['role']) ?></small></span></a>
<nav aria-label="Main navigation"><a href="index.php">Dashboard</a><a href="settings.php" aria-current="page" data-settings-nav>Settings</a></nav>
<div class="settings-sidebar-footer"><img data-brand-logo="secondary" src="<?= ws_esc($boot['branding']['secondary_logo']) ?>" alt="Organization logo"><span data-brand-organization><?= ws_esc($boot['branding']['organization_name']) ?></span></div></aside>
<main class="settings-main"><header class="settings-page-head"><div><span class="settings-eyebrow">YOUR WORKSPACE</span><h1>Settings</h1><p>Make the workspace feel right for you.<?= $admin?' Manage your organization’s identity in one place.':'' ?></p></div><a class="settings-secondary" href="index.php">Back to Dashboard</a></header>
<div id="workspaceSettingsStatus" class="settings-status" role="status" aria-live="polite"></div>
<section class="settings-card"><div class="settings-section-head"><div><span class="settings-eyebrow">PERSONAL PREFERENCE</span><h2>Appearance</h2><p>Choose your preferred display mode. This choice applies to your account.</p></div><span class="settings-tag">All roles</span></div>
<form id="themeSettingsForm"><fieldset class="theme-options"><legend class="visually-hidden">Display mode</legend>
<label class="theme-option"><input type="radio" name="theme" value="light" <?= $boot['theme']==='light'?'checked':'' ?>><span class="theme-sample theme-sample-light"><span></span><i></i><i></i></span><strong>Light</strong><small>Bright, clean pages</small></label>
<label class="theme-option"><input type="radio" name="theme" value="dark" <?= $boot['theme']==='dark'?'checked':'' ?>><span class="theme-sample theme-sample-dark"><span></span><i></i><i></i></span><strong>Dark</strong><small>Comfortable in low light</small></label>
<label class="theme-option"><input type="radio" name="theme" value="system" <?= $boot['theme']==='system'?'checked':'' ?>><span class="theme-sample theme-sample-system"><span></span><i></i><i></i></span><strong>Match device</strong><small>Follow your device setting</small></label>
</fieldset><div class="settings-actions"><small>Printed documents keep a light background.</small><button class="settings-primary" type="submit">Save Appearance</button></div></form></section>
<section class="settings-card"><div class="settings-section-head"><div><span class="settings-eyebrow">PERSONAL PREFERENCE</span><h2>Notifications</h2><p>Choose which alerts appear in your notification bell. Messages and records remain available in their usual pages.</p></div><span class="settings-tag">Your account</span></div>
<form id="notificationSettingsForm"><div class="settings-notification-options">
<?php $options=['messages'=>['Messages','Alerts for new direct and group messages.'],'system'=>['Other system alerts','Other activity sent to your notification feed.'],'sound'=>['Notification sound','Play a short sound for new alerts while this page is open, after you interact with it.']]; if($admin)$options=['messages'=>$options['messages'],'password_reset'=>['Password reset requests','Alerts when an account requests an Admin password reset.'],'system'=>$options['system'],'sound'=>$options['sound']]; foreach($options as $key=>$option): ?>
<label class="settings-notification-option"><span><strong><?= ws_esc($option[0]) ?></strong><small><?= ws_esc($option[1]) ?></small></span><input type="checkbox" name="<?= $key ?>" value="1" <?= $boot['notifications'][$key]?'checked':'' ?>></label>
<?php endforeach; ?></div><div class="settings-actions"><small>Muted alerts are hidden, not deleted. Re-enable a category to see them again.</small><button class="settings-primary" type="submit">Save Notifications</button></div></form></section>
<?php if($admin): ?>
<section class="settings-card"><div class="settings-section-head"><div><span class="settings-eyebrow">REPORT DEFAULTS</span><h2>Default Report Signatories</h2><p>Set a separate preparer for Treasurer, Auditor and Admin reports. These defaults fill remittance, Cash Disbursement Record and expenditure reports. Names and positions can still be edited on each report.</p></div><span class="settings-tag">Admin only</span></div>
<form id="signatorySettingsForm"><div class="settings-signatory-grid">
<?php foreach(['treasurer'=>'Treasurer reports','auditor'=>'Auditor reports','admin'=>'President reports (Admin / Expenditures)'] as $reportRole=>$reportLabel): $preparer=$boot['signatories']['prepared_by_role'][$reportRole]; ?>
<fieldset class="settings-fields settings-signatory"><legend>Prepared by — <?= ws_esc($reportLabel) ?></legend><label>Full name<input name="prepared_<?= $reportRole ?>_name" maxlength="150" value="<?= ws_esc($preparer['name']) ?>" placeholder="Full name (optional)"></label><label>Position / title<input name="prepared_<?= $reportRole ?>_position" maxlength="100" value="<?= ws_esc($preparer['position']) ?>" placeholder="Position / title"></label></fieldset>
<?php endforeach; ?>
<?php foreach(['certified'=>'Certified by','noted'=>'Noted by','approved'=>'Approved by'] as $key=>$label): ?>
<fieldset class="settings-fields settings-signatory"><legend><?= $label ?></legend><label>Full name<input name="<?= $key ?>_name" maxlength="150" value="<?= ws_esc($boot['signatories']['roles'][$key]['name']) ?>" placeholder="Full name (optional)"></label><label>Position / title<input name="<?= $key ?>_position" maxlength="100" value="<?= ws_esc($boot['signatories']['roles'][$key]['position']) ?>" placeholder="e.g. Organization Treasurer"></label></fieldset>
<?php endforeach; ?></div><div class="settings-actions"><small>Leave fields blank for empty signature lines. Defaults do not certify or approve a report.</small><button class="settings-primary" type="submit">Save Default Signatories</button></div></form></section>
<section class="settings-card"><div class="settings-section-head"><div><span class="settings-eyebrow">ORGANIZATION IDENTITY</span><h2>Names &amp; Logos</h2><p>Branding is shared across the Admin, Treasurer and Auditor workspaces.</p></div><span class="settings-tag">Admin only</span></div>
<form id="brandingSettingsForm" enctype="multipart/form-data"><div class="settings-branding-grid"><div class="settings-fields">
<label>System name<input name="system_name" maxlength="60" required value="<?= ws_esc($boot['branding']['system_name']) ?>" placeholder="e.g. NISU AUDIT"><small>Displayed at the top of the sidebar.</small></label>
<label>Organization name<input name="organization_name" maxlength="160" required value="<?= ws_esc($boot['branding']['organization_name']) ?>" placeholder="Organization name"><small>Displayed with the organization logo.</small></label>
<div class="settings-logo-grid"><?php foreach(['primary'=>'Primary logo','secondary'=>'Organization logo'] as $kind=>$label): ?>
<div class="settings-logo-field"><label for="<?= $kind ?>LogoInput"><?= $label ?></label><input id="<?= $kind ?>LogoInput" type="file" name="<?= $kind ?>_logo" accept="image/png,image/jpeg,image/webp"><label class="settings-check"><input type="checkbox" name="reset_<?= $kind ?>" value="1">Restore original logo</label></div>
<?php endforeach; ?></div><p class="settings-upload-hint">PNG, JPG or WebP · Up to 2 MB per image · Square images work best.</p>
</div><aside class="settings-preview"><span class="settings-eyebrow">PREVIEW</span><div class="settings-preview-brand"><img id="settingsPreviewPrimary" src="<?= ws_esc($boot['branding']['primary_logo']) ?>" alt="Primary logo preview"><strong id="settingsPreviewSystem"><?= ws_esc($boot['branding']['system_name']) ?></strong></div><div class="settings-preview-org"><img id="settingsPreviewSecondary" src="<?= ws_esc($boot['branding']['secondary_logo']) ?>" alt="Organization logo preview"><span id="settingsPreviewOrganization"><?= ws_esc($boot['branding']['organization_name']) ?></span></div><small>Your changes appear for everyone after saving.</small></aside></div>
<div class="settings-actions"><small>Review the names and image previews before saving.</small><button class="settings-primary" type="submit">Save Branding</button></div></form></section>
<?php endif; ?>
<footer class="settings-foot"><?php include __DIR__ . '/system_credits.php'; ?></footer></main></body></html>
