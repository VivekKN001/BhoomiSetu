import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

if (!isSupabaseConfigured) {
  console.warn(
    "Supabase env vars are missing. Copy .env.example to .env and fill in your project URL + anon key, then restart `npm run dev`."
  );
}

// Falls back to placeholder values so createClient doesn't throw before
// the app has a chance to show the "not configured" screen in App.jsx.
export const supabase = createClient(
  url || "https://placeholder.supabase.co",
  anonKey || "placeholder-key"
);
