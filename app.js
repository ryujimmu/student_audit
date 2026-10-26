// Format visible program names without changing section IDs, option values or database keys.
function systemProgramLabel(value) {
    return String(value ?? '')
        .replace(/\b(?:Department\s+of|Bachelor\s+of\s+Science\s+in)\s+/gi, 'BS in ')
        .replace(/\bBS\s+in\s+Library\s+(?:of|and)\s+Information\s+Science\b/gi, 'BS in Library and Information Science');
}

// Allow SweetAlert prompts above Bootstrap modals.
if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
    bootstrap.Modal.prototype._enforceFocus = function () {};
}

document.addEventListener('focusin', function (e) {
    if (e.target.closest('.swal2-container')) {
        e.stopImmediatePropagation();
    }
}, true);

let historyStack = [];
let redoStack = [];
let documentArchive = [];
let collectionsStructure = [];
let expendituresStructure = [];
let collectionCategories = [];
let studentCounts = [];

let auditSignOffState = {
    collections: null,
    expenditures: null
};

function debounce(fn, wait) {
    let t = null;

    return function (...args) {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), wait);
    };
}

let saveStatusResetTimer = null;

function setSaveStatus(state, message) {
    const pill = document.getElementById('saveStatusPill');

    if (!pill) return;

    clearTimeout(saveStatusResetTimer);
    pill.classList.remove('d-none', 'saving', 'saved', 'error');
    pill.onclick = null;

    if (state === 'saving') {
        pill.classList.add('saving');
        pill.innerHTML = '<span class="save-status-dot"></span>Saving...';
    } else if (state === 'saved') {
        pill.classList.add('saved');
        pill.innerHTML =
            '<span class="save-status-dot"></span>' +
            (message || 'All changes saved');

        saveStatusResetTimer = setTimeout(
            () => pill.classList.add('d-none'),
            2200
        );
    } else if (state === 'error') {
        pill.classList.add('error');

        const detail = typeof message === 'string'
            ? message
            : (message?.detail || 'Save failed');

        pill.innerHTML = '<span class="save-status-dot"></span>';

        pill.appendChild(document.createTextNode(
            'Save failed: ' +
            detail +
            (message?.retry ? ' — click to retry' : '')
        ));

        pill.title = detail;

        if (
            message &&
            typeof message === 'object' &&
            typeof message.retry === 'function'
        ) {
            pill.onclick = message.retry;
        }
    }
}

async function postSave(url, payload) {
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'same-origin',
        body: JSON.stringify(payload)
    });

    if (response.status === 401) {
        throw new Error(
            'Your session expired. Please sign in again.'
        );
    }

    const body = await response.json().catch(() => null);

    if (!response.ok || !body || body.status !== 'success') {
        throw new Error(
            body?.message ||
            `Server error ${response.status}. Check the XAMPP PHP error log.`
        );
    }

    return body;
}

const VIEWS_BY_ROLE = Object.freeze({
    admin: [
        'admin-panel',
        'recovered-years',
        'database-health',
        'settings',
        'expenditures',
        'archives',
        'messages'
    ],
    treasurer: [
        'settings',
        'collections',
        'messages'
    ],
    auditor: [
        'settings',
        'reporting',
        'messages',
        'add-doc',
        'audit-register'
    ]
});

function getUserRole() {
    return (
        typeof currentUserRole === 'string' &&
        VIEWS_BY_ROLE[currentUserRole]
    )
        ? currentUserRole
        : 'auditor';
}

function getDefaultView() {
    return {
        admin: 'expenditures',
        treasurer: 'collections',
        auditor: 'reporting'
    }[getUserRole()];
}

function rememberView(view) {
    const role = getUserRole();

    if (!VIEWS_BY_ROLE[role].includes(view)) return;

    try {
        localStorage.setItem('nisu_last_view_' + role, view);
    } catch (e) {}
}

function getRememberedView() {
    const role = getUserRole();

    if (role === 'admin') return null;

    try {
        const view = localStorage.getItem(
            'nisu_last_view_' + role
        );

        return VIEWS_BY_ROLE[role].includes(view)
            ? view
            : null;
    } catch (e) {
        return null;
    }
}

const defaultCollections = [
    {
        type: 'toggle',
        name: 'General Collections',
        id: 'gen-col',
        depth: 0
    },
    {
        type: 'in',
        name: 'Item 1',
        parent: 'gen-col',
        depth: 1
    }
];

const defaultExpenditures = [
    {
        type: 'toggle',
        name: 'General Events',
        id: 'evt-gen',
        depth: 0
    },
    {
        type: 'out',
        name: 'Venue',
        parent: 'evt-gen',
        depth: 1
    }
];

document.addEventListener('DOMContentLoaded', () => {
    loadDocuments();
    initializeSystem();
    refreshNotifBadge();

    setInterval(refreshNotifBadge, 15000);

    document.addEventListener('click', e => {
        const widget = document.querySelector(
            '.notif-bell-widget'
        );

        if (widget && !widget.contains(e.target)) {
            const dropdown = document.getElementById(
                'notifDropdown'
            );

            if (dropdown) {
                dropdown.classList.add('d-none');
            }
        }
    });
});

async function initializeSystem() {
    try {
        const response = await fetch('api.php');

        if (response.status === 401) {
            window.location.assign('login.php');
            return;
        }

        if (!response.ok) {
            throw new Error('Failed to load financial records');
        }

        const data = await response.json();

        if (
            data.sys_settings &&
            data.sys_settings.collection_categories
        ) {
            collectionCategories = JSON.parse(
                data.sys_settings.collection_categories
            );
        } else {
            collectionCategories = [{
                id: 'cat_' + Date.now(),
                name: 'General Form',
                price: 0
            }];
        }

        adminCategorySubcategories = {};
        if (typeof currentUserRole !== 'undefined' && currentUserRole === 'admin' &&
            data.sys_settings?.admin_category_subcategories) {
            adminCategorySubcategories = JSON.parse(data.sys_settings.admin_category_subcategories);
        }

        if (data.structure && data.structure.collections) {
            collectionsStructure = data.structure.collections;
        } else {
            collectionsStructure = defaultCollections;
        }

        if (data.structure && data.structure.expenditures) {
            expendituresStructure = data.structure.expenditures;
        } else {
            expendituresStructure = defaultExpenditures;
        }

        if (data.students) {
            studentCounts = data.students;
        }

        if (data.audit_signoffs) {
            auditSignOffState = data.audit_signoffs;
        }

        const overallInput = document.getElementById('overallExpenditureBudget');
        if (overallInput) overallInput.value = Number(data.overall_budget || 0).toFixed(2);

        renderAdminCategories();
        renderUI();
        populateData(data);
        initDropdown();
        updateAll();
        enforceRoles();

        const requestedView = new URLSearchParams(
            location.search
        ).get('view');

        switchView(
            getUserRole() === 'admin' ? (['recovered-years','database-health','settings'].includes(requestedView) ? requestedView : 'expenditures')
                : VIEWS_BY_ROLE[getUserRole()].includes(requestedView)
                    ? requestedView
                    : (getRememberedView() || getDefaultView())
        );
    } catch (e) {
        console.error('System Init Error:', e);

        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'error',
                title: 'Dashboard could not load',
                text: 'Please check your connection and database, then reload the page.',
                confirmButtonText: 'Reload'
            }).then(result => {
                if (result.isConfirmed) {
                    location.reload();
                }
            });
        }
    }
}

function parseAmount(value) {
    const amount = Number.parseFloat(
        String(value ?? '').replace(/[₱,\s]/g, '')
    );

    return Number.isFinite(amount) ? amount : 0;
}

function formatAmount(value) {
    return parseAmount(value).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function syncTreeVisibility(tbody) {
    if (!tbody) return;

    const parents = new Map(
        Array.from(
            tbody.querySelectorAll('tr.tree-grid-row[data-id]')
        ).map(tr => [tr.dataset.id, tr])
    );

    tbody.querySelectorAll('tr[data-parent]').forEach(tr => {
        let parentId = tr.getAttribute('data-parent');
        let visible = true;
        const seen = new Set();

        while (parentId) {
            if (seen.has(parentId)) {
                visible = false;
                break;
            }

            seen.add(parentId);

            const parent = parents.get(parentId);

            if (
                !parent ||
                !parent.classList.contains('is-expanded')
            ) {
                visible = false;
                break;
            }

            parentId = parent.getAttribute('data-parent');
        }

        tr.classList.toggle('d-none', !visible);
    });
}

function formatFinancialTableAmounts() {
    document.querySelectorAll(
        '#collectionsBody input[readonly], ' +
        '#expendituresBody input[readonly]'
    ).forEach(input => {
        if (!input.matches(
            '.row-total,.row-col-balance,.val-budget,' +
            '.val-balance,.parent-sum-total,' +
            '.parent-sum-budget,.parent-sum-balance,' +
            '.parent-sum-balance-col'
        )) {
            return;
        }

        input.type = 'text';
        input.value = formatAmount(input.value);
        input.classList.add('formatted-amount');
    });

    document.querySelectorAll(
        '#expendituresBody input.val-total:not([readonly]), ' +
        '#expendituresBody input.val-budget:not([readonly]), ' +
        '#overallExpenditureBudget, ' +
        '#categoryUnpaidRows input.student-paid-input'
    ).forEach(input => {
        if (
            !input.parentElement.classList.contains(
                'financial-input-shell'
            )
        ) {
            const shell = document.createElement('span');
            shell.className = 'financial-input-shell';
            if (input.id === 'overallExpenditureBudget') {
                shell.classList.add('overall-budget-shell');
            }

            input.parentNode.insertBefore(shell, input);
            shell.appendChild(input);

            const display = document.createElement('span');
            display.className = 'financial-input-value';
            display.setAttribute('aria-hidden', 'true');

            shell.appendChild(display);
        }

        input.parentElement.querySelector(
            '.financial-input-value'
        ).textContent = String(input.value).trim() === ''
            ? ''
            : formatAmount(input.value);
    });
}

function getTreeFullPath(structure, tr) {
    const nameDiv = tr.querySelector(
        'td div[class*="depth-"]'
    );

    const leaf = nameDiv
        ? (nameDiv.childNodes[0]?.textContent || '').trim()
        : (tr.dataset.name || 'Unknown item');

    const ancestors = [];
    let id = tr.getAttribute('data-parent');
    const seen = new Set();

    while (id && !seen.has(id)) {
        seen.add(id);

        const parent = structure.find(item => item.id === id);

        if (!parent) break;

        ancestors.unshift(parent.name);
        id = parent.parent;
    }

    return [...ancestors, leaf].map(systemProgramLabel).join(' › ');
}

function sortDataRows(parentId, tbody) {
    if (!parentId || !tbody) return;

    const parentRow = tbody.querySelector(
        `tr.tree-grid-row[data-id="${parentId}"]`
    );

    if (!parentRow) return;

    const siblingRows = Array.from(
        tbody.querySelectorAll(
            `tr.data-row[data-parent="${parentId}"]`
        )
    );

    if (siblingRows.length === 0) return;

    siblingRows.sort((a, b) => {
        let textA = '';
        let textB = '';

        const divA = a.querySelector(
            'td div[class*="depth-"]'
        );

        const divB = b.querySelector(
            'td div[class*="depth-"]'
        );

        if (divA && divA.childNodes.length > 0) {
            textA = divA.childNodes[0].textContent
                .trim()
                .toLowerCase();
        }

        if (divB && divB.childNodes.length > 0) {
            textB = divB.childNodes[0].textContent
                .trim()
                .toLowerCase();
        }

        return textA.localeCompare(textB, undefined, {
            numeric: true,
            sensitivity: 'base'
        });
    });

    let refNode = parentRow;

    siblingRows.forEach(row => {
        refNode.insertAdjacentElement('afterend', row);
        refNode = row;
    });
}

function renderUI() {
    const onScreenValues = new Map();

    document.querySelectorAll('tr.data-row').forEach(tr => {
        const key =
            (
                tr.getAttribute('data-parent')
                    ? tr.getAttribute('data-parent') + '-'
                    : ''
            ) + tr.dataset.name;

        const cats = {};

        tr.querySelectorAll('.val-dynamic').forEach(input => {
            cats[input.dataset.cat] = input.value;
        });

        onScreenValues.set(tr.dataset.type + ':' + key, {
            cats,
            value: tr.querySelector('.val-total')?.value,
            budget: tr.querySelector('.val-budget')?.value,
            remark: tr.querySelector('.remark-input')?.value
        });
    });

    const pendingEnrollment = new Map(
        [...document.querySelectorAll('.admin-student-input')]
            .map(input => [input.dataset.key, input.value])
    );

    const pendingBudget = new Map(
        [...document.querySelectorAll('.admin-budget-input')]
            .map(input => [input.dataset.key, input.value])
    );

    const collHead = document.getElementById(
        'collectionsHeadRow'
    );
    const collBody = document.getElementById(
        'collectionsBody'
    );
    const collFoot = document.getElementById(
        'collectionsFootRow'
    );

    const adminStudBody = document.getElementById(
        'adminStudentsBody'
    );
    const expBody = document.getElementById(
        'expendituresBody'
    );

    const canManageExpenditures = (
        typeof currentUserRole !== 'undefined' && currentUserRole === 'admin'
    );

    const expManageDisplay = canManageExpenditures
        ? ''
        : 'd-none';

    if (collHead) {
        collHead.innerHTML = `
            <th class="text-start ps-4 text-theme-gold">
                Section / Program
            </th>
            <th style="width: 170px;" class="text-strong fw-bold">
                Total Collected
            </th>
            <th style="width: 170px;" class="text-theme-crimson fw-bold">
                Collectibles
            </th>
            <th class="no-print text-theme-gold" style="width: 220px;">
                Remarks
            </th>
        `;
    }

    if (collFoot) {
        collFoot.innerHTML = `
            <td class="fw-bold pe-4 fs-5 text-theme-gold">
                TOTAL COLLECTIONS:
            </td>
            <td
                id="tot-receipts-table"
                class="text-white fw-bold text-center fs-5"
            >0.00</td>
            <td
                id="tot-col-balance-table"
                class="text-theme-crimson fw-bold text-center fs-5"
            >0.00</td>
            <td class="no-print"></td>
        `;
    }

    if (collBody) {
        collBody.innerHTML = '';

        if (adminStudBody) {
            adminStudBody.innerHTML = '';
        }

        collectionsStructure.forEach(row => {
            const parentAttr = row.parent
                ? `data-parent="${row.parent}"`
                : '';

            const visibility = row.parent ? 'd-none' : '';

            const safe = row.name
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '-');

            const fullKey = row.parent
                ? `${row.parent}-${safe}`
                : safe;

            if (row.type === 'toggle') {
                collBody.innerHTML += `
                    <tr
                        class="bg-sub-panel fw-semibold tree-grid-row ${visibility}"
                        aria-expanded="false"
                        data-id="${row.id}"
                        ${parentAttr}
                        onclick="toggleTree('${row.id}', this)"
                    >
                        <td>
                            <div class="d-flex align-items-center depth-${row.depth}">
                                <i class="bi bi-caret-right-fill toggle-icon text-theme-gold me-1"></i>${escapeHtml(systemProgramLabel(row.name))}
                            </div>
                        </td>

                        <td>
                            <input
                                type="number"
                                class="form-control text-center fw-bold text-strong bg-transparent border-0 parent-sum-total"
                                data-sum-target="${row.id}"
                                value="0"
                                readonly
                                tabindex="-1"
                                title="Subtotal includes all descendant sections, including collapsed sections"
                            >
                        </td>

                        <td>
                            <input
                                type="number"
                                class="form-control text-center fw-bold text-theme-crimson bg-transparent border-0 parent-sum-balance-col"
                                data-sum-target="${row.id}"
                                value="0"
                                readonly
                                tabindex="-1"
                                title="Outstanding balance for all descendant sections, including collapsed sections"
                            >
                        </td>

                        <td class="no-print"></td>
                    </tr>
                `;

                if (adminStudBody) {
                    adminStudBody.innerHTML += `
                        <tr class="bg-sub-panel">
                            <td
                                colspan="5"
                                class="fw-bold text-theme-gold ps-3 py-2"
                                style="font-size: 0.85rem;"
                            >
                                <div class="depth-${row.depth}">
                                    ${escapeHtml(systemProgramLabel(row.name))}
                                </div>
                            </td>
                        </tr>
                    `;
                }
            } else {
                let hiddenCategoryInputs =
                    '<div class="d-none dynamic-cat-inputs-holder">';

                collectionCategories.forEach(cat => {
                    hiddenCategoryInputs += `
                        <input
                            type="number"
                            class="val-dynamic"
                            data-cat="${cat.id}"
                            value="0"
                        >
                    `;
                });

                hiddenCategoryInputs += '</div>';

                collBody.innerHTML += `
                    <tr
                        data-name="${safe}"
                        data-type="in"
                        ${parentAttr}
                        class="${visibility} data-row"
                    >
                        <td>
                            <div class="d-flex align-items-center justify-content-between">
                                <div class="depth-${row.depth}">${escapeHtml(systemProgramLabel(row.name))}</div>
                            </div>
                            ${hiddenCategoryInputs}
                        </td>

                        <td>
                            <div class="input-group input-group-sm collection-amount-editor">
                                <input
                                    type="number"
                                    class="form-control text-center fw-bold text-strong row-total clickable-collected-cell"
                                    value="0.00"
                                    readonly
                                    onclick="openSectionCollectionModal(this.closest('tr'))"
                                    title="Click to enter category collections"
                                >
                                <button
                                    class="btn btn-outline-gold btn-sm no-print collection-edit-btn"
                                    type="button"
                                    onclick="openSectionCollectionModal(this.closest('tr'))"
                                    title="Edit category collections"
                                    aria-label="Edit category collections"
                                >
                                    <i class="bi bi-pencil-square"></i>
                                </button>
                            </div>
                        </td>

                        <td>
                            <input
                                type="number"
                                class="form-control text-center fw-bold text-theme-crimson bg-transparent border-0 row-col-balance"
                                value="0.00"
                                readonly
                                tabindex="-1"
                            >
                        </td>

                        <td class="no-print collection-remarks-cell">
                            <input
                                type="hidden"
                                class="remark-input"
                                value=""
                            >
                            <button
                                type="button"
                                class="remark-preview is-empty"
                                onclick="openRemarksModal(this.parentElement.querySelector('.remark-input'))"
                                title="Open full section remarks"
                                aria-label="Open full section remarks"
                            >
                                <span class="remark-preview-text">No remarks</span>
                                <i
                                    class="bi bi-arrows-angle-expand remark-preview-icon"
                                    aria-hidden="true"
                                ></i>
                            </button>
                        </td>
                    </tr>
                `;

                const studCount = studentCounts[fullKey] || 0;

                if (adminStudBody) {
                    adminStudBody.innerHTML += `
                        <tr>
                            <td>
                                <div class="depth-${row.depth} text-main">
                                    ${escapeHtml(systemProgramLabel(row.name))}
                                </div>
                            </td>

                            <td>
                                <input
                                    type="number"
                                    class="form-control form-control-sm text-end fw-bold admin-student-input"
                                    data-key="${fullKey}"
                                    value="${studCount}"
                                    oninput="updateAll()"
                                >
                            </td>

                            <td
                                class="text-end fw-bold text-strong align-middle admin-collected"
                                data-key="${fullKey}"
                            >₱ 0.00</td>

                            <td
                                class="text-end fw-bold text-theme-crimson align-middle admin-target"
                                data-key="${fullKey}"
                            >₱ 0.00</td>

                            <td class="text-center no-print">
                                <button
                                    type="button"
                                    class="btn btn-sm btn-outline-gold px-2 py-1"
                                    onclick="openSectionBreakdownModal('${fullKey}', '${escapeHtmlAttr(row.name)}', '${row.parent || ''}')"
                                    title="View category breakdown"
                                >
                                    <i class="bi bi-eye-fill"></i>
                                </button>
                            </td>
                        </tr>
                    `;
                }
            }
        });
    }

    if (expBody) {
        expBody.innerHTML = '';


        expendituresStructure.forEach(row => {
            const parentAttr = row.parent
                ? `data-parent="${row.parent}"`
                : '';

            const visibility = row.parent ? 'd-none' : '';

            const safe = row.name
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '-');

            const fullKey = row.parent
                ? `${row.parent}-${safe}`
                : safe;

            if (row.type === 'toggle') {
                expBody.innerHTML += `
                    <tr
                        class="bg-sub-panel fw-semibold tree-grid-row ${visibility}"
                        aria-expanded="false"
                        data-id="${row.id}"
                        ${parentAttr}
                        onclick="toggleTree('${row.id}', this)"
                    >
                        <td>
                            <div class="d-flex align-items-center depth-${row.depth}">
                                <i class="bi bi-caret-right-fill toggle-icon text-theme-gold me-1"></i>${escapeHtml(systemProgramLabel(row.name))}
                                <button
                                    class="btn btn-sm btn-link text-theme-gold ms-2 p-0 no-print ${expManageDisplay}"
                                    onclick="event.stopPropagation(); addAdminEventItem('${row.id}')"
                                >
                                    <i class="bi bi-plus-circle-fill"></i>
                                </button>
                            </div>
                        </td>

                        <td>
                            <input
                                type="number"
                                class="form-control text-center fw-bold text-theme-gold bg-transparent border-0 parent-sum-budget"
                                data-sum-target="${row.id}"
                                value="0"
                                readonly
                                tabindex="-1"
                            >
                        </td>

                        <td>
                            <input
                                type="number"
                                class="form-control text-center fw-bold text-theme-crimson bg-transparent border-0 parent-sum-total d-none"
                                data-sum-target="${row.id}"
                                value="0"
                                readonly
                                tabindex="-1"
                            >
                        </td>

                        <td>
                            <input
                                type="number"
                                class="form-control text-center fw-bold text-strong bg-transparent border-0 parent-sum-balance d-none"
                                data-sum-target="${row.id}"
                                value="0"
                                readonly
                                tabindex="-1"
                            >
                        </td>
                    </tr>
                `;

            } else {
                expBody.innerHTML += `
                    <tr
                        data-name="${safe}"
                        data-type="out"
                        ${parentAttr}
                        class="${visibility} data-row"
                    >
                        <td>
                            <div class="d-flex align-items-center justify-content-between">
                                <div
                                    class="depth-${row.depth}"
                                    style="cursor: ${canManageExpenditures ? 'pointer' : 'default'};"
                                    ${canManageExpenditures ? 'onclick="enableClickToEdit(this)"' : ''}
                                    title="${canManageExpenditures ? 'Click to rename' : ''}"
                                >${escapeHtml(systemProgramLabel(row.name))} <i class="bi bi-pencil text-muted small ms-1 opacity-50 no-print ${expManageDisplay}"></i></div>

                                <button
                                    class="btn btn-sm text-theme-crimson p-0 ms-2 no-print ${expManageDisplay}"
                                    onclick="removeAdminEventItem('${escapeHtmlAttr(fullKey)}')"
                                >
                                    <i class="bi bi-trash3-fill opacity-75"></i>
                                </button>
                            </div>
                        </td>

                        <td>
                            <input
                                type="number"
                                class="form-control text-center fw-bold text-theme-gold val-budget ${canManageExpenditures ? 'admin-budget-input' : 'bg-transparent border-0'}"
                                data-key="${escapeHtmlAttr(fullKey)}"
                                value="0" min="0" max="9999999999.99" step="0.01" required
                                ${canManageExpenditures ? '' : 'readonly tabindex="-1"'}
                            >
                        </td>

                        <td>
                            <input
                                type="number"
                                class="form-control text-center text-theme-crimson fw-bold val-total"
                                value="0"
                            >
                        </td>

                        <td>
                            <input
                                type="number"
                                class="form-control text-center fw-bold text-strong bg-transparent border-0 val-balance"
                                value="0"
                                readonly
                                tabindex="-1"
                            >
                        </td>
                    </tr>
                `;

            }
        });
    }

    document.querySelectorAll('tr.data-row').forEach(tr => {
        const key =
            (
                tr.getAttribute('data-parent')
                    ? tr.getAttribute('data-parent') + '-'
                    : ''
            ) + tr.dataset.name;

        const old = onScreenValues.get(
            tr.dataset.type + ':' + key
        );

        if (!old) return;

        tr.querySelectorAll('.val-dynamic').forEach(input => {
            if (
                Object.prototype.hasOwnProperty.call(
                    old.cats,
                    input.dataset.cat
                )
            ) {
                input.value = old.cats[input.dataset.cat];
            }
        });

        if (
            old.value !== undefined &&
            tr.querySelector('.val-total')
        ) {
            tr.querySelector('.val-total').value = old.value;
        }

        if (
            old.budget !== undefined &&
            tr.querySelector('.val-budget')
        ) {
            tr.querySelector('.val-budget').value = old.budget;
        }

        if (
            old.remark !== undefined &&
            tr.querySelector('.remark-input')
        ) {
            tr.querySelector('.remark-input').value = old.remark;
        }
    });

    document.querySelectorAll(
        '.admin-student-input'
    ).forEach(input => {
        if (pendingEnrollment.has(input.dataset.key)) {
            input.value = pendingEnrollment.get(input.dataset.key);
        }
    });

    document.querySelectorAll(
        '.admin-budget-input'
    ).forEach(input => {
        if (pendingBudget.has(input.dataset.key)) {
            input.value = pendingBudget.get(input.dataset.key);
        }
    });

    decorateExpenditureItems();
    renderChartFilterOptions();
}

/* Category Collections Modal Controller */

let activeModalRow = null;
let sectionCollectionModalInstance = null;

function openSectionCollectionModal(tr) {
    if (!tr) return;

    activeModalRow = tr;

    const modalEl = document.getElementById('sectionCollectionModal');

    if (!sectionCollectionModalInstance) {
        sectionCollectionModalInstance = new bootstrap.Modal(modalEl);
    }

    const nameDiv = tr.querySelector('td div[class*="depth-"]');

    const leafName = nameDiv && nameDiv.childNodes.length > 0
        ? nameDiv.childNodes[0].textContent.trim()
        : tr.dataset.name;

    const parentId = tr.getAttribute('data-parent');

    const fullPathLabel = buildPathLabel(
        collectionsStructure,
        parentId,
        leafName
    );

    const prefix = parentId ? parentId + '-' : '';
    const fullKey = prefix + tr.dataset.name;
    const studentCount = parseInt(studentCounts[fullKey]) || 0;

    document.getElementById('scmTitle').innerText =
        `${fullPathLabel} — Collections`;

    document.getElementById('scmSubtitle').innerText =
        `Enrolled Count: ${studentCount} Students`;

    const tbody = document.getElementById('scmBody');
    tbody.innerHTML = '';

    collectionCategories.forEach(cat => {
        const catInput = tr.querySelector(
            `.val-dynamic[data-cat="${cat.id}"]`
        );

        const cash = parseAmount(catInput?.value) || 0;
        const rate = parseAmount(cat.price) || 0;
        const collectible = studentCount * rate;
        const balance = collectible - cash;

        tbody.innerHTML += `
            <tr data-cat-id="${cat.id}">
                <td class="ps-3 fw-bold text-theme-gold">
                    ${escapeHtml(cat.name)}
                </td>

                <td class="text-end text-muted">
                    ₱ ${formatAmount(rate)}
                </td>

                <td
                    class="text-end text-muted scm-cat-collectible"
                    data-rate="${rate}"
                >
                    ₱ ${formatAmount(collectible)}
                </td>

                <td class="text-end">
                    <input
                        type="number"
                        class="form-control form-control-sm text-end fw-bold scm-cat-input"
                        data-cat-id="${cat.id}"
                        value="${cash.toFixed(2)}"
                        step="0.01"
                        min="0"
                        readonly
                        aria-label="Cumulative amount received"
                    >
                </td>

                <td class="text-end pe-3 fw-bold ${
                    balance > 0
                        ? 'text-theme-crimson'
                        : 'text-strong'
                } scm-cat-balance">
                    ₱ ${formatAmount(balance)}
                </td>
            </tr>
        `;
    });

    recalcModalTotals(studentCount);
    sectionCollectionModalInstance.show();
}

function onCategoryModalValueChange(input) {
    if (!activeModalRow) return;

    const catId = input.getAttribute('data-cat-id');
    const val = parseAmount(input.value) || 0;

    const rowInput = activeModalRow.querySelector(
        `.val-dynamic[data-cat="${catId}"]`
    );

    if (rowInput) {
        rowInput.value = val;
    }

    const parentId = activeModalRow.getAttribute('data-parent');
    const prefix = parentId ? parentId + '-' : '';
    const fullKey = prefix + activeModalRow.dataset.name;
    const studentCount = parseInt(studentCounts[fullKey]) || 0;

    const tr = input.closest('tr');

    const rate = parseAmount(
        tr.querySelector('.scm-cat-collectible')
            .getAttribute('data-rate')
    ) || 0;

    const collectible = studentCount * rate;
    const balance = collectible - val;

    const balCell = tr.querySelector('.scm-cat-balance');

    if (balCell) {
        balCell.innerText = `₱ ${formatAmount(balance)}`;

        if (balance > 0) {
            balCell.className =
                'text-end pe-3 fw-bold text-theme-crimson scm-cat-balance';
        } else {
            balCell.className =
                'text-end pe-3 fw-bold text-strong scm-cat-balance';
        }
    }

    recalcModalTotals(studentCount);
    updateAll();
}

function recalcModalTotals(studentCount) {
    let totCol = 0;
    let totCollect = 0;
    let totBal = 0;

    document.querySelectorAll('#scmBody tr').forEach(row => {
        const rate = parseAmount(
            row.querySelector('.scm-cat-collectible')
                ?.getAttribute('data-rate')
        ) || 0;

        const collectible = studentCount * rate;

        const cash = parseAmount(
            row.querySelector('.scm-cat-input')?.value
        ) || 0;

        const balance = collectible - cash;

        totCollect += collectible;
        totCol += cash;
        totBal += balance;
    });

    const colElem = document.getElementById('scmTotCollectible');
    const amtElem = document.getElementById('scmTotCollected');
    const balElem = document.getElementById('scmTotBalance');

    if (colElem) {
        colElem.innerText = `₱ ${formatAmount(totCollect)}`;
    }

    if (amtElem) {
        amtElem.innerText = `₱ ${formatAmount(totCol)}`;
    }

    if (balElem) {
        balElem.innerText = `₱ ${formatAmount(totBal)}`;
    }
}

/* Admin Section Target Breakdown Modal Controller */

let sectionBreakdownModalInstance = null;

