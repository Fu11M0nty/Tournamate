import { assertQaSlug, createQaClient, must, qaSlug } from './qa-utils.mjs'

const slug = qaSlug()
assertQaSlug(slug)

const supabase = createQaClient()

const tournaments = await must(
  supabase
    .from('tournaments')
    .select('id, slug, name')
    .eq('slug', slug),
  'Find QA tournament'
)

if (tournaments.length === 0) {
  console.log(`No QA tournament found for ${slug}. Nothing to clean.`)
  process.exit(0)
}

await must(
  supabase
    .from('tournaments')
    .delete()
    .eq('slug', slug),
  'Delete QA tournament'
)

console.log(`Cleaned ${tournaments.length} QA tournament(s): ${tournaments.map((tournament) => tournament.slug).join(', ')}`)
