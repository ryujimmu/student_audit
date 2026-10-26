<?php
session_start();

if (!isset($_SESSION['user_id'])) {
    header('Location: login.php');
    exit;
}

if (empty($_SESSION['app_csrf'])) {
    $_SESSION['app_csrf'] = bin2hex(random_bytes(32));
}

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/settings_store.php';
$workspaceSettingsBoot = ws_payload($pdo);

if (
    ($_SESSION['role'] ?? '') === 'admin' &&
    empty($_SESSION['password_reset_admin_csrf'])
) {
    $_SESSION['password_reset_admin_csrf'] = bin2hex(random_bytes(24));
}

if (empty($_SESSION['section_remittance_csrf'])) {
    $_SESSION['section_remittance_csrf'] = bin2hex(random_bytes(32));
}

if (empty($_SESSION['receipt_documents_csrf'])) {
    $_SESSION['receipt_documents_csrf'] = bin2hex(random_bytes(32));
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<meta
    name="app-csrf"
    content="<?= htmlspecialchars($_SESSION['app_csrf'], ENT_QUOTES, 'UTF-8') ?>"
>

<title><?= htmlspecialchars($workspaceSettingsBoot['branding']['system_name'], ENT_QUOTES, 'UTF-8') ?> | Fund &amp; Audit</title>
<script>window.workspaceSettingsBoot=<?= json_encode($workspaceSettingsBoot, JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT) ?>;document.documentElement.dataset.theme=workspaceSettingsBoot.theme==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):workspaceSettingsBoot.theme;</script>

<script src="request.js?v=cleanup-20261015"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>

<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Source+Serif+4:opsz,wght@8..60,600;8..60,700&display=swap" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css">
<link rel="stylesheet" href="style.css?v=cleanup-20261015">

<script>
    const currentUserRole = <?php echo json_encode($_SESSION['role'] ?? 'auditor', JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT); ?>;
    const currentUsername = <?php echo json_encode($_SESSION['username'] ?? 'User', JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT); ?>;
    const receiptDocumentsCsrf = <?php echo json_encode($_SESSION['receipt_documents_csrf']); ?>;
    const sectionRemittanceCsrf = <?php echo json_encode($_SESSION['section_remittance_csrf']); ?>;
    const passwordResetAdminCsrf = <?php echo json_encode($_SESSION['password_reset_admin_csrf'] ?? '', JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT); ?>;
</script>

<style>
    .swal2-popup {
        background-color: var(--navy-panel) !important;
        color: var(--text-invert) !important;
        border: 1px solid var(--gold-main);
        border-radius: 12px !important;
    }

    .swal2-title,
    .swal2-html-container {
        color: var(--text-invert) !important;
    }

    .swal2-input {
        background-color: rgba(0, 0, 0, 0.3) !important;
        color: var(--text-invert) !important;
        border: 1px solid var(--gold-main) !important;
    }

    .clickable-collected-cell {
        cursor: pointer;
        transition:
            background-color 0.2s ease,
            border-color 0.2s ease;
    }

    .clickable-collected-cell:hover {
        background-color: rgba(39, 103, 218, 0.1) !important;
        border-color: var(--gold-main) !important;
    }

    .remittance-history-wrap {
        overflow-x: auto;
        border: 1px solid #cfddf0;
        border-radius: 12px;
        background: #fff;
    }

    .remittance-history-table {
        width: 100%;
        min-width: 850px;
        table-layout: fixed;
        margin: 0 !important;
        color: #233d60 !important;
        font-size: 12px;
    }

    .remittance-history-table.remittance-history-overall {
        min-width: 1050px;
    }

    .remittance-history-table > thead > tr > th {
        background: #eaf2fd !important;
        color: #285fae !important;
        padding: 14px 16px !important;
        font-size: 11px !important;
        font-weight: 700;
        vertical-align: middle;
        border-bottom: 1px solid #c5d7ef !important;
        white-space: nowrap;
    }

    .remittance-history-table > tbody > tr > td {
        background: #fff !important;
        color: #233d60 !important;
        padding: 17px 16px !important;
        vertical-align: top !important;
        border-bottom: 1px solid #e3ebf6 !important;
        line-height: 1.55;
    }

    .remittance-history-table > tbody > tr:last-child > td {
        border-bottom: 0 !important;
    }

    .remittance-history-table > tbody > tr:hover > td {
        background: #f8fbff !important;
    }

    .rh-date,
    .rh-amount,
    .rh-category-amount {
        white-space: nowrap !important;
        font-variant-numeric: tabular-nums;
    }

    .rh-date {
        font-weight: 700;
        display: block;
        margin-bottom: 7px;
    }

    .rh-status {
        display: inline-block;
        padding: 3px 7px;
        border-radius: 6px;
        background: #eaf2ff;
        color: #285fae;
        font-size: 10px;
        line-height: 1.45;
    }

    .rh-status-muted {
        background: #edf0f4;
        color: #627187;
    }

    .rh-movement {
        display: inline-block;
        color: #285fae;
        background: #edf4ff;
        border: 1px solid #dbe8fa;
        padding: 3px 8px;
        border-radius: 6px;
        font-size: 10px;
        font-weight: 700;
        margin-bottom: 9px;
    }

    .rh-person {
        display: grid;
        grid-template-columns: 31px minmax(0, 1fr);
        gap: 6px;
        margin: 3px 0;
    }

    .rh-label {
        color: #6a7e99;
        font-size: 11px;
        font-weight: 400;
    }

    .rh-value,
    .rh-section-name,
    .rh-extra {
        overflow-wrap: break-word;
        white-space: normal;
    }

    .rh-value {
        font-weight: 600;
    }

    .rh-extra {
        margin-top: 7px;
        color: #607590;
        font-size: 11px;
    }

    .rh-categories {
        display: grid;
        gap: 7px;
    }

    .rh-category {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 10px;
        align-items: start;
    }

    .rh-category-name {
        font-size: 11px;
        color: #57708f;
        overflow-wrap: break-word;
    }

    .rh-category-amount {
        text-align: right;
        font-size: 12px;
    }

    .rh-amount {
        text-align: right;
        font-size: 14px;
        font-weight: 800;
        color: #215dbb !important;
    }

    .rh-section-name {
        font-weight: 600;
        display: block;
    }

    .rh-section-detail {
        color: #6a7e99;
        display: block;
        margin-top: 5px;
        font-size: 11px;
    }

    .rh-recorder {
        font-weight: 600;
        overflow-wrap: break-word;
        display: block;
        margin-bottom: 5px;
    }

    .rh-encoded {
        font-size: 11px;
        color: #6a7e99;
        white-space: nowrap;
        display: block;
    }
</style>

