import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const origin = 'https://godrop.uk'

function compile(path, imports) {
  const exports = {}
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText
  vm.runInNewContext(code, { exports, require: name => name in imports ? imports[name] : require(name), URL, AbortSignal })
  return exports
}

for (const page of ['app/login/page.tsx', 'app/driver/login/page.tsx']) {
  test(`${page} renders Forgot password as a navigable anchor without JS`, () => {
    const { default: Login } = compile(page, {
      '@/components/shared/brand-logo': { BrandLogo: () => null },
      '@/components/auth/social-auth-buttons': { SocialAuthButtons: () => null },
      '@/lib/oauth-error-message': { oauthErrorMessage: () => null },
      '@/lib/short-request': {},
      '@/app/actions/auth': {},
      'next/navigation': { useSearchParams: () => new URLSearchParams() },
    })
    const html = renderToStaticMarkup(createElement(Login))
    assert.match(html, /<a\b[^>]*href="\/forgot-password"[^>]*>Forgot password\?<\/a>/)
  })
}

test('Recovery landing sends the code to one server exchange and skips unrelated profile reads', async () => {
  const next = {}
  const NextResponse = {
    redirect: (url, { headers } = {}) => new Response(null, { status: 307, headers: { ...headers, Location: String(url) } }),
    next: () => next,
  }
  const { proxy } = compile('proxy.ts', {
    'next/server': { NextResponse },
    '@supabase/ssr': { createServerClient: () => assert.fail('Unexpected middleware session lookup') },
    '@/lib/short-request': {},
    '@/lib/supabase/admin': {},
  })
  const request = path => ({ url: origin + path, nextUrl: new URL(path, origin) })
  let exchanges = 0
  const { GET } = compile('app/auth/callback/route.ts', {
    'next/server': { NextResponse },
    '@/lib/supabase/server': { createClient: async () => ({ auth: {
      exchangeCodeForSession: async code => {
        exchanges++
        if (code === 'fallback-code') return { data: { user: { id: 'qa' }, session: {}, redirectType: 'PASSWORD_RECOVERY' }, error: null }
        return code === 'one-time-code' && exchanges === 1
          ? { data: { user: { id: 'qa' }, session: {} }, error: null }
          : { data: { user: null, session: null }, error: { code: 'flow_state_not_found' } }
      },
    } }) },
    '@/lib/auth-profile': { ensureVerifiedProfile: () => assert.fail('Recovery should not provision a profile') },
    '@/lib/supabase/admin': {},
  })
  const handoff = await proxy(request('/reset-password?code=one-time-code'))
  assert.equal(handoff.headers.get('location'), origin + '/auth/callback?type=recovery&code=one-time-code')
  assert.match(handoff.headers.get('cache-control'), /no-store/)
  const callback = new Request(handoff.headers.get('location'))
  assert.equal((await GET(callback)).headers.get('location'), origin + '/reset-password')
  assert.equal(await proxy(request('/reset-password')), next)
  assert.equal(exchanges, 1)
  assert.equal((await GET(callback)).headers.get('location'), origin + '/reset-password?error=invalid_link')
  assert.equal((await GET(new Request(origin + '/auth/callback?code=fallback-code'))).headers.get('location'), origin + '/reset-password')
  assert.equal((await GET(new Request(origin + '/auth/callback?type=recovery'))).headers.get('location'), origin + '/reset-password?error=invalid_link')
})

test('The SDK carries the recovery verifier into the callback, then signs in with the new password', async () => {
  const { createClient } = await import('@supabase/supabase-js')
  const { createServerClient } = await import('@supabase/ssr')
  const { createHash } = await import('node:crypto')
  const cookies = new Map()
  const fakeUrl = 'https://fixture.supabase.invalid'
  const testUser = { id: 'qa-test-user', aud: 'authenticated', email: 'qa@example.invalid' }
  const token = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ sub: testUser.id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.signature`
  const session = { access_token: token, refresh_token: 'test-refresh-token', expires_in: 3600, token_type: 'bearer', user: testUser }
  let password = 'old-fixture-password'
  let challenge
  let codeUsed = false
  const provider = async (input, options) => {
    const url = new URL(input)
    const body = options.body ? JSON.parse(options.body) : {}
    if (url.pathname.endsWith('/recover')) {
      assert.equal(url.searchParams.get('redirect_to'), origin + '/reset-password')
      assert.equal(body.email, testUser.email)
      challenge = body.code_challenge
      return Response.json({})
    }
    if (url.searchParams.get('grant_type') === 'pkce') {
      assert.equal(body.auth_code, 'email-fixture-code')
      assert.equal(createHash('sha256').update(body.code_verifier).digest('base64url'), challenge)
      assert.equal(codeUsed, false)
      codeUsed = true
      return Response.json(session)
    }
    if (url.pathname.endsWith('/user')) {
      assert.equal(new Headers(options.headers).get('authorization'), 'Bearer ' + token)
      if (options.method === 'PUT') password = body.password
      return Response.json(testUser)
    }
    if (url.pathname.endsWith('/logout')) return new Response(null, { status: 204 })
    if (url.searchParams.get('grant_type') === 'password') {
      assert.equal(body.email, testUser.email)
      return body.password === password ? Response.json(session) : Response.json({ message: 'Invalid login credentials' }, { status: 400 })
    }
    assert.fail('Unexpected auth route: ' + url.pathname)
  }
  const storage = {
    getItem: key => cookies.get(key) ?? null,
    setItem: (key, value) => { cookies.set(key, value) },
    removeItem: key => { cookies.delete(key) },
  }
  const browser = () => createClient(fakeUrl, 'public-test-key', {
    auth: { flowType: 'pkce', storage, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: provider },
  })
  const resetRequest = browser()
  const { error: requestError } = await resetRequest.auth.resetPasswordForEmail(testUser.email, { redirectTo: origin + '/reset-password' })
  assert.equal(requestError, null)
  // An SSR browser client stores the verifier in a cookie. Supply its encoded
  // value to the real server adapter and copy the resulting session back.
  const cookieJar = new Map([...cookies].map(([name, value]) => [name, 'base64-' + Buffer.from(value).toString('base64url')]))
  const callback = createServerClient(fakeUrl, 'public-test-key', {
    cookies: {
      getAll: () => [...cookieJar].map(([name, value]) => ({ name, value })),
      setAll: changes => {
        for (const { name, value, options } of changes) {
          if (options.maxAge === 0) cookieJar.delete(name)
          else cookieJar.set(name, value)
        }
      },
    },
    global: { fetch: provider },
  })
  const exchange = await callback.auth.exchangeCodeForSession('email-fixture-code')
  assert.equal(exchange.error, null)
  assert.equal(exchange.data.redirectType, 'PASSWORD_RECOVERY')
  cookies.clear()
  for (const [name, value] of cookieJar) cookies.set(name, Buffer.from(value.slice('base64-'.length), 'base64url').toString())
  const reset = browser()
  assert.equal((await reset.auth.getUser()).data.user.id, testUser.id)
  assert.equal((await reset.auth.updateUser({ password: 'new-fixture-password' })).error, null)
  assert.equal((await reset.auth.signOut()).error, null)
  assert.equal((await reset.auth.getSession()).data.session, null)
  assert.ok((await reset.auth.signInWithPassword({ email: testUser.email, password: 'old-fixture-password' })).error)
  assert.equal((await reset.auth.signInWithPassword({ email: testUser.email, password: 'new-fixture-password' })).data.user.id, testUser.id)
})
