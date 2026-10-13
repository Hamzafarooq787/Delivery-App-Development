import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'
const compile = (file, imports) => {
 const source = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
 const module = { exports: {} }
 new Function('require', 'module', 'exports', source)(name => { if (!(name in imports)) throw Error(name); return imports[name] }, module, module.exports)
 return module.exports
}
const theme = compile('lib/brand-theme.ts', {})
assert.equal(theme.isBrandTheme('orange'), true)
assert.equal(theme.isBrandTheme('purple'), true)
assert.equal(theme.isBrandTheme('light'), false)
let user = null, role = 'customer', saves = [], stored = 'purple'
const route = compile('app/api/brand-theme/route.ts', {
 '@/lib/brand-theme': theme,
 '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }) },
 '@/lib/supabase/admin': { createAdminClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role } }) }) }) }) }) },
 '@/lib/brand-settings': { readBrandTheme: async () => stored, writeBrandTheme: async (brand, id) => { saves.push({ brand, id }); stored = brand } },
})
const request = (brand, origin = 'https://godrop.uk') => new Request('https://godrop.uk/api/brand-theme', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ brand }) })
assert.equal((await route.POST(request('orange'))).status, 401)
user = { id: 'customer-id' }
assert.equal((await route.POST(request('orange'))).status, 403)
role = 'driver'
assert.equal((await route.POST(request('orange'))).status, 403)
role = 'admin'; user = { id: 'admin-id' }
assert.equal((await route.POST(request('orange', 'https://other.example'))).status, 403)
assert.equal((await route.POST(request('rainbow'))).status, 400)
assert.equal(saves.length, 0)
assert.equal((await route.POST(request('orange'))).status, 200)
assert.deepEqual(saves, [{ brand: 'orange', id: 'admin-id' }])
assert.deepEqual(await (await route.GET()).json(), { brand: 'orange' })
console.log('PASS: public read, admin-only writes, customer/driver denial, origin check, allowlist and shared persistence.')
