'use strict';

let receiptAudit = {
    rows: [],
    generation: 0,
    valid: false,
    busy: false,
    today: ''
};

const auditDrafts = new Map();
let draftCounter = 0;

const raEl = id => document.getElementById(id);

const raEsc = value => String(value ?? '').replace(
    /[&<>"']/g,
    character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[character])
);

const raMoney = cents => '₱ ' + (cents / 100).toLocaleString(
    'en-US',
    {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }
);

function raStatus(text, error = false) {
    raEl('status').textContent = text;
    raEl('status').className = 'status' + (error ? ' error' : '');
}

function auditLedgerRows(rows) {
    let balance = 0;
    let received = 0;
    let refunded = 0;
    let spent = 0;

    const ordered = [...rows].sort(
        (a, b) => Number(a.id) - Number(b.id)
    );

    const ledger = ordered.map(row => {
        const amount = Math.round(Number(row.amount) * 100);

        if (!row.voided_at) {
            if (row.entry_type === 'advance') {
                balance += amount;
                received += amount;
            } else if (row.entry_type === 'refund') {
                balance -= amount;
                refunded += amount;
            } else {
                balance -= amount;
                spent += amount;
            }
        }

        return {
            ...row,
            cents: amount,
            balance
        };
    });

    return {
        rows: ledger,
        balance,
        received,
        refunded,
        spent
    };
}

async function raRequest(form) {
    const response = await fetch('auditor_receipt_api.php', {
        method: 'POST',
        body: form,
        credentials: 'same-origin'
    });

    const data = await response.json().catch(() => null);

    if (!response.ok || data?.status !== 'success') {
        throw new Error(
            data?.message ||
            'Could not save. Check your session and connection.'
        );
    }

    return data;
}

function raForm(action) {
    const form = new FormData();

    form.set('action', action);
    form.set('csrf', auditCsrf);

    return form;
}

function auditUuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
        /[xy]/g,
        character => {
            const number =
                crypto.getRandomValues(new Uint8Array(1))[0] & 15;

            return (
                character === 'x'
                    ? number
                    : (number & 3) | 8
            ).toString(16);
        }
    );
}

async function loadAuditRegister() {
    const generation = ++receiptAudit.generation;

    receiptAudit.valid = false;
    raEl('auditRows').classList.add('busy');

    setAuditControls();
    raStatus('Loading entries…');

    try {
        const response = await fetch('auditor_receipt_api.php', {
            cache: 'no-store',
            credentials: 'same-origin'
        });

        const data = await response.json();

        if (!response.ok || data.status !== 'success') {
            throw new Error(
                data.message || 'Could not load the register.'
            );
        }

        if (generation !== receiptAudit.generation) {
            return;
        }

        receiptAudit.rows = data.entries;
        receiptAudit.today = data.today;

        for (const [key, draft] of auditDrafts) {
            if (!draft.dirty) {
                auditDrafts.delete(key);
            }
        }

        receiptAudit.valid = true;

        renderAuditRegister();
        raStatus('Ready. Enter details and select Save Changes.');
    } catch (error) {
        if (generation === receiptAudit.generation) {
            raStatus(error.message, true);
        }
    }

    if (receiptAudit.valid && !receiptAudit.busy) {
        raEl('auditRows').classList.remove('busy');
    }

    setAuditControls();
}

function setAuditControls() {
    raEl('printButton').disabled =
        !receiptAudit.valid || receiptAudit.busy;

    raEl('refreshButton').disabled = receiptAudit.busy;

    if (auditCanWrite) {
        raEl('addRowButton').disabled =
            !receiptAudit.valid || receiptAudit.busy;

        raEl('saveChangesButton').disabled =
            !receiptAudit.valid || receiptAudit.busy;
    }
}

function hasAuditDrafts() {
    return [...auditDrafts.values()].some(draft => draft.dirty);
}