<?php if (($_SESSION['role'] ?? '') === 'auditor'): ?>
<link rel="stylesheet" href="auditor_register.css?v=integrated-20261015">
<?php endif; ?>
<style>
.main-content{display:flex;flex-direction:column;gap:24px}
.system-footer{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px 20px;margin-top:auto;padding-top:22px;border-top:1px solid rgba(100,130,170,.2);color:#6a7e99;font-size:12px;line-height:1.6;flex-shrink:0}
.system-footer span{display:block}
@media(max-width:600px){.system-footer{flex-direction:column;align-items:center;text-align:center}}
@media print{.system-footer{display:none!important}}
</style>
<link rel="stylesheet" href="workspace-ui.css?v=settings-options-20261021">
<link rel="stylesheet" href="modal-polish.css?v=schedule-layout-20261026">
<script src="workspace-ui.js?v=theme-sync-20261026" defer></script>
<script src="settings.js?v=role-signatories-20261022" data-workspace-settings defer></script>
<link rel="stylesheet" href="report-print.css?v=original-with-logos-20261018">
</head>

<body data-workspace-ui="dashboard">
<div class="ambient-bg" aria-hidden="true">
    <span class="ambient-orb orb-royal-1"></span>
    <span class="ambient-orb orb-gold-1"></span>
    <span class="ambient-orb orb-royal-2"></span>
</div>

<div
    class="sidebar-scrim no-print"
    id="sidebarScrim"
    aria-hidden="true"
></div>

<div class="sidebar no-print" id="appSidebar">
    <div class="sidebar-header">
        <img
            data-brand-logo="primary" src="<?= htmlspecialchars($workspaceSettingsBoot['branding']['primary_logo'], ENT_QUOTES, 'UTF-8') ?>"
            alt="NISU Logo"
            class="sidebar-logo"
        >

        <div class="header-text">
            <h4
                class="mb-0 text-white fw-bold"
                style="font-size: 1.1rem; letter-spacing: 1px;"
            >
                <?= htmlspecialchars($workspaceSettingsBoot['branding']['system_name'], ENT_QUOTES, 'UTF-8') ?>
            </h4>

            <span class="badge sys-role-badge mt-1">
                <?php echo htmlspecialchars((string)($_SESSION['role'] ?? 'Auditor'), ENT_QUOTES, 'UTF-8'); ?>
            </span>
        </div>
    </div>

    <div class="sidebar-nav-container">
        <ul class="nav flex-column pb-4">

            <?php if (($_SESSION['role'] ?? '') === 'treasurer'): ?>
            <li class="nav-item">
                <a
                    href="#"
                    class="nav-link<?php echo ($_SESSION['role'] ?? '') === 'treasurer' ? ' active' : ''; ?>"
                    id="nav-collections"
                    onclick="switchView('collections')"
                >
                    <i class="bi bi-box-arrow-in-right"></i>
                    <span class="nav-text">Collections</span>
                </a>
            </li>

            <?php endif; ?>
            <?php if (($_SESSION['role'] ?? '') === 'admin'): ?>
            <li class="nav-item">
                <a
                    href="#"
                    class="nav-link"
                    id="nav-expenditures"
                    onclick="switchView('expenditures')"
                >
                    <i class="bi bi-graph-down-arrow"></i>
                    <span class="nav-text">Expenditures</span>
                </a>
            </li>
            <?php endif; ?>

            <li class="nav-item">
                <a
                    href="#"
                    class="nav-link<?php echo ($_SESSION['role'] ?? '') === 'auditor' ? ' active' : ''; ?>"
                    id="nav-reporting"
                    onclick="switchView('reporting')"
                >
                    <i class="bi bi-file-earmark-bar-graph-fill"></i>
                    <span class="nav-text">Reporting</span>
                </a>
            </li>

            <li class="nav-item">
                <a
                    href="#"
                    class="nav-link"
                    id="nav-messages"
                    onclick="switchView('messages')"
                >
                    <span style="position: relative; display: inline-flex; min-width: 35px;">
                        <i class="bi bi-chat-dots-fill"></i>
                        <span
                            id="messagesNavBadge"
                            class="badge rounded-pill bg-crimson d-none"
                            style="position: absolute; top: -6px; right: -2px; font-size: 0.55rem; padding: 2px 5px; line-height: 1;"
                        >0</span>
                    </span>

                    <span class="nav-text">Messages</span>
                </a>
            </li>

            <?php if (($_SESSION['role'] ?? '') === 'auditor'): ?>

                <?php if (($_SESSION['role'] ?? '') === 'auditor'): ?>
                <li class="nav-item">
                    <a
                        href="#"
                        class="nav-link"
                        id="nav-audit-register"
                        onclick="switchView('audit-register'); return false;"
                    >
                        <i class="bi bi-receipt"></i>
                        <span class="nav-text">
                            Audit Receipt Register
                        </span>
                    </a>
                </li>
                <?php endif; ?>

                <li class="nav-item">
                    <a
                        href="#"
                        class="nav-link"
                        id="nav-add-doc"
                        onclick="switchView('add-doc')"
                    >
                        <i class="bi bi-file-earmark-plus"></i>
                        <span class="nav-text">
                            Receipt Documents
                        </span>
                    </a>
                </li>
            <?php endif; ?>

            <?php if (isset($_SESSION['role']) && $_SESSION['role'] === 'admin'): ?>
            <li
                class="nav-item mt-4 pt-3"
                style="border-top: 1px solid rgba(142,100,11,0.35);"
            >
                <a
                    href="#"
                    class="nav-link"
                    id="nav-archives"
                    onclick="switchView('archives')"
                >
                    <i class="bi bi-archive-fill"></i>
                    <span class="nav-text">Archives</span>
                </a>
            </li>

            <li class="nav-item">
                <a
                    href="#"
                    class="nav-link active"
                    id="nav-admin"
                    onclick="switchView('admin-panel')"
                >
                    <i class="bi bi-shield-lock-fill"></i>
                    <span class="nav-text">Admin Panel</span>
                </a>
            </li>

            <li class="nav-item">
                <a href="index.php?view=database-health" onclick="switchView('database-health'); return false;" class="nav-link" id="nav-database-health">
                    <i class="bi bi-activity"></i>
                    <span class="nav-text">Database Health</span>
                </a>
            </li>
            <?php endif; ?>

            <?php if (($_SESSION['role'] ?? '') === 'admin'): ?>
            <li class="nav-item">
                <a href="index.php?view=recovered-years" onclick="switchView('recovered-years'); return false;" class="nav-link" id="nav-recovered-years"><i class="bi bi-arrow-counterclockwise"></i><span class="nav-text">Recovered Years</span></a>
            </li>
            <?php endif; ?>

            <li class="nav-item"><a href="index.php?view=settings" onclick="switchView('settings'); return false;" class="nav-link" id="nav-settings" data-settings-nav><i class="bi bi-gear-fill"></i><span class="nav-text">Settings</span></a></li>

            <li class="nav-item mt-2">
                <a
                    href="#"
                    class="nav-link text-theme-crimson"
                    onclick="confirmLogout()"
                >
                    <i class="bi bi-box-arrow-left"></i>
                    <span class="nav-text">Log Out</span>
                </a>
            </li>
        </ul>
    </div>

    <div class="sidebar-footer">
        <img
            data-brand-logo="secondary" src="<?= htmlspecialchars($workspaceSettingsBoot['branding']['secondary_logo'], ENT_QUOTES, 'UTF-8') ?>"
            alt="CICS Logo"
            class="sidebar-logo"
        >

        <div class="footer-text" data-brand-organization><small class="d-block fw-bold text-theme-gold"><?= htmlspecialchars($workspaceSettingsBoot['branding']['organization_name'], ENT_QUOTES, 'UTF-8') ?></small></div>
    </div>
</div>

<div class="notif-bell-widget no-print">
    <span
        id="saveStatusPill"
        class="save-status-pill d-none"
    ></span>

    <button
        type="button"
        class="notif-bell-btn"
        id="notifBellBtn"
        onclick="toggleNotifDropdown()"
        aria-label="Notifications"
    >
        <i class="bi bi-bell-fill"></i>
        <span
            id="notifBellBadge"
            class="badge rounded-pill bg-crimson d-none"
        >0</span>
    </button>

    <div class="notif-dropdown d-none" id="notifDropdown">
        <div class="notif-dropdown-header">
            <span class="fw-bold text-theme-gold">
                Notifications
            </span>

            <a
                href="#"
                class="small text-theme-gold"
                onclick="markAllNotificationsRead(); return false;"
            >
                Mark all read
            </a>
        </div>

        <div
            class="notif-dropdown-body"
            id="notifDropdownBody"
        >
            <p class="text-center text-muted small py-4 mb-0">
                Loading...
            </p>
        </div>
    </div>
</div>

<header class="app-topbar no-print">
    <button
        type="button"
        class="mobile-menu-button"
        id="mobileMenuButton"
        aria-label="Open navigation"
        aria-controls="appSidebar"
        aria-expanded="false"
    >
        <i class="bi bi-list"></i>
    </button>

    <div class="app-topbar-brand">
        <span class="app-breadcrumb">
            NISU CICS / FINANCE PORTAL
        </span>
        <strong>Student Organization Fund &amp; Audit</strong>
    </div>

    <div class="app-topbar-user">
        <span class="online-dot" aria-hidden="true"></span>
        <span>
            <?php echo htmlspecialchars((string)($_SESSION['username'] ?? 'User'), ENT_QUOTES, 'UTF-8'); ?>
        </span>
    </div>
</header>

<div class="main-content">

<?php require __DIR__ . '/auditor_register_view.php'; ?>

    <div
        id="collectionsView"
        class="<?php echo ($_SESSION['role'] ?? '') === 'treasurer' ? '' : 'd-none'; ?>"
    >
        <div class="page-head no-print">
            <div>
                <span class="page-eyebrow">
                    <i class="bi bi-box-arrow-in-right"></i>
                    Fund Tracking
                </span>

                <h2 class="page-title">
                    Student Collections &amp; Receipts
                </h2>

                <p class="page-subtitle">
                    Per-section receipts against each program's
                    target collection categories.
                </p>
            </div>

            <div class="page-head-actions action-buttons d-flex gap-2">
                <button
                    type="button"
                    class="btn btn-gold btn-sm"
                    onclick="openAllRemittances()"
                >
                    <i class="bi bi-journal-text me-1"></i>
                    All Remittances
                </button>

                <button
                    class="btn btn-crimson btn-sm"
                    onclick="clearTable('in')"
                >
                    <i class="bi bi-eraser me-1"></i>
                    Clear All
                </button>

                <button
                    class="btn btn-navy btn-sm"
                    onclick="undo()"
                >
                    <i class="bi bi-arrow-counterclockwise me-1"></i>
                    Undo
                </button>
            </div>
        </div>

        <div class="card bg-panel overflow-hidden">
            <div class="table-responsive">
                <table
                    class="table table-hover align-middle mb-0"
                    id="collectionsTable"
                >
                    <thead>
                        <tr
                            class="text-center align-middle"
                            id="collectionsHeadRow"
                        ></tr>
                    </thead>

                    <tbody id="collectionsBody"></tbody>

                    <tfoot class="table-dark text-end">
                        <tr id="collectionsFootRow"></tr>
                    </tfoot>
                </table>
            </div>
        </div>
    </div>

    <div id="expendituresView" class="d-none">
        <div class="page-head no-print">
            <div>
                <span class="page-eyebrow">
                    <i class="bi bi-graph-down-arrow"></i>
                    Fund Tracking
                </span>

                <h2 class="page-title">
                    Org Expenditures &amp; Disbursements
                </h2>

                <p class="page-subtitle">
                    Spending against admin-set budgets,
                    by item or activity.
                </p>
            </div>

            <?php if (($_SESSION['role'] ?? '') === 'admin'): ?>
            <div class="page-head-actions action-buttons d-flex flex-wrap gap-2">
                <button type="button" id="printExpendituresBtn" class="btn btn-outline-gold btn-sm fw-bold" onclick="printReport('expenditures')"><i class="bi bi-file-earmark-pdf me-1"></i>Print / Save as PDF</button>
                <button type="button" id="manageExpBtn" class="btn btn-outline-gold btn-sm fw-bold" onclick="openManageExpModal()"><i class="bi bi-calendar-plus me-1"></i>Add / Remove Item</button>

                <button
                    class="btn btn-crimson btn-sm"
                    onclick="clearTable('out')"
                >
                    <i class="bi bi-eraser me-1"></i>
                    Clear All
                </button>

                <button
                    class="btn btn-navy btn-sm"
                    onclick="undo()"
                >
                    <i class="bi bi-arrow-counterclockwise me-1"></i>
                    Undo
                </button>
            </div>
            <?php endif; ?>
        </div>

        <?php if (($_SESSION['role'] ?? '') === 'admin'): ?>
        <div class="card bg-panel mb-4 no-print">
            <div class="card-body d-flex flex-wrap align-items-end gap-3">
                <div class="flex-grow-1">
                    <label for="overallExpenditureBudget" class="form-label fw-bold text-main">Overall Budget (₱)</label>
                    <input id="overallExpenditureBudget" type="number" required min="0" max="9999999999.99" step="0.01" value="0.00" class="form-control fw-bold text-theme-gold" style="max-width:320px" aria-describedby="overallBudgetHelp">
                    <div id="overallBudgetHelp" class="text-muted small mt-2">Total funds available. Set each item's budget directly in the table below.</div>
                </div>
                <button type="button" id="btn-save-budgets" class="btn btn-gold fw-bold" onclick="saveAdminBudgets()"><i class="bi bi-floppy-fill me-2"></i>Save Budgets</button>
            </div>
        </div>
        <?php endif; ?>

        <div class="card bg-panel overflow-hidden">
            <div class="table-responsive">
                <table
                    class="table table-hover align-middle mb-0"
                    id="expendituresTable"
                >
                    <thead>
                        <tr class="text-center align-middle">
                            <th class="text-start ps-4">
                                Item Description
                            </th>
                            <th style="width: 180px;">
                                Budget
                            </th>
                            <th style="width: 180px;">
                                Amount Spent
                            </th>
                            <th style="width: 180px;">
                                Remaining Balance
                            </th>
                        </tr>
                    </thead>

                    <tbody id="expendituresBody"></tbody>

                    <tfoot class="table-dark text-end">
                        <tr>
                            <td class="fw-bold pe-4 fs-5">
                                TOTAL EXPENDITURES:
                            </td>
                            <td
                                id="tot-budget-table"
                                class="fw-bold text-center fs-5 text-theme-gold"
                            >0.00</td>
                            <td
                                id="tot-expenses-table"
                                class="text-theme-crimson fw-bold text-center fs-5"
                            >0.00</td>
                            <td
                                id="tot-remaining-table"
                                class="fw-bold text-center fs-5 text-white"
                            >0.00</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
        <div class="card bg-panel mt-3" aria-label="Overall budget balance">
            <div class="card-body">
                <div class="row g-3 align-items-center" aria-live="polite" aria-atomic="true">
                    <div class="col-12 col-md-4">
                        <div class="small text-muted">Overall Budget</div>
                        <div id="overall-budget-summary" class="fs-5 fw-bold text-main">₱ 0.00</div>
                    </div>
                    <div class="col-12 col-md-4">
                        <div class="small text-muted">Less: Total Disbursed</div>
                        <div id="overall-disbursed-summary" class="fs-5 fw-bold text-theme-crimson">₱ 0.00</div>
                    </div>
                    <div class="col-12 col-md-4">
                        <div class="small text-muted">Remaining Overall Budget</div>
                        <div id="overall-remaining-summary" class="fs-5 fw-bold text-main">₱ 0.00</div>
                        <div id="overall-overspent-summary" class="small text-theme-crimson d-none">Disbursements exceed the overall budget.</div>
                    </div>
                </div>
                <div class="small text-muted mt-2">Remaining overall budget = overall budget − total amount spent.</div>
            </div>
        </div>
        <div class="card bg-panel mt-3 no-print" data-report-preparer="admin">
            <div class="card-body">
                <h3 class="h6 fw-bold text-main">Report Signatories</h3>
                <p class="small text-muted">Filled from Admin Settings. Changes here apply to the current expenditure report and its item PDFs.</p>
                <div class="row g-3">
                    <?php foreach(['prepared'=>'Prepared by','certified'=>'Certified by','noted'=>'Noted by','approved'=>'Approved by'] as $sigKey=>$sigLabel): ?>
                    <div class="col-12 col-md-6 col-xl-3">
                        <label for="expenseSig_<?= $sigKey ?>" class="form-label small fw-bold"><?= $sigLabel ?></label>
                        <input id="expenseSig_<?= $sigKey ?>" class="form-control" type="text" maxlength="150" placeholder="Full name" data-report-signatory="<?= $sigKey ?>">
                        <label for="expenseSigPosition_<?= $sigKey ?>" class="visually-hidden"><?= $sigLabel ?> position</label>
                        <input id="expenseSigPosition_<?= $sigKey ?>" class="form-control form-control-sm mt-2" type="text" maxlength="100" placeholder="Position / title" data-report-position="<?= $sigKey ?>">
                    </div>
                    <?php endforeach; ?>
                </div>
            </div>
        </div>
    </div>

    <div
        id="reportingView"
        class="<?php echo ($_SESSION['role'] ?? '') === 'auditor' ? '' : 'd-none'; ?>"
    >
        <div class="page-head no-print">
            <div>
                <span class="page-eyebrow">
                    <i class="bi bi-shield-check me-2"></i>
                    Auditor Portal
                </span>

                <h2 class="page-title">
                    Auditor Executive Overview
                </h2>

                <p class="page-subtitle">
                    Live fund monitoring, anomaly tracking,
                    and supporting document management.
                </p>
            </div>

            <span class="badge bg-sub-panel text-main border border-secondary p-2 shadow-sm no-print">
                <i class="bi bi-calendar3 me-2"></i>
                <?php echo date('F d, Y'); ?>
            </span>
        </div>

        <div class="row g-4 mb-4">
            <div class="col-md-4">
                <div class="stat-card stat-card-gold">
                    <div class="stat-card-icon">
                        <i class="bi bi-piggy-bank-fill"></i>
                    </div>
                    <div>
                        <h6 class="stat-card-label">
                            Total Collections
                        </h6>
                        <h2
                            id="dash-receipts"
                            class="stat-card-value"
                        >₱ 0.00</h2>
                    </div>
                </div>
            </div>

            <div class="col-md-4">
                <div class="stat-card stat-card-crimson">
                    <div class="stat-card-icon">
                        <i class="bi bi-graph-down-arrow"></i>
                    </div>
                    <div>
                        <h6
                            class="stat-card-label"
                            style="color: var(--crimson);"
                        >
                            Total Expenditures
                        </h6>
                        <h2
                            id="dash-expenses"
                            class="stat-card-value"
                        >₱ 0.00</h2>
                    </div>
                </div>
            </div>

            <div class="col-md-4">
                <div class="stat-card stat-card-navy">
                    <div class="stat-card-icon">
                        <i class="bi bi-wallet2"></i>
                    </div>
                    <div>
                        <h6 class="stat-card-label">
                            Net Liquid Balance
                        </h6>
                        <h2
                            id="dash-balance"
                            class="stat-card-value"
                        >₱ 0.00</h2>
                    </div>
                </div>
            </div>
        </div>

        <div class="row g-4 mb-4">
            <div class="col-12">
                <div class="card bg-panel border-0 h-100 shadow-sm audit-widget">
                    <div class="card-header bg-transparent border-0 d-flex align-items-center justify-content-between py-3">
                        <div>
                            <h6 class="audit-panel-heading mb-1">
                                <i class="bi bi-activity me-2"></i>
                                Discrepancy &amp; Over-Budget Detector
                            </h6>
                            <p class="audit-panel-subtitle mb-0">
                                Specific sections, expenses, and thresholds
                            </p>
                        </div>
                        <span
                            id="anomalyCountBadge"
                            class="audit-count-badge"
                        >0</span>
                    </div>

                    <div
                        class="card-body pt-0"
                        id="anomalyListContainer"
                    >
                        <div class="text-center text-muted py-3 small">
                            Scanning system rows...
                        </div>
                    </div>
                </div>
            </div>


        </div>

        <div class="row g-4 mb-4 row-eq-height">
            <div class="col-md-6">
                <div
                    class="card bg-panel p-4 breakdown-slider-card h-100"
                    style="min-height: 400px;"
                >
                    <div class="d-flex justify-content-between align-items-center mb-4">
                        <h6
                            class="fw-bold mb-0 text-theme-gold"
                            id="breakdownSlideTitle"
                        >
                            <i class="bi bi-bar-chart-fill me-2"></i>
                            Collections Breakdown
                        </h6>

                        <select
                            id="collectionChartFilter"
                            class="form-select form-select-sm w-auto shadow-none"
                            onchange="renderCollectionsChart()"
                        >
                            <option value="all">
                                Overall (By Program)
                            </option>
                        </select>

                        <select
                            id="expenditureChartFilter"
                            class="form-select form-select-sm w-auto shadow-none d-none"
                            onchange="renderExpendituresChart()"
                        >
                            <option value="all">
                                Overall (By Item)
                            </option>
                        </select>
                    </div>

                    <div class="breakdown-slider-viewport">
                        <div
                            class="breakdown-slider-track"
                            id="breakdownSliderTrack"
                        >
                            <div class="breakdown-slide">
                                <div class="breakdown-chart-frame">
                                    <canvas id="collectionsChart"></canvas>
                                </div>
                            </div>
                            <div class="breakdown-slide">
                                <div class="breakdown-chart-frame">
                                    <canvas id="expendituresChart"></canvas>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="d-flex justify-content-center align-items-center gap-3 mt-3 no-print">
                        <button
                            type="button"
                            class="btn btn-sm btn-outline-gold breakdown-nav-btn disabled"
                            id="breakdownPrevBtn"
                            onclick="slideBreakdown(-1)"
                            aria-label="Show Collections Breakdown"
                        >
                            <i class="bi bi-chevron-left"></i>
                        </button>

                        <div class="breakdown-slide-dots">
                            <span
                                class="breakdown-dot active"
                                id="breakdownDot0"
                                role="button"
                                tabindex="0"
                                aria-label="Show Collections Breakdown"
                                onclick="goToBreakdownSlide(0)"
                                onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();goToBreakdownSlide(0);}"
                            ></span>

                            <span
                                class="breakdown-dot"
                                id="breakdownDot1"
                                role="button"
                                tabindex="0"
                                aria-label="Show Expenditures Breakdown"
                                onclick="goToBreakdownSlide(1)"
                                onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();goToBreakdownSlide(1);}"
                            ></span>
                        </div>

                        <button
                            type="button"
                            class="btn btn-sm btn-outline-gold breakdown-nav-btn"
                            id="breakdownNextBtn"
                            onclick="slideBreakdown(1)"
                            aria-label="Show Expenditures Breakdown"
                        >
                            <i class="bi bi-chevron-right"></i>
                        </button>
                    </div>
                </div>
            </div>

            <div class="col-md-6">
                <div
                    class="card bg-panel p-4 h-100 d-flex flex-column"
                    style="min-height: 400px;"
                >
                    <h6 class="fw-bold mb-4 text-center text-theme-gold">
                        <i class="bi bi-pie-chart-fill me-2"></i>
                        Overall Fund Distribution
                    </h6>

                    <div class="breakdown-chart-frame flex-grow-1">
                        <canvas id="distributionPieChart"></canvas>
                    </div>
                </div>
            </div>
        </div>

        <div class="card bg-panel overflow-hidden no-print">
            <div
                class="card-header border-bottom-0 pt-3 px-4"
                style="background: transparent;"
            >
                <h5 class="fw-bold text-theme-gold mb-0">
                    <i class="bi bi-file-earmark-bar-graph-fill me-2"></i>
                    Official Audit Statements
                </h5>
            </div>

            <div class="p-4 pt-2">
                <p class="small text-muted mb-3">
                    View and print the complete certified
                    Collections or Expenditures statement.
                </p>

                <div class="d-flex gap-2 flex-wrap">
                    <button
                        class="btn btn-outline-gold"
                        onclick="openReportModal('collections')"
                    >
                        <i class="bi bi-box-arrow-in-right me-2"></i>
                        View Collections Report
                    </button>

                    <button
                        class="btn btn-outline-gold"
                        onclick="openReportModal('expenditures')"
                    >
                        <i class="bi bi-graph-down-arrow me-2"></i>
                        View Expenditures Report
                    </button>
                </div>
            </div>
        </div>
    </div>

    <div id="messagesView" class="d-none">
        <div class="page-head no-print">
            <div>
                <span class="page-eyebrow">
                    <i class="bi bi-chat-dots-fill"></i>
                    Internal
                </span>
                <h2 class="page-title">Messages</h2>
                <p class="page-subtitle">
                    Direct and group chat with any account on the system.
                </p>
            </div>
        </div>

        <div class="card bg-panel overflow-hidden chat-shell">
            <div class="chat-sidebar">
                <div class="chat-sidebar-header">
                    <button
                        class="btn btn-gold btn-sm w-100 fw-bold"
                        onclick="openNewConversationModal()"
                    >
                        <i class="bi bi-pencil-square me-1"></i>
                        New Message
                    </button>

                    <div class="input-group input-group-sm mt-2">
                        <span class="input-group-text bg-transparent border-end-0">
                            <i class="bi bi-search small text-muted"></i>
                        </span>

                        <input
                            type="text"
                            class="form-control border-start-0"
                            placeholder="Search conversations..."
                            oninput="filterConversationList(this.value)"
                        >
                    </div>
                </div>

                <div
                    class="chat-conversation-list"
                    id="chatConversationList"
                >
                    <p class="text-center text-muted small py-4 mb-0">
                        Loading conversations...
                    </p>
                </div>
            </div>

            <div class="chat-main">
                <div
                    id="chatEmptyState"
                    class="chat-empty-state"
                >
                    <i class="bi bi-chat-heart d-block mb-3"></i>
                    <p class="mb-0">
                        Select a conversation, or start a new one.
                    </p>
                </div>

                <div
                    id="chatActiveThread"
                    class="chat-active-thread d-none"
                >
                    <div class="chat-thread-header">
                        <div
                            class="chat-avatar-circle"
                            id="chatHeaderAvatar"
                        >?</div>

                        <div class="flex-grow-1">
                            <div
                                class="fw-bold text-invert"
                                id="chatHeaderTitle"
                            >&mdash;</div>

                            <div
                                class="small text-invert-muted"
                                id="chatHeaderSubtitle"
                            >&nbsp;</div>
                        </div>

                        <button
                            id="chatHeaderManageBtn"
                            class="btn btn-sm btn-outline-gold d-none"
                            title="Manage Group"
                            onclick="openManageGroupModal()"
                        >
                            <i class="bi bi-gear-fill"></i>
                        </button>
                    </div>

                    <div
                        class="chat-messages"
                        id="chatMessagesBody"
                    ></div>

                    <div class="chat-input-bar">
                        <textarea
                            id="chatMessageInput"
                            class="chat-input"
                            placeholder="Type a message..."
                            rows="1"
                            oninput="autoGrowChatInput(this)"
                            onkeydown="handleChatInputKeydown(event)"
                        ></textarea>

                        <button
                            class="btn btn-gold chat-send-btn"
                            onclick="sendChatMessage()"
                        >
                            <i class="bi bi-send-fill"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <?php if (($_SESSION['role'] ?? '') === 'auditor'): ?>
    <div id="addDocumentView" class="d-none">
        <div class="page-head no-print">
            <div>
                <span class="page-eyebrow"><i class="bi bi-archive-fill"></i>Records &amp; Storage</span>
                <h2 class="page-title">Document &amp; Receipt Vault</h2>
                <p class="page-subtitle">Every scanned receipt, memo, and supporting file &mdash; filed by reference name and category, searchable in one place.</p>
            </div>
            <div class="page-head-actions">
                <button class="btn btn-gold fw-bold" id="openUploadDocBtn" onclick="openUploadDocModal()"><i class="bi bi-cloud-arrow-up-fill me-2"></i>Upload Document</button>
            </div>
        </div>

        <div class="stat-pill-row no-print">
            <div class="stat-pill">
                <i class="bi bi-files"></i>
                <div><b id="vaultStatTotal">0</b> <span class="stat-pill-label">Documents</span></div>
            </div>
            <div class="stat-pill">
                <i class="bi bi-tags-fill"></i>
                <div><b id="vaultStatCategories">0</b> <span class="stat-pill-label">Categories</span></div>
            </div>
            <div class="stat-pill">
                <i class="bi bi-clock-history"></i>
                <div><b id="vaultStatLatest">&mdash;</b> <span class="stat-pill-label">Latest Upload</span></div>
            </div>
        </div>

        <div class="vault-toolbar no-print">
            <div class="input-group vault-search">
                <span class="input-group-text bg-navy-bg border-end-0"><i class="bi bi-search text-muted"></i></span>
                <input type="text" id="vaultSearchInput" class="form-control border-start-0" placeholder="Search documents by name..." oninput="debouncedRenderArchive()">
            </div>
            <select id="vaultCategoryFilter" class="form-select vault-filter" onchange="renderArchive()">
                <option value="">All Categories</option>
            </select>
            <div class="vault-view-toggle" role="group" aria-label="Grid or list view">
                <button type="button" id="vaultGridBtn" class="active" title="Grid view" onclick="setVaultView('grid')"><i class="bi bi-grid-3x3-gap-fill"></i></button>
                <button type="button" id="vaultListBtn" title="List view" onclick="setVaultView('list')"><i class="bi bi-list-ul"></i></button>
            </div>
        </div>

        <div id="vaultGrid" class="vault-grid"></div>

        <div id="vaultListWrap" class="card bg-panel overflow-hidden d-none">
            <div class="table-responsive">
                <table class="table table-hover align-middle mb-0">
                    <thead>
                        <tr>
                            <th class="ps-3">Date</th>
                            <th>Name</th>
                            <th>Category</th>
                            <th>Uploaded By</th>
                            <th>Type</th>
                            <th class="text-end pe-3">Action</th>
                        </tr>
                    </thead>
                    <tbody id="archiveBody"></tbody>
                </table>
            </div>
        </div>

        <div id="vaultEmptyState" class="vault-empty d-none">
            <i class="bi bi-inbox"></i>
            <h6 id="vaultEmptyTitle">No documents yet</h6>
            <p id="vaultEmptyText">Upload your first receipt or memo to start the archive.</p>
        </div>
    </div>

    <?php endif; ?>

    <?php if (isset($_SESSION['role']) && $_SESSION['role'] === 'admin'): ?>
    <div id="adminPanelView">
        <div class="page-head no-print">
            <div>
                <span class="page-eyebrow"><i class="bi bi-shield-lock-fill"></i>Restricted</span>
                <h2 class="page-title">Admin Management Panel</h2>
                <p class="page-subtitle">Budgets, collection categories, user roles, activity logs, and year-end archiving.</p>
            </div>
        </div>

        <div class="card mb-4 bg-sub-panel border-0" style="border-left: 4px solid var(--gold-main) !important;">
            <div class="card-body p-4">
                <h4 class="text-theme-gold fw-bold mb-2"><i class="bi bi-archive me-2"></i>Academic Year Management</h4>
                <p class="text-main mb-3">Save this school year’s financial records in Archives and prepare a fresh collections and expenditures layout for the next school year. <strong>You can view or recover the archived year in a separate workspace.</strong></p>
                <button id="rebootSystemBtn" class="btn btn-gold fw-bold px-4 py-2 shadow-sm">
                    <i class="bi bi-archive me-2"></i>Archive School Year
                </button>
            </div>
        </div>

        <div class="card bg-panel overflow-hidden">
            <div class="card-header border-bottom-0 pt-3 pb-0 px-4" style="background: transparent;">
                <ul class="nav nav-tabs border-bottom-0" id="adminTabs" role="tablist">
                    <li class="nav-item" role="presentation">
                        <button class="nav-link active" id="col-settings-tab" data-bs-toggle="tab" data-bs-target="#col-settings-pane" type="button" role="tab">
                            <i class="bi bi-cash-coin me-2"></i>Collections Config
                        </button>
                    </li>
                    <li class="nav-item" role="presentation">
                        <button class="nav-link" id="users-tab" data-bs-toggle="tab" data-bs-target="#users-pane" type="button" role="tab">
                            <i class="bi bi-people-fill me-2"></i>User Roles
                        </button>
                    </li>
                    <li class="nav-item" role="presentation">
                        <button class="nav-link" id="reset-tab" data-bs-toggle="tab" data-bs-target="#reset-pane" type="button" role="tab" onclick="loadPasswordResetRequests()">
                            <i class="bi bi-key me-2"></i>Password Resets
                            <span id="resetRequestsBadge" class="badge bg-danger d-none ms-1">0</span>
                        </button>
                    </li>
                    <li class="nav-item" role="presentation">
                        <button class="nav-link" id="logs-tab" data-bs-toggle="tab" data-bs-target="#logs-pane" type="button" role="tab">
                            <i class="bi bi-clock-history me-2"></i>System Logs
                        </button>
                    </li>
                </ul>
            </div>

            <div class="card-body bg-sub-panel p-4 border-top" style="border-color: rgba(142, 100, 11, 0.25) !important;">
                <div class="tab-content" id="adminTabsContent">

                    <div class="tab-pane fade show active" id="col-settings-pane" role="tabpanel">
                        <div class="panel-section">
                            <div class="panel-section-header">
                                <h6 class="panel-section-title">Programs &amp; Sections Structure</h6>
                                <button class="btn btn-outline-gold btn-sm fw-bold px-3" onclick="openManageStructureModal()"><i class="bi bi-diagram-3-fill me-2"></i>Manage Structure</button>
                            </div>
                            <p class="text-muted small mb-0">Configure the program names and section rosters exclusively from this admin modal.</p>
                        </div>

                        <div class="panel-section">
                            <div class="panel-section-header">
                                <h6 class="panel-section-title">Dynamic Collection Categories &amp; Fixed Prices</h6>
                                <button class="btn btn-outline-gold btn-sm fw-bold px-3" onclick="openManageCategoriesModal()"><i class="bi bi-tags-fill me-2"></i>Manage Categories</button>
                            </div>
                            <div class="table-responsive rounded">
                                <table class="table table-hover table-sm align-middle mb-0">
                                    <thead>
                                        <tr>
                                            <th class="ps-3">Category Name</th>
                                            <th class="text-end pe-3">Fixed Price (₱)</th>
                                        </tr>
                                    </thead>
                                    <tbody id="adminCategoriesSummaryBody"></tbody>
                                </table>
                            </div>
                        </div>

                        <div class="panel-section">
                            <div class="panel-section-header">
                                <h6 class="panel-section-title">Section Collection Targets</h6>
                                <button id="btn-save-students" class="btn btn-gold btn-sm fw-bold px-3" onclick="saveStudentCounts()"><i class="bi bi-floppy-fill me-2"></i>Save Enrollments</button>
                            </div>
                            <div class="table-responsive rounded">
                                <table class="table table-hover table-sm align-middle mb-0">
                                    <thead class="sticky-top">
                                        <tr>
                                            <th class="ps-3">Section / Program</th>
                                            <th class="text-end" style="width: 140px;">No. of Students</th>
                                            <th class="text-end" style="width: 160px;">Actual Collected</th>
                                            <th class="text-end" style="width: 160px;">Overall Collectibles</th>
                                            <th class="text-center no-print" style="width: 100px;">Breakdown</th>
                                        </tr>
                                    </thead>
                                    <tbody id="adminStudentsBody"></tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <div class="tab-pane fade" id="users-pane" role="tabpanel">
                        <div class="row g-4 justify-content-center">
                            <?php
                            $stmt = $pdo->query("SELECT id, username, role, full_name FROM users ORDER BY FIELD(role, 'admin', 'treasurer', 'auditor') LIMIT 3");
                            $roster = [];

                            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                                $roster[] = $row;
                                $badgeClass = $row['role'] === 'admin'
                                    ? 'bg-crimson'
                                    : ($row['role'] === 'treasurer' ? 'bg-gold' : 'bg-navy');
                                $roleTitle = strtoupper($row['role']);
                            ?>
                            <div class="col-md-4">
                                <div class="panel-section position-relative text-center mt-3">
                                    <span class="badge <?= $badgeClass ?> text-uppercase position-absolute top-0 start-50 translate-middle shadow-sm" style="font-size: 0.75rem; padding: 0.5em 1em; letter-spacing: 1px; color: white !important;">
                                        <?= $roleTitle ?>
                                    </span>

                                    <h6 class="fw-bold mt-4 mb-1 text-theme-gold">Access Configuration</h6>
                                    <p class="text-muted small mb-4" style="font-size: 0.75rem;">Modify credentials for this role</p>

                                    <form action="update_user.php" method="POST" class="text-start">
                                        <input type="hidden" name="user_id" value="<?= $row['id'] ?>">
                                        <input type="hidden" name="role_name" value="<?= $row['role'] ?>">

                                        <div class="mb-3">
                                            <label class="form-label fw-semibold small text-muted mb-1">Assigned Name</label>
                                            <div class="input-group input-group-sm shadow-sm">
                                                <span class="input-group-text bg-navy-bg text-muted border-end-0"><i class="bi bi-person-badge"></i></span>
                                                <input type="text" name="update_fullname" class="form-control border-start-0" value="<?= htmlspecialchars($row['full_name'] ?? '') ?>" placeholder="e.g., Juan Dela Cruz" required>
                                            </div>
                                        </div>

                                        <div class="mb-3">
                                            <label class="form-label fw-semibold small text-muted mb-1">Username</label>
                                            <div class="input-group input-group-sm shadow-sm">
                                                <span class="input-group-text bg-navy-bg text-muted border-end-0"><i class="bi bi-person-fill"></i></span>
                                                <input type="text" name="update_username" class="form-control border-start-0" value="<?= htmlspecialchars($row['username']) ?>" required>
                                            </div>
                                        </div>

                                        <div class="mb-4">
                                            <label class="form-label fw-semibold small text-muted mb-1">New Password</label>
                                            <div class="input-group input-group-sm shadow-sm">
                                                <span class="input-group-text bg-navy-bg text-muted border-end-0"><i class="bi bi-key-fill"></i></span>
                                                <input type="password" name="update_password" class="form-control border-start-0" placeholder="Leave blank to keep current">
                                            </div>
                                        </div>

                                        <button type="submit" class="btn btn-gold fw-bold w-100 btn-sm shadow-sm">Save Changes</button>
                                    </form>
                                </div>
                            </div>
                            <?php } ?>
                        </div>

                        <div class="panel-section mt-4">
                            <h6 class="panel-section-title mb-4"><i class="bi bi-person-lines-fill me-2"></i>ICSSO - Active Personnel</h6>
                            <div class="table-responsive rounded">
                                <table class="table table-hover table-sm align-middle mb-0">
                                    <thead>
                                        <tr>
                                            <th style="width: 20%;" class="ps-3 py-2">System Role</th>
                                            <th style="width: 40%;">Assigned Officer Name</th>
                                            <th style="width: 40%;">Login Username</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <?php foreach ($roster as $person):
                                            $badgeClass = $person['role'] === 'admin'
                                                ? 'bg-crimson'
                                                : ($person['role'] === 'treasurer' ? 'bg-gold' : 'bg-navy');
                                        ?>
                                        <tr>
                                            <td class="ps-3 py-2">
                                                <span class="badge <?= $badgeClass ?> text-uppercase" style="font-size: 0.65rem; color: white !important;"><?= $person['role'] ?></span>
                                            </td>
                                            <td class="fw-bold text-main"><?= htmlspecialchars($person['full_name'] ?? 'Unassigned') ?></td>
                                            <td class="text-muted"><?= htmlspecialchars($person['username']) ?></td>
                                        </tr>
                                        <?php endforeach; ?>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <div class="tab-pane fade" id="reset-pane" role="tabpanel" aria-labelledby="reset-tab">
                        <div class="panel-section recovery-section">
                            <div class="panel-section-header d-flex justify-content-between align-items-center flex-wrap gap-2">
                                <div>
                                    <h6 class="panel-section-title mb-1"><i class="bi bi-shield-lock me-2"></i>Officer Password Reset Requests</h6>
                                    <p class="text-muted small mb-0">Admin-only approval for Treasurer and Auditor accounts. Verify identity before sharing a recovery code.</p>
                                </div>
                                <button type="button" class="btn btn-outline-primary btn-sm" onclick="loadPasswordResetRequests()"><i class="bi bi-arrow-clockwise me-1"></i>Refresh</button>
                            </div>

                            <div class="reset-admin-info mb-3">
                                <i class="bi bi-info-circle-fill"></i>
                                <span>Approved codes expire in <b>30 minutes</b> and appear <b>only once</b>. Share privately with the verified officer. Never post a code in group chat or public channels.</span>
                            </div>

                            <div class="table-responsive">
                                <table class="table table-hover align-middle reset-admin-table">
                                    <thead>
                                        <tr>
                                            <th>Officer</th>
                                            <th>Role</th>
                                            <th>Requested</th>
                                            <th>Status</th>
                                            <th class="text-end">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody id="passwordResetRequestsBody">
                                        <tr><td colspan="5" class="text-muted text-center py-4">Open this tab to load requests.</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <div class="tab-pane fade" id="logs-pane" role="tabpanel">
                        <div class="panel-section">
                            <div class="panel-section-header">
                                <h6 class="panel-section-title">System Activity History</h6>
                                <div class="input-group input-group-sm w-auto shadow-sm">
                                    <span class="input-group-text bg-navy-bg text-muted border-end-0"><i class="bi bi-calendar3"></i></span>
                                    <input type="date" id="logDateFilter" class="form-control border-start-0 fw-bold" onchange="filterLogs()">
                                    <button class="btn btn-outline-crimson" onclick="clearLogFilter()" title="Clear Filter"><i class="bi bi-x-lg"></i></button>
                                </div>
                            </div>

                            <div class="table-responsive rounded" style="max-height: 500px; overflow-y: auto;">
                                <table id="activityLogTable" class="table table-hover align-middle mb-0 text-start" style="font-size: 0.85rem;">
                                    <thead class="sticky-top">
                                        <tr>
                                            <th class="ps-4">Date &amp; Time</th>
                                            <th>User</th>
                                            <th>Role</th>
                                            <th>Action</th>
                                            <th>Details</th>
                                        </tr>
                                    </thead>
                                    <tbody id="logsBody">
                                        <?php
                                        try {
                                            $logStmt = $pdo->query("SELECT * FROM user_logs ORDER BY created_at DESC LIMIT 200");

                                            while ($log = $logStmt->fetch(PDO::FETCH_ASSOC)) {
                                                $badgeColor = $log['role'] === 'admin'
                                                    ? 'bg-crimson'
                                                    : ($log['role'] === 'treasurer' ? 'bg-gold' : 'bg-navy');

                                                $date = date('M d, Y', strtotime($log['created_at']));
                                                $time = date('h:i A', strtotime($log['created_at']));
                                                $filterDate = date('Y-m-d', strtotime($log['created_at']));

                                                $safeUsername = htmlspecialchars($log['username'] ?? '', ENT_QUOTES);
                                                $safeRole = htmlspecialchars($log['role'] ?? '', ENT_QUOTES);
                                                $safeAction = htmlspecialchars($log['action'] ?? '', ENT_QUOTES);
                                                $safeDetails = htmlspecialchars($log['details'] ?? '', ENT_QUOTES);

                                                echo "<tr class='log-row' data-date='{$filterDate}'>";
                                                echo "<td class='text-muted ps-4'><span class='activity-date'>{$date}</span><span class='activity-time'>{$time}</span></td>";
                                                echo "<td class='fw-bold text-main'>{$safeUsername}</td>";
                                                echo "<td><span class='badge {$badgeColor} text-uppercase' style='font-size: 0.65rem; color: white !important;'>{$safeRole}</span></td>";
                                                echo "<td class='fw-bold text-theme-gold'>{$safeAction}</td>";
                                                echo "<td class='text-secondary'>{$safeDetails}</td>";
                                                echo "</tr>";
                                            }
                                        } catch (PDOException $e) {
                                            echo "<tr><td colspan='5' class='text-center text-muted py-3'>Log table not initialized yet.</td></tr>";
                                        }
                                        ?>
                                    </tbody>
                                </table>

                                <div id="noLogsMsg" class="text-center text-muted py-5 d-none">
                                    <i class="bi bi-search fs-3 mb-2 d-block text-secondary opacity-50"></i>
                                    <p class="mb-0 small fw-semibold">No activity logs found for this specific date.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    </div>
    <?php endif; ?>

    <div id="settingsView" class="d-none"><iframe id="settingsFrame" title="Settings" style="display:block;width:100%;min-height:700px;border:0" onload="connectWorkspacePage(this)"></iframe></div>

    <?php if (isset($_SESSION['role']) && $_SESSION['role'] === 'admin'): ?>
    <?php if (($_SESSION['role'] ?? '') === 'admin'): ?>
    <div id="recoveredYearsView" class="d-none">
        <iframe id="recoveredYearsFrame" title="Recovered School Years" style="display:block;width:100%;min-height:700px;border:0" onload="connectRecoveredWorkspace(this)"></iframe>
    </div>
    <?php endif; ?>
    <?php if (($_SESSION['role'] ?? '') === 'admin'): ?>
    <div id="databaseHealthView" class="d-none"><iframe id="databaseHealthFrame" title="Database Health" style="display:block;width:100%;min-height:700px;border:0" onload="connectWorkspacePage(this)"></iframe></div>
    <?php endif; ?>
    <div id="archivesView" class="d-none">
        <div class="page-head no-print">
            <div>
                <span class="page-eyebrow"><i class="bi bi-archive-fill"></i>Records &amp; Storage</span>
                <h2 class="page-title">Historical Archives</h2>
                <p class="page-subtitle">Full collections, budgets, and expenditures from past academic years, plus student clearance lookups and unpaid-student follow-up.</p>
            </div>
        </div>

        <div class="panel-section">
            <h6 class="panel-section-title mb-2"><i class="bi bi-person-check-fill me-2"></i>Student Clearance Lookup</h6>
            <p class="text-muted small mb-3">Search a student's name to see any back-payments they've already settled from past academic years &mdash; check this before clearing them to enroll.</p>

            <div class="input-group shadow-sm mb-3">
                <span class="input-group-text bg-navy-bg text-muted border-end-0"><i class="bi bi-search"></i></span>
                <input type="text" id="clearanceSearchInput" class="form-control" placeholder="Type a student's name..." onkeydown="if(event.key==='Enter'){ event.preventDefault(); searchStudentClearance(); }">
                <button class="btn btn-gold fw-bold px-4" onclick="searchStudentClearance()">Search</button>
            </div>

            <div class="table-responsive rounded" id="clearanceResultsWrap" style="max-height: 260px; overflow-y: auto; display: none;">
                <table class="table table-hover table-sm align-middle mb-0 text-start" style="font-size: 0.85rem;">
                    <thead class="sticky-top">
                        <tr>
                            <th class="ps-3">Student</th>
                            <th>Status</th>
                            <th>Academic Year</th>
                            <th>Section</th>
                            <th>Item</th>
                            <th>Amount</th>
                            <th>Date</th>
                        </tr>
                    </thead>
                    <tbody id="clearanceResultsBody"></tbody>
                </table>
            </div>
        </div>

        <div class="panel-section">
            <div class="panel-section-header">
                <h6 class="panel-section-title">Archived Financial Records</h6>
                <div class="d-flex gap-2 flex-wrap">
                    <div class="input-group input-group-sm w-auto shadow-sm">
                        <span class="input-group-text bg-navy-bg text-muted border-end-0"><i class="bi bi-calendar-event"></i></span>
                        <select id="archiveYearSelect" class="form-select border-start-0 fw-bold" onchange="fetchArchiveData()">
                            <option value="">Select Academic Year...</option>
                        </select>
                        <button class="btn btn-outline-gold" onclick="fetchArchiveYears()" title="Refresh Years"><i class="bi bi-arrow-clockwise"></i></button>
                    </div>
                    <button type="button" id="recoverYearButton" class="btn btn-outline-gold fw-bold btn-sm" onclick="recoverArchiveYear()"><i class="bi bi-arrow-counterclockwise me-1"></i>Recover / Open Year</button>
                    <button class="btn btn-gold fw-bold btn-sm" onclick="openFullArchiveRecords()" title="Opens the complete records for the selected year in a new browser tab">
                        <i class="bi bi-box-arrow-up-right me-1"></i>View Full Records
                    </button>
                </div>
            </div>

            <div id="archiveYearSummary" class="row g-3 mb-4 d-none">
                <div class="col-md-4">
                    <div class="stat-card stat-card-gold">
                        <div class="stat-card-icon"><i class="bi bi-piggy-bank-fill"></i></div>
                        <div>
                            <h6 class="stat-card-label">Total Collected</h6>
                            <h2 id="archYearTotalCollected" class="stat-card-value">₱ 0.00</h2>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="stat-card stat-card-navy">
                        <div class="stat-card-icon"><i class="bi bi-wallet2"></i></div>
                        <div>
                            <h6 class="stat-card-label">Total Budget Allocated</h6>
                            <h2 id="archYearTotalBudget" class="stat-card-value">₱ 0.00</h2>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="stat-card stat-card-crimson">
                        <div class="stat-card-icon"><i class="bi bi-graph-down-arrow"></i></div>
                        <div>
                            <h6 class="stat-card-label">Total Spent</h6>
                            <h2 id="archYearTotalSpent" class="stat-card-value">₱ 0.00</h2>
                        </div>
                    </div>
                </div>
            </div>

            <div class="panel-section-header mb-2">
                <h6 class="fw-bold mb-0 text-theme-crimson"><i class="bi bi-person-x-fill me-2"></i>Unpaid Students &mdash; Needs Follow-up</h6>
                <button class="btn btn-outline-gold btn-sm" onclick="openAddUnpaidToArchiveModal()"><i class="bi bi-plus-circle-fill me-1"></i>Add Unpaid Student</button>
            </div>

            <div class="table-responsive mb-4 rounded" style="max-height: 300px; overflow-y: auto;">
                <table class="table table-hover table-sm align-middle mb-0 text-start" style="font-size: 0.85rem;">
                    <thead class="sticky-top">
                        <tr>
                            <th class="ps-3">Student</th>
                            <th>Section</th>
                            <th>Unpaid For</th>
                            <th class="text-end">Fee at Archive</th><th class="text-end">Paid at Archive</th><th class="text-end">Due at Archive</th><th class="text-end">Current Due</th><th>Notes</th>
                            <th>Status</th>
                            <th class="text-center no-print" style="width: 100px;">Action</th>
                        </tr>
                    </thead>
                    <tbody id="unpaidStudentsBody">
                        <tr><td colspan="10" class="text-center text-muted py-4">Select a year to view records.</td></tr>
                    </tbody>
                </table>
            </div>

            <h6 class="fw-bold mb-2 text-theme-gold"><i class="bi bi-box-arrow-in-right me-2"></i>Archived Collections</h6>
            <div class="table-responsive mb-4 rounded" style="max-height: 300px; overflow-y: auto;">
                <table class="table table-hover table-sm align-middle mb-0 text-start" style="font-size: 0.85rem;">
                    <thead class="sticky-top">
                        <tr>
                            <th class="ps-3">Item Key</th>
                            <th>Categories Breakdown</th>
                            <th>Remarks</th>
                            <th>Date Archived</th>
                            <th class="text-center no-print" style="width: 110px;">Action</th>
                        </tr>
                    </thead>
                    <tbody id="archiveCollectionsBody">
                        <tr><td colspan="5" class="text-center text-muted py-4">Select a year to view records.</td></tr>
                    </tbody>
                </table>
            </div>

            <h6 class="fw-bold mb-2 text-theme-gold"><i class="bi bi-wallet2 me-2"></i>Archived Budgets</h6>
            <div class="table-responsive mb-4 rounded" style="max-height: 300px; overflow-y: auto;">
                <table class="table table-hover table-sm align-middle mb-0 text-start" style="font-size: 0.85rem;">
                    <thead class="sticky-top">
                        <tr>
                            <th class="ps-3">Item Key</th>
                            <th>Allocated Amount</th>
                            <th>Date Archived</th>
                        </tr>
                    </thead>
                    <tbody id="archiveBudgetsBody">
                        <tr><td colspan="3" class="text-center text-muted py-4">Select a year to view records.</td></tr>
                    </tbody>
                </table>
            </div>

            <h6 class="fw-bold mb-2 text-theme-gold"><i class="bi bi-graph-down-arrow me-2"></i>Archived Expenditures</h6>
            <div class="table-responsive rounded" style="max-height: 300px; overflow-y: auto;">
                <table class="table table-hover table-sm align-middle mb-0 text-start" style="font-size: 0.85rem;">
                    <thead class="sticky-top">
                        <tr>
                            <th class="ps-3">Item Key</th>
                            <th>Amount Spent</th>
                            <th>Remarks</th>
                            <th>Date Archived</th>
                        </tr>
                    </thead>
                    <tbody id="archiveExpendituresBody">
                        <tr><td colspan="4" class="text-center text-muted py-4">Select a year to view records.</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
    <?php endif; ?>

    <footer class="system-footer" aria-label="System information">
    <?php include __DIR__ . '/system_credits.php'; ?>
    <span>CICS &middot; Fund &amp; Audit System</span>