function openSectionBreakdownModal(fullKey, leafName, parentId) {
    const modalEl = document.getElementById('sectionBreakdownModal');

    if (!modalEl) return;

    if (!sectionBreakdownModalInstance) {
        sectionBreakdownModalInstance = new bootstrap.Modal(modalEl);
    }

    const fullPathLabel = buildPathLabel(
        collectionsStructure,
        parentId,
        leafName
    );

    const studentCount = parseInt(studentCounts[fullKey]) || 0;

    document.getElementById('sbmTitle').innerText =
        `${fullPathLabel} — Target Breakdown`;

    document.getElementById('sbmSubtitle').innerText =
        `Enrolled Count: ${studentCount} Students`;

    let targetRow = null;

    document.querySelectorAll(
        '#collectionsBody tr.data-row'
    ).forEach(tr => {
        const prefix = tr.getAttribute('data-parent')
            ? tr.getAttribute('data-parent') + '-'
            : '';

        if (prefix + tr.dataset.name === fullKey) {
            targetRow = tr;
        }
    });

    const tbody = document.getElementById('sbmBody');
    tbody.innerHTML = '';

    let totalTarget = 0;
    let totalCollected = 0;
    let totalBal = 0;

    collectionCategories.forEach(cat => {
        const unitPrice = parseAmount(cat.price) || 0;
        const targetAmount = studentCount * unitPrice;

        let cashCollected = 0;

        if (targetRow) {
            const input = targetRow.querySelector(
                `.val-dynamic[data-cat="${cat.id}"]`
            );

            cashCollected = parseAmount(input?.value) || 0;
        }

        const balance = targetAmount - cashCollected;

        totalTarget += targetAmount;
        totalCollected += cashCollected;
        totalBal += balance;

        tbody.innerHTML += `
            <tr>
                <td class="ps-3 fw-bold text-main">
                    ${escapeHtml(cat.name)}
                </td>

                <td class="text-end text-muted">
                    ₱ ${unitPrice.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    })}
                </td>

                <td class="text-end text-theme-gold fw-bold">
                    ₱ ${targetAmount.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    })}
                </td>

                <td class="text-end text-strong fw-bold">
                    ₱ ${cashCollected.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    })}
                </td>

                <td class="text-end pe-3 fw-bold ${
                    balance > 0
                        ? 'text-theme-crimson'
                        : 'text-strong'
                }">
                    ₱ ${balance.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    })}
                </td>
            </tr>
        `;
    });

    document.getElementById('sbmTotTarget').innerText =
        `₱ ${totalTarget.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;

    document.getElementById('sbmTotCollected').innerText =
        `₱ ${totalCollected.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;

    document.getElementById('sbmTotBalance').innerText =
        `₱ ${totalBal.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;

    sectionBreakdownModalInstance.show();
}

function renderChartFilterOptions() {
    const collFilter = document.getElementById(
        'collectionChartFilter'
    );

    if (collFilter) {
        const prevValue = collFilter.value;

        let optionsHTML =
            '<option value="all">Overall (By Program)</option>';

        collectionsStructure
            .filter(row => row.type === 'toggle' && !row.parent)
            .forEach(row => {
                optionsHTML += `
                    <option value="${escapeHtmlAttr(row.id)}">
                        ${escapeHtml(systemProgramLabel(row.name))} (By Year)
                    </option>
                `;
            });

        collFilter.innerHTML = optionsHTML;

        collFilter.value = [...collFilter.options].some(
            option => option.value === prevValue
        )
            ? prevValue
            : 'all';
    }

    const expFilter = document.getElementById(
        'expenditureChartFilter'
    );

    if (expFilter) {
        const prevValue = expFilter.value;

        let optionsHTML =
            '<option value="all">Overall (By Item)</option>';

        expendituresStructure
            .filter(row => row.type === 'toggle' && !row.parent)
            .forEach(row => {
                optionsHTML += `
                    <option value="${escapeHtmlAttr(row.id)}">
                        ${escapeHtml(systemProgramLabel(row.name))}
                    </option>
                `;
            });

        expFilter.innerHTML = optionsHTML;

        expFilter.value = [...expFilter.options].some(
            option => option.value === prevValue
        )
            ? prevValue
            : 'all';
    }
}

let manageExpModalInstance = null;

function openManageExpModal() {
    if (
        typeof currentUserRole === 'undefined' ||
        currentUserRole !== 'admin'
    ) {
        return;
    }

    const modalEl = document.getElementById('manageExpModal');

    if (!manageExpModalInstance) {
        manageExpModalInstance = new bootstrap.Modal(modalEl);
    }

    document.getElementById('newExpNameInput').value = '';

    const select = document.getElementById('removeExpSelect');

    select.innerHTML =
        '<option value="" disabled selected>Select an Item / Category...</option>';

    expendituresStructure.forEach(item => {
        if (item.depth === 0) {
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = systemProgramLabel(item.name);
            select.appendChild(option);
        }
    });

    manageExpModalInstance.show();
}

let adminEventBusy = false;
function eventItemKey(item) {
    const safe = String(item.name).toLowerCase().replace(/[^a-z0-9]/g, '-');
    return item.parent ? item.parent + '-' + safe : safe;
}
async function commitAdminEvents(next) {
    if (getUserRole() !== 'admin' || adminEventBusy) return false;
    adminEventBusy = true;
    const controls = [...(document.getElementById('manageExpModal')?.querySelectorAll('input,select,button') || []), ...document.querySelectorAll('.admin-budget-input')]
        .map(element => [element, element.disabled]);
    controls.forEach(([element]) => { element.disabled = true; });
    const pendingBudgets = new Map([...document.querySelectorAll('.admin-budget-input')].map(input => [input.dataset.key, input.value]));
    const overallInput = document.getElementById('overallExpenditureBudget');
    const pendingOverall = overallInput?.value;
    try {
        await postSave('api.php', {action:'save_structure',data:{collections:collectionsStructure,expenditures:next}});
        await initializeSystem();
        // Keep allocation edits that have not been submitted with Save Budgets.
        document.querySelectorAll('.admin-budget-input').forEach(input => {
            if (pendingBudgets.has(input.dataset.key)) input.value = pendingBudgets.get(input.dataset.key);
        });
        if (overallInput && pendingOverall !== undefined) overallInput.value = pendingOverall;
        updateAll();
        return true;
    } catch (error) {
        Swal.fire('Unable to update items', error.message, 'error');
        return false;
    } finally {
        adminEventBusy = false;
        controls.forEach(([element, disabled]) => { element.disabled = disabled; });
    }
}
async function confirmAddExp() {
    if (getUserRole() !== 'admin' || adminEventBusy) return;
    const name = document.getElementById('newExpNameInput').value.trim();
    if (!name) return Swal.fire('Missing Input', 'Please enter an item name.', 'warning');
    if (expendituresStructure.some(item => !item.parent && item.name.toLowerCase() === name.toLowerCase())) {
        return Swal.fire('Item already exists', 'Choose a different item name.', 'warning');
    }
    const id = 'exp-' + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2));
    const next = [...expendituresStructure, {type:'toggle',name,id,depth:0}];
    if (await commitAdminEvents(next)) {
        manageExpModalInstance?.hide();
        Swal.fire('Added!', 'Item added. Use the + button beside it in Expenditures to add its budget entries.', 'success');
    }
}
function eventDescendantIds(nodes, root) {
    const ids = new Set([root]);
    let changed = true;
    while (changed) {
        changed = false;
        nodes.forEach(item => {
            if (item.id && ids.has(item.parent) && !ids.has(item.id)) { ids.add(item.id); changed = true; }
        });
    }
    return ids;
}
async function confirmRemoveExp() {
    if (getUserRole() !== 'admin' || adminEventBusy) return;
    const id = document.getElementById('removeExpSelect').value;
    if (!id) return Swal.fire('Selection Required', 'Please select an item to remove.', 'warning');
    const result = await Swal.fire({title:'Remove Item?',text:'Remove this item/category, its budget entries and unused allocations? Items with recorded spending or transaction history must be archived instead.',icon:'warning',showCancelButton:true,confirmButtonText:'Remove Item'});
    if (!result.isConfirmed) return;
    const ids = eventDescendantIds(expendituresStructure, id);
    const next = expendituresStructure.filter(item => !ids.has(item.id) && !ids.has(item.parent));
    if (await commitAdminEvents(next)) {
        manageExpModalInstance?.hide();
        Swal.fire('Removed!', 'The item has been removed.', 'success');
    }
}
async function addAdminEventItem(parentId) {
    if (getUserRole() !== 'admin' || adminEventBusy) return;
    const parent = expendituresStructure.find(item => item.id === parentId);
    if (!parent) return;
    const result = await Swal.fire({title:'Add Item to ' + parent.name,input:'text',inputPlaceholder:'e.g., Sound System or Venue',showCancelButton:true,inputValidator:value=>!value.trim()?'Enter an item description.':undefined});
    if (!result.isConfirmed || !result.value?.trim()) return;
    const item = {type:'out',name:result.value.trim(),parent:parentId,depth:Number(parent.depth || 0)+1};
    if (expendituresStructure.some(existing => existing.type === 'out' && eventItemKey(existing) === eventItemKey(item))) {
        return Swal.fire('Item already exists', 'Choose a different item description within this category.', 'warning');
    }
    const next = [...expendituresStructure];
    let index = next.indexOf(parent)+1;
    while (index < next.length && Number(next[index].depth) > Number(parent.depth)) index++;
    next.splice(index,0,item);
    if (await commitAdminEvents(next)) Swal.fire('Added!', 'Enter its allocation and select Save Budgets.', 'success');
}
async function removeAdminEventItem(key) {
    if (getUserRole() !== 'admin' || adminEventBusy) return;
    const result = await Swal.fire({title:'Remove Item?',text:'Remove this item and its unused allocation? Items with recorded spending or transaction history must be archived instead.',icon:'warning',showCancelButton:true,confirmButtonText:'Remove Item'});
    if (!result.isConfirmed) return;
    const next = expendituresStructure.filter(item => item.type !== 'out' || eventItemKey(item) !== key);
    if (await commitAdminEvents(next)) Swal.fire('Removed!', 'The item has been removed.', 'success');
}

function initDropdown() {
    const select = document.getElementById('docCategory');
    const filterSelect = document.getElementById('vaultCategoryFilter');
    const previous = filterSelect?.value || '';
    const previousUpload = select?.value || '';
    const names = [...new Set(expendituresStructure
        .filter(item => item.type === 'toggle' || item.type === 'out')
        .map(item => String(item.name || '').trim()).filter(Boolean))];
    if (select) {
        select.innerHTML = '<option value="" selected disabled>Select an Item Description...</option>';
        names.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = systemProgramLabel(name);
            select.appendChild(option);
        });
        if (names.includes(previousUpload)) select.value = previousUpload;
    }
    if (filterSelect) {
        // Keep older document categories searchable without offering them for new uploads.
        const filterNames = [...new Set([...names, ...(Array.isArray(documentArchive) ? documentArchive : []).map(doc => doc.category).filter(Boolean)])];
        filterSelect.innerHTML = '<option value="">All Categories</option>';
        filterNames.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = systemProgramLabel(name);
            filterSelect.appendChild(option);
        });
        filterSelect.value = filterNames.includes(previous) ? previous : '';
    }
}

function populateData(data) {
    data.collections.forEach(item => {
        document.querySelectorAll(
            "tr[data-type='in']"
        ).forEach(tr => {
            const prefix = tr.getAttribute('data-parent')
                ? tr.getAttribute('data-parent') + '-'
                : '';

            if (
                prefix + tr.dataset.name === item.item_key &&
                item.category_data
            ) {
                try {
                    const savedCats = JSON.parse(
                        item.category_data
                    );

                    for (
                        const [catId, value]
                        of Object.entries(savedCats)
                    ) {
                        const input = tr.querySelector(
                            `.val-dynamic[data-cat="${catId}"]`
                        );

                        if (input) {
                            input.value = value;
                        }
                    }
                } catch (e) {}
            }
        });
    });

    data.expenditures.forEach(item => {
        document.querySelectorAll(
            "tr[data-type='out']"
        ).forEach(tr => {
            const prefix = tr.getAttribute('data-parent')
                ? tr.getAttribute('data-parent') + '-'
                : '';

            if (prefix + tr.dataset.name === item.item_key) {
                const input = tr.querySelector('.val-total');

                if (input) {
                    input.value = item.amount;
                }
            }
        });
    });

    if (data.budgets) {
        data.budgets.forEach(item => {
            document.querySelectorAll(
                "tr[data-type='out']"
            ).forEach(tr => {
                const prefix = tr.getAttribute('data-parent')
                    ? tr.getAttribute('data-parent') + '-'
                    : '';

                if (prefix + tr.dataset.name === item.item_key) {
                    const input = tr.querySelector('.val-budget');

                    if (input) {
                        input.value = item.allocated_amount;
                    }
                }
            });

            const adminInput = document.querySelector(
                `.admin-budget-input[data-key="${item.item_key}"]`
            );

            if (adminInput) {
                adminInput.value = item.allocated_amount;
            }
        });
    }
}

document.addEventListener('input', event => {
    if (!event.target.classList.contains('scm-cat-input')) {
        updateAll();
    }
});

let cachedCollectionCategorySubtotals = {};

function updateAll() {
    saveHistory();

    let totalIn = 0;
    let totalOut = 0;
    let totalBudget = 0;
    let totalColBalance = 0;

    const sums = {
        total: {},
        budget: {},
        colBalance: {},
        cats: {}
    };

    collectionCategories.forEach(category => {
        sums.cats[category.id] = {};
    });

    let maxPricePerStudent = 0;

    collectionCategories.forEach(category => {
        maxPricePerStudent += parseAmount(category.price) || 0;
    });

    document.querySelectorAll(
        '#collectionsBody tr.data-row'
    ).forEach(tr => {
        let rowTotal = 0;
        const autoRemarks = [];
        const categoryRemarks = [];
        let hasUnpaidCategory = false;

        const prefix = tr.getAttribute('data-parent')
            ? tr.getAttribute('data-parent') + '-'
            : '';

        const fullKey = prefix + tr.dataset.name;

        const adminInput = document.querySelector(
            `.admin-student-input[data-key="${fullKey}"]`
        );

        const studentCount = adminInput
            ? (parseInt(adminInput.value) || 0)
            : (parseInt(studentCounts[fullKey]) || 0);

        studentCounts[fullKey] = studentCount;

        collectionCategories.forEach(cat => {
            const cash = parseAmount(
                tr.querySelector(
                    `.val-dynamic[data-cat="${cat.id}"]`
                )?.value
            ) || 0;

            rowTotal += cash;

            const price = parseAmount(cat.price) || 0;

            if (studentCount > 0 && price > 0) {
                const paidStudents = Math.floor(cash / price);
                const unpaidStudents = studentCount - paidStudents;

                if (unpaidStudents > 0) {
                    hasUnpaidCategory = true;
                    autoRemarks.push(
                        `${unpaidStudents} unpaid ${cat.name}`
                    );
                } else {
                    autoRemarks.push(`Fully paid ${cat.name}`);
                }
                categoryRemarks.push({text: autoRemarks[autoRemarks.length - 1], paid: unpaidStudents <= 0});
            }

            let parentId = tr.getAttribute('data-parent');

            while (parentId) {
                sums.cats[cat.id][parentId] =
                    (sums.cats[cat.id][parentId] || 0) + cash;

                const parentRow = document.querySelector(
                    `tr[data-id="${parentId}"]`
                );

                parentId = parentRow
                    ? parentRow.getAttribute('data-parent')
                    : null;
            }
        });

        const rowTotalInput = tr.querySelector('.row-total');

        if (rowTotalInput) {
            rowTotalInput.value = rowTotal.toFixed(2);
        }

        totalIn += rowTotal;

        const target = studentCount * maxPricePerStudent;
        const remBalance = target - rowTotal;

        const balanceInput = tr.querySelector('.row-col-balance');

        if (balanceInput) {
            balanceInput.value = remBalance.toFixed(2);
        }

        totalColBalance += remBalance;

        const remarkInput = tr.querySelector('.remark-input');

        if (remarkInput) {
            const remarkText = studentCount > 0 ? autoRemarks.join(', ') : '';
            const emptyRemark = studentCount > 0
                ? 'No priced categories configured'
                : 'No student count set';

            remarkInput.value = remarkText;
            remarkInput.title = remarkText;
            const isMixed = hasUnpaidCategory && categoryRemarks.some(category => category.paid);
            remarkInput.dataset.categoryRemarks = JSON.stringify(categoryRemarks);
            remarkInput.dataset.mixedPayment = isMixed ? '1' : '0';

            const preview = tr.querySelector('.remark-preview');

            if (preview) {
                const display = preview.querySelector(
                    '.remark-preview-text'
                );

                if (display) {
                    if (categoryRemarks.length) {
                        renderCategoryPaymentRemarks(display, categoryRemarks, isMixed);
                    } else {
                        display.textContent = emptyRemark;
                    }
                }

                preview.classList.toggle(
                    'is-unpaid',
                    hasUnpaidCategory && !isMixed
                );
                preview.classList.toggle('is-mixed', isMixed);

                preview.classList.toggle(
                    'is-paid',
                    studentCount > 0 && autoRemarks.length > 0 && !hasUnpaidCategory
                );

                preview.classList.toggle(
                    'is-empty',
                    studentCount <= 0 || autoRemarks.length === 0
                );

                preview.title =
                    remarkText ||
                    emptyRemark;

                preview.setAttribute(
                    'aria-label',
                    (remarkText || emptyRemark) +
                    '. Open full remarks'
                );
            }
        }

        const adminCollected = document.querySelector(
            `.admin-collected[data-key="${fullKey}"]`
        );

        if (adminCollected) {
            adminCollected.innerText =
                `₱ ${rowTotal.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                })}`;
        }

        const adminTarget = document.querySelector(
            `.admin-target[data-key="${fullKey}"]`
        );

        if (adminTarget) {
            adminTarget.innerText =
                `₱ ${target.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                })}`;
        }

        let parentId = tr.getAttribute('data-parent');

        while (parentId) {
            sums.total[parentId] =
                (sums.total[parentId] || 0) + rowTotal;

            sums.colBalance[parentId] =
                (sums.colBalance[parentId] || 0) + remBalance;

            const parentRow = document.querySelector(
                `tr[data-id="${parentId}"]`
            );

            parentId = parentRow
                ? parentRow.getAttribute('data-parent')
                : null;
        }
    });

    document.querySelectorAll(
        '#expendituresBody tr.data-row'
    ).forEach(tr => {
        const spent = parseAmount(
            tr.querySelector('.val-total')?.value
        ) || 0;

        const budget = parseAmount(
            tr.querySelector('.val-budget')?.value
        ) || 0;

        const balance = budget - spent;

        const balanceInput = tr.querySelector('.val-balance');

        if (balanceInput) {
            balanceInput.value = formatAmount(balance);
        }

        const valInput = tr.querySelector('.val-total');

        if (valInput && balanceInput) {
            if (budget > 0 && spent > budget) {
                balanceInput.classList.add('text-theme-crimson');
                balanceInput.classList.remove('text-strong');
            } else {
                balanceInput.classList.remove('text-theme-crimson');
                balanceInput.classList.add('text-strong');
            }
        }

        totalOut += spent;
        totalBudget += budget;

        let parentId = tr.getAttribute('data-parent');

        while (parentId) {
            sums.total[parentId] =
                (sums.total[parentId] || 0) + spent;

            sums.budget[parentId] =
                (sums.budget[parentId] || 0) + budget;

            const parentRow = document.querySelector(
                `tr[data-id="${parentId}"]`
            );

            parentId = parentRow
                ? parentRow.getAttribute('data-parent')
                : null;
        }
    });

    document.querySelectorAll(
        '.parent-sum-total'
    ).forEach(input => {
        const id = input.getAttribute('data-sum-target');

        input.value = (sums.total[id] || 0).toFixed(2);

        const row = input.closest('tr');

        if (row) {
            const budgetInput = row.querySelector(
                '.parent-sum-budget'
            );

            const balanceInput = row.querySelector(
                '.parent-sum-balance'
            );

            if (budgetInput && balanceInput) {
                budgetInput.value =
                    (sums.budget[id] || 0).toFixed(2);

                balanceInput.value = (
                    (sums.budget[id] || 0) -
                    (sums.total[id] || 0)
                ).toFixed(2);
            }

            const collectionBalanceInput = row.querySelector(
                '.parent-sum-balance-col'
            );

            if (collectionBalanceInput) {
                collectionBalanceInput.value =
                    (sums.colBalance[id] || 0).toFixed(2);
            }
        }
    });

    const receiptsTotal = document.getElementById(
        'tot-receipts-table'
    );

    if (receiptsTotal) {
        receiptsTotal.innerText = formatAmount(totalIn);
    }

    const collectionBalanceTotal = document.getElementById(
        'tot-col-balance-table'
    );

    if (collectionBalanceTotal) {
        collectionBalanceTotal.innerText =
            formatAmount(totalColBalance);
    }

    const budgetTotal = document.getElementById(
        'tot-budget-table'
    );

    if (budgetTotal) {
        budgetTotal.innerText = formatAmount(totalBudget);
    }

    const expensesTotal = document.getElementById(
        'tot-expenses-table'
    );

    if (expensesTotal) {
        expensesTotal.innerText = formatAmount(totalOut);
    }

    const remainingTotal = document.getElementById(
        'tot-remaining-table'
    );

    if (remainingTotal) {
        remainingTotal.innerText =
            formatAmount(totalBudget - totalOut);
    }

    updateOverallBudgetSummary(totalOut);

    cachedCollectionCategorySubtotals = sums.cats;

    formatFinancialTableAmounts();

    updateDashboardVisuals(
        totalIn,
        totalOut,
        totalIn - totalOut
    );

    saveTable();
}

function formatYearToggleName(name) {
    const match = String(name).match(/^(\d+)(?:st|nd|rd|th)\b/i);
    return match ? match[1] : name;
}

function formatSectionLeafName(name) {
    const match = String(name).match(/^section\s+(.+)$/i);
    return match ? match[1].trim() : name;
}

function buildPathLabel(structureArr, parentId, leafName) {
    const ancestorNames = [];
    let pid = parentId;

    while (pid) {
        const node = structureArr.find(row => row.id === pid);
        if (!node) break;

        ancestorNames.unshift(node.name);
        pid = node.parent;
    }

    const leaf = formatSectionLeafName(leafName);

    if (ancestorNames.length === 0) return leaf;

    const dept = systemProgramLabel(ancestorNames[0]);
    const middle = ancestorNames.slice(1).map(formatYearToggleName);

    return `${dept} ${[...middle, leaf].join('-')}`;
}

function gatherTableData() {
    const data = [];

    document.querySelectorAll('tr.data-row').forEach(tr => {
        const type = tr.dataset.type;
        const role = getUserRole();
        if ((type === 'in' && role !== 'treasurer') ||
            (type === 'out' && role !== 'admin')) return;
        const parentId = tr.getAttribute('data-parent');
        const prefix = parentId ? parentId + '-' : '';
        const nameDiv = tr.querySelector('[class*="depth-"]');

        const leafName = nameDiv && nameDiv.childNodes.length > 0
            ? nameDiv.childNodes[0].textContent.trim()
            : tr.dataset.name;

        if (type === 'in') {
            const catData = {};

            tr.querySelectorAll('.val-dynamic').forEach(input => {
                catData[input.getAttribute('data-cat')] =
                    parseAmount(input.value) || 0;
            });

            data.push({
                name: prefix + tr.dataset.name,
                type: 'in',
                category_data: catData,
                remark: tr.querySelector('.remark-input')?.value || '',
                label: buildPathLabel(
                    collectionsStructure,
                    parentId,
                    leafName
                )
            });
        } else if (type === 'out') {
            const value = parseAmount(
                tr.querySelector('.val-total')?.value
            ) || 0;

            data.push({
                name: prefix + tr.dataset.name,
                type: 'out',
                values: [value],
                remark: '',
                label: buildPathLabel(
                    expendituresStructure,
                    parentId,
                    leafName
                )
            });
        }
    });

    return data;
}

async function saveTable() {
    if (
        typeof currentUserRole !== 'undefined' &&
        currentUserRole === 'auditor'
    ) {
        return;
    }

    debouncedPersistTable();
}

let clearTableInProgress = false;
let saveInFlight = false;
let saveQueuedAfterInFlight = false;

async function persistTable() {
    if (clearTableInProgress) return;

    if (saveInFlight) {
        saveQueuedAfterInFlight = true;
        return;
    }

    saveInFlight = true;
    setSaveStatus('saving');

    const data = gatherTableData();

    try {
        await postSave('api.php', data);
        setSaveStatus('saved');
    } catch (error) {
        console.error('Autosave failed:', error);

        setSaveStatus('error', {
            detail: error.message,
            retry: () => persistTable()
        });
    } finally {
        saveInFlight = false;

        if (saveQueuedAfterInFlight) {
            saveQueuedAfterInFlight = false;
            persistTable();
        }
    }
}

const debouncedPersistTable = debounce(persistTable, 600);

async function saveStructureToDB() {
    if (
        typeof currentUserRole === 'undefined' || currentUserRole !== 'admin'
    ) {
        return;
    }

    setSaveStatus('saving');

    const struct = {
        collections: [],
        expenditures: []
    };

    document.querySelectorAll('#collectionsBody tr').forEach(tr => {
        const depthDiv = tr.querySelector('td div[class*="depth-"]');
        if (!depthDiv) return;

        const depthMatch = depthDiv.className.match(/depth-(\d+)/);
        const depth = depthMatch ? parseInt(depthMatch[1]) : 0;
        const parent = tr.getAttribute('data-parent') || undefined;

        if (tr.classList.contains('tree-grid-row')) {
            const clone = depthDiv.cloneNode(true);

            const button = clone.querySelector('button');
            if (button) button.remove();

            const icon = clone.querySelector('i');
            if (icon) icon.remove();

            struct.collections.push({
                type: 'toggle',
                name: clone.innerText.trim(),
                id: tr.dataset.id,
                parent,
                depth
            });
        } else if (tr.classList.contains('data-row')) {
            const clone = depthDiv.cloneNode(true);
            const icon = clone.querySelector('i');

            if (icon) icon.remove();

            struct.collections.push({
                type: 'in',
                name: clone.innerText.trim(),
                parent,
                depth
            });
        }
    });

    document.querySelectorAll('#expendituresBody tr').forEach(tr => {
        const depthDiv = tr.querySelector('td div[class*="depth-"]');
        if (!depthDiv) return;

        const depthMatch = depthDiv.className.match(/depth-(\d+)/);
        const depth = depthMatch ? parseInt(depthMatch[1]) : 0;
        const parent = tr.getAttribute('data-parent') || undefined;

        if (tr.classList.contains('tree-grid-row')) {
            const clone = depthDiv.cloneNode(true);

            const button = clone.querySelector('button');
            if (button) button.remove();

            const icon = clone.querySelector('i');
            if (icon) icon.remove();

            struct.expenditures.push({
                type: 'toggle',
                name: clone.innerText.trim(),
                id: tr.dataset.id,
                parent,
                depth
            });
        } else if (tr.classList.contains('data-row')) {
            const clone = depthDiv.cloneNode(true);
            const icon = clone.querySelector('i');

            if (icon) icon.remove();

            struct.expenditures.push({
                type: 'out',
                name: clone.innerText.trim(),
                parent,
                depth
            });
        }
    });

    const renderedExpenses = [...document.querySelectorAll('#expendituresBody tr')];
    struct.expenditures.forEach((node, index) => {
        node.start_date = renderedExpenses[index]?.dataset.startDate || '';
        node.end_date = renderedExpenses[index]?.dataset.endDate || '';
    });

    try {
        await postSave('api.php', {
            action: 'save_structure',
            data: struct
        });

        expendituresStructure = struct.expenditures;
        decorateExpenditureItems();
        setSaveStatus('saved', 'Layout saved');
    } catch (error) {
        console.error('Structure save failed:', error);

        setSaveStatus('error', {
            detail: error.message,
            retry: saveStructureToDB
        });
    }
}

function enableClickToEdit(element) {
    if (
        typeof currentUserRole === 'undefined' || currentUserRole !== 'admin'
    ) {
        return;
    }

    if (element.querySelector('input')) return;

    const clone = element.cloneNode(true);
    const icon = clone.querySelector('i');

    if (icon) icon.remove();

    const originalText = clone.innerText.trim();
    const input = document.createElement('input');

    input.type = 'text';
    input.className =
        'form-control form-control-sm border-primary fw-bold text-strong shadow-sm';
    input.value = originalText;

    element.innerHTML = '';
    element.appendChild(input);
    input.focus();

    const saveEdit = () => {
        const newText = input.value.trim() || originalText;

        element.innerHTML =
            `${newText} <i class="bi bi-pencil text-muted small ms-1 opacity-50 no-print"></i>`;

        const tr = element.closest('tr');

        if (tr) {
            tr.dataset.name = newText
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '-');

            sortDataRows(
                tr.getAttribute('data-parent'),
                tr.closest('tbody')
            );
        }

        updateAll();
        saveStructureToDB();
    };

    input.addEventListener('blur', saveEdit);

    input.addEventListener('keypress', event => {
        if (event.key === 'Enter') saveEdit();
    });
}

let pendingParentRow = null;
let promptModalInstance = null;

function addNewItem(parentRow) {
    if (
        typeof currentUserRole === 'undefined' ||
        currentUserRole !== 'admin'
    ) {
        return;
    }

    pendingParentRow = parentRow;

    const modalEl = document.getElementById('customPromptModal');

    if (!promptModalInstance && modalEl) {
        promptModalInstance = new bootstrap.Modal(modalEl);
    }

    if (!modalEl) {
        Swal.fire({
            title: 'Enter new item name:',
            input: 'text',
            showCancelButton: true,
            confirmButtonColor: 'var(--gold-main)',
            cancelButtonColor: 'var(--navy-sub)'
        }).then(result => {
            if (result.isConfirmed && result.value) {
                processNewItem(result.value);
            }
        });

        return;
    }

    const isCollection =
        parentRow.closest('tbody').id === 'collectionsBody';

    document.getElementById('promptModalTitle').innerText =
        isCollection
            ? 'Add Collection Item'
            : 'Add Expenditure Item';

    const input = document.getElementById('promptModalInput');
    input.value = '';

    promptModalInstance.show();

    modalEl.addEventListener(
        'shown.bs.modal',
        () => input.focus(),
        { once: true }
    );
}

document.getElementById('promptModalConfirm')?.addEventListener(
    'click',
    function () {
        const itemName = document.getElementById(
            'promptModalInput'
        ).value.trim();

        if (!itemName) return;

        promptModalInstance.hide();
        processNewItem(itemName);
    }
);

function processNewItem(itemName) {
    if (getUserRole() !== 'admin') return;
    if (!pendingParentRow) return;

    const parentId = pendingParentRow.dataset.id;

    const parentDepthMatch = pendingParentRow
        .querySelector('td div[class*="depth-"]')
        .className.match(/depth-(\d+)/);

    const childDepth =
        (parentDepthMatch ? parseInt(parentDepthMatch[1]) : 0) + 1;

    const safeName = itemName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-');

    const canManage = (
        typeof currentUserRole !== 'undefined' &&
        currentUserRole === 'admin'
    );

    const manageDisplay = canManage ? '' : 'd-none';

    const newRowHTML = `
        <tr
            data-name="${safeName}"
            data-type="out"
            data-parent="${parentId}"
            class="data-row"
        >
            <td>
                <div class="d-flex align-items-center justify-content-between">
                    <div
                        class="depth-${childDepth}"
                        style="cursor: ${canManage ? 'pointer' : 'default'};"
                        ${canManage ? 'onclick="enableClickToEdit(this)"' : ''}
                        title="${canManage ? 'Click to rename' : ''}"
                    >${itemName} <i class="bi bi-pencil text-muted small ms-1 opacity-50 no-print ${manageDisplay}"></i></div>

                    <button
                        class="btn btn-sm text-theme-crimson p-0 ms-2 no-print ${manageDisplay}"
                        onclick="deleteItem(this.closest('tr'))"
                    >
                        <i class="bi bi-trash3-fill"></i>
                    </button>
                </div>
            </td>

            <td class="bg-transparent">
                <input
                    type="number"
                    class="form-control text-center fw-bold text-theme-gold bg-transparent border-0 val-budget"
                    value="0"
                    readonly
                    tabindex="-1"
                >
            </td>

            <td>
                <input
                    type="number"
                    class="form-control text-center text-theme-crimson fw-bold val-total"
                    value="0"
                >
            </td>

            <td class="bg-transparent">
                <input
                    type="number"
                    class="form-control text-center fw-bold text-strong bg-transparent border-0 val-balance"
                    value="0"
                    readonly
                    tabindex="-1"
                >
            </td>
        </tr>
    `;

    const toggleIcon = pendingParentRow.querySelector('.toggle-icon');

    if (
        toggleIcon &&
        toggleIcon.classList.contains('bi-caret-right-fill')
    ) {
        toggleTree(parentId, pendingParentRow);
    }

    pendingParentRow.insertAdjacentHTML('afterend', newRowHTML);

    sortDataRows(
        parentId,
        pendingParentRow.closest('tbody')
    );

    updateAll();
    saveStructureToDB();

    pendingParentRow = null;
    initDropdown();
}

function deleteItem(row) {
    if (
        typeof currentUserRole === 'undefined' ||
        currentUserRole !== 'admin'
    ) {
        return;
    }

    Swal.fire({
        title: 'Delete Item?',
        text: 'Permanently delete this item? This cannot be undone.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: 'var(--crimson)',
        cancelButtonColor: 'var(--navy-sub)',
        confirmButtonText: 'Yes, delete it!'
    }).then(async result => {
        if (result.isConfirmed) {
            const itemKey = (
                row.getAttribute('data-parent')
                    ? row.getAttribute('data-parent') + '-'
                    : ''
            ) + row.dataset.name;

            const type = row.dataset.type;

            try {
                const response = await fetch('api.php', {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        item_key: itemKey,
                        type
                    })
                });

                const data = await response.json();

                if (!response.ok || data.status !== 'success') {
                    throw new Error(
                        data.message || 'Unable to delete the record.'
                    );
                }

                row.remove();
                updateAll();

                await saveStructureToDB();

                initDropdown();

                Swal.fire(
                    'Deleted!',
                    'Item has been deleted.',
                    'success'
                );
            } catch (error) {
                Swal.fire(
                    'Delete failed',
                    error.message || 'Please try again.',
                    'error'
                );
            }
        }
    });
}

/* Admin category management: only parent fees are shared with other roles. */
let tempCategories = [];
let adminCategorySubcategories = {};

function categoryPriceCents(value) {
    const text = String(value ?? '').trim();
    if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(text)) {
        throw new Error('Enter non-negative prices with at most two decimal places.');
    }
    return Math.round(Number(text) * 100);
}
function categoryChildrenCents(children) {
    const total = children.reduce((sum, child) => sum + categoryPriceCents(child.price), 0);
    if (total > 999999999999) throw new Error('The category total is too large.');
    return total;
}
function renderAdminCategories() {
    const body = document.getElementById('adminCategoriesSummaryBody');
    if (!body) return;
    body.innerHTML = '';
    if (typeof currentUserRole === 'undefined' || currentUserRole !== 'admin') return;
    if (!collectionCategories.length) {
        body.innerHTML = '<tr><td colspan="2" class="text-center text-muted py-3">No categories configured.</td></tr>';
        return;
    }
    body.innerHTML = collectionCategories.map(cat => {
        const children = adminCategorySubcategories[cat.id] || [];
        const breakdown = children.length ? `<ul class="small text-muted mt-2 mb-0 ps-3">${children.map(child =>
            `<li>${escapeHtml(child.name)} — ₱ ${Number(child.price).toFixed(2)}</li>`).join('')}</ul>` : '';
        return `<tr><td class="ps-3 fw-bold text-main">${escapeHtml(cat.name)}${breakdown}</td>
            <td class="text-end pe-3 text-theme-gold fw-bold">₱ ${Number(cat.price).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</td></tr>`;
    }).join('');
}
function openManageCategoriesModal() {
    if (typeof currentUserRole === 'undefined' || currentUserRole !== 'admin') return;
    tempCategories = collectionCategories.map(cat => ({ ...cat,
        subcategories: JSON.parse(JSON.stringify(adminCategorySubcategories[cat.id] || []))
    }));
    renderCategoryModalRows();
    bootstrap.Modal.getOrCreateInstance(document.getElementById('manageCategoriesModal')).show();
}
function captureCategoryModalEdits() {
    const body = document.getElementById('manageCategoriesModalBody');
    body.querySelectorAll('.cat-name-input').forEach(input => {
        tempCategories[input.dataset.idx].name = input.value.trim();
    });
    body.querySelectorAll('.cat-price-input').forEach(input => {
        if (!tempCategories[input.dataset.idx].subcategories.length) tempCategories[input.dataset.idx].price = input.value;
    });
    body.querySelectorAll('[data-sub-field]').forEach(input => {
        tempCategories[input.dataset.idx].subcategories[input.dataset.child][input.dataset.subField] = input.value;
    });
}
function updateAdminCategoryTotal(index) {
    captureCategoryModalEdits();
    const cat = tempCategories[index];
    const field = document.querySelector(`#manageCategoriesModalBody .cat-price-input[data-idx="${index}"]`);
    const label = document.getElementById('adminCategoryTotal' + index);
    try {
        if (cat.subcategories.length) {
            cat.price = (categoryChildrenCents(cat.subcategories) / 100).toFixed(2);
            field.value = cat.price;
            label.textContent = 'Total: ₱ ' + cat.price;
        } else {
            label.textContent = 'Enter a fixed price above, or add subcategories.';
        }
    } catch (error) {
        label.textContent = error.message;
    }
}
function renderCategoryModalRows() {
    const body = document.getElementById('manageCategoriesModalBody');
    if (!body || typeof currentUserRole === 'undefined' || currentUserRole !== 'admin') return;
    body.innerHTML = tempCategories.map((cat, index) => {
        cat.subcategories = cat.subcategories || [];
        const children = cat.subcategories;
        let total = String(cat.price);
        if (children.length) {
            try { total = (categoryChildrenCents(children) / 100).toFixed(2); cat.price = total; } catch (_) {}
        }
        return `<tr>
            <td class="ps-3"><input type="text" class="form-control form-control-sm cat-name-input" data-idx="${index}"
                value="${escapeHtmlAttr(cat.name)}" placeholder="Category Name" maxlength="200" aria-label="Main category name"></td>
            <td><input type="number" class="form-control form-control-sm text-end cat-price-input" data-idx="${index}"
                value="${escapeHtmlAttr(total)}" min="0" step="0.01" aria-label="Main category price" ${children.length ? 'readonly title="Calculated from subcategory prices"' : ''}>
                ${children.length ? '<small class="text-muted">Sum of subcategories</small>' : ''}</td>
            <td class="text-center"><button type="button" class="btn btn-sm text-theme-crimson p-0" onclick="removeCategoryModalRow(${index})" aria-label="Remove main category"><i class="bi bi-trash3-fill"></i></button></td>
        </tr>
        <tr><td colspan="3" class="px-3 pb-3"><div class="border rounded p-3">
            <div class="small fw-bold text-theme-gold mb-2">Admin-only subcategories</div>
            ${children.map((child, childIndex) => `<div class="d-flex align-items-center gap-2 mb-2">
                <input type="text" class="form-control form-control-sm" data-idx="${index}" data-child="${childIndex}" data-sub-field="name"
                    value="${escapeHtmlAttr(child.name)}" placeholder="Foods / Athlete" maxlength="200" aria-label="Subcategory name">
                <input type="number" class="form-control form-control-sm text-end" style="max-width:130px" data-idx="${index}" data-child="${childIndex}" data-sub-field="price"
                    value="${escapeHtmlAttr(child.price)}" min="0" step="0.01" placeholder="0.00" aria-label="Subcategory price" oninput="updateAdminCategoryTotal(${index})">
                <button type="button" class="btn btn-sm text-theme-crimson" onclick="removeAdminSubcategory(${index},${childIndex})" aria-label="Remove subcategory"><i class="bi bi-trash3-fill"></i></button>
            </div>`).join('')}
            <div class="d-flex flex-wrap align-items-center gap-3"><button type="button" class="btn btn-outline-gold btn-sm" onclick="addAdminSubcategory(${index})">+ Add Subcategory</button>
                <small class="text-muted" id="adminCategoryTotal${index}">${children.length ? 'Total: ₱ ' + escapeHtml(total) : 'Enter a fixed price above, or add subcategories.'}</small></div>
        </div></td></tr>`;
    }).join('');
}
function addCategoryModalRow() {
    captureCategoryModalEdits();
    tempCategories.push({id:'cat_' + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '_' + Math.random().toString(36).slice(2)), name:'New Category', price:0, subcategories:[]});
    renderCategoryModalRows();
}
function removeCategoryModalRow(index) {
    if (tempCategories.length <= 1) return Swal.fire('Action Denied', 'You must have at least one collection category.', 'warning');
    captureCategoryModalEdits();
    tempCategories.splice(index, 1);
    renderCategoryModalRows();
}
function addAdminSubcategory(index) {
    captureCategoryModalEdits();
    if (tempCategories[index].subcategories.length >= 50) return Swal.fire('Limit reached', 'Use at most 50 subcategories per category.', 'warning');
    tempCategories[index].subcategories.push({name:'', price:'0.00'});
    renderCategoryModalRows();
}
function removeAdminSubcategory(index, childIndex) {
    captureCategoryModalEdits();
    tempCategories[index].subcategories.splice(childIndex, 1);
    // Removing the final child returns the category to a directly editable zero price.
    if (!tempCategories[index].subcategories.length) tempCategories[index].price = '0.00';
    renderCategoryModalRows();
}
async function saveCategoriesFromModal() {
    if (typeof currentUserRole === 'undefined' || currentUserRole !== 'admin') return;
    const button = document.getElementById('btn-save-col-modal');
    if (button?.disabled) return;
    let proposedCategories, proposedSubcategories;
    try {
        captureCategoryModalEdits();
        proposedSubcategories = {};
        proposedCategories = tempCategories.map(cat => {
            if (!cat.name.trim()) throw new Error('Enter a name for every main category.');
            const children = cat.subcategories.map(child => {
                const name = child.name.trim();
                if (!name) throw new Error('Enter a name for every subcategory.');
                return {name, price:(categoryPriceCents(child.price) / 100).toFixed(2)};
            });
            const cents = children.length ? categoryChildrenCents(children) : categoryPriceCents(cat.price);
            proposedSubcategories[cat.id] = children;
            return {id:cat.id, name:cat.name.trim(), price:(cents / 100).toFixed(2)};
        });
    } catch (error) {
        return Swal.fire('Check categories', error.message, 'warning');
    }
    const modal = document.getElementById('manageCategoriesModal');
    const controls = [...modal.querySelectorAll('input,button')].map(element => [element,element.disabled]);
    controls.forEach(([element]) => {element.disabled = true;});
    if (button) button.textContent = 'Saving...';
    try {
        await postSave('api.php', [{type:'col_settings',data:proposedCategories,admin_subcategories:proposedSubcategories}]);
        collectionCategories = proposedCategories;
        adminCategorySubcategories = proposedSubcategories;
        renderAdminCategories();
        renderUI();
        updateAll();
        bootstrap.Modal.getInstance(modal)?.hide();
        Swal.fire({toast:true,position:'top-end',icon:'success',title:'Categories and subcategories saved',showConfirmButton:false,timer:1500});
    } catch (error) {
        Swal.fire('Unable to save categories', error.message, 'error');
    } finally {
        controls.forEach(([element,disabled]) => {element.disabled = disabled;});
        if (button) button.innerHTML = '<i class="bi bi-floppy-fill me-1"></i>Save Categories';
    }
}

