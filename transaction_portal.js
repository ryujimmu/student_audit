'use strict';
// Format visible program names without changing section IDs, option values or database keys.
function systemProgramLabel(value) {
    return String(value ?? '')
        .replace(/\b(?:Department\s+of|Bachelor\s+of\s+Science\s+in)\s+/gi, 'BS in ')
        .replace(/\bBS\s+in\s+Library\s+(?:of|and)\s+Information\s+Science\b/gi, 'BS in Library and Information Science');
}

/* Role-aware finance and audit workspace. Browser displays; PHP always enforces permissions. */
const page = document.body.dataset.page, role = document.body.dataset.role;
const csrf = document.querySelector('meta[name="csrf-token"]')?.content || ''; 
let state = {};
const money = v => '₱' + Number(v || 0).toLocaleString('en-PH', {minimumFractionDigits:2, maximumFractionDigits:2});
const esc = v => String(v ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const d = v => String(v || '').slice(0, 10);
function notify(message,success=false){const e=document.getElementById('alert');e.hidden=false;e.className='alert'+(success?' ok':'');e.textContent=message;e.scrollIntoView({behavior:'smooth',block:'nearest'});}
function option(value,label){return `<option value="${esc(value)}">${esc(label)}</option>`;}
function leafKeys(type){const items=state.structure?.[type] || [];
 return items.filter(x=>x.type===(type==='collections'?'in':'out')).map(x=>{
 const safe=String(x.name).toLowerCase().replace(/[^a-z0-9]/g,'-'); const key=x.parent?x.parent+'-'+safe:safe;
 const names=[x.name];let parent=x.parent;let count=0;
 while(parent&&count++<20){const node=items.find(y=>y.id===parent);if(!node)break;names.unshift(node.name);parent=node.parent;}
 return {key,label:names.map(systemProgramLabel).join(' / ')};
 });
}
function fill(id, list, first){const el=document.getElementById(id);if(!el)return;const before=el.value;el.innerHTML=(first??'')+list.map(x=>option(x.key??x.id,x.label??x.event_label)).join(''); if([...el.options].some(o=>o.value===before))el.value=before;}
function table(id,rows,empty='No records yet.'){const el=document.getElementById(id);if(el)el.innerHTML=rows.length?rows.join(''):`<tr><td colspan="12" style="color:#789">${esc(empty)}</td></tr>`;}
function stat(title,val){return `<div class="stat"><small>${esc(title)}</small><strong>${esc(val)}</strong></div>`;}
async function apiGet(url){const r=await fetch(url,{credentials:'same-origin',cache:'no-store'});let o;try{o=await r.json();}catch{throw new Error('Server did not return JSON. Check database migration / PHP error log.');}if(!r.ok||o.status==='error')throw new Error(o.message || `Request failed (${r.status})`);return o;}
async function load(){try{state=await apiGet(page==='treasurer'?'finance_ledger.php?action=overview':'audit_api.php');if(page==='treasurer')renderTreasurer();else renderAuditor();}catch(e){notify(e.message);}}
function wireTabs(){document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('.pane').forEach(x=>x.classList.toggle('active',x.id==='tab-'+b.dataset.tab));}));}
function setDates(){const now=new Date();let date=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10);document.querySelectorAll('.today').forEach(el=>el.value=date);}
function wireForms(){document.querySelectorAll('form').forEach(f=>f.addEventListener('submit',async ev=>{ev.preventDefault();if(!f.reportValidity())return;
 const btn=f.querySelector('button[type="submit"]');btn.disabled=true;
 try{
  let result;
  if(f.id==='form-receipt'||f.id==='form-review'){
   const form=new FormData(f);form.set('action',f.id==='form-receipt'?'upload_receipt':'review');form.set('csrf',csrf);
   const res=await fetch('audit_api.php',{method:'POST',body:form,credentials:'same-origin'});
   result=await res.json();if(!res.ok||result.status!=='success')throw new Error(result.message||'Unable to save audit record.');
  }else{
   const data=Object.fromEntries(new FormData(f));data.action=f.id.replace(/^form-/,'');
   const res=await fetch('finance_ledger.php',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(data),credentials:'same-origin'});
   result=await res.json();if(!res.ok||result.status!=='success')throw new Error(result.message||'Unable to save financial record.');
  }
  notify('Saved successfully. Transaction ID: '+result.id,true);
  f.reset();setDates();await load();
 }catch(e){notify(e.message)}finally{btn.disabled=false;}
}));}
function renderTreasurer(){
 fill('collectionSection',leafKeys('collections'),option('','Select section'));
 fill('collectionCategory',(state.categories||[]).map(x=>({key:x.id,label:`${x.name} · standard fee ${money(x.price)}`})),option('','Select category'));
 fill('expenseItem',leafKeys('expenditures'),option('','Choose expenditure item'));
 const advanceOpts=(state.advances||[]).filter(a=>a.archived_year===null).map(x=>({id:x.id,label:`CA-${x.id} · ${x.event_label} · available ${money(x.balance)}`}));
 fill('expenseAdvance',advanceOpts,option('','Not from a cash advance'));
 fill('movementAdvance',advanceOpts,option('','Select cash advance'));
 const cs=state.collections||[],es=state.expenditures||[],rems=state.remittances||[];
 document.getElementById('stats').innerHTML=stat('Collections in loaded history',money(cs.reduce((a,x)=>a+Number(x.amount),0)))+stat('Disbursements in loaded history',money(es.reduce((a,x)=>a+Number(x.amount),0)))+stat('Remittances in loaded history',String(rems.length));
 table('collectionRows',cs.map(x=>`<tr><td>${esc(x.date_received)}</td><td>${esc(systemProgramLabel(x.section_label))}<span class="minor">${esc(x.category_name)}</span></td><td>${esc(x.student_name||'—')}</td><td class="amount">${money(x.amount)}</td><td>${esc(x.encoded_at)}<span class="minor">${esc(x.recorded_by||'Treasurer')}</span></td></tr>`));
 table('remittanceRows',rems.map(x=>`<tr><td>${esc(x.date_remitted)}</td><td class="amount">${money(x.amount)}</td><td>${esc(x.remitted_to)}</td><td>${esc(x.reference_no||'—')}</td><td>${esc(x.encoded_at)}</td></tr>`));
 table('expenseRows',es.map(x=>`<tr><td>${esc(x.date_spent)}</td><td>${esc(x.event_label)}</td><td>${esc(x.payee)}<span class="minor">${esc(x.nature)}</span></td><td>${esc(x.voucher_no||'—')}</td><td class="amount">${money(x.amount)}</td><td>${esc(x.encoded_at)}</td></tr>`));
 table('advanceRows',(state.advances||[]).map(x=>`<tr><td>${esc(x.event_label)}<span class="minor">CA-${esc(x.id)}</span></td><td class="amount">${money(x.balance)}</td><td>${esc(x.created_at)}</td></tr>`));
 document.querySelectorAll('form').forEach(form=>{
  const allowed=form.id==='form-expense'?role==='admin':role==='treasurer';
  form.querySelectorAll('input,select,textarea,button').forEach(e=>e.disabled=!allowed);
 });
 const params=new URLSearchParams(location.search);const tab=params.get('tab');if(tab){const el=document.querySelector(`[data-tab="${CSS.escape(tab==='collections'?'collection':tab==='expenditures'?'expense':tab)}"]`);el?.click();}
 const section=params.get('section');if(section){const select=document.getElementById('collectionSection');if([...select.options].some(o=>o.value===section))select.value=section;}
}
function statusOf(x){return x.decision||'pending';}
function statusChip(x){const s=statusOf(x);return `<span class="status ${esc(s)}">${esc(s)}</span>`;}
function renderAuditor(){
 const expenses=state.expenditures||[],receipts=state.receipts||[],reviews=state.reviews||[],advances=state.advances||[];
 const pending=expenses.filter(e=>!e.decision).length,discrepancy=expenses.filter(e=>e.decision==='discrepancy').length;
 document.getElementById('stats').innerHTML=stat('Pending receipt reviews',String(pending))+stat('Verified expenditures',String(expenses.filter(e=>e.decision==='verified').length))+stat('Flagged discrepancies',String(discrepancy));
 const expOpts=expenses.map(x=>({id:x.id,label:`EXP-${x.id} · ${x.event_label} · ${money(x.amount)} · ${x.payee}`}));
 fill('receiptExpenditure',expOpts,option('','Select an expenditure'));
 fill('reviewExpenditure',expOpts,option('','Select an expenditure'));
 const filter=document.getElementById('auditAdvanceFilter');const prior=filter.value;filter.innerHTML=option('all','All cash advances')+option('unlinked','Expenses without cash advance')+advances.map(x=>option(x.id,`CA-${x.id} · ${x.event_label}`)).join('');if([...filter.options].some(o=>o.value===prior))filter.value=prior;
 table('receiptRows',receipts.map(r=>`<tr><td><strong>${esc(r.or_number)}</strong></td><td>EXP-${esc(r.expenditure_id)}</td><td>${esc(r.receipt_date)}</td><td class="amount">${money(r.receipt_amount)}</td><td>${esc(r.uploaded_at)}<span class="minor">${esc(r.uploaded_by||'Auditor')}</span></td><td><a href="audit_file.php?id=${encodeURIComponent(r.id)}">Download proof</a></td></tr>`));
 table('reviewRows',reviews.map(r=>`<tr><td>${esc(r.reviewed_at)}</td><td>EXP-${esc(r.expenditure_id)}</td><td><span class="status ${esc(r.decision)}">${esc(r.decision)}</span></td><td>${esc(r.finding||'—')}</td><td>${esc(r.reviewed_by||'Auditor')}</td></tr>`));
 renderDisbursements();updateEvidence();
 const tab=new URLSearchParams(location.search).get('tab');if(tab){document.querySelector(`[data-tab="${tab==='receipts'?'receipts':tab==='findings'?'findings':'disburse'}"]`)?.click();}
 if(role!=='auditor'){document.querySelectorAll('form input,form select,form textarea,form button').forEach(e=>e.disabled=true);notify('Admin has oversight access; only the Auditor can upload OR receipts and submit audit reviews.');}
}
function updateEvidence(){const id=document.getElementById('reviewExpenditure')?.value;const div=document.getElementById('reviewEvidence');if(!div)return;const e=(state.expenditures||[]).find(x=>String(x.id)===id);if(!e){div.textContent='Select an expenditure to inspect its supporting receipts.';return;}
 const rs=(state.receipts||[]).filter(r=>String(r.expenditure_id)===id),total=rs.reduce((a,r)=>a+Number(r.receipt_amount),0);
 div.innerHTML=`<strong>Admin disbursement:</strong> ${money(e.amount)}<br><strong>Supporting ORs:</strong> ${rs.length} receipt(s) · ${money(total)}<br><strong>Difference:</strong> ${money(Number(e.amount)-total)}<br><strong>Current finding:</strong> ${statusChip(e)}`;
}
function orderedCashRows(groupId){
 const expenses=(state.expenditures||[]).filter(x=>String(x.cash_advance_id||'')===String(groupId));
 const moves=(state.movements||[]).filter(x=>String(x.cash_advance_id)===String(groupId));
 const result=[...moves.map(m=>({date:m.event_date,id:Number(m.id),type:m.movement,amount:Number(m.amount),move:m})),...expenses.map(e=>({date:e.date_spent,id:Number(e.id),type:'expense',amount:Number(e.amount),exp:e}))];
 result.sort((a,b)=>a.date.localeCompare(b.date)||(a.type==='expense'?1:0)-(b.type==='expense'?1:0)||a.id-b.id);
 let balance=0;
 return result.map(item=>{if(item.type==='advance')balance+=item.amount;else balance-=item.amount;return {...item,balance};});
}
function renderDisbursements(){
 const filter=document.getElementById('auditAdvanceFilter')?.value||'all';const groups=(state.advances||[]).filter(g=>filter==='all'||String(g.id)===filter);
 const result=[];
 for(const g of groups){result.push(`<tr class="row-muted"><td colspan="9"><strong>CA-${esc(g.id)} · ${esc(g.event_label)}</strong> · ${esc(g.purpose||'Cash advance liquidation')}</td></tr>`);
  for(const x of orderedCashRows(g.id)){
   if(x.type==='expense'){
     const e=x.exp,rs=(state.receipts||[]).filter(r=>String(r.expenditure_id)===String(e.id));
     result.push(`<tr><td>${esc(x.date)}</td><td>${esc(e.voucher_no||'—')}</td><td>${rs.length?rs.map(r=>`<a href="audit_file.php?id=${encodeURIComponent(r.id)}">${esc(r.or_number)}</a>`).join(', '):'<span class="status pending">No OR attached</span>'}</td><td>${esc(e.payee)}</td><td>${esc(e.nature)}</td><td>—</td><td class="amount">${money(e.amount)}</td><td class="amount">${money(x.balance)}</td><td>${statusChip(e)}</td></tr>`);
   }else{result.push(`<tr><td>${esc(x.date)}</td><td>${esc(x.move.reference_no||'—')}</td><td>—</td><td>—</td><td>${x.type==='advance'?'Cash advance received':'Unused cash refunded'}</td><td class="amount">${x.type==='advance'?'+':'−'}${money(x.amount)}</td><td>—</td><td class="amount">${money(x.balance)}</td><td><span class="status pending">Treasurer entry</span></td></tr>`);}
  }
 }
 if(filter==='all'||filter==='unlinked'){
  result.push('<tr class="row-muted"><td colspan="9"><strong>Expenses not linked to a cash advance</strong> · listed for audit only</td></tr>');
  for(const e of (state.expenditures||[]).filter(e=>!e.cash_advance_id)){
   const rs=(state.receipts||[]).filter(r=>String(r.expenditure_id)===String(e.id));
   result.push(`<tr><td>${esc(e.date_spent)}</td><td>${esc(e.voucher_no||'—')}</td><td>${rs.length?rs.map(r=>`<a href="audit_file.php?id=${encodeURIComponent(r.id)}">${esc(r.or_number)}</a>`).join(', '):'<span class="status pending">No OR attached</span>'}</td><td>${esc(e.payee)}</td><td>${esc(e.nature)}</td><td>—</td><td class="amount">${money(e.amount)}</td><td>Not applicable</td><td>${statusChip(e)}</td></tr>`);
  }
 }
 table('disbursementRows',result,'No cash advance or expenditure records found.');
}
function csv(rows,filename){const clean=s=>'"'+String(s??'').replace(/"/g,'""').replace(/^[=+@\-\t\r]/,'\'$&')+'"';const blob=new Blob(['\ufeff'+rows.map(r=>r.map(clean).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
function exportData(which){let data=[];
 if(which==='collections')data=[['Date received','Section / Program','Category','Student','Amount','Encoded at','Treasurer'],...(state.collections||[]).map(x=>[x.date_received,systemProgramLabel(x.section_label),x.category_name,x.student_name,x.amount,x.encoded_at,x.recorded_by])];
 if(which==='remittances')data=[['Date remitted','Amount','Remitted to','Reference','Encoded at'],...(state.remittances||[]).map(x=>[x.date_remitted,x.amount,x.remitted_to,x.reference_no,x.encoded_at])];
 if(which==='expenditures')data=[['Date spent','Event','Payee','Nature','Voucher','Amount','Cash advance','Encoded at'],...(state.expenditures||[]).map(x=>[x.date_spent,x.event_label,x.payee,x.nature,x.voucher_no,x.amount,x.cash_advance_id,x.encoded_at])];
 if(which==='receipts')data=[['OR / Receipt','Expense ID','Date','Amount','Issuer','Uploaded at'],...(state.receipts||[]).map(x=>[x.or_number,x.expenditure_id,x.receipt_date,x.receipt_amount,x.merchant,x.uploaded_at])];
 if(which==='reviews')data=[['Reviewed at','Expense ID','Decision','Finding','Auditor'],...(state.reviews||[]).map(x=>[x.reviewed_at,x.expenditure_id,x.decision,x.finding,x.reviewed_by])];
 if(data.length)csv(data,which+'-nisu.csv');
}
function exportDisbursement(){const trs=[...document.querySelectorAll('#tab-disburse table tr')];csv(trs.map(tr=>[...tr.querySelectorAll('th,td')].map(td=>td.innerText.trim())), 'cash-disbursement-OR-register.csv');}
document.addEventListener('DOMContentLoaded',()=>{wireTabs();wireForms();setDates();load();
 document.querySelectorAll('[data-export]').forEach(b=>b.addEventListener('click',()=>exportData(b.dataset.export)));
 document.getElementById('reviewExpenditure')?.addEventListener('change',updateEvidence);
 document.getElementById('auditAdvanceFilter')?.addEventListener('change',renderDisbursements);
 document.getElementById('csvDisbursement')?.addEventListener('click',exportDisbursement);
 document.getElementById('printDisbursement')?.addEventListener('click',()=>window.print());
});