</footer>

</div>

<!-- Consolidated history from every section -->
<div class="modal fade" id="allRemittancesModal" tabindex="-1" aria-labelledby="allRemittancesTitle" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered modal-xl modal-dialog-scrollable">
        <div class="modal-content rounded-4">
            <div class="modal-header">
                <div>
                    <h6 class="modal-title fw-bold text-theme-gold mb-1" id="allRemittancesTitle">Overall Daily Remittance History</h6>
                    <small class="text-muted">All programs, year levels and sections</small>
                </div>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>

            <div class="modal-body p-4">
                <div class="d-flex gap-2 justify-content-end mb-3">
                    <button id="allRemittancesRefresh" type="button" class="btn btn-sm btn-outline-primary" onclick="loadAllRemittances()">
                        <i class="bi bi-arrow-clockwise me-1"></i>Refresh
                    </button>
                    <button id="allRemittancesPrint" type="button" class="btn btn-sm btn-gold" onclick="printAllRemittances()" disabled>
                        <i class="bi bi-printer me-1"></i>Print / Save as PDF
                    </button>
                </div>

                <div class="rounded border p-3 mb-3">
                    <h6 class="fw-bold text-theme-gold mb-2">Report Signatories</h6>
                    <p class="small text-muted mb-3">Admin defaults fill these fields. Edit names and positions for this report, or clear a name for an empty signature line.</p>

                    <div class="row g-3">
                        <div class="col-md-6 col-xl-3">
                            <label for="remittancePreparedBy" class="form-label">Prepared by</label>
                            <input type="text" id="remittancePreparedBy" data-report-preparer="treasurer" class="form-control" maxlength="150" placeholder="Full name" data-report-signatory="prepared">