function refreshAuditTable() {
    if (receiptAudit.busy) {
        return;
    }

    if (
        hasAuditDrafts() &&
        !confirm('Discard unsaved table edits and refresh?')
    ) {
        return;
    }

    auditDrafts.clear();
    loadAuditRegister();
}

function draftFromAuditRow(row) {
    return {
        key: String(row.id),
        id: Number(row.id),
        sheet_id: row.sheet_id || '',
        entry_date: row.entry_date,
        voucher_no: row.voucher_no || '',
        or_number: row.or_number || '',
        payee: row.payee || '',
        nature: row.nature || '',

        advance: row.entry_type === 'advance'
            ? row.amount
            : row.entry_type === 'refund'
                ? '-' + row.amount
                : '',

        disbursement: row.entry_type === 'disbursement'
            ? row.amount
            : '',

        document_id: row.document_id
            ? String(row.document_id)
            : '',

        file: null,
        audit_status: row.audit_status || 'pending',
        audit_note: row.audit_note || '',
        edit_token: row.edit_token || '',
        dirty: false,
        request: null,
        error: ''
    };
}

function getAuditDraft(key) {
    if (auditDrafts.has(key)) {
        return auditDrafts.get(key);
    }

    const row = receiptAudit.rows.find(
        item => String(item.id) === key
    );

    if (!row) {
        return null;
    }

    const draft = draftFromAuditRow(row);

    auditDrafts.set(key, draft);

    return draft;
}

function addAuditTableRow() {
    if (
        !auditCanWrite ||
        !receiptAudit.valid ||
        receiptAudit.busy
    ) {
        return null;
    }

    const key = 'new_' + auditUuid();

    const draft = {
        ...draftFromAuditRow({
            id: 1000000000000 + (++draftCounter),
            entry_date: receiptAudit.today
        }),
        key,
        id: null,
        dirty: true
    };

    auditDrafts.set(key, draft);
    renderAuditRegister();

    document.querySelector(
        `[data-key="${key}"][data-field="payee"]`
    )?.focus();

    return key;
}

function auditDraftPayload(draft, strict = true) {
    const advanceText = String(draft.advance || '').trim();
    const spentText = String(draft.disbursement || '').trim();

    const validAdvance =
        advanceText === '' ||
        /^-?\d{1,10}(?:\.\d{1,2})?$/.test(advanceText);

    const validSpent =
        spentText === '' ||
        /^\d{1,10}(?:\.\d{1,2})?$/.test(spentText);

    const advance = validAdvance
        ? Number(advanceText || 0)
        : 0;

    const spent = validSpent
        ? Number(spentText || 0)
        : 0;

    if (strict && (!validAdvance || !validSpent)) {
        throw new Error(
            'Use valid amounts with at most two decimals.'
        );
    }

    if (
        strict &&
        (
            (advance !== 0 && spent !== 0) ||
            (advance === 0 && spent === 0)
        )
    ) {
        throw new Error(
            'Enter an amount in Cash Advance or Disbursement. ' +
            'Use only one amount column per row; ' +
            'use a negative cash advance for refunds.'
        );
    }

    const type = advance > 0
        ? 'advance'
        : advance < 0
            ? 'refund'
            : 'disbursement';

    const amount = advance !== 0
        ? Math.abs(advance)
        : spent;

    if (strict) {
        if (
            !/^\d{4}-\d{2}-\d{2}$/.test(draft.entry_date) ||
            draft.entry_date > receiptAudit.today
        ) {
            throw new Error(
                'Choose a valid date, today or earlier.'
            );
        }

        if (!draft.nature.trim()) {
            throw new Error(
                'Enter the purchased items or purpose.'
            );
        }

        if (type === 'disbursement' && !draft.payee.trim()) {
            throw new Error(
                'Enter the shop, market or supplier in Payee.'
            );
        }
    }

    return {
        entry_date: draft.entry_date,
        entry_type: type,
        amount: amount.toFixed(2),
        voucher_no: draft.voucher_no,
        or_number: draft.or_number,
        payee: draft.payee,
        nature: draft.nature,
        document_id: draft.document_id,
        audit_status: draft.audit_status,
        audit_note: draft.audit_note
    };
}

