import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {PGlite} from '@electric-sql/pglite'
const migration=fs.readFileSync('supabase/migrations/20261104201355_qa16_driver_review_and_finance.sql','utf8')
const id='00000000-0000-4000-8000-000000000001'
async function database(){
 const db=new PGlite()
 await db.exec(`
 create role anon;create role authenticated;create role service_role;
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create schema godrop_private;create function godrop_private.admin_has_scope(uuid,text) returns boolean language sql as 'select true';
 create table users(id uuid,role text,account_status text);
 create table addresses(id uuid default gen_random_uuid());
 create table support_tickets(id uuid);
 create table driver_profiles(id uuid primary key,status text,is_online boolean,verification_submitted_at timestamptz);
 create table driver_vehicles(driver_id uuid,vehicle_type text,registration_number text,colour text,make text,model text,driving_licence_details text,insurance_details text);
 create table driver_documents(driver_id uuid,document_type text,review_status text,file_url text,reviewed_at timestamptz);
 create table delivery_requests(id uuid,driver_id uuid,status text,price numeric,driver_earning_quote numeric,delivered_at timestamptz,created_at timestamp,tracking_number text,pickup_address text);
 create table payments(id uuid,amount numeric,related_delivery_id uuid);
 create table payouts(id uuid default gen_random_uuid(),driver_id uuid,status text,amount numeric,processed_at timestamptz,created_at timestamp,payment_reference text,provider jsonb);
 create table driver_earnings(id uuid default gen_random_uuid(),driver_id uuid,delivery_id uuid,source_payment_id uuid,recovery_delivery_id uuid,amount numeric,commission_amount numeric,status text,created_at timestamp);
 create function driver_compliance_ready(uuid) returns boolean language sql as 'select true';
 insert into users values('${id}','driver','active');
 insert into driver_profiles values('${id}','approved',true,now());
 insert into driver_vehicles values('${id}','car','AB12 XYZ','TEST','Make','Model',null,null);
 insert into driver_documents values('${id}','identity','approved','previous',now());
 `)
 await db.exec(migration)
 await db.exec(`create trigger review_vehicle_change before insert or update or delete on driver_vehicles for each row execute function review_driver_compliance_change();
 create trigger review_document_change before insert or update or delete on driver_documents for each row execute function review_driver_compliance_change();`)
 return db
}
test('Cosmetic edits keep approval and online status; actual changes pause new jobs and approval restores duty',async()=>{
 const db=await database()
 try{
  const state=async()=> (await db.query('select status,is_online,review_resume_online,review_changed_fields from driver_profiles')).rows[0]
  await db.exec("insert into delivery_requests(driver_id,status) select id,'accepted' from users; update driver_vehicles set colour='TEST2', make='Make corrected', model='Model corrected', registration_number='ab12xyz'")
  assert.deepEqual(await state(),{status:'approved',is_online:true,review_resume_online:null,review_changed_fields:[]})
  await assert.rejects(db.exec("update driver_vehicles set registration_number='ZZ12ZZZ'"),/finish_active_job/)
  await db.exec("update delivery_requests set status='delivered'; update driver_vehicles set registration_number='ZZ12ZZZ'; update driver_documents set reviewed_at=now()")
  assert.deepEqual(await state(),{status:'pending',is_online:false,review_resume_online:true,review_changed_fields:['Registration number']})
  await db.exec("update driver_documents set file_url='new'; update driver_profiles set verification_submitted_at=now()")
  assert.deepEqual((await state()).review_changed_fields,['Document: identity','Registration number'])
  await db.query('select approve_driver_verification($1,$1)',[id])
  assert.deepEqual(await state(),{status:'approved',is_online:true,review_resume_online:null,review_changed_fields:[]})
 }finally{await db.close()}
})
test('Earnings filters apply the same London boundary to rows, totals and paid amounts',async()=>{
 const db=await database()
 try{
  await db.query("insert into driver_earnings(driver_id,amount,status,created_at) values($1,8,'pending',now() at time zone 'UTC'),($1,20,'pending',(now()-interval '60 days') at time zone 'UTC')",[id])
  await db.query("insert into payouts(driver_id,status,amount,processed_at) values($1,'paid',4,now()),($1,'paid',9,now()-interval '60 days')",[id])
  for(const [period,expected,paid,count] of [['all',28,13,2],['day',8,4,1],['week',8,4,1],['month',8,4,1]]){
   const {r}=(await db.query('select driver_finance_snapshot($1,1,$2,false) r',[id,period])).rows[0]
   assert.equal(r.rows.length,count);assert.equal(r.count,count);assert.equal(r.totals.total,expected);assert.equal(r.totals.available,expected);assert.equal(r.paid,paid)
  }
 }finally{await db.close()}
})