/* Admin structure management */

function openManageStructureModal() {
    if (
        typeof currentUserRole === 'undefined' ||
        currentUserRole !== 'admin'
    ) {
        return;
    }

    renderStructureModalBody();

    new bootstrap.Modal(
        document.getElementById('manageStructureModal')
    ).show();
}

function renderStructureModalBody() {
    const body = document.getElementById('manageStructureModalBody');

    if (!body) return;

    body.innerHTML = '';

    if (collectionsStructure.length === 0) {
        body.innerHTML =
            '<tr><td class="text-center text-muted py-4">No programs or sections configured.</td></tr>';
        return;
    }

    collectionsStructure.forEach((item, index) => {
        const padding = item.depth * 25 + 15;
        const isDept = item.type === 'toggle';

        let actionButtons = `
            <button
                class="btn btn-sm btn-outline-gold me-2"
                onclick="structRenameItem(${index})"
                title="Rename"
            >
                <i class="bi bi-pencil-fill"></i>
            </button>
        `;

        if (isDept) {
            actionButtons += `
                <button
                    class="btn btn-sm btn-outline-gold me-2"
                    onclick="structAddSection('${item.id}')"
                    title="Add Section"
                >
                    <i class="bi bi-plus-circle-fill"></i>
                </button>
            `;
        }

        actionButtons += `
            <button
                class="btn btn-sm btn-outline-crimson"
                onclick="structDeleteItem(${index})"
                title="Delete"
            >
                <i class="bi bi-trash3-fill"></i>
            </button>
        `;

        body.innerHTML += `
            <tr>
                <td style="padding-left: ${padding}px;">
                    <div class="fw-bold ${
                        isDept ? 'text-theme-gold' : 'text-main'
                    }">
                        ${
                            isDept
                                ? '<i class="bi bi-building me-2"></i>'
                                : '<i class="bi bi-people me-2 text-muted"></i>'
                        }
                        ${escapeHtml(systemProgramLabel(item.name))}
                    </div>
                </td>
                <td class="text-end pe-3" style="width: 160px;">
                    ${actionButtons}
                </td>
            </tr>
        `;
    });
}

async function structAddDepartment() {
    const { value: deptName } = await Swal.fire({
        title: 'New Program Name',
        input: 'text',
        showCancelButton: true,
        confirmButtonColor: 'var(--gold-main)',
        cancelButtonColor: 'var(--navy-sub)',
        inputValidator: value =>
            !value.trim() ? 'Name is required' : undefined,
        didOpen: () => {
            const input = Swal.getInput();
            if (input) input.focus();
        }
    });

    if (!deptName) return;

    const deptId = 'dept-' + Date.now();

    collectionsStructure.push({
        type: 'toggle',
        name: deptName.trim(),
        id: deptId,
        depth: 0
    });

    collectionsStructure.push({
        type: 'toggle',
        name: '1st Year Sections',
        id: deptId + '-1',
        parent: deptId,
        depth: 1
    });

    collectionsStructure.push({
        type: 'toggle',
        name: '2nd Year Sections',
        id: deptId + '-2',
        parent: deptId,
        depth: 1
    });

    collectionsStructure.push({
        type: 'toggle',
        name: '3rd Year Sections',
        id: deptId + '-3',
        parent: deptId,
        depth: 1
    });

    collectionsStructure.push({
        type: 'toggle',
        name: '4th Year Sections',
        id: deptId + '-4',
        parent: deptId,
        depth: 1
    });

    finishStructUpdate();
}

async function structAddSection(parentId) {
    const parentRow = collectionsStructure.find(
        item => item.id === parentId
    );

    if (!parentRow) return;

    const { value: sectionName } = await Swal.fire({
        title: 'New Section Name',
        input: 'text',
        showCancelButton: true,
        confirmButtonColor: 'var(--gold-main)',
        cancelButtonColor: 'var(--navy-sub)',
        inputValidator: value =>
            !value.trim() ? 'Name is required' : undefined,
        didOpen: () => {
            const input = Swal.getInput();
            if (input) input.focus();
        }
    });

    if (!sectionName) return;

    const childDepth = parentRow.depth + 1;
    let insertIdx = collectionsStructure.indexOf(parentRow) + 1;

    while (insertIdx < collectionsStructure.length) {
        const nextItem = collectionsStructure[insertIdx];

        if (nextItem.depth <= parentRow.depth) break;

        insertIdx++;
    }

    collectionsStructure.splice(insertIdx, 0, {
        type: 'in',
        name: sectionName.trim(),
        parent: parentId,
        depth: childDepth
    });

    finishStructUpdate();
}

async function structRenameItem(index) {
    const target = collectionsStructure[index];

    if (!target) return;

    const { value: newName } = await Swal.fire({
        title: 'Rename',
        input: 'text',
        inputValue: systemProgramLabel(target.name),
        showCancelButton: true,
        confirmButtonColor: 'var(--gold-main)',
        cancelButtonColor: 'var(--navy-sub)',
        inputValidator: value =>
            !value.trim() ? 'Name is required' : undefined,
        didOpen: () => {
            const input = Swal.getInput();

            if (input) {
                input.focus();
                input.select();
            }
        }
    });

    if (!newName) return;

    target.name = newName.trim();
    finishStructUpdate();
}

async function structDeleteItem(index) {
    const target = collectionsStructure[index];

    if (!target) return;

    const isDept = target.type === 'toggle';

    const result = await Swal.fire({
        title: 'Delete this item?',
        text: isDept
            ? 'This will permanently remove the program and ALL its sections.'
            : 'This will permanently remove the section.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: 'var(--crimson)',
        cancelButtonColor: 'var(--navy-sub)',
        confirmButtonText: 'Yes, delete it!'
    });

    if (!result.isConfirmed) return;

    if (isDept) {
        const targetId = target.id;

        const childIds = collectionsStructure
            .filter(item => item.parent === targetId)
            .map(item => item.id);

        collectionsStructure = collectionsStructure.filter(item => {
            if (item.id === targetId) return false;
            if (item.parent === targetId) return false;
            if (childIds.includes(item.parent)) return false;
            return true;
        });
    } else {
        collectionsStructure.splice(index, 1);
    }

    finishStructUpdate();
}

function finishStructUpdate() {
    renderStructureModalBody();
    renderUI();
    updateAll();
    saveStructureToDB();
    initDropdown();
}

async function saveStudentCounts() {
    const button = document.getElementById('btn-save-students');

    if (button) {
        button.innerHTML = 'Saving...';
        button.disabled = true;
    }

    const data = [];

    document.querySelectorAll('.admin-student-input').forEach(input => {
        data.push({
            type: 'student_counts',
            name: input.getAttribute('data-key'),
            count: parseInt(input.value) || 0
        });
    });

    try {
        await postSave('api.php', data);

        document.querySelectorAll('.admin-student-input').forEach(input => {
            studentCounts[input.dataset.key] =
                parseInt(input.value, 10) || 0;
        });

        updateAll();

        if (button) {
            button.innerHTML =
                '<i class="bi bi-check-circle-fill me-2"></i>Saved!';
        }
    } catch (error) {
        console.error('Enrollment save failed:', error);

        if (button) {
            button.innerHTML = 'Error Saving';
        }

        Swal.fire(
            'Enrollment save failed',
            error.message,
            'error'
        );
    } finally {
        setTimeout(() => {
            if (button) {
                button.innerHTML =
                    '<i class="bi bi-floppy-fill me-2"></i>Save Enrollments';
                button.disabled = false;
            }
        }, 1200);
    }
}

async function saveAdminBudgets() {
    if (getUserRole() !== 'admin') return;
    const button = document.getElementById('btn-save-budgets');
    const overall = document.getElementById('overallExpenditureBudget');
    if (!button || button.disabled || !overall) return;
    const inputs = [overall, ...document.querySelectorAll('#expendituresBody .admin-budget-input')];
    for (const input of inputs) {
        if (input.value.trim() === '' || !input.reportValidity()) {
            if (input.value.trim() === '') input.reportValidity();
            return;
        }
    }
    const data = [{type: 'overall_budget', amount: Number(overall.value).toFixed(2)}];
    inputs.slice(1).forEach(input => {
        data.push({name: input.dataset.key, type: 'budget', budget: Number(input.value).toFixed(2)});
    });
    button.disabled = true;
    button.innerText = 'Saving...';
    inputs.forEach(input => { input.disabled = true; });
    try {
        await postSave('api.php', data);
        button.innerHTML = '<i class="bi bi-check-circle-fill me-2"></i>Saved!';
        updateAll();
    } catch (error) {
        button.innerText = 'Error Saving';
        Swal.fire('Budget save failed', error.message, 'error');
    } finally {
        inputs.forEach(input => { input.disabled = false; });
        setTimeout(() => {
            button.innerHTML = '<i class="bi bi-floppy-fill me-2"></i>Save Budgets';
            button.disabled = false;
        }, 1200);
    }
}

window.toggleTree = function (rowId, rowElement) {
    const icon = rowElement?.querySelector('.toggle-icon');

    if (!icon) return;

    const expanded = rowElement.classList.toggle('is-expanded');

    icon.classList.toggle('bi-caret-down-fill', expanded);
    icon.classList.toggle('bi-caret-right-fill', !expanded);

    rowElement.setAttribute('aria-expanded', String(expanded));

    syncTreeVisibility(rowElement.closest('tbody'));
};

function saveHistory() {
    const state = getTableState();

    if (
        historyStack.length === 0 ||
        historyStack[historyStack.length - 1] !== state
    ) {
        historyStack.push(state);

        if (historyStack.length > 50) {
            historyStack.shift();
        }
    }
}

function getTableState() {
    const data = [];

    document.querySelectorAll('tr.data-row').forEach(tr => {
        data.push(
            [...tr.querySelectorAll('input[type=number]')]
                .map(input => input.value)
        );
    });

    return JSON.stringify(data);
}

function setTableState(state) {
    if (!state) return;

    const data = JSON.parse(state);

    document.querySelectorAll('tr.data-row').forEach((tr, index) => {
        if (!data[index]) return;
        const role = getUserRole();
        if ((tr.dataset.type === 'in' && role !== 'treasurer') ||
            (tr.dataset.type === 'out' && role !== 'admin')) return;

        tr.querySelectorAll('input[type=number]').forEach(
            (input, inputIndex) => {
                if (data[index][inputIndex] !== undefined) {
                    input.value = data[index][inputIndex];
                }
            }
        );
    });

    updateAll();
}

function undo() {
    if (historyStack.length < 2) return;

    redoStack.push(historyStack.pop());

    setTableState(historyStack[historyStack.length - 1]);
}

async function clearTable(type) {
    if (
        !['in', 'out'].includes(type) ||
        getUserRole() !== (type === 'out' ? 'admin' : 'treasurer') ||
        clearTableInProgress
    ) {
        return;
    }

    const result = await Swal.fire({
        title: 'Clear Table?',
        text: type === 'in'
            ? 'Clear all saved collection amounts? Existing daily remittances will stay in history as cleared records and will not count in the new balance.'
            : 'Clear all saved expenditure amounts? Allocated budgets will be kept.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: 'var(--crimson)',
        cancelButtonColor: 'var(--navy-sub)',
        confirmButtonText: 'Yes, clear it!'
    });

    if (!result.isConfirmed || clearTableInProgress) return;

    clearTableInProgress = true;
    setSaveStatus('saving');

    try {
        while (saveInFlight) {
            await new Promise(resolve => setTimeout(resolve, 25));
        }

        saveQueuedAfterInFlight = false;

        await postSave('api.php', {
            action: 'clear_financial_table',
            type,
            csrf: sectionRemittanceCsrf
        });

        historyStack = [];
        redoStack = [];

        await Swal.fire(
            'Cleared!',
            'The cleared amounts have been saved. The page will now reload.',
            'success'
        );

        location.reload();
    } catch (error) {
        await Swal.fire(
            'Clear failed',
            error.message ||
                'Could not save the cleared table. Refreshing saved values.',
            'error'
        );

        location.reload();
    }
}

function switchView(view) {
    const role = getUserRole();

    if (!VIEWS_BY_ROLE[role].includes(view)) {
        view = getDefaultView();
    }

    document.querySelectorAll('.main-content > div').forEach(element => {
        element.classList.add('d-none');
    });

    document.querySelectorAll('.sidebar .nav-link').forEach(link => {
        link.classList.remove('active');
    });

    stopChatThreadPolling();
    stopChatListPolling();
    rememberView(view);

    if (view === 'database-health' || view === 'settings') {
        const health = view === 'database-health';
        document.getElementById(health ? 'databaseHealthView' : 'settingsView')?.classList.remove('d-none');
        document.getElementById(health ? 'nav-database-health' : 'nav-settings')?.classList.add('active');
        const frame = document.getElementById(health ? 'databaseHealthFrame' : 'settingsFrame');
        if (frame && !frame.getAttribute('src')) frame.src = (health ? 'health.php' : 'settings.php') + '?embedded=1';
        else if (frame) requestAnimationFrame(() => connectWorkspacePage(frame));
    } else if (view === 'recovered-years') {
        document.getElementById('recoveredYearsView')?.classList.remove('d-none');
        document.getElementById('nav-recovered-years')?.classList.add('active');
        const frame = document.getElementById('recoveredYearsFrame');
        if (frame && !frame.getAttribute('src')) {
            const url = new URL('recovered_year.php', location.href);
            url.searchParams.set('embedded', '1');
            const year = new URLSearchParams(location.search).get('year');
            if (year && /^\d{4}-\d{4}$/.test(year)) url.searchParams.set('year', year);
            frame.src = url.href;
        }
    } else if (view === 'collections') {
        document.getElementById('collectionsView')
            ?.classList.remove('d-none');

        document.getElementById('nav-collections')
            ?.classList.add('active');
    } else if (view === 'expenditures') {
        document.getElementById('expendituresView')
            ?.classList.remove('d-none');

        document.getElementById('nav-expenditures')
            ?.classList.add('active');
    } else if (view === 'reporting') {
        document.getElementById('reportingView')
            ?.classList.remove('d-none');

        document.getElementById('nav-reporting')
            ?.classList.add('active');

        setTimeout(updateAll, 50);
    } else if (view === 'audit-register') {
        document.getElementById('auditRegisterView')
            ?.classList.remove('d-none');

        document.getElementById('nav-audit-register')
            ?.classList.add('active');
    } else if (view === 'messages') {
        document.getElementById('messagesView')
            ?.classList.remove('d-none');

        document.getElementById('nav-messages')
            ?.classList.add('active');

        loadConversations();
        startChatListPolling();
    } else if (view === 'admin-panel') {
        document.getElementById('adminPanelView')
            ?.classList.remove('d-none');

        document.getElementById('nav-admin')
            ?.classList.add('active');
    } else if (view === 'archives') {
        document.getElementById('archivesView')
            ?.classList.remove('d-none');

        document.getElementById('nav-archives')
            ?.classList.add('active');

        fetchArchiveYears();
    } else if (view === 'add-doc') {
        document.getElementById('addDocumentView')
            ?.classList.remove('d-none');

        document.getElementById('nav-add-doc')
            ?.classList.add('active');

        renderArchive();
    }
}

function enforceRoles() {
    const role = getUserRole();
    document.querySelectorAll('#expendituresView .val-total, #expendituresView .val-budget').forEach(input => {
        input.readOnly = role !== 'admin';
        input.classList.toggle('opacity-75', role !== 'admin');
    });
    document.querySelectorAll('#expendituresView .action-buttons').forEach(element => {
        element.classList.toggle('d-none', role !== 'admin');
    });
    const isAuditor = (
        typeof currentUserRole !== 'undefined' &&
        currentUserRole === 'auditor'
    );

    if (isAuditor) {
        document.querySelectorAll(
            '#collectionsView .val-dynamic, ' +
            '#collectionsView .remark-input, ' +
            '#expendituresView .val-total'
        ).forEach(input => {
            input.setAttribute('readonly', true);
            input.classList.add('opacity-75');
        });

        document.querySelectorAll('.action-buttons').forEach(element => {
            element.classList.add('d-none');
        });
    }

    const navCollections = document.getElementById('nav-collections');

    if (navCollections) {
        const navItem =
            navCollections.closest('.nav-item') || navCollections;

        navItem.classList.toggle('d-none', role !== 'treasurer');
    }

    const navExpenditures = document.getElementById('nav-expenditures');

    if (navExpenditures) {
        const navItem =
            navExpenditures.closest('.nav-item') || navExpenditures;

        navItem.classList.toggle('d-none', role !== 'admin');
    }

    const navReporting = document.getElementById('nav-reporting');

    if (navReporting) {
        const navItem =
            navReporting.closest('.nav-item') || navReporting;

        navItem.classList.toggle('d-none', !isAuditor);
    }

    const canManageStructure = (
        typeof currentUserRole !== 'undefined' && currentUserRole === 'admin'
    );

    const manageExpButton = document.getElementById('manageExpBtn');

    if (manageExpButton) {
        manageExpButton.classList.toggle(
            'd-none',
            !canManageStructure
        );
    }
}

function confirmLogout() {
    Swal.fire({
        title: 'Log out?',
        text: 'Are you sure you want to end your session?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: 'var(--crimson)',
        cancelButtonColor: 'var(--navy-sub)',
        confirmButtonText: 'Log Out'
    }).then(result => {
        if (result.isConfirmed) {
            window.location.href = 'logout.php';
        }
    });
}

let collectionsChartInstance = null;
let expendituresChartInstance = null;
let myPieChart = null;

