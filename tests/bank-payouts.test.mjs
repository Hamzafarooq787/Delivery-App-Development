import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
const source=stripTypeScriptTypes(fs.readFileSync('lib/payouts/engine.ts','utf8')).replace(/export /g,'');
const {executeBankPayout,canRetryCreate}=vm.runInNewContext(source+';({executeBankPayout,canRetryCreate})',{Date,Number,Error});
const now=Date.parse('2026-10-30T12:00:00Z');
function fixture() {
 let op={account:'acct_driver',state:'processing',started_at:new Date(now).toISOString()};
 const transfers=[],payouts=[]; let transferCreates=0,payoutCreates=0,failSave='',reserve=0,available=10000,connected=10000,active=true;
 const stripe={
  v2:{core:{accounts:{retrieve:async()=>({configuration:{recipient:{capabilities:{stripe_balance:{stripe_transfers:{status:active?'active':'pending'},payouts:{status:'active'}}}}}})}}},
  balanceSettings:{update:async()=>({})},
  balance:{retrieve:async(_p,opts)=>({available:[{currency:'gbp',amount:opts?connected:available}]})},
  transfers:{retrieve:async(id)=>transfers.find(t=>t.id===id)??{id,amount:800,currency:'gbp',destination:'acct_driver',reversed:false},list:async function*(){yield*transfers},create:async(p,k)=>{transferCreates++; assert.equal(k.idempotencyKey,'godrop:transfer:test');const r={id:'tr_1',...p,reversed:false};transfers.push(r);return r;}},
  payouts:{list:async function*(){yield*payouts},create:async(p,k)=>{payoutCreates++;assert.equal(k.stripeAccount,'acct_driver');assert.equal(k.idempotencyKey,op.attempt ? `godrop:bank:test:${op.attempt}` : 'godrop:bank:test');const r={id:`po_${payoutCreates}`,...p,status:'pending'};payouts.push(r);return r;},retrieve:async(id,p,opts)=>{assert.equal(opts.stripeAccount,'acct_driver');return payouts.find(p=>p.id===id);}}
 };
 const deps={stripe,now:()=>now,protectedPence:async()=>reserve,save:async p=>{if((failSave==='transfer'&&p.transfer_id)||(failSave==='payout'&&p.payout_id)) {failSave='';throw new Error('database unavailable');}op={...p};}};
 return {run:()=>executeBankPayout('test',8,op,deps),get op(){return op;},set op(p){op=p;},get counts(){return [transferCreates,payoutCreates]},payouts,transfers,set failSave(v){failSave=v},set reserve(v){reserve=v},set available(v){available=v},set connected(v){connected=v},set active(v){active=v}};
}
test('Bank payout stays pending until provider confirms paid, then handles bank return',async()=>{
 const f=fixture();await f.run();assert.equal(f.op.state,'pending');assert.deepEqual(f.counts,[1,1]);
 f.payouts[0].status='paid';await f.run();assert.equal(f.op.state,'paid');
 f.payouts[0].status='failed';f.payouts[0].failure_code='account_closed';await f.run();assert.equal(f.op.state,'failed');assert.equal(f.op.error,'account_closed');assert.deepEqual(f.counts,[1,1]);
});
test('Transfer success followed by database failure recovers without duplicate payment',async()=>{
 const f=fixture();f.failSave='transfer';await assert.rejects(()=>f.run(),/database unavailable/);await f.run();assert.deepEqual(f.counts,[1,1]);
});
test('Bank success followed by database failure recovers by metadata without duplicate payout',async()=>{
 const f=fixture();f.failSave='payout';await assert.rejects(()=>f.run(),/database unavailable/);await f.run();assert.deepEqual(f.counts,[1,1]);
});
test('Uncertain old transfer or payout fails closed after idempotency retention window',async()=>{
 const old=new Date(now-25*3600000).toISOString();
 const f=fixture();f.op={...f.op,transfer_started_at:old};await assert.rejects(()=>f.run(),/uncertain_transfer/);assert.deepEqual(f.counts,[0,0]);
 const g=fixture();g.op={...g.op,transfer_id:'tr_1',payout_started_at:old};await assert.rejects(()=>g.run(),/uncertain_bank_payout/);assert.deepEqual(g.counts,[0,0]);
 assert.equal(canRetryCreate('invalid',now),false);
});
test('Shopping reserve and incomplete bank verification prevent transfers',async()=>{
 const f=fixture();f.reserve=9500;await assert.rejects(()=>f.run(),/shopping_money_protected/);assert.deepEqual(f.counts,[0,0]);
 const g=fixture();g.active=false;await assert.rejects(()=>g.run(),/verification_required/);assert.deepEqual(g.counts,[0,0]);
});
test('Unavailable connected balance waits without transferring earnings twice',async()=>{
 const f=fixture();f.connected=0;await assert.rejects(()=>f.run(),/waiting_for_connected_balance/);assert.deepEqual(f.counts,[1,0]);f.connected=1000;await f.run();assert.deepEqual(f.counts,[1,1]);
});
test('Mismatched provider amount is not accepted as paid',async()=>{
 const f=fixture();await f.run();f.payouts[0].amount=900;f.payouts[0].status='paid';await assert.rejects(()=>f.run(),/bank_payout_mismatch/);assert.equal(f.op.state,'pending');
});

test('A bank retry uses a new attempt but never creates a second platform transfer',async()=>{
 const f=fixture();await f.run();f.payouts[0].status='failed';await f.run();
 const {payout_id,payout_started_at,...rest}=f.op;
 f.op={...rest,attempt:1,state:'awaiting_bank_payout'};
 await f.run();assert.deepEqual(f.counts,[1,2]);assert.equal(f.op.payout_id,'po_2');
 f.payouts[1].status='paid';await f.run();assert.equal(f.op.state,'paid');
});

test('A reversed platform transfer cannot fund a replacement bank payout',async()=>{
 const f=fixture();f.connected=0;await assert.rejects(()=>f.run(),/waiting_for_connected_balance/);
 f.transfers[0].reversed=true;f.connected=10000;
 await assert.rejects(()=>f.run(),/transfer_reversed/);assert.deepEqual(f.counts,[1,0]);
});
