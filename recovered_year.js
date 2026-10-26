'use strict';
const ryRole=document.body.dataset.role;
const ryToken=document.querySelector('meta[name="app-csrf"]').content;
let ryYear='',ryRevision=0,ryData=null,ryDirty=false,ryBusy=false,ryGeneration=0;
const ryEl=id=>document.getElementById(id);
const ryEsc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ryLabel=v=>String(v??'').replace(/\b(?:Department\s+of|Bachelor\s+of\s+Science\s+in)\s+/gi,'BS in ').replace(/\bBS\s+in\s+Library\s+(?:of|and)\s+Information\s+Science\b/gi,'BS in Library and Information Science');
const ryMoney=c=>'₱ '+(c/100).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2});
function ryCents(value){if(!/^\d{1,10}(?:\.\d{1,2})?$/.test(String(value)))throw Error('Use non-negative amounts with at most two decimals.');return Math.round(Number(value)*100);}
function ryStatus(message,error=false){ryEl('status').textContent=message;ryEl('status').className='status'+(error?' error':'');}
function ryMarkDirty(){ryDirty=true;ryEl('dirtyStatus').textContent='Unsaved changes';ryEl('dirtyStatus').className='draft';}
function ryCanLeave(){return !ryBusy&&(!ryDirty||confirm('Discard unsaved changes to this recovered year?'));}
function ryControls(busy){ryBusy=busy;document.querySelectorAll('button,input,textarea,select').forEach(el=>{if(busy){el.dataset.wasDisabled=el.disabled?'1':'0';el.disabled=true;}else if(el.dataset.wasDisabled!==undefined){el.disabled=el.dataset.wasDisabled==='1';delete el.dataset.wasDisabled;}});}
async function ryRequest(payload){const response=await fetch('recovery_api.php',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-App-CSRF':ryToken},body:JSON.stringify(payload)});const data=await response.json();if(!response.ok||data.status!=='success')throw Error(data.message||'The request failed.');return data;}
async function ryLoadYears(){const response=await fetch('recovery_api.php?action=list',{cache:'no-store',credentials:'same-origin'});const data=await response.json();if(!response.ok||data.status!=='success')throw Error(data.message||'Could not load recovered years.');ryEl('yearSelect').innerHTML='<option value="">Select a recovered year…</option>'+data.years.map(row=>`<option value="${ryEsc(row.school_year)}">${ryEsc(row.school_year)}</option>`).join('');}
async function ryLoad(year){
 if(!/^\d{4}-\d{4}$/.test(year)){ryStatus('Select a recovered year.');return;}
 const generation=++ryGeneration;ryControls(true);ryStatus('Loading recovered year…');
 try{const response=await fetch('recovery_api.php?year='+encodeURIComponent(year),{cache:'no-store',credentials:'same-origin'});const result=await response.json();if(generation!==ryGeneration)return;if(!response.ok||result.status!=='success')throw Error(result.message||'Could not load recovered year.');
  ryYear=year;ryRevision=result.revision;ryData=result.data;ryDirty=false;ryEl('yearSelect').value=year;
  const url=new URL(location.href);url.searchParams.set('year',year);history.replaceState(null,'',url);
  ryRender(result);ryStatus('Recovered '+year+' loaded.');
 }catch(error){ryStatus(error.message,true);}finally{if(generation===ryGeneration)ryControls(false);}
}
function ryInput(value,attrs='',cls='amount'){return `<input class="${cls}" value="${ryEsc(value??'')}" ${attrs}>`;}
function ryRender(result){
 ryEl('workspace').hidden=false;ryEl('empty').hidden=true;ryEl('yearBanner').textContent='RECOVERED YEAR: '+ryYear;ryEl('printTitle').textContent='Recovered School Year '+ryYear;
 ryEl('sourceMeta').textContent='Recovered by '+result.recovered_by+' on '+result.recovered_at+'. Revision '+ryRevision+'.';
 ryEl('limitations').innerHTML=(ryData.limitations||[]).map(text=>`<div class="limitation">${ryEsc(text)}</div>`).join('');
 ryEl('dirtyStatus').textContent='Saved';ryEl('dirtyStatus').className='muted';ryEl('reason').value='';
 ryEl('saveYear').hidden=!['admin','treasurer'].includes(ryRole);ryEl('setupPanel').hidden=ryRole!=='admin';ryEl('reasonPanel').hidden=ryRole!=='treasurer';
 document.querySelectorAll('.admin-only').forEach(el=>el.hidden=ryRole!=='admin');
 ryEl('collectionHint').textContent=ryRole==='treasurer'?'Edit this recovered year’s collected amounts, then save with an explanation.':ryRole==='admin'?'Edit section labels and student counts for this recovered copy. Collected amounts are retained from the saved archive.':'Recovered financial monitoring. Treasurer manages the financial figures; Admin manages setup and budgets.';
 ryEl('collectionHead').innerHTML='<tr><th>Section / Program</th><th>Students</th>'+ryData.categories.map(cat=>`<th class="money">${ryEsc(cat.name)}</th>`).join('')+'<th class="money">Collected</th><th class="money">Expected</th><th class="money">Balance</th></tr>';
 ryEl('collectionRows').innerHTML=ryData.collections.map((row,i)=>`<tr data-collection="${i}"><td>${ryRole==='admin'?ryInput(ryLabel(row.label),'data-label type="text" maxlength="600"','label'):ryEsc(ryLabel(row.label))}</td><td>${ryRole==='admin'?ryInput(row.students,'data-students type="number" min="0" max="100000" placeholder="Unknown"','count'):(row.students??'<span class="unknown">Unknown</span>')}</td>${ryData.categories.map((cat,c)=>`<td class="money">${ryRole==='treasurer'?ryInput(row.amounts?.[cat.id]??'0.00',`data-amount="${c}" type="number" min="0" step="0.01"`):ryMoney(ryCents(row.amounts?.[cat.id]??'0'))}</td>`).join('')}<td class="money" data-col-total></td><td class="money" data-expected></td><td class="money" data-col-balance></td></tr>`).join('')||`<tr><td colspan="${ryData.categories.length+5}">No recovered collection rows.</td></tr>`;
 ryEl('expenseRows').innerHTML=ryData.expenditures.map((row,i)=>`<tr data-expense="${i}"><td>${ryRole==='admin'?ryInput(ryLabel(row.label),'data-label type="text" maxlength="600"','label'):ryEsc(ryLabel(row.label))}</td><td class="money">${ryRole==='admin'?ryInput(row.budget,'data-budget type="number" min="0" step="0.01"'):ryMoney(ryCents(row.budget))}</td><td class="money">${ryRole==='treasurer'?ryInput(row.amount,'data-spent type="number" min="0" step="0.01"'):ryMoney(ryCents(row.amount))}</td><td class="money" data-exp-balance></td></tr>`).join('')||'<tr><td colspan="4">No recovered expenditure rows.</td></tr>';
 if(ryRole==='admin')ryEl('categoryRows').innerHTML=ryData.categories.map((cat,i)=>{
  const children=ryData.subcategories?.[cat.id]||[];
  return `<div class="category-card" data-category="${i}"><div class="category-main">${ryInput(cat.name,'data-cat-name type="text" maxlength="200"','label')}${ryInput(cat.price,'data-cat-price type="number" min="0" step="0.01" placeholder="Unknown"')}<small>Main fee</small></div><div class="sub-list">${children.map(rySubRow).join('')}</div><button type="button" class="secondary" data-add-sub="${i}">+ Admin-only Subcategory</button></div>`;
 }).join('');
 const sections=new Map(ryData.collections.map(row=>[row.key,ryLabel(row.label)]));
 ryEl('unpaidRows').innerHTML=(ryData.unpaid_students||[]).map(row=>`<tr><td>${ryEsc(row.student_name)}</td><td>${ryEsc(sections.get(row.item_key)||row.item_key)}</td><td>${ryEsc(row.category_name||row.category_key||'General')}</td>${['fee_amount','amount_paid','balance_due'].map(key=>`<td class="money">${row[key]===null||row[key]===undefined?'—':ryMoney(Math.round(Number(row[key])*100))}</td>`).join('')}<td>${Number(row.is_settled)===1?'Settled':'Unpaid'}</td></tr>`).join('')||'<tr><td colspan="7">No student-name roster was saved for this year.</td></tr>';
 const hist=ryData.history||{};
 ryEl('historyRows').innerHTML=ryHistoryTable('Dated collection records',hist.collections||[],[['date_received','Date'],['section_label','Section / Program'],['category_name','Category'],['student_name','Student'],['amount','Amount']])+ryHistoryTable('Dated expenditure records',hist.expenditures||[],[['date_spent','Date'],['event_label','Item Description'],['payee','Payee'],['amount','Amount']])+ryHistoryTable('Daily remittances',hist.remittances||[],[['date_remitted','Date'],['section_label','Section / Program'],['remitted_by','From'],['received_by','To'],['amount','Amount']])+ryHistoryTable('Archived late payments',ryData.late_payments||[],[['student_name','Student'],['category_name','Category'],['amount','Amount'],['processed_by','Recorded By']]);
 ryEl('activityRows').innerHTML=result.activity.map(row=>`<tr><td>${ryEsc(row.recorded_at)}</td><td>${ryEsc(row.username)}</td><td>${ryEsc(row.actor_role)}</td><td>${ryEsc(row.action)}</td><td>${ryEsc(row.summary)}</td></tr>`).join('')||'<tr><td colspan="5">No changes recorded.</td></tr>';
 ryPreview();
}
function rySubRow(child){return `<div class="subrow">${ryInput(child.name,'data-sub-name type="text" maxlength="200"','label')}${ryInput(child.price,'data-sub-price type="number" min="0" step="0.01"')}<button type="button" class="secondary" data-remove-sub>Remove</button></div>`;}
function ryHistoryTable(title,rows,columns){return `<details><summary>${ryEsc(title)} (${rows.length})</summary><div class="table-wrap"><table class="history-table"><thead><tr>${columns.map(([,name])=>`<th>${ryEsc(name)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${columns.map(([key])=>`<td>${ryEsc(key==='section_label'?ryLabel(row[key]):row[key]??'—')}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${columns.length}">No dated records were available in the source archive.</td></tr>`}</tbody></table></div></details>`;}
function ryCategoryValues(){return ryData.categories.map((cat,i)=>{
 const element=document.querySelector(`[data-category="${i}"]`);if(!element)return {...cat};
 const children=[...element.querySelectorAll('.subrow')].map(row=>({name:row.querySelector('[data-sub-name]').value.trim(),price:row.querySelector('[data-sub-price]').value}));
 const field=element.querySelector('[data-cat-price]');field.readOnly=children.length>0;
 let price=field.value===''?null:field.value;
 if(children.length){price=(children.reduce((sum,child)=>sum+ryCents(child.price),0)/100).toFixed(2);field.value=price;}
 return {id:cat.id,name:element.querySelector('[data-cat-name]').value.trim(),price,children};
 });}
function ryPreview(){
 if(!ryData)return;
 try{
  const cats=ryCategoryValues();let received=0,spent=0;
  document.querySelectorAll('[data-collection]').forEach(el=>{const row=ryData.collections[Number(el.dataset.collection)];const countInput=el.querySelector('[data-students]');const students=countInput?(countInput.value===''?null:Number(countInput.value)):row.students;let total=0,expected=students===null?null:0;
   cats.forEach((cat,c)=>{const input=el.querySelector(`[data-amount="${c}"]`);total+=ryCents(input?input.value:row.amounts?.[cat.id]??'0');if(expected!==null){if(cat.price===null)expected=null;else expected+=students*ryCents(cat.price);}});
   received+=total;el.querySelector('[data-col-total]').textContent=ryMoney(total);el.querySelector('[data-expected]').textContent=expected===null?'Unknown':ryMoney(expected);el.querySelector('[data-col-balance]').textContent=expected===null?'Unknown':ryMoney(expected-total);
  });
  document.querySelectorAll('[data-expense]').forEach(el=>{const row=ryData.expenditures[Number(el.dataset.expense)];const amount=ryCents(el.querySelector('[data-spent]')?.value??row.amount),budget=ryCents(el.querySelector('[data-budget]')?.value??row.budget);spent+=amount;const cell=el.querySelector('[data-exp-balance]');cell.textContent=ryMoney(budget-amount);cell.classList.toggle('bad',budget<amount);});
  ryEl('totalCollections').textContent=ryMoney(received);ryEl('totalExpenses').textContent=ryMoney(spent);ryEl('netBalance').textContent=ryMoney(received-spent);
 }catch(error){ryStatus(error.message,true);}
}
function rySavePayload(){
 const common={year:ryYear,revision:ryRevision};
 if(ryRole==='admin'){
  const cats=ryCategoryValues(),subcategories=Object.create(null);
  cats.forEach(cat=>{if(cat.children?.length)subcategories[cat.id]=cat.children;});
  return {...common,action:'save_setup',categories:cats.map(({id,name,price})=>({id,name,price})),subcategories,
   collections:[...document.querySelectorAll('[data-collection]')].map(el=>({key:ryData.collections[Number(el.dataset.collection)].key,label:el.querySelector('[data-label]').value.trim(),students:el.querySelector('[data-students]').value===''?null:Number(el.querySelector('[data-students]').value)})),
   expenditures:[...document.querySelectorAll('[data-expense]')].map(el=>({key:ryData.expenditures[Number(el.dataset.expense)].key,label:el.querySelector('[data-label]').value.trim(),budget:el.querySelector('[data-budget]').value}))};
 }
 if(ryRole==='treasurer')return {...common,action:'save_financials',reason:ryEl('reason').value.trim(),collections:[...document.querySelectorAll('[data-collection]')].map(el=>{const amounts=Object.create(null);el.querySelectorAll('[data-amount]').forEach(input=>{amounts[ryData.categories[Number(input.dataset.amount)].id]=input.value;});return {key:ryData.collections[Number(el.dataset.collection)].key,amounts};}),expenditures:[...document.querySelectorAll('[data-expense]')].map(el=>({key:ryData.expenditures[Number(el.dataset.expense)].key,amount:el.querySelector('[data-spent]').value}))};
 throw Error('Auditor has monitoring access.');
}
async function rySave(){if(ryBusy||!ryData)return;let payload;try{payload=rySavePayload();}catch(error){ryStatus(error.message,true);return;}ryControls(true);ryStatus('Saving recovered year '+ryYear+'…');let saved=false;try{const result=await ryRequest(payload);ryRevision=result.revision;ryDirty=false;saved=true;}catch(error){ryStatus(error.message,true);}finally{ryControls(false);}if(saved)await ryLoad(ryYear);}
async function ryAdd(action){if(ryRole!=='admin'||!ryCanLeave())return;const label=prompt(action==='add_section'?'Section / program name':action==='add_item'?'Event / item description':'Fee category name');if(!label?.trim())return;ryControls(true);let saved=false;try{await ryRequest({year:ryYear,revision:ryRevision,action,label:label.trim()});ryDirty=false;saved=true;}catch(error){ryStatus(error.message,true);}finally{ryControls(false);}if(saved)await ryLoad(ryYear);}
ryEl('workspace').addEventListener('input',event=>{if(event.target.matches('input,textarea')){ryMarkDirty();ryStatus('Unsaved changes in recovered '+ryYear+'.');ryPreview();}});
ryEl('workspace').addEventListener('click',event=>{const add=event.target.closest('[data-add]');if(add){ryAdd(add.dataset.add);return;}const sub=event.target.closest('[data-add-sub]');if(sub&&ryRole==='admin'){const list=sub.closest('.category-card').querySelector('.sub-list');if(list.children.length>=50){ryStatus('Use at most 50 subcategories.',true);return;}list.insertAdjacentHTML('beforeend',rySubRow({name:'',price:'0.00'}));ryMarkDirty();ryPreview();}const remove=event.target.closest('[data-remove-sub]');if(remove&&ryRole==='admin'){remove.closest('.subrow').remove();ryMarkDirty();ryPreview();}});
ryEl('openYear').addEventListener('click',()=>{if(ryCanLeave())ryLoad(ryEl('yearSelect').value);});
ryEl('reloadYear').addEventListener('click',()=>{if(ryCanLeave())ryLoad(ryYear||ryEl('yearSelect').value);});
ryEl('saveYear').addEventListener('click',rySave);
ryEl('printYear').addEventListener('click',()=>{if(ryDirty){ryStatus('Save the recovered-year changes before printing.',true);return;}window.print();});
ryEl('returnCurrent').addEventListener('click',event=>{if(!ryCanLeave())event.preventDefault();});
window.addEventListener('beforeunload',event=>{if(ryDirty||ryBusy){event.preventDefault();event.returnValue='';}});
(async()=>{try{await ryLoadYears();const year=new URLSearchParams(location.search).get('year');if(year)await ryLoad(year);}catch(error){ryStatus(error.message,true);}})();
