import express from 'express';
export function installSchoolRoutes(app,pool,requireAcadiaRole){
 const student=requireAcadiaRole('student'),admin=requireAcadiaRole('admin');
 const bad=(res,e)=>{console.error('[SCHOOL ERROR]',e);res.status(500).json({error:'School operation failed; see server log'});};
 const text=v=>typeof v==='string'?v.trim():'';
 app.get('/api/school/catalog',student,async(req,res)=>{try{const q=await pool.query('SELECT id,code,title,term,instructor,weekday,start_time,end_time,location,description,credits,tuition_cents FROM acadia_catalog WHERE active=true ORDER BY code');res.json({catalog:q.rows});}catch(e){bad(res,e)}});
 app.get('/api/school/enrollments',student,async(req,res)=>{try{const q=await pool.query(`SELECT e.id,c.code,c.title,c.term,c.weekday,c.start_time,c.tuition_cents,e.grade FROM acadia_enrollments e JOIN acadia_catalog c ON c.id=e.catalog_id WHERE e.student_user_id=$1 ORDER BY c.term,c.code`,[req.session.userId]);res.json({enrollments:q.rows});}catch(e){bad(res,e)}});
 app.post('/api/school/enrollments',student,async(req,res)=>{
 const id=Number(req.body?.catalogId);if(!Number.isSafeInteger(id)||id<1)return res.status(400).json({error:'Select a course'});
 const client=await pool.connect().catch(e=>{bad(res,e);return null});if(!client)return;
 try{await client.query('BEGIN');await client.query('SELECT user_id FROM student_profiles WHERE user_id=$1 FOR UPDATE',[req.session.userId]);
 const c=await client.query('SELECT * FROM acadia_catalog WHERE id=$1 AND active=true',[id]);if(!c.rowCount){await client.query('ROLLBACK');return res.status(404).json({error:'Course unavailable'});}
 const course=c.rows[0];const dup=await client.query('SELECT 1 FROM acadia_enrollments WHERE student_user_id=$1 AND catalog_id=$2',[req.session.userId,id]);
 const legacy=await client.query('SELECT 1 FROM student_courses WHERE user_id=$1 AND code=$2 AND term=$3',[req.session.userId,course.code,course.term]);
 if(dup.rowCount||legacy.rowCount){await client.query('ROLLBACK');return res.status(409).json({error:'Already registered for this course'});}
 const conflict=await client.query(`SELECT 1 FROM acadia_enrollments e JOIN acadia_catalog c ON c.id=e.catalog_id WHERE e.student_user_id=$1 AND c.term=$2 AND c.weekday=$3 AND c.start_time=$4`,[req.session.userId,course.term,course.weekday,course.start_time]);
 if(conflict.rowCount){await client.query('ROLLBACK');return res.status(409).json({error:'Schedule conflict'});}
 await client.query('INSERT INTO acadia_enrollments(student_user_id,catalog_id) VALUES($1,$2)',[req.session.userId,id]);
 await client.query('UPDATE student_profiles SET tuition_cents=tuition_cents+300000 WHERE user_id=$1',[req.session.userId]);
 await client.query('INSERT INTO acadia_finance_entries(student_user_id,description,amount_cents,source_key) VALUES($1,$2,300000,$3)',[req.session.userId,`Course tuition: ${course.code} (${course.term})`,`course:${id}`]);
 await client.query('COMMIT');res.status(201).json({message:'Course registered; $3,000 tuition charged'});
 }catch(e){await client.query('ROLLBACK').catch(()=>{});bad(res,e)}finally{client.release()}
 });
 app.get('/api/school/finance',student,async(req,res)=>{try{const [entries,profile]=await Promise.all([pool.query('SELECT description,amount_cents,created_at FROM acadia_finance_entries WHERE student_user_id=$1 ORDER BY id DESC',[req.session.userId]),pool.query('SELECT tuition_cents FROM student_profiles WHERE user_id=$1',[req.session.userId])]);res.json({entries:entries.rows,balanceCents:profile.rows[0]?.tuition_cents??0,openingBalanceNote:'Existing balance and historical payments are preserved; listed charges are new charges after upgrade.'});}catch(e){bad(res,e)}});
 app.get('/api/school/profile-requests',student,async(req,res)=>{try{const q=await pool.query('SELECT id,proposed_name,proposed_program,proposed_year,status,admin_note,created_at FROM acadia_profile_requests WHERE student_user_id=$1 ORDER BY id DESC',[req.session.userId]);res.json({requests:q.rows});}catch(e){bad(res,e)}});
 app.post('/api/school/profile-requests',student,async(req,res)=>{const name=text(req.body?.name),program=text(req.body?.program),year=Number(req.body?.year);if(!name||name.length>100||!program||program.length>120||!Number.isInteger(year)||year<1||year>8)return res.status(400).json({error:'Enter valid name, program and year (1–8)'});try{await pool.query('INSERT INTO acadia_profile_requests(student_user_id,proposed_name,proposed_program,proposed_year) VALUES($1,$2,$3,$4)',[req.session.userId,name,program,year]);res.status(201).json({message:'Request submitted for administrator review'});}catch(e){bad(res,e)}});
 app.get('/api/school/admin/students',admin,async(req,res)=>{try{const q=await pool.query(`SELECT u.id,u.username,sp.display_name,sp.program,sp.year_of_study,sp.tuition_cents FROM users u JOIN student_profiles sp ON sp.user_id=u.id WHERE u.app='acadia' AND u.role='student' ORDER BY u.username LIMIT 200`);res.json({students:q.rows});}catch(e){bad(res,e)}});
 app.get('/api/school/admin/requests',admin,async(req,res)=>{try{const q=await pool.query(`SELECT r.*,u.username FROM acadia_profile_requests r JOIN users u ON u.id=r.student_user_id WHERE r.status='pending' ORDER BY r.id`);res.json({requests:q.rows});}catch(e){bad(res,e)}});
 app.post('/api/school/admin/requests/:id',admin,async(req,res)=>{const id=Number(req.params.id),decision=req.body?.decision,note=text(req.body?.note).slice(0,500);if(!Number.isSafeInteger(id)||!['approved','rejected'].includes(decision))return res.status(400).json({error:'Invalid review'});const c=await pool.connect();try{await c.query('BEGIN');const q=await c.query("SELECT * FROM acadia_profile_requests WHERE id=$1 AND status='pending' FOR UPDATE",[id]);if(!q.rowCount){await c.query('ROLLBACK');return res.status(404).json({error:'Pending request not found'});}const r=q.rows[0];if(decision==='approved')await c.query('UPDATE student_profiles SET display_name=$1,program=$2,year_of_study=$3 WHERE user_id=$4',[r.proposed_name,r.proposed_program,r.proposed_year,r.student_user_id]);await c.query('UPDATE acadia_profile_requests SET status=$1,admin_note=$2,reviewed_by=$3,reviewed_at=now() WHERE id=$4',[decision,note,req.session.userId,id]);await c.query('INSERT INTO acadia_admin_audit(admin_user_id,action,target_user_id,detail) VALUES($1,$2,$3,$4)',[req.session.userId,'profile_'+decision,r.student_user_id,`request:${id}`]);await c.query('COMMIT');res.json({message:'Request '+decision});}catch(e){await c.query('ROLLBACK').catch(()=>{});bad(res,e)}finally{c.release()}});
 app.get('/api/school/admin/enrollments',admin,async(req,res)=>{try{const q=await pool.query(`SELECT e.id,u.username,c.code,c.title,c.term,e.grade FROM acadia_enrollments e JOIN users u ON u.id=e.student_user_id JOIN acadia_catalog c ON c.id=e.catalog_id ORDER BY u.username,c.code`);res.json({enrollments:q.rows});}catch(e){bad(res,e)}});
 // Grade publishing remains restricted to authenticated school administrators.
 app.post('/api/school/admin/grades',admin,async(req,res)=>{
  const id=Number(req.body?.enrollmentId), grade=text(req.body?.grade);
  if(!Number.isSafeInteger(id)||id<1||!/^\d{1,3}(?:\.\d{1,2})?$/.test(grade)||Number(grade)>100)
   return res.status(400).json({error:'Enter a grade from 0 to 100'});
  let c;
  try{
   c=await pool.connect(); await c.query('BEGIN');
   const old=await c.query('SELECT student_user_id,grade FROM acadia_enrollments WHERE id=$1 FOR UPDATE',[id]);
   if(!old.rowCount){await c.query('ROLLBACK');return res.status(404).json({error:'Enrollment not found'});}
   const current=await c.query('UPDATE acadia_enrollments SET grade=$1 WHERE id=$2 RETURNING grade',[grade,id]);
   const saved=await c.query('INSERT INTO grade_recovery(enrollment_id,administrator_id,original_grade,published_grade) VALUES($1,$2,$3,$4) RETURNING id',[id,req.session.userId,old.rows[0].grade,current.rows[0].grade]);
   await c.query('INSERT INTO acadia_admin_audit(admin_user_id,action,target_user_id,detail) VALUES($1,$2,$3,$4)',[req.session.userId,'grade_update',old.rows[0].student_user_id,`enrollment:${id}`]);
   await c.query('COMMIT');
   res.json({message:'Grade published',original:old.rows[0].grade,current:current.rows[0].grade,recoveryId:saved.rows[0].id});
  }catch(e){if(c)await c.query('ROLLBACK').catch(()=>{});bad(res,e)}finally{if(c)c.release()}
 });
 app.get('/api/school/admin/grade-recovery',admin,async(req,res)=>{
  try{const q=await pool.query('SELECT * FROM grade_recovery WHERE administrator_id=$1 ORDER BY id DESC LIMIT 100',[req.session.userId]);res.json({records:q.rows})}catch(e){bad(res,e)}
 });
 app.post('/api/school/admin/grade-recovery/:id/restore',admin,async(req,res)=>{
  const id=Number(req.params.id);if(!Number.isSafeInteger(id)||id<1)return res.status(400).json({error:'Invalid recovery ID'});
  let c;
  try{
   c=await pool.connect();await c.query('BEGIN');
   const r=await c.query('SELECT * FROM grade_recovery WHERE id=$1 AND administrator_id=$2 AND restored_at IS NULL FOR UPDATE',[id,req.session.userId]);
   if(!r.rowCount){await c.query('ROLLBACK');return res.status(404).json({error:'Pending recovery not found'});}
   const row=r.rows[0];
   const q=await c.query('SELECT grade,student_user_id FROM acadia_enrollments WHERE id=$1 FOR UPDATE',[row.enrollment_id]);
   if(!q.rowCount||String(q.rows[0].grade)!==row.published_grade){await c.query('ROLLBACK');return res.status(409).json({error:'Grade changed since publication; review manually'});}
   const changed=await c.query('UPDATE acadia_enrollments SET grade=$1 WHERE id=$2 RETURNING grade',[row.original_grade,row.enrollment_id]);
   await c.query('UPDATE grade_recovery SET restored_at=now() WHERE id=$1',[id]);
   await c.query('INSERT INTO acadia_admin_audit(admin_user_id,action,target_user_id,detail) VALUES($1,$2,$3,$4)',[req.session.userId,'grade_restore',q.rows[0].student_user_id,`enrollment:${row.enrollment_id}`]);
   await c.query('COMMIT');res.json({message:'Grade restored',current:changed.rows[0].grade});
  }catch(e){if(c)await c.query('ROLLBACK').catch(()=>{});bad(res,e)}finally{if(c)c.release()}
 });
 app.post('/api/school/admin/catalog',admin,async(req,res)=>{const code=text(req.body?.code).toUpperCase(),title=text(req.body?.title),term=text(req.body?.term)||'Fall 2026',weekday=text(req.body?.weekday)||'Monday',time=text(req.body?.startTime)||'09:00';if(!/^[A-Z]{2,6} [0-9]{3,4}$/.test(code)||!title||title.length>150||term.length>40||!['Monday','Tuesday','Wednesday','Thursday','Friday'].includes(weekday)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))return res.status(400).json({error:'Invalid course details'});try{const q=await pool.query(`INSERT INTO acadia_catalog(code,title,term,weekday,start_time) VALUES($1,$2,$3,$4,$5) ON CONFLICT(code) DO UPDATE SET title=EXCLUDED.title,term=EXCLUDED.term,weekday=EXCLUDED.weekday,start_time=EXCLUDED.start_time RETURNING id`,[code,title,term,weekday,time]);res.json({message:'Course saved',id:q.rows[0].id});}catch(e){bad(res,e)}});
 // Course manager: all routes require authenticated Acadia administrator.
 const validId=v=>Number.isSafeInteger(Number(v))&&Number(v)>0;
 const validTime=v=>/^([01]\d|2[0-3]):[0-5]\d$/.test(v);
 const audit=async(c,uid,action,target,detail)=>c.query('INSERT INTO acadia_admin_audit(admin_user_id,action,target_user_id,detail) VALUES($1,$2,$3,$4)',[uid,action,target,detail]);
 app.get('/api/school/degree-progress',student,async(req,res)=>{try{
  const p=await pool.query('SELECT program FROM student_profiles WHERE user_id=$1',[req.session.userId]);
  if(!p.rowCount)return res.status(404).json({error:'Student profile not found'});
  const program=p.rows[0].program;
  const reqs=await pool.query('SELECT course_code FROM acadia_degree_requirements WHERE program=$1 AND required=true ORDER BY course_code',[program]);
  const grades=await pool.query(`SELECT c.code,e.grade FROM acadia_enrollments e JOIN acadia_catalog c ON c.id=e.catalog_id WHERE e.student_user_id=$1`,[req.session.userId]);
  const items=reqs.rows.map(r=>{const records=grades.rows.filter(e=>e.code===r.course_code);const passed=records.some(e=>e.grade!==null&&Number(e.grade)>=50);return {code:r.course_code,status:passed?'completed':records.length?'in_progress':'remaining'};});
  res.json({program,configured:items.length>0,requirements:items,completed:items.filter(x=>x.status==='completed').length,total:items.length,note:'Simulator requirement rules; completed means a published numeric grade of at least 50. Legacy grades and other program rules are not included.'});
 }catch(e){bad(res,e)}});
 app.get('/api/school/admin/degree-requirements',admin,async(req,res)=>{try{const q=await pool.query('SELECT id,program,course_code FROM acadia_degree_requirements ORDER BY program,course_code');res.json({requirements:q.rows})}catch(e){bad(res,e)}});
 app.post('/api/school/admin/degree-requirements',admin,async(req,res)=>{const program=text(req.body?.program),code=text(req.body?.code).toUpperCase();if(!program||program.length>120||!/^[A-Z]{2,6} [0-9]{3,4}$/.test(code))return res.status(400).json({error:'Enter a program name and course code'});try{await pool.query('INSERT INTO acadia_degree_requirements(program,course_code) VALUES($1,$2) ON CONFLICT DO NOTHING',[program,code]);res.json({message:'Degree requirement saved'})}catch(e){bad(res,e)}});
 app.delete('/api/school/admin/degree-requirements/:id',admin,async(req,res)=>{const id=Number(req.params.id);if(!Number.isSafeInteger(id)||id<1)return res.status(400).json({error:'Invalid requirement'});try{await pool.query('DELETE FROM acadia_degree_requirements WHERE id=$1',[id]);res.json({message:'Requirement removed'})}catch(e){bad(res,e)}});
 app.get('/api/school/admin/course-manager/catalog',admin,async(req,res)=>{
  try {const q=await pool.query('SELECT * FROM acadia_catalog ORDER BY code');res.json({catalog:q.rows});}catch(e){bad(res,e)}
 });
 app.post('/api/school/admin/course-manager/catalog',admin,async(req,res)=>{
  const x=req.body||{}, code=text(x.code).toUpperCase(),title=text(x.title),term=text(x.term),weekday=text(x.weekday),start=text(x.startTime),end=text(x.endTime),faculty=text(x.faculty),subject=text(x.subject),section=text(x.section)||'FA01',instructor=text(x.instructor)||'TBA',location=text(x.location)||'TBA',description=text(x.description),credits=Number(x.credits),capacity=Number(x.capacity);
  if(!/^[A-Z]{2,6} [0-9]{3,4}$/.test(code)||!title||title.length>150||!term||term.length>40||!['Monday','Tuesday','Wednesday','Thursday','Friday'].includes(weekday)||!validTime(start)||!validTime(end)||end<=start||!faculty||!subject||![faculty,subject,section,instructor,location].every(s=>s.length<=120)||description.length>2000||!Number.isInteger(credits)||credits<0||credits>12||!Number.isInteger(capacity)||capacity<1||capacity>1000)return res.status(400).json({error:'Check course code, title, times, faculty, subject, credits and capacity.'});
  const c=await pool.connect().catch(e=>{bad(res,e);return null});if(!c)return;
  try{await c.query('BEGIN');const q=await c.query(`INSERT INTO acadia_catalog(code,title,term,instructor,weekday,start_time,end_time,location,description,credits,faculty,subject,section,capacity) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT(code) DO UPDATE SET title=EXCLUDED.title,term=EXCLUDED.term,instructor=EXCLUDED.instructor,weekday=EXCLUDED.weekday,start_time=EXCLUDED.start_time,end_time=EXCLUDED.end_time,location=EXCLUDED.location,description=EXCLUDED.description,credits=EXCLUDED.credits,faculty=EXCLUDED.faculty,subject=EXCLUDED.subject,section=EXCLUDED.section,capacity=EXCLUDED.capacity RETURNING id`,[code,title,term,instructor,weekday,start,end,location,description,credits,faculty,subject,section,capacity]);await audit(c,req.session.userId,'course_save',null,`catalog:${q.rows[0].id} ${code}`);await c.query('COMMIT');res.json({message:'Course saved',id:q.rows[0].id});}catch(e){await c.query('ROLLBACK').catch(()=>{});bad(res,e)}finally{c.release()}
 });
 app.get('/api/school/admin/course-manager/students',admin,async(req,res)=>{
  const q=text(req.query.q);if(q.length<1)return res.json({students:[]});
  try{const result=await pool.query(`SELECT u.id,u.username,sp.display_name,sp.program,sp.year_of_study FROM users u JOIN student_profiles sp ON sp.user_id=u.id WHERE u.app='acadia' AND u.role='student' AND (u.username ILIKE $1 OR sp.display_name ILIKE $1 OR u.id::text=$2 OR ('AC'||lpad(u.id::text,8,'0'))=upper($2)) ORDER BY u.username LIMIT 30`,[`%${q.slice(0,80)}%`,q.slice(0,80)]);res.json({students:result.rows});}catch(e){bad(res,e)}
 });
 app.get('/api/school/admin/course-manager/student/:id',admin,async(req,res)=>{
  if(!validId(req.params.id))return res.status(400).json({error:'Invalid student'});
  try{const q=await pool.query(`SELECT e.id,c.code,c.title,c.term,e.grade,c.id AS catalog_id FROM acadia_enrollments e JOIN acadia_catalog c ON c.id=e.catalog_id WHERE e.student_user_id=$1 ORDER BY c.term,c.code`,[req.params.id]);res.json({enrollments:q.rows});}catch(e){bad(res,e)}
 });
 async function enrollAsAdmin(client,studentId,catalogId,adminId){
  const p=await client.query(`SELECT u.id FROM users u JOIN student_profiles sp ON sp.user_id=u.id WHERE u.id=$1 AND u.app='acadia' AND u.role='student' FOR UPDATE OF sp`,[studentId]);
  if(!p.rowCount)return {error:'Student not found',status:404};
  const cq=await client.query('SELECT * FROM acadia_catalog WHERE id=$1 AND active=true',[catalogId]);if(!cq.rowCount)return {error:'Course not found',status:404};
  const course=cq.rows[0];
  const d=await client.query('SELECT 1 FROM acadia_enrollments WHERE student_user_id=$1 AND catalog_id=$2',[studentId,catalogId]);
  const legacy=await client.query('SELECT 1 FROM student_courses WHERE user_id=$1 AND code=$2 AND term=$3',[studentId,course.code,course.term]);
  if(d.rowCount||legacy.rowCount)return {error:'Student already registered',status:409};
  const conflict=await client.query(`SELECT 1 FROM acadia_enrollments e JOIN acadia_catalog c ON c.id=e.catalog_id WHERE e.student_user_id=$1 AND c.term=$2 AND c.weekday=$3 AND c.start_time=$4`,[studentId,course.term,course.weekday,course.start_time]);
  if(conflict.rowCount)return {error:'Schedule conflict',status:409};
  const count=await client.query('SELECT count(*)::int AS n FROM acadia_enrollments WHERE catalog_id=$1',[catalogId]);
  if(count.rows[0].n>=course.capacity)return {error:'Course is full',status:409};
  await client.query('INSERT INTO acadia_enrollments(student_user_id,catalog_id) VALUES($1,$2)',[studentId,catalogId]);
  const fee=await client.query(`INSERT INTO acadia_finance_entries(student_user_id,description,amount_cents,source_key) VALUES($1,$2,300000,$3) ON CONFLICT(student_user_id,source_key) DO NOTHING RETURNING id`,[studentId,`Course tuition: ${course.code} (${course.term})`,`course:${catalogId}`]);
  if(fee.rowCount)await client.query('UPDATE student_profiles SET tuition_cents=tuition_cents+300000 WHERE user_id=$1',[studentId]);
  await audit(client,adminId,'admin_course_assign',studentId,`catalog:${catalogId} ${course.code}`);
  return {message:'Course assigned',charged:!!fee.rowCount};
 }
 app.post('/api/school/admin/course-manager/assign',admin,async(req,res)=>{
  const studentId=Number(req.body?.studentId),catalogId=Number(req.body?.catalogId);if(!validId(studentId)||!validId(catalogId))return res.status(400).json({error:'Select a student and course'});
  const c=await pool.connect().catch(e=>{bad(res,e);return null});if(!c)return;
  try{await c.query('BEGIN');const result=await enrollAsAdmin(c,studentId,catalogId,req.session.userId);if(result.error){await c.query('ROLLBACK');return res.status(result.status).json(result);}await c.query('COMMIT');res.status(201).json(result);}catch(e){await c.query('ROLLBACK').catch(()=>{});bad(res,e)}finally{c.release()}
 });
 app.get('/api/school/admin/course-manager/defaults',admin,async(req,res)=>{
  try{const q=await pool.query(`SELECT d.id,d.program,d.year_of_study,d.catalog_id,c.code,c.title FROM acadia_default_courses d JOIN acadia_catalog c ON c.id=d.catalog_id ORDER BY d.program,d.year_of_study,c.code`);res.json({defaults:q.rows});}catch(e){bad(res,e)}
 });
 app.post('/api/school/admin/course-manager/defaults',admin,async(req,res)=>{
  const program=text(req.body?.program),year=Number(req.body?.year),catalogId=Number(req.body?.catalogId);
  if(!program||program.length>120||!Number.isInteger(year)||year<1||year>8||!validId(catalogId))return res.status(400).json({error:'Choose program, year and course'});
  try{await pool.query('INSERT INTO acadia_default_courses(program,year_of_study,catalog_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[program,year,catalogId]);res.json({message:'Default course saved. Apply it to students separately.'});}catch(e){bad(res,e)}
 });
 app.post('/api/school/admin/course-manager/apply-defaults',admin,async(req,res)=>{
  const studentId=Number(req.body?.studentId);if(!validId(studentId))return res.status(400).json({error:'Select student'});
  const c=await pool.connect().catch(e=>{bad(res,e);return null});if(!c)return;
  try{await c.query('BEGIN');const p=await c.query('SELECT program,year_of_study FROM student_profiles WHERE user_id=$1',[studentId]);if(!p.rowCount){await c.query('ROLLBACK');return res.status(404).json({error:'Student not found'});}
   const defaults=await c.query('SELECT catalog_id FROM acadia_default_courses WHERE lower(program)=lower($1) AND year_of_study=$2 ORDER BY id',[p.rows[0].program,p.rows[0].year_of_study]);
   let assigned=0;const skipped=[];for(const r of defaults.rows){const result=await enrollAsAdmin(c,studentId,r.catalog_id,req.session.userId);if(result.error)skipped.push(`Course ${r.catalog_id}: ${result.error}`);else assigned++;}
   await c.query('COMMIT');res.json({message:`Assigned ${assigned} default course(s)`,assigned,skipped});
  }catch(e){await c.query('ROLLBACK').catch(()=>{});bad(res,e)}finally{c.release()}
 });

}