function updateDashboardVisuals(totalIn, totalOut, balance) {
    const receipts = document.getElementById('dash-receipts');
    const expenses = document.getElementById('dash-expenses');
    const balanceDisplay = document.getElementById('dash-balance');

    if (receipts) {
        receipts.innerText = `₱ ${totalIn.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
    }

    if (expenses) {
        expenses.innerText = `₱ ${totalOut.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
    }

    if (balanceDisplay) {
        balanceDisplay.innerText = `₱ ${balance.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
    }

    const reportView = document.getElementById('reportingView');

    if (reportView && !reportView.classList.contains('d-none')) {
        renderCollectionsChart();
        renderExpendituresChart();
        renderPieChart(totalOut, balance);

        renderAnomalyPanel();

    }
}

function renderAnomalyPanel() {
    const container = document.getElementById('anomalyListContainer');
    const badge = document.getElementById('anomalyCountBadge');

    if (!container) return;

    const anomalies = [];

    document.querySelectorAll(
        '#expendituresBody tr.data-row'
    ).forEach(tr => {
        const spent = parseAmount(
            tr.querySelector('.val-total')?.value
        );

        const budget = parseAmount(
            tr.querySelector('.val-budget')?.value
        );

        if (budget <= 0 || spent <= budget) return;

        const difference = spent - budget;
        const path = getTreeFullPath(expendituresStructure, tr);

        anomalies.push({
            severity: 'overbudget',
            label: 'OVER BUDGET',
            icon: 'bi-graph-up-arrow',
            path,
            desc: `Spent <strong>₱ ${formatAmount(spent)}</strong> of <strong>₱ ${formatAmount(budget)}</strong> budget · <strong>₱ ${formatAmount(difference)}</strong> over (${((difference / budget) * 100).toFixed(1)}%).`
        });
    });

    document.querySelectorAll(
        '#collectionsBody tr.data-row'
    ).forEach(tr => {
        const collected = parseAmount(
            tr.querySelector('.row-total')?.value
        );

        const balance = parseAmount(
            tr.querySelector('.row-col-balance')?.value
        );

        const target = collected + balance;

        if (target <= 0 || (collected / target) >= 0.70) return;

        const path = getTreeFullPath(collectionsStructure, tr);

        anomalies.push({
            severity: 'lowcollection',
            label: 'LOW COLLECTION',
            icon: 'bi-graph-down-arrow',
            path,
            desc: `Collected <strong>₱ ${formatAmount(collected)}</strong> of <strong>₱ ${formatAmount(target)}</strong> target · <strong>${((collected / target) * 100).toFixed(1)}%</strong> complete.`
        });
    });

    if (badge) {
        badge.textContent = anomalies.length;
        badge.className =
            'audit-count-badge' +
            (anomalies.length ? ' has-alerts' : '');
    }

    if (!anomalies.length) {
        container.innerHTML = `
            <div class="audit-empty">
                <i class="bi bi-check-circle"></i>
                <strong>No flagged discrepancies</strong>
                <span>
                    Budget and collection thresholds currently show no warnings.
                </span>
            </div>
        `;
        return;
    }

    container.innerHTML = anomalies.map(item => `
        <div class="audit-alert audit-alert--${item.severity}">
            <span class="audit-alert__icon">
                <i class="bi ${item.icon}"></i>
            </span>

            <div class="audit-alert__content">
                <div class="audit-alert__tag">${item.label}</div>
                <div class="audit-alert__path">${escapeHtml(item.path)}</div>
                <div class="audit-alert__description">${item.desc}</div>
            </div>
        </div>
    `).join('');
}

function renderCollectionsChart() {
    const filter = document.getElementById(
        'collectionChartFilter'
    )?.value || 'all';

    const labels = [];
    const data = [];

    if (filter === 'all') {
        document.querySelectorAll(
            '#collectionsBody tr.tree-grid-row'
        ).forEach(row => {
            const depthDiv = row.querySelector('td div');

            if (depthDiv && depthDiv.classList.contains('depth-0')) {
                const amount = parseAmount(
                    row.querySelector('.parent-sum-total').value
                ) || 0;

                if (amount > 0) {
                    labels.push(depthDiv.innerText.trim());
                    data.push(amount);
                }
            }
        });
    } else {
        document.querySelectorAll(
            `#collectionsBody tr.tree-grid-row[data-parent="${filter}"]`
        ).forEach(row => {
            const amount = parseAmount(
                row.querySelector('.parent-sum-total').value
            ) || 0;

            if (amount > 0) {
                labels.push(
                    row.querySelector('td div').innerText.trim()
                );
                data.push(amount);
            }
        });
    }

    const context = document.getElementById('collectionsChart');

    if (!context) return;

    if (collectionsChartInstance) {
        collectionsChartInstance.destroy();
    }

    collectionsChartInstance = new Chart(context, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Collections (₱)',
                data,
                backgroundColor: '#C2900F',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 600,
                easing: 'easeOutQuart'
            },
            scales: {
                x: {
                    ticks: { color: workspaceChartPalette().muted },
                    grid: { color: workspaceChartPalette().grid }
                },
                y: {
                    ticks: { color: workspaceChartPalette().muted },
                    grid: { color: workspaceChartPalette().grid }
                }
            },
            plugins: {
                legend: {
                    labels: { color: workspaceChartPalette().text }
                }
            }
        }
    });
}

function renderExpendituresChart() {
    const filter = document.getElementById(
        'expenditureChartFilter'
    )?.value || 'all';

    const labels = [];
    const data = [];

    if (filter === 'all') {
        document.querySelectorAll(
            '#expendituresBody tr.tree-grid-row'
        ).forEach(row => {
            const depthDiv = row.querySelector('td div');

            if (depthDiv && depthDiv.classList.contains('depth-0')) {
                const amount = parseAmount(
                    row.querySelector('.parent-sum-total').value
                ) || 0;

                if (amount > 0) {
                    labels.push(depthDiv.innerText.trim());
                    data.push(amount);
                }
            }
        });
    } else {
        document.querySelectorAll(
            `#expendituresBody tr.data-row[data-parent="${filter}"]`
        ).forEach(row => {
            const amount = parseAmount(
                row.querySelector('.val-total').value
            ) || 0;

            if (amount > 0) {
                labels.push(
                    row.querySelector('td div').innerText.trim()
                );
                data.push(amount);
            }
        });
    }

    const context = document.getElementById('expendituresChart');

    if (!context) return;

    if (expendituresChartInstance) {
        expendituresChartInstance.destroy();
    }

    expendituresChartInstance = new Chart(context, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Spent (₱)',
                data,
                backgroundColor: '#7C2A17',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 600,
                easing: 'easeOutQuart'
            },
            scales: {
                x: {
                    ticks: { color: workspaceChartPalette().muted },
                    grid: { color: workspaceChartPalette().grid }
                },
                y: {
                    ticks: { color: workspaceChartPalette().muted },
                    grid: { color: workspaceChartPalette().grid }
                }
            },
            plugins: {
                legend: {
                    labels: { color: workspaceChartPalette().text }
                }
            }
        }
    });
}

function renderPieChart(spent, remaining) {
    const context = document.getElementById('distributionPieChart');

    if (!context) return;

    if (myPieChart) {
        myPieChart.destroy();
    }

    myPieChart = new Chart(context, {
        type: 'doughnut',
        data: {
            labels: [
                'Total Spent',
                'Remaining Net Balance'
            ],
            datasets: [{
                data: [
                    spent,
                    remaining > 0 ? remaining : 0
                ],
                backgroundColor: [
                    '#7C2A17',
                    '#C2900F'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: workspaceChartPalette().text }
                }
            }
        }
    });
}

let breakdownSlideIndex = 0;
const BREAKDOWN_SLIDE_COUNT = 2;

function slideBreakdown(direction) {
    goToBreakdownSlide(breakdownSlideIndex + direction);
}

function goToBreakdownSlide(index) {
    breakdownSlideIndex = Math.min(
        BREAKDOWN_SLIDE_COUNT - 1,
        Math.max(0, index)
    );

    const track = document.getElementById('breakdownSliderTrack');

    if (track) {
        track.style.transform =
            `translateX(-${breakdownSlideIndex * (100 / BREAKDOWN_SLIDE_COUNT)}%)`;
    }

    const title = document.getElementById('breakdownSlideTitle');

    if (title) {
        title.innerHTML = breakdownSlideIndex === 0
            ? '<i class="bi bi-bar-chart-fill me-2"></i>Collections Breakdown'
            : '<i class="bi bi-bar-chart-fill me-2"></i>Expenditures Breakdown';
    }

    document.getElementById('collectionChartFilter')
        ?.classList.toggle('d-none', breakdownSlideIndex !== 0);

    document.getElementById('expenditureChartFilter')
        ?.classList.toggle('d-none', breakdownSlideIndex !== 1);

    document.getElementById('breakdownPrevBtn')
        ?.classList.toggle('disabled', breakdownSlideIndex === 0);

    document.getElementById('breakdownNextBtn')
        ?.classList.toggle(
            'disabled',
            breakdownSlideIndex === BREAKDOWN_SLIDE_COUNT - 1
        );

    document.getElementById('breakdownDot0')
        ?.classList.toggle('active', breakdownSlideIndex === 0);

    document.getElementById('breakdownDot1')
        ?.classList.toggle('active', breakdownSlideIndex === 1);

    setTimeout(() => {
        collectionsChartInstance?.resize();
        expendituresChartInstance?.resize();
    }, 380);
}

function renderCategoryPaymentRemarks(element, categories, isMixed, separator = ', ') {
    element.replaceChildren();
    element.classList.toggle('has-mixed-payments', isMixed);
    categories.forEach((category, index) => {
        if (index) element.appendChild(document.createTextNode(separator));
        const status = document.createElement('span');
        status.className = category.paid ? 'payment-remark-paid' : 'payment-remark-unpaid';
        status.textContent = category.text;
        element.appendChild(status);
    });
}

window.openRemarksModal = function (inputElement) {
    const modalElement = document.getElementById('remarksModal');

    if (!modalElement) return;

    const modalTitle = document.getElementById('remarksModalTitle');
    const modalContent = document.getElementById('remarksModalContent');
    const tr = inputElement.closest('tr');

    let sectionName = 'Details';

    if (tr) {
        const nameDiv = tr.querySelector('td div');

        if (nameDiv) {
            sectionName = nameDiv.innerText.trim();
        }
    }

    if (modalTitle) {
        modalTitle.innerText = sectionName + ' - Full Remarks';
    }

    if (modalContent) {
        const details = inputElement.value ||
            inputElement.title ||
            'No remarks available.';

        let categories = [];
        try { categories = JSON.parse(inputElement.dataset.categoryRemarks || '[]'); } catch (error) {}
        if (Array.isArray(categories) && categories.length) {
            renderCategoryPaymentRemarks(modalContent, categories, inputElement.dataset.mixedPayment === '1', '\n');
        } else {
            modalContent.classList.remove('has-mixed-payments');
            modalContent.textContent = details;
        }
    }

    new bootstrap.Modal(modalElement).show();
};

function generateReportContent(type, itemToken = null) {
    if (type === 'expenditures') return generateExpenditureItemReport(itemToken);
    let rows = '';

    const targetBody = type === 'collections'
        ? document.getElementById('collectionsBody')
        : document.getElementById('expendituresBody');

    if (!targetBody) return null;

    targetBody.querySelectorAll('tr').forEach(tr => {
        if (tr.classList.contains('tree-grid-row')) {
            const titleElement =
                tr.querySelector('td div') || tr.querySelector('td');

            if (!titleElement) return;

            const title = titleElement.innerText.trim();

            const paddingLeft = titleElement.className.includes('depth-0')
                ? '20px'
                : titleElement.className.includes('depth-1')
                    ? '40px'
                    : '10px';

            const total = parseAmount(
                tr.querySelector('.parent-sum-total')?.value
            ) || 0;

            if (type === 'expenditures') {
                rows += `
                    <tr style="font-weight:600;background-color:#eaf2fc;">
                        <td style="text-align:left;padding:6px 8px;padding-left:${paddingLeft};">
                            ${escapeHtml(title)}
                        </td>
                        <td colspan="1" style="text-align:right;color:#60728f;font-size:9px;padding-right:15px;">
                            Subtotal &rarr;
                        </td>
                        <td style="text-align:right;padding-right:12px;font-weight:bold;">
                            ${formatAmount(total)}
                        </td>
                    </tr>
                `;
            } else {
                let dynamicCells = '';

                collectionCategories.forEach(cat => {
                    const value = parseAmount(
                        cachedCollectionCategorySubtotals[cat.id]
                            ?.[tr.dataset.id] ?? 0
                    ) || 0;

                    dynamicCells += `
                        <td style="text-align:right;padding-right:12px;">
                            ${formatAmount(value)}
                        </td>
                    `;
                });

                const collectionBalance = parseAmount(
                    tr.querySelector('.parent-sum-balance-col')?.value
                ) || 0;

                rows += `
                    <tr style="font-weight:600;background-color:#eaf2fc;">
                        <td style="text-align:left;padding:6px 8px;padding-left:${paddingLeft};">
                            ${escapeHtml(title)}
                        </td>
                        ${dynamicCells}
                        <td style="text-align:right;padding-right:12px;font-weight:bold;">
                            ${formatAmount(total)}
                        </td>
                        <td style="text-align:right;padding-right:12px;color:#b23f59;font-weight:bold;">
                            ${formatAmount(collectionBalance)}
                        </td>
                    </tr>
                `;
            }
        } else if (tr.classList.contains('data-row')) {
            const nameDiv = tr.querySelector('td div');

            const name = nameDiv
                ? nameDiv.innerText.trim()
                : (tr.children[0] ? tr.children[0].innerText.trim() : '');

            let paddingLeft = '10px';

            if (nameDiv) {
                if (nameDiv.className.includes('depth-0')) {
                    paddingLeft = '20px';
                }
                if (nameDiv.className.includes('depth-1')) {
                    paddingLeft = '40px';
                }
                if (nameDiv.className.includes('depth-2')) {
                    paddingLeft = '60px';
                }
            }

            if (type === 'collections') {
                let dynamicCells = '';

                collectionCategories.forEach(cat => {
                    const cashValue = parseAmount(
                        tr.querySelector(
                            `.val-dynamic[data-cat="${cat.id}"]`
                        )?.value
                    ) || 0;

                    dynamicCells += `
                        <td style="text-align:right;padding-right:12px;">
                            ${formatAmount(cashValue)}
                        </td>
                    `;
                });

                const rowTotal = parseAmount(
                    tr.querySelector('.row-total')?.value
                ) || 0;

                const collectionBalance = parseAmount(
                    tr.querySelector('.row-col-balance')?.value
                ) || 0;

                rows += `
                    <tr>
                        <td style="text-align:left;padding:6px 8px;padding-left:${paddingLeft};">
                            ${escapeHtml(name)}
                        </td>
                        ${dynamicCells}
                        <td style="text-align:right;padding-right:12px;font-weight:bold;">
                            ${formatAmount(rowTotal)}
                        </td>
                        <td style="text-align:right;padding-right:12px;color:#b23f59;">
                            ${formatAmount(collectionBalance)}
                        </td>
                    </tr>
                `;
            } else if (type === 'expenditures') {
                const value = parseAmount(
                    tr.querySelector('.val-total')?.value
                ) || 0;

                rows += `
                    <tr>
                        <td style="text-align:left;padding:6px 8px;padding-left:${paddingLeft};">
                            ${escapeHtml(name)}
                        </td>
                        <td colspan="1" style="text-align:right;color:#60728f;font-size:9px;padding-right:15px;">
                            Amount &rarr;
                        </td>
                        <td style="text-align:right;padding-right:12px;font-weight:bold;">
                            ${formatAmount(value)}
                        </td>
                    </tr>
                `;
            }
        }
    });

    if (type === 'collections') {
        const grandTotal =
            document.getElementById('tot-receipts-table')?.innerText ||
            '0.00';

        const grandBalance =
            document.getElementById('tot-col-balance-table')?.innerText ||
            '0.00';

        rows += `
            <tr style="font-weight:bold;background-color:#dce9fa;font-size:11px;">
                <td colspan="${1 + collectionCategories.length}" style="text-align:right;padding:6px 15px 6px 8px;">
                    GRAND TOTAL COLLECTIONS:
                </td>
                <td style="text-align:right;padding-right:12px;font-size:12px;">
                    ${grandTotal}
                </td>
                <td style="text-align:right;padding-right:12px;color:#b23f59;font-size:12px;">
                    ${grandBalance}
                </td>
            </tr>
        `;
    } else if (type === 'expenditures') {
        const grandBudget =
            document.getElementById('tot-budget-table')?.innerText ||
            '0.00';

        const grandSpent =
            document.getElementById('tot-expenses-table')?.innerText ||
            '0.00';

        rows += `
            <tr style="font-weight:bold;background-color:#dce9fa;font-size:11px;">
                <td style="text-align:right;padding:6px 15px 6px 8px;">
                    GRAND TOTAL EXPENDITURES:
                </td>
                <td style="text-align:right;padding-right:12px;font-size:12px;">
                    ${grandBudget}
                </td>
                <td style="text-align:right;padding-right:12px;font-size:12px;">
                    ${grandSpent}
                </td>
            </tr>
        `;
    }

    if (getUserRole() !== 'auditor' && auditSignOffState[type]) {
        const signoff = auditSignOffState[type];

        rows += `
            <tr>
                <td colspan="100%" style="border:none;padding-top:15px;">
                    <div style="border:2px solid #245db2;padding:10px 15px;border-radius:6px;background-color:#f4f8ff;display:flex;align-items:center;justify-content:space-between;">
                        <div>
                            <div style="font-weight:bold;color:#245db2;font-size:11px;text-transform:uppercase;">
                                AUDITED &amp; VERIFIED FINANCIAL STATEMENT
                            </div>
                            <div style="font-size:10px;color:#213957;margin-top:2px;">
                                Certified Correct by:
                                <strong>${escapeHtml(signoff.auditor)}</strong>
                            </div>
                            <div style="font-size:9px;color:#60728f;">
                                Date &amp; Time: ${signoff.timestamp}
                            </div>
                        </div>
                        <div style="border:1.5px solid #245db2;padding:6px 12px;font-weight:bold;color:#245db2;font-size:10px;text-transform:uppercase;letter-spacing:1px;">
                            OFFICIAL AUDIT STAMP
                        </div>
                    </div>
                </td>
            </tr>
        `;
    }

    const currentDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const reportTitle = type === 'collections'
        ? 'STATEMENT OF RECEIPTS AND COLLECTIONS'
        : 'STATEMENT OF EXPENDITURES AND DISBURSEMENTS';

    let thead = '';

    if (type === 'collections') {
        let dynamicTH = '';
        const colWidth = 40 / (collectionCategories.length || 1);

        collectionCategories.forEach(cat => {
            dynamicTH += `
                <th style="width:${colWidth}%;">
                    ${escapeHtml(cat.name)}
                </th>
            `;
        });

        thead = `
            <tr>
                <th style="width:30%;">Section / Program</th>
                ${dynamicTH}
                <th style="width:12%;">Total Amount</th>
                <th style="width:18%;">Collectibles</th>
            </tr>
        `;
    } else {
        thead = `
            <tr>
                <th style="width:40%;">Item Description</th>
                <th style="width:30%;">Allocated Limit</th>
                <th style="width:30%;">Actual Cost</th>
            </tr>
        `;
    }

    return {
        rows,
        thead,
        reportTitle,
        currentDate
    };
}

