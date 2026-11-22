'use strict';
// Additional fictional Colleague-inspired self-service categories.
document.addEventListener('DOMContentLoaded',()=>{
 const $=id=>document.getElementById(id);
 const tabs=document.querySelector('.acadia-tabs');
 const adminTabs=$('acadia-admin-dashboard')?.querySelector('[data-admin-tab]')?.parentElement;
 if(!tabs)return;
 const make=(tag,parent,label)=>{const e=document.createElement(tag);if(label!==undefined)e.textContent=label;parent.append(e);return e};
 const money=c=>new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(Number(c)/100);
 async function api(path,method='GET',body){const r=await fetch('/api/school/services'+path,{method,credentials:'same-origin',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'HTTP '+r.status);return d}
 const studentTabs=[['planning','Student Planning'],['catalog','Course Catalog'],['banking','Banking Information'],['verification','Enrollment Verifications'],['transcripts','Transcript Requests'],['attendance','Academic Attendance']];
 const studentPanels={};
 for(const [id,title] of studentTabs){const b=make('button',tabs,title);b.type='button';b.dataset.tab=id;const p=make('div',$('acadia-courses').parentElement);p.id='acadia-'+id;p.className='content-panel school-service-panel';p.hidden=true;studentPanels[id]=p}
 // app.js handles its original tabs. New tabs use the same show/hide behavior.
 const allTabs=['courses','grades','schedule','finance','profile','graduation','degree',...studentTabs.map(x=>x[0])];
 for(const [id] of studentTabs){tabs.querySelector(`[data-tab="${id}"]`).addEventListener('click',()=>{for(const name of allTabs){const p=$('acadia-'+name);if(p)p.hidden=name!==id}tabs.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));void loadStudent()})}
 function title(panel,text){make('h3',panel,text)}
 function requestForm(panel,kind,label,placeholder){title(panel,label);const input=make('textarea',panel);input.rows=3;input.placeholder=placeholder;const button=make('button',panel,'Submit request');button.type='button';const status=make('p',panel);button.addEventListener('click',async()=>{button.disabled=true;try{const r=await api('/requests','POST',{kind,details:input.value});status.textContent=r.message;input.value='';await loadStudent()}catch(e){status.textContent=e.message}finally{button.disabled=false}})}
 requestForm(studentPanels.banking,'banking_update','Banking Information','Describe the fictional banking information update requested. Do not enter real bank account numbers.');
 requestForm(studentPanels.verification,'enrollment_verification','Enrollment Verification','State the term and purpose of the enrollment letter.');
 requestForm(studentPanels.transcripts,'transcript','Transcript Requests','State the terms and purpose of the transcript request.');
 // Add request widgets to existing graduation and degree sections without modifying their original controls.
 const grad=make('section',$('acadia-graduation'));grad.className='school-upgrade';requestForm(grad,'graduation','Graduation application (simulated)','Proposed graduation term and any comments');
 const degree=make('section',$('acadia-degree'));degree.className='school-upgrade';requestForm(degree,'degree','Degree/program change request','Requested degree/program and reason');
 const history=make('div',studentPanels.verification);history.className='school-service-history';
 const attendance=studentPanels.attendance;title(attendance,'Academic Attendance');const attendanceList=make('div',attendance);
 title(studentPanels.catalog,'Course Catalog');make('p',studentPanels.catalog,'Select a course in the existing Courses tab to register. Course tuition is $3,000 per registration.');const catalogList=make('div',studentPanels.catalog);
 title(studentPanels.planning,'Student Planning');make('p',studentPanels.planning,'Plan your term using the available course offerings. Registration is completed in Courses; selected courses appear below.');const planList=make('div',studentPanels.planning);
 const profile=$('acadia-profile');const requestHistory=make('section',profile);requestHistory.className='school-upgrade';title(requestHistory,'Self-Service Request History');const requestList=make('div',requestHistory);
 const profileRequests=$('school-profile-requests');
 async function loadStudent(){try{const [summary,requests,cat]=await Promise.all([api('/summary'),api('/requests'),fetch('/api/school/catalog',{credentials:'same-origin'}).then(r=>r.ok?r.json():{catalog:[]})]);
  catalogList.replaceChildren();for(const c of cat.catalog||[])make('p',catalogList,`${c.code} — ${c.title} · ${c.term} · ${c.weekday} ${String(c.start_time).slice(0,5)} · $3,000`);
  planList.replaceChildren();make('h4',planList,'Registered course sections');if(!summary.enrollments.length)make('p',planList,'No new course registrations yet.');for(const e of summary.enrollments)make('p',planList,`${e.code} — ${e.term} · ${e.weekday} ${String(e.start_time).slice(0,5)}`);
  make('h4',planList,'Existing academic record');for(const e of summary.legacy)make('p',planList,`${e.code} — ${e.title} (${e.term})`);
  attendanceList.replaceChildren();if(!summary.attendance.length)make('p',attendanceList,'No attendance has been entered by an administrator.');for(const a of summary.attendance)make('p',attendanceList,`${a.code} · ${a.session_date?.slice(0,10)} · ${a.status}`);
  requestList.replaceChildren();for(const r of requests.requests)make('p',requestList,`${r.kind.replaceAll('_',' ')} — ${r.status}${r.admin_note?' · '+r.admin_note:''}`);
  // Student Finance summary stays on the existing Finance tab and uses its live bank-linked balance.
  const feeBox=$('school-services-fees');if(feeBox){feeBox.replaceChildren();make('h4',feeBox,'Other fees (illustrative definitions; not yet charged)');for(const f of summary.feeDefinitions)make('p',feeBox,`${f.label}: ${money(f.amount_cents)}`)}
 }catch(e){console.warn('School services unavailable:',e.message)}}
 // Finance panel is frequently rerendered by app.js; attach fees after each academic refresh.
 const oldRefresh=window.refreshAcademicEnhancements;
 window.refreshAcademicEnhancements=async()=>{if(typeof oldRefresh==='function')await oldRefresh();if(!$('school-services-fees')){const box=make('section',$('acadia-finance'));box.id='school-services-fees';box.className='school-upgrade'}await loadStudent()};
 // Admin service management.
 const adminNav=$('acadia-admin-dashboard')?.querySelector('.acadia-tabs')||adminTabs;
 const adminRoot=$('admin-students')?.parentElement;
 if(adminNav&&adminRoot){const btn=make('button',adminNav,'Student Services');btn.type='button';btn.dataset.adminTab='services';const panel=make('div',adminRoot);panel.id='admin-services';panel.className='content-panel';panel.hidden=true;
  title(panel,'Student Service Requests');const reqs=make('div',panel);
  title(panel,'Academic Attendance');const select=make('select',panel);const date=make('input',panel);date.type='date';const status=make('select',panel);for(const s of ['present','absent','excused']){const opt=make('option',status,s);opt.value=s}const attendanceSave=make('button',panel,'Save attendance');attendanceSave.type='button';const attMsg=make('p',panel);
  attendanceSave.addEventListener('click',async()=>{try{const r=await api('/admin/attendance','POST',{enrollmentId:Number(select.value),date:date.value,status:status.value});attMsg.textContent=r.message}catch(e){attMsg.textContent=e.message}});
  title(panel,'Post a fee to Student Finance');make('p',panel,'Posts an additional fee once per student, fee type, and term. The charge appears in the existing bank-linked tuition balance.');const studentId=make('input',panel);studentId.type='number';studentId.min='1';studentId.placeholder='Simulator student numeric ID (e.g., 36)';const feeId=make('input',panel);feeId.type='number';feeId.min='1';feeId.placeholder='Fee ID (see list below)';const feeTerm=make('input',panel);feeTerm.placeholder='Fall 2026';const postFee=make('button',panel,'Post fee to student account');postFee.type='button';const postMsg=make('p',panel);postFee.addEventListener('click',async()=>{try{const r=await api('/admin/charge-fee','POST',{studentId:Number(studentId.value),feeId:Number(feeId.value),term:feeTerm.value});postMsg.textContent=r.message}catch(e){postMsg.textContent=e.message}});const feeList=make('div',panel);
  title(panel,'Other Fee Definitions');make('p',panel,'These are illustrative fee definitions. Saving them does not post charges to student balances.');const feeName=make('input',panel);feeName.placeholder='Fee name';const feeAmount=make('input',panel);feeAmount.type='number';feeAmount.min='0';feeAmount.step='0.01';feeAmount.placeholder='Amount in CAD';const feeSave=make('button',panel,'Save fee definition');feeSave.type='button';const feeMsg=make('p',panel);feeSave.addEventListener('click',async()=>{try{const r=await api('/admin/fees','POST',{label:feeName.value,dollars:Number(feeAmount.value)});feeMsg.textContent=r.message}catch(e){feeMsg.textContent=e.message}});
  btn.addEventListener('click',()=>{for(const p of adminRoot.querySelectorAll('.content-panel'))p.hidden=p!==panel;adminNav.querySelectorAll('[data-admin-tab]').forEach(b=>b.classList.toggle('active',b===btn));void loadAdmin()});
  async function loadAdmin(){try{const [requests,attendance,fees]=await Promise.all([api('/admin/requests'),api('/admin/attendance'),api('/admin/fees')]);reqs.replaceChildren();select.replaceChildren();feeList.replaceChildren();for(const f of fees.fees)make('p',feeList,`Fee ID ${f.id}: ${f.label} — ${money(f.amount_cents)}`);for(const r of requests.requests){const line=make('div',reqs);line.className='school-course-row';make('p',line,`${r.username} · ${r.kind.replaceAll('_',' ')} · ${r.status} · ${r.details}`);if(r.status==='pending')for(const decision of ['approved','rejected']){const b=make('button',line,decision==='approved'?'Approve':'Reject');b.type='button';b.addEventListener('click',async()=>{try{await api('/admin/requests/'+r.id,'POST',{decision});await loadAdmin()}catch(e){make('p',line,e.message)}})}}for(const e of attendance.enrollments){const o=make('option',select,`${e.username} · ${e.code} (${e.term})`);o.value=e.enrollment_id}}catch(e){make('p',reqs,e.message)}}
 }
 // Original panels can be replaced by app.js; do not claim live banking details are imported.
 void loadStudent();
});
