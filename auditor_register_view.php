<?php
// This view is included inside index.php.
// Only Auditors receive the register interface.

if (($_SESSION['role'] ?? '') !== 'auditor') {
    return;
}

$write = true;
?>

<div id="auditRegisterView" class="d-none">

    <div class="page-heading">
        <div>
            <span class="eyebrow">
                RECORDS &amp; SUPPORTING RECEIPTS
            </span>

            <h1>Receipt &amp; Cash Disbursement Register</h1>

            <p>
                Enter receipt details directly below.
                Use Nature of Payment for the event and purchased items.
            </p>
        </div>

        <a
            class="button secondary"
            href="#"
            onclick="switchView('add-doc'); return false;"
        >
            Receipt Documents
        </a>
    </div>

    <p
        id="status"
        class="status"
        role="status"
        aria-live="polite"
    ></p>

    <section class="panel register-panel">

        <div class="register-heading">
            <div>
                <h2 id="registerTitle">
                    Cash Disbursement Record
                </h2>

                <p id="registerMeta" class="hint">
                    Enter details directly in the table.
                </p>
            </div>

            <div class="table-toolbar">
                <button
                    id="refreshButton"
                    type="button"
                    class="secondary"
                    onclick="refreshAuditTable()"
                >
                    Refresh
                </button>

                <button
                    id="printButton"
                    type="button"
                    class="secondary"
                    onclick="printAuditRegister()"
                    disabled
                >
                    Print / Save as PDF
                </button>

                <?php if ($write): ?>
                    <button
                        id="addRowButton"
                        type="button"
                        class="secondary"
                        onclick="addAuditTableRow()"
                        disabled
                    >
                        + Add Row
                    </button>

                    <button
                        id="saveChangesButton"
                        type="button"
                        onclick="saveAuditChanges()"
                        disabled
                    >
                        Save Changes
                    </button>
                <?php endif; ?>
            </div>
        </div>

        <div class="register-guide">
            <p>
                Enter receipt details below, then select
                <strong>Save Changes</strong>.
                Use a negative cash advance for refunds.
            </p>

            <label class="inline-label">
                <input
                    id="showVoided"
                    type="checkbox"
                    onchange="renderAuditRegister()"
                >
                Show voided entries
            </label>
        </div>

        <section class="mx-4 my-3 p-3 border rounded-3" aria-labelledby="auditSignatoriesTitle">
            <h2 id="auditSignatoriesTitle" class="h6 fw-bold mb-2">Report Signatories</h2>
            <p class="hint mb-3">Admin defaults fill these fields. Edit names and positions for this report, or clear a name for an empty signature line.</p>
            <div class="row g-3">
                    <div class="col-md-6 col-xl-3">
                        <label class="form-label small fw-semibold" for="auditPreparedBy">Prepared by</label>
                        <input class="form-control" type="text" id="auditPreparedBy" data-report-preparer="auditor" maxlength="150" placeholder="Full name" data-report-signatory="prepared">
<label for="auditPreparedPosition" class="visually-hidden">Prepared by position</label><input id="auditPreparedPosition" data-report-preparer="auditor" class="form-control form-control-sm mt-2" type="text" maxlength="100" data-report-position="prepared" placeholder="Position / title (optional)">
                    </div>
                    <div class="col-md-6 col-xl-3">
                        <label class="form-label small fw-semibold" for="auditCertifiedBy">Certified by</label>
                        <input class="form-control" type="text" id="auditCertifiedBy" maxlength="150" placeholder="Full name" data-report-signatory="certified">
<label for="auditCertifiedPosition" class="visually-hidden">Certified by position</label><input id="auditCertifiedPosition" class="form-control form-control-sm mt-2" type="text" maxlength="100" data-report-position="certified" placeholder="Position / title (optional)">
                    </div>
                    <div class="col-md-6 col-xl-3">
                        <label class="form-label small fw-semibold" for="auditNotedBy">Noted by</label>
                        <input class="form-control" type="text" id="auditNotedBy" maxlength="150" placeholder="Full name" data-report-signatory="noted">
<label for="auditNotedPosition" class="visually-hidden">Noted by position</label><input id="auditNotedPosition" class="form-control form-control-sm mt-2" type="text" maxlength="100" data-report-position="noted" placeholder="Position / title (optional)">
                    </div>
                    <div class="col-md-6 col-xl-3">
                        <label class="form-label small fw-semibold" for="auditApprovedBy">Approved by</label>
                        <input class="form-control" type="text" id="auditApprovedBy" maxlength="150" placeholder="Full name" data-report-signatory="approved">
<label for="auditApprovedPosition" class="visually-hidden">Approved by position</label><input id="auditApprovedPosition" class="form-control form-control-sm mt-2" type="text" maxlength="100" data-report-position="approved" placeholder="Position / title (optional)">
                    </div>
            </div>
        </section>

        <div class="table-wrap">
            <table
                id="auditRegisterTable"
                class="editable-register"
            >
                <colgroup>
                    <col style="width:150px">
                    <col style="width:120px">
                    <col style="width:180px">
                    <col style="width:300px">
                    <col style="width:150px">
                    <col style="width:140px">
                    <col style="width:150px">
                </colgroup>

                <thead>
                    <tr>
                        <th>Date</th>
                        <th>OR / Receipt No.</th>
                        <th>Payee</th>
                        <th>Nature of Payment</th>
                        <th>
                            Cash Advance Received / (Refunded)
                        </th>
                        <th>Disbursement</th>
                        <th>Cash Advance Balance</th>
                    </tr>
                </thead>

                <tbody id="auditRows">
                    <tr>
                        <td colspan="7">
                            Loading entries…
                        </td>
                    </tr>
                </tbody>

                <tfoot id="auditTotals"></tfoot>
            </table>
        </div>

        <div class="register-footer">
            <span>
                Payee: shop, market or supplier.
                Nature of Payment: event and purchased items,
                one item per line.
            </span>

            <span>
                New rows are added at the bottom.
            </span>
        </div>

    </section>

    <p class="page-footer">
        Northern Iloilo State University ·
        College of Information and Computing Studies
    </p>

</div>