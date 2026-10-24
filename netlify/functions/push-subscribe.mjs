import { createClient } from '@supabase/supabase-js';

const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) });

export async function handler(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Método não permitido.' });
  const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return json(401, { error: 'Sessão não encontrada. Inicia sessão novamente.' });
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) return json(500, { error: 'Configura SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY nas variáveis do Netlify.' });
  let payload;
  try { payload = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'JSON inválido.' }); }
  const sub = payload.subscription;
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return json(400, { error: 'Subscrição push inválida.' });
  const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userResult, error: authError } = await authClient.auth.getUser(token);
  if (authError || !userResult?.user) return json(401, { error: 'Sessão inválida ou expirada.' });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await admin.from('push_subscriptions').upsert({
    user_id: userResult.user.id,
    endpoint: sub.endpoint,
    subscription: sub,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'endpoint' });
  if (error) return json(500, { error: `Não foi possível guardar a subscrição push: ${error.message}` });
  return json(200, { ok: true });
}