function tableAuditLedger() {
    const rows = receiptAudit.rows.map(row => {
        const draft = auditDrafts.get(String(row.id));

        return draft?.dirty
            ? {
                ...row,
                ...auditDraftPayload(draft, false),
                row_key: String(row.id)
            }
            : {
                ...row,
                row_key: String(row.id)
            };
    });

    for (const draft of auditDrafts.values()) {
        if (!draft.id) {
            rows.push({
                ...auditDraftPayload(draft, false),
                id: 1000000000000 +
                    [...auditDrafts.keys()].indexOf(draft.key),
                row_key: draft.key
            });
        }
    }

    return auditLedgerRows(rows);
}

function tableAuditInput(
    draft,
    field,
    type = 'text',
    extra = ''
) {
    return `
        <input
            type="${type}"
            data-key="${draft.key}"
            data-field="${field}"
            value="${raEsc(draft[field])}"
            aria-label="${field.replace(/_/g, ' ')}"
            ${extra}
        >
    `;
}

function editableAuditRow(row) {
    const key = row.row_key;
    const draft = getAuditDraft(key);

    if (!draft) {
        return '';
    }

    return `
        <tr
            data-row-key="${key}"
            class="${draft.dirty ? 'dirty-row' : ''}"
        >
            <td>
                ${tableAuditInput(
                    draft,
                    'entry_date',
                    'date',
                    `max="${receiptAudit.today}"`
                )}

                <div class="cell-actions">
                    <button
                        type="button"
                        class="secondary"
                        onclick="discardAuditRow('${key}')"
                    >
                        ${draft.id ? 'Revert' : 'Remove'}
                    </button>

                    ${draft.id ? `
                        <button
                            type="button"
                            class="row-action"
                            onclick="voidAuditEntry(${draft.id})"
                        >
                            Void
                        </button>
                    ` : ''}
                </div>

                <span
                    class="row-state ${
                        draft.error
                            ? 'error'
                            : draft.dirty
                                ? 'dirty'
                                : ''
                    }"
                    data-state-key="${key}"
                >
                    ${raEsc(
                        draft.error ||
                        (
                            draft.dirty
                                ? 'Unsaved changes'
                                : 'Saved'
                        )
                    )}
                </span>
            </td>

            <td>
                ${tableAuditInput(
                    draft,
                    'or_number',
                    'text',
                    'maxlength="120"'
                )}
            </td>

            <td>
                <textarea
                    data-key="${key}"
                    data-field="payee"
                    maxlength="200"
                    aria-label="Payee shop or supplier"
                >${raEsc(draft.payee)}</textarea>
            </td>

            <td>
                <textarea
                    data-key="${key}"
                    data-field="nature"
                    maxlength="3000"
                    aria-label="Event and purchased items"
                    placeholder="Event / purpose&#10;Purchased items"
                >${raEsc(draft.nature)}</textarea>
            </td>

            <td>
                ${tableAuditInput(
                    draft,
                    'advance',
                    'number',
                    'step="0.01" placeholder="Received / − refund"'
                )}
            </td>

            <td>
                ${tableAuditInput(
                    draft,
                    'disbursement',
                    'number',
                    'min="0" step="0.01" placeholder="0.00"'
                )}
            </td>

            <td
                class="balance-cell ${row.balance < 0 ? 'bad' : ''}"
                data-balance-key="${key}"
            >
                ${raMoney(row.balance)}
            </td>
        </tr>
    `;
}

function readonlyAuditTableRow(row) {
    return auditRowHtml(row);
}