function printReport(type, itemToken = null) {
    const content = generateReportContent(type, itemToken);

    if (!content) return;

    const { rows, thead, reportTitle, currentDate } = content;

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${reportTitle}</title>
            <style>
                @page {
                    size: A4 portrait;
                    margin: 12mm;
                }
                body {
                    font-family: Arial, sans-serif;
                    margin: 0;
                    color: #172c4d;
                    font-size: 10px;
                }
                .print-date {
                    text-align: right;
                    font-size: 10px;
                    margin-bottom: 22px;
                    font-weight: bold;
                }
                .header {
                    text-align: center;
                    margin-bottom: 24px;
                    line-height: 1.55;
                    padding-bottom: 15px;
                    border-bottom: 2px solid #285fae;
                }
                .header { position: relative; padding-left: 68px; padding-right: 68px; min-height: 60px; }
                .report-logo { position: absolute; top: 0; width: 68px; height: 68px; object-fit: contain; }
                .report-logo-nisu { left:max(4px, calc(50% - 240px)); }
                .report-logo-cics { right:max(4px, calc(50% - 240px)); }
                .header h3 {
                    margin: 0;
                    font-size: 15px;
                    font-weight: bold;
                    text-transform: uppercase;
                }
                .header p {
                    margin: 3px 0;
                    font-size: 10px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 20px;
                    font-variant-numeric: tabular-nums;
                }
                th, td {
                    border: 1px solid #cad8e9;
                    padding: 8px 9px;
                    line-height: 1.5;
                }
                td:not(:first-child) {
                    white-space: nowrap;
                }
                th {
                    font-weight: bold;
                    text-align: center;
                    background-color: #eaf2fc;
                    font-size: 9px;
                    text-transform: uppercase;
                }
                tbody tr {
                    break-inside: avoid;
                }
            </style>
        </head>
        <body>
            <div class="print-date">Date: ${currentDate}</div>
            <div class="header">
                <img class="report-logo report-logo-nisu" src="${escapeHtml(new URL('nisu_logo.png', window.location.href).href)}" alt="NISU">
                <img class="report-logo report-logo-cics" src="${escapeHtml(new URL('cics_logo.png', window.location.href).href)}" alt="CICS">
                <h3>NORTHERN ILOILO STATE UNIVERSITY</h3>
                <p>Estancia, Iloilo</p>
                <p>College of Information and Computing Studies</p>
                <p>FY 2026 ${reportTitle}</p>
                <p>STUDENT ORGANIZATION FUNDS</p>
                <p>OFFICE/PROGRAM: ICSSO</p>
            </div>
            <table>
                <thead>${thead}</thead>
                <tbody>${rows}</tbody>
            </table>
            ${type === 'expenditures' ? expenditureSignatoriesHtml() : ''}
        </body>
        <script>
            window.onload = function () {
                window.print();
            };
        <` + `/script>
        </html>
    `;

    const printWindow = window.open('', '_blank');

    if (printWindow) {
        printWindow.document.write(typeof window.applyWorkspaceBrandingToHtml === 'function' ? window.applyWorkspaceBrandingToHtml(html) : html);
        printWindow.document.close();
    }
}

let currentReportModalType = null;

function openReportModal(type) {
    const modalBody = document.getElementById('reportModalBody');
    const modalTitle = document.getElementById('reportModalTitle');

    if (!modalBody) return;

    currentReportModalType = type;

    const label = type === 'collections'
        ? 'Collections Report'
        : 'Expenditures Report';

    const icon = type === 'collections'
        ? 'bi-box-arrow-in-right'
        : 'bi-graph-down-arrow';

    if (modalTitle) {
        modalTitle.innerHTML = `<i class="bi ${icon} me-2"></i>${label}`;
    }

    const content = generateReportContent(type);

    if (!content) {
        modalBody.innerHTML =
            '<p class="text-center text-muted py-4 mb-0">No data available.</p>';
    } else {
        const { rows, thead, reportTitle, currentDate } = content;

        modalBody.innerHTML = `
            <div class="print-date">Date: ${currentDate}</div>
            <div class="header">
                <img class="report-logo report-logo-nisu" src="${escapeHtml(new URL('nisu_logo.png', window.location.href).href)}" alt="NISU">
                <img class="report-logo report-logo-cics" src="${escapeHtml(new URL('cics_logo.png', window.location.href).href)}" alt="CICS">
                <h3>NORTHERN ILOILO STATE UNIVERSITY</h3>
                <p>Estancia, Iloilo</p>
                <p>College of Information and Computing Studies</p>
                <p>FY 2026 ${reportTitle}</p>
                <p>STUDENT ORGANIZATION FUNDS</p>
                <p>OFFICE/PROGRAM: ICSSO</p>
            </div>
            <table>
                <thead>${thead}</thead>
                <tbody>${rows}</tbody>
            </table>
            ${type === 'expenditures' ? expenditureSignatoriesHtml() : ''}
        `;
    }

    const modalElement = document.getElementById('reportPreviewModal');

    if (!modalElement) return;

    bootstrap.Modal.getOrCreateInstance(modalElement).show();
}

function filterLogs() {
    const filterDate = document.getElementById('logDateFilter').value;
    let visibleCount = 0;

    document.querySelectorAll('.log-row').forEach(row => {
        if (!filterDate || row.getAttribute('data-date') === filterDate) {
            row.classList.remove('d-none');
            visibleCount++;
        } else {
            row.classList.add('d-none');
        }
    });

    const noLogsMessage = document.getElementById('noLogsMsg');

    if (noLogsMessage) {
        if (visibleCount === 0 && filterDate !== '') {
            noLogsMessage.classList.remove('d-none');
        } else {
            noLogsMessage.classList.add('d-none');
        }
    }
}

function clearLogFilter() {
    document.getElementById('logDateFilter').value = '';
    filterLogs();
}

async function loadDocuments() {
    if (getUserRole() !== 'auditor') return;
    try {
        const response = await fetch('upload.php', {cache: 'no-store', credentials: 'same-origin'});
        const data = await response.json();
        if (!response.ok || !Array.isArray(data)) throw new Error(data.message || 'Could not load documents.');
        documentArchive = data;
        initDropdown();
        renderArchive();
    } catch (error) {
        console.error('Could not refresh documents:', error);
    }
}

function docExtOf(doc) {
    return doc.extension || (
        doc.file_path
            ? doc.file_path.split('.').pop().toLowerCase()
            : ''
    );
}

function docTypeClass(extension) {
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) {
        return 'doc-type-img';
    }

    if (extension === 'pdf') return 'doc-type-pdf';

    if (['doc', 'docx'].includes(extension)) {
        return 'doc-type-doc';
    }

    return 'doc-type-other';
}

function docTypeIcon(extension) {
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) {
        return 'bi-file-earmark-image-fill';
    }

    if (extension === 'pdf') return 'bi-file-earmark-pdf-fill';

    if (['doc', 'docx'].includes(extension)) {
        return 'bi-file-earmark-word-fill';
    }

    return 'bi-file-earmark-text-fill';
}

let uploadDocModalInstance = null;

function openUploadDocModal() {
    if (getUserRole() !== 'auditor') {
        return Swal.fire(
            'Access Denied',
            'Receipt Documents are available only to the Auditor.',
            'error'
        );
    }

    const nameInput = document.getElementById('docName');

    if (nameInput) nameInput.value = '';

    clearDocFile();
    initDropdown();

    const categorySelect = document.getElementById('docCategory');

    if (categorySelect) categorySelect.selectedIndex = 0;

    const modalElement = document.getElementById('uploadDocModal');

    if (!modalElement) return;

    uploadDocModalInstance =
        bootstrap.Modal.getOrCreateInstance(modalElement);

    uploadDocModalInstance.show();
}

function handleDocFileChosen() {
    const fileInput = document.getElementById('docFile');
    const chip = document.getElementById('dzFileChip');
    const dropzone = document.getElementById('docDropzone');

    if (!fileInput || !fileInput.files.length) {
        clearDocFile();
        return;
    }

    const file = fileInput.files[0];
    const kilobytes = file.size / 1024;

    const sizeLabel = kilobytes > 1024
        ? (kilobytes / 1024).toFixed(1) + ' MB'
        : Math.round(kilobytes) + ' KB';

    const fileName = document.getElementById('dzFileName');
    const fileMeta = document.getElementById('dzFileMeta');

    if (fileName) fileName.innerText = file.name;
    if (fileMeta) fileMeta.innerText = sizeLabel;

    if (chip) chip.classList.remove('d-none');
    if (dropzone) dropzone.classList.add('d-none');
}

function clearDocFile(event) {
    if (event) event.stopPropagation();

    const fileInput = document.getElementById('docFile');

    if (fileInput) fileInput.value = '';

    const chip = document.getElementById('dzFileChip');
    const dropzone = document.getElementById('docDropzone');

    if (chip) chip.classList.add('d-none');
    if (dropzone) dropzone.classList.remove('d-none');
}

document.addEventListener('DOMContentLoaded', () => {
    const dropzone = document.getElementById('docDropzone');
    const fileInput = document.getElementById('docFile');

    if (dropzone && fileInput) {
        ['dragenter', 'dragover'].forEach(eventName => {
            dropzone.addEventListener(eventName, event => {
                event.preventDefault();
                dropzone.classList.add('dragover');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropzone.addEventListener(eventName, event => {
                event.preventDefault();
                dropzone.classList.remove('dragover');
            });
        });

        dropzone.addEventListener('drop', event => {
            if (event.dataTransfer && event.dataTransfer.files.length) {
                fileInput.files = event.dataTransfer.files;
                handleDocFileChosen();
            }
        });
    }
});

async function saveDocument() {
    if (getUserRole() !== 'auditor') {
        return Swal.fire(
            'Access Denied',
            'Receipt Documents are available only to the Auditor.',
            'error'
        );
    }

    const name = document.getElementById('docName')?.value;
    const category = document.getElementById('docCategory')?.value;
    const fileInput = document.getElementById('docFile');

    if (!fileInput) return;

    const file = fileInput.files[0];

    if (!name || !category || !file) {
        return Swal.fire(
            'Missing Information',
            'Please provide a reference name, select an item description, and choose a file to upload.',
            'warning'
        );
    }

    const formData = new FormData();

    formData.append('csrf', receiptDocumentsCsrf);
    formData.append('name', name);
    formData.append('category', category);
    formData.append('file', file);

    const button = document.querySelector(
        'button[onclick="saveDocument()"]'
    );

    if (button) {
        button.innerText = 'Uploading...';
        button.disabled = true;
    }

    try {
        const result = await (await fetch('upload.php', {
            method: 'POST',
            body: formData
        })).json();

        if (result.status === 'success') {
            document.getElementById('docName').value = '';
            clearDocFile();

            if (uploadDocModalInstance) {
                uploadDocModalInstance.hide();
            }

            loadDocuments();

            Swal.fire(
                'Uploaded!',
                'Your document has been securely archived.',
                'success'
            );
        } else {
            Swal.fire('Upload Failed', result.message, 'error');
        }
    } catch (error) {
        Swal.fire(
            'Upload Failed',
            'An unexpected error occurred during the upload process.',
            'error'
        );
    } finally {
        if (button) {
            button.innerText = 'Save to Archive';
            button.disabled = false;
        }
    }
}

let vaultViewMode = 'grid';

function setVaultView(mode) {
    vaultViewMode = mode;

    const gridButton = document.getElementById('vaultGridBtn');
    const listButton = document.getElementById('vaultListBtn');
    const grid = document.getElementById('vaultGrid');
    const list = document.getElementById('vaultListWrap');

    if (gridButton) {
        gridButton.classList.toggle('active', mode === 'grid');
    }

    if (listButton) {
        listButton.classList.toggle('active', mode === 'list');
    }

    if (grid) grid.classList.toggle('d-none', mode !== 'grid');
    if (list) list.classList.toggle('d-none', mode !== 'list');
}

const debouncedRenderArchive = debounce(renderArchive, 200);

function renderArchive() {
    const body = document.getElementById('archiveBody');
    const grid = document.getElementById('vaultGrid');
    const emptyState = document.getElementById('vaultEmptyState');

    if (!body && !grid) return;

    const searchTerm = (
        document.getElementById('vaultSearchInput')?.value || ''
    ).trim().toLowerCase();

    const categoryFilter =
        document.getElementById('vaultCategoryFilter')?.value || '';

    const canDelete = getUserRole() === 'auditor';

    const filtered = documentArchive.filter(doc => {
        const matchesSearch = !searchTerm ||
            (doc.name || '').toLowerCase().includes(searchTerm);

        const matchesCategory = !categoryFilter ||
            doc.category === categoryFilter;

        return matchesSearch && matchesCategory;
    });

    const totalElement = document.getElementById('vaultStatTotal');
    const categoriesElement = document.getElementById('vaultStatCategories');
    const latestElement = document.getElementById('vaultStatLatest');

    if (totalElement) {
        totalElement.innerText = documentArchive.length;
    }

    if (categoriesElement) {
        categoriesElement.innerText = new Set(
            documentArchive.map(doc => doc.category).filter(Boolean)
        ).size;
    }

    if (latestElement) {
        if (documentArchive.length) {
            const latest = documentArchive.reduce((a, b) =>
                new Date(a.upload_date) > new Date(b.upload_date) ? a : b
            );

            latestElement.innerText =
                new Date(latest.upload_date).toLocaleDateString(
                    undefined,
                    { month: 'short', day: 'numeric' }
                );
        } else {
            latestElement.innerText = '&mdash;';
        }
    }

    if (body) body.innerHTML = '';
    if (grid) grid.innerHTML = '';

    if (documentArchive.length === 0) {
        if (emptyState) {
            document.getElementById('vaultEmptyTitle').innerText =
                'No documents yet';

            document.getElementById('vaultEmptyText').innerText =
                'Upload your first receipt or memo to start the archive.';

            emptyState.classList.remove('d-none');
        }

        if (grid) grid.classList.add('d-none');

        document.getElementById('vaultListWrap')
            ?.classList.add('d-none');

        return;
    }

    if (filtered.length === 0) {
        if (emptyState) {
            document.getElementById('vaultEmptyTitle').innerText =
                'No matching documents';

            document.getElementById('vaultEmptyText').innerText =
                'Try a different search term or category.';

            emptyState.classList.remove('d-none');
        }

        if (grid) grid.classList.add('d-none');

        document.getElementById('vaultListWrap')
            ?.classList.add('d-none');

        return;
    }

    if (emptyState) emptyState.classList.add('d-none');

    setVaultView(vaultViewMode);

    filtered.forEach((doc, index) => {
        const extension = docExtOf(doc);
        const typeClass = docTypeClass(extension);
        const icon = docTypeIcon(extension);

        const dateLabel = new Date(doc.upload_date).toLocaleDateString(
            undefined,
            { year: 'numeric', month: 'short', day: 'numeric' }
        );

        const extensionLabel = extension
            ? extension.toUpperCase()
            : 'FILE';

        if (grid) {
            const card = document.createElement('div');

            card.className = 'doc-card';
            card.style.animationDelay =
                (Math.min(index, 12) * 0.03) + 's';

            card.onclick = () => viewFile(doc.id);

            card.innerHTML = `
                <div class="doc-card-top">
                    <div class="doc-medallion ${typeClass}">
                        <i class="bi ${icon}"></i>
                    </div>
                    <span class="doc-type-chip">${extensionLabel}</span>
                </div>

                <p class="doc-card-name" title="${escapeHtmlAttr(doc.name)}">
                    ${escapeHtmlAttr(doc.name)}
                </p>

                <p class="doc-card-date">
                    <i class="bi bi-calendar3 me-1"></i>${dateLabel}
                </p>

                <p class="doc-card-date">
                    <i class="bi bi-person-fill me-1"></i>${escapeHtmlAttr(doc.uploaded_by || 'Unknown')}
                </p>

                ${doc.category ? `
                    <span class="doc-card-cat" title="${escapeHtmlAttr(doc.category)}">
                        ${escapeHtmlAttr(doc.category)}
                    </span>
                ` : ''}

                <div class="doc-card-actions" onclick="event.stopPropagation();">
                    <button class="btn btn-sm btn-outline-gold" onclick="viewFile(${doc.id})">
                        <i class="bi bi-eye-fill me-1"></i>View
                    </button>

                    ${canDelete ? `
                        <button class="btn btn-sm btn-outline-crimson" onclick="deleteDoc(${doc.id})">
                            <i class="bi bi-trash3-fill"></i>
                        </button>
                    ` : ''}
                </div>
            `;

            grid.appendChild(card);
        }

        if (body) {
            const deleteButton = canDelete
                ? `<button class="btn btn-sm btn-outline-crimson ms-1" onclick="deleteDoc(${doc.id})" title="Delete"><i class="bi bi-trash3-fill"></i></button>`
                : '';

            const row = document.createElement('tr');

            row.innerHTML = `
                <td class="ps-3 text-muted">${dateLabel}</td>
                <td class="text-theme-gold fw-bold">${escapeHtmlAttr(doc.name)}</td>
                <td>
                    ${doc.category
                        ? `<span class="doc-card-cat">${escapeHtmlAttr(doc.category)}</span>`
                        : '<span class="text-muted small">&mdash;</span>'}
                </td>
                <td class="text-muted">${escapeHtmlAttr(doc.uploaded_by || 'Unknown')}</td>
                <td>
                    <span class="doc-type-chip">
                        <i class="bi ${icon}"></i>${extensionLabel}
                    </span>
                </td>
                <td class="text-end pe-3">
                    <button class="btn btn-sm btn-navy" onclick="viewFile(${doc.id})">
                        <i class="bi bi-eye-fill me-1"></i>View
                    </button>
                    ${deleteButton}
                </td>
            `;

            body.appendChild(row);
        }
    });
}

function escapeHtmlAttr(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

let currentPreviewDocId = null;

function viewFile(id) {
    const doc = documentArchive.find(item => item.id == id);

    if (!doc) return;

    currentPreviewDocId = id;

    const modalElement = document.getElementById('filePreviewModal');

    if (!modalElement) return;

    const modal = bootstrap.Modal.getOrCreateInstance(modalElement);

    const image = document.getElementById('previewImage');
    const pdf = document.getElementById('previewPDF');
    const download = document.getElementById('downloadPrompt');
    const link = document.getElementById('downloadLink');

    if (image) image.classList.add('d-none');
    if (pdf) pdf.classList.add('d-none');
    if (download) download.classList.add('d-none');

    const title = document.getElementById('previewTitle');
    if (title) title.innerText = doc.name;

    const extension = docExtOf(doc);

    const icon = document.getElementById('previewIcon');
    if (icon) icon.className = `bi ${docTypeIcon(extension)}`;

    const subtitle = document.getElementById('previewSubtitle');

    if (subtitle) {
        subtitle.innerText =
            (extension ? extension.toUpperCase() : 'FILE') +
            ' — uploaded ' +
            new Date(doc.upload_date).toLocaleDateString() +
            ' by ' +
            (doc.uploaded_by || 'Unknown');
    }

    const categoryBadge = document.getElementById('previewCategoryBadge');

    if (categoryBadge) {
        categoryBadge.innerText = doc.category || 'Uncategorized';
    }

    const dateLabel = document.getElementById('previewDateLabel');

    if (dateLabel) {
        dateLabel.innerText = new Date(
            doc.upload_date
        ).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    const downloadButton = document.getElementById('previewDownloadBtn');

    if (downloadButton) {
        downloadButton.href = doc.file_path;
        downloadButton.download = doc.name;
    }

    if (downloadButton && getUserRole() === 'auditor') {
        let auditLink = document.getElementById('previewAuditReceiptBtn');

        if (!auditLink) {
            auditLink = document.createElement('a');
            auditLink.id = 'previewAuditReceiptBtn';
            auditLink.className = 'btn btn-gold btn-sm';
            auditLink.textContent = 'Enter Audit Details';

            downloadButton.parentNode.insertBefore(
                auditLink,
                downloadButton
            );
        }

        auditLink.href = '#';

        auditLink.onclick = event => {
            event.preventDefault();

            bootstrap.Modal.getInstance(
                document.getElementById('filePreviewModal')
            )?.hide();

            switchView('audit-register');
        };
    }

    const deleteButton = document.getElementById('previewDeleteBtn');

    if (deleteButton) {
        deleteButton.classList.toggle(
            'd-none',
            getUserRole() !== 'auditor'
        );
    }

    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) {
        if (image) {
            image.src = doc.file_path;
            image.classList.remove('d-none');
        }
    } else if (extension === 'pdf') {
        if (pdf) {
            pdf.src = doc.file_path;
            pdf.classList.remove('d-none');
        }
    } else if (link && download) {
        link.href = doc.file_path;
        link.download = doc.name;
        download.classList.remove('d-none');
    }

    modal.show();
}

function deleteDocFromPreview() {
    if (currentPreviewDocId == null) return;

    const modalElement = document.getElementById('filePreviewModal');

    const modal = modalElement
        ? bootstrap.Modal.getInstance(modalElement)
        : null;

    if (modal) modal.hide();

    deleteDoc(currentPreviewDocId);
}

function deleteDoc(id) {
    if (getUserRole() !== 'auditor') return;

    return Swal.fire({
        title: 'Delete Document?',
        text: 'Are you sure you want to delete this document permanently? Linked audit rows will be kept, and checked rows will return to pending. This cannot be undone.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: 'var(--crimson)',
        cancelButtonColor: 'var(--navy-sub)',
        confirmButtonText: 'Yes, delete it!'
    }).then(async result => {
        if (result.isConfirmed) {
            try {
                const response = await fetch('upload.php', {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        id,
                        csrf: receiptDocumentsCsrf
                    })
                });

                const data = await response.json();

                if (!response.ok || data.status !== 'success') {
                    throw new Error(
                        data.message || 'Could not remove document.'
                    );
                }

                await loadDocuments();
                // Refresh the register's document links and edit tokens when there are no unsaved rows.
                if (typeof loadAuditRegister === 'function' && !receiptAudit.busy && !hasAuditDrafts()) {
                    await loadAuditRegister();
                }

                Swal.fire(
                    'Deleted!',
                    'The document has been removed. Any linked audit rows have been kept.',
                    'success'
                );
            } catch (error) {
                Swal.fire(
                    'Error',
                    error.message || 'Failed to delete the document.',
                    'error'
                );
            }
        }
    });
}

async function fetchArchiveYears() {
    if (
        typeof currentUserRole !== 'undefined' &&
        currentUserRole !== 'admin'
    ) {
        return;
    }

    try {
        const response = await fetch('api.php?action=get_archives');
        const data = await response.json();

        const select = document.getElementById('archiveYearSelect');

        if (select && data.years) {
            select.innerHTML =
                '<option value="">Select Academic Year...</option>';

            data.years.forEach(year => {
                if (year) {
                    select.innerHTML +=
                        `<option value="${year}">${year}</option>`;
                }
            });
        }
    } catch (error) {
        console.error('Failed to load archive years', error);
    }
}

let archivedCollectionsCache = [];
let currentArchiveYear = '';

function escapeHtml(value) {
    return String(value).replace(
        /[&<>"']/g,
        character => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[character])
    );
}

function formatPeso(amount) {
    return `₱ ${(parseAmount(amount) || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
}

function sumCollectionRow(item) {
    if (!item.category_data) return 0;

    try {
        const categories = JSON.parse(item.category_data);

        return Object.values(categories).reduce(
            (sum, value) => sum + (parseAmount(value) || 0),
            0
        );
    } catch (error) {
        return 0;
    }
}

async function fetchArchiveData() {
    const year = document.getElementById('archiveYearSelect').value;

    const collBody = document.getElementById('archiveCollectionsBody');
    const expBody = document.getElementById('archiveExpendituresBody');
    const budgetBody = document.getElementById('archiveBudgetsBody');
    const unpaidBody = document.getElementById('unpaidStudentsBody');
    const summaryWrap = document.getElementById('archiveYearSummary');

    if (!year) {
        collBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">Select a year to view records.</td></tr>';
        expBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">Select a year to view records.</td></tr>';

        if (budgetBody) {
            budgetBody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-4">Select a year to view records.</td></tr>';
        }

        if (unpaidBody) {
            unpaidBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Select a year to view records.</td></tr>';
        }

        if (summaryWrap) summaryWrap.classList.add('d-none');

        return;
    }

    collBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">Loading...</td></tr>';
    expBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">Loading...</td></tr>';

    if (budgetBody) {
        budgetBody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-4">Loading...</td></tr>';
    }

    if (unpaidBody) {
        unpaidBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Loading...</td></tr>';
    }

    fetchUnpaidStudents(year);

    try {
        const response = await fetch(
            `api.php?action=get_archives&year=${encodeURIComponent(year)}`
        );

        const data = await response.json();

        collBody.innerHTML = '';
        archivedCollectionsCache = data.collections || [];
        currentArchiveYear = year;

        if (data.collections.length === 0) {
            collBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No collections found for this year.</td></tr>';
        } else {
            data.collections.forEach(item => {
                let categoryDetails = '';

                if (item.category_data) {
                    try {
                        const categories = JSON.parse(item.category_data);

                        categoryDetails = Object.entries(categories)
                            .map(([key, value]) =>
                                `${escapeHtml(key)}: ₱ ${escapeHtml(value)}`
                            )
                            .join('<br>');
                    } catch (error) {
                        categoryDetails = escapeHtml(item.category_data);
                    }
                }

                if (
                    item.num_students !== null &&
                    item.num_students !== undefined
                ) {
                    categoryDetails += `
                        <br>
                        <span class="text-muted" style="font-size:0.72rem;">
                            (Students on record: ${escapeHtml(item.num_students)})
                        </span>
                    `;
                }

                collBody.innerHTML += `
                    <tr>
                        <td class="fw-bold ps-3 text-strong">
                            ${escapeHtml(systemProgramLabel(item.label || item.item_key))}
                        </td>
                        <td class="text-theme-gold">${categoryDetails}</td>
                        <td class="text-theme-crimson small">
                            ${escapeHtml(item.remarks || '')}
                        </td>
                        <td class="text-muted small">
                            ${new Date(item.updated_at).toLocaleDateString()}
                        </td>
                        <td class="no-print text-center">
                            <button class="btn btn-sm btn-outline-gold me-1" onclick="openRecordPaymentModal('${item.item_key}')" title="Record a late payment">
                                <i class="bi bi-cash-coin"></i>
                            </button>
                            <button class="btn btn-sm btn-navy" onclick="viewPaymentHistory('${item.item_key}')" title="View payment history">
                                <i class="bi bi-clock-history"></i>
                            </button>
                        </td>
                    </tr>
                `;
            });
        }

        expBody.innerHTML = '';

        if (data.expenditures.length === 0) {
            expBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">No expenditures found for this year.</td></tr>';
        } else {
            data.expenditures.forEach(item => {
                expBody.innerHTML += `
                    <tr>
                        <td class="fw-bold ps-3 text-strong">
                            ${escapeHtml(systemProgramLabel(item.label || item.item_key))}
                        </td>
                        <td class="text-theme-crimson fw-bold">
                            ${formatPeso(item.amount)}
                        </td>
                        <td class="small text-theme-gold">
                            ${escapeHtml(item.remarks || '')}
                        </td>
                        <td class="text-muted small">
                            ${new Date(item.updated_at).toLocaleDateString()}
                        </td>
                    </tr>
                `;
            });
        }

        const budgets = data.budgets || [];

        if (budgetBody) {
            budgetBody.innerHTML = '';

            if (budgets.length === 0) {
                budgetBody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-4">No budgets were allocated for this year.</td></tr>';
            } else {
                budgets.forEach(item => {
                    budgetBody.innerHTML += `
                        <tr>
                            <td class="fw-bold ps-3 text-strong">
                                ${escapeHtml(item.item_key)}
                            </td>
                            <td class="text-theme-gold fw-bold">
                                ${formatPeso(item.allocated_amount)}
                            </td>
                            <td class="text-muted small">
                                ${new Date(item.updated_at).toLocaleDateString()}
                            </td>
                        </tr>
                    `;
                });
            }
        }

        if (summaryWrap) {
            const totalCollected = archivedCollectionsCache.reduce(
                (sum, item) => sum + sumCollectionRow(item),
                0
            );

            const totalBudget = budgets.reduce(
                (sum, item) =>
                    sum + (parseAmount(item.allocated_amount) || 0),
                0
            );

            const totalSpent = (data.expenditures || []).reduce(
                (sum, item) => sum + (parseAmount(item.amount) || 0),
                0
            );

            document.getElementById('archYearTotalCollected').innerText =
                formatPeso(totalCollected);

            document.getElementById('archYearTotalBudget').innerText =
                formatPeso(totalBudget);

            document.getElementById('archYearTotalSpent').innerText =
                formatPeso(totalSpent);

            summaryWrap.classList.remove('d-none');
        }
    } catch (error) {
        console.error('Failed to fetch archive data', error);

        collBody.innerHTML = '<tr><td colspan="5" class="text-center text-theme-crimson py-4">Error loading data.</td></tr>';
        expBody.innerHTML = '<tr><td colspan="4" class="text-center text-theme-crimson py-4">Error loading data.</td></tr>';

        if (budgetBody) {
            budgetBody.innerHTML = '<tr><td colspan="3" class="text-center text-theme-crimson py-4">Error loading data.</td></tr>';
        }

        if (summaryWrap) summaryWrap.classList.add('d-none');
    }
}

function openFullArchiveRecords() {
    const year = document.getElementById('archiveYearSelect').value;

    if (!year) {
        Swal.fire({
            icon: 'info',
            title: 'Select a year first',
            text: 'Choose an academic year from the dropdown above, then try again.',
            confirmButtonColor: 'var(--gold-main)'
        });

        return;
    }

    const printWindow = window.open('', '_blank');

    if (!printWindow) {
        Swal.fire({
            icon: 'warning',
            title: 'Pop-up blocked',
            text: 'Please allow pop-ups for this site, then try again.',
            confirmButtonColor: 'var(--gold-main)'
        });

        return;
    }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head><title>Loading...</title></head>
        <body style="font-family:Arial,sans-serif;padding:60px;color:#746B58;">
            Loading full records for ${escapeHtml(year)}...
        </body>
        </html>
    `);

    printWindow.document.close();

    buildFullArchiveRecordsHtml(year).then(html => {
        printWindow.document.open();
        printWindow.document.write(typeof window.applyWorkspaceBrandingToHtml === 'function' ? window.applyWorkspaceBrandingToHtml(html) : html);
        printWindow.document.close();
    }).catch(error => {
        console.error('Failed to build full archive report', error);

        printWindow.document.open();

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head><title>Error</title></head>
            <body style="font-family:Arial,sans-serif;padding:60px;color:#A3341C;">
                Couldn't load the full records for ${escapeHtml(year)}.
                Please close this tab and try again.
            </body>
            </html>
        `);

        printWindow.document.close();
    });
}

async function buildFullArchiveRecordsHtml(year) {
    const [archiveResponse, unpaidResponse, paymentsResponse] =
        await Promise.all([
            fetch(`api.php?action=get_archives&year=${encodeURIComponent(year)}`),
            fetch(`unpaid_students.php?academic_year=${encodeURIComponent(year)}`),
            fetch(`late_payment.php?academic_year=${encodeURIComponent(year)}`)
        ]);

    const archiveData = await archiveResponse.json();
    const unpaidData = await unpaidResponse.json();
    const paymentsData = await paymentsResponse.json();

    const collections = archiveData.collections || [];
    const expenditures = archiveData.expenditures || [];
    const budgets = archiveData.budgets || [];
    const unpaidStudents = unpaidData.students || [];
    const payments = paymentsData.payments || [];

    const totalCollected = collections.reduce(
        (sum, item) => sum + sumCollectionRow(item),
        0
    );

    const totalBudget = budgets.reduce(
        (sum, item) => sum + (parseAmount(item.allocated_amount) || 0),
        0
    );

    const totalSpent = expenditures.reduce(
        (sum, item) => sum + (parseAmount(item.amount) || 0),
        0
    );

    const currentDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    let collectionRows =
        '<tr><td colspan="5" style="color:#746B58;">No collections recorded.</td></tr>';

    if (collections.length > 0) {
        collectionRows = collections.map(item => {
            let categoryDetails = '';

            if (item.category_data) {
                try {
                    const categories = JSON.parse(item.category_data);

                    categoryDetails = Object.entries(categories)
                        .map(([key, value]) =>
                            `${escapeHtml(key)}: ${formatPeso(value)}`
                        )
                        .join('<br>');
                } catch (error) {
                    categoryDetails = escapeHtml(item.category_data);
                }
            }

            const studentsNote = (
                item.num_students !== null &&
                item.num_students !== undefined
            )
                ? `<br><span style="font-size:9px;color:#746B58;">(Students on record: ${item.num_students})</span>`
                : '';

            return `
                <tr>
                    <td style="text-align:left;">
                        ${escapeHtml(systemProgramLabel(item.label || item.item_key))}
                    </td>
                    <td style="text-align:left;">
                        ${categoryDetails}${studentsNote}
                    </td>
                    <td style="font-weight:bold;">
                        ${formatPeso(sumCollectionRow(item))}
                    </td>
                    <td style="text-align:left;color:#A3341C;">
                        ${escapeHtml(item.remarks || '')}
                    </td>
                    <td>
                        ${item.updated_at ? new Date(item.updated_at).toLocaleDateString() : ''}
                    </td>
                </tr>
            `;
        }).join('');
    }

    let budgetRows =
        '<tr><td colspan="3" style="color:#746B58;">No budgets allocated.</td></tr>';

    if (budgets.length > 0) {
        budgetRows = budgets.map(item => `
            <tr>
                <td style="text-align:left;">
                    ${escapeHtml(item.item_key)}
                </td>
                <td style="font-weight:bold;">
                    ${formatPeso(item.allocated_amount)}
                </td>
                <td>
                    ${item.updated_at ? new Date(item.updated_at).toLocaleDateString() : ''}
                </td>
            </tr>
        `).join('');
    }

    let expenditureRows =
        '<tr><td colspan="4" style="color:#746B58;">No expenditures recorded.</td></tr>';

    if (expenditures.length > 0) {
        expenditureRows = expenditures.map(item => `
            <tr>
                <td style="text-align:left;">
                    ${escapeHtml(systemProgramLabel(item.label || item.item_key))}
                </td>
                <td style="font-weight:bold;">
                    ${formatPeso(item.amount)}
                </td>
                <td style="text-align:left;">
                    ${escapeHtml(item.remarks || '')}
                </td>
                <td>
                    ${item.updated_at ? new Date(item.updated_at).toLocaleDateString() : ''}
                </td>
            </tr>
        `).join('');
    }

    let unpaidRows =
        '<tr><td colspan="5" style="color:#746B58;">No unpaid students flagged.</td></tr>';

    if (unpaidStudents.length > 0) {
        unpaidRows = unpaidStudents.map(student => {
            const status = student.is_settled
                ? `Settled${
                    student.settled_at
                        ? ' (' + new Date(student.settled_at).toLocaleDateString() + ')'
                        : ''
                }`
                : 'Unsettled';

            return `
                <tr>
                    <td style="text-align:left;">
                        ${escapeHtml(student.student_name)}
                    </td>
                    <td style="text-align:left;">
                        ${escapeHtml(systemProgramLabel(student.section_label || student.item_key))}
                    </td>
                    <td style="text-align:left;">
                        ${escapeHtml(student.category_name || 'General')}
                    </td>
                    <td style="text-align:left;">
                        ${escapeHtml(student.remarks || '')}
                    </td>
                    <td>${status}</td>
                </tr>
            `;
        }).join('');
    }

    let paymentRows =
        '<tr><td colspan="5" style="color:#746B58;">No late payments recorded.</td></tr>';

    if (payments.length > 0) {
        paymentRows = payments.map(payment => `
            <tr>
                <td style="text-align:left;">
                    ${escapeHtml(payment.student_name)}
                </td>
                <td style="text-align:left;">
                    ${escapeHtml(systemProgramLabel(payment.section_label || payment.item_key))}
                </td>
                <td style="text-align:left;">
                    ${escapeHtml(payment.category_name || '')}
                </td>
                <td style="font-weight:bold;">
                    ${formatPeso(payment.amount)}
                </td>
                <td>
                    ${payment.created_at ? new Date(payment.created_at).toLocaleDateString() : ''}
                </td>
            </tr>
        `).join('');
    }

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Full Archive Records — ${escapeHtml(year)}</title>
            <style>
                @page {
                    size: A4 portrait;
                    margin: 0;
                }
                body {
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 15mm;
                    color: #000;
                    font-size: 10px;
                }
                .print-date {
                    text-align: right;
                    font-size: 10px;
                    margin-bottom: 15px;
                    font-weight: bold;
                }
                .header {
                    text-align: center;
                    margin-bottom: 20px;
                    line-height: 1.4;
                    padding-bottom: 12px;
                    border-bottom: 3px double #000;
                }

/* Header logos only; retain this document's existing print layout. */
.header{position:relative;padding-left:68px;padding-right:68px;min-height:60px}
.print-logo{position:absolute;top:0;width:68px;height:68px;object-fit:contain}
.print-logo-nisu{left:max(4px, calc(50% - 240px))}.print-logo-cics{right:max(4px, calc(50% - 240px))}
                .header h3 {
                    margin: 0;
                    font-size: 14px;
                    font-weight: bold;
                    text-transform: uppercase;
                }
                .header p {
                    margin: 2px 0;
                    font-size: 11px;
                }
                h4.section-title {
                    font-size: 11px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin: 22px 0 6px;
                    padding-bottom: 4px;
                    border-bottom: 1.5px solid #000;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 4px;
                }
                th, td {
                    border: 1px solid #000;
                    padding: 4px;
                    text-align: center;
                }
                th {
                    font-weight: bold;
                    background-color: #F5F0E1;
                    font-size: 9px;
                    text-transform: uppercase;
                }
                .summary-row {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 10px;
                }
                .summary-box {
                    flex: 1;
                    border: 1px solid #000;
                    padding: 8px;
                    text-align: center;
                }
                .summary-box .label {
                    font-size: 8px;
                    text-transform: uppercase;
                    color: #746B58;
                }
                .summary-box .value {
                    font-size: 13px;
                    font-weight: bold;
                    margin-top: 2px;
                }
                .print-btn {
                    position: fixed;
                    top: 10px;
                    right: 10px;
                    padding: 8px 14px;
                    background: #17130C;
                    color: #fff;
                    border: none;
                    border-radius: 6px;
                    font-weight: bold;
                    cursor: pointer;
                    font-size: 11px;
                }
                @media print {
                    .print-btn {
                        display: none;
                    }
                }
            </style>
        </head>
        <body>
            <button class="print-btn" onclick="window.print()">Print</button>

            <div class="print-date">Generated: ${currentDate}</div>

            <div class="header">
                <img class="print-logo print-logo-nisu" src="${escapeHtml(new URL('nisu_logo.png', window.location.href).href)}" alt="NISU">
                <img class="print-logo print-logo-cics" src="${escapeHtml(new URL('cics_logo.png', window.location.href).href)}" alt="CICS">
                <h3>NORTHERN ILOILO STATE UNIVERSITY</h3>
                <p>Estancia, Iloilo</p>
                <p>College of Information and Computing Studies</p>
                <p>FULL ARCHIVED RECORDS &mdash; ACADEMIC YEAR ${escapeHtml(year)}</p>
                <p>STUDENT ORGANIZATION FUNDS</p>
            </div>

            <div class="summary-row">
                <div class="summary-box">
                    <div class="label">Total Collected</div>
                    <div class="value">${formatPeso(totalCollected)}</div>
                </div>
                <div class="summary-box">
                    <div class="label">Total Budget Allocated</div>
                    <div class="value">${formatPeso(totalBudget)}</div>
                </div>
                <div class="summary-box">
                    <div class="label">Total Spent</div>
                    <div class="value">${formatPeso(totalSpent)}</div>
                </div>
            </div>

            <h4 class="section-title">Collections</h4>
            <table>
                <thead>
                    <tr>
                        <th style="width:22%;">Item / Section</th>
                        <th style="width:33%;">Category Breakdown</th>
                        <th style="width:13%;">Total</th>
                        <th style="width:22%;">Remarks</th>
                        <th style="width:10%;">Date Archived</th>
                    </tr>
                </thead>
                <tbody>${collectionRows}</tbody>
            </table>

            <h4 class="section-title">Budgets</h4>
            <table>
                <thead>
                    <tr>
                        <th style="width:50%;">Item Description</th>
                        <th style="width:30%;">Allocated Amount</th>
                        <th style="width:20%;">Date Archived</th>
                    </tr>
                </thead>
                <tbody>${budgetRows}</tbody>
            </table>

            <h4 class="section-title">Expenditures</h4>
            <table>
                <thead>
                    <tr>
                        <th style="width:30%;">Item Description</th>
                        <th style="width:20%;">Amount Spent</th>
                        <th style="width:30%;">Remarks</th>
                        <th style="width:20%;">Date Archived</th>
                    </tr>
                </thead>
                <tbody>${expenditureRows}</tbody>
            </table>

            <h4 class="section-title">Unpaid Students &mdash; Follow-up Roster</h4>
            <table>
                <thead>
                    <tr>
                        <th style="width:25%;">Student</th>
                        <th style="width:20%;">Section</th>
                        <th style="width:20%;">Unpaid For</th>
                        <th style="width:20%;">Notes</th>
                        <th style="width:15%;">Status</th>
                    </tr>
                </thead>
                <tbody>${unpaidRows}</tbody>
            </table>

            <h4 class="section-title">Late / Back Payments Recorded</h4>
            <table>
                <thead>
                    <tr>
                        <th style="width:25%;">Student</th>
                        <th style="width:20%;">Section</th>
                        <th style="width:20%;">Category</th>
                        <th style="width:15%;">Amount</th>
                        <th style="width:20%;">Date Recorded</th>
                    </tr>
                </thead>
                <tbody>${paymentRows}</tbody>
            </table>
        </body>
        </html>
    `;
}

function getCategoryListForArchivedRow(row) {
    if (row && row.category_snapshot) {
        try {
            const parsed = JSON.parse(row.category_snapshot);

            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
            }
        } catch (error) {}
    }

    return collectionCategories;
}

function openRecordPaymentModal(itemKey, prefill) {
    const row = archivedCollectionsCache.find(
        item => item.item_key === itemKey
    );

    if (!row) return;

    prefill = prefill || {};

    document.getElementById('rpItemKey').value = itemKey;
    document.getElementById('rpAcademicYear').value = currentArchiveYear;
    document.getElementById('rpSectionLabel').innerText = systemProgramLabel(row.label || itemKey);
    document.getElementById('rpYearLabel').innerText = currentArchiveYear;

    document.getElementById('rpStudentName').value =
        prefill.student_name || '';

    document.getElementById('rpAmount').value = 0;
    document.getElementById('rpNotes').value = '';

    document.getElementById('rpUnpaidStudentId').value =
        prefill.unpaid_student_id || '';

    const categories = getCategoryListForArchivedRow(row);
    const select = document.getElementById('rpCategorySelect');

    select.innerHTML =
        '<option value="" data-price="0">General / Other (no specific item)</option>';

    categories.forEach(category => {
        const price = parseAmount(category.price || 0);

        select.innerHTML += `
            <option
                value="${category.id}"
                data-price="${price}"
                data-name="${escapeHtmlAttr(category.name)}"
            >
                ${escapeHtml(category.name)} (₱ ${price.toFixed(2)})
            </option>
        `;
    });

    if (prefill.category_key) {
        select.value = prefill.category_key;
    }

    rpFillAmount();
    if (prefill.amount !== undefined && prefill.amount !== '') document.getElementById('rpAmount').value = prefill.amount;

    new bootstrap.Modal(
        document.getElementById('recordPaymentModal')
    ).show();
}

function rpFillAmount() {
    const select = document.getElementById('rpCategorySelect');
    const option = select.options[select.selectedIndex];

    document.getElementById('rpAmount').value = option
        ? (parseAmount(option.getAttribute('data-price')) || 0)
        : 0;
}

async function submitLatePayment() {
    const itemKey = document.getElementById('rpItemKey').value;
    const academicYear = document.getElementById('rpAcademicYear').value;
    const studentName = document.getElementById('rpStudentName').value.trim();

    const select = document.getElementById('rpCategorySelect');
    const option = select.options[select.selectedIndex];
    const categoryKey = select.value;

    const categoryName = option
        ? (option.getAttribute('data-name') || '')
        : '';

    const amount = parseAmount(
        document.getElementById('rpAmount').value
    ) || 0;

    const notes = document.getElementById('rpNotes').value.trim();

    const unpaidStudentId = parseInt(
        document.getElementById('rpUnpaidStudentId').value
    ) || 0;

    if (!studentName) {
        Swal.fire(
            'Missing Info',
            "Please enter the student's name.",
            'warning'
        );
        return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
        Swal.fire(
            'Invalid Amount',
            'Enter a payment amount greater than zero.',
            'warning'
        );
        return;
    }

    try {
        const response = await fetch('late_payment.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                academic_year: academicYear,
                item_key: itemKey,
                student_name: studentName,
                category_key: categoryKey,
                category_name: categoryName,
                amount,
                remarks: notes,
                unpaid_student_id: unpaidStudentId
            })
        });

        const data = await response.json();

        if (data.status === 'success') {
            bootstrap.Modal.getInstance(
                document.getElementById('recordPaymentModal')
            ).hide();

            Swal.fire(
                'Payment Recorded',
                data.message || 'Cleared for enrollment.',
                'success'
            );

            fetchArchiveData();
        } else {
            Swal.fire(
                'Error',
                data.message || 'Could not record payment.',
                'error'
            );
        }
    } catch (error) {
        Swal.fire('Error', 'An unexpected error occurred.', 'error');
    }
}

async function viewPaymentHistory(itemKey) {
    const row = archivedCollectionsCache.find(
        item => item.item_key === itemKey
    );

    document.getElementById('phSectionLabel').innerText =
        systemProgramLabel((row && row.label) || itemKey);

    const body = document.getElementById('paymentHistoryBody');

    body.innerHTML =
        '<tr><td colspan="5" class="text-center text-muted py-3">Loading...</td></tr>';

    new bootstrap.Modal(
        document.getElementById('paymentHistoryModal')
    ).show();

    try {
        const response = await fetch(
            `late_payment.php?academic_year=${encodeURIComponent(currentArchiveYear)}&item_key=${encodeURIComponent(itemKey)}`
        );

        const data = await response.json();

        renderPaymentHistory(body, data.payments || []);
    } catch (error) {
        body.innerHTML =
            '<tr><td colspan="5" class="text-center text-theme-crimson py-3">Failed to load history.</td></tr>';
    }
}

function renderPaymentHistory(body, payments) {
    if (payments.length === 0) {
        body.innerHTML =
            '<tr><td colspan="5" class="text-center text-muted py-3">No late payments recorded yet.</td></tr>';
        return;
    }

    body.innerHTML = payments.map(payment => `
        <tr>
            <td class="fw-bold">${escapeHtml(payment.student_name)}</td>
            <td>${escapeHtml(payment.category_name || 'General')}</td>
            <td>
                ₱ ${parseAmount(payment.amount).toLocaleString('en-US', {
                    minimumFractionDigits: 2
                })}
            </td>
            <td class="text-muted">
                ${new Date(payment.created_at).toLocaleDateString()}
            </td>
            <td class="no-print text-end">
                <button
                    class="btn btn-sm text-theme-crimson p-0"
                    onclick="reversePayment(${payment.id})"
                    title="Undo this entry"
                >
                    <i class="bi bi-trash3-fill"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

async function reversePayment(id) {
    const confirmResult = await Swal.fire({
        title: 'Undo this payment?',
        text: 'This removes the log entry and subtracts the amount back out of the archived total.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: 'var(--crimson)',
        cancelButtonColor: 'var(--navy-sub)',
        confirmButtonText: 'Yes, undo it'
    });

    if (!confirmResult.isConfirmed) return;

    try {
        const response = await fetch('late_payment.php', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ id })
        });

        const data = await response.json();

        if (data.status === 'success') {
            Swal.fire(
                'Undone',
                'The payment entry was removed.',
                'success'
            );

            const itemKeyLabel = document.getElementById(
                'phSectionLabel'
            ).innerText;

            viewPaymentHistory(itemKeyLabel);
            fetchArchiveData();
        } else {
            Swal.fire(
                'Error',
                data.message || 'Could not undo this entry.',
                'error'
            );
        }
    } catch (error) {
        Swal.fire('Error', 'An unexpected error occurred.', 'error');
    }
}

