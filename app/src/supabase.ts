import { createClient } from '@supabase/supabase-js'

const isBrowser = typeof window !== 'undefined'
const defaultUrl = isBrowser ? window.location.origin : 'https://localhost'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || defaultUrl
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
  realtime: { params: { eventsPerSecond: 10 } }
})