function renderAuditRegister() {
    raEl('registerTitle').textContent =
        'Cash Disbursement Record';

    raEl('registerMeta').textContent =
        'All recorded entries · oldest added first';

    const ledger = tableAuditLedger();
    const showVoided = raEl('showVoided').checked;

    raEl('auditRows').innerHTML = ledger.rows
        .filter(row => showVoided || !row.voided_at)
        .map(row => (
            auditCanWrite && !row.voided_at
                ? editableAuditRow(row)
                : readonlyAuditTableRow(row)
        ))
        .join('') || `
            <tr>
                <td colspan="7">
                    No entries yet. Select + Add Row to begin.
                </td>
            </tr>
        `;

    updateAuditPreviewBalances();
}

function updateAuditPreviewBalances() {
    const ledger = tableAuditLedger();

    for (const row of ledger.rows) {
        const element = document.querySelector(
            `[data-balance-key="${row.row_key}"]`
        );

        if (element) {
            element.textContent = raMoney(row.balance);
            element.classList.toggle('bad', row.balance < 0);
        }
    }

    raEl('auditTotals').innerHTML = `
        <tr>
            <td colspan="4">
                ${
                    hasAuditDrafts()
                        ? 'Preview totals — save edited rows'
                        : 'Saved totals'
                }
            </td>

            <td class="money">
                ${raMoney(ledger.received)}
                <br>
                (${raMoney(ledger.refunded)})
            </td>

            <td class="money">
                ${raMoney(ledger.spent)}
            </td>

            <td class="money">
                ${raMoney(ledger.balance)}
            </td>
        </tr>
    `;
}

function onAuditTableInput(event) {
    const field = event.target.dataset.field;
    const key = event.target.dataset.key;

    if (
        !key ||
        !field ||
        receiptAudit.busy ||
        !receiptAudit.valid
    ) {
        return;
    }

    const draft = getAuditDraft(key);

    if (!draft) {
        return;
    }

    draft[field] = event.target.value;
    draft.dirty = true;
    draft.error = '';

    event.target.closest('tr')?.classList.add('dirty-row');

    const state = document.querySelector(
        `[data-state-key="${key}"]`
    );

    if (state) {
        state.textContent = 'Unsaved changes';
        state.className = 'row-state dirty';
    }

    updateAuditPreviewBalances();
}

function discardAuditRow(key) {
    if (receiptAudit.busy) {
        return;
    }

    const draft = auditDrafts.get(key);

    if (
        draft?.dirty &&
        !confirm('Discard this row’s unsaved changes?')
    ) {
        return;
    }

    auditDrafts.delete(key);
    renderAuditRegister();
}

async function saveAuditChanges() {
    if (
        receiptAudit.busy ||
        !receiptAudit.valid ||
        !auditCanWrite
    ) {
        return;
    }

    const dirty = [...auditDrafts.values()].filter(
        draft => draft.dirty
    );

    if (!dirty.length) {
        raStatus('All changes are already saved.');
        return;
    }

    let invalid = false;

    for (const draft of dirty) {
        try {
            auditDraftPayload(draft);
            draft.error = '';
        } catch (error) {
            draft.error = error.message;
            invalid = true;
        }
    }

    if (invalid) {
        renderAuditRegister();

        raStatus(
            'Check the highlighted rows, then select Save Changes.',
            true
        );

        return;
    }

    receiptAudit.busy = true;

    setAuditControls();
    raEl('auditRows').classList.add('busy');

    let saved = 0;
    let failed = false;

    for (const draft of dirty) {
        const payload = auditDraftPayload(draft);
        const signature = JSON.stringify(payload);

        if (draft.request?.signature !== signature) {
            draft.request = {
                signature,
                id: auditUuid()
            };
        }

        const form = raForm(
            draft.id ? 'update_entry' : 'create_entry'
        );

        form.set('sheet_id', draft.sheet_id);
        form.set('request_id', draft.request.id);

        for (const [name, value] of Object.entries(payload)) {
            form.set(name, value);
        }

        if (draft.id) {
            form.set('entry_id', draft.id);
            form.set('edit_token', draft.edit_token);
        }

        raStatus(
            'Saving ' + (saved + 1) +
            ' of ' + dirty.length + ' rows…'
        );

        try {
            await raRequest(form);

            auditDrafts.delete(draft.key);
            saved++;
        } catch (error) {
            draft.error = error.message;
            failed = true;
            break;
        }
    }

    await loadAuditRegister();

    receiptAudit.busy = false;

    setAuditControls();

    raEl('auditRows').classList.toggle(
        'busy',
        !receiptAudit.valid
    );

    if (failed) {
        raStatus(
            saved + ' row(s) saved. Remaining edits are still here; ' +
            'check the row message and retry Save Changes.',
            true
        );
    } else if (receiptAudit.valid) {
        raStatus('All ' + saved + ' row(s) saved.');
    }
}

