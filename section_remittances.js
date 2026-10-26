// Dated receipts are separate from cumulative amounts in the existing dashboard.
let sectionRemittanceState = { key: '', rows: [], cycle: 0, request: null, busy: false, generation: 0, pending: {}, available: {}, balancesReady: false };
const originalOpenSectionCollectionModal = openSectionCollectionModal;
openSectionCollectionModal = function (tr) {
    if (sectionRemittanceState.busy || !categoryUnpaidCanLeave()) return;
    originalOpenSectionCollectionModal(tr);
    const key = (tr.getAttribute('data-parent') ? tr.getAttribute('data-parent') + '-' : '') + tr.dataset.name;
    sectionRemittanceState.key = key;
    sectionRemittanceState.rows = [];
    sectionRemittanceState.pending = {};sectionRemittanceState.available = {};sectionRemittanceState.balancesReady = false;
    sectionRemittanceState.request = null;
    document.getElementById('srmForm').reset();
    document.getElementById('srmForm').classList.add('d-none');
    document.getElementById('srmAmounts').innerHTML = collectionCategories.map((cat, i) => `<div class="col-md-4"><label class="form-label" for="srmCat${i}">${escapeHtml(cat.name)} (₱)</label><input id="srmCat${i}" data-category="${escapeHtml(cat.id)}" type="number" min="0" max="9999999999.99" step="0.01" value="0" class="form-control srm-amount"></div>`).join('');
    setRemittanceLabels();
    setupCategoryUnpaidRoster();
    ensureSectionStudentStatusButton();
    loadSectionRemittances();
};
function setRemittanceLabels() {
    const outgoing = document.getElementById('srmDirection').value === 'organization';
    document.getElementById('srmFromLabel').textContent = outgoing ? "Remitting organization treasurer's full name" : "Classroom treasurer's full name";
    document.getElementById('srmToLabel').textContent = outgoing ? "Receiving custodian's full name" : "Receiving organization treasurer's full name";
    syncLinkedRemittanceAmounts(true);
}
function remittanceStatus(message, error = false) {
    const el = document.getElementById('srmStatus');
    el.textContent = message;
    el.className = 'small mb-3 ' + (error ? 'text-danger' : 'text-muted');
}
async function loadSectionRemittances() {
    const key = sectionRemittanceState.key;
    const generation = ++sectionRemittanceState.generation;
    remittanceStatus('Loading daily remittances…');
    document.getElementById('srmHistory').innerHTML = '';
    try {
        const response = await fetch('section_remittances.php?item_key=' + encodeURIComponent(key), { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok || data.status !== 'success') throw new Error(data.message || 'Could not load remittances.');
        if (generation !== sectionRemittanceState.generation || key !== sectionRemittanceState.key) return;
        sectionRemittanceState.rows = data.rows;
        sectionRemittanceState.cycle = Number(data.cycle_id);
        if(!data.pending_student_payments || !data.available_to_custodian) throw Error('Update section_remittances.php and student_collection_link.php to load linked remittance balances.');
        sectionRemittanceState.lastTotals={...data.totals};sectionRemittanceState.pending=data.pending_student_payments;sectionRemittanceState.available=data.available_to_custodian;sectionRemittanceState.balancesReady=true;
        syncLinkedRemittanceAmounts();
        // Reconcile only the open section, preserving edits elsewhere in the dashboard.
        if (activeModalRow) {
            activeModalRow.querySelectorAll('.val-dynamic').forEach(inp => { inp.value = data.totals[inp.dataset.cat] || 0; });
            document.querySelectorAll('#scmBody .scm-cat-input').forEach(inp => {
                inp.value = Number(data.totals[inp.dataset.catId] || 0).toFixed(2);
                onCategoryModalValueChange(inp);
            });
        }
        document.getElementById('srmDate').max = data.today;
        if (!document.getElementById('srmDate').value) document.getElementById('srmDate').value = data.today;
        document.getElementById('srmForm').classList.toggle('d-none', getUserRole() !== 'treasurer');
        renderSectionRemittances();
        remittanceStatus('Saved student payments awaiting transfer are linked below. Confirm the amount handed over, date, sender and receiver, then save the remittance.');
    } catch (e) {
        if (generation !== sectionRemittanceState.generation) return;
        remittanceStatus(e.message, true);
    }
}
function remittanceCategories(row) {
    const values = JSON.parse(row.category_data || '{}');
    const names = JSON.parse(row.category_names || '{}');
    return Object.entries(values).map(([id, value]) => `${names[id] || id}: ₱ ${formatAmount(value)}`).join('; ');
}
// Database timestamps are already Philippine local time; format without timezone conversion.
function remittanceRecordedAt(value) {
    return String(value || '').replace(/^(\d{4}-\d{2}-\d{2})[ T]([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/, (_, date, hour, minute, second) => {
        const h = Number(hour);
        return date + ' ' + String(h % 12 || 12).padStart(2, '0') + ':' + minute +
            (second === undefined ? '' : ':' + second) + (h >= 12 ? ' PM' : ' AM');
    });
}
function remittanceHistoryRowsHtml(rows, cycle, showSection = true) {
    const esc = value => escapeHtml(String(value ?? ''));
    return rows.map(row => {
        const cleared = row.is_cleared === true || row.is_cleared === 1 || row.is_cleared === '1';
        const status = row.is_removed ? 'Removed' : cleared ? 'Cleared — excluded' : (Number(row.cycle_id) === Number(cycle) ? ((row.corrections||[]).length?'Corrected':'Current') : 'Earlier cycle');
        const movement = row.direction === 'classroom' ? 'Classroom → Organization' : 'Organization → Custodian';
        const names = JSON.parse(row.category_names || '{}');
        const categories = Object.entries(JSON.parse(row.category_data || '{}')).map(([id, amount]) =>
            `<div class="rh-category"><span class="rh-category-name">${esc(names[id] || id)}</span><span class="rh-category-amount">₱ ${esc(formatAmount(amount))}</span></div>`).join('');
        const parts = systemProgramLabel(row.section_label || '').split(' / ');
        const sectionCell = showSection ? `<td aria-label="${esc(systemProgramLabel(row.section_label))}"><span class="rh-section-name">${esc(parts[0])}</span><span class="rh-section-detail">${esc(parts.slice(1).join(' · '))}</span></td>` : '';
        const encoded = remittanceRecordedAt(row.encoded_at).split(' ');
        return `<tr><td><span class="rh-date">${esc(row.date_remitted)}</span><span class="rh-status ${cleared || Number(row.cycle_id) !== Number(cycle) ? 'rh-status-muted' : ''}">${esc(status)}</span></td>${sectionCell}<td><span class="rh-movement">${movement}</span><div class="rh-person"><span class="rh-label">From</span><span class="rh-value">${esc(row.remitted_by)}</span></div><div class="rh-person"><span class="rh-label">To</span><span class="rh-value">${esc(row.received_by)}</span></div>${row.reference_no ? `<div class="rh-extra"><span class="rh-label">Ref:</span> ${esc(row.reference_no)}</div>` : ''}${row.note ? `<div class="rh-extra">${esc(row.note)}</div>` : ''}</td><td><div class="rh-categories">${categories}</div></td><td class="text-end"><span class="rh-amount">₱ ${esc(formatAmount(row.amount))}</span></td><td><span class="rh-recorder">${esc(row.recorded_by)}</span><span class="rh-encoded">${esc(encoded[0])}</span><span class="rh-encoded">${esc(encoded.slice(1).join(' '))} PHT</span>${getUserRole()==='admin' && !row.is_removed && !cleared && Number(row.cycle_id)===Number(cycle) ? `<div class="rmc-row-actions"><button type="button" class="btn btn-outline-primary btn-sm" onclick="correctRemittance(${Number(row.id)})">Record correction</button><button type="button" class="btn btn-outline-danger btn-sm" onclick="correctRemittance(${Number(row.id)},true)">Remove</button></div>` : ''}</td></tr>`;
    }).join('') || `<tr><td colspan="${showSection ? 6 : 5}" class="text-center">No dated remittances yet.</td></tr>`;
}
function renderSectionRemittances() {
    document.getElementById('srmHistory').innerHTML = remittanceHistoryRowsHtml(sectionRemittanceState.rows.filter(row=>!row.is_removed), sectionRemittanceState.cycle, false);
}

function newRemittanceRequestId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = crypto.getRandomValues(new Uint8Array(1))[0] & 15;
        return (c === 'x' ? r : (r & 3) | 8).toString(16);
    });
}
async function saveSectionRemittance(event) {
    event.preventDefault();
    if (sectionRemittanceState.busy || !event.target.reportValidity()) return;
    if(!sectionRemittanceState.balancesReady){remittanceStatus('Reload the section to load linked student payments before remitting.',true);return;}
    if(categoryUnpaidState.dirty){
        if(!(await saveCategoryUnpaid()))return;
    }
    if (categoryUnpaidState.loading || categoryUnpaidState.saving) {
        remittanceStatus('Please wait for the unpaid-student list to finish loading or saving.', true);
        return;
    }
    const amounts = {};
    document.querySelectorAll('.srm-amount').forEach(inp => { amounts[inp.dataset.category] = inp.value || '0'; });
    if (!Object.values(amounts).some(v => Number(v) > 0)) { remittanceStatus('Enter at least one amount greater than zero.', true); return; }
    const payload = {
        csrf: sectionRemittanceCsrf, item_key: sectionRemittanceState.key,
        direction: document.getElementById('srmDirection').value,
        date_remitted: document.getElementById('srmDate').value,
        remitted_by: document.getElementById('srmFrom').value,
        received_by: document.getElementById('srmTo').value,
        reference_no: document.getElementById('srmReference').value,
        note: document.getElementById('srmNote').value, amounts
    };
    if(payload.direction==='classroom') payload.expected_pending={...sectionRemittanceState.pending};
    const signature = JSON.stringify(payload);
    if (!sectionRemittanceState.request || sectionRemittanceState.request.signature !== signature) {
        sectionRemittanceState.request = { signature, id: newRemittanceRequestId() };
    }
    payload.request_id = sectionRemittanceState.request.id;
    sectionRemittanceState.busy = true;
    event.target.querySelectorAll('input,select,button').forEach(el => el.disabled = true);
    categoryUnpaidControls(categoryUnpaidState.ready);
    remittanceStatus('Saving remittance…');
    let saved = false;
    try {
        // Preserve the names before refreshing any financial values.
        if (categoryUnpaidState.dirty && !(await saveCategoryUnpaid())) {
            remittanceStatus('The student list could not be saved. Remittance was not recorded. Fix the list or retry saving it first.', true);
            return;
        }
        await postSave('section_remittances.php', payload);
        saved = true;
        sectionRemittanceState.request = null;
        document.querySelectorAll('.srm-amount').forEach(inp => {inp.value='0';delete inp.dataset.linkedValue;});
        document.getElementById('srmReference').value = '';
        document.getElementById('srmNote').value = '';
        // Load authoritative cumulative values and history after committing.
        await loadSectionRemittances();
        if(categoryUnpaidState.category)await loadCategoryUnpaid();
        setSaveStatus('saved', 'Remittance saved');
    } catch (e) {
        remittanceStatus(e.message + ' Retry the same entry if the connection failed; it will not be recorded twice.', true);
    } finally {
        sectionRemittanceState.busy = false;
        categoryUnpaidControls(categoryUnpaidState.ready);
        event.target.querySelectorAll('input,select,button').forEach(el => el.disabled = false);
        if (saved) document.getElementById('srmSave').focus();
    }
}
document.getElementById('sectionCollectionModal').addEventListener('hide.bs.modal', event => {
    if (sectionRemittanceState.busy) event.preventDefault();
});
function buildSectionRemittancePrintHtml(rows, cycle, sectionTitle, generatedAt = new Date(), signatories = null) {
    const esc = value => escapeHtml(String(value ?? ''));
    const currentDate = generatedAt.toLocaleString('en-PH', {timeZone:'Asia/Manila',year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:true});
    const amounts = {classroom: 0, organization: 0};
    const body = rows.filter(row=>!row.is_removed).map(row => {
        const cleared = row.is_cleared === true || row.is_cleared === 1 || row.is_cleared === '1';
        const isCurrent = Number(row.cycle_id) === Number(cycle);
        if (!cleared && isCurrent && Object.prototype.hasOwnProperty.call(amounts, row.direction)) {
            amounts[row.direction] += Math.round(Number(row.amount) * 100);
        }
        const names = JSON.parse(row.category_names || '{}');
        const categories = Object.entries(JSON.parse(row.category_data || '{}'))
            .map(([id, amount]) => `${esc(names[id] || id)}: <span class="money">₱ ${esc(formatAmount(amount))}</span>`).join('<br>');
        return `<tr><td class="date">${esc(row.date_remitted)}</td><td>${row.direction === 'classroom' ? 'Classroom → Organization' : 'Organization → Custodian'}</td><td>${esc(systemProgramLabel(row.section_label))}</td><td>${esc(row.remitted_by)}</td><td>${esc(row.received_by)}</td><td>${categories}</td><td class="amount">₱ ${esc(formatAmount(row.amount))}</td><td>${esc(row.reference_no || '—')}<br>${esc(row.note || '')}</td><td>${esc(row.recorded_by)}<br>${esc(remittanceRecordedAt(row.encoded_at))} PHT</td></tr>`;
    }).join('');
    const totalsHtml = `<tr><td colspan="6"><strong>Total Remittances Received</strong></td><td class="amount"><strong>₱ ${esc(formatAmount(amounts.classroom / 100))}</strong></td><td colspan="2">Current records</td></tr>`
        + (amounts.organization > 0 ? `<tr><td colspan="6"><strong>Total Remitted to Custodian</strong></td><td class="amount"><strong>₱ ${esc(formatAmount(amounts.organization / 100))}</strong></td><td colspan="2">Current records</td></tr>` : '');
    const signatureHtml = signatories === null ? '' : `<div class="signatories">${[
        ['Prepared by:', 'prepared'], ['Certified by:', 'certified'], ['Noted by:', 'noted'], ['Approved by:', 'approved']
    ].map(([label, key]) => `<div class="signatory"><p class="signature-label">${label}</p><div class="signature-space"></div><div class="signature-name">${esc(signatories[key] || '')}</div><p class="signature-caption">Signature over printed name</p><p class="signature-caption">${esc(signatories.positions?.[key] || '')}</p></div>`).join('')}</div>`;
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Daily Remittance History</title><style>
@page { size: A4 landscape; margin: 12mm; }
* { box-sizing: border-box; }
body { font-family: Arial, sans-serif; margin: 0; color: #172c4d; background: white; font-size: 10px; }
.print-date { text-align: right; font-size: 10px; margin-bottom: 22px; font-weight: bold; }
.header { text-align: center; margin-bottom: 18px; line-height: 1.55; padding-bottom: 15px; border-bottom: 2px solid #285fae; }
.header h3 { margin: 0; font-size: 15px; font-weight: bold; text-transform: uppercase; }
.header p { margin: 3px 0; font-size: 10px; }
.section-label { margin: 0 0 10px; font-weight: bold; overflow-wrap: anywhere; }
table { width: 100%; table-layout: fixed; border-collapse: collapse; margin-bottom: 16px; font-variant-numeric: tabular-nums; }
th, td { border: 1px solid #cad8e9; padding: 7px 6px; line-height: 1.45; vertical-align: top; overflow-wrap: anywhere; }
th { font-weight: bold; text-align: center; background: #eaf2fc; color: #172c4d; font-size: 8px; text-transform: uppercase; }
td { font-size: 9px; }
thead { display: table-header-group; } tbody tr { break-inside: avoid; page-break-inside: avoid; }
.date, .money { white-space: nowrap; } .amount { text-align: right; white-space: nowrap; }
tfoot td { background: #f3f7fd; font-weight: bold; } tfoot { display: table-row-group; break-inside: avoid; }
.signatories { display: flex; gap: 28px; margin-top: 24px; padding-top: 5px; break-inside: avoid; page-break-inside: avoid; }
.signatory { flex: 1; min-width: 0; text-align: center; }
.signature-label { text-align: left; font-size: 10px; font-weight: bold; margin: 0; }
.signature-space { height: 32px; }
.signature-name { border-top: 1px solid #172c4d; padding-top: 2px; font-size: 11px; line-height: 1.15; font-weight: bold; overflow-wrap: anywhere; }
.signature-name:empty { padding-top: 0; }
.signature-caption { font-size: 9px; line-height: 1.15; margin: 2px 0 0; }
.note { font-size: 9px; line-height: 1.5; }
.toolbar { margin: 16px 0; text-align: right; }
button { padding: 9px 16px; border: 0; border-radius: 5px; background: #285fae; color: white; cursor: pointer; }
@media screen { body { padding: 24px; max-width: 1300px; margin: auto; } }
@media print { .toolbar { display: none; } th { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }

/* Header logos only; retain this document's existing print layout. */
.header{position:relative;padding-left:68px;padding-right:68px;min-height:60px}
.print-logo{position:absolute;top:0;width:68px;height:68px;object-fit:contain}
.print-logo-nisu{left:max(4px, calc(50% - 240px))}.print-logo-cics{right:max(4px, calc(50% - 240px))}
</style></head><body><div class="toolbar"><button type="button" onclick="window.print()">Print / Save as PDF</button></div>
<div class="print-date">Date: ${esc(currentDate)} PHT</div>
<div class="header"><img class="print-logo print-logo-nisu" src="${esc(new URL('nisu_logo.png', window.location.href).href)}" alt="NISU"><img class="print-logo print-logo-cics" src="${esc(new URL('cics_logo.png', window.location.href).href)}" alt="CICS"><h3>NORTHERN ILOILO STATE UNIVERSITY</h3><p>Estancia, Iloilo</p><p>College of Information and Computing Studies</p><p>DAILY REMITTANCE HISTORY</p><p>STUDENT ORGANIZATION FUNDS</p><p>OFFICE/PROGRAM: ICSSO</p></div>
<p class="section-label">${esc(systemProgramLabel(sectionTitle))}</p>
<table><colgroup><col style="width:8%"><col style="width:10%"><col style="width:13%"><col style="width:10%"><col style="width:10%"><col style="width:14%"><col style="width:9%"><col style="width:10%"><col style="width:16%"></colgroup><thead><tr><th>Date remitted</th><th>Movement</th><th>Program / Year / Section</th><th>Remitted by</th><th>Received by</th><th>Category / Amount</th><th>Total (₱)</th><th>Reference / Notes</th><th>Recorded by / at</th></tr></thead><tbody>${body}</tbody><tfoot>${totalsHtml}</tfoot></table>

${signatureHtml}
</body></html>`;
}
function printSectionRemittances() {
    if (sectionRemittanceState.busy) { remittanceStatus('Please wait for the current entry to finish saving.', true); return; }
    if (!sectionRemittanceState.rows.length) { remittanceStatus('No dated remittances to print.', true); return; }
    const sectionTitle = document.getElementById('scmTitle').textContent.replace(/\s*[—–-]\s*Collections\s*$/i, '');
    openRemittancePrintWindow(sectionRemittanceState.rows, sectionRemittanceState.cycle, sectionTitle, remittanceStatus);
}
function openRemittancePrintWindow(rows, cycle, title, status, signatories = null) {
    const html = buildSectionRemittancePrintHtml(rows, cycle, title, new Date(), signatories);
    const win = window.open('', '_blank');
    if (!win) { status('Allow pop-ups for this site, then select Print / Save as PDF again.', true); return; }
    win.document.open(); win.document.write(typeof window.applyWorkspaceBrandingToHtml === 'function' ? window.applyWorkspaceBrandingToHtml(html) : html); win.document.close();
    const startPrint = () => { win.focus(); win.print(); };
    if (win.document.readyState === 'complete') win.setTimeout(startPrint, 150);
    else win.addEventListener('load', startPrint, {once:true});
}

// Compatibility for an older index.php that still calls the former CSV action.
function exportSectionRemittances() { printSectionRemittances(); }
function upgradeRemittancePrintButton() {
    document.querySelectorAll('button[onclick]').forEach(button => {
        const action = button.getAttribute('onclick') || '';
        if (!/\b(?:exportSectionRemittances|printSectionRemittances)\s*\(/.test(action)) return;
        button.setAttribute('onclick', 'printSectionRemittances()');
        button.innerHTML = '<i class="bi bi-printer me-1"></i>Print / Save as PDF';
        button.setAttribute('title', 'Open printable report and save as PDF');
    });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', upgradeRemittancePrintButton, {once:true});
else upgradeRemittancePrintButton();

let allRemittanceState = { rows: [], cycle: 0, loading: false, generation: 0 };
let allRemittancesModalInstance = null;
function allRemittanceStatus(message, error = false) {
    const el = document.getElementById('allRemittancesStatus');
    el.textContent = message;
    el.className = 'small ' + (error ? 'text-danger' : 'text-muted');
}
function openAllRemittances() {
    const adminTab=document.getElementById('remittance-review-tab');
    if(getUserRole()==='admin' && adminTab){
        switchView('admin-panel');
        if(adminTab.classList.contains('active'))loadAllRemittances();
        else bootstrap.Tab.getOrCreateInstance(adminTab).show();
        return;
    }
    const modal = document.getElementById('allRemittancesModal');
    if (!allRemittancesModalInstance) allRemittancesModalInstance = new bootstrap.Modal(modal);
    allRemittancesModalInstance.show();
    loadAllRemittances();
}
async function loadAllRemittances() {
    const generation = ++allRemittanceState.generation;
    allRemittanceState.loading = true;
    allRemittanceState.rows = [];
    document.getElementById('allRemittancesPrint').disabled = true;
    document.getElementById('allRemittancesRefresh').disabled = true;
    document.getElementById('allRemittancesRows').innerHTML = '';
    allRemittanceStatus('Loading daily remittances from every section…');
    try {
        const response = await fetch('section_remittances.php?action=all', {cache:'no-store', credentials:'same-origin'});
        const data = await response.json();
        if (!response.ok || data.status !== 'success' || !Array.isArray(data.rows)) throw new Error(data.message || 'Could not load all remittances.');
        if (generation !== allRemittanceState.generation) return;
        allRemittanceState.rows = data.rows;
        allRemittanceState.cycle = Number(data.cycle_id);
        renderAllRemittanceReview();
        const sections = new Set(data.rows.map(row => row.item_key)).size;
        allRemittanceStatus(`${data.rows.length} remittance record(s) from ${sections} section(s). Print / Save as PDF includes every row shown.`);
        document.getElementById('allRemittancesPrint').disabled = !data.rows.some(row=>!row.is_removed);
    } catch (e) {
        if (generation !== allRemittanceState.generation) return;
        allRemittanceStatus(e.message, true);
    } finally {
        if (generation === allRemittanceState.generation) {
            allRemittanceState.loading = false;
            document.getElementById('allRemittancesRefresh').disabled = false;
        }
    }
}
function printAllRemittances() {
    if (allRemittanceState.loading) { allRemittanceStatus('Please wait for all remittances to load.', true); return; }
    if (!allRemittanceState.rows.some(row=>!row.is_removed)) { allRemittanceStatus('No dated remittances to print.', true); return; }
    openRemittancePrintWindow(allRemittanceState.rows, allRemittanceState.cycle,
        'OVERALL DAILY REMITTANCE HISTORY — ALL PROGRAMS, YEAR LEVELS AND SECTIONS', allRemittanceStatus, {
            prepared: document.getElementById('remittancePreparedBy').value.trim(),
            certified: document.getElementById('remittanceCertifiedBy').value.trim(),
            noted: document.getElementById('remittanceNotedBy').value.trim(),
            approved: document.getElementById('remittanceApprovedBy').value.trim(),
            positions: {prepared: document.getElementById('remittancePreparedPosition').value.trim(),certified: document.getElementById('remittanceCertifiedPosition').value.trim(),noted: document.getElementById('remittanceNotedPosition').value.trim(),approved: document.getElementById('remittanceApprovedPosition').value.trim()}
        });
}

// Click a category in the section modal to maintain its unpaid-name list.
const categoryUnpaidState = { category: '', revision: '', cycle: null, loading: false, saving: false, dirty: false, generation: 0, ready: false, loadedKey: '', fee:'0.00',baseCollectedCents:null,accountedPaidCents:null };
function categoryUnpaidCanLeave() {
    if (sectionRemittanceState.busy || categoryUnpaidState.saving) return false;
    if(categoryUnpaidState.dirty && !confirm('Discard unsaved changes to this unpaid-student list?'))return false;
    restoreCategoryCollectionPreview();
    return true;
}
function setupCategoryUnpaidRoster() {
    categoryUnpaidState.generation++;
    Object.assign(categoryUnpaidState, { category: '', dirty: false, loading: false, ready: false, loadedKey: '',baseCollectedCents:null,accountedPaidCents:null });
    let panel = document.getElementById('categoryUnpaidPanel');
    if (!panel) {
        panel = document.createElement('section');
        panel.id = 'categoryUnpaidPanel';
        panel.className = 'unpaid-roster-panel p-4 mt-3';
        panel.setAttribute('aria-label', 'Unpaid students for selected category');
        panel.innerHTML = `<h6 id="categoryUnpaidTitle" class="fw-bold text-theme-gold"></h6>
            <p class="small text-muted">Enter each student's total Amount Paid for this category. Save List updates Amount Collected, the remaining balance, and the amounts awaiting transfer in Daily Remittances. Keep fully paid entries to retain their recorded payments. Complete the sender and receiver, then Save Remittance when money is handed over.</p>
            <p id="categoryPaymentLegacyNote" class="student-payment-notice" hidden>Older name-only entries need an Amount Paid. Enter 0 if no payment has been made. Text previously typed after a name is kept for you to review.</p>
            <div class="table-responsive student-payments-table"><table class="table align-middle mb-0"><thead><tr><th>Student Name</th><th>Date</th><th class="text-end">Fee</th><th class="text-end">Amount Paid</th><th class="text-end">Balance</th><th>Status</th><th></th></tr></thead><tbody id="categoryUnpaidRows"></tbody></table></div>
            <div class="mt-3"><label class="small fw-bold" for="categoryPaymentMode">Payment entry</label><select id="categoryPaymentMode" class="form-select form-select-sm mt-1" style="max-width:450px"><option value="new">New payments — update Amount Collected</option><option value="included">Already included in Amount Collected — link details only</option></select><div id="categoryCollectionPreview" class="small mt-2" aria-live="polite"></div></div>
            <div class="d-flex align-items-center flex-wrap gap-2 mt-3">
                <button type="button" id="categoryUnpaidAdd" class="btn btn-outline-primary btn-sm">+ Add Student</button>
                <button type="button" id="categoryUnpaidSave" class="btn btn-gold btn-sm">Save List</button>
                <button type="button" id="categoryUnpaidReload" class="btn btn-outline-primary btn-sm">Reload List</button>
                <span id="categoryUnpaidCount" class="small text-muted"></span>
            </div>
            <div id="categoryUnpaidStatus" class="small mt-2" role="status" aria-live="polite"></div>`;
        document.getElementById('scmBody').closest('.table-responsive').insertAdjacentElement('afterend', panel);
        document.getElementById('categoryUnpaidAdd').addEventListener('click', () => addCategoryPaymentRow());
        document.getElementById('categoryPaymentMode').addEventListener('change',categoryPaymentChanged);
        document.getElementById('categoryUnpaidSave').addEventListener('click', saveCategoryUnpaid);
        document.getElementById('categoryUnpaidReload').addEventListener('click', () => {
            if (categoryUnpaidCanLeave()) loadCategoryUnpaid();
        });
    }
    document.querySelectorAll('#sectionCollectionModal p').forEach(p=>{if(p.textContent.includes('Running totals include existing opening balances'))p.textContent='Amount Collected includes saved student payments and additional collections. Record Daily Remittances when the money is handed over.';});
    panel.hidden = true;
    document.getElementById('categoryPaymentMode').value='new';
    if (getUserRole() !== 'treasurer') return;
    document.querySelectorAll('#scmBody tr[data-cat-id]').forEach(row => {
        const cell = row.cells[0];
        const name = cell.textContent.trim();
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn btn-link p-0 text-start fw-bold text-theme-gold';
        button.textContent = name;
        button.title = 'Manage unpaid students for ' + name;
        button.setAttribute('aria-controls', 'categoryUnpaidPanel');
        button.addEventListener('click', () => {
            if (!categoryUnpaidCanLeave()) return;
            categoryUnpaidState.category = String(row.dataset.catId);
            document.getElementById('categoryUnpaidTitle').textContent = name + ' — Unpaid Students';
            panel.hidden = false;
            loadCategoryUnpaid();
            panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
        cell.replaceChildren(button);
    });
}
function categoryPaymentRows() { return [...document.querySelectorAll('#categoryUnpaidRows .student-payment-row')]; }
function categoryPaymentEntries() {
    return categoryPaymentRows().map(row => ({student_name:row.querySelector('.student-name-input').value.trim(),amount_paid:row.querySelector('.student-paid-input').value.trim(),payment_date:row.querySelector('.student-date-input').value}));
}
function renderCategoryPayments(entries) {
    document.getElementById('categoryUnpaidRows').replaceChildren();
    entries.forEach(entry => addCategoryPaymentRow(entry, false));
    updateCategoryUnpaidCount();
}
function addCategoryPaymentRow(entry = {student_name:'',amount_paid:'0.00',payment_date:studentRecordToday()}, dirty = true) {
    if (dirty && (!categoryUnpaidState.ready || categoryUnpaidState.saving)) return;
    if (categoryPaymentRows().length >= 200) return categoryUnpaidStatus('Use at most 200 student rows.', true);
    const row = document.createElement('tr');
    row.className = 'student-payment-row';
    row.innerHTML = `<td><input class="form-control student-name-input" maxlength="200" required aria-label="Student name" placeholder="Student name"></td>
        <td><input class="form-control student-date-input" type="date" aria-label="Student record date" title="Date of this payment-status record"></td>
        <td class="student-category-fee text-end"></td>
        <td><input class="form-control text-end student-paid-input" type="number" min="0" step="0.01" required aria-label="Amount paid" placeholder="Confirm amount"></td>
        <td class="student-balance-due text-end fw-bold"></td><td class="student-payment-status"></td>
        <td><button type="button" class="btn btn-sm text-theme-crimson student-remove" aria-label="Remove student"><i class="bi bi-trash3-fill"></i></button></td>`;
    row.querySelector('.student-name-input').value = entry.student_name || '';
    row.querySelector('.student-date-input').value = entry.payment_date || '';
    row.querySelector('.student-date-input').max = studentRecordToday();
    row.querySelector('.student-paid-input').value = entry.amount_paid ?? '';
    row.querySelector('.student-remove').addEventListener('click', () => {
        const paid=Number(row.querySelector('.student-paid-input').value)||0;
        if(paid>0 && !confirm('Remove this student payment entry? In New payments mode, saving the list will reduce Amount Collected by the removed payment. Keep fully paid students in the list to retain their payments.'))return;
        row.remove();categoryPaymentChanged();
    });
    row.addEventListener('input', categoryPaymentChanged);
    document.getElementById('categoryUnpaidRows').appendChild(row);
    if (dirty) categoryPaymentChanged();
}
function categoryPaymentChanged() {
    categoryUnpaidState.dirty = true;
    updateCategoryUnpaidCount();
    categoryUnpaidStatus('Unsaved student payment changes. Select Save List.');
}
function categoryUnpaidNames() { return categoryPaymentEntries().map(row => row.student_name).filter(Boolean); }
function updateCategoryUnpaidCount() {
    const fee = Math.round(Number(categoryUnpaidState.fee || 0)*100);
    let paidTotal=0,dueTotal=0,unconfirmed=0;
    categoryPaymentRows().forEach(row => {
        const input=row.querySelector('.student-paid-input');input.max=(fee/100).toFixed(2);
        const paid=input.value.trim()===''?null:Math.round(Number(input.value)*100);
        row.querySelector('.student-category-fee').textContent='₱ '+formatAmount(fee/100);
        const status=row.querySelector('.student-payment-status');
        if(paid===null || !Number.isFinite(paid)){
            row.querySelector('.student-balance-due').textContent='—';status.textContent='Confirm paid amount';unconfirmed++;
        }else{
            const due=Math.max(0,fee-paid);
            row.querySelector('.student-balance-due').textContent='₱ '+formatAmount(due/100);
            status.textContent=paid>fee?'Check amount':due===0?'Fully paid':paid>0?'Partially paid':'Unpaid';
            if(row.querySelector('.student-name-input').value.trim()){paidTotal+=paid;dueTotal+=due;}
        }
    });
    document.getElementById('categoryUnpaidCount').textContent=`${categoryUnpaidNames().length} student(s) · Paid ₱ ${formatAmount(paidTotal/100)} · Due ₱ ${formatAmount(dueTotal/100)}${unconfirmed?' · '+unconfirmed+' unconfirmed':''}`;
    document.getElementById('categoryPaymentLegacyNote').hidden=unconfirmed===0;
    previewCategoryCollectionTotals();
    formatFinancialTableAmounts();
}
function categoryUnpaidStatus(message, error = false) {
    const element = document.getElementById('categoryUnpaidStatus');
    element.textContent = message;
    element.className = 'small mt-2 ' + (error ? 'text-danger' : 'text-muted');
}
function categoryUnpaidControls(ready) {
    categoryUnpaidState.ready = ready;
    const busy=Boolean(categoryUnpaidState.loading||categoryUnpaidState.saving||sectionRemittanceState.busy);
    document.querySelectorAll('#categoryUnpaidRows input,#categoryUnpaidRows button').forEach(el=>el.disabled=!ready||busy);
    for(const id of ['categoryUnpaidSave','categoryUnpaidAdd'])document.getElementById(id).disabled=!ready||busy;
    document.getElementById('categoryUnpaidReload').disabled=busy;
    document.getElementById('categoryPaymentMode').disabled=!ready||busy;
}
async function loadCategoryUnpaid() {
    const generation=++categoryUnpaidState.generation;
    categoryUnpaidState.loading=true;categoryUnpaidState.dirty=false;
    categoryUnpaidState.baseCollectedCents=null;categoryUnpaidState.accountedPaidCents=null;
    const listKey=JSON.stringify([sectionRemittanceState.key,categoryUnpaidState.category]);
    if(categoryUnpaidState.loadedKey!==listKey)renderCategoryPayments([]);
    categoryUnpaidControls(false);categoryUnpaidStatus('Loading student payments…');
    let ready=false;
    try{
        const query=new URLSearchParams({item_key:sectionRemittanceState.key,category_key:categoryUnpaidState.category});
        const response=await fetch('category_unpaid.php?'+query,{cache:'no-store',credentials:'same-origin'});
        const data=await response.json();if(generation!==categoryUnpaidState.generation)return;
        if(!response.ok||data.status!=='success'||!Array.isArray(data.entries))throw Error(data.message||'Refresh the dashboard to load student payment rows.');
        categoryUnpaidState.fee=data.fee_amount;
        acceptCategoryCollectionTotals(data);
        categoryUnpaidState.revision=data.revision;categoryUnpaidState.cycle=data.cycle_id;categoryUnpaidState.loadedKey=listKey;
        renderCategoryPayments(data.entries);
        categoryUnpaidStatus(data.entries.length?'Saved student payments loaded.':'No student rows yet. Select Add Student.');ready=true;
    }catch(error){if(generation===categoryUnpaidState.generation)categoryUnpaidStatus(error.message,true);}
    finally{if(generation===categoryUnpaidState.generation){categoryUnpaidState.loading=false;categoryUnpaidControls(ready);}}
}
async function saveCategoryUnpaid() {
    if(categoryUnpaidState.loading||categoryUnpaidState.saving||!categoryUnpaidState.ready||!categoryUnpaidState.category)return false;
    const entries=categoryPaymentEntries();
    for(const input of document.querySelectorAll('#categoryUnpaidRows input'))if(!input.reportValidity())return false;
    if(entries.length>200||entries.some(row=>!row.student_name||new TextEncoder().encode(row.student_name).length>200)){
        categoryUnpaidStatus('Use at most 200 students, with names up to 200 bytes.',true);return false;
    }
    entries.forEach(row=>row.amount_paid=Number(row.amount_paid).toFixed(2));
    categoryUnpaidState.saving=true;categoryUnpaidState.dirty=true;categoryUnpaidControls(false);categoryUnpaidStatus('Saving student payments…');
    try{
        const response=await fetch('category_unpaid.php',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({csrf:sectionRemittanceCsrf,item_key:sectionRemittanceState.key,category_key:categoryUnpaidState.category,entries,revision:categoryUnpaidState.revision,cycle_id:categoryUnpaidState.cycle,payment_mode:document.getElementById('categoryPaymentMode').value})});
        const data=await response.json();if(!response.ok||data.status!=='success')throw Error(data.message||'Could not save student payments.');
        categoryUnpaidState.revision=data.revision;categoryUnpaidState.cycle=data.cycle_id;
        const query=new URLSearchParams({item_key:sectionRemittanceState.key,category_key:categoryUnpaidState.category});
        const check=await fetch('category_unpaid.php?'+query,{cache:'no-store',credentials:'same-origin'});const stored=await check.json();
        const actual=(stored.entries||[]).map(row=>({student_name:row.student_name,amount_paid:row.amount_paid,payment_date:row.payment_date||''}));
        if(!check.ok||stored.status!=='success'||JSON.stringify(actual)!==JSON.stringify(entries)||stored.revision!==data.revision||String(stored.cycle_id)!==String(data.cycle_id))throw Error('Saved payments could not be verified. Your edits remain here; retry saving before reloading.');
        categoryUnpaidState.fee=stored.fee_amount;acceptCategoryCollectionTotals(stored);renderCategoryPayments(stored.entries);categoryUnpaidState.dirty=false;
        categoryUnpaidStatus('Saved: Collections and Daily Remittance amounts are updated. Confirm the transfer in Daily Remittances.');return true;
    }catch(error){categoryUnpaidStatus(error.message,true);return false;}
    finally{categoryUnpaidState.saving=false;categoryUnpaidControls(true);}
}
document.getElementById('sectionCollectionModal').addEventListener('hide.bs.modal', event => {
    if (event.defaultPrevented) return;
    if (!categoryUnpaidCanLeave()) { event.preventDefault(); return; }
    categoryUnpaidState.generation++;
    categoryUnpaidState.dirty = false;
});
window.addEventListener('beforeunload', event => {
    if (categoryUnpaidState.dirty || categoryUnpaidState.saving) { event.preventDefault(); event.returnValue = ''; }
});

// Student dates describe the current saved status; this is not an installment ledger.
function studentRecordToday() {
    const parts = new Intl.DateTimeFormat('en-US', {timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const part = key => parts.find(p => p.type === key).value;
    return `${part('year')}-${part('month')}-${part('day')}`;
}
const studentStatusReport = {rows:[],loading:false,unconfirmed:0,generation:0,modal:null};
function studentStatusRows(rows, filter = 'both') {
    return rows.filter(row => {
        const paid = row.amount_paid === null ? NaN : Math.round(Number(row.amount_paid)*100);
        const due = row.balance_due === null ? NaN : Math.round(Number(row.balance_due)*100);
        return Number.isFinite(paid) && Number.isFinite(due) && paid >= 0 && due > 0 &&
            (filter === 'both' || (filter === 'partial' ? paid > 0 : filter === 'unpaid' && paid === 0));
    }).slice().sort((a,b) => String(a.section_label).localeCompare(String(b.section_label)) ||
        String(a.category_name).localeCompare(String(b.category_name)) || String(a.student_name).localeCompare(String(b.student_name)));
}
function studentStatusTotals(rows) {
    return rows.reduce((sum,row) => {
        sum.fee += Math.round(Number(row.fee_amount)*100);
        sum.paid += Math.round(Number(row.amount_paid)*100);
        sum.due += Math.round(Number(row.balance_due)*100);
        return sum;
    },{fee:0,paid:0,due:0});
}
// One report group per normalized student name within its section.
// This groups presentation only: category lists and saved amounts remain separate.
function studentStatusGroups(sourceRows, filter = 'both') {
    const groups = new Map();
    for (const row of studentStatusRows(sourceRows,filter)) {
        const name = String(row.student_name || '').trim().replace(/\s+/g,' ');
        const section = String(row.item_key || row.section_label || '');
        const key = JSON.stringify([section,name.toLocaleLowerCase('en-US')]);
        if (!groups.has(key)) groups.set(key,{key,name,section_label:row.section_label || '',rows:[]});
        groups.get(key).rows.push(row);
    }
    return [...groups.values()].sort((a,b) => String(a.section_label).localeCompare(String(b.section_label)) || a.name.localeCompare(b.name));
}
function studentStatusCells(row, showSection = true, dateSpan = 1) {
    const esc = value => escapeHtml(String(value ?? ''));
    const partial = Number(row.amount_paid) > 0;
    return `${dateSpan > 0 ? `<td class="student-report-date" rowspan="${dateSpan}">${esc(row.payment_date || '—')}</td>` : ''}<td>${esc(row.student_name)}${showSection ? `<div class="student-report-section">${esc(systemProgramLabel(row.section_label || ''))}</div>` : ''}</td><td>${esc(row.category_name)}</td>` +
        `<td class="text-end amount">₱ ${esc(formatAmount(row.fee_amount))}</td><td class="text-end amount">₱ ${esc(formatAmount(row.amount_paid))}</td>` +
        `<td class="text-end amount">₱ ${esc(formatAmount(row.balance_due))}</td><td><strong class="${partial?'student-report-partial':'student-report-unpaid'}">${partial?'Partially Paid':'Unpaid'}</strong></td>`;
}
function studentStatusGroupHtml(groups, showSection = true) {
    const esc = value => escapeHtml(String(value ?? ''));
    return groups.map(group => {
        const totals = studentStatusTotals(group.rows);
        const dateRows = [...group.rows].sort((a,b) => String(a.payment_date || '').localeCompare(String(b.payment_date || '')));
        return dateRows.map((row, index) => {
            const date = String(row.payment_date || '');
            let span = 0;
            if (index === 0 || date !== String(dateRows[index - 1].payment_date || '')) {
                span = 1;
                while (index + span < dateRows.length && String(dateRows[index + span].payment_date || '') === date) span++;
            }
            return `<tr>${studentStatusCells(row, showSection, span)}</tr>`;
        }).join('') +
            `<tr class="student-report-subtotal"><td colspan="3">Total</td>` +
            `<td class="text-end amount">₱ ${esc(formatAmount(totals.fee/100))}</td><td class="text-end amount">₱ ${esc(formatAmount(totals.paid/100))}</td>` +
            `<td class="text-end amount">₱ ${esc(formatAmount(totals.due/100))}</td><td></td></tr>`;
    }).join('');
}
function upgradeStudentReportButton() {
    if (getUserRole() !== 'treasurer' || document.getElementById('allStudentStatusButton')) return;
    const reference = document.querySelector('button[onclick="openAllRemittances()"]');
    if (!reference) return;
    const button = document.createElement('button');
    button.type = 'button'; button.id = 'allStudentStatusButton';
    button.className = 'btn btn-outline-gold btn-sm fw-bold';
    button.innerHTML = '<i class="bi bi-people me-1"></i>Unpaid / Partially Paid Students';
    button.addEventListener('click', () => openStudentStatusReport());
    reference.insertAdjacentElement('afterend',button);
}
function ensureStudentStatusModal() {
    if (document.getElementById('studentStatusReportModal')) return;
    const holder = document.createElement('div');
    holder.innerHTML = `<div class="modal fade" id="studentStatusReportModal" tabindex="-1" aria-labelledby="studentStatusReportTitle" aria-hidden="true">
        <div class="modal-dialog modal-xl modal-dialog-scrollable"><div class="modal-content bg-panel text-main">
        <div class="modal-header"><h2 class="modal-title fs-5" id="studentStatusReportTitle">Unpaid / Partially Paid Students — All Sections</h2><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div>
        <div class="modal-body"><p class="small text-muted">Saved student lists. Save changes in each section before opening this report. The filter shows only the selected payment statuses.</p>
        <div class="d-flex align-items-end flex-wrap gap-3 mb-3"><div><label class="form-label" for="studentStatusReportFilter">Include in report</label><select class="form-select" id="studentStatusReportFilter"><option value="both">Both — Partially Paid and Unpaid</option><option value="partial">Partially Paid only</option><option value="unpaid">Unpaid only</option></select></div><button type="button" id="studentStatusReportRefresh" class="btn btn-outline-primary">Refresh Saved Lists</button></div>
        <p id="studentStatusReportMessage" class="small" role="status" aria-live="polite"></p>
        <div class="table-responsive"><table class="table align-middle"><thead><tr><th>Date</th><th>Name</th><th>Item / Category</th><th class="text-end">Fee</th><th class="text-end">Amount Paid</th><th class="text-end">Remaining Balance</th><th>Status</th></tr></thead><tbody id="studentStatusReportRows"></tbody></table></div></div>
        <div class="modal-footer"><button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Close</button><button type="button" class="btn btn-gold" id="studentStatusReportPrint" disabled><i class="bi bi-printer me-1"></i>Print / Save as PDF</button></div>
        </div></div></div>`;
    document.body.appendChild(holder.firstElementChild);
    document.getElementById('studentStatusReportFilter').addEventListener('change',renderStudentStatusReport);
    document.getElementById('studentStatusReportRefresh').addEventListener('click',loadStudentStatusReport);
    document.getElementById('studentStatusReportPrint').addEventListener('click',printStudentStatusReport);
    const style = document.createElement('style');
    style.textContent = '.student-report-partial{color:#9a6200}.student-report-unpaid{color:#b52e47}.student-report-date{white-space:nowrap}.student-report-group td{border-top:2px solid #285fae}.student-report-section{font-size:.85em}.student-report-group-status{font-size:.85em;font-weight:600}.student-report-subtotal td{font-weight:600}';
    document.head.appendChild(style);
}
function ensureSectionStudentStatusButton() {
    if (getUserRole() !== 'treasurer' || document.getElementById('sectionStudentStatusButton')) return;
    const button = document.createElement('button');
    button.type = 'button'; button.id = 'sectionStudentStatusButton';
    button.className = 'btn btn-outline-primary btn-sm mb-3';
    button.textContent = 'Partially Paid and Unpaid Students';
    button.addEventListener('click', () => {
        if (sectionRemittanceState.busy || !categoryUnpaidCanLeave()) return;
        const key = sectionRemittanceState.key;
        const label = document.getElementById('scmTitle').textContent.replace(/\s*[—–-]\s*Collections\s*$/i, '');
        const modal = document.getElementById('sectionCollectionModal');
        modal.addEventListener('hidden.bs.modal', () => openStudentStatusReport(key, label), {once:true});
        bootstrap.Modal.getInstance(modal).hide();
    });
    document.querySelector('#sectionCollectionModal .modal-body').prepend(button);
}
function scopedStudentStatusRows() {
    return studentStatusReport.sectionKey === null ? studentStatusReport.rows :
        studentStatusReport.rows.filter(row => String(row.item_key) === studentStatusReport.sectionKey);
}
function openStudentStatusReport(sectionKey = null, sectionLabel = '') {
    if (getUserRole() !== 'treasurer') return;
    ensureStudentStatusModal();
    studentStatusReport.sectionKey = sectionKey === null ? null : String(sectionKey);
    studentStatusReport.sectionLabel = sectionLabel;
    document.getElementById('studentStatusReportTitle').textContent = 'Partially Paid and Unpaid Students — ' + (sectionKey === null ? 'All Sections' : systemProgramLabel(sectionLabel));
    if (!studentStatusReport.modal) studentStatusReport.modal = new bootstrap.Modal(document.getElementById('studentStatusReportModal'));
    studentStatusReport.modal.show();
    loadStudentStatusReport();
}
async function loadStudentStatusReport() {
    const generation = ++studentStatusReport.generation;
    studentStatusReport.loading = true; studentStatusReport.rows = []; studentStatusReport.unconfirmed = 0;
    document.getElementById('studentStatusReportPrint').disabled = true;
    document.getElementById('studentStatusReportRefresh').disabled = true;
    document.getElementById('studentStatusReportRows').innerHTML = '';
    document.getElementById('studentStatusReportMessage').textContent = 'Loading saved lists from all sections…';
    try {
        const response = await fetch('category_unpaid.php?action=all_students',{credentials:'same-origin',cache:'no-store'});
        const data = await response.json();
        if (generation !== studentStatusReport.generation) return;
        if (!response.ok || data.status !== 'success' || !Array.isArray(data.rows)) throw Error(data.message || 'Could not load student lists.');
        studentStatusReport.rows = data.rows; studentStatusReport.unconfirmed = Number(data.unconfirmed_count)||0;
        studentStatusReport.loading = false;
        renderStudentStatusReport();
    } catch(error) {
        if (generation === studentStatusReport.generation) document.getElementById('studentStatusReportMessage').textContent = error.message;
    } finally {
        if (generation === studentStatusReport.generation) {
            studentStatusReport.loading = false;
            document.getElementById('studentStatusReportRefresh').disabled = false;
        }
    }
}
function renderStudentStatusReport() {
    if (studentStatusReport.loading) return;
    const filter = document.getElementById('studentStatusReportFilter').value;
    const rows = studentStatusRows(scopedStudentStatusRows(),filter);
    const totals = studentStatusTotals(rows);
    const groups = studentStatusGroups(rows);
    document.getElementById('studentStatusReportRows').innerHTML = studentStatusGroupHtml(groups, studentStatusReport.sectionKey === null) || '<tr><td colspan="7" class="text-center">No saved students match this selection.</td></tr>';
    document.getElementById('studentStatusReportMessage').textContent = `${groups.length} student(s) · ${rows.length} category entries · Paid ₱ ${formatAmount(totals.paid/100)} · Due ₱ ${formatAmount(totals.due/100)}` +
        (studentStatusReport.unconfirmed ? ` · ${studentStatusReport.unconfirmed} older entries excluded: confirm their Amount Paid in the section list first.` : '');
    document.getElementById('studentStatusReportPrint').disabled = rows.length === 0;
}
function buildStudentStatusPrintHtml(sourceRows, filter = 'both', generatedAt = new Date(), sectionLabel = null) {
    const esc = value => escapeHtml(String(value ?? ''));
    const rows = studentStatusRows(sourceRows,filter);
    const total = studentStatusTotals(rows);
    const label = filter === 'partial' ? 'PARTIALLY PAID STUDENTS' : filter === 'unpaid' ? 'UNPAID STUDENTS' : 'PARTIALLY PAID AND UNPAID STUDENTS';
    const groups = studentStatusGroups(rows);
    const body = studentStatusGroupHtml(groups, sectionLabel === null);
    const roles = typeof window.getWorkspaceReportSignatories === 'function' ? window.getWorkspaceReportSignatories('treasurer') : {prepared:{name:'',position:'Organization Treasurer'}};
    const signatures = [['prepared','Prepared by:'],['certified','Certified by:'],['noted','Noted by:'],['approved','Approved by:']].map(([key,title])=>`<div class="signatory"><div>${title}</div><div class="sig-name">${esc(roles[key]?.name || '')}</div><small>Signature over printed name</small><div>${esc(roles[key]?.position || '')}</div></div>`).join('');
    const date = generatedAt.toLocaleString('en-PH',{timeZone:'Asia/Manila',year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:true});
    return `<!doctype html><html><head><meta charset="utf-8"><title>${label} — ICSSO</title><style>
    @page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{font:10px/1.45 Arial,sans-serif;color:#172c4d;margin:0}.date{text-align:right;margin-bottom:18px}.header{position:relative;text-align:center;padding:0 68px 14px;border-bottom:2px solid #285fae;margin-bottom:18px;min-height:60px}.header h2{font-size:15px;margin:0}.header p{margin:3px 0}.logo{position:absolute;top:0;width:68px;height:68px;object-fit:contain}.left{left:max(4px, calc(50% - 240px))}.right{right:max(4px, calc(50% - 240px))}h3{font-size:12px}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #cad8e9;padding:7px 6px;vertical-align:top;overflow-wrap:anywhere}th{background:#eaf2fc;font-size:8px;text-transform:uppercase}td{font-size:9px}.amount{text-align:right;white-space:nowrap}.student-report-date{white-space:nowrap}.student-report-group{break-after:avoid;page-break-after:avoid}.student-report-group td{background:#eaf2fc;border-top:2px solid #285fae}.student-report-section{font-size:9px;margin-top:2px}.student-report-group-status{font-size:9px;font-weight:bold}.student-report-subtotal td{background:#f3f7fd;font-weight:bold}.student-report-partial{color:#9a6200}.student-report-unpaid{color:#b52e47}.subtotal td,tfoot td{background:#f3f7fd}tr{break-inside:avoid}thead{display:table-header-group}tfoot{display:table-row-group}.note{font-size:9px;margin-top:12px}.signatories{display:flex;gap:24px;margin-top:36px;break-inside:avoid}.signatory{flex:1;min-width:0;text-align:center;overflow-wrap:anywhere}.signatory>div:first-child{text-align:left}.sig-name{margin-top:32px;border-bottom:1px solid #172c4d;min-height:16px;font-weight:bold}.toolbar{text-align:right;margin-bottom:15px}button{background:#285fae;color:white;border:0;padding:9px 16px;border-radius:5px}@media screen{body{padding:24px;max-width:1350px;margin:auto}}@media print{.toolbar{display:none}th,.student-report-group td{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
    </style></head><body><div class="toolbar"><button onclick="window.print()">Print / Save as PDF</button></div><div class="date">Date: ${esc(date)} PHT</div><div class="header"><img class="logo left" src="${esc(new URL('nisu_logo.png',window.location.href).href)}" alt="NISU"><img class="logo right" src="${esc(new URL('cics_logo.png',window.location.href).href)}" alt="CICS"><h2>NORTHERN ILOILO STATE UNIVERSITY</h2><p>Estancia, Iloilo</p><p>College of Information and Computing Studies</p><p>STUDENT ORGANIZATION FUNDS</p></div><h3>${label} — ${sectionLabel === null ? 'ALL SECTIONS' : esc(systemProgramLabel(sectionLabel))}</h3><table><colgroup><col style="width:11%"><col style="width:22%"><col style="width:19%"><col style="width:11%"><col style="width:12%"><col style="width:12%"><col style="width:13%"></colgroup><thead><tr><th>Date</th><th>Name</th><th>Item / Category</th><th>Fee</th><th>Amount Paid</th><th>Balance</th><th>Status</th></tr></thead><tbody>${body}</tbody><tfoot><tr><td colspan="3"><strong>GRAND TOTAL</strong></td><td class="amount">₱ ${esc(formatAmount(total.fee/100))}</td><td class="amount">₱ ${esc(formatAmount(total.paid/100))}</td><td class="amount">₱ ${esc(formatAmount(total.due/100))}</td><td></td></tr></tfoot></table><div class="signatories">${signatures}</div></body></html>`;
}
function printStudentStatusReport() {
    if (getUserRole() !== 'treasurer' || studentStatusReport.loading) return;
    const filter = document.getElementById('studentStatusReportFilter').value;
    if (!studentStatusRows(scopedStudentStatusRows(),filter).length) return;
    const html = buildStudentStatusPrintHtml(scopedStudentStatusRows(),filter,new Date(),studentStatusReport.sectionKey === null ? null : studentStatusReport.sectionLabel);
    const win = window.open('','_blank');
    if (!win) { document.getElementById('studentStatusReportMessage').textContent = 'Allow pop-ups, then select Print / Save as PDF again.'; return; }
    win.document.open();win.document.write(html);win.document.close();
    const print = () => { win.focus();win.print(); };
    if (win.document.readyState === 'complete') win.setTimeout(print,150);
    else win.addEventListener('load',print,{once:true});
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',upgradeStudentReportButton,{once:true});
else upgradeStudentReportButton();


function applyCategoryCollectionAmount(category, cents) {
    const input=[...document.querySelectorAll('#scmBody .scm-cat-input')].find(input=>String(input.dataset.catId)===String(category));
    if(input){input.value=(cents/100).toFixed(2);onCategoryModalValueChange(input);}
}
function acceptCategoryCollectionTotals(data) {
    if(!data.collection_totals || data.roster_accounted_amount === undefined)throw Error('Update category_unpaid.php and student_collection_link.php before saving linked student payments.');
    categoryUnpaidState.baseCollectedCents=Math.round(Number(data.collection_totals[categoryUnpaidState.category]||0)*100);
    categoryUnpaidState.accountedPaidCents=Math.round(Number(data.roster_accounted_amount)*100);
    Object.entries(data.collection_totals).forEach(([category,value])=>applyCategoryCollectionAmount(category,Math.round(Number(value)*100)));
    if(data.pending_student_amount!==undefined){
        const id=categoryUnpaidState.category;
        const old=Number(sectionRemittanceState.pending[id]||0);const pending=Number(data.pending_student_amount);
        const previousTotal=Number(sectionRemittanceState.lastTotals?.[id]||0);
        if(sectionRemittanceState.balancesReady) sectionRemittanceState.available[id]=Math.max(0,Number(sectionRemittanceState.available[id]||0)+Number(data.collection_totals[id]||0)-previousTotal-pending+old).toFixed(2);
        sectionRemittanceState.pending[id]=pending.toFixed(2);
        sectionRemittanceState.lastTotals={...data.collection_totals};syncLinkedRemittanceAmounts();
    }
}
function rosterCollectionPreview(baseCents, accountedCents, entries, mode='new') {
    if(entries.some(entry=>!entry.student_name.trim() || entry.amount_paid.trim()==='' || !Number.isFinite(Number(entry.amount_paid)) || Number(entry.amount_paid)<0))return null;
    const paid=entries.reduce((sum,entry)=>sum+Math.round(Number(entry.amount_paid)*100),0);
    return mode==='included'?baseCents:baseCents+paid-accountedCents;
}
function previewCategoryCollectionTotals() {
    if(categoryUnpaidState.baseCollectedCents===null)return;
    const total=rosterCollectionPreview(categoryUnpaidState.baseCollectedCents,categoryUnpaidState.accountedPaidCents,categoryPaymentEntries(),document.getElementById('categoryPaymentMode').value);
    const label=document.getElementById('categoryCollectionPreview');
    if(total===null||total<0){label.textContent='Complete the student names and payment amounts to preview collections.';restoreCategoryCollectionPreview();return;}
    applyCategoryCollectionAmount(categoryUnpaidState.category,total);
    label.textContent='Amount Collected after Save List: ₱ '+formatAmount(total/100)+(categoryUnpaidState.dirty?' · Unsaved':'');
}
function restoreCategoryCollectionPreview() {
    if(categoryUnpaidState.baseCollectedCents!==null)applyCategoryCollectionAmount(categoryUnpaidState.category,categoryUnpaidState.baseCollectedCents);
}


function syncLinkedRemittanceAmounts(force=false) {
    const container=document.getElementById('srmAmounts');
    if(!container)return;
    let summary=document.getElementById('srmLinkedPayments');
    if(!summary){
        summary=document.createElement('div');summary.id='srmLinkedPayments';summary.className='mb-3';
        summary.innerHTML='<div class="small mb-2" role="status" aria-live="polite"></div><button type="button" class="btn btn-outline-primary btn-sm">Use linked amounts</button>';
        container.before(summary);summary.querySelector('button').addEventListener('click',()=>syncLinkedRemittanceAmounts(true));
    }
    const outgoing=document.getElementById('srmDirection').value==='organization';
    const values=outgoing?sectionRemittanceState.available:sectionRemittanceState.pending;
    const total=Object.values(values).reduce((sum,value)=>sum+Math.round(Number(value)*100),0);
    summary.querySelector('div').textContent=sectionRemittanceState.balancesReady
        ? (outgoing?'Available to remit to custodian: ₱ ':'Saved student payments awaiting remittance: ₱ ')+formatAmount(total/100)
        : 'Loading linked student payments…';
    summary.querySelector('button').disabled=!sectionRemittanceState.balancesReady;
    if(!sectionRemittanceState.balancesReady)return;
    container.querySelectorAll('.srm-amount').forEach(input=>{
        const next=Number(values[input.dataset.category]||0).toFixed(2);
        if(force || (input.dataset.linkedValue===undefined && Number(input.value)===0) || input.value===input.dataset.linkedValue){
            input.value=next;input.dataset.linkedValue=next;
        }
    });
}


let remittanceCorrectionBusy=false;
async function correctRemittance(id,remove=false) {
    if(getUserRole()!=='admin' || remittanceCorrectionBusy || sectionRemittanceState.busy)return;
    const row=[...allRemittanceState.rows,...sectionRemittanceState.rows].find(row=>Number(row.id)===Number(id));
    if(!row || row.is_removed || row.is_cleared || Number(row.cycle_id)!==Number(allRemittanceState.rows.includes(row)?allRemittanceState.cycle:sectionRemittanceState.cycle))return;
    const values=JSON.parse(row.category_data||'{}'),names=JSON.parse(row.category_names||'{}');
    const legacy=row.direction==='classroom' && row.student_coverage===null;
    const esc=value=>escapeHtml(String(value??''));
    const request=newRemittanceRequestId();
    remittanceCorrectionBusy=true;
    try {
        const result=await Swal.fire({title:remove?'Remove remittance':'Record correction',width:640,customClass:{popup:'rmc-dialog'},showCloseButton:true,
            html:`<div class="rmc-context"><span class="rmc-eyebrow">${esc(row.date_remitted)} · ${row.direction==='classroom'?'Classroom → Organization':'Organization → Custodian'}</span><strong>${esc(systemProgramLabel(row.section_label))}</strong></div><div class="rmc-total-pair"><div><span>Original amount</span><strong>₱ ${esc(formatAmount(row.original_record?.amount??row.amount))}</strong></div><div><span>Current amount</span><strong>₱ ${esc(formatAmount(row.amount))}</strong></div></div>${remove?'<div class="rmc-notice">This entry will leave the active list. Its effect on balances will be reversed, and the original record will remain in the audit history.</div>':''}<form id="remittanceCorrectionForm"><div class="text-start">${Object.entries(values).map(([cat,value],i)=>`<div class="rmc-category"><label class="form-label" for="rmcAmount${i}">${esc(names[cat]||cat)}</label><div class="rmc-money-input"><span>₱</span><input id="rmcAmount${i}" class="form-control" type="number" min="0" max="9999999999.99" step="0.01" value="${esc(remove?'0.00':value)}" ${remove?'readonly':''} required></div>${legacy?`<div class="rmc-legacy"><label class="form-label" for="rmcCoverage${i}">Already counted in student payments</label><p>From the existing ₱ ${esc(formatAmount(value))}, confirm the amount already recorded in student lists. Enter 0 if none.</p><div class="rmc-money-input"><span>₱</span><input id="rmcCoverage${i}" class="form-control" type="number" min="0" max="${esc(value)}" step="0.01" placeholder="Enter confirmed amount" required></div></div>`:''}</div>`).join('')}<label class="form-label" for="rmcReason">${remove?'Reason for removal':'Reason for correction'}</label><textarea id="rmcReason" class="form-control" maxlength="500" rows="3" placeholder="Explain the mistake and what was confirmed with the Treasurer…" required></textarea><div class="rmc-caption">Recorded with your Admin account and the current date and time.</div></div></form>`,
            showCancelButton:true,confirmButtonText:remove?'Remove remittance':'Save correction',confirmButtonColor:remove?'#b33d4a':'#285fae',cancelButtonText:'Cancel',showLoaderOnConfirm:true,focusConfirm:false,
            allowOutsideClick:()=>!Swal.isLoading(),
            preConfirm:async()=>{
                if(!document.getElementById('remittanceCorrectionForm').reportValidity())return false;
                const amounts={},covered={};Object.keys(values).forEach((cat,i)=>{amounts[cat]=document.getElementById('rmcAmount'+i).value;if(legacy)covered[cat]=document.getElementById('rmcCoverage'+i).value;});
                try {
                    const response=await fetch('admin_remittance_correction.php',{method:'POST',headers:{'Content-Type':'application/json','X-App-CSRF':document.querySelector('meta[name="app-csrf"]')?.content||''},body:JSON.stringify({action:remove?'remove':'correct',id:Number(id),revision:row.correction_revision,request_id:request,amounts,legacy_covered:covered,reason:document.getElementById('rmcReason').value.trim()})});
                    const saved=await response.json();if(!response.ok||saved.status!=='success')throw Error(saved.message||'Unable to record correction.');return saved;
                } catch(error){Swal.showValidationMessage(error.message);return false;}
            }
        });
        if(result.isConfirmed){
            await loadAllRemittances();
            if(sectionRemittanceState.key===row.item_key){await loadSectionRemittances();if(categoryUnpaidState.category)await loadCategoryUnpaid();}
            await Swal.fire({icon:'success',title:remove?'Remittance removed':'Correction recorded',text:remove?'Balances were updated. The original entry and reason remain available under Show removed records.':'The original entry and explanation are retained. Totals now use the corrected amount.'});
        }
    }finally{remittanceCorrectionBusy=false;}
}
function renderAllRemittanceReview(){
    const showRemoved=!!document.getElementById('rmcShowRemoved')?.checked;
    const rows=allRemittanceState.rows.filter(row=>!row.is_removed||showRemoved);
    document.getElementById('allRemittancesRows').innerHTML=remittanceHistoryRowsHtml(rows,allRemittanceState.cycle);
    const current=allRemittanceState.rows.filter(row=>!row.is_removed&&!row.is_cleared&&Number(row.cycle_id)===Number(allRemittanceState.cycle));
    for(const [id,direction] of [['rmcReceived','classroom'],['rmcForwarded','organization']]){
        const node=document.getElementById(id);if(node)node.textContent='₱ '+formatAmount(current.filter(row=>row.direction===direction).reduce((sum,row)=>sum+Number(row.amount),0));
    }
    const count=document.getElementById('rmcRecordCount');if(count)count.textContent=String(current.length);
}
function installAdminRemittanceCorrections(){
    if(!document.getElementById('remittanceAdminStyles')){
        const link=document.createElement('link');link.id='remittanceAdminStyles';link.rel='stylesheet';link.href='remittance_admin_ui.css?v=20261023';document.head.appendChild(link);
    }
    const tabs=document.getElementById('adminTabs'),content=document.getElementById('adminTabsContent'),body=document.querySelector('#allRemittancesModal .modal-body');
    if(!tabs || !content || !body || getUserRole()!=='admin' || document.getElementById('remittance-review-tab'))return;
    document.getElementById('adminRemittanceReview')?.remove();
    const item=document.createElement('li');item.className='nav-item';item.setAttribute('role','presentation');
    item.innerHTML='<button type="button" class="nav-link" id="remittance-review-tab" data-bs-toggle="tab" data-bs-target="#remittance-review-pane" role="tab" aria-controls="remittance-review-pane" aria-selected="false"><i class="bi bi-journal-check me-2"></i>Review &amp; Correct Remittances</button>';
    document.getElementById('col-settings-tab')?.closest('li').after(item);
    const pane=document.createElement('div');pane.id='remittance-review-pane';pane.className='tab-pane fade rmc-review';pane.setAttribute('role','tabpanel');pane.setAttribute('aria-labelledby','remittance-review-tab');
    pane.innerHTML='<div class="rmc-review-heading"><div><span class="rmc-eyebrow">ADMIN OVERSIGHT</span><h4>Remittance review</h4><p>Review transfers, record corrections, and keep a clear audit history.</p></div></div><div class="rmc-metrics"><div><span>Received from classrooms</span><strong id="rmcReceived">₱ 0.00</strong></div><div><span>Remitted to custodian</span><strong id="rmcForwarded">₱ 0.00</strong></div><div><span>Active records</span><strong id="rmcRecordCount">0</strong></div></div>';
    while(body.firstChild)pane.appendChild(body.firstChild);
    const signatories=pane.querySelector('.rounded.border');
    if(signatories){const details=document.createElement('details');details.className='rmc-signatories mb-3';details.innerHTML='<summary>Report signatories</summary>';signatories.before(details);details.appendChild(signatories);signatories.querySelector('h6')?.remove();}
    const toggle=document.createElement('label');toggle.className='rmc-removed-toggle';toggle.innerHTML='<input type="checkbox" id="rmcShowRemoved"> Show removed records';pane.querySelector('#allRemittancesStatus').before(toggle);
    const columnWidths=['10%','18%','24%','17%','11%','20%'];
    pane.querySelectorAll('.remittance-history-table colgroup col').forEach((col,i)=>{col.style.width=columnWidths[i]||'';});
    content.appendChild(pane);
    toggle.querySelector('input').addEventListener('change',renderAllRemittanceReview);
    document.getElementById('remittance-review-tab').addEventListener('shown.bs.tab',loadAllRemittances);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installAdminRemittanceCorrections,{once:true});else installAdminRemittanceCorrections();
