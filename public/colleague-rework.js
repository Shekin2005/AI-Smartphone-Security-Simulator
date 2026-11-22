'use strict';
// Student-only self-service navigation; existing authentication, API routes and admin UI remain intact.
document.addEventListener('DOMContentLoaded', () => {
  const root=document.getElementById('acadia-dashboard');
  const tabs=root?.querySelector('.acadia-tabs');
  if(!root||!tabs)return;
  const $=id=>document.getElementById(id);
  const cards=[
    ['finance','Student Finance','View account statements, charges and tuition payments','💵'],
    ['aid','Financial Aid','Review fictional financial aid information','📄'],
    ['tax','Tax Information','Review simulated tax information and consent','🧾'],
    ['banking','Banking Information','View and request updates to banking information','🏦'],
    ['planning','Student Planning','Plan your degree, schedule and register for classes','🗓️'],
    ['catalog','Course Catalog','Search course subjects and available sections','📚'],
    ['grades','Grades','View your grades by term','🏅'],
    ['graduation','Graduation Overview','View and submit a graduation application','🎓'],
    ['verification','Enrollment Verifications','Request proof of enrollment','☑️'],
    ['transcripts','Transcript Requests','Request an academic transcript','📑'],
    ['attendance','Academic Attendance','View attendance by term','📋']
  ];
  const home=document.createElement('section');home.id='colleague-home';home.className='colleague-home';
  home.innerHTML='<h2>Hello, Welcome to Colleague Self-Service!</h2><p>Choose a category to get started.</p><div class="colleague-grid"></div><p class="colleague-notice">Fictional university simulator — not Acadia’s official Colleague Self-Service system.</p>';
  const grid=home.querySelector('.colleague-grid');
  const panels={};
  const panelContainer=$('acadia-courses').parentElement;
  const sections=[
    ['Academics',['planning','catalog','grades','attendance']],
    ['Financial Services',['finance','aid','banking','tax']],
    ['Student Services',['graduation','verification','transcripts']]
  ];
  for(const [heading,keys] of sections){
    const section=document.createElement('section');section.className='colleague-group';
    const title=document.createElement('h3');title.textContent=heading;section.append(title);
    const list=document.createElement('div');list.className='colleague-group-list';section.append(list);
    for(const key of keys){
      const [_,label,description,emoji]=cards.find(c=>c[0]===key);
      const tile=document.createElement('button');tile.type='button';tile.className='colleague-tile';
      const symbol=document.createElement('span');symbol.className='colleague-symbol';symbol.textContent=emoji;
      const text=document.createElement('span');const strong=document.createElement('strong');strong.textContent=label;
      const sub=document.createElement('small');sub.textContent=description;text.append(strong,sub);
      const arrow=document.createElement('span');arrow.className='colleague-arrow';arrow.textContent='›';
      tile.append(symbol,text,arrow);tile.addEventListener('click',()=>navigate(key));list.append(tile);
    }
    grid.append(section);
  }
  for(const [key,label] of [['aid','Financial Aid'],['tax','Tax Information']]){
    const panel=document.createElement('div');panel.id='colleague-'+key;panel.className='content-panel colleague-detail';panel.hidden=true;
    const h=document.createElement('h3');h.textContent=label;const p=document.createElement('p');p.textContent=key==='aid'?'Financial aid records have not been supplied to this simulator. No real financial aid data is accessed.':'Tax forms and consent are not connected to a real tax service in this simulator.';
    panel.append(h,p);panelContainer.append(panel);panels[key]=panel;
  }
  const bankPanel=document.createElement('div');
  bankPanel.id='colleague-bank-link';bankPanel.className='content-panel colleague-detail';bankPanel.hidden=true;
  panelContainer.append(bankPanel);panels.banking=bankPanel;
  async function bankRequest(path,method='GET',body){
    const r=await fetch('/api/school/services'+path,{method,credentials:'same-origin',
      headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
    const type=r.headers.get('content-type')||'';
    if(!type.includes('application/json'))throw Error('The server returned HTML instead of JSON (HTTP '+r.status+'). Check installed routes and restart Node.');
    const data=await r.json();if(!r.ok)throw Error(data.error||'HTTP '+r.status);return data;
  }
  async function drawBankLink(){
    bankPanel.replaceChildren();
    const title=document.createElement('h3');title.textContent='Connect Chequing Account';bankPanel.append(title);
    const note=document.createElement('p');note.textContent='Open the simulated Banking app → My Accounts → Account Details to get your account number and a 10-minute verification code.';bankPanel.append(note);
    const status=document.createElement('p');status.className='bank-link-status';bankPanel.append(status);
    const form=document.createElement('form');form.className='bank-link-form';bankPanel.append(form);
    const account=document.createElement('input');account.placeholder='SIM0000000001';account.autocomplete='off';account.required=true;account.maxLength=13;
    const code=document.createElement('input');code.placeholder='Verification code from Banking app';code.autocomplete='off';code.required=true;code.maxLength=24;
    const label1=document.createElement('label');label1.textContent='Chequing account number';label1.append(account);
    const label2=document.createElement('label');label2.textContent='One-time verification code';label2.append(code);
    const submit=document.createElement('button');submit.type='submit';submit.textContent='Verify and Connect';
    const unlink=document.createElement('button');unlink.type='button';unlink.textContent='Disconnect Account';
    form.append(label1,label2,submit,unlink);
    form.addEventListener('submit',async e=>{
      e.preventDefault();submit.disabled=true;
      try{const r=await bankRequest('/bank-link','POST',{account_number:account.value,verification_code:code.value});await drawBankLink();bankPanel.querySelector('.bank-link-status').textContent='Account verified. Pending scholarship refund credited: '+money(r.refunded_cents||0)}
      catch(err){status.textContent=err.message}finally{submit.disabled=false}
    });
    unlink.addEventListener('click',async()=>{
      if(!window.confirm('Disconnect this simulated Banking account?'))return;
      try{await bankRequest('/bank-unlink','POST',{});await drawBankLink()}catch(err){status.textContent=err.message}
    });
    try{const linked=await bankRequest('/bank-link');status.textContent=linked.linked?'Connected: '+linked.account_number:'No Banking account connected';unlink.hidden=!linked.linked}
    catch(err){status.textContent='Banking connection unavailable: '+err.message;unlink.hidden=true}
  }

  // Financial Aid: student-specific scholarship and adjustment history.
  async function drawFinancialAid(){
    const panel=panels.aid;panel.replaceChildren();
    const h=document.createElement('h3');h.textContent='Financial Aid & Scholarships';panel.append(h);
    const info=document.createElement('p');info.textContent='Simulator awards, balance applications and Banking app refunds.';panel.append(info);
    try{const r=await fetch('/api/school/services/financial-aid',{credentials:'same-origin'});const data=await r.json();if(!r.ok)throw Error(data.error||'Unable to load aid');
      if(!data.records?.length){const el=document.createElement('p');el.textContent='No scholarships or adjustments recorded yet.';panel.append(el)}
      for(const a of data.records||[]){const el=document.createElement('div');el.className='school-course-row';el.textContent=`${a.kind.replaceAll('_',' ')} — ${a.description} — ${new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(Number(a.amount_cents)/100)} | Applied to balance: ${(Number(a.applied_cents)/100).toFixed(2)} | Banking credit: ${(Number(a.bank_cents)/100).toFixed(2)} | Pending: ${(Number(a.pending_cents)/100).toFixed(2)}`;panel.append(el)}
    }catch(e){const el=document.createElement('p');el.textContent='Financial aid unavailable: '+e.message;panel.append(el)}
  }
  const toolbar=document.createElement('div');toolbar.className='colleague-toolbar';toolbar.hidden=true;
  const back=document.createElement('button');back.type='button';back.textContent='‹ Back to Self-Service';back.addEventListener('click',showHome);
  const current=document.createElement('strong');toolbar.append(back,current);
  tabs.before(home,toolbar);tabs.classList.add('colleague-legacy-tabs');
  const planning=$('acadia-planning'),catalog=$('acadia-catalog');
  const api=async path=>{const r=await fetch('/api/school'+path,{credentials:'same-origin'});const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||'HTTP '+r.status);return j};
  const send=async (path,body)=>{const r=await fetch('/api/school'+path,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||'HTTP '+r.status);return j};
  const make=(tag,parent,content)=>{const el=document.createElement(tag);if(content!==undefined)el.textContent=content;parent.append(el);return el};
  const money=n=>new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(Number(n)/100);
  const planKey='demo-acadia-course-plan-v1';
  const getPlan=()=>{try{return JSON.parse(localStorage.getItem(planKey)||'[]').filter(Number.isInteger)}catch{return []}};
  const setPlan=a=>localStorage.setItem(planKey,JSON.stringify(a));
  function hideAll(){for(const el of panelContainer.querySelectorAll(':scope > .content-panel'))el.hidden=true;}
  function showHome(){hideAll();home.hidden=false;toolbar.hidden=true;root.dataset.colleagueView='home';}
  function navigate(key){
    home.hidden=true;toolbar.hidden=false;current.textContent=cards.find(c=>c[0]===key)?.[1]||key;
    root.dataset.colleagueView=key;
    hideAll();
    if(panels[key])panels[key].hidden=false;
    else {const b=tabs.querySelector(`[data-tab="${key}"]`);if(b)b.click();else {const p=$('acadia-'+key);if(p)p.hidden=false;}}
    // app.js may change hidden state for the other panels; the click above keeps its normal refresh behavior.
    if(key==='aid')void drawFinancialAid();
    if(key==='banking')void drawBankLink();
    if(key==='catalog')void drawCatalog();
    if(key==='planning')void drawPlanning();
    if(key==='grades')void drawPublishedGrades();
  }
  // The Colleague Grades tile is independent of legacy tab refreshes.
  // Recreate the section if app.js has replaced the grades panel children.
  let gradeRequestSequence=0;
  async function drawPublishedGrades(){
    const panel=$('acadia-grades');
    if(!panel)return;
    const requestId=++gradeRequestSequence;
    let section=$('school-grades');
    if(!section){
      section=document.createElement('section');
      section.id='school-grades';
      section.className='school-upgrade';
    }
    // Keep the new grades before the legacy results.
    panel.prepend(section);
    section.replaceChildren();
    make('h3',section,'Grades for newly registered courses');
    make('p',section,'Loading grades...');
    try{
      const data=await api('/enrollments');
      if(requestId!==gradeRequestSequence || root.dataset.colleagueView!=='grades')return;
      section.replaceChildren();
      make('h3',section,'Grades for newly registered courses');
      const records=Array.isArray(data.enrollments)?data.enrollments:[];
      if(!records.length)make('p',section,'No registered courses found.');
      for(const course of records){
        const published=course.grade!==null && course.grade!==undefined && course.grade!=='';
        make('p',section,`${course.code} — ${course.title}: ${published?course.grade+'%':'Not published'}`);
      }
    }catch(error){
      if(requestId!==gradeRequestSequence)return;
      section.replaceChildren();
      make('h3',section,'Grades for newly registered courses');
      make('p',section,'Unable to load grades: '+error.message);
    }
  }
  const catalogArea=make('section',catalog,'');catalogArea.className='colleague-catalog';
  const planningArea=make('section',planning,'');planningArea.className='colleague-planning';
  async function drawCatalog(){
    catalogArea.replaceChildren();make('h3',catalogArea,'Search for Courses and Course Sections');
    const filters=make('div',catalogArea);filters.className='colleague-filters';
    const search=make('input',filters);search.placeholder='Search course code, title or professor';search.setAttribute('aria-label','Search courses');
    const term=make('select',filters);term.setAttribute('aria-label','Term');
    const subject=make('select',filters);subject.setAttribute('aria-label','Subject');
    const result=make('div',catalogArea);result.className='colleague-results';
    try{
      const data=await api('/catalog');const rows=data.catalog||[];
      for(const [sel,values,all] of [[term,[...new Set(rows.map(c=>c.term))],'All terms'],[subject,[...new Set(rows.map(c=>c.code.split(' ')[0]))],'All subjects']]){
        const o=make('option',sel,all);o.value='';for(const value of values){const option=make('option',sel,value);option.value=value}
      }
      function render(){result.replaceChildren();const q=search.value.trim().toLowerCase();const shown=rows.filter(c=>(!q||[c.code,c.title,c.instructor,c.description].some(x=>String(x||'').toLowerCase().includes(q)))&&(!term.value||c.term===term.value)&&(!subject.value||c.code.startsWith(subject.value+' ')));
        if(!shown.length)make('p',result,'No courses match these filters.');
        for(const c of shown){const card=make('article',result);card.className='colleague-course';const h=make('h4',card,`${c.code} — ${c.title}`);h.className='colleague-course-title';make('p',card,c.description||'Course description not yet provided by the administrator.');const info=make('dl',card);info.className='colleague-course-meta';for(const [k,v] of [['Term',c.term],['Credits',c.credits??3],['Professor',c.instructor||'TBA'],['Day',c.weekday],['Start',String(c.start_time||'').slice(0,5)],['End',c.end_time?String(c.end_time).slice(0,5):'TBA'],['Location',c.location||'TBA'],['Tuition',money(c.tuition_cents)]]){make('dt',info,k);make('dd',info,String(v??'TBA'))}
          const button=make('button',card,getPlan().includes(Number(c.id))?'Added to Plan':'Add Course to Plan');button.type='button';button.disabled=getPlan().includes(Number(c.id));button.addEventListener('click',()=>{const ids=getPlan();if(!ids.includes(Number(c.id)))ids.push(Number(c.id));setPlan(ids);button.textContent='Added to Plan';button.disabled=true;});
        }
      }
      search.addEventListener('input',render);term.addEventListener('change',render);subject.addEventListener('change',render);render();
    }catch(e){make('p',result,'Unable to load course catalog: '+e.message)}
  }
  async function drawPlanning(){
    planningArea.replaceChildren();
    make('h3',planningArea,'Student Planning');
    make('p',planningArea,'Choose My Schedule or View My Progress. Your course plan is shown separately below.');
    const choices=make('div',planningArea);choices.className='colleague-filters';
    const scheduleBtn=make('button',choices,'My Schedule');scheduleBtn.type='button';
    const progressBtn=make('button',choices,'View My Progress');progressBtn.type='button';
    const catalogBtn=make('button',choices,'Find Courses');catalogBtn.type='button';catalogBtn.onclick=()=>navigate('catalog');
    const detail=make('section',planningArea);detail.className='colleague-planning-detail';
    async function showSchedule(){
      detail.replaceChildren();make('h4',detail,'Weekly Class Schedule');
      try{const data=await api('/enrollments');const all=data.enrollments||[];
        const term=make('select',detail);term.setAttribute('aria-label','Select term');
        const terms=[...new Set(all.map(x=>x.term))].sort();for(const t of terms){const o=make('option',term,t);o.value=t;}
        const board=make('div',detail);board.className='colleague-week';
        function draw(){board.replaceChildren();for(const day of ['Monday','Tuesday','Wednesday','Thursday','Friday']){
          const col=make('div',board);col.className='colleague-day';make('strong',col,day);
          const events=all.filter(e=>e.term===term.value&&e.weekday===day).sort((a,b)=>String(a.start_time).localeCompare(String(b.start_time)));
          if(!events.length)make('small',col,'No classes');
          for(const e of events){const ev=make('div',col);ev.className='colleague-event';make('strong',ev,e.code);make('small',ev,`${String(e.start_time||'').slice(0,5)} · ${e.title}`);}
        }}
        if(!all.length)make('p',detail,'No registered courses yet. Add courses to your plan and register.');
        else {term.onchange=draw;draw();}
        make('p',detail,'Schedule shows courses registered in the upgraded portal. Older legacy records may not be included.');
      }catch(e){make('p',detail,'Unable to load schedule: '+e.message)}
    }
    async function showProgress(){
      detail.replaceChildren();make('h4',detail,'My Degree Progress');
      try{const d=await api('/degree-progress');make('p',detail,`Selected degree/program: ${d.program}`);
        if(!d.configured){make('p',detail,'No degree requirements have been configured for this exact program name. Ask the simulator administrator to set required courses. This is not a graduation application.');return;}
        make('p',detail,`${d.completed} of ${d.total} configured required courses completed (${Math.round(d.completed/d.total*100)}%).`);
        const list=make('div',detail);for(const r of d.requirements){const line=make('p',list);line.textContent=`${r.code} — ${r.status==='completed'?'Completed':r.status==='in_progress'?'In progress':'Remaining'}`;}
        make('p',detail,d.note);
      }catch(e){make('p',detail,'Unable to load degree progress: '+e.message+' (Run degree-progress.sql first.)')}
    }
    scheduleBtn.onclick=showSchedule;progressBtn.onclick=showProgress;
    make('h4',planningArea,'My Planned Courses');const list=make('div',planningArea);
    try{const [cat,registered]=await Promise.all([api('/catalog'),api('/enrollments')]);const planned=getPlan();const courses=cat.catalog||[];const enrollments=registered.enrollments||[];
      if(!planned.length)make('p',list,'No planned courses yet. Use Find Courses to add them.');
      for(const id of planned){const c=courses.find(x=>Number(x.id)===id);if(!c)continue;const line=make('div',list);line.className='colleague-course';make('strong',line,`${c.code} — ${c.title} (${c.term})`);const status=make('p',line);const registeredAlready=enrollments.some(e=>e.code===c.code&&e.term===c.term);status.textContent=registeredAlready?'Registered':`Tuition on registration: ${money(c.tuition_cents)}`;
        if(!registeredAlready){const register=make('button',line,'Register for Section');register.type='button';register.onclick=async()=>{register.disabled=true;try{await send('/enrollments',{catalogId:id});await drawPlanning();if(typeof window.loadAcadiaFromBackend==='function')await window.loadAcadiaFromBackend()}catch(e){status.textContent=e.message;register.disabled=false}}}
        const remove=make('button',line,'Remove from Plan');remove.type='button';remove.className='colleague-secondary';remove.onclick=()=>{setPlan(getPlan().filter(x=>x!==id));void drawPlanning()};
      }
    }catch(e){make('p',list,'Unable to load course plan: '+e.message)}
    await showSchedule();
  }
  // Legacy panels remain in the DOM for their existing event handlers and data loaders.
  // Their navigation is hidden and the new dashboard is the student entry point.
  const observer=new MutationObserver(()=>{if(!root.hidden&&!root.dataset.colleagueView)showHome()});observer.observe(root,{attributes:true,attributeFilter:['hidden']});
  if(!root.hidden)showHome();
});
