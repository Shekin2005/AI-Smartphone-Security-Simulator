"use strict";
// Added functionality is isolated from the existing working login and Banking code.
document.addEventListener('DOMContentLoaded',()=>{
 const $=id=>document.getElementById(id);
 const money=c=>new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(Number(c)/100);
 const make=(tag,text,parent)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;parent.append(el);return el};
 async function api(url,method='GET',body){const r=await fetch('/api/school'+url,{method,credentials:'same-origin',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||`HTTP ${r.status}`);return d;}
 const msg=(id,text)=>{if($(id))$(id).textContent=text};
 // Existing panels are re-rendered by app.js. Dedicated upgrade sections stay in their own containers.
 const coursePanel=$('acadia-courses');const profilePanel=$('acadia-profile');const financePanel=$('acadia-finance');const schedulePanel=$('acadia-schedule');const gradePanel=$('acadia-grades');
 function section(parent,id,title){const root=make('section',undefined,parent);root.id=id;root.className='school-upgrade';make('h3',title,root);return root}
 const catalog=section(coursePanel,'school-catalog','Available courses — $3,000 each');
 const catalogBody=make('div',undefined,catalog);const catalogMsg=make('p','',catalog);catalogMsg.id='school-catalog-msg';
 const schedule=section(schedulePanel,'school-schedule','My registered course schedule');
 const grades=section(gradePanel,'school-grades','Grades for newly registered courses');
 const finance=section(financePanel,'school-finance','Course charges and fees');
 const requests=section(profilePanel,'school-profile-requests','Request a profile change');
 const form=make('div',undefined,requests);
 for(const [id,label,placeholder] of [['school-name','Proposed name','Name'],['school-program','Proposed program','Program'],['school-year','Year of study (1–8)','4']]){make('label',label,form);const i=make('input',undefined,form);i.id=id;i.placeholder=placeholder;if(id==='school-year')i.type='number';}
 const requestButton=make('button','Submit request for admin approval',form);requestButton.type='button';const requestMsg=make('p','',requests);const requestHistory=make('div',undefined,requests);
 requestButton.addEventListener('click',async()=>{try{const d=await api('/profile-requests','POST',{name:$('school-name').value,program:$('school-program').value,year:Number($('school-year').value)});requestMsg.textContent=d.message;await refreshStudent();}catch(e){requestMsg.textContent=e.message}});
 async function refreshPublishedGrades(){
  // Load published grades independently of catalog, finance, and profile requests.
  if(grades.parentElement!==gradePanel)gradePanel.append(grades);
  grades.replaceChildren();
  make('h3','Grades for newly registered courses',grades);
  make('p','Loading grades...',grades);
  try{
   const data=await api('/enrollments');
   grades.replaceChildren();
   make('h3','Grades for newly registered courses',grades);
   const records=Array.isArray(data.enrollments)?data.enrollments:[];
   if(!records.length)make('p','No registered courses found.',grades);
   for(const e of records){
    const published=e.grade!==null&&e.grade!==undefined&&e.grade!=='';
    make('p',`${e.code} — ${e.title}: ${published?e.grade+'%':'Not published'}`,grades);
   }
  }catch(e){
   grades.replaceChildren();
   make('h3','Grades for newly registered courses',grades);
   make('p','Unable to load grades: '+e.message,grades);
   console.error('Student grades refresh failed:',e);
  }
 }
 async function refreshStudent(){
 // Restore enhancement nodes after the legacy dashboard replaces panel content.
 for(const [parent,child] of [[coursePanel,catalog],[schedulePanel,schedule],[gradePanel,grades],[financePanel,finance],[profilePanel,requests]]){if(parent&&child.parentElement!==parent)parent.append(child)}
 await refreshPublishedGrades();
 try{
 const [catalogData,enrollmentData,feeData,requestData]=await Promise.all([api('/catalog'),api('/enrollments'),api('/finance'),api('/profile-requests')]);
 catalogBody.replaceChildren();schedule.replaceChildren();make('h3','My registered course schedule',schedule);finance.replaceChildren();make('h3','Course charges and fees',finance);requestHistory.replaceChildren();
 for(const c of catalogData.catalog){const line=make('div',undefined,catalogBody);line.className='school-course-row';make('strong',`${c.code} — ${c.title}`,line);make('p',`${c.term} · ${c.weekday} ${String(c.start_time).slice(0,5)} · ${money(c.tuition_cents)}`,line);const btn=make('button','Register',line);btn.type='button';btn.disabled=enrollmentData.enrollments.some(e=>e.code===c.code&&e.term===c.term);btn.addEventListener('click',async()=>{btn.disabled=true;try{const result=await api('/enrollments','POST',{catalogId:c.id});msg('school-catalog-msg',result.message);await refreshStudent();if(typeof window.loadAcadiaFromBackend==='function')await window.loadAcadiaFromBackend();}catch(e){msg('school-catalog-msg',e.message);btn.disabled=false}})}
 if(!enrollmentData.enrollments.length){make('p','New registrations will appear here. Existing legacy courses remain in the Courses and Grades tabs.',schedule)}
 for(const e of enrollmentData.enrollments){make('p',`${e.code} — ${e.title} · ${e.term} · ${e.weekday} ${String(e.start_time).slice(0,5)}`,schedule)}
 make('p',`Current outstanding balance: ${money(feeData.balanceCents)}`,finance);
 make('p','Existing tuition balance and past payments are preserved. New course registrations add $3,000 each.',finance);
 for(const e of feeData.entries)make('p',`${e.description}: ${money(e.amount_cents)}`,finance);
 for(const r of requestData.requests)make('p',`${r.status.toUpperCase()}: ${r.proposed_name}, ${r.proposed_program}, year ${r.proposed_year}${r.admin_note?' — '+r.admin_note:''}`,requestHistory);
 }catch(e){msg('school-catalog-msg',e.message)}
 }

const adminStudents = document.getElementById("admin-students");
const adminCourses = document.getElementById("admin-courses");
const adminGrades = document.getElementById("admin-grades");

if (!adminStudents || !adminCourses || !adminGrades) {
    console.warn("Admin panels are not available.");
    return;
}
 // Admin enhancements: independent controls so existing disabled placeholder buttons are untouched.
 // Prevent initialization errors when legacy
// administrator containers are not present.
if (!adminStudents || !adminCourses || !adminGrades) {
    console.warn(
        "[School Upgrade] Legacy admin panels unavailable."
    );
    return;
}
 const adminRequest=section(adminStudents,'school-admin-requests','Pending profile change requests');const adminRequestBody=make('div',undefined,adminRequest);
 const adminCatalog=section(adminCourses,'school-admin-catalog','Manage course catalogue');const acInputs={};for(const [key,label,placeholder] of [['code','Code','COMP 1113'],['title','Title','Introduction to Computing'],['term','Term','Fall 2026'],['weekday','Day','Monday'],['startTime','Start time','09:00']]){make('label',label,adminCatalog);const input=make('input',undefined,adminCatalog);input.placeholder=placeholder;acInputs[key]=input}const saveCourse=make('button','Save course offering',adminCatalog);saveCourse.type='button';const adminCourseMsg=make('p','',adminCatalog);
 saveCourse.addEventListener('click',async()=>{try{const body=Object.fromEntries(Object.entries(acInputs).map(([k,v])=>[k,v.value]));const r=await api('/admin/catalog','POST',body);adminCourseMsg.textContent=r.message;}catch(e){adminCourseMsg.textContent=e.message}});
 const adminGrade=section(adminGrades,'school-admin-grades','Publish grades for registered courses');const gradeSelect=make('select',undefined,adminGrade);const gradeInput=make('input',undefined,adminGrade);gradeInput.type='number';gradeInput.min='0';gradeInput.max='100';gradeInput.step='0.01';gradeInput.placeholder='Grade 0–100';const saveGrade=make('button','Publish grade',adminGrade);saveGrade.type='button';const gradeMsg=make('p','',adminGrade);
 saveGrade.addEventListener('click',async()=>{try{const r=await api('/admin/grades','POST',{enrollmentId:Number(gradeSelect.value),grade:gradeInput.value});gradeMsg.textContent=r.message;await refreshAdmin();}catch(e){gradeMsg.textContent=e.message}});
 async function refreshAdmin(){try{const [reqs,enrollments,students]=await Promise.all([api('/admin/requests'),api('/admin/enrollments'),api('/admin/students')]);adminRequestBody.replaceChildren();gradeSelect.replaceChildren();const results=$('admin-student-results');if(results){results.replaceChildren();for(const s of students.students)make('p',`${s.username} · ${s.display_name} · ${s.program} · Balance ${money(s.tuition_cents)}`,results)}
 for(const r of reqs.requests){const box=make('div',undefined,adminRequestBody);box.className='school-course-row';make('p',`${r.username}: ${r.proposed_name} / ${r.proposed_program} / Year ${r.proposed_year}`,box);for(const decision of ['approved','rejected']){const b=make('button',decision==='approved'?'Approve':'Reject',box);b.type='button';b.addEventListener('click',async()=>{try{await api('/admin/requests/'+r.id,'POST',{decision});await refreshAdmin()}catch(e){make('p',e.message,box)}})}}
 for(const e of enrollments.enrollments){const opt=make('option',`${e.username} — ${e.code} (${e.term})${e.grade===null?'':' — '+e.grade+'%'}`,gradeSelect);opt.value=e.id}
 }catch(e){make('p','Admin data unavailable: '+e.message,adminRequestBody)}}
 // Only load protected data when the relevant authenticated dashboard is visible.
 document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{if($('acadia-dashboard')?.hidden===false || coursePanel.closest('[hidden]')===null)void refreshStudent()}));
 document.querySelectorAll('[data-admin-tab]').forEach(b=>b.addEventListener('click',()=>void refreshAdmin()));
 const adminDashboard=$('acadia-admin-dashboard');if(adminDashboard){const observer=new MutationObserver(()=>{if(!adminDashboard.hidden)void refreshAdmin()});observer.observe(adminDashboard,{attributes:true,attributeFilter:['hidden']})}
 // Refresh grades whenever the Grades tab is opened, even when other services fail.
 document.querySelectorAll('[data-tab="grades"]').forEach(button=>{
  button.addEventListener('click',()=>{setTimeout(()=>{void refreshPublishedGrades()},0)});
 });
 // Refresh again when the Grades panel becomes visible through alternate navigation.
 const gradesPanelObserver=new MutationObserver(()=>{
  if(gradePanel && !gradePanel.hidden && $('acadia-dashboard')?.hidden===false){
   void refreshPublishedGrades();
  }
 });
 if(gradePanel)gradesPanelObserver.observe(gradePanel,{attributes:true,attributeFilter:['hidden']});
 // Trigger when student data finishes loading; this function is invoked by app.js.
 window.refreshAcademicEnhancements=refreshStudent;
});