async function searchStudentClearance() {
    const term = document.getElementById(
        'clearanceSearchInput'
    ).value.trim();

    const wrap = document.getElementById('clearanceResultsWrap');
    const body = document.getElementById('clearanceResultsBody');

    if (!term) {
        wrap.style.display = 'none';
        return;
    }

    wrap.style.display = '';

    body.innerHTML =
        '<tr><td colspan="7" class="text-center text-muted py-3">Searching...</td></tr>';

    try {
        const [paymentResponse, unpaidResponse] = await Promise.all([
            fetch(`late_payment.php?student_name=${encodeURIComponent(term)}`),
            fetch(`unpaid_students.php?student_name=${encodeURIComponent(term)}`)
        ]);

        const paymentData = await paymentResponse.json();
        const unpaidData = await unpaidResponse.json();

        const payments = paymentData.payments || [];

        const outstanding = (unpaidData.students || []).filter(
            student => !student.is_settled
        );

        const rows = [];

        outstanding.forEach(student => {
            rows.push(`
                <tr>
                    <td class="fw-bold text-strong">
                        ${escapeHtml(student.student_name)}
                    </td>
                    <td>
                        <span class="badge bg-crimson">Unsettled</span>
                    </td>
                    <td>${escapeHtml(student.academic_year)}</td>
                    <td>
                        ${escapeHtml(systemProgramLabel(student.section_label || student.item_key))}
                    </td>
                    <td>
                        ${escapeHtml(student.category_name || 'General')}
                    </td>
                    <td>&mdash;</td>
                    <td class="text-muted">
                        ${new Date(student.created_at).toLocaleDateString()}
                    </td>
                </tr>
            `);
        });

        payments.forEach(payment => {
            rows.push(`
                <tr>
                    <td class="fw-bold text-strong">
                        ${escapeHtml(payment.student_name)}
                    </td>
                    <td>
                        <span class="badge bg-gold" style="color:#1A1408 !important;">
                            Paid
                        </span>
                    </td>
                    <td>${escapeHtml(payment.academic_year)}</td>
                    <td>
                        ${escapeHtml(systemProgramLabel(payment.section_label || payment.item_key))}
                    </td>
                    <td>
                        ${escapeHtml(payment.category_name || 'General')}
                    </td>
                    <td>
                        ₱ ${parseAmount(payment.amount).toLocaleString('en-US', {
                            minimumFractionDigits: 2
                        })}
                    </td>
                    <td class="text-muted">
                        ${new Date(payment.created_at).toLocaleDateString()}
                    </td>
                </tr>
            `);
        });

        body.innerHTML = rows.length > 0
            ? rows.join('')
            : '<tr><td colspan="7" class="text-center text-muted py-3">No matching records found.</td></tr>';
    } catch (error) {
        body.innerHTML =
            '<tr><td colspan="7" class="text-center text-theme-crimson py-3">Search failed.</td></tr>';
    }
}

async function fetchUnpaidStudents(year) {
    const body = document.getElementById('unpaidStudentsBody');

    if (!body) return;

    try {
        const response = await fetch(
            `unpaid_students.php?academic_year=${encodeURIComponent(year)}`
        );

        const data = await response.json();

        renderUnpaidStudentsTable(data.students || []);
    } catch (error) {
        body.innerHTML =
            '<tr><td colspan="10" class="text-center text-theme-crimson py-4">Failed to load the unpaid-student roster.</td></tr>';
    }
}

function renderUnpaidStudentsTable(students) {
    const body = document.getElementById('unpaidStudentsBody');

    if (!body) return;

    if (students.length === 0) {
        body.innerHTML =
            '<tr><td colspan="10" class="text-center text-muted py-4">No unpaid students flagged for this year.</td></tr>';
        return;
    }

    body.innerHTML = students.map(student => {
        const isSettled = Number(student.is_settled) === 1;
        const snapshotMoney = value => value === null || value === undefined ? '—' : '₱ ' + formatAmount(value);
        const statusBadge = isSettled
            ? `<span class="badge bg-gold" style="color:#1A1408 !important;">Settled ${student.settled_at ? new Date(student.settled_at).toLocaleDateString() : ''}</span>`
            : ((Number(student.amount_paid)+Number(student.late_paid||0))>0 ? '<span class="badge bg-warning text-dark">Partially paid</span>' : '<span class="badge bg-crimson">Unsettled</span>');

        const actionButtons = isSettled
            ? `
                <button
                    class="btn btn-sm text-theme-crimson p-0"
                    onclick="removeUnpaidEntry(${student.id})"
                    title="Remove from roster"
                >
                    <i class="bi bi-trash3-fill"></i>
                </button>
            `
            : `
                <button
                    type="button"
                    class="btn btn-sm btn-outline-gold me-1 mark-paid-btn"
                    data-id="${student.id}"
                    data-item-key="${escapeHtml(student.item_key)}"
                    data-student-name="${escapeHtml(student.student_name)}"
                    data-category-key="${escapeHtml(student.category_key || '')}"
                    data-current-due="${escapeHtmlAttr(student.current_due ?? '')}"
                    title="Record their payment"
                >
                    <i class="bi bi-cash-coin"></i>
                </button>

                <button
                    class="btn btn-sm text-theme-crimson p-0"
                    onclick="removeUnpaidEntry(${student.id})"
                    title="Remove from roster"
                >
                    <i class="bi bi-trash3-fill"></i>
                </button>
            `;

        return `
            <tr>
                <td class="fw-bold ps-3 ${
                    isSettled ? 'text-muted' : 'text-strong'
                }">
                    ${escapeHtml(student.student_name)}
                </td>
                <td>
                    ${escapeHtml(systemProgramLabel(student.section_label || student.item_key))}
                </td>
                <td>${escapeHtml(student.category_name || 'General')}</td>
                <td class="text-end">${snapshotMoney(student.fee_amount)}</td>
                <td class="text-end">${snapshotMoney(student.amount_paid)}</td>
                <td class="text-end">${snapshotMoney(student.balance_due)}</td>
                <td class="text-end fw-bold">${snapshotMoney(student.current_due)}</td>
                <td class="small text-muted">
                    ${escapeHtml(student.remarks || '')}
                </td>
                <td>${statusBadge}</td>
                <td class="no-print text-center">${actionButtons}</td>
            </tr>
        `;
    }).join('');

    body.querySelectorAll('.mark-paid-btn').forEach(button => {
        button.addEventListener('click', () => {
            markUnpaidAsPaid(
                parseInt(button.dataset.id),
                button.dataset.itemKey,
                button.dataset.studentName,
                button.dataset.categoryKey,
                button.dataset.currentDue
            );
        });
    });
}

async function removeUnpaidEntry(id) {
    const confirmResult = await Swal.fire({
        title: 'Remove this entry?',
        text: 'This only removes the follow-up flag — it does not affect any payment already recorded.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: 'var(--crimson)',
        cancelButtonColor: 'var(--navy-sub)',
        confirmButtonText: 'Yes, remove it'
    });

    if (!confirmResult.isConfirmed) return;

    try {
        const response = await fetch('unpaid_students.php', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ id })
        });

        const data = await response.json();

        if (data.status === 'success') {
            fetchUnpaidStudents(currentArchiveYear);
        } else {
            Swal.fire(
                'Error',
                data.message || 'Could not remove this entry.',
                'error'
            );
        }
    } catch (error) {
        Swal.fire('Error', 'An unexpected error occurred.', 'error');
    }
}

function markUnpaidAsPaid(
    unpaidId,
    itemKey,
    studentName,
    categoryKey,
    currentDue
) {
    openRecordPaymentModal(itemKey, {
        student_name: studentName,
        category_key: categoryKey,
        unpaid_student_id: unpaidId,
        amount: currentDue
    });
}

function openAddUnpaidToArchiveModal() {
    if (!currentArchiveYear) {
        Swal.fire(
            'Select a Year',
            'Choose an academic year above first.',
            'warning'
        );
        return;
    }

    document.getElementById('auYearLabel').innerText =
        currentArchiveYear;

    document.getElementById('auStudentName').value = '';
    document.getElementById('auNotes').value = '';

    const sectionSelect = document.getElementById('auSectionSelect');

    sectionSelect.innerHTML = archivedCollectionsCache.map(row => `
        <option value="${escapeHtmlAttr(row.item_key)}">${escapeHtml(systemProgramLabel(row.label || row.item_key))}</option>
    `).join('');

    sectionSelect.onchange = auRefreshCategoryOptions;

    auRefreshCategoryOptions();

    new bootstrap.Modal(
        document.getElementById('addUnpaidModal')
    ).show();
}

function auRefreshCategoryOptions() {
    const itemKey = document.getElementById('auSectionSelect').value;

    const row = archivedCollectionsCache.find(
        item => item.item_key === itemKey
    );

    const categories = getCategoryListForArchivedRow(row);
    const select = document.getElementById('auCategorySelect');

    select.innerHTML =
        '<option value="">General / All fees</option>' +
        categories.map(category => `
            <option
                value="${category.id}"
                data-name="${escapeHtmlAttr(category.name)}"
            >
                ${escapeHtml(category.name)}
            </option>
        `).join('');
}

async function submitAddUnpaidToArchive() {
    const studentName = document.getElementById(
        'auStudentName'
    ).value.trim();

    const itemKey = document.getElementById('auSectionSelect').value;

    const select = document.getElementById('auCategorySelect');
    const option = select.options[select.selectedIndex];
    const categoryKey = select.value;

    const categoryName = option
        ? (option.getAttribute('data-name') || '')
        : '';

    const notes = document.getElementById('auNotes').value.trim();

    if (!studentName || !itemKey) {
        Swal.fire(
            'Missing Info',
            "Please enter the student's name and pick a section.",
            'warning'
        );
        return;
    }

    try {
        const response = await fetch('unpaid_students.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                academic_year: currentArchiveYear,
                item_key: itemKey,
                student_name: studentName,
                category_key: categoryKey,
                category_name: categoryName,
                remarks: notes
            })
        });

        const data = await response.json();

        if (data.status === 'success') {
            bootstrap.Modal.getInstance(
                document.getElementById('addUnpaidModal')
            ).hide();

            fetchUnpaidStudents(currentArchiveYear);
        } else {
            Swal.fire(
                'Error',
                data.message || 'Could not add this student.',
                'error'
            );
        }
    } catch (error) {
        Swal.fire('Error', 'An unexpected error occurred.', 'error');
    }
}

function getFlatSectionList() {
    const list = [];

    collectionsStructure.forEach(row => {
        if (row.type !== 'in') return;

        const safe = row.name
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-');

        const itemKey = row.parent
            ? `${row.parent}-${safe}`
            : safe;

        const pathParts = [];
        let parentId = row.parent;

        while (parentId) {
            const parentRow = collectionsStructure.find(
                item => item.id === parentId
            );

            if (!parentRow) break;

            pathParts.unshift(parentRow.name);
            parentId = parentRow.parent;
        }

        pathParts.push(row.name);

        list.push({
            item_key: itemKey,
            label: pathParts.map(systemProgramLabel).join(' > ')
        });
    });

    return list;
}

const archiveRosterState = { ready: false, loading: false, revision: '', generation: 0, sections: [], categories: [] };

function archiveRosterSummary() {
    const rows = gatherUnpaidRows();
    const students = new Set(rows.map(row => JSON.stringify([row.item_key, row.student_name.trim().replace(/\s+/g,' ').toLocaleLowerCase('en-US')])));
    const sections = new Set(rows.map(row => row.item_key));
    document.getElementById('archiveRosterSummary').textContent = `${rows.length} fee ${rows.length === 1 ? 'entry' : 'entries'} · ${students.size} ${students.size === 1 ? 'student' : 'students'} · ${sections.size} ${sections.size === 1 ? 'section' : 'sections'}`;
    document.getElementById('archiveRosterContinue').disabled = !archiveRosterState.ready;
    document.getElementById('archiveRosterSkip').disabled = !archiveRosterState.ready || Boolean(document.querySelector('#flagUnpaidBody .unpaid-row'));
    document.getElementById('archiveRosterAdd').disabled = !archiveRosterState.ready;
    document.getElementById('archiveRosterReload').disabled = archiveRosterState.loading;
    const printButton = document.getElementById('archiveRosterPrint');
    if (printButton) printButton.disabled = !archiveRosterState.ready || archiveRosterState.loading || rows.length === 0;
    updateArchiveGroupSummaries();
    const body = document.getElementById('flagUnpaidBody');
    if (!body.querySelector('.unpaid-row') && !body.querySelector('.archive-roster-empty')) {
        body.innerHTML = '<tr class="archive-roster-empty"><td colspan="6" class="text-center py-4 text-muted">No students in this review. Add a student if a fee is still unpaid.</td></tr>';
    }
}

async function openFlagUnpaidModal(typedYear) {
    configureArchiveGroupedTable();
    window.__pendingArchiveYear = typedYear;
    document.getElementById('fuYearLabel').innerText = typedYear;
    bootstrap.Modal.getOrCreateInstance(document.getElementById('flagUnpaidModal')).show();
    await loadArchiveUnpaidLists();
}

async function reloadArchiveUnpaidLists() {
    if (archiveRosterState.loading) return;
    if (archiveRosterState.ready && document.querySelector('#flagUnpaidBody .unpaid-row')) {
        const result = await Swal.fire({title:'Reload saved lists?',text:'This replaces the current archive review with the latest saved Collections lists.',icon:'question',showCancelButton:true,confirmButtonText:'Reload lists'});
        if (!result.isConfirmed) return;
    }
    await loadArchiveUnpaidLists();
}

async function loadArchiveUnpaidLists() {
    const generation = ++archiveRosterState.generation;
    archiveRosterState.ready = false;
    archiveRosterState.loading = true;
    archiveRosterState.revision = '';
    const status = document.getElementById('archiveRosterStatus');
    status.textContent = 'Loading saved unpaid-student lists from Collections…';
    status.classList.remove('text-danger');
    document.getElementById('flagUnpaidBody').innerHTML = '';
    archiveRosterSummary();
    try {
        const response = await fetch('category_unpaid.php?action=archive_preview', {credentials:'same-origin',cache:'no-store'});
        const data = await response.json();
        if (generation !== archiveRosterState.generation) return;
        if (!response.ok || data.status !== 'success' || !Array.isArray(data.students) || !data.revision) throw new Error(data.message || 'Unable to load saved lists.');
        archiveRosterState.sections = data.sections || [];
        archiveRosterState.categories = data.categories || [];
        archiveRosterState.revision = data.revision;
        archiveRosterState.ready = true;
        document.getElementById('flagUnpaidBody').innerHTML = '';
        data.students.forEach(student => addUnpaidRow(student));
        status.textContent = data.students.length
            ? 'Saved names loaded. Review each fee entry before archiving. Changes here only affect this archive’s follow-up list.'
            : 'No saved unpaid names found. You can add students manually or continue without flags.';
    } catch (error) {
        if (generation !== archiveRosterState.generation) return;
        status.textContent = error.message + ' Select Reload Lists to retry. Archiving is paused until the lists can be checked.';
        status.classList.add('text-danger');
    } finally {
        if (generation === archiveRosterState.generation) {
            archiveRosterState.loading = false;
            if (archiveRosterState.ready) regroupArchiveStudentRows();
            archiveRosterSummary();
        }
    }
}

function addUnpaidRow(student = null) {
    if (!archiveRosterState.ready) return;
    const sections = archiveRosterState.sections;
    const categories = archiveRosterState.categories;
    const sectionOptions = sections.map(section => `<option value="${escapeHtmlAttr(section.item_key)}">${escapeHtml(systemProgramLabel(section.label))}</option>`).join('');
    const categoryOptions = categories.map(category => `<option value="${escapeHtmlAttr(String(category.id))}" data-name="${escapeHtmlAttr(category.name)}">${escapeHtml(category.name)}</option>`).join('');
    const tr = document.createElement('tr');
    tr.className = 'unpaid-row';
    tr.innerHTML = `
        <td><input type="text" maxlength="200" required class="form-control form-control-sm unpaid-name" placeholder="Student name" aria-label="Student name"><small class="archive-row-source">${student ? 'From Collections' : 'Added to this review'}</small></td>
        <td><select required class="form-select form-select-sm unpaid-section" aria-label="Section"><option value="">Choose section</option>${sectionOptions}</select></td>
        <td><select class="form-select form-select-sm unpaid-category" aria-label="Unpaid category"><option value="">General / All fees</option>${categoryOptions}</select></td>
        <td><input type="number" min="0" step="0.01" required class="form-control form-control-sm unpaid-fee" aria-label="Fee"></td>
        <td><input type="number" min="0" step="0.01" required class="form-control form-control-sm unpaid-paid" aria-label="Amount paid" placeholder="Confirm paid"></td>
        <td class="unpaid-due text-end fw-bold"></td>
        <td><input type="text" maxlength="500" class="form-control form-control-sm unpaid-notes" placeholder="Optional notes" aria-label="Notes"></td>
        <td class="text-center"><button type="button" class="btn btn-sm text-theme-crimson archive-remove-row" aria-label="Remove from this archive review" title="Remove from this archive review"><i class="bi bi-trash3-fill"></i></button></td>`;
    if (student) {
        tr.querySelector('.unpaid-name').value = student.student_name;
        tr.querySelector('.unpaid-section').value = student.item_key;
        tr.querySelector('.unpaid-category').value = student.category_key || '';
        tr.querySelector('.unpaid-notes').value = student.remarks || '';
        tr.querySelector('.unpaid-fee').value = student.fee_amount ?? '';
        tr.querySelector('.unpaid-paid').value = student.amount_paid ?? '';
    } else {
        tr.querySelector('.unpaid-paid').value = '0.00';
    }
    tr.querySelector('.archive-remove-row').addEventListener('click', () => { tr.remove(); regroupArchiveStudentRows(); archiveRosterSummary(); });
    tr.addEventListener('input', () => { updateArchiveStudentPayment(tr); archiveRosterSummary(); });
    tr.addEventListener('change', () => { updateArchiveStudentPayment(tr); archiveRosterSummary(); });
    updateArchiveStudentPayment(tr);
    document.querySelector('#flagUnpaidBody .archive-roster-empty')?.remove();
    document.getElementById('flagUnpaidBody').appendChild(tr);
    if (!archiveRosterState.loading) regroupArchiveStudentRows();
    archiveRosterSummary();
}

function updateArchiveStudentPayment(row) {
    const category = archiveRosterState.categories.find(cat => String(cat.id) === row.querySelector('.unpaid-category').value);
    const fee = row.querySelector('.unpaid-fee');
    const paid = row.querySelector('.unpaid-paid');
    fee.readOnly = Boolean(category);
    if (category) fee.value = Number(category.price || 0).toFixed(2);
    paid.max = fee.value || '9999999999.99';
    const known = fee.value.trim() !== '' && paid.value.trim() !== '';
    row.querySelector('.unpaid-due').textContent = known ? '₱ '+formatAmount(Math.max(0,Math.round(Number(fee.value)*100)-Math.round(Number(paid.value)*100))/100) : 'Confirm paid amount';
    const badge = document.createElement('small');
    badge.className = 'd-block mt-1 ' + (known && Number(paid.value)>0 ? 'text-warning' : 'text-theme-crimson');
    badge.textContent = !known ? 'Unconfirmed' : Number(paid.value)>Number(fee.value) ? 'Check paid amount' : Number(paid.value)===Number(fee.value) ? 'Fully Paid' : Number(paid.value)>0 ? 'Partially Paid' : 'Unpaid';
    row.querySelector('.unpaid-due').appendChild(badge);

}

function gatherUnpaidRows() {
    const rows = [];
    const seen = new Set();
    document.querySelectorAll('#flagUnpaidBody tr.unpaid-row').forEach(tr => {
        const name = tr.querySelector('.unpaid-name').value.trim();
        const itemKey = tr.querySelector('.unpaid-section').value;
        if (!name || !itemKey) return;
        const select = tr.querySelector('.unpaid-category');
        const fee=tr.querySelector('.unpaid-fee').value.trim();
        const paid=tr.querySelector('.unpaid-paid').value.trim();
        if(fee!=='' && paid!=='' && Number(fee)===Number(paid))return;
        const identity = JSON.stringify([itemKey,select.value,name.toLowerCase()]);
        if (seen.has(identity)) return;
        seen.add(identity);
        rows.push({item_key:itemKey,student_name:name,category_key:select.value,
            category_name:select.options[select.selectedIndex]?.getAttribute('data-name') || '',
            remarks:tr.querySelector('.unpaid-notes').value.trim(),fee_amount:fee,amount_paid:paid});
    });
    return rows;
}

function skipUnpaidFlagging() {
    if (!archiveRosterState.ready || document.querySelector('#flagUnpaidBody .unpaid-row')) return;
    bootstrap.Modal.getInstance(document.getElementById('flagUnpaidModal')).hide();
    confirmAndArchive([]);
}

function proceedToArchiveConfirm() {
    if (!archiveRosterState.ready) return;
    for (const field of document.querySelectorAll('#flagUnpaidBody input, #flagUnpaidBody select')) {
        if (!field.reportValidity()) return;
    }
    const unpaidList = gatherUnpaidRows();
    bootstrap.Modal.getInstance(document.getElementById('flagUnpaidModal')).hide();
    confirmAndArchive(unpaidList);
}

function confirmAndArchive(unpaidList) {
    const typedYear = window.__pendingArchiveYear;
    const rebootButton = document.getElementById('rebootSystemBtn');

    const countNote = unpaidList.length > 0
        ? `<br><br>Also flagging <b>${unpaidList.length}</b> unpaid fee entries for follow-up.`
        : '';

    Swal.fire({
        title: 'Are you absolutely sure?',
        html: `You are about to permanently archive the data for Academic Year "${escapeHtml(typedYear)}". This action cannot be undone.${countNote}`,
        icon: 'error',
        showCancelButton: true,
        confirmButtonColor: 'var(--crimson)',
        cancelButtonColor: 'var(--navy-sub)',
        confirmButtonText: 'Yes, Archive Data!'
    }).then(confirmResult => {
        if (!confirmResult.isConfirmed) return;

        if (rebootButton) {
            rebootButton.disabled = true;
            rebootButton.innerText = 'Archiving...';
        }

        Swal.fire({
            title: 'Archiving Data...',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        fetch('archive.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                academic_year: typedYear,
                unpaid_students: unpaidList,
                unpaid_roster_revision: archiveRosterState.revision
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                Swal.fire(
                    'Success!',
                    data.message,
                    'success'
                ).then(() => {
                    window.location.reload(true);
                });
            } else {
                Swal.fire('Error!', data.message, 'error');

                if (rebootButton) {
                    rebootButton.disabled = false;
                    rebootButton.innerHTML =
                        '<i class="bi bi-power me-2"></i>Reset Academic Year';
                }
            }
        })
        .catch(error => {
            console.error('Error during reboot:', error);

            Swal.fire(
                'Error!',
                'An unexpected error occurred.',
                'error'
            );

            if (rebootButton) {
                rebootButton.disabled = false;
                rebootButton.innerHTML =
                    '<i class="bi bi-power me-2"></i>Reset Academic Year';
            }
        });
    });
}

/* Messaging and notifications */

let chatConversations = [];
let activeConversationId = null;
let activeConversationMeta = null;
let lastLoadedMessageId = 0;
let pendingNewConversation = null;
let chatThreadPollTimer = null;
let chatListPollTimer = null;
let selectedNewConvoUserIds = new Set();
let allMessagableUsers = [];
let selectedAddMemberUserIds = new Set();

function initials(name) {
    if (!name) return '?';

    const parts = name.trim().split(/\s+/).filter(Boolean);

    if (parts.length === 0) return '?';

    if (parts.length === 1) {
        return parts[0].substring(0, 2).toUpperCase();
    }

    return (
        parts[0][0] +
        parts[parts.length - 1][0]
    ).toUpperCase();
}

function formatChatTimestamp(dateString) {
    const date = new Date(dateString.replace(' ', 'T'));

    if (isNaN(date.getTime())) return '';

    const now = new Date();
    const sameDay = date.toDateString() === now.toDateString();

    if (sameDay) {
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit'
        });
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
    }

    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
    });
}

async function loadConversations() {
    try {
        const response = await (
            await fetch('messages.php?action=conversations')
        ).json();

        if (response.status !== 'success') return;

        chatConversations = response.conversations;

        renderConversationList();
        updateMessagesNavBadge();
    } catch (error) {
        console.error('loadConversations failed', error);
    }
}

function updateMessagesNavBadge() {
    const totalUnread = chatConversations.reduce(
        (sum, conversation) =>
            sum + (conversation.unread_count || 0),
        0
    );

    const badge = document.getElementById('messagesNavBadge');

    if (!badge) return;

    if (totalUnread > 0) {
        badge.innerText = totalUnread > 99 ? '99+' : totalUnread;
        badge.classList.remove('d-none');
    } else {
        badge.classList.add('d-none');
    }
}

let chatListFilter = '';

function filterConversationList(value) {
    chatListFilter = (value || '').trim().toLowerCase();
    renderConversationList();
}