<label for="remittancePreparedPosition" class="visually-hidden">Prepared by position</label><input id="remittancePreparedPosition" data-report-preparer="treasurer" class="form-control form-control-sm mt-2" type="text" maxlength="100" data-report-position="prepared" placeholder="Position / title (optional)">
                        </div>
                        <div class="col-md-6 col-xl-3">
                            <label for="remittanceCertifiedBy" class="form-label">Certified by</label>
                            <input type="text" id="remittanceCertifiedBy" class="form-control" maxlength="150" placeholder="Full name" data-report-signatory="certified">
<label for="remittanceCertifiedPosition" class="visually-hidden">Certified by position</label><input id="remittanceCertifiedPosition" class="form-control form-control-sm mt-2" type="text" maxlength="100" data-report-position="certified" placeholder="Position / title (optional)">
                        </div>
                        <div class="col-md-6 col-xl-3">
                            <label for="remittanceNotedBy" class="form-label">Noted by</label>
                            <input type="text" id="remittanceNotedBy" class="form-control" maxlength="150" placeholder="Full name" data-report-signatory="noted">
<label for="remittanceNotedPosition" class="visually-hidden">Noted by position</label><input id="remittanceNotedPosition" class="form-control form-control-sm mt-2" type="text" maxlength="100" data-report-position="noted" placeholder="Position / title (optional)">
                        </div>
                        <div class="col-md-6 col-xl-3">
                            <label for="remittanceApprovedBy" class="form-label">Approved by</label>
                            <input type="text" id="remittanceApprovedBy" class="form-control" maxlength="150" placeholder="Full name" data-report-signatory="approved">
