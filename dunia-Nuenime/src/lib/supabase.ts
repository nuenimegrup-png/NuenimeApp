import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_URL) ||
  'https://liqekmhmsanihjbyzjvm.supabase.co';

const SUPABASE_ANON_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcWVrbWhtc2FuaWhqYnl6anZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1NTE0MjMsImV4cCI6MjEwNzEyNzQyM30.q85SL_i9pGaBR3fyGwCaJ3bjBXy6GY8C0uPQ_kT4i60';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
