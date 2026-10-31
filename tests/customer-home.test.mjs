import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import React from 'react'
import { renderToString } from 'react-dom/server'
import * as jsxRuntime from 'react/jsx-runtime'
function compile(file,imports){const exports={};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;vm.runInNewContext(code,{exports,require:n=>{if(n in imports)return imports[n];throw Error(n)},console,Promise,Number});return exports}
function fixture({user={id:'customer-1',email:'customer@example.test'},enabled=true,failSettings=false,failWallet=false}={}){
 const reads=[];const pending=[];
 const db={from(table){const q={select:()=>q,eq(key,id){reads.push([table,key,id]);return q},not:()=>q,order:()=>q,limit:()=>q,maybeSingle:()=>q,then(resolve,reject){pending.push(()=>{if(table==='wallet_balances'&&failWallet){reject(Error('offline'));return}resolve({data:table==='users'?{full_name:'Customer'}:table==='wallet_balances'?{balance:'12.50'}:[{tracking_number:'GD123',status:'accepted'}],error:null})})}};return q}};
 const api=compile('lib/customer-home-data.ts',{'server-only':{},'@/lib/dashboard-user':{getDashboardUser:async()=>user},'@/lib/supabase/admin':{createAdminClient:()=>db},'@/app/actions/shopping':{getBfmSettings:async()=>{if(failSettings)throw Error('offline');return{enabled}}}});
 return{api,reads,pending}
}
test('Customer home loads all customer-scoped dashboard reads in parallel',async()=>{
 const f=fixture(),result=f.api.getCustomerHomeData();await new Promise(r=>setImmediate(r));assert.equal(f.pending.length,3,'no query waits for an earlier query');for(const finish of f.pending)finish();const data=await result;assert.equal(data.shoppingEnabled,true);assert.equal(data.profile.id,'customer-1');assert.equal(data.balance,12.5);assert.equal(data.delivery.tracking_number,'GD123');assert.ok(f.reads.every(r=>r[2]==='customer-1'))
})
test('An anonymous dashboard read returns no data and performs no admin queries',async()=>{const f=fixture({user:null});assert.equal(await f.api.getCustomerHomeData(),null);assert.equal(f.reads.length,0)})
test('Settings and wallet outages do not masquerade as disabled shopping or zero funds',async()=>{const f=fixture({failSettings:true,failWallet:true}),result=f.api.getCustomerHomeData();await new Promise(r=>setImmediate(r));for(const finish of f.pending)finish();const data=await result;assert.equal(data.shoppingEnabled,null);assert.equal(data.balance,null);assert.equal(data.loadError,false);assert.equal(data.profile.name,'Customer')})
function home(enabled){const Empty=()=>null;const imports={'react':React,'react/jsx-runtime':jsxRuntime,'next/link':{default:({children,...props})=>React.createElement('a',props,children)},'next/dynamic':{default:()=>Empty},'lucide-react':new Proxy({}, {get:()=>Empty}),'@/hooks/use-visible-viewport':{useVisibleViewport:()=>null},'./ServiceIllustration':{ServiceIllustration:Empty},'./CustomerHome.module.css':{default:{}},'./CustomerNavigation':{CustomerHeader:Empty,CustomerBottomNavigation:Empty},'./CustomerNavigation.module.css':{default:{}}};const Home=compile('components/customer/CustomerHome.tsx',imports).default;return renderToString(React.createElement(Home,{initialData:{profile:{id:'customer-1',name:'Customer',email:''},balance:12.5,delivery:null,loadError:false,shoppingEnabled:enabled}}))}
test('Enabled shopping is present in the first server render without Coming soon',()=>{const html=home(true);assert.ok(html.includes('Start shopping'));assert.ok(!html.includes('Coming soon'));assert.ok(html.includes('Customer'))})
test('A disabled service and unknown availability have different first-render states',()=>{const disabled=home(false),unknown=home(null);assert.ok(disabled.includes('Temporarily unavailable'));assert.ok(!disabled.includes('Start shopping'));assert.ok(unknown.includes('Start shopping'));assert.ok(!unknown.includes('Temporarily unavailable'))})