<label for="remittanceApprovedPosition" class="visually-hidden">Approved by position</label><input id="remittanceApprovedPosition" class="form-control form-control-sm mt-2" type="text" maxlength="100" data-report-position="approved" placeholder="Position / title (optional)">
                        </div>
                    </div>
                </div>

                <p id="allRemittancesStatus" role="status" aria-live="polite" class="small text-muted">Loading all remittances…</p>
                <p class="small text-muted">Every recorded section remittance appears here, newest remittance date first. Earlier cycles and cleared entries remain labelled for reference; report totals exclude them.</p>

                <div class="remittance-history-wrap">
                    <table class="table remittance-history-table remittance-history-overall">
                        <colgroup>
                            <col style="width:11%">
                            <col style="width:21%">
                            <col style="width:24%">
                            <col style="width:18%">
                            <col style="width:12%">
                            <col style="width:14%">
                        </colgroup>
                        <thead>
                            <tr>
                                <th>Date / Status</th>
                                <th>Section / Program</th>
                                <th>Remittance Details</th>
                                <th>Category Breakdown</th>
                                <th class="text-end">Total</th>
                                <th>Recorded By</th>
                            </tr>
                        </thead>
                        <tbody id="allRemittancesRows"></tbody>
                    </table>
                </div>
            </div>

            <div class="modal-footer">
                <button type="button" class="btn btn-gold btn-sm px-4" data-bs-dismiss="modal">Done</button>
            </div>
        </div>
    </div>