async function voidAuditEntry(id) {
    if (receiptAudit.busy) {
        return;
    }

    const reason = prompt(
        'Reason for voiding this saved audit row:'
    );

    if (!reason?.trim()) {
        return;
    }

    const form = raForm('void_entry');

    form.set('entry_id', id);
    form.set('reason', reason.trim());

    receiptAudit.busy = true;

    setAuditControls();
    raEl('auditRows').classList.add('busy');

    try {
        await raRequest(form);

        auditDrafts.delete(String(id));
        await loadAuditRegister();
    } catch (error) {
        raStatus(error.message, true);
    } finally {
        receiptAudit.busy = false;

        setAuditControls();

        raEl('auditRows').classList.toggle(
            'busy',
            !receiptAudit.valid
        );
    }
}

function auditRowHtml(row) {
    const voided = Boolean(row.voided_at);

    const advance = row.entry_type === 'advance'
        ? raMoney(row.cents)
        : row.entry_type === 'refund'
            ? '(' + raMoney(row.cents) + ')'
            : '—';

    return `
        <tr class="${voided ? 'voided' : ''}">
            <td>${raEsc(row.entry_date)}</td>

            <td>${raEsc(row.or_number || '—')}</td>

            <td>${raEsc(row.payee || '—')}</td>

            <td class="nature">${raEsc(row.nature)}${
                voided
                    ? `<span class="minor">Voided: ${
                        raEsc(row.void_reason)
                    }</span>`
                    : ''
            }</td>

            <td class="money">
                ${voided ? '—' : advance}
            </td>

            <td class="money">
                ${
                    !voided && row.entry_type === 'disbursement'
                        ? raMoney(row.cents)
                        : '—'
                }
            </td>

            <td class="money">
                ${raMoney(row.balance)}
            </td>
        </tr>
    `;
}

