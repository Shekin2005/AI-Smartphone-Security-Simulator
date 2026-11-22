"use strict";
// Standalone, real-API administrator interface. Never embed credentials or secrets.
(()=>{
 const root=document.getElementById('ac-admin-root');if(!root)return;
 // The admin logout button is separate from the student/banking [data-logout] buttons.
 const adminLogout=document.getElementById('acadia-admin-logout');
 if(adminLogout){
   adminLogout.addEventListener('click',async()=>{
     if(adminLogout.disabled)return;
     adminLogout.disabled=true;
     const oldLabel=adminLogout.textContent;
     adminLogout.textContent='Signing out…';
     try{
       const response=await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin'});
       if(!response.ok){
         const data=await response.json().catch(()=>({}));
         throw new Error(data.error||`Logout failed (HTTP ${response.status})`);
       }
       // Return to the Acadia account chooser, not the phone lock screen.
       const dashboard=document.getElementById('acadia-admin-dashboard');
       const chooser=document.getElementById('acadia-role-selection');
       if(dashboard)dashboard.hidden=true;
       for(const id of ['acadia-student-login-form','acadia-admin-login-form','acadia-admin-register-form','acadia-admin-mfa']){
         const el=document.getElementById(id);if(el)el.hidden=true;
       }
       if(chooser){chooser.hidden=false;chooser.style.display='';}
       // Reload to reset all administrator UI state and refresh the session.
       window.location.reload();
     }catch(error){
       adminLogout.disabled=false;
       adminLogout.textContent=oldLabel;
       window.alert(error.message||'Unable to sign out.');
     }
   });
 }

 const tabs=[['overview','Overview'],['students','Students'],['courses','Courses'],['enrollment','Enrollment'],['grades','Grades & Attendance'],['finance','Finance'],['requests','Requests'],['graduation','Graduation & Degrees'],['degree-rules','Degree Requirements']];
 const state={tab:'overview',catalog:[],students:[],student:null,enrollments:[],defaults:[],gradeRows:[],fees:[],serviceRequests:[],profileRequests:[]};
 const $=id=>root.querySelector('#'+id);
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const opt=(v,t)=>`<option value="${esc(v)}">${esc(t)}</option>`;
 const courseOpts=(list=state.catalog)=>'<option value="">Choose course</option>'+list.map(c=>opt(c.id,`${c.code} — ${c.title} (${c.term})`)).join('');
 const studentOpts=()=>'<option value="">Choose student</option>'+state.students.map(s=>opt(s.id,`${s.username} · AC${String(s.id).padStart(8,'0')}`)).join('');
 const money=c=>new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(Number(c||0)/100);
 const label=(id,title,type='text',value='')=>`<label for="${id}">${title}</label><input id="${id}" type="${type}" value="${esc(value)}">`;
 const select=(id,title,options)=>`<label for="${id}">${title}</label><select id="${id}">${options}</select>`;
 const button=(id,title,secondary=false)=>`<button type="button" class="ac-btn${secondary?' secondary':''}" id="${id}">${title}</button>`;
 const box=(title,content)=>`<section class="ac-card"><h3>${title}</h3>${content}</section>`;
 const notice=(msg,good=false)=>{const n=$('ac-notice');if(n){n.textContent=msg;n.className='ac-alert'+(good?' ac-good':'');}};
 async function api(url,method='GET',body){const r=await fetch(url,{method,credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||`HTTP ${r.status}`);return j;}
 async function run(fn){try{notice('Working…');await fn();if($('ac-notice')?.textContent==='Working…')notice('Saved successfully.',true);}catch(e){notice(e.message||String(e));}}
 async function loadCatalog(){state.catalog=(await api('/api/school/admin/course-manager/catalog')).catalog||[];}
 async function findStudents(query){state.students=(await api('/api/school/admin/course-manager/students?q='+encodeURIComponent(query))).students||[];}
 async function loadEnrollments(id){state.enrollments=(await api(`/api/school/admin/course-manager/student/${encodeURIComponent(id)}`)).enrollments||[];}
 const fields=['code','title','term','faculty','subject','section','instructor','weekday','startTime','endTime','location','credits','capacity','description'];
 const defaults={term:'Fall 2026',faculty:'Faculty of Pure and Applied Science',subject:'Computer Science',section:'FA01',instructor:'TBA',weekday:'Monday',startTime:'09:00',endTime:'10:15',location:'TBA',credits:'3',capacity:'30'};
 function render(){root.innerHTML=`<nav class="ac-tabs" aria-label="Admin sections">${tabs.map(([id,t])=>`<button type="button" data-ac-tab="${id}" aria-selected="${state.tab===id}">${t}</button>`).join('')}</nav><div id="ac-notice" class="ac-alert" role="status" aria-live="polite">Choose a section to manage records.</div><div id="ac-view"></div>`;root.querySelectorAll('[data-ac-tab]').forEach(b=>b.onclick=()=>{state.tab=b.dataset.acTab;render();loadTab();});loadTab();}
 function view(html){$('ac-view').innerHTML=html;}
 function currentStudent(){return Number($('ac-student')?.value||state.student||0);}
 async function loadTab(){try{
  if(state.tab==='overview'){const [s,c,r,e]=await Promise.allSettled([api('/api/school/admin/students'),api('/api/school/admin/course-manager/catalog'),api('/api/school/admin/requests'),api('/api/school/admin/enrollments')]);const val=(r,k)=>r.status==='fulfilled'?(r.value[k]||[]).length:'Unavailable';view(box('Administration overview',`<div class="ac-grid"><p><strong>Students</strong><br>${val(s,'students')}</p><p><strong>Courses</strong><br>${val(c,'catalog')}</p><p><strong>Profile requests</strong><br>${val(r,'requests')}</p><p><strong>Enrollments</strong><br>${val(e,'enrollments')}</p></div><p class="ac-muted">Use the tabs above to manage each area. Counts are loaded from your simulator database.</p>`));}
  if(state.tab==='students'){view(box('Find a student',`${label('ac-query','Username, name or simulator ID')}${button('ac-search','Search students')}<div id="ac-results"></div>`));$('ac-search').onclick=()=>run(async()=>{await findStudents($('ac-query').value.trim());$('ac-results').innerHTML=state.students.length?state.students.map(s=>`<div class="ac-item"><strong>${esc(s.username)}</strong> · AC${String(s.id).padStart(8,'0')}<br>${esc(s.display_name)} · ${esc(s.program)} · Year ${esc(s.year_of_study)}<br>${button('ac-open-'+s.id,'View registrations',true)}</div>`).join(''):'No matching students';state.students.forEach(s=>{$('ac-open-'+s.id).onclick=()=>run(async()=>{await loadEnrollments(s.id);notice(`${s.username}: ${state.enrollments.map(e=>e.code+' ('+e.term+')').join(', ')||'No registrations'}`,true);});});});}
  if(state.tab==='courses'){await loadCatalog();view(box('Course catalogue',`<p class="ac-muted">Choose a course to edit, or select New course. Changes are saved in PostgreSQL.</p>${select('ac-existing','Course','<option value="">New course</option>'+state.catalog.map(c=>opt(c.id,`${c.code} — ${c.title}`)).join(''))}<div id="ac-course-fields" class="ac-grid"></div>${button('ac-save-course','Save course')}<p class="ac-muted">${state.catalog.length} courses in catalogue</p>`));const draw=x=>{$('ac-course-fields').innerHTML=fields.map(k=>`<div>${k==='description'?`<label for="ac-f-${k}">${k}</label><textarea id="ac-f-${k}">${esc(x?.[k]??'')}</textarea>`:label('ac-f-'+k,k,k==='credits'||k==='capacity'?'number':'text',x?.[k]??defaults[k]??'')}</div>`).join('');};draw();$('ac-existing').onchange=()=>{const c=state.catalog.find(c=>String(c.id)===$('ac-existing').value);draw(c?{...c,startTime:String(c.start_time||'').slice(0,5),endTime:String(c.end_time||'').slice(0,5)}:null);};$('ac-save-course').onclick=()=>run(async()=>{const data={};for(const k of fields)data[k]=$('ac-f-'+k).value;if(!data.code||!data.title)throw Error('Enter course code and title');if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(data.startTime)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(data.endTime)||data.endTime<=data.startTime)throw Error('Use start/end times HH:MM; end must be after start');const r=await api('/api/school/admin/course-manager/catalog','POST',data);await loadCatalog();$('ac-existing').innerHTML='<option value="">New course</option>'+state.catalog.map(c=>opt(c.id,`${c.code} — ${c.title}`)).join('');$('ac-existing').value=String(r.id);notice(r.message+' · Course '+data.code,true);});}
  if(state.tab==='enrollment'){await loadCatalog();view(box('Assign a course to a student',`${label('ac-find','Search username or AC student ID')}${button('ac-search','Find student')}${select('ac-student','Student','<option value="">Search first</option>')}${select('ac-course','Available course',courseOpts())}${button('ac-assign','Register student · $3,000')}<div id="ac-registered"></div>`)+box('Default courses',`<p class="ac-muted">Save a default course for an exact program name and year, then apply it to a selected student. Existing registrations are skipped.</p>${label('ac-program','Program name')}${label('ac-year','Year of study','number','1')}${select('ac-default-course','Default course',courseOpts())}${button('ac-add-default','Save default course')}${button('ac-apply','Apply defaults to student',true)}<div id="ac-default-list"></div>`));$('ac-search').onclick=()=>run(async()=>{await findStudents($('ac-find').value.trim());$('ac-student').innerHTML=studentOpts();notice(`Found ${state.students.length} student(s)`,true);});$('ac-student').onchange=()=>run(async()=>{state.student=currentStudent();if(state.student){await loadEnrollments(state.student);$('ac-registered').innerHTML='<h4>Registered courses</h4>'+(state.enrollments.map(e=>`<p>${esc(e.code)} — ${esc(e.title)} · ${esc(e.term)} · Grade ${esc(e.grade??'pending')}</p>`).join('')||'<p>No courses registered</p>');}});$('ac-assign').onclick=()=>run(async()=>{const studentId=currentStudent(),catalogId=Number($('ac-course').value);if(!studentId||!catalogId)throw Error('Choose student and course');if(!confirm('Register student and charge $3,000 for a new course?'))return;const r=await api('/api/school/admin/course-manager/assign','POST',{studentId,catalogId});await loadEnrollments(studentId);$('ac-registered').innerHTML=state.enrollments.map(e=>`<p>${esc(e.code)} — ${esc(e.title)}</p>`).join('');notice(r.message+(r.charged?' · $3,000 charged':''),true);});const showDefaults=async()=>{state.defaults=(await api('/api/school/admin/course-manager/defaults')).defaults||[];$('ac-default-list').innerHTML=state.defaults.map(d=>`<p>${esc(d.program)} · Year ${d.year_of_study} · ${esc(d.code)}</p>`).join('')||'<p>No defaults configured</p>';};$('ac-add-default').onclick=()=>run(async()=>{await api('/api/school/admin/course-manager/defaults','POST',{program:$('ac-program').value,year:Number($('ac-year').value),catalogId:Number($('ac-default-course').value)});await showDefaults();});$('ac-apply').onclick=()=>run(async()=>{if(!currentStudent())throw Error('Select student first');if(!confirm('Register matching default courses? Each new registration costs $3,000.'))return;const r=await api('/api/school/admin/course-manager/apply-defaults','POST',{studentId:currentStudent()});notice(r.message+(r.skipped?.length?' · '+r.skipped.join('; '):''),true);});await showDefaults();}
  if(state.tab==='grades'){
    const gr=await api('/api/school/admin/enrollments');
    state.gradeRows=gr.enrollments||[];
    const usernames=[...new Set(state.gradeRows.map(e=>e.username))].sort();
    view(box('Publish student grades',
      `${select('ac-grade-student','1. Choose student','<option value="">Choose student</option>'+usernames.map(u=>opt(u,u)).join(''))}`+
      `${select('ac-grade-enrollment','2. Choose registered course','<option value="">Choose student first</option>')}`+
      `${label('ac-grade','3. Grade (0–100)','number')}`+
      `${button('ac-save-grade','Publish grade')}`+
      `<p class="ac-muted">Only courses the selected student is registered in are shown.</p>`)+
      box('Grade recovery',button('ac-recovery-refresh','Load recovery history',true)+'<div id="ac-recovery-list"></div>')+box('Record attendance','<div id="ac-attendance-content">Loading attendance…</div>'));
    const refreshRecovery=async()=>{
      const data=await api('/api/school/admin/grade-recovery');
      const host=$('ac-recovery-list'); if(!host)return;host.replaceChildren();
      for(const item of data.records||[]){
        const row=state.gradeRows.find(e=>String(e.id)===String(item.enrollment_id));
        const line=document.createElement('p');line.textContent=`${row?.username||'Enrollment '+item.enrollment_id} / ${row?.code||''}: ${item.original_grade??'Not posted'} → ${item.published_grade} (${item.restored_at?'Restored':'Pending'})`;host.append(line);
        if(!item.restored_at){const b=document.createElement('button');b.type='button';b.className='ac-btn secondary';b.textContent='Restore original grade';b.onclick=()=>run(async()=>{if(!confirm('Restore this original grade?'))return;b.disabled=true;try{const r=await api('/api/school/admin/grade-recovery/'+encodeURIComponent(item.id)+'/restore','POST',{});if(row)row.grade=r.current;$('ac-grade-student').onchange();await refreshRecovery();notice(r.message+' — '+(r.current??'Not posted'),true);}finally{b.disabled=false;}});host.append(b);}
      }
      if(!host.childNodes.length)host.textContent='No recovery records.';
    };
    $('ac-recovery-refresh').onclick=()=>run(refreshRecovery);
    $('ac-grade').min='0';$('ac-grade').max='100';$('ac-grade').step='0.01';
    $('ac-grade-student').onchange=()=>{
      const username=$('ac-grade-student').value;
      const rows=state.gradeRows.filter(e=>e.username===username);
      $('ac-grade-enrollment').innerHTML='<option value="">Choose course</option>'+rows.map(e=>opt(e.id,`${e.code} — ${e.title} (${e.term}) · ${e.grade??'Not posted'}`)).join('');
    };
    $('ac-save-grade').onclick=()=>run(async()=>{
      const enrollmentId=Number($('ac-grade-enrollment').value),grade=$('ac-grade').value.trim();
      if(!enrollmentId)throw Error('Choose a student and registered course first');
      if(grade===''||!Number.isFinite(Number(grade))||Number(grade)<0||Number(grade)>100)throw Error('Enter a grade from 0 to 100');
      if(!confirm('Publish this grade to the registered student course?'))return;
      const r=await api('/api/school/admin/grades','POST',{enrollmentId,grade});
      const row=state.gradeRows.find(e=>Number(e.id)===enrollmentId);if(row)row.grade=r.current;
      $('ac-grade-student').onchange();$('ac-grade-enrollment').value=String(enrollmentId);
      notice(r.message+' — '+(row?.username||'student')+' / '+(row?.code||'course')+': '+(r.original??'Not posted')+' → '+r.current,true);
      await refreshRecovery();
    });
    try{
      const att=await api('/api/school/services/admin/attendance');
      $('ac-attendance-content').innerHTML=`${select('ac-att-enrollment','Registered student and course','<option value="">Choose registration</option>'+(att.enrollments||[]).map(e=>opt(e.enrollment_id,`${e.username} · ${e.code} · ${e.term}`)).join(''))}${label('ac-date','Session date','date',new Date().toISOString().slice(0,10))}${select('ac-att-status','Status',opt('present','Present')+opt('absent','Absent')+opt('excused','Excused'))}${button('ac-save-att','Save attendance')}`;
      $('ac-save-att').onclick=()=>run(async()=>{const r=await api('/api/school/services/admin/attendance','POST',{enrollmentId:Number($('ac-att-enrollment').value),date:$('ac-date').value,status:$('ac-att-status').value});notice(r.message,true);});
    }catch(e){$('ac-attendance-content').textContent='Attendance unavailable: '+e.message+'. Grade publishing remains available.';}
  }
  if(state.tab==='finance'){
    const f=await api('/api/school/services/admin/fees');state.fees=f.fees||[];
    view(box('Fee definitions',`${label('ac-fee-name','Fee name')}${label('ac-fee-value','Amount in CAD','number')}${button('ac-fee-save','Save fee definition')}<div id="ac-fees-list">${state.fees.map(f=>`<p>${esc(f.label)} — ${money(f.amount_cents)}</p>`).join('')}</div>`)
    +box('Student financial account',`${label('ac-find','Search student name, username or AC ID')}${button('ac-search','Find student')}${select('ac-student','Student','<option value="">Search first</option>')}${button('ac-history','View balance & transaction history',true)}<div id="ac-finance-history"></div>`)
    +box('Add fee to student',`${select('ac-fee','Fee',state.fees.filter(f=>f.active).map(f=>opt(f.id,`${f.label} · ${money(f.amount_cents)}`)).join(''))}${label('ac-term','Term','text','Fall 2026')}${button('ac-charge','Apply fee')}`)
    +box('Financial aid and adjustments',`<p class="ac-muted">Charges add to the balance. Reversals reduce an outstanding balance. Scholarships automatically pay the balance first, then credit any remainder to a specified SIMULATED bank chequing account. Leave bank username empty to hold the excess as pending.</p>${select('ac-action','Action',opt('scholarship','Award scholarship')+opt('reverse_charge','Reverse outstanding charge')+opt('charge','Add custom charge'))}${label('ac-adjust-amount','Amount in CAD','number')}${label('ac-adjust-description','Reason / scholarship name')}${label('ac-bank-username','Simulated Banking app username (optional; for scholarship surplus only)')}${button('ac-adjust-save','Record financial transaction')}`));
    const showHistory=async()=>{const id=Number($('ac-student').value);if(!id)throw Error('Choose a student first');const h=await api(`/api/school/services/admin/finance-history/${id}`);$('ac-finance-history').innerHTML=`<h4>Outstanding balance: ${money(h.balance_cents)}</h4>`+(h.records.map(r=>`<div class="ac-item"><strong>${esc(r.kind)} · ${esc(r.description)}</strong><p>${money(r.amount_cents)} · Applied: ${money(r.applied_cents)} · Bank credit: ${money(r.bank_cents)} · Pending: ${money(r.pending_cents)}</p><small>${esc(String(r.created_at).slice(0,19))}</small></div>`).join('')||'<p>No financial adjustments yet.</p>');};
    $('ac-fee-save').onclick=()=>run(async()=>{await api('/api/school/services/admin/fees','POST',{label:$('ac-fee-name').value,dollars:Number($('ac-fee-value').value)});await loadTab();notice('Fee definition saved',true);});
    $('ac-search').onclick=()=>run(async()=>{await findStudents($('ac-find').value.trim());$('ac-student').innerHTML=studentOpts();notice(`Found ${state.students.length} student(s)`,true);});
    $('ac-history').onclick=()=>run(showHistory);
    $('ac-charge').onclick=()=>run(async()=>{if(!confirm('Apply this fee to the selected student?'))return;const r=await api('/api/school/services/admin/charge-fee','POST',{studentId:Number($('ac-student').value),feeId:Number($('ac-fee').value),term:$('ac-term').value});await showHistory();notice(r.message,true);});
    $('ac-adjust-save').onclick=()=>run(async()=>{const body={studentId:Number($('ac-student').value),kind:$('ac-action').value,dollars:Number($('ac-adjust-amount').value),description:$('ac-adjust-description').value,bankUsername:$('ac-bank-username').value.trim()};if(!body.studentId)throw Error('Choose a student');if(!confirm(`Confirm ${body.kind} of $${body.dollars.toFixed(2)} for this student?`))return;const r=await api('/api/school/services/admin/finance-adjust','POST',body);await showHistory();notice(`${r.message}. Balance: ${money(r.balance_cents)}; bank credit: ${money(r.bank_cents)}; pending: ${money(r.pending_cents)}`,true);});
  }
  if(state.tab==='degree-rules'){
    const r=await api('/api/school/admin/degree-requirements');const rows=r.requirements||[];
    view(box('Configure degree requirements',`<p class="ac-muted">Enter the exact program name from the student's profile and the required course code. This is fictional simulator data, not official university policy.</p>${label('ac-degree-program','Exact degree / program name')}${label('ac-degree-code','Required course code (e.g. COMP 3123)')}${button('ac-degree-add','Add required course')}<div id="ac-degree-list">${rows.length?rows.map(x=>`<div class="ac-item">${esc(x.program)} — ${esc(x.course_code)} ${button('ac-degree-remove-'+x.id,'Remove',true)}</div>`).join(''):'No degree requirements configured yet.'}</div>`));
    $('ac-degree-add').onclick=()=>run(async()=>{const program=$('ac-degree-program').value,code=$('ac-degree-code').value;await api('/api/school/admin/degree-requirements','POST',{program,code});await loadTab();notice('Requirement saved',true);});
    for(const x of rows)$('ac-degree-remove-'+x.id).onclick=()=>run(async()=>{if(!confirm('Remove this requirement?'))return;await api('/api/school/admin/degree-requirements/'+x.id,'DELETE');await loadTab();notice('Requirement removed',true);});
  }
  if(state.tab==='requests'||state.tab==='graduation'){const [p,s]=await Promise.all([api('/api/school/admin/requests'),api('/api/school/services/admin/requests')]);state.profileRequests=p.requests||[];state.serviceRequests=s.requests||[];const onlyGraduation=state.tab==='graduation';const service=state.serviceRequests.filter(r=>onlyGraduation?['graduation','degree'].includes(r.kind):!['graduation','degree'].includes(r.kind));const profiles=onlyGraduation?[]:state.profileRequests;view((onlyGraduation?'':box('Profile change requests',profiles.length?profiles.map(r=>`<div class="ac-item"><strong>${esc(r.username)}</strong> · ${esc(r.proposed_name)} · ${esc(r.proposed_program)} · Year ${r.proposed_year}<div class="ac-actions">${button('ac-pa-'+r.id,'Approve')}${button('ac-pr-'+r.id,'Reject',true)}</div></div>`).join(''):'No pending profile requests'))+box(onlyGraduation?'Graduation & degree requests':'Student service requests',service.length?service.map(r=>`<div class="ac-item"><strong>${esc(r.username)} · ${esc(r.kind)}</strong> <span class="ac-tag">${esc(r.status)}</span><p>${esc(r.details)}</p>${r.status==='pending'?`<div class="ac-actions">${button('ac-sa-'+r.id,'Approve')}${button('ac-sr-'+r.id,'Reject',true)}</div>`:''}</div>`).join(''):'No requests in this section'));for(const r of profiles){for(const [suffix,decision] of [['a','approved'],['r','rejected']])$('ac-p'+suffix+'-'+r.id).onclick=()=>run(async()=>{const note=prompt('Optional administrator note','')??'';await api(`/api/school/admin/requests/${r.id}`,'POST',{decision,note});notice('Profile request '+decision,true);await loadTab();});}for(const r of service.filter(r=>r.status==='pending')){for(const [suffix,decision] of [['a','approved'],['r','rejected']])$('ac-s'+suffix+'-'+r.id).onclick=()=>run(async()=>{const note=prompt('Optional administrator note','')??'';await api(`/api/school/services/admin/requests/${r.id}`,'POST',{decision,note});notice('Request '+decision,true);await loadTab();});}}
 }catch(e){view(box('Unable to load section',`<p>${esc(e.message)}</p><p class="ac-muted">Check Project 2 server terminal and ensure the school SQL migrations were applied.</p>`));notice(e.message);}}
 const observer=new MutationObserver(()=>{const d=document.getElementById('acadia-admin-dashboard');if(d&&!d.hidden){observer.disconnect();render();}});const dashboard=document.getElementById('acadia-admin-dashboard');if(dashboard){observer.observe(dashboard,{attributes:true,attributeFilter:['hidden']});if(!dashboard.hidden){observer.disconnect();render();}}
})();
