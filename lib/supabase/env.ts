// The Supabase URL and publishable key are public by design (they only work through Row Level Security).
// Environment variables override them.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://qqzkdlfzrvgfighaypcd.supabase.co";
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY || "sb_publishable_NTrzehUBfFTWM39vAotlKg_EyfY9nrQ";