function buildAuditPrintHtml(
    sheet,
    rows,
    showVoided = false
) {
    const ledger = auditLedgerRows(rows);

    const visible = ledger.rows.filter(
        row => showVoided || !row.voided_at
    );

    const time = new Date().toLocaleString('en-PH', {
        timeZone: 'Asia/Manila'
    });

    return `
        <!doctype html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Cash Disbursement Record</title>

            <style>
                @page {
                    size: A4 landscape;
                    margin: 12mm;
                }

                body {
                    font: 10px/1.5 Arial, sans-serif;
                    color: #173456;
                    margin: 0;
                }

                .header {
                    text-align: center;
                    margin-bottom: 20px;
                }


/* Header logos only; retain this document's existing print layout. */
.header{position:relative;padding-left:68px;padding-right:68px;min-height:60px}
.print-logo{position:absolute;top:0;width:68px;height:68px;object-fit:contain}
.print-logo-nisu{left:max(4px, calc(50% - 240px))}.print-logo-cics{right:max(4px, calc(50% - 240px))}
                .signatories { display: flex; gap: 28px; margin-top: 24px; padding-top: 5px; break-inside: avoid; page-break-inside: avoid; }
                .signatory { flex: 1; min-width: 0; text-align: center; }
                .signature-label { text-align: left; font-size: 10px; font-weight: bold; margin: 0; }
                .signature-space { height: 32px; }
                .signature-name { border-top: 1px solid #172c4d; padding-top: 2px; font-size: 11px; line-height: 1.15; font-weight: bold; overflow-wrap: anywhere; }
                .signature-name:empty { padding-top: 0; }
                .signature-caption { font-size: 9px; line-height: 1.15; margin: 2px 0 0; }
                .header h2 {
                    margin: 0;
                    font-size: 15px;
                }

                .header p {
                    margin: 3px 0;
                }
                .funds-caption {
                    caption-side: top;
                    text-align: center;
                    color: #173456;
                    font-size: 10px;
                    padding: 0 0 3px;
                    border-bottom: 2px solid #285fae;
                }

                .date {
                    text-align: right;
                    white-space: nowrap;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    table-layout: fixed;
                    font-size: 9px;
                }

                th,
                td {
                    border: 1px solid #c7d8ed;
                    padding: 7px;
                    vertical-align: top;
                    overflow-wrap: anywhere;
                }

                th {
                    background: #eaf2fd;
                    color: #285792;
                    text-align: center;
                    font-size: 8px;
                    text-transform: uppercase;
                }

                thead {
                    display: table-header-group;
                }

                tbody tr {
                    break-inside: avoid;
                }

                .money {
                    white-space: nowrap;
                    text-align: right;
                    font-variant-numeric: tabular-nums;
                }

                .nature {
                    white-space: pre-line;
                }

                .minor {
                    display: block;
                    font-size: 8px;
                    color: #647d9c;
                }

                .bad {
                    color: #ba3d4f;
                }

                .voided {
                    color: #788395;
                    background: #f2f4f7;
                }

                .note {
                    font-size: 9px;
                    margin-top: 14px;
                }

                tfoot {
                    display: table-row-group;
                }

                .toolbar {
                    text-align: right;
                    margin-bottom: 14px;
                }

                button {
                    background: #2465d6;
                    color: white;
                    padding: 10px;
                    border: 0;
                    border-radius: 5px;
                }

                @media print {
                    .toolbar {
                        display: none;
                    }

                    th {
                        print-color-adjust: exact;
                        -webkit-print-color-adjust: exact;
                    }
                }
            </style>
        </head>

        <body>
            <div class="toolbar">
                <button onclick="window.print()">
                    Print / Save as PDF
                </button>
            </div>

            <p class="date">
                Date: ${raEsc(time)} PHT
            </p>

            <div class="header">
                <img class="print-logo print-logo-nisu" src="${raEsc(new URL('nisu_logo.png', window.location.href).href)}" alt="NISU">
                <img class="print-logo print-logo-cics" src="${raEsc(new URL('cics_logo.png', window.location.href).href)}" alt="CICS">
                <h2>NORTHERN ILOILO STATE UNIVERSITY</h2>
                <p>Estancia, Iloilo</p>
                <p>College of Information and Computing Studies</p>
                <p>CASH DISBURSEMENT RECORD</p>
            </div>

            <table>
                <caption class="funds-caption">STUDENT ORGANIZATION FUNDS</caption>
                <colgroup>
                    <col style="width:10%">
                    <col style="width:11%">
                    <col style="width:15%">
                    <col style="width:28%">
                    <col style="width:13%">
                    <col style="width:11%">
                    <col style="width:12%">
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

                <tbody>
                    ${
                        visible.map(row => auditRowHtml(row)).join('') ||
                        '<tr><td colspan="7">No entries.</td></tr>'
                    }
                </tbody>

                <tfoot>
                    <tr>
                        <td colspan="4">
                            <strong>
                                Total advances / (refunds),
                                disbursements and remaining balance
                            </strong>
                        </td>

                        <td class="money">
                            ${raMoney(ledger.received)}
                            <br>
                            (${raMoney(ledger.refunded)})
                        </td>

                        <td class="money">
                            ${raMoney(ledger.spent)}
                        </td>

                        <td class="money">
                            ${raMoney(ledger.balance)}
                        </td>
                    </tr>
                </tfoot>
            </table>

            
            <div class="signatories">
                ${[['Prepared by:', 'prepared'], ['Certified by:', 'certified'], ['Noted by:', 'noted'], ['Approved by:', 'approved']].map(([label, key]) => `
                    <div class="signatory">
                        <p class="signature-label">${label}</p>
                        <div class="signature-space"></div>
                        <div class="signature-name">${raEsc(sheet.signatories?.[key] || '')}</div>
                        <p class="signature-caption">Signature over printed name</p>
                        <p class="signature-caption">${raEsc(sheet.positions?.[key] || '')}</p>
                    </div>
                `).join('')}
            </div>
        </body>
        </html>
    `;
}

