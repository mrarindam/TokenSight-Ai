const { createClient } = require('@supabase/supabase-js');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing supabase env', { url, key });
  process.exit(1);
}
const supabase = createClient(url, key);
(async () => {
  const { data, error } = await supabase
    .from('price_alerts')
    .select('id,token_name,token_address,alert_type,comparison_type,threshold,is_active,user_id,trigger_count')
    .order('updated_at', { ascending: false })
    .limit(20);
  console.log('alerts:', error || data);
  const { data: users, error: ue } = await supabase.from('users').select('id,telegram_id,email').limit(20);
  console.log('users:', ue || users);
})();