import { execSync } from 'child_process'

console.log('Installing @supabase/ssr and @supabase/supabase-js...')
execSync('pnpm add @supabase/ssr @supabase/supabase-js', {
  cwd: '/vercel/share/v0-project',
  stdio: 'inherit',
})
console.log('Done.')