function renderConversationList() {
    const list = document.getElementById('chatConversationList');

    if (!list) return;

    if (chatConversations.length === 0) {
        list.innerHTML = '<p class="text-center text-muted small py-4 mb-0">No conversations yet.<br>Start one above.</p>';
        return;
    }

    const visible = chatListFilter
        ? chatConversations.filter(conversation =>
            (conversation.title || '').toLowerCase().includes(chatListFilter)
        )
        : chatConversations;

    if (visible.length === 0) {
        list.innerHTML = '<p class="text-center text-muted small py-4 mb-0">No conversations match "' + escapeHtml(chatListFilter) + '".</p>';
        return;
    }

    list.innerHTML = visible.map(conversation => {
        const isActive = conversation.id === activeConversationId;

        const preview = conversation.last_message
            ? escapeHtml(
                (conversation.last_message.is_mine ? 'You: ' : '') +
                conversation.last_message.body
            )
            : '<span class="fst-italic">No messages yet</span>';

        const time = conversation.last_message
            ? formatChatTimestamp(conversation.last_message.created_at)
            : '';

        const unreadBadge = conversation.unread_count > 0
            ? `<span class="badge rounded-pill bg-crimson chat-list-unread">${conversation.unread_count > 99 ? '99+' : conversation.unread_count}</span>`
            : '';

        const icon = conversation.is_group ? 'bi-people-fill' : null;

        return `
            <div class="chat-list-item ${isActive ? 'active' : ''}" onclick="openConversation(${conversation.id})">
                <div class="chat-avatar-circle">
                    ${icon ? `<i class="bi ${icon}"></i>` : escapeHtml(initials(conversation.title))}
                </div>

                <div class="chat-list-item-body">
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="chat-list-item-name">${escapeHtml(conversation.title)}</span>
                        <span class="chat-list-item-time">${time}</span>
                    </div>
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="chat-list-item-preview">${preview}</span>
                        ${unreadBadge}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function startChatListPolling() {
    stopChatListPolling();
    chatListPollTimer = setInterval(loadConversations, 10000);
}

function stopChatListPolling() {
    if (chatListPollTimer) {
        clearInterval(chatListPollTimer);
        chatListPollTimer = null;
    }
}

async function openConversation(conversationId) {
    pendingNewConversation = null;
    activeConversationId = conversationId;

    activeConversationMeta = chatConversations.find(
        conversation => conversation.id === conversationId
    ) || null;

    lastLoadedMessageId = 0;

    document.getElementById('chatEmptyState')?.classList.add('d-none');
    document.getElementById('chatActiveThread')?.classList.remove('d-none');

    renderChatHeader();

    document.getElementById('chatMessagesBody').innerHTML =
        '<p class="text-center text-muted small py-4 mb-0">Loading...</p>';

    try {
        const response = await (
            await fetch(`messages.php?action=thread&conversation_id=${conversationId}`)
        ).json();

        if (response.status === 'success') {
            document.getElementById('chatMessagesBody').innerHTML = '';
            appendChatMessages(response.messages, false);
        }
    } catch (error) {
        console.error('openConversation failed', error);
    }

    fetch('messages.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'mark_read',
            conversation_id: conversationId
        })
    }).then(() => {
        const conversation = chatConversations.find(
            item => item.id === conversationId
        );

        if (conversation) {
            conversation.unread_count = 0;
            updateMessagesNavBadge();
            renderConversationList();
        }
    }).catch(() => {});

    renderConversationList();
    startChatThreadPolling();

    setTimeout(
        () => document.getElementById('chatMessageInput')?.focus(),
        50
    );
}

function renderChatHeader() {
    const avatar = document.getElementById('chatHeaderAvatar');
    const title = document.getElementById('chatHeaderTitle');
    const subtitle = document.getElementById('chatHeaderSubtitle');

    if (!avatar || !title || !subtitle) return;

    if (pendingNewConversation) {
        const names = pendingNewConversation.names || [];

        const label = pendingNewConversation.title ||
            names.join(', ') ||
            'New Message';

        avatar.innerHTML = pendingNewConversation.recipientIds.length > 1
            ? '<i class="bi bi-people-fill"></i>'
            : escapeHtml(initials(label));

        title.innerText = label;
        subtitle.innerText = 'New conversation';
        return;
    }

    if (!activeConversationMeta) return;

    avatar.innerHTML = activeConversationMeta.is_group
        ? '<i class="bi bi-people-fill"></i>'
        : escapeHtml(initials(activeConversationMeta.title));

    title.innerText = activeConversationMeta.title;

    subtitle.innerText = activeConversationMeta.is_group
        ? `${activeConversationMeta.participants.length + 1} members`
        : (
            activeConversationMeta.participants[0]?.role
                ? capitalize(activeConversationMeta.participants[0].role)
                : ''
        );

    const manageButton = document.getElementById('chatHeaderManageBtn');

    if (manageButton) {
        manageButton.classList.toggle(
            'd-none',
            !activeConversationMeta.is_group
        );
    }
}

function capitalize(value) {
    return value
        ? value.charAt(0).toUpperCase() + value.slice(1)
        : value;
}

function appendChatMessages(messages, scrollIfNearBottom) {
    if (!messages || messages.length === 0) return;

    const body = document.getElementById('chatMessagesBody');

    if (!body) return;

    const wasNearBottom = !scrollIfNearBottom ||
        (body.scrollHeight - body.scrollTop - body.clientHeight < 120);

    const isGroup = activeConversationMeta &&
        activeConversationMeta.is_group;

    messages.forEach(message => {
        lastLoadedMessageId = Math.max(lastLoadedMessageId, message.id);

        const bubble = document.createElement('div');
        bubble.dataset.messageId = message.id;

        if (message.is_system) {
            bubble.className = 'chat-system-row';
            bubble.innerHTML = `<span class="chat-system-pill">${escapeHtml(message.body)}</span>`;
            body.appendChild(bubble);
            return;
        }

        bubble.className =
            `chat-bubble-row ${message.is_mine ? 'mine' : 'theirs'}`;

        const senderLabel = !message.is_mine && isGroup
            ? `<div class="chat-bubble-sender">${escapeHtml(message.sender_username)}</div>`
            : '';

        const editedTag = message.is_edited && !message.is_deleted
            ? ' <span class="chat-bubble-edited">(edited)</span>'
            : '';

        const textClass = message.is_deleted
            ? 'chat-bubble-text fst-italic opacity-75'
            : 'chat-bubble-text';

        const actions = message.is_mine && !message.is_deleted
            ? `
                <div class="chat-bubble-actions">
                    <button type="button" title="Edit" onclick="editChatMessage(${message.id})">
                        <i class="bi bi-pencil-fill"></i>
                    </button>
                    <button type="button" title="Unsend" onclick="deleteChatMessage(${message.id})">
                        <i class="bi bi-trash3-fill"></i>
                    </button>
                </div>
            `
            : '';

        bubble.innerHTML = `
            <div class="chat-bubble">
                ${senderLabel}${actions}
                <div class="${textClass}">${escapeHtml(message.body)}${editedTag}</div>
                <div class="chat-bubble-time">${formatChatTimestamp(message.created_at)}</div>
            </div>
        `;

        body.appendChild(bubble);
    });

    if (wasNearBottom) {
        body.scrollTop = body.scrollHeight;
    }
}

async function editChatMessage(messageId) {
    const bubble = document.querySelector(
        `[data-message-id="${messageId}"] .chat-bubble-text`
    );

    const currentText = bubble
        ? bubble.childNodes[0]?.textContent || ''
        : '';

    const { value: newBody } = await Swal.fire({
        title: 'Edit Message',
        input: 'textarea',
        inputValue: currentText,
        showCancelButton: true,
        confirmButtonText: 'Save',
        confirmButtonColor: 'var(--gold-main)',
        inputValidator: value =>
            (!value || !value.trim())
                ? 'Message cannot be empty.'
                : undefined
    });

    if (newBody === undefined) return;

    try {
        const response = await (await fetch('messages.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'edit_message',
                message_id: messageId,
                body: newBody.trim()
            })
        })).json();

        if (response.status === 'success') {
            if (bubble) {
                bubble.innerHTML =
                    `${escapeHtml(response.body)} <span class="chat-bubble-edited">(edited)</span>`;
            }
        } else {
            Swal.fire(
                'Could Not Edit',
                response.message || 'Please try again.',
                'error'
            );
        }
    } catch (error) {
        Swal.fire(
            'Could Not Edit',
            'An unexpected error occurred.',
            'error'
        );
    }
}

async function deleteChatMessage(messageId) {
    const confirmResult = await Swal.fire({
        title: 'Unsend this message?',
        text: 'It will be replaced with "This message was deleted" for everyone in the conversation.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: 'var(--crimson)',
        cancelButtonColor: 'var(--navy-sub)',
        confirmButtonText: 'Yes, unsend it'
    });

    if (!confirmResult.isConfirmed) return;

    try {
        const response = await (await fetch('messages.php', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'message',
                message_id: messageId
            })
        })).json();

        if (response.status === 'success') {
            const row = document.querySelector(
                `[data-message-id="${messageId}"]`
            );

            if (row) {
                const textElement = row.querySelector('.chat-bubble-text');
                const actionsElement = row.querySelector('.chat-bubble-actions');

                if (textElement) {
                    textElement.textContent = 'This message was deleted.';
                    textElement.classList.add('fst-italic', 'opacity-75');
                }

                if (actionsElement) actionsElement.remove();
            }
        } else {
            Swal.fire(
                'Could Not Unsend',
                response.message || 'Please try again.',
                'error'
            );
        }
    } catch (error) {
        Swal.fire(
            'Could Not Unsend',
            'An unexpected error occurred.',
            'error'
        );
    }
}

function startChatThreadPolling() {
    stopChatThreadPolling();

    chatThreadPollTimer = setInterval(async () => {
        if (!activeConversationId) return;

        try {
            const response = await (
                await fetch(
                    `messages.php?action=thread&conversation_id=${activeConversationId}&after_id=${lastLoadedMessageId}`
                )
            ).json();

            if (
                response.status === 'success' &&
                response.messages.length > 0
            ) {
                appendChatMessages(response.messages, true);

                fetch('messages.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'mark_read',
                        conversation_id: activeConversationId
                    })
                }).catch(() => {});
            }
        } catch (error) {}
    }, 4000);
}

function stopChatThreadPolling() {
    if (chatThreadPollTimer) {
        clearInterval(chatThreadPollTimer);
        chatThreadPollTimer = null;
    }
}

function handleChatInputKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendChatMessage();
    }
}

function autoGrowChatInput(element) {
    if (!element) return;

    element.style.height = 'auto';
    element.style.height = Math.min(element.scrollHeight, 140) + 'px';
}

async function sendChatMessage() {
    const input = document.getElementById('chatMessageInput');

    if (!input) return;

    const body = input.value.trim();

    if (body === '') return;
    if (!activeConversationId && !pendingNewConversation) return;

    input.value = '';
    autoGrowChatInput(input);
    input.disabled = true;

    const payload = {
        action: 'send',
        body
    };

    if (activeConversationId) {
        payload.conversation_id = activeConversationId;
    } else {
        payload.recipient_ids = pendingNewConversation.recipientIds;

        if (pendingNewConversation.title) {
            payload.title = pendingNewConversation.title;
        }
    }

    try {
        const response = await (await fetch('messages.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })).json();

        if (response.status === 'success') {
            const wasNewConversation = !activeConversationId;

            activeConversationId = response.conversation_id;
            pendingNewConversation = null;

            appendChatMessages([response.message], false);

            await loadConversations();

            activeConversationMeta = chatConversations.find(
                conversation => conversation.id === activeConversationId
            ) || activeConversationMeta;

            renderChatHeader();
            renderConversationList();

            if (wasNewConversation) {
                startChatThreadPolling();
            }
        } else {
            Swal.fire(
                'Could Not Send',
                response.message || 'Please try again.',
                'error'
            );

            input.value = body;
        }
    } catch (error) {
        Swal.fire(
            'Could Not Send',
            'An unexpected error occurred.',
            'error'
        );

        input.value = body;
    } finally {
        input.disabled = false;
        input.focus();
    }
}

async function openNewConversationModal() {
    selectedNewConvoUserIds = new Set();

    const listElement = document.getElementById('newConvoUserList');
    const groupWrap = document.getElementById('newConvoGroupTitleWrap');
    const groupInput = document.getElementById('newConvoGroupTitle');

    if (groupWrap) groupWrap.classList.add('d-none');
    if (groupInput) groupInput.value = '';

    if (listElement) {
        listElement.innerHTML =
            '<p class="text-center text-muted small py-3 mb-0">Loading people...</p>';
    }

    const modalElement = document.getElementById('newConversationModal');

    if (modalElement) {
        bootstrap.Modal.getOrCreateInstance(modalElement).show();
    }

    try {
        const response = await (
            await fetch('messages.php?action=users')
        ).json();

        if (response.status === 'success') {
            allMessagableUsers = response.users;
            renderNewConvoUserList();
        }
    } catch (error) {
        if (listElement) {
            listElement.innerHTML =
                '<p class="text-center text-theme-crimson small py-3 mb-0">Could not load users.</p>';
        }
    }
}

function renderNewConvoUserList() {
    const listElement = document.getElementById('newConvoUserList');

    if (!listElement) return;

    if (allMessagableUsers.length === 0) {
        listElement.innerHTML =
            '<p class="text-center text-muted small py-3 mb-0">No other users found.</p>';
        return;
    }

    listElement.innerHTML = allMessagableUsers.map(user => {
        const name = user.full_name && user.full_name !== 'Unassigned'
            ? user.full_name
            : user.username;

        return `
            <label class="new-convo-user-row">
                <input
                    type="checkbox"
                    value="${user.id}"
                    onchange="toggleNewConvoUser(${user.id}, this.checked)"
                >
                <div class="chat-avatar-circle chat-avatar-sm">
                    ${escapeHtml(initials(name))}
                </div>
                <div>
                    <div class="fw-semibold text-main">${escapeHtml(name)}</div>
                    <div class="small text-muted">${escapeHtml(capitalize(user.role))}</div>
                </div>
            </label>
        `;
    }).join('');
}

function toggleNewConvoUser(userId, checked) {
    if (checked) {
        selectedNewConvoUserIds.add(userId);
    } else {
        selectedNewConvoUserIds.delete(userId);
    }

    const groupWrap = document.getElementById('newConvoGroupTitleWrap');

    if (groupWrap) {
        groupWrap.classList.toggle(
            'd-none',
            selectedNewConvoUserIds.size < 2
        );
    }
}

function startNewConversation() {
    const ids = Array.from(selectedNewConvoUserIds);

    if (ids.length === 0) {
        Swal.fire(
            'Pick Someone',
            'Select at least one person to message.',
            'warning'
        );
        return;
    }

    if (ids.length === 1) {
        const existing = chatConversations.find(conversation =>
            !conversation.is_group &&
            conversation.participants.some(
                participant => participant.id === ids[0]
            )
        );

        if (existing) {
            bootstrap.Modal.getInstance(
                document.getElementById('newConversationModal')
            )?.hide();

            switchView('messages');
            openConversation(existing.id);
            return;
        }
    }

    const names = allMessagableUsers
        .filter(user => ids.includes(user.id))
        .map(user =>
            user.full_name && user.full_name !== 'Unassigned'
                ? user.full_name
                : user.username
        );

    const groupTitle = (
        document.getElementById('newConvoGroupTitle')?.value || ''
    ).trim();

    pendingNewConversation = {
        recipientIds: ids,
        names,
        title: ids.length > 1 ? groupTitle : ''
    };

    activeConversationId = null;
    activeConversationMeta = null;
    lastLoadedMessageId = 0;

    bootstrap.Modal.getInstance(
        document.getElementById('newConversationModal')
    )?.hide();

    switchView('messages');

    document.getElementById('chatEmptyState')?.classList.add('d-none');
    document.getElementById('chatActiveThread')?.classList.remove('d-none');

    document.getElementById('chatMessagesBody').innerHTML =
        '<p class="text-center text-muted small py-4 mb-0">Say hello 👋</p>';

    renderChatHeader();
    renderConversationList();

    setTimeout(
        () => document.getElementById('chatMessageInput')?.focus(),
        50
    );
}

function openManageGroupModal() {
    if (!activeConversationMeta || !activeConversationMeta.is_group) return;

    selectedAddMemberUserIds = new Set();

    const isAdmin = currentUserRole === 'admin';

    document.getElementById('manageGroupTitleInput').value =
        activeConversationMeta.title || '';

    document.getElementById('manageGroupTitleInput').disabled = !isAdmin;

    document.getElementById('manageGroupRenameBtn')
        .classList.toggle('d-none', !isAdmin);

    document.getElementById('manageGroupAdminOnlyNote')
        .classList.toggle('d-none', isAdmin);

    document.getElementById('manageGroupAddSection')
        .classList.toggle('d-none', !isAdmin);

    document.getElementById('manageGroupDeleteBtn')
        .classList.toggle('d-none', !isAdmin);

    renderManageGroupMembers();

    const modalElement = document.getElementById('manageGroupModal');

    if (modalElement) {
        bootstrap.Modal.getOrCreateInstance(modalElement).show();
    }
}

function renderManageGroupMembers() {
    const listElement = document.getElementById('manageGroupMemberList');

    if (!listElement || !activeConversationMeta) return;

    const isAdmin = currentUserRole === 'admin';
    const members = activeConversationMeta.participants || [];

    if (members.length === 0) {
        listElement.innerHTML =
            '<p class="text-center text-muted small py-2 mb-0">No other members.</p>';
        return;
    }

    listElement.innerHTML = members.map(user => {
        const name = user.full_name && user.full_name !== 'Unassigned'
            ? user.full_name
            : user.username;

        const removeButton = isAdmin
            ? `<button type="button" class="btn btn-sm text-theme-crimson p-0" title="Remove from group" onclick="removeGroupMember(${user.id})"><i class="bi bi-x-circle-fill"></i></button>`
            : '';

        return `
            <div class="new-convo-user-row justify-content-between">
                <div class="d-flex align-items-center gap-2">
                    <div class="chat-avatar-circle chat-avatar-sm">
                        ${escapeHtml(initials(name))}
                    </div>
                    <div>
                        <div class="fw-semibold text-main">${escapeHtml(name)}</div>
                        <div class="small text-muted">${escapeHtml(capitalize(user.role))}</div>
                    </div>
                </div>
                ${removeButton}
            </div>
        `;
    }).join('');
}

async function renameGroupChat() {
    const newTitle = (
        document.getElementById('manageGroupTitleInput').value || ''
    ).trim();

    if (!newTitle) {
        Swal.fire('Name Required', 'Give the group a name.', 'warning');
        return;
    }

    try {
        const response = await (await fetch('messages.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'rename_group',
                conversation_id: activeConversationId,
                title: newTitle
            })
        })).json();

        if (response.status === 'success') {
            await loadConversations();

            activeConversationMeta = chatConversations.find(
                conversation => conversation.id === activeConversationId
            ) || activeConversationMeta;

            renderChatHeader();
            openConversation(activeConversationId);

            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: 'Group renamed',
                showConfirmButton: false,
                timer: 1800
            });
        } else {
            Swal.fire(
                'Could Not Rename',
                response.message || 'Please try again.',
                'error'
            );
        }
    } catch (error) {
        Swal.fire('Could Not Rename', 'An unexpected error occurred.', 'error');
    }
}

function openAddMembersPicker() {
    selectedAddMemberUserIds = new Set();

    const listElement = document.getElementById('manageGroupAddUserList');

    if (listElement) {
        listElement.innerHTML =
            '<p class="text-center text-muted small py-2 mb-0">Loading people...</p>';
    }

    document.getElementById('manageGroupAddPicker')
        .classList.remove('d-none');

    fetch('messages.php?action=users')
        .then(response => response.json())
        .then(data => {
            if (data.status !== 'success') return;

            const existingIds = new Set(
                (activeConversationMeta.participants || []).map(
                    participant => participant.id
                )
            );

            const candidates = data.users.filter(
                user => !existingIds.has(user.id)
            );

            if (candidates.length === 0) {
                listElement.innerHTML =
                    '<p class="text-center text-muted small py-2 mb-0">Everyone is already in this group.</p>';
                return;
            }

            listElement.innerHTML = candidates.map(user => {
                const name = user.full_name && user.full_name !== 'Unassigned'
                    ? user.full_name
                    : user.username;

                return `
                    <label class="new-convo-user-row">
                        <input
                            type="checkbox"
                            value="${user.id}"
                            onchange="toggleAddMemberUser(${user.id}, this.checked)"
                        >
                        <div class="chat-avatar-circle chat-avatar-sm">
                            ${escapeHtml(initials(name))}
                        </div>
                        <div>
                            <div class="fw-semibold text-main">${escapeHtml(name)}</div>
                            <div class="small text-muted">${escapeHtml(capitalize(user.role))}</div>
                        </div>
                    </label>
                `;
            }).join('');
        })
        .catch(() => {
            if (listElement) {
                listElement.innerHTML =
                    '<p class="text-center text-theme-crimson small py-2 mb-0">Could not load users.</p>';
            }
        });
}

function toggleAddMemberUser(userId, checked) {
    if (checked) {
        selectedAddMemberUserIds.add(userId);
    } else {
        selectedAddMemberUserIds.delete(userId);
    }
}

async function confirmAddMembers() {
    const ids = Array.from(selectedAddMemberUserIds);

    if (ids.length === 0) {
        Swal.fire(
            'Pick Someone',
            'Select at least one person to add.',
            'warning'
        );
        return;
    }

    try {
        const response = await (await fetch('messages.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'add_members',
                conversation_id: activeConversationId,
                user_ids: ids
            })
        })).json();

        if (response.status === 'success') {
            document.getElementById('manageGroupAddPicker')
                .classList.add('d-none');

            await loadConversations();

            activeConversationMeta = chatConversations.find(
                conversation => conversation.id === activeConversationId
            ) || activeConversationMeta;

            renderChatHeader();
            renderManageGroupMembers();
            openConversation(activeConversationId);
        } else {
            Swal.fire(
                'Could Not Add',
                response.message || 'Please try again.',
                'error'
            );
        }
    } catch (error) {
        Swal.fire('Could Not Add', 'An unexpected error occurred.', 'error');
    }
}

async function removeGroupMember(userId) {
    const confirmResult = await Swal.fire({
        title: 'Remove this member?',
        text: 'They will lose access to this group chat.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: 'var(--crimson)',
        cancelButtonColor: 'var(--navy-sub)',
        confirmButtonText: 'Yes, remove them'
    });

    if (!confirmResult.isConfirmed) return;

    try {
        const response = await (await fetch('messages.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'remove_member',
                conversation_id: activeConversationId,
                user_id: userId
            })
        })).json();

        if (response.status === 'success') {
            await loadConversations();

            activeConversationMeta = chatConversations.find(
                conversation => conversation.id === activeConversationId
            ) || activeConversationMeta;

            renderChatHeader();
            renderManageGroupMembers();
            openConversation(activeConversationId);
        } else {
            Swal.fire(
                'Could Not Remove',
                response.message || 'Please try again.',
                'error'
            );
        }
    } catch (error) {
        Swal.fire('Could Not Remove', 'An unexpected error occurred.', 'error');
    }
}

async function leaveGroupChat() {
    const confirmResult = await Swal.fire({
        title: 'Leave this group?',
        text: 'You will no longer see this conversation or receive its messages.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: 'var(--crimson)',
        cancelButtonColor: 'var(--navy-sub)',
        confirmButtonText: 'Yes, leave'
    });

    if (!confirmResult.isConfirmed) return;

    try {
        const response = await (await fetch('messages.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'leave_conversation',
                conversation_id: activeConversationId
            })
        })).json();

        if (response.status === 'success') {
            bootstrap.Modal.getInstance(
                document.getElementById('manageGroupModal')
            )?.hide();

            activeConversationId = null;
            activeConversationMeta = null;

            stopChatThreadPolling();

            document.getElementById('chatActiveThread')
                ?.classList.add('d-none');

            document.getElementById('chatEmptyState')
                ?.classList.remove('d-none');

            loadConversations();
        } else {
            Swal.fire(
                'Could Not Leave',
                response.message || 'Please try again.',
                'error'
            );
        }
    } catch (error) {
        Swal.fire('Could Not Leave', 'An unexpected error occurred.', 'error');
    }
}

async function deleteGroupChat() {
    const confirmResult = await Swal.fire({
        title: 'Delete this group chat?',
        text: 'This permanently deletes the entire conversation and every message in it, for everyone. This cannot be undone.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: 'var(--crimson)',
        cancelButtonColor: 'var(--navy-sub)',
        confirmButtonText: 'Yes, delete it'
    });

    if (!confirmResult.isConfirmed) return;

    try {
        const response = await (await fetch('messages.php', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'group',
                conversation_id: activeConversationId
            })
        })).json();

        if (response.status === 'success') {
            bootstrap.Modal.getInstance(
                document.getElementById('manageGroupModal')
            )?.hide();

            activeConversationId = null;
            activeConversationMeta = null;

            stopChatThreadPolling();

            document.getElementById('chatActiveThread')
                ?.classList.add('d-none');

            document.getElementById('chatEmptyState')
                ?.classList.remove('d-none');

            loadConversations();
        } else {
            Swal.fire(
                'Could Not Delete',
                response.message || 'Please try again.',
                'error'
            );
        }
    } catch (error) {
        Swal.fire('Could Not Delete', 'An unexpected error occurred.', 'error');
    }
}

let workspaceNotificationBaseline = null;
let workspaceNotificationFilter = null;
function handleWorkspaceNotificationPoll(response) {
    const prefs=response.preferences;
    if(!prefs)return;
    window.setWorkspaceNotificationPreferences?.(prefs);
    const filter=JSON.stringify([prefs.messages,prefs.system,prefs.password_reset,prefs.sound]);
    const latest=Number(response.latest_unread_id)||0;
    if(workspaceNotificationBaseline!==null && filter===workspaceNotificationFilter && latest>workspaceNotificationBaseline && prefs.sound){
        window.playWorkspaceNotificationSound?.();
    }
    workspaceNotificationBaseline=filter===workspaceNotificationFilter?Math.max(workspaceNotificationBaseline||0,latest):latest;
    workspaceNotificationFilter=filter;
}
async function refreshNotifBadge() {
    try {
        const response = await (
            await fetch('notifications.php?action=count')
        ).json();

        if (response.status !== 'success') return;

        handleWorkspaceNotificationPoll(response);
        const count = response.unread_count;
        const bellBadge = document.getElementById('notifBellBadge');

        if (bellBadge) {
            if (count > 0) {
                bellBadge.innerText = count > 99 ? '99+' : count;
                bellBadge.classList.remove('d-none');
            } else {
                bellBadge.classList.add('d-none');
            }
        }

    } catch (error) {}
}

function toggleNotifDropdown() {
    const dropdown = document.getElementById('notifDropdown');

    if (!dropdown) return;

    const isHidden = dropdown.classList.contains('d-none');

    if (isHidden) {
        dropdown.classList.remove('d-none');
        loadNotifDropdown();
    } else {
        dropdown.classList.add('d-none');
    }
}

async function loadNotifDropdown() {
    const body = document.getElementById('notifDropdownBody');

    if (!body) return;

    try {
        const response = await (
            await fetch('notifications.php?action=list')
        ).json();

        if (response.status !== 'success') return;

        if (response.notifications.length === 0) {
            body.innerHTML =
                '<p class="text-center text-muted small py-4 mb-0">You\'re all caught up.</p>';
            return;
        }

        body.innerHTML = response.notifications.map(notification => `
            <div
                class="notif-item ${notification.is_read ? '' : 'unread'}"
                onclick="goToNotification(${notification.id}, ${notification.conversation_id ?? 'null'}, ${notification.is_read}, ${notification.type === 'password_reset'})"
            >
                <div class="fw-semibold text-main small">
                    ${escapeHtml(notification.title)}
                </div>

                ${notification.body ? `
                    <div class="small text-muted">
                        ${escapeHtml(notification.body)}
                    </div>
                ` : ''}

                <div class="small text-muted mt-1">
                    ${formatChatTimestamp(notification.created_at)}
                </div>
            </div>
        `).join('');
    } catch (error) {
        body.innerHTML =
            '<p class="text-center text-theme-crimson small py-4 mb-0">Could not load notifications.</p>';
    }
}

function goToNotification(
    id,
    conversationId,
    alreadyRead,
    passwordResetAlert = false
) {
    document.getElementById('notifDropdown')?.classList.add('d-none');

    if (!alreadyRead) {
        fetch('notifications.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'mark_read',
                id
            })
        }).then(refreshNotifBadge).catch(() => {});
    }

    if (passwordResetAlert && getUserRole() === 'admin') {
        openAdminPasswordResets();
    } else if (conversationId) {
        switchView('messages');

        loadConversations().then(() => {
            openConversation(conversationId);
        });
    }
}

function markAllNotificationsRead() {
    fetch('notifications.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'mark_all_read'
        })
    }).then(() => {
        refreshNotifBadge();
        loadNotifDropdown();
    }).catch(() => {});
}

/* Responsive sidebar navigation */

(function () {
    const button = document.getElementById('mobileMenuButton');
    const scrim = document.getElementById('sidebarScrim');
    const sidebar = document.getElementById('appSidebar');

    if (!button || !sidebar || !scrim) return;

    const close = () => {
        document.body.classList.remove('sidebar-open');
        button.setAttribute('aria-expanded', 'false');
        button.setAttribute('aria-label', 'Open navigation');
    };

    button.addEventListener('click', () => {
        const opening = !document.body.classList.contains('sidebar-open');

        document.body.classList.toggle('sidebar-open', opening);

        button.setAttribute('aria-expanded', String(opening));

        button.setAttribute(
            'aria-label',
            opening ? 'Close navigation' : 'Open navigation'
        );

        if (opening) {
            sidebar.querySelector('.nav-link')?.focus();
        }
    });

    scrim.addEventListener('click', close);

    sidebar.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', close);
    });

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') close();
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth > 820) close();
    });
})();

/* Admin review of officer password-reset requests */

function openAdminPasswordResets() {
    if (getUserRole() !== 'admin') return;

    switchView('admin-panel');

    const tab = document.getElementById('reset-tab');

    if (tab && window.bootstrap?.Tab) {
        bootstrap.Tab.getOrCreateInstance(tab).show();
    }

    loadPasswordResetRequests();
}

async function resetAdminAction(action, id) {
    const response = await fetch('password_reset.php', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action,
            id,
            csrf: passwordResetAdminCsrf
        })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.status !== 'success') {
        throw new Error(
            data.message || 'Could not process request.'
        );
    }

    return data;
}

async function loadPasswordResetRequests() {
    if (getUserRole() !== 'admin') return;

    const tbody = document.getElementById('passwordResetRequestsBody');

    if (!tbody) return;

    try {
        const response = await fetch('password_reset.php?action=list', {
            credentials: 'same-origin',
            cache: 'no-store'
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || data.status !== 'success') {
            throw new Error(
                data.message || 'Unable to load requests.'
            );
        }

        const pending = data.requests.filter(
            request => request.status === 'pending'
        ).length;

        const badge = document.getElementById('resetRequestsBadge');

        if (badge) {
            badge.textContent = pending;
            badge.classList.toggle('d-none', pending === 0);
        }

        tbody.replaceChildren();

        if (!data.requests.length) {
            const row = tbody.insertRow();
            const cell = row.insertCell();

            cell.colSpan = 5;
            cell.className = 'text-center text-muted py-4';
            cell.textContent = 'No password reset requests yet.';
            return;
        }

        for (const request of data.requests) {
            const row = tbody.insertRow();
            const person = row.insertCell();

            const name = document.createElement('strong');

            name.textContent =
                request.full_name && request.full_name !== 'Unassigned'
                    ? request.full_name
                    : request.username;

            const detail = document.createElement('small');

            detail.className = 'd-block text-muted';
            detail.textContent =
                '@' + request.username + ' · #' + request.id;

            person.append(name, detail);

            row.insertCell().textContent = request.role.toUpperCase();
            row.insertCell().textContent = request.requested_at;

            const statusCell = row.insertCell();
            const pill = document.createElement('span');

            pill.className = 'reset-status reset-status-' + request.status;

            pill.textContent = (
                request.status === 'approved' &&
                request.code_expires_at &&
                new Date(
                    request.code_expires_at.replace(' ', 'T')
                ).getTime() < Date.now()
            )
                ? 'Code expired'
                : request.status;

            statusCell.append(pill);

            const actionCell = row.insertCell();
            actionCell.className = 'text-end';

            function addAction(text, action, className) {
                const button = document.createElement('button');

                button.type = 'button';
                button.className =
                    'btn btn-sm ' + className + ' me-1 mb-1';
                button.textContent = text;

                button.addEventListener('click', () => {
                    handlePasswordResetDecision(
                        action,
                        request.id,
                        request.username
                    );
                });

                actionCell.append(button);
            }

            if (request.status === 'pending') {
                addAction('Approve', 'approve', 'btn-primary');
                addAction('Deny', 'deny', 'btn-outline-secondary');
            } else if (request.status === 'approved') {
                addAction(
                    'Reissue code',
                    'reissue',
                    'btn-outline-primary'
                );
            } else {
                actionCell.textContent = '—';
            }
        }
    } catch (error) {
        tbody.innerHTML = '';

        const row = tbody.insertRow();
        const cell = row.insertCell();

        cell.colSpan = 5;
        cell.className = 'text-center text-danger py-4';
        cell.textContent = error.message;
    }
}

async function handlePasswordResetDecision(action, id, username) {
    if (getUserRole() !== 'admin') return;

    const approve = action === 'approve' || action === 'reissue';

    const confirmation = await Swal.fire({
        title: approve
            ? 'Authorize password reset?'
            : 'Deny reset request?',
        text: approve
            ? `Verify ${username} is the account owner before you give them their code. The code is shown only once.`
            : `Deny the request for ${username}?`,
        icon: approve ? 'question' : 'warning',
        showCancelButton: true,
        confirmButtonText: approve
            ? 'Verified — continue'
            : 'Deny request',
        confirmButtonColor: approve ? '#2563eb' : '#9f4253'
    });

    if (!confirmation.isConfirmed) return;

    try {
        const data = await resetAdminAction(action, id);

        await loadPasswordResetRequests();

        if (approve) {
            await Swal.fire({
                title: 'One-time recovery code',
                text: `Officer: ${username} · Expires in 30 minutes. Copy this code now and share it only after verifying their identity.`,
                input: 'text',
                inputValue: data.code,
                inputAttributes: {
                    readonly: 'readonly',
                    'aria-label': 'Copy recovery code'
                },
                confirmButtonText: 'I saved the code',
                allowOutsideClick: false,
                icon: 'success'
            });
        } else {
            await Swal.fire({
                icon: 'success',
                title: 'Request denied',
                text: data.message
            });
        }
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Unable to process request',
            text: error.message
        });
    }
}

async function recoverArchiveYear() {
    if (getUserRole() !== 'admin') return;
    const year = document.getElementById('archiveYearSelect')?.value;
    if (!year) return Swal.fire('Select a School Year', 'Choose the archived school year you want to recover.', 'info');
    const result = await Swal.fire({
        title: 'Recover ' + year + '?',
        text: 'Create a separate editable copy of this archived year? Your current school year and the original archive will remain separate. If already recovered, its existing workspace will open.',
        icon: 'question', showCancelButton: true, confirmButtonText: 'Recover / Open Year'
    });
    if (!result.isConfirmed) return;
    const button = document.getElementById('recoverYearButton');
    if (button) { button.disabled = true; button.textContent = 'Opening recovered year…'; }
    try {
        const response = await fetch('recovery_api.php', {
            method: 'POST', credentials: 'same-origin',
            headers: {'Content-Type': 'application/json', 'X-App-CSRF': document.querySelector('meta[name="app-csrf"]')?.content || ''},
            body: JSON.stringify({action: 'recover', year})
        });
        const data = await response.json();
        if (!response.ok || data.status !== 'success') throw new Error(data.message || 'The year could not be recovered.');
        window.location.assign('recovered_year.php?year=' + encodeURIComponent(year));
    } catch (error) {
        Swal.fire('Recovery not completed', error.message, 'error');
    } finally {
        if (button) { button.disabled = false; button.innerHTML = '<i class="bi bi-arrow-counterclockwise me-1"></i>Recover / Open Year'; }
    }
}

// Canvas labels do not inherit CSS; refresh them when account appearance changes.
function workspaceChartPalette() {
    const dark=document.documentElement.dataset.theme==='dark';
    return dark?{text:'#e2eaf7',muted:'#afc2de',grid:'#344963'}:{text:'#221C13',muted:'#746B58',grid:'rgba(34,28,19,0.08)'};
}
function updateWorkspaceChartColors() {
    if(!window.Chart?.getChart)return;
    const palette=workspaceChartPalette();
    document.querySelectorAll('canvas').forEach(canvas=>{
        const chart=window.Chart.getChart(canvas);if(!chart)return;
        if(chart.options.plugins?.legend?.labels)chart.options.plugins.legend.labels.color=palette.text;
        for(const axis of Object.values(chart.options.scales||{})){
            if(axis.ticks)axis.ticks.color=palette.muted;
            if(axis.grid)axis.grid.color=palette.grid;
        }
        chart.update('none');
    });
}
new MutationObserver(updateWorkspaceChartColors).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});


/* Item schedules live with each expenditure node in system_settings.ui_layout.
   The archive snapshot already preserves this layout, including these fields. */
function expenditureNodeToken(node) {
    return node.type === 'toggle' ? 'group:' + node.id : 'item:' +
        (node.parent ? node.parent + '-' : '') + node.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
}
function expenditureDateLabel(start, end) {
    if (!start) return 'Date not set';
    const fmt = value => new Date(value + 'T00:00:00Z').toLocaleDateString('en-US',
        {month:'long', day:'numeric', year:'numeric', timeZone:'UTC'});
    const last = end || start;
    const days = Math.round((Date.parse(last + 'T00:00:00Z') - Date.parse(start + 'T00:00:00Z')) / 86400000) + 1;
    return (start === last ? fmt(start) : fmt(start) + ' – ' + fmt(last)) +
        ' · ' + days + (days === 1 ? ' day' : ' days');
}
function decorateExpenditureItems() {
    const rows = [...document.querySelectorAll('#expendituresBody tr')];
    expendituresStructure.forEach((node, index) => {
        const tr = rows[index];
        if (!tr) return;
        tr.dataset.itemToken = expenditureNodeToken(node);
        tr.dataset.startDate = node.start_date || '';
        tr.dataset.endDate = node.end_date || '';
        // Keep controls outside the label used by rename and layout saving.
        tr.querySelector('.item-schedule-controls')?.remove();
        // Schedules and item reports belong only to the top-level item.
        if (node.parent) return;
        const controls = document.createElement('div');
        controls.className = 'item-schedule-controls d-flex flex-wrap align-items-center gap-2 mt-1';
        controls.addEventListener('click', e => e.stopPropagation());
        const label = document.createElement('span');
        label.className = 'small text-main';
        label.textContent = expenditureDateLabel(node.start_date, node.end_date);
        controls.append(label);
        if (getUserRole() === 'admin') {
            const edit = document.createElement('button');
            edit.type = 'button'; edit.className = 'btn btn-sm btn-outline-primary no-print';
            edit.textContent = node.start_date ? 'Edit dates' : 'Set dates';
            edit.addEventListener('click', () => editExpenditureDates(tr.dataset.itemToken));
            controls.append(edit);
        }
        const print = document.createElement('button');
        print.type = 'button'; print.className = 'btn btn-sm btn-outline-primary no-print';
        print.textContent = 'Print / Save as PDF';
        print.addEventListener('click', () => printReport('expenditures', tr.dataset.itemToken));
        controls.append(print);
        tr.cells[0].append(controls);
    });
}
async function editExpenditureDates(token) {
    if (getUserRole() !== 'admin') return;
    const node = expendituresStructure.find(n => expenditureNodeToken(n) === token);
    if (!node) return;
    const result = await Swal.fire({
        title: 'Item schedule',
        customClass: {popup:'item-schedule-dialog',htmlContainer:'item-schedule-content',actions:'item-schedule-actions'},
        width: 560,
        showCloseButton: true,
        html: '<div class="schedule-item"><span>ITEM DESCRIPTION</span><strong>' + escapeHtml(node.name) + '</strong></div>' +
            '<div class="schedule-date-grid"><div class="schedule-field"><label for="itemStartDate">Start date</label><input class="swal2-input" type="date" id="itemStartDate"></div>' +
            '<div class="schedule-field"><label for="itemEndDate">End date</label><input class="swal2-input" type="date" id="itemEndDate"></div></div>' +
            '<div class="schedule-help"><i class="bi bi-info-circle" aria-hidden="true"></i><div>For a one-day item, use the same date.<br>Clear both dates to remove the schedule.</div></div>',
        showCancelButton: true, confirmButtonText: 'Save dates', cancelButtonText: 'Cancel', reverseButtons:true,
        didOpen: () => {
            const start = document.getElementById('itemStartDate');
            const end = document.getElementById('itemEndDate');
            start.value = node.start_date || ''; end.value = node.end_date || '';
            end.min = start.value;
            start.addEventListener('change', () => { end.min = start.value; });
        },
        preConfirm: async () => {
            const start = document.getElementById('itemStartDate').value;
            const end = document.getElementById('itemEndDate').value || start;
            if ((!start && end) || (start && end < start)) {
                Swal.showValidationMessage('Use a start date and an end date on or after it.'); return false;
            }
            try {
                await postSave('api.php', {action:'save_item_dates', token, start_date:start, end_date:end});
                return {start_date:start, end_date:end};
            } catch (error) { Swal.showValidationMessage(error.message); return false; }
        },
        showLoaderOnConfirm: true, allowOutsideClick: () => !Swal.isLoading()
    });
    if (result.isConfirmed && result.value) {
        Object.assign(node, result.value);
        decorateExpenditureItems();
        setSaveStatus('saved', 'Item dates saved');
    }
}
function generateExpenditureItemReport(token = null) {
    const nodes = expendituresStructure;
    const selected = token === null ? null : nodes.find(n => expenditureNodeToken(n) === token);
    if (token !== null && !selected) return null;
    const includedGroups = new Set(selected?.type === 'toggle' ? [String(selected.id)] : []);
    // Include descendants independently of whether they are expanded on screen.
    let changed = true;
    while (changed) {
        changed = false;
        nodes.forEach(n => {
            if (n.type === 'toggle' && includedGroups.has(String(n.parent)) && !includedGroups.has(String(n.id))) {
                includedGroups.add(String(n.id)); changed = true;
            }
        });
    }
    const included = nodes.filter(n => !selected || n === selected || includedGroups.has(String(n.parent)));
    const domRows = new Map([...document.querySelectorAll('#expendituresBody tr')].map(tr => [tr.dataset.itemToken, tr]));
    let totalBudget = 0, totalSpent = 0;
    let rows = included.map(n => {
        const tr = domRows.get(expenditureNodeToken(n));
        const date = expenditureDateLabel(tr?.dataset.startDate || n.start_date, tr?.dataset.endDate || n.end_date);
        const name = escapeHtml(n.name);
        if (n.type === 'toggle') return '<tr><td colspan="4" style="background:#eaf2fc;font-weight:bold;">' + name +
            '<br><span style="font-weight:normal;">' + escapeHtml(date) + '</span></td></tr>';
        const budget = parseAmount(tr?.querySelector('.val-budget')?.value) || 0;
        const spent = parseAmount(tr?.querySelector('.val-total')?.value) || 0;
        totalBudget += budget; totalSpent += spent;
        return '<tr><td>' + name + '<br><small>' + escapeHtml(date) + '</small></td>' +
            [budget, spent, budget-spent].map(v => '<td style="text-align:right;">' + formatAmount(v) + '</td>').join('') + '</tr>';
    }).join('');
    rows += '<tr style="font-weight:bold;background:#dce9fa;"><td>' + (selected ? 'ITEM TOTAL' : 'GRAND TOTAL EXPENDITURES') +
        '</td>' + [totalBudget,totalSpent,totalBudget-totalSpent].map(v => '<td style="text-align:right;">' + formatAmount(v) + '</td>').join('') + '</tr>';
    if (!selected) {
        const overallBudget = parseAmount(document.getElementById('overallExpenditureBudget')?.value) || 0;
        rows = '<tr style="font-weight:bold;background:#eaf2fc;"><td colspan="3">OVERALL BUDGET</td>' +
            '<td style="text-align:right;">&#8369; ' + formatAmount(overallBudget) + '</td></tr>' + rows;
    }
    if (!selected) {
        const overallBudget = parseAmount(document.getElementById('overallExpenditureBudget')?.value) || 0;
        const remainingOverall = overallBudgetBalance(overallBudget, totalSpent);
        rows += '<tr style="font-weight:bold;background:#eaf2fc;"><td colspan="3">REMAINING OVERALL BUDGET' +
            '<br><small style="font-weight:normal;">Overall budget − total disbursed: &#8369; ' + formatAmount(overallBudget) +
            ' − &#8369; ' + formatAmount(totalSpent) + '</small></td>' +
            '<td style="text-align:right;' + (remainingOverall < 0 ? 'color:#b23f59;' : '') + '">&#8369; ' +
            formatAmount(remainingOverall) + '</td></tr>';
    }
    return {
        rows,
        thead:'<tr><th>Item Description / Dates</th><th>Budget</th><th>Amount Spent</th><th>Remaining Balance</th></tr>',
        reportTitle:'STATEMENT OF EXPENDITURES AND DISBURSEMENTS' + (selected ? ' — ' + escapeHtml(selected.name) : ''),
        currentDate:new Date().toLocaleDateString('en-US', {year:'numeric',month:'long',day:'numeric'})
    };
}


function overallBudgetBalance(overallBudget, disbursed) {
    return (Math.round(overallBudget * 100) - Math.round(disbursed * 100)) / 100;
}
function updateOverallBudgetSummary(totalDisbursed) {
    const overall = parseAmount(document.getElementById('overallExpenditureBudget')?.value) || 0;
    const remaining = overallBudgetBalance(overall, totalDisbursed);
    const values = {
        'overall-budget-summary': overall,
        'overall-disbursed-summary': totalDisbursed,
        'overall-remaining-summary': remaining
    };
    Object.entries(values).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.textContent = '₱ ' + formatAmount(value);
    });
    const balance = document.getElementById('overall-remaining-summary');
    if (balance) {
        balance.classList.toggle('text-theme-crimson', remaining < 0);
        balance.classList.toggle('text-main', remaining >= 0);
    }
    document.getElementById('overall-overspent-summary')?.classList.toggle('d-none', remaining >= 0);
}


function expenditureSignatoriesHtml() {
    const defaults = typeof window.getWorkspaceReportSignatories === 'function'
        ? window.getWorkspaceReportSignatories('admin') : {};
    return '<div style="display:flex;gap:18px;margin-top:40px;break-inside:avoid;page-break-inside:avoid;">' +
        [['prepared','Prepared by:'],['certified','Certified by:'],['noted','Noted by:'],['approved','Approved by:']].map(([key,label]) => {
            const nameInput = document.getElementById('expenseSig_' + key);
            const positionInput = document.getElementById('expenseSigPosition_' + key);
            const name = nameInput ? nameInput.value.trim() : (defaults[key]?.name || '');
            const position = positionInput ? positionInput.value.trim() : (defaults[key]?.position || '');
            return '<div style="flex:1;min-width:0;text-align:center;font-size:10px;color:#172c4d;">' +
                '<div style="text-align:left;margin-bottom:36px;">' + label + '</div>' +
                '<div style="border-bottom:1px solid #172c4d;min-height:16px;font-weight:bold;overflow-wrap:anywhere;">' + escapeHtml(name) + '</div>' +
                '<div style="font-size:8px;margin-top:3px;">Signature over printed name</div>' +
                '<div style="font-size:9px;margin-top:4px;overflow-wrap:anywhere;">' + escapeHtml(position) + '</div></div>';
        }).join('') + '</div>';
}


function groupArchiveStudentEntries(entries) {
    const groups = new Map();
    entries.forEach((entry,index) => {
        const name = String(entry.student_name || '').trim().replace(/\s+/g,' ');
        const section = String(entry.item_key || '');
        // Keep incomplete manual entries separate until their identity is filled in.
        const key = name && section ? JSON.stringify([section,name.toLocaleLowerCase('en-US')]) : 'new:' + index;
        if (!groups.has(key)) groups.set(key,{name,section,entries:[]});
        groups.get(key).entries.push(entry);
    });
    return [...groups.values()];
}
function configureArchiveGroupedTable() {
    const toolbar = document.getElementById('archiveRosterReload')?.parentElement;
    if (toolbar && !document.getElementById('archiveRosterPrint')) {
        const print = document.createElement('button');
        print.id='archiveRosterPrint';print.type='button';print.disabled=true;
        print.className='btn btn-gold btn-sm ms-2';
        print.innerHTML='<i class="bi bi-printer me-1"></i>Print / Save as PDF';
        print.addEventListener('click',printArchiveStudentFlags);
        toolbar.appendChild(print);
    }

    const body = document.getElementById('flagUnpaidBody');
    if (!body) return;
    const header = body.closest('table')?.querySelector('thead tr');
    if (header) header.innerHTML = '<th style="min-width:160px">Item / Category</th><th style="min-width:120px">Fee (₱)</th><th style="min-width:130px">Amount Paid (₱)</th><th style="min-width:150px">Remaining / Status</th><th style="min-width:180px">Notes</th><th style="width:40px"></th>';
}
function regroupArchiveStudentRows() {
    configureArchiveGroupedTable();
    const body = document.getElementById('flagUnpaidBody');
    if (!body) return;
    const entries = [...body.querySelectorAll('tr.unpaid-row')].map(row=>({
        student_name:row.querySelector('.unpaid-name').value,
        item_key:row.querySelector('.unpaid-section').value,row
    }));
    body.querySelectorAll('.archive-student-group,.archive-roster-empty').forEach(row=>row.remove());
    groupArchiveStudentEntries(entries).forEach((group,index) => {
        const header = document.createElement('tr');
        header.className = 'archive-student-group bg-sub-panel';
        header.dataset.group = String(index);
        header.innerHTML = '<td colspan="6"><div class="d-flex flex-wrap align-items-end gap-3 py-2"><div class="flex-grow-1"><label class="small fw-bold">Student Name<input type="text" class="form-control form-control-sm archive-group-name" maxlength="200" required placeholder="Student name"></label></div><div class="flex-grow-1"><label class="small fw-bold">Section / Program<select required class="form-select form-select-sm archive-group-section" aria-label="Student section"></select></label></div><button type="button" class="btn btn-sm btn-outline-primary archive-group-add">+ Add Category</button></div><div class="archive-group-summary small fw-semibold mb-2"></div></td>';
        const name = header.querySelector('.archive-group-name');
        const section = header.querySelector('.archive-group-section');
        name.value = group.name;
        const sourceSelect = group.entries[0].row.querySelector('.unpaid-section');
        section.innerHTML = sourceSelect.innerHTML;section.value = group.section;
        const sync = () => {
            group.entries.forEach(entry => {
                entry.row.querySelector('.unpaid-name').value = name.value;
                entry.row.querySelector('.unpaid-section').value = section.value;
            });
            archiveRosterSummary();
        };
        name.addEventListener('input',sync);
        name.addEventListener('change',()=>{sync();mergeArchiveStudentGroupsIfNeeded();archiveRosterSummary();});
        section.addEventListener('change',()=>{sync();mergeArchiveStudentGroupsIfNeeded();archiveRosterSummary();});
        header.querySelector('.archive-group-add').addEventListener('click',()=>{
            if (!name.reportValidity() || !section.reportValidity()) return;
            addUnpaidRow({student_name:name.value.trim(),item_key:section.value,amount_paid:'0.00'});
        });
        body.appendChild(header);
        group.entries.forEach(entry => {
            const row = entry.row;
            row.dataset.archiveGroup = String(index);
            // Retain the existing category-specific validation and archive payload.
            row.querySelector('.unpaid-name').value = group.name;
            row.querySelector('.unpaid-section').value = group.section;
            row.cells[0].classList.add('d-none');row.cells[1].classList.add('d-none');
            body.appendChild(row);
        });
    });
    updateArchiveGroupSummaries();
}
function updateArchiveGroupSummaries() {
    const body = document.getElementById('flagUnpaidBody');
    if (!body) return;
    body.querySelectorAll('.archive-student-group').forEach(header => {
        const rows = [...body.querySelectorAll('tr.unpaid-row')].filter(row=>row.dataset.archiveGroup===header.dataset.group);
        let partial=0,unpaid=0,unconfirmed=0,due=0;
        rows.forEach(row=>{
            const fee = row.querySelector('.unpaid-fee').value.trim();
            const paid = row.querySelector('.unpaid-paid').value.trim();
            if (fee==='' || paid==='' || !Number.isFinite(Number(fee)) || !Number.isFinite(Number(paid))) {unconfirmed++;return;}
            const balance = Math.round(Number(fee)*100)-Math.round(Number(paid)*100);
            if (balance>0) {due+=balance;if(Number(paid)>0)partial++;else unpaid++;}
        });
        header.querySelector('.archive-group-summary').textContent = `${rows.length} category entries · Partially Paid: ${partial} · Unpaid: ${unpaid} · Balance ₱ ${formatAmount(due/100)}` + (unconfirmed ? ` · ${unconfirmed} unconfirmed` : '');
    });
}

function mergeArchiveStudentGroupsIfNeeded() {
    const seen = new Set();
    for (const header of document.querySelectorAll('#flagUnpaidBody .archive-student-group')) {
        const name = header.querySelector('.archive-group-name').value.trim().replace(/\s+/g,' ').toLocaleLowerCase('en-US');
        const section = header.querySelector('.archive-group-section').value;
        if (!name || !section) continue;
        const key = JSON.stringify([section,name]);
        if (seen.has(key)) {regroupArchiveStudentRows();return;}
        seen.add(key);
    }
}


function buildArchiveFlagsPrintHtml(entries, schoolYear, defaults = {}) {
    const esc = value => escapeHtml(String(value ?? ''));
    const rows = entries.filter(entry => entry.amount_paid !== '' && entry.fee_amount !== '' &&
        Number.isFinite(Number(entry.amount_paid)) && Number.isFinite(Number(entry.fee_amount)) &&
        Number(entry.amount_paid)>=0 && Number(entry.fee_amount)>Number(entry.amount_paid));
    const groups = groupArchiveStudentEntries(rows);
    let totalPaid=0,totalDue=0,totalFee=0;
    const body = groups.map(group=>{
        let groupPaid=0,groupDue=0,groupFee=0;
        const detail = group.entries.map(entry=>{
            const fee=Math.round(Number(entry.fee_amount)*100),paid=Math.round(Number(entry.amount_paid)*100),due=fee-paid;
            groupFee+=fee;groupPaid+=paid;groupDue+=due;
            return '<tr><td>'+esc(entry.category_name || 'General / All fees')+'</td><td class="amount">₱ '+esc(formatAmount(fee/100))+
                '</td><td class="amount">₱ '+esc(formatAmount(paid/100))+'</td><td class="amount">₱ '+esc(formatAmount(due/100))+
                '</td><td class="'+(paid>0?'partial':'unpaid')+'">'+(paid>0?'Partially Paid':'Unpaid')+'</td><td>'+esc(entry.remarks)+'</td></tr>';
        }).join('');
        totalFee+=groupFee;totalPaid+=groupPaid;totalDue+=groupDue;
        const section=group.entries[0].section_label || group.section;
        return '<tr class="student-group"><td colspan="6"><strong>'+esc(group.name)+'</strong><br>'+esc(systemProgramLabel(section))+'</td></tr>'+detail+
            '<tr class="subtotal"><td>Student total</td><td class="amount">₱ '+esc(formatAmount(groupFee/100))+'</td><td class="amount">₱ '+esc(formatAmount(groupPaid/100))+
            '</td><td class="amount">₱ '+esc(formatAmount(groupDue/100))+'</td><td colspan="2"></td></tr>';
    }).join('');
    const signatures=[['prepared','Prepared by:'],['certified','Certified by:'],['noted','Noted by:'],['approved','Approved by:']].map(([key,label])=>
        '<div class="signature"><div>'+label+'</div><div class="name">'+esc(defaults[key]?.name || '')+'</div><small>Signature over printed name</small><div>'+esc(defaults[key]?.position || '')+'</div></div>').join('');
    const date=new Date().toLocaleString('en-PH',{timeZone:'Asia/Manila',year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:true});
    return `<!doctype html><html><head><meta charset="utf-8"><title>Flagged Student Balances — ${esc(schoolYear)}</title><style>
    @page{size:A4 landscape;margin:12mm}body{font:10px/1.45 Arial,sans-serif;color:#172c4d;margin:0}.date{text-align:right;margin-bottom:18px}.header{position:relative;text-align:center;padding:0 68px 14px;border-bottom:2px solid #285fae;margin-bottom:18px;min-height:60px}.header h2{font-size:15px;margin:0}.header p{margin:3px 0}.logo{position:absolute;top:0;width:68px;height:68px;object-fit:contain}.left{left:max(4px, calc(50% - 240px))}.right{right:max(4px, calc(50% - 240px))}h3{font-size:12px}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #cad8e9;padding:7px;overflow-wrap:anywhere;vertical-align:top}th{background:#eaf2fc;font-size:8px;text-transform:uppercase}.amount{text-align:right;white-space:nowrap}.student-group td{background:#eaf2fc;border-top:2px solid #285fae}.student-group{break-after:avoid;page-break-after:avoid}tr{break-inside:avoid}.subtotal, tfoot{background:#f3f7fd;font-weight:bold}.partial{color:#936000;font-weight:bold}.unpaid{color:#b52e47;font-weight:bold}thead{display:table-header-group}tfoot{display:table-row-group}.signatures{display:flex;gap:24px;margin-top:35px;break-inside:avoid}.signature{flex:1;min-width:0;text-align:center;overflow-wrap:anywhere}.signature>div:first-child{text-align:left}.name{margin-top:32px;border-bottom:1px solid #172c4d;min-height:16px;font-weight:bold}.note{font-size:9px}.toolbar{text-align:right;margin-bottom:14px}button{padding:9px 16px;background:#285fae;color:white;border:0;border-radius:5px}@media screen{body{padding:24px;max-width:1350px;margin:auto}}@media print{.toolbar{display:none}th,.student-group td{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
    </style></head><body><div class="toolbar"><button onclick="window.print()">Print / Save as PDF</button></div><div class="date">Date: ${esc(date)} PHT</div><div class="header"><img class="logo left" src="${esc(new URL('nisu_logo.png',window.location.href).href)}" alt="NISU"><img class="logo right" src="${esc(new URL('cics_logo.png',window.location.href).href)}" alt="CICS"><h2>NORTHERN ILOILO STATE UNIVERSITY</h2><p>Estancia, Iloilo</p><p>College of Information and Computing Studies</p><p>STUDENT ORGANIZATION FUNDS</p><p>OFFICE/PROGRAM: ICSSO</p></div><h3>FLAG UNPAID STUDENTS — PARTIALLY PAID AND UNPAID · AY ${esc(schoolYear)}</h3><table><colgroup><col style="width:24%"><col style="width:13%"><col style="width:13%"><col style="width:13%"><col style="width:14%"><col style="width:23%"></colgroup><thead><tr><th>Item / Category</th><th>Fee</th><th>Amount Paid</th><th>Remaining Balance</th><th>Status</th><th>Notes</th></tr></thead><tbody>${body}</tbody><tfoot><tr><td>GRAND TOTAL — ${groups.length} student(s), ${rows.length} category entries</td><td class="amount">₱ ${esc(formatAmount(totalFee/100))}</td><td class="amount">₱ ${esc(formatAmount(totalPaid/100))}</td><td class="amount">₱ ${esc(formatAmount(totalDue/100))}</td><td colspan="2"></td></tr></tfoot></table><div class="signatures">${signatures}</div></body></html>`;
}
function printArchiveStudentFlags() {
    if (getUserRole() !== 'admin' || !archiveRosterState.ready || archiveRosterState.loading) return;
    const status=document.getElementById('archiveRosterStatus');
    for (const field of document.querySelectorAll('#flagUnpaidBody input,#flagUnpaidBody select')) {
        if (!field.reportValidity()) {status.textContent='Complete the student names, sections and payment amounts before printing.';return;}
    }
    const rows=gatherUnpaidRows();
    if (!rows.length) {status.textContent='No partially paid or unpaid students to print.';return;}
    const sections=new Map(archiveRosterState.sections.map(section=>[section.item_key,section.label]));
    const entries=rows.map(row=>({...row,section_label:sections.get(row.item_key)||row.item_key}));
    const defaults=typeof window.getWorkspaceReportSignatories==='function' ? window.getWorkspaceReportSignatories('admin') : {prepared:{position:'Organization President'}};
    const html=buildArchiveFlagsPrintHtml(entries,window.__pendingArchiveYear || document.getElementById('fuYearLabel').textContent,defaults);
    const win=window.open('','_blank');
    if (!win) {status.textContent='Allow pop-ups, then select Print / Save as PDF again.';return;}
    win.document.open();win.document.write(html);win.document.close();
    const print=()=>{win.focus();win.print();};
    if (win.document.readyState==='complete') win.setTimeout(print,150);
    else win.addEventListener('load',print,{once:true});
}

// BEGIN TEMPORARY ADMIN COLLECTION RESET — remove this block and admin_collection_reset.php to retire.
function installAdminCollectionTestReset() {
    const panel=document.getElementById('adminPanelView');
    if (!panel || getUserRole()!=='admin' || document.getElementById('adminCollectionTestReset')) return;
    const card=document.createElement('div');
    card.id='adminCollectionTestReset';
    card.className='card bg-sub-panel border-danger mb-4 no-print';
    card.innerHTML='<div class="card-body p-4"><h5 class="text-danger">Temporary testing tools</h5><p>Reset current Collections totals, remarks, student payment lists, and current-cycle remittances. Sections, enrollment, fee settings, archived years, and expenditures are kept.</p><button type="button" class="btn btn-outline-danger">Reset Collections Test Data</button></div>';
    panel.querySelector('.page-head')?.after(card);
    card.querySelector('button').addEventListener('click',async function () {
        const button=this;button.disabled=true;
        try {
            const response=await fetch('admin_collection_reset.php',{cache:'no-store'});
            const preview=await response.json();
            if (!response.ok || preview.status!=='success') throw new Error(preview.message||'Unable to load reset preview.');
            const counts=preview.counts;
            let backupDownloaded=false;
            const result=await Swal.fire({
                title:'Reset Collections test data?',icon:'warning',
                html:`<p>${Number(counts.sections)} section total(s), ${Number(counts.student_entries)} student category entry/entries, and ${Number(counts.remittances)} current-cycle remittance(s) will be cleared.</p><p>Close other editing tabs before continuing. This cannot be undone from the app.</p><button type="button" id="downloadCollectionResetBackup" class="btn btn-outline-secondary mb-3">Download data backup</button><p>Type <strong>RESET COLLECTIONS</strong> to confirm.</p>`,
                input:'text',inputAttributes:{autocomplete:'off','aria-label':'Type RESET COLLECTIONS'},
                showCancelButton:true,confirmButtonText:'Reset Collections',confirmButtonColor:'#c0392b',focusConfirm:false,
                didOpen:()=>document.getElementById('downloadCollectionResetBackup').addEventListener('click',()=>{
                    const url=URL.createObjectURL(new Blob([JSON.stringify({exported_at:new Date().toISOString(),...preview.backup},null,2)],{type:'application/json'}));
                    const a=document.createElement('a');a.href=url;a.download='collections-before-test-reset-'+Date.now()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
                    backupDownloaded=true;document.getElementById('downloadCollectionResetBackup').textContent='Backup downloaded';
                }),
                inputValidator:value=>value!=='RESET COLLECTIONS'?'Type RESET COLLECTIONS exactly.':!backupDownloaded?'Download the data backup before resetting.':undefined,
                showLoaderOnConfirm:true,allowOutsideClick:()=>!Swal.isLoading(),
                preConfirm:async()=>{
                    try {
                        const reset=await fetch('admin_collection_reset.php',{method:'POST',headers:{'Content-Type':'application/json','X-App-CSRF':document.querySelector('meta[name="app-csrf"]')?.content||''},body:JSON.stringify({confirmation:'RESET COLLECTIONS',revision:preview.revision})});
                        const saved=await reset.json();
                        if(!reset.ok || saved.status!=='success') throw new Error(saved.message||'Reset failed.');
                        return saved;
                    } catch(error) {Swal.showValidationMessage(error.message);return false;}
                }
            });
            if(result.isConfirmed){await Swal.fire({icon:'success',title:'Collections reset',text:result.value.message});window.location.reload();}
        } catch(error) {await Swal.fire({icon:'error',title:'Unable to reset Collections',text:error.message});}
        finally {button.disabled=false;}
    });
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',installAdminCollectionTestReset);
else installAdminCollectionTestReset();
// END TEMPORARY ADMIN COLLECTION RESET

// The recovered-year editor shares the Admin navigation while retaining its own record scope.
function connectRecoveredWorkspace(frame) {
    if (getUserRole() !== 'admin' || !frame.getAttribute('src')) return;
    try {
        const doc = frame.contentDocument;
        const main = doc.querySelector('main.shell');
        if (!main) return;
        if (frame.recoveryResizeObserver) frame.recoveryResizeObserver.disconnect();
        const resize = () => {
            if (!frame.closest('.d-none')) frame.style.height = Math.ceil(main.getBoundingClientRect().height + 24) + 'px';
        };
        frame.recoveryResizeObserver = new ResizeObserver(resize);
        frame.recoveryResizeObserver.observe(main);
        resize();
        doc.getElementById('returnCurrent')?.addEventListener('click', event => {
            const blocked = event.defaultPrevented;
            event.preventDefault();
            if (!blocked) switchView('archives');
        });
    } catch (error) { console.error('Recovered workspace could not initialize:', error); }
}

function connectWorkspacePage(frame) {
    if (!frame.getAttribute('src')) return;
    try {
        const doc = frame.contentDocument;
        const main = doc.querySelector('main');
        if (!main) return;
        frame.workspaceResizeObserver?.disconnect();
        const resize = () => {
            if (!frame.closest('.d-none')) frame.style.height = Math.ceil(main.getBoundingClientRect().height + 24) + 'px';
        };
        frame.workspaceResizeObserver = new ResizeObserver(resize);
        frame.workspaceResizeObserver.observe(main);
        resize();
    } catch (error) { console.error('Workspace page could not initialize:', error); }
}
