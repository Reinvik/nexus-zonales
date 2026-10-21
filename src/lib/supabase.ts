import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://iuzpgljjfeobxlptmsma.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_SPDWhx5zkQ9y3SiG6FXUhA_1A6ylpl7';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
