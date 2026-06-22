import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Using untyped client; type safety is enforced via explicit return types in each data layer function.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
