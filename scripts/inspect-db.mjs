import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Missing Supabase env vars')
  process.exit(1)
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const [scanSample, userStatsSample, usersCount, scansCount] = await Promise.all([
    supabase.from('scans').select('*').limit(1),
    supabase.from('user_stats').select('*').limit(3),
    supabase.from('users').select('id', { count: 'exact', head: true }),
    supabase.from('scans').select('id', { count: 'exact', head: true }),
  ])

  console.log(JSON.stringify({
    scansCount: scansCount.count ?? null,
    scansError: scansCount.error?.message ?? null,
    usersCount: usersCount.count ?? null,
    usersError: usersCount.error?.message ?? null,
    scanColumns: scanSample.data?.[0] ? Object.keys(scanSample.data[0]) : [],
    scanSampleError: scanSample.error?.message ?? null,
    userStatsColumns: userStatsSample.data?.[0] ? Object.keys(userStatsSample.data[0]) : [],
    userStatsError: userStatsSample.error?.message ?? null,
    scanSample: scanSample.data?.[0] ?? null,
    userStatsSample: userStatsSample.data ?? null,
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
