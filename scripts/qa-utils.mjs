import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

export const DEFAULT_QA_SLUG = 'qa-smoke-tournament'
export const DEFAULT_QA_EMAIL = 'qa-admin@tournamate.test'
export const DEFAULT_QA_PASSWORD = 'Tournamate-QA-Admin-123!'

export function loadLocalEnv() {
  for (const file of ['.env.local', '.env']) {
    const path = resolve(process.cwd(), file)
    if (!existsSync(path)) continue
    const lines = readFileSync(path, 'utf8').split(/\r?\n/)
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const separator = trimmed.indexOf('=')
      if (separator === -1) continue
      const key = trimmed.slice(0, separator).trim()
      const rawValue = trimmed.slice(separator + 1).trim()
      if (!key || process.env[key] !== undefined) continue
      process.env[key] = rawValue.replace(/^["']|["']$/g, '')
    }
  }
}

export function qaSlug() {
  return process.env.QA_TOURNAMENT_SLUG || DEFAULT_QA_SLUG
}

export function assertQaSlug(slug) {
  if (!slug.startsWith('qa-')) {
    throw new Error(`Refusing to touch non-QA tournament slug "${slug}". Use a slug that starts with qa-.`)
  }
}

export function createQaClient() {
  loadLocalEnv()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL.')
  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY. QA seed/cleanup requires a service-role key and must never run in the browser.')
  }

  const isLocal = /localhost|127\.0\.0\.1/.test(url)
  if (!isLocal && process.env.QA_ALLOW_REMOTE !== '1') {
    throw new Error('Refusing to run QA database scripts against a remote Supabase URL unless QA_ALLOW_REMOTE=1 is set.')
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export async function must(result, label) {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`)
  }
  return result.data
}

export async function maybe(result, label) {
  if (result.error) {
    console.warn(`${label}: ${result.error.message}`)
    return null
  }
  return result.data
}

export async function ensureQaAdmin(supabase) {
  const email = process.env.QA_ADMIN_EMAIL || process.env.E2E_ADMIN_EMAIL || DEFAULT_QA_EMAIL
  const password = process.env.QA_ADMIN_PASSWORD || process.env.E2E_ADMIN_PASSWORD || DEFAULT_QA_PASSWORD

  const { data: usersData, error: listError } = await supabase.auth.admin.listUsers()
  if (listError) throw new Error(`List auth users: ${listError.message}`)

  let user = usersData.users.find((candidate) => candidate.email?.toLowerCase() === email.toLowerCase())
  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        source: 'qa-seed',
      },
    })
    if (error) throw new Error(`Create QA admin user: ${error.message}`)
    user = data.user
  }

  if (!user) throw new Error('Could not resolve QA admin user.')

  await must(
    supabase
      .from('user_profiles')
      .upsert({ id: user.id, role: 'superadmin' }, { onConflict: 'id' }),
    'Upsert QA admin profile'
  )
  await maybe(
    supabase
      .from('user_profiles')
      .update({ is_approved: true })
      .eq('id', user.id),
    'Approve QA admin profile'
  )

  return { id: user.id, email, password }
}