</div>

<!-- Category Input Modal for Total Collected -->
<div class="modal fade" id="sectionCollectionModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered modal-xl modal-dialog-scrollable">
        <div class="modal-content rounded-4">
            <div class="modal-header">
                <div>
                    <h6 class="modal-title fw-bold text-theme-gold text-uppercase mb-0" id="scmTitle">Category Collection Details</h6>
                    <small class="text-muted" id="scmSubtitle">&mdash;</small>
                </div>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>

            <div class="modal-body p-4">
                <p class="small text-muted">Running totals include existing opening balances. Record each new classroom remittance below; totals update after saving.</p>

                <div class="table-responsive rounded">
                    <table class="table table-sm align-middle mb-0">
                        <thead class="table-dark">
                            <tr>
                                <th class="ps-3">Category</th>
                                <th class="text-end" style="width: 140px;">Rate (₱)</th>
                                <th class="text-end" style="width: 160px;">Total Collectible (₱)</th>
                                <th class="text-end" style="width: 180px;">Amount Collected (₱)</th>
                                <th class="text-end pe-3" style="width: 160px;">Balance (₱)</th>
                            </tr>
                        </thead>
                        <tbody id="scmBody"></tbody>
                        <tfoot class="table-dark text-end fw-bold">
                            <tr>
                                <td colspan="2" class="ps-3">TOTAL:</td>
                                <td id="scmTotCollectible" class="text-theme-gold">₱ 0.00</td>
                                <td id="scmTotCollected" class="text-strong">₱ 0.00</td>
                                <td id="scmTotBalance" class="text-theme-crimson pe-3">₱ 0.00</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <hr>

                <div id="srmStatus" class="small mb-3" role="status" aria-live="polite"></div>

                <form id="srmForm" onsubmit="saveSectionRemittance(event)" class="d-none">
                    <h6 class="fw-bold text-theme-gold">Record Daily Remittance</h6>

                    <div class="row g-3 mb-3">
                        <div class="col-md-6">
                            <label class="form-label" for="srmDirection">Movement</label>
                            <select id="srmDirection" class="form-select" onchange="setRemittanceLabels()">
                                <option value="classroom">Classroom treasurer → Organization treasurer</option>
                                <option value="organization">Organization treasurer → Fund custodian</option>
                            </select>
                        </div>

                        <div class="col-md-6">
                            <label class="form-label" for="srmDate">Date remitted</label>
                            <input id="srmDate" type="date" class="form-control" required>
                        </div>

                        <div class="col-md-6">
                            <label id="srmFromLabel" class="form-label" for="srmFrom">Classroom treasurer's full name</label>
                            <input id="srmFrom" class="form-control" maxlength="150" required>
                        </div>

                        <div class="col-md-6">
                            <label id="srmToLabel" class="form-label" for="srmTo">Receiving organization treasurer's full name</label>
                            <input id="srmTo" class="form-control" maxlength="150" required>
                        </div>
                    </div>

                    <p class="small text-muted">The program, year and section are taken from the section opened above. Enter only the amounts handed over on this date.</p>

                    <div id="srmAmounts" class="row g-3 mb-3"></div>

                    <div class="row g-3 mb-3">
                        <div class="col-md-4">
                            <label class="form-label" for="srmReference">Acknowledgment / receipt no. (optional)</label>
                            <input id="srmReference" class="form-control" maxlength="100">
                        </div>
                        <div class="col-md-8">
                            <label class="form-label" for="srmNote">Notes (optional)</label>
                            <input id="srmNote" class="form-control" maxlength="500">
                        </div>
                    </div>

                    <button id="srmSave" type="submit" class="btn btn-gold mb-3">Save Remittance</button>
                </form>

                <div class="d-flex justify-content-between align-items-center">
                    <h6 class="fw-bold mt-3">Daily Remittance History</h6>
                    <button type="button" class="btn btn-sm btn-outline-primary" onclick="printSectionRemittances()">
                        <i class="bi bi-printer me-1"></i>Print / Save as PDF
                    </button>
                </div>

                <p class="small text-muted">Classroom receipts increase collections. Organization remittances record cash movement only. Earlier cycles and cleared entries remain in this history. Entries marked Cleared are excluded from the new balance.</p>

                <div class="remittance-history-wrap">
                    <table class="table remittance-history-table">
                        <colgroup>
                            <col style="width:13%">
                            <col style="width:29%">
                            <col style="width:25%">
                            <col style="width:15%">
                            <col style="width:18%">
                        </colgroup>
                        <thead>
                            <tr>
                                <th>Date / Status</th>
                                <th>Remittance Details</th>
                                <th>Category Breakdown</th>
                                <th class="text-end">Total</th>
                                <th>Recorded By</th>
                            </tr>
                        </thead>
                        <tbody id="srmHistory"></tbody>
                    </table>
                </div>
            </div>

            <div class="modal-footer">
                <button type="button" class="btn btn-gold btn-sm px-4 fw-bold" data-bs-dismiss="modal">Done</button>
            </div>
        </div>
    </div>
