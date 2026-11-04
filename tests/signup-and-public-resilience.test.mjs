import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function compile(file, imports, extra={}) {
  const exports={}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
  }).outputText,{exports,require:name=>imports[name],Response,Request,URL,AbortSignal,process,...extra})
  return exports
}

function signupForm(role='driver') {
  const form = new FormData()
  for (const [key,value] of Object.entries({role,email:'signup@example.invalid',password:'example-password',first_name:'New',last_name:'User',phone:'+447700900123'})) form.set(key,value)
  return form
}

test('Email signup preserves both roles and gives the right next step with or without an auth session',async()=>{
  let args
  let session=null
  const auth=compile('app/actions/auth.ts',{
    '@/lib/supabase/server':{createClient:async()=>({auth:{signUp:async input=>{args=input;return{data:{user:{},session},error:null}}}})},
    '@/lib/uk-phone':{normaliseUKMobile:v=>v},
    '@/lib/get-app-origin':{getAppOrigin:async()=> 'https://godrop.uk'},
  })
  assert.equal((await auth.signUp(signupForm())).next,'email')
  assert.equal(args.options.data.role,'driver')
  assert.equal(args.options.emailRedirectTo,'https://godrop.uk/auth/callback?role=driver')
  session={}
  assert.equal((await auth.signUp(signupForm())).next,'driver')
  assert.equal((await auth.signUp(signupForm('admin'))).next,'customer')
  assert.equal(args.options.data.role,'customer')
})

test('A failed signup transport returns a recoverable message instead of rejecting',async()=>{
  const {signUp}=compile('app/actions/auth.ts',{
    '@/lib/supabase/server':{createClient:async()=>({auth:{signUp:async()=>{throw Error('network')}}})},
    '@/lib/uk-phone':{normaliseUKMobile:v=>v},
    '@/lib/get-app-origin':{getAppOrigin:async()=> 'https://godrop.uk'},
  })
  assert.match((await signUp(signupForm())).error,/Check your inbox/)
})

test('Signup endpoint blocks cross-origin requests and bounds an unresolved submission',async()=>{
  let calls=0
  const {POST}=compile('app/api/auth/signup/route.ts',{
    '@/app/actions/auth':{signUp:()=>{calls++;return new Promise(()=>{})}},
    '@/lib/short-request':{shortRequest:(promise,ms)=>{
      assert.equal(ms,11500)
      return Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(Error('deadline')),15))])
    }},
  })
  const request=origin=>new Request('https://godrop.uk/api/auth/signup',{method:'POST',headers:{origin},body:signupForm()})
  assert.equal((await POST(request('https://example.invalid'))).status,403)
  assert.equal(calls,0)
  const reply=await POST(request('https://godrop.uk'))
  assert.equal(reply.status,503)
  assert.equal(reply.headers.get('Cache-Control'),'no-store')
  assert.match((await reply.json()).error,/Check your inbox/)
})

test('Brand endpoint caches successful reads and keeps failures out of the cache',async()=>{
  let unavailable=false
  const {GET}=compile('app/api/brand-theme/route.ts',{
    '@/lib/brand-settings':{readBrandTheme:async()=>{if(unavailable)throw Error('slow');return 'orange'}},
    '@/lib/short-request':{shortRequest:(work,ms)=>{assert.equal(ms,1800);return work}},
  })
  const reply=await GET()
  assert.equal((await reply.json()).brand,'orange')
  assert.match(reply.headers.get('Vercel-CDN-Cache-Control'),/s-maxage=60/)
  unavailable=true
  const failure=await GET()
  assert.equal(failure.status,503)
  assert.equal(failure.headers.get('Cache-Control'),'no-store')
})

test('Service worker leaves online admin navigations alone and serves fallback only while offline',async()=>{
  class NextResponse extends Response {}
  const {GET}=compile('app/firebase-messaging-sw.js/route.ts',{'next/server':{NextResponse}})
  const code=await (await GET()).text()
  const listeners=new Map()
  const self={location:{origin:'https://godrop.uk'},navigator:{onLine:true},addEventListener:(name,callback)=>listeners.set(name,callback)}
  let cachedWrites=0, staticResponse=new Response('broken',{status:503})
  const cache={match:async()=>null,put:async()=>{cachedWrites++}}
  const offline=new Response('offline')
  vm.runInNewContext(code,{self,URL,Response,console,importScripts(){},firebase:{apps:[{}],messaging:()=>({onBackgroundMessage(){}})},
    fetch:async()=>staticResponse,caches:{match:async()=>offline,open:async()=>cache}})
  function dispatch(path,mode) {
    let response
    listeners.get('fetch')({request:{url:'https://godrop.uk'+path,mode,method:'GET',headers:new Headers()},respondWith:p=>{response=p}})
    return response
  }
  assert.equal(dispatch('/dashboard/admin/drivers','navigate'),undefined)
  assert.equal((await dispatch('/_next/static/chunk.js','cors')).status,503)
  assert.equal(cachedWrites,0)
  staticResponse=new Response('script',{headers:{'Content-Type':'application/javascript'}})
  assert.equal((await dispatch('/_next/static/chunk.js','cors')).status,200)
  assert.equal(cachedWrites,1)
  self.navigator.onLine=false
  assert.equal(await dispatch('/dashboard/admin/drivers','navigate'),offline)
})

test('Public theme, signup API and worker do not wait for session refresh in the proxy',async()=>{
  const next={}
  const {proxy}=compile('proxy.ts',{
    'next/server':{NextResponse:{next:()=>next}},
    '@supabase/ssr':{createServerClient:()=>{throw Error('unexpected session lookup')}},
  })
  for (const path of ['/api/brand-theme','/api/auth/signup','/firebase-messaging-sw.js','/privacy-policy']) {
    assert.equal(await proxy({nextUrl:new URL('https://godrop.uk'+path)}),next)
  }
})
