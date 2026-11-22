// Simulation-only self-service APIs; no real university or banking integration.
export function installSchoolServices(app,pool,requireAcadiaRole){
 const student=requireAcadiaRole('student'),admin=requireAcadiaRole('admin');

 // Simulator ledger: all monetary adjustments are atomic and auditable.
 const cents=x=>{const n=Number(x);return Number.isFinite(n)&&n>0&&n<=100000&&Math.round(n*100)===n*100?Math.round(n*100):null};
 const goodId=x=>Number.isSafeInteger(Number(x))&&Number(x)>0;
 app.get('/api/school/services/financial-aid',student,async(req,res)=>{
  try{const q=await pool.query('SELECT id,kind,description,amount_cents,applied_cents,bank_cents,pending_cents,created_at FROM school_financial_adjustments WHERE student_user_id=$1 ORDER BY id DESC LIMIT 100',[req.session.userId]);res.json({records:q.rows})}catch(e){error(res,e)}
 });
 app.get('/api/school/services/admin/finance-history/:id',admin,async(req,res)=>{
  if(!goodId(req.params.id))return res.status(400).json({error:'Invalid student'});
  try{const [p,q]=await Promise.all([pool.query('SELECT tuition_cents FROM student_profiles WHERE user_id=$1',[req.params.id]),pool.query('SELECT id,kind,description,amount_cents,applied_cents,bank_cents,pending_cents,created_at FROM school_financial_adjustments WHERE student_user_id=$1 ORDER BY id DESC LIMIT 100',[req.params.id])]);res.json({balance_cents:p.rows[0]?.tuition_cents??null,records:q.rows})}catch(e){error(res,e)}
 });
 app.post('/api/school/services/admin/finance-adjust',admin,async(req,res)=>{
  const studentId=Number(req.body?.studentId),kind=req.body?.kind,amount=cents(req.body?.dollars),description=String(req.body?.description||'').trim(),bankUsername=String(req.body?.bankUsername||'').trim();
  if(!goodId(studentId)||!['charge','reverse_charge','scholarship'].includes(kind)||amount===null||!description||description.length>150||bankUsername.length>100)return res.status(400).json({error:'Select a student, action, positive amount and description.'});
  const c=await pool.connect();try{
   await c.query('BEGIN');
   const q=await c.query('SELECT tuition_cents FROM student_profiles WHERE user_id=$1 FOR UPDATE',[studentId]);
   if(!q.rowCount){await c.query('ROLLBACK');return res.status(404).json({error:'Student not found'});}
   const balance=Number(q.rows[0].tuition_cents);let next=balance,applied=0,bank=0,pending=0;
   if(kind==='charge')next+=amount;
   if(kind==='reverse_charge'){if(amount>balance){await c.query('ROLLBACK');return res.status(409).json({error:'Reversal cannot exceed outstanding balance. Use the actual charge history.'});}next-=amount;applied=amount;}
   if(kind==='scholarship'){
    applied=Math.min(balance,amount);next-=applied;const excess=amount-applied;
    if(excess>0){
     const linked=await c.query(`SELECT l.bank_account_id, u.username
       FROM sim_student_bank_links l JOIN bank_accounts ba ON ba.id=l.bank_account_id
       JOIN users u ON u.id=ba.user_id
       WHERE l.student_user_id=$1 AND ba.kind='chequing' FOR UPDATE OF ba`,[studentId]);
     if(linked.rowCount){
       await c.query('UPDATE bank_accounts SET balance_cents=balance_cents+$1 WHERE id=$2',[excess,linked.rows[0].bank_account_id]);
       bank=excess;
     }else pending=excess;
    }
   }
   await c.query('UPDATE student_profiles SET tuition_cents=$1 WHERE user_id=$2',[next,studentId]);
   const entry=await c.query('INSERT INTO school_financial_adjustments(student_user_id,admin_user_id,kind,description,amount_cents,applied_cents,bank_cents,pending_cents,bank_username) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',[studentId,req.session.userId,kind,description,amount,applied,bank,pending,(kind==='scholarship'&&bank>0?(await c.query(`SELECT u.username FROM sim_student_bank_links l JOIN bank_accounts ba ON ba.id=l.bank_account_id JOIN users u ON u.id=ba.user_id WHERE l.student_user_id=$1`,[studentId])).rows[0]?.username:null)]);
   await c.query('INSERT INTO acadia_finance_entries(student_user_id,description,amount_cents,source_key) VALUES($1,$2,$3,$4)',[studentId,`${kind}: ${description}`,kind==='charge'?amount:-applied,`adjustment:${entry.rows[0].id}`]);
   await c.query('INSERT INTO acadia_admin_audit(admin_user_id,action,target_user_id,detail) VALUES($1,$2,$3,$4)',[req.session.userId,'finance_'+kind,studentId,`adjustment:${entry.rows[0].id}`]);
   await c.query('COMMIT');res.json({message:'Financial adjustment recorded',balance_cents:next,applied_cents:applied,bank_cents:bank,pending_cents:pending});
  }catch(e){await c.query('ROLLBACK').catch(()=>{});error(res,e)}finally{c.release()}
 });


 // Student must present both the account number and the one-time code generated
 // in an authenticated Banking app session. No real bank account is contacted.
 app.get('/api/school/services/bank-link',student,async(req,res)=>{
  try{
   const q=await pool.query(`SELECT ba.id FROM sim_student_bank_links l JOIN bank_accounts ba ON ba.id=l.bank_account_id WHERE l.student_user_id=$1`,[req.session.userId]);
   res.json({linked:!!q.rowCount,account_number:q.rowCount?'SIM'+String(q.rows[0].id).padStart(10,'0'):null});
  }catch(e){error(res,e)}
 });
 app.post('/api/school/services/bank-link',student,async(req,res)=>{
  const account=String(req.body?.account_number||'').trim().toUpperCase();
  const code=String(req.body?.verification_code||'').trim().toUpperCase();
  if(!/^SIM[0-9]{10}$/.test(account)||!/^[A-F0-9]{24}$/.test(code))return res.status(400).json({error:'Enter the simulated account number and 24-character verification code.'});
  const c=await pool.connect();
  try{
   const {createHash}=await import('node:crypto');
   await c.query('BEGIN');
   const id=Number(account.slice(3));
   const hash=createHash('sha256').update(code).digest('hex');
   const q=await c.query(`SELECT v.id FROM sim_bank_link_codes v JOIN bank_accounts ba ON ba.id=v.bank_account_id
      WHERE ba.id=$1 AND ba.kind='chequing' AND v.code_hash=$2 AND v.used_at IS NULL AND v.expires_at>now() FOR UPDATE OF v`,[id,hash]);
   if(!q.rowCount){await c.query('ROLLBACK');return res.status(403).json({error:'Account number or verification code invalid or expired.'});}
   await c.query('UPDATE sim_bank_link_codes SET used_at=now() WHERE id=$1',[q.rows[0].id]);
   await c.query(`INSERT INTO sim_student_bank_links(student_user_id,bank_account_id) VALUES($1,$2)
      ON CONFLICT(student_user_id) DO UPDATE SET bank_account_id=EXCLUDED.bank_account_id,verified_at=now()`,[req.session.userId,id]);
   // Settle previously pending scholarship refunds in the same transaction.
   const pend=await c.query(`SELECT id,pending_cents FROM school_financial_adjustments
      WHERE student_user_id=$1 AND kind='scholarship' AND pending_cents>0 FOR UPDATE`,[req.session.userId]);
   const total=pend.rows.reduce((sum,r)=>sum+Number(r.pending_cents),0);
   if(total){
    await c.query('UPDATE bank_accounts SET balance_cents=balance_cents+$1 WHERE id=$2',[total,id]);
    await c.query(`UPDATE school_financial_adjustments SET bank_cents=bank_cents+pending_cents,pending_cents=0,
       bank_username=(SELECT u.username FROM bank_accounts ba JOIN users u ON u.id=ba.user_id WHERE ba.id=$2)
       WHERE student_user_id=$1 AND kind='scholarship' AND pending_cents>0`,[req.session.userId,id]);
   }
   await c.query('COMMIT');
   res.json({linked:true,account_number:account,refunded_cents:total});
  }catch(e){await c.query('ROLLBACK').catch(()=>{});error(res,e)}finally{c.release()}
 });
 app.post('/api/school/services/bank-unlink',student,async(req,res)=>{
  try{await pool.query('DELETE FROM sim_student_bank_links WHERE student_user_id=$1',[req.session.userId]);res.json({linked:false})}catch(e){error(res,e)}
 });

 const kinds=['graduation','degree','enrollment_verification','transcript','banking_update'];
 const error=(res,e)=>{console.error('[SCHOOL SERVICES]',e);res.status(500).json({error:'School service failed. See server logs.'})};
 app.get('/api/school/services/summary',student,async(req,res)=>{try{
  const id=req.session.userId;
  const [profile,legacy,enroll,fees,attendance]=await Promise.all([
   pool.query('SELECT display_name,program,year_of_study,tuition_cents FROM student_profiles WHERE user_id=$1',[id]),
   pool.query('SELECT code,title,term,grade FROM student_courses WHERE user_id=$1 ORDER BY term,code',[id]),
   pool.query(`SELECT e.id,c.code,c.title,c.term,c.weekday,c.start_time,e.grade FROM acadia_enrollments e JOIN acadia_catalog c ON c.id=e.catalog_id WHERE e.student_user_id=$1 ORDER BY c.term,c.code`,[id]),
   pool.query('SELECT label,amount_cents FROM school_fee_definitions WHERE active=true ORDER BY label'),
   pool.query(`SELECT c.code,c.term,a.session_date,a.status FROM school_attendance a JOIN acadia_enrollments e ON e.id=a.enrollment_id JOIN acadia_catalog c ON c.id=e.catalog_id WHERE e.student_user_id=$1 ORDER BY a.session_date DESC`,[id])
  ]);
  res.json({profile:profile.rows[0]||null,legacy:legacy.rows,enrollments:enroll.rows,feeDefinitions:fees.rows,attendance:attendance.rows});
 }catch(e){error(res,e)}});
 app.get('/api/school/services/requests',student,async(req,res)=>{try{const q=await pool.query('SELECT id,kind,details,status,admin_note,created_at FROM school_service_requests WHERE student_user_id=$1 ORDER BY id DESC',[req.session.userId]);res.json({requests:q.rows})}catch(e){error(res,e)}});
 app.post('/api/school/services/requests',student,async(req,res)=>{const kind=req.body?.kind,details=String(req.body?.details??'').trim();if(!kinds.includes(kind)||!details||details.length>500)return res.status(400).json({error:'Select a service and enter details (1–500 characters).'});try{const q=await pool.query('INSERT INTO school_service_requests(student_user_id,kind,details) VALUES($1,$2,$3) RETURNING id',[req.session.userId,kind,details]);res.status(201).json({message:'Request submitted for admin review',id:q.rows[0].id})}catch(e){error(res,e)}});
 app.get('/api/school/services/admin/requests',admin,async(req,res)=>{try{const q=await pool.query(`SELECT r.id,r.kind,r.details,r.status,r.admin_note,r.created_at,u.username FROM school_service_requests r JOIN users u ON u.id=r.student_user_id ORDER BY (r.status='pending') DESC,r.id DESC LIMIT 200`);res.json({requests:q.rows})}catch(e){error(res,e)}});
 app.post('/api/school/services/admin/requests/:id',admin,async(req,res)=>{const id=Number(req.params.id),decision=req.body?.decision,note=String(req.body?.note??'').trim();if(!Number.isSafeInteger(id)||id<1||!['approved','rejected'].includes(decision)||note.length>500)return res.status(400).json({error:'Invalid decision'});const c=await pool.connect();try{await c.query('BEGIN');const q=await c.query(`UPDATE school_service_requests SET status=$1,admin_note=$2,reviewed_by=$3,reviewed_at=now() WHERE id=$4 AND status='pending' RETURNING student_user_id,kind`,[decision,note,req.session.userId,id]);if(!q.rowCount){await c.query('ROLLBACK');return res.status(409).json({error:'Request already reviewed or missing'})}await c.query('INSERT INTO acadia_admin_audit(admin_user_id,action,target_user_id,detail) VALUES($1,$2,$3,$4)',[req.session.userId,'service_'+decision,q.rows[0].student_user_id,`${q.rows[0].kind}:${id}`]);await c.query('COMMIT');res.json({message:'Request '+decision})}catch(e){await c.query('ROLLBACK').catch(()=>{});error(res,e)}finally{c.release()}});
 app.get('/api/school/services/admin/attendance',admin,async(req,res)=>{try{const q=await pool.query(`SELECT e.id AS enrollment_id,u.username,c.code,c.term FROM acadia_enrollments e JOIN users u ON u.id=e.student_user_id JOIN acadia_catalog c ON c.id=e.catalog_id ORDER BY u.username,c.code LIMIT 500`);res.json({enrollments:q.rows})}catch(e){error(res,e)}});
 app.post('/api/school/services/admin/attendance',admin,async(req,res)=>{const id=Number(req.body?.enrollmentId),date=String(req.body?.date??''),status=req.body?.status;if(!Number.isSafeInteger(id)||id<1||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!['present','absent','excused'].includes(status))return res.status(400).json({error:'Select course, valid date and attendance status'});try{const q=await pool.query(`INSERT INTO school_attendance(enrollment_id,session_date,status,updated_by) SELECT id,$2::date,$3,$4 FROM acadia_enrollments WHERE id=$1 ON CONFLICT(enrollment_id,session_date) DO UPDATE SET status=EXCLUDED.status,updated_by=EXCLUDED.updated_by RETURNING id`,[id,date,status,req.session.userId]);if(!q.rowCount)return res.status(404).json({error:'Enrollment not found'});res.json({message:'Attendance saved'})}catch(e){error(res,e)}});
 app.post('/api/school/services/admin/charge-fee',admin,async(req,res)=>{
  const studentId=Number(req.body?.studentId),feeId=Number(req.body?.feeId),term=String(req.body?.term??'').trim();
  if(!Number.isSafeInteger(studentId)||studentId<1||!Number.isSafeInteger(feeId)||feeId<1||!term||term.length>40)return res.status(400).json({error:'Select student, fee and term'});
  const c=await pool.connect();try{await c.query('BEGIN');
   const profile=await c.query('SELECT user_id FROM student_profiles WHERE user_id=$1 FOR UPDATE',[studentId]);if(!profile.rowCount){await c.query('ROLLBACK');return res.status(404).json({error:'Student not found'})}
   const f=await c.query('SELECT label,amount_cents FROM school_fee_definitions WHERE id=$1 AND active=true',[feeId]);if(!f.rowCount){await c.query('ROLLBACK');return res.status(404).json({error:'Fee not found'})}
   const fee=f.rows[0],key=`fee:${feeId}:${term}`;
   const q=await c.query('INSERT INTO acadia_finance_entries(student_user_id,description,amount_cents,source_key) VALUES($1,$2,$3,$4) ON CONFLICT(student_user_id,source_key) DO NOTHING RETURNING id',[studentId,`${fee.label} (${term})`,fee.amount_cents,key]);
   if(!q.rowCount){await c.query('ROLLBACK');return res.status(409).json({error:'This fee was already charged for that term'})}
   await c.query('UPDATE student_profiles SET tuition_cents=tuition_cents+$1 WHERE user_id=$2',[fee.amount_cents,studentId]);
   await c.query('INSERT INTO acadia_admin_audit(admin_user_id,action,target_user_id,detail) VALUES($1,$2,$3,$4)',[req.session.userId,'fee_charge',studentId,key]);
   await c.query('COMMIT');res.json({message:'Fee charged to student account'})
  }catch(e){await c.query('ROLLBACK').catch(()=>{});error(res,e)}finally{c.release()}
 });
 app.get('/api/school/services/admin/fees',admin,async(req,res)=>{try{const q=await pool.query('SELECT id,label,amount_cents,active FROM school_fee_definitions ORDER BY label');res.json({fees:q.rows})}catch(e){error(res,e)}});
 app.post('/api/school/services/admin/fees',admin,async(req,res)=>{const label=String(req.body?.label??'').trim(),dollars=Number(req.body?.dollars);if(!label||label.length>100||!Number.isFinite(dollars)||dollars<0||dollars>100000||Math.round(dollars*100)!==dollars*100)return res.status(400).json({error:'Valid label and dollar amount required'});try{await pool.query(`INSERT INTO school_fee_definitions(label,amount_cents) VALUES($1,$2) ON CONFLICT(label) DO UPDATE SET amount_cents=EXCLUDED.amount_cents,active=true`,[label,Math.round(dollars*100)]);res.json({message:'Fee definition saved. Existing balances were not modified.'})}catch(e){error(res,e)}});
}