</div>

<!-- Admin Section Target Breakdown Modal -->
<div class="modal fade" id="sectionBreakdownModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content rounded-4">
            <div class="modal-header">
                <div>
                    <h6 class="modal-title fw-bold text-theme-gold text-uppercase mb-0" id="sbmTitle">Section Target Breakdown</h6>
                    <small class="text-muted" id="sbmSubtitle">&mdash;</small>
                </div>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>

            <div class="modal-body p-4">
                <div class="table-responsive rounded border" style="border-color: var(--hairline) !important;">
                    <table class="table table-sm align-middle mb-0">
                        <thead class="table-dark">
                            <tr>
                                <th class="ps-3">Category Name</th>
                                <th class="text-end" style="width: 150px;">Rate (₱)</th>
                                <th class="text-end" style="width: 170px;">Total Collectible (₱)</th>
                                <th class="text-end" style="width: 170px;">Amount Collected (₱)</th>
                                <th class="text-end pe-3" style="width: 150px;">Balance (₱)</th>
                            </tr>
                        </thead>
                        <tbody id="sbmBody"></tbody>
                        <tfoot class="table-dark text-end fw-bold">
                            <tr>
                                <td colspan="2" class="ps-3">TOTAL:</td>
                                <td id="sbmTotTarget" class="text-theme-gold">₱ 0.00</td>
                                <td id="sbmTotCollected" class="text-strong">₱ 0.00</td>
                                <td id="sbmTotBalance" class="text-theme-crimson pe-3">₱ 0.00</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            <div class="modal-footer">
                <button type="button" class="btn btn-gold btn-sm px-4 fw-bold" data-bs-dismiss="modal">Close</button>
            </div>
        </div>
    </div>
</div>

<div class="modal fade" id="remarksModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header">
                <h6 class="modal-title fw-bold text-theme-gold text-uppercase" id="remarksModalTitle" style="font-size: 0.85rem;">Section Remarks</h6>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body py-4">
                <p id="remarksModalContent" class="mb-0 text-main" style="line-height: 1.6;"></p>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-navy btn-sm px-4 fw-bold" data-bs-dismiss="modal">Close</button>
            </div>
        </div>
    </div>
</div>

<?php if (($_SESSION['role'] ?? '') === 'auditor'): ?>
<div class="modal fade" id="filePreviewModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content rounded-4">
            <div class="modal-header">
                <div class="d-flex align-items-center gap-3">
                    <div class="modal-icon-avatar">
                        <i class="bi bi-file-earmark-text-fill" id="previewIcon"></i>
                    </div>
                    <div class="modal-header-text">
                        <h6 class="modal-title fw-bold text-theme-gold mb-0" id="previewTitle">Document Preview</h6>
                        <div class="modal-header-subtitle" id="previewSubtitle">&nbsp;</div>
                    </div>
                </div>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>

            <div class="preview-meta-row no-print">
                <span class="badge bg-gold text-uppercase" id="previewCategoryBadge">&mdash;</span>
                <span class="small text-invert-muted" id="previewDateLabel">&mdash;</span>
            </div>

            <div class="modal-body p-0 text-center bg-navy-bg" style="min-height: 400px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                <img id="previewImage" src="" alt="Preview" class="img-fluid d-none" style="max-height: 70vh; object-fit: contain;">
                <iframe id="previewPDF" src="" class="d-none w-100" style="height: 70vh; border: none;"></iframe>

                <div id="downloadPrompt" class="d-none p-5">
                    <i class="bi bi-file-earmark-arrow-down fs-1 text-theme-gold mb-3 d-block"></i>
                    <p>This file type cannot be previewed directly.</p>
                    <a id="downloadLink" href="#" class="btn btn-gold fw-bold" download>Download File</a>
                </div>
            </div>

            <div class="modal-footer">
                <button type="button" id="previewDeleteBtn" class="btn btn-outline-crimson me-auto" onclick="deleteDocFromPreview()">
                    <i class="bi bi-trash3-fill me-1"></i>Delete
                </button>
                <a id="previewDownloadBtn" href="#" download class="btn btn-outline-gold">
                    <i class="bi bi-download me-1"></i>Download
                </a>
                <button type="button" class="btn btn-navy" data-bs-dismiss="modal">Close</button>
            </div>
        </div>
    </div>
</div>

<div class="modal fade" id="uploadDocModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content rounded-4">
            <div class="modal-header">
                <div class="d-flex align-items-center gap-3">
                    <div class="modal-icon-avatar">
                        <i class="bi bi-cloud-arrow-up-fill"></i>
                    </div>
                    <div class="modal-header-text">
                        <h6 class="modal-title fw-bold text-theme-gold mb-0">Upload Document</h6>
                        <div class="modal-header-subtitle">Add a receipt or supporting file to the archive</div>
                    </div>
                </div>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>

            <div class="modal-body p-4">
                <div class="mb-3">
                    <label class="form-label small fw-semibold">Reference Name</label>
                    <input type="text" id="docName" class="form-control" placeholder="e.g., OR #4821 - Orientation Sound System">
                </div>

                <div class="mb-3">
                    <label for="docCategory" class="form-label small fw-semibold">Item Description</label>
                    <select id="docCategory" class="form-select"></select>
                </div>

                <div class="mb-1">
                    <label class="form-label small fw-semibold">File</label>

                    <div class="dropzone" id="docDropzone">
                        <i class="bi bi-cloud-arrow-up"></i>
                        <div class="dz-title">Drag &amp; drop, or click to browse</div>
                        <div class="dz-sub">Images, PDF, Word, Excel, TXT or CSV · up to 8 MB</div>
                        <input type="file" id="docFile" accept=".png,.jpg,.jpeg,.webp,.gif,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx" onchange="handleDocFileChosen()">
                    </div>

                    <div id="dzFileChip" class="dz-file-chip d-none">
                        <i class="bi bi-file-earmark-check-fill"></i>
                        <div class="flex-grow-1 overflow-hidden">
                            <div class="dz-file-name" id="dzFileName">&mdash;</div>
                            <div class="dz-file-meta" id="dzFileMeta">&mdash;</div>
                        </div>
                        <button type="button" onclick="clearDocFile(event)" title="Remove selected file">
                            <i class="bi bi-x-lg"></i>
                        </button>
                    </div>
                </div>
            </div>

            <div class="modal-footer">
                <button type="button" class="btn btn-navy" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-gold fw-bold" onclick="saveDocument()">
                    <i class="bi bi-check-circle-fill me-1"></i>Save to Archive
                </button>
            </div>
        </div>
    </div>
</div>

<?php endif; ?>

<div class="modal fade" id="reportPreviewModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content rounded-4">
            <div class="modal-header no-print">
                <h6 class="modal-title fw-bold text-theme-gold" id="reportModalTitle">
                    <i class="bi bi-file-earmark-bar-graph-fill me-2"></i>Report
                </h6>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>

            <div class="modal-body p-4" style="max-height: 70vh; overflow-y: auto;">
                <div class="report-paper" id="reportModalBody"></div>
            </div>

            <div class="modal-footer no-print">
                <button type="button" class="btn btn-navy" data-bs-dismiss="modal">Close</button>
                <button type="button" class="btn btn-gold fw-bold" id="reportModalPrintBtn" onclick="printReport(currentReportModalType)">
                    <i class="bi bi-printer me-1"></i>Print
                </button>
            </div>
        </div>
    </div>
</div>

<div class="modal fade" id="newConversationModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content rounded-4">
            <div class="modal-header">
                <h6 class="modal-title fw-bold text-theme-gold">
                    <i class="bi bi-pencil-square me-2"></i>New Message
                </h6>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>

            <div class="modal-body p-4">
                <label class="form-label small fw-semibold">To:</label>
                <div id="newConvoUserList" class="new-convo-user-list mb-3">
                    <p class="text-center text-muted small py-3 mb-0">Loading people...</p>
                </div>

                <div id="newConvoGroupTitleWrap" class="d-none">
                    <label class="form-label small fw-semibold">Group Name (optional)</label>
                    <input type="text" id="newConvoGroupTitle" class="form-control" placeholder="e.g., Officers Chat">
                </div>
            </div>

            <div class="modal-footer">
                <button type="button" class="btn btn-navy" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-gold fw-bold" id="newConvoStartBtn" onclick="startNewConversation()">
                    <i class="bi bi-chat-dots-fill me-1"></i>Start Chat
                </button>
            </div>
        </div>
    </div>
</div>

<div class="modal fade" id="manageGroupModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content rounded-4">
            <div class="modal-header">
                <h6 class="modal-title fw-bold text-theme-gold">
                    <i class="bi bi-gear-fill me-2"></i>Manage Group
                </h6>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>

            <div class="modal-body p-4">
                <label class="form-label small fw-semibold">Group Name</label>
                <div class="input-group mb-1">
                    <input type="text" id="manageGroupTitleInput" class="form-control" placeholder="Group name">
                    <button type="button" id="manageGroupRenameBtn" class="btn btn-outline-gold" onclick="renameGroupChat()">Rename</button>
                </div>
                <p id="manageGroupAdminOnlyNote" class="small text-muted mb-3 d-none">Only an admin can rename this group.</p>

                <hr class="my-3">

                <div class="d-flex justify-content-between align-items-center mb-2">
                    <label class="form-label small fw-semibold mb-0">Members</label>
                    <button type="button" id="manageGroupAddSection" class="btn btn-sm btn-outline-gold d-none" onclick="openAddMembersPicker()">
                        <i class="bi bi-person-plus-fill me-1"></i>Add People
                    </button>
                </div>

                <div id="manageGroupMemberList" class="new-convo-user-list mb-2"></div>

                <div id="manageGroupAddPicker" class="d-none border-top pt-3 mt-2">
                    <label class="form-label small fw-semibold">Add to group:</label>
                    <div id="manageGroupAddUserList" class="new-convo-user-list mb-2"></div>
                    <button type="button" class="btn btn-gold btn-sm w-100 fw-bold" onclick="confirmAddMembers()">Add Selected</button>
                </div>
            </div>

            <div class="modal-footer justify-content-between">
                <button type="button" class="btn btn-outline-crimson btn-sm" onclick="leaveGroupChat()">
                    <i class="bi bi-box-arrow-left me-1"></i>Leave Group
                </button>
                <button type="button" id="manageGroupDeleteBtn" class="btn btn-crimson btn-sm d-none" onclick="deleteGroupChat()">
                    <i class="bi bi-trash3-fill me-1"></i>Delete Group Chat
                </button>
            </div>
        </div>
    </div>
</div>

<!-- Admin Only: Manage Categories Modal -->
<div class="modal fade" id="manageCategoriesModal" tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
    <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content rounded-4">
            <div class="modal-header">
                <h6 class="modal-title fw-bold text-theme-gold">
                    <i class="bi bi-tags-fill me-2"></i>Manage Collection Categories
                </h6>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>

            <div class="modal-body p-4">
                <div class="table-responsive rounded mb-3 border" style="max-height: 400px; overflow-y: auto; border-color: var(--hairline) !important;">
                    <table class="table table-sm align-middle mb-0" style="font-size: 0.85rem;">
                        <thead class="sticky-top table-dark">
                            <tr>
                                <th class="ps-3">Category Name</th>
                                <th style="width: 200px;">Fixed Price (₱)</th>
                                <th class="text-center" style="width: 80px;">Action</th>
                            </tr>
                        </thead>
                        <tbody id="manageCategoriesModalBody"></tbody>
                    </table>
                </div>

                <button type="button" class="btn btn-outline-gold btn-sm fw-bold" onclick="addCategoryModalRow()">
                    <i class="bi bi-plus-circle-fill me-1"></i>Add Category
                </button>
            </div>

            <div class="modal-footer">
                <button type="button" class="btn btn-navy" data-bs-dismiss="modal">Cancel</button>
                <button type="button" id="btn-save-col-modal" class="btn btn-gold fw-bold" onclick="saveCategoriesFromModal()">
                    <i class="bi bi-floppy-fill me-1"></i>Save Categories
                </button>
            </div>
        </div>
    </div>
