import { createClient } from '@supabase/supabase-js'
// A chave publishable/anon é pública por desenho. Nunca usar service_role ou sb_secret no frontend.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://ijnheozmhnhnkvvwrcux.supabase.co'
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_9bL8RsZEzuGfGvXJWSJrCQ_8nYib1FM'
export const supabase = createClient(url, key)