function printAuditRegister() {
    if (!receiptAudit.valid || receiptAudit.busy) {
        return;
    }

    if (hasAuditDrafts()) {
        raStatus(
            'Select Save Changes before printing, ' +
            'or revert/remove unfinished rows.',
            true
        );

        return;
    }

    const html = buildAuditPrintHtml(
        { signatories: {
            prepared: raEl('auditPreparedBy').value.trim(),
            certified: raEl('auditCertifiedBy').value.trim(),
            noted: raEl('auditNotedBy').value.trim(),
            approved: raEl('auditApprovedBy').value.trim()
        }, positions: {
prepared: raEl('auditPreparedPosition').value.trim(),certified: raEl('auditCertifiedPosition').value.trim(),noted: raEl('auditNotedPosition').value.trim(),approved: raEl('auditApprovedPosition').value.trim()
        } },
        receiptAudit.rows,
        raEl('showVoided').checked
    );

    const printWindow = window.open('', '_blank');

    if (!printWindow) {
        raStatus(
            'Allow pop-ups to print this report.',
            true
        );

        return;
    }

    printWindow.document.open();
    printWindow.document.write(typeof window.applyWorkspaceBrandingToHtml === 'function' ? window.applyWorkspaceBrandingToHtml(html) : html);
    printWindow.document.close();

    // Rebuild the editor after the browser's print preview releases focus.
    // Keep the drafts and saved rows; never reload or discard in-progress edits.
    let restored = false;
    const restoreEditor = () => {
        if (restored || receiptAudit.busy || !receiptAudit.valid) {
            return;
        }

        restored = true;
        printWindow.removeEventListener('afterprint', restoreEditor);
        window.removeEventListener('focus', onEditorFocus);
        document.removeEventListener('visibilitychange', onEditorVisible);
        renderAuditRegister();
        raEl('auditRows').classList.remove('busy');
        setAuditControls();
    };

    const onEditorFocus = () => window.setTimeout(restoreEditor, 0);
    const onEditorVisible = () => {
        if (document.visibilityState === 'visible') {
            onEditorFocus();
        }
    };

    const print = () => {
        printWindow.addEventListener('afterprint', restoreEditor);
        window.addEventListener('focus', onEditorFocus);
        document.addEventListener('visibilitychange', onEditorVisible);

        try {
            printWindow.focus();
            printWindow.print();
        } catch (error) {
            restoreEditor();
            raStatus('Could not open print preview: ' + error.message, true);
        }
    };

    if (printWindow.document.readyState === 'complete') {
        printWindow.setTimeout(print, 150);
    } else {
        printWindow.addEventListener('load', print, {
            once: true
        });
    }
}

raEl('auditRows').addEventListener(
    'input',
    onAuditTableInput
);

window.addEventListener('beforeunload', event => {
    if (hasAuditDrafts()) {
        event.preventDefault();
        event.returnValue = '';
    }
});

loadAuditRegister();