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

const signupEmail = compile('lib/signup-email.ts',{})

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
    '@/lib/signup-email':signupEmail,
    '@/lib/uk-phone':{normaliseUKMobile:v=>v},
    '@/lib/get-app-origin':{getAppOrigin:async()=> 'https://godrop.uk'},
  })
  assert.equal((await auth.signUp(signupForm())).next,'email')
  assert.equal(args.options.data.role,'driver')
  assert.equal(args.options.emailRedirectTo,'https://godrop.uk/auth/confirm')
  session={}
  assert.equal((await auth.signUp(signupForm())).next,'driver')
  assert.equal((await auth.signUp(signupForm('admin'))).next,'customer')
  assert.equal(args.options.data.role,'customer')
})

test('A failed signup transport returns a recoverable message instead of rejecting',async()=>{
  const {signUp}=compile('app/actions/auth.ts',{
    '@/lib/supabase/server':{createClient:async()=>({auth:{signUp:async()=>{throw Error('network')}}})},
    '@/lib/signup-email':signupEmail,
    '@/lib/uk-phone':{normaliseUKMobile:v=>v},
    '@/lib/get-app-origin':{getAppOrigin:async()=> 'https://godrop.uk'},
  })
  assert.equal((await signUp(signupForm())).delivery,'unverified')
})

test('Signup endpoint blocks cross-origin requests and bounds an unresolved submission',async()=>{
  let calls=0
  const {POST}=compile('app/api/auth/signup/route.ts',{
    '@/lib/signup-email':signupEmail,
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
  assert.equal(reply.status,202)
  assert.equal(reply.headers.get('Cache-Control'),'no-store')
  assert.equal((await reply.json()).delivery,'unverified')
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

test('Email link works without a verifier cookie and token-hash verification does not persist a session',async()=>{
  let verified=0
  const { createHash }=await import('node:crypto')
  const {GET}=compile('app/auth/confirm/route.ts',{
    'node:crypto':{createHash},
    'next/server':{NextResponse:Response},
    '@supabase/supabase-js':{createClient:(_url,_key,options)=>{
      assert.equal(options.auth.persistSession,false)
      return {auth:{verifyOtp:async({token_hash,type})=>{
        verified++;assert.equal(type,'email');assert.equal(token_hash,'x'.repeat(32))
        return {data:{user:{email_confirmed_at:'now'}},error:null}
      }}}
    }},
    '@/lib/short-request':{boundedFetch:()=>fetch,shortRequest:work=>work},
  })
  const url='https://godrop.uk/auth/confirm'
  for (const query of ['?code=provider-code','?type=email&token_hash='+'x'.repeat(32)]) {
    const response=await GET(new Request(url+query))
    assert.equal(response.headers.get('location'),'https://godrop.uk/login?confirmation=confirmed#_')
    assert.equal(response.headers.get('set-cookie'),null)
  }
  assert.equal(verified,1)
  assert.match((await GET(new Request(url+'?type=recovery&token_hash='+'x'.repeat(32)))).headers.get('location'),/confirmation=expired/)
  const html=await (await GET(new Request(url))).text()
  const script=html.match(/<script>(.*?)<\/script>/)[1]
  for (const [fragment,outcome] of [['#error_code=otp_expired','expired'],['#access_token=private&refresh_token=private','confirmed'],['','check']]) {
    let destination
    vm.runInNewContext(script,{URLSearchParams,location:{hash:fragment,replace:path=>{destination=path}}})
    assert.equal(destination,'/login?confirmation='+outcome+'#_')
  }
})

test('Resend uses the email confirmation callback and does not disclose whether the account exists',async()=>{
  let args, error=null
  const {POST}=compile('app/api/auth/resend/route.ts',{
    '@/lib/signup-email':signupEmail,
    '@/lib/get-app-origin':{getAppOrigin:async()=> 'https://godrop.uk'},
    '@/lib/short-request':{boundedFetch:()=>fetch,shortRequest:work=>work},
    '@/lib/supabase/server':{createClient:async()=>({auth:{resend:async input=>{args=input;return{error}}}})},
  })
  const post=origin=>POST(new Request('https://godrop.uk/api/auth/resend',{method:'POST',headers:{origin},body:signupForm()}))
  assert.equal((await post('https://example.invalid')).status,403)
  assert.equal(args,undefined)
  assert.equal((await (await post('https://godrop.uk')).json()).success,true)
  assert.equal(args.options.emailRedirectTo,'https://godrop.uk/auth/confirm')
  assert.equal(args.type,'signup')
  error={status:400,code:'user_not_found'}
  assert.equal((await (await post('https://godrop.uk')).json()).success,true)
})

test('Previously sent signup links with missing verifiers reach email guidance; Google keeps its error path',async()=>{
  const {GET}=compile('app/auth/callback/route.ts',{
    'next/server':{NextResponse:Response},
    '@/lib/supabase/server':{createClient:async()=>({auth:{exchangeCodeForSession:async()=>({error:{name:'AuthPKCECodeVerifierMissingError',status:400}})}})},
    '@/lib/auth-profile':{},
    '@/lib/supabase/admin':{},
  })
  assert.match((await GET(new Request('https://godrop.uk/auth/callback?code=old&role=driver'))).headers.get('location'),/confirmation=check/)
  assert.match((await GET(new Request('https://godrop.uk/auth/callback?code=old'))).headers.get('location'),/error=oauth_failed/)
})
