/* Adds visual meaning to table columns. Does not change values or save records. */
(() => {
    'use strict';
    if (!document.body.hasAttribute('data-workspace-ui')) return;
    const classes = ['finance-received', 'finance-outstanding', 'finance-budget', 'finance-spent', 'finance-balance'];
    function kind(text, table) {
        const t = text.toLowerCase().replace(/\s+/g, ' ').trim();
        if (/^unpaid for$/.test(t)) return '';
        if (/total collectible/.test(t)) return 'budget';
        if (/collectibles?|outstanding|unpaid/.test(t)) return 'outstanding';
        if (/remaining budget|cash advance balance|net balance/.test(t)) return 'balance';
        if (/budget|allocated|allocation|expected/.test(t)) return 'budget';
        if (/disbursement|amount spent|spent|expenditure/.test(t) && !/description|item|date|reference/.test(t)) return 'spent';
        if (/collected|received|remitted|receipt amount|advances? received/.test(t) && !/\b(date|by|to|reference|number)\b|no\./.test(t)) return 'received';
        if (/^amount(?:\s*\([^)]*\))?$/.test(t)) {
            if (table.querySelector('#expenseRows,#disburseRows') || table.closest('#tab-expense,#tab-disburse')) return 'spent';
            if (table.querySelector('#collectionRows,#remittanceRows,#receiptRows')) return 'received';
        }
        if (/balance|remaining/.test(t)) return table.id === 'collectionsTable' || table.querySelector('#collectionHead') || /collected|collectible/i.test(table.tHead?.textContent || '') ? 'outstanding' : 'balance';
        return '';
    }
    function decorate(table) {
        const head = table.tHead;
        if (!head || head.rows.length !== 1) return; // Grouped report headers keep their own layout.
        const columns = [];
        for (const cell of head.rows[0].cells) {
            const type = kind(cell.textContent, table);
            cell.classList.remove(...classes);
            if (type) cell.classList.add('finance-' + type);
            for (let n = 0; n < cell.colSpan; n++) columns.push(type);
        }
        for (const group of [...table.tBodies, ...(table.tFoot ? [table.tFoot] : [])]) {
            for (const row of group.rows) {
                let index = 0;
                for (const cell of row.cells) {
                    const type = columns[index];
                    cell.classList.remove(...classes);
                    if (cell.colSpan === 1 && type) cell.classList.add('finance-' + type);
                    index += cell.colSpan;
                }
            }
        }

    }
    let queued = false;
    function refresh() {queued = false;document.querySelectorAll('table').forEach(decorate);}
    function schedule(records) {
        // Text-only totals updates need no structural refresh.
        const changed = records.some(record => [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === 1 && (node.matches('table,thead,tbody,tfoot,tr,th,td') || node.querySelector('table'))));
        if (changed && !queued) {queued = true;requestAnimationFrame(refresh);}
    }
    refresh();new MutationObserver(schedule).observe(document.body, {childList:true,subtree:true});
})();

// Shared authenticated workspace preferences; login pages never initialize this script.
(() => {
    if (!document.body?.hasAttribute('data-workspace-ui') || document.querySelector('script[data-workspace-settings]')) return;
    const script=document.createElement('script');script.src='settings.js?v=theme-sync-20261026';script.dataset.workspaceSettings='1';document.head.appendChild(script);
})();