</div>

<!-- Admin Only: Manage Structure Modal -->
<div class="modal fade" id="manageStructureModal" tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
    <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content rounded-4">
            <div class="modal-header">
                <h6 class="modal-title fw-bold text-theme-gold">
                    <i class="bi bi-diagram-3-fill me-2"></i>Manage Programs &amp; Sections
                </h6>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>

            <div class="modal-body p-4">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <p class="text-main small mb-0">Add programs or sections and update names. Changes are saved automatically.</p>
                    <button type="button" class="btn-outline-gold btn-sm fw-bold btn" onclick="structAddDepartment()">
                        <i class="bi bi-building-add me-1"></i>Add Program
                    </button>
                </div>

                <div class="table-responsive rounded border" style="max-height: 500px; overflow-y: auto; border-color: var(--hairline) !important;">
                    <table class="table table-hover align-middle mb-0" style="font-size: 0.85rem;">
                        <tbody id="manageStructureModalBody"></tbody>
                    </table>
                </div>
            </div>

            <div class="modal-footer">
                <button type="button" class="btn btn-gold fw-bold px-4" data-bs-dismiss="modal">Done</button>
            </div>
        </div>
    </div>
</div>

<div class="modal fade" id="manageExpModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content rounded-4">
            <div class="modal-header">
                <h6 class="modal-title fw-bold text-theme-gold">
                    <i class="bi bi-calendar-plus me-2"></i>Add / Remove Item Category
                </h6>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>

            <div class="modal-body p-4">
                <div class="mb-4">
                    <h6 class="fw-bold text-main mb-3">Add New Item / Category</h6>
                    <div class="input-group shadow-sm">
                        <input type="text" id="newExpNameInput" class="form-control" placeholder="e.g., General Assembly">
                        <button class="btn btn-gold fw-bold px-4" onclick="confirmAddExp()">Add</button>
                    </div>
                </div>

                <hr class="text-muted opacity-25 my-4">

                <div>
                    <h6 class="fw-bold text-theme-crimson mb-3">Remove Existing Item / Category</h6>
                    <div class="input-group shadow-sm">
                        <select id="removeExpSelect" class="form-select text-main fw-semibold"></select>
                        <button class="btn btn-crimson fw-bold px-3" onclick="confirmRemoveExp()">Remove</button>
                    </div>
                    <div class="form-text text-theme-crimson mt-2">
                        <i class="bi bi-exclamation-triangle-fill me-1"></i>Removes the item/category and its budget entries. Items with recorded spending or transaction history must be archived instead.
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<div class="modal fade" id="recordPaymentModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content rounded-4">
            <div class="modal-header">
                <h6 class="modal-title fw-bold text-theme-gold">
                    <i class="bi bi-cash-coin me-2"></i>Record Late Payment
                </h6>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>

            <div class="modal-body p-4">
                <p class="small text-invert-muted mb-3">
                    Settling <strong id="rpSectionLabel" class="text-theme-gold">&mdash;</strong>
                    &middot; AY <strong id="rpYearLabel" class="text-theme-gold">&mdash;</strong>
                </p>

                <input type="hidden" id="rpItemKey">
                <input type="hidden" id="rpAcademicYear">
                <input type="hidden" id="rpUnpaidStudentId" value="">

                <div class="mb-3">
                    <label class="form-label small fw-semibold">Student Name</label>
                    <input type="text" id="rpStudentName" class="form-control" placeholder="e.g., Juan Dela Cruz">
                </div>
                <div class="mb-3">
                    <label class="form-label small fw-semibold">Item / Category Being Paid</label>
                    <select id="rpCategorySelect" class="form-select" onchange="rpFillAmount()"></select>
                </div>
                <div class="mb-3">
                    <label class="form-label small fw-semibold">Amount Received (₱)</label>
                    <input type="number" id="rpAmount" class="form-control" value="0" min="0" step="0.01">
                </div>
                <div class="mb-1">
                    <label class="form-label small fw-semibold">Notes (optional)</label>
                    <textarea id="rpNotes" class="form-control" rows="2" placeholder="e.g., OR #1234, paid in cash"></textarea>
                </div>
            </div>

            <div class="modal-footer">
                <button type="button" class="btn btn-navy" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-gold fw-bold" onclick="submitLatePayment()">
                    <i class="bi bi-check-circle-fill me-1"></i>Confirm Payment
                </button>
            </div>
        </div>
    </div>
</div>

<div class="modal fade" id="paymentHistoryModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content rounded-4">
            <div class="modal-header">
                <h6 class="modal-title fw-bold text-theme-gold">
                    <i class="bi bi-clock-history me-2"></i>Late Payment History &mdash;
                    <span id="phSectionLabel"></span>
                </h6>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>

            <div class="modal-body p-4">
                <div class="table-responsive rounded" style="max-height: 350px; overflow-y: auto;">
                    <table class="table table-sm table-hover align-middle mb-0 text-start" style="font-size: 0.85rem;">
                        <thead class="sticky-top">
                            <tr>
                                <th>Student</th>
                                <th>Item</th>
                                <th>Amount</th>
                                <th>Date</th>
                                <th class="no-print"></th>
                            </tr>
                        </thead>
                        <tbody id="paymentHistoryBody">
                            <tr><td colspan="5" class="text-center text-muted py-3">Loading...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
</div>

<div class="modal fade" id="flagUnpaidModal" tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
    <div class="modal-dialog modal-dialog-centered modal-xl modal-dialog-scrollable">
        <div class="modal-content rounded-4">
            <div class="modal-header">
                <h6 class="modal-title fw-bold text-theme-gold">
                    <i class="bi bi-person-x-fill me-2"></i>Flag Unpaid Students &mdash; AY
                    <span id="fuYearLabel"></span>
                </h6>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>

            <div class="modal-body p-4">
                <p class="text-main small mb-3">Saved unpaid names from Collections appear here with their section and category. Review their current payment status, add any missing students, and remove entries that no longer need follow-up.</p>

                <div class="archive-roster-toolbar mb-3">
                    <div><span class="archive-roster-kicker">COLLECTIONS → ARCHIVE</span><div id="archiveRosterSummary" class="fw-bold mt-1">Loading roster…</div></div>
                    <button type="button" id="archiveRosterReload" class="btn btn-outline-primary btn-sm" onclick="reloadArchiveUnpaidLists()"><i class="bi bi-arrow-clockwise me-1"></i>Reload Lists</button>
                </div>
                <p id="archiveRosterStatus" class="small text-muted" role="status" aria-live="polite"></p>
                <div class="table-responsive archive-roster-table mb-3">
                    <table class="table align-middle mb-0">
                        <thead>
                            <tr>
                                <th style="width:25%;min-width:230px;">Student Name</th>
                                <th style="width:32%;min-width:260px;">Section / Program</th>
                                <th style="width:18%;min-width:160px;">Unpaid For</th>
                                <th style="min-width:120px;">Fee (₱)</th><th style="min-width:130px;">Amount Paid (₱)</th><th style="min-width:130px;">Remaining (₱)</th><th style="min-width:180px;">Notes</th>
                                <th style="width:40px;"></th>
                            </tr>
                        </thead>
                        <tbody id="flagUnpaidBody"></tbody>
                    </table>
                </div>

                <button type="button" id="archiveRosterAdd" class="btn btn-outline-primary btn-sm fw-bold" onclick="addUnpaidRow()" disabled>
                    <i class="bi bi-plus-circle-fill me-1"></i>Add Student
                </button>
            </div>

            <div class="modal-footer">
                <button type="button" id="archiveRosterSkip" class="btn btn-outline-secondary" onclick="skipUnpaidFlagging()" disabled>Continue without flags</button>
                <button type="button" id="archiveRosterContinue" class="btn btn-gold fw-bold" onclick="proceedToArchiveConfirm()" disabled>
                    <i class="bi bi-arrow-right-circle-fill me-1"></i>Continue to Archive
                </button>
            </div>
        </div>
    </div>
</div>

<div class="modal fade" id="addUnpaidModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content rounded-4">
            <div class="modal-header">
                <h6 class="modal-title fw-bold text-theme-gold">
                    <i class="bi bi-person-x-fill me-2"></i>Add Unpaid Student
                </h6>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>

            <div class="modal-body p-4">
                <p class="small text-invert-muted mb-3">
                    AY <strong id="auYearLabel" class="text-theme-gold">&mdash;</strong>
                </p>

                <div class="mb-3">
                    <label class="form-label small fw-semibold">Student Name</label>
                    <input type="text" id="auStudentName" class="form-control" placeholder="e.g., Juan Dela Cruz">
                </div>
                <div class="mb-3">
                    <label class="form-label small fw-semibold">Section</label>
                    <select id="auSectionSelect" class="form-select"></select>
                </div>
                <div class="mb-3">
                    <label class="form-label small fw-semibold">Unpaid For</label>
                    <select id="auCategorySelect" class="form-select">
                        <option value="">General / All fees</option>
                    </select>
                </div>
                <div class="mb-1">
                    <label class="form-label small fw-semibold">Notes (optional)</label>
                    <textarea id="auNotes" class="form-control" rows="2" placeholder="optional"></textarea>
                </div>
            </div>

            <div class="modal-footer">
                <button type="button" class="btn btn-navy" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-gold fw-bold" onclick="submitAddUnpaidToArchive()">
                    <i class="bi bi-check-circle-fill me-1"></i>Add to Roster
                </button>
            </div>
        </div>
    </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>

<script src="app.js?v=schedule-layout-20261026"></script>

<?php if (($_SESSION['role'] ?? '') === 'auditor'): ?>
<script>
    const auditCsrf = <?= json_encode($_SESSION['receipt_documents_csrf']) ?>;
    const auditCanWrite = true;
</script>
<script src="auditor_register.js?v=settings-options-20261021"></script>
<?php endif; ?>

<script>
document.addEventListener('DOMContentLoaded', () => {
    const rebootBtn = document.getElementById('rebootSystemBtn');

    if (rebootBtn) {
        rebootBtn.addEventListener('click', function () {
            const currentYear = new Date().getFullYear();
            const nextYear = currentYear + 1;
            const suggestedFormat = `${currentYear}-${nextYear}`;

            Swal.fire({
                title: 'Archive School Year',
                html: `Your current financial records will be saved in Archives, and a fresh layout will be prepared for the next school year. You can recover the archived year separately.<br><br>Enter the school year you are closing (e.g., <b>${suggestedFormat}</b>):`,
                input: 'text',
                icon: 'info',
                showCancelButton: true,
                confirmButtonColor: 'var(--gold-main)',
                cancelButtonColor: 'var(--navy-sub)',
                confirmButtonText: 'Next: Review Unpaid Students',
                inputValidator: value => {
                    if (!value || value.trim() === '') {
                        return 'Please enter the school year you want to archive.';
                    }
                }
            }).then(result => {
                if (result.isConfirmed) {
                    openFlagUnpaidModal(result.value.trim());
                }
            });
        });
    }
});
</script>

<script src="section_remittances.js?v=settings-options-20261021"></script>
</body>
</html>