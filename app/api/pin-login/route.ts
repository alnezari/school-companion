import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Quick sign-in with a 6-digit PIN. The PIN never replaces the account: a correct PIN exchanges for a normal
// Supabase session for the family user (via a server-side magic link), so every security rule still applies.
export const pinHash = (pin: string, userId: string) => createHash("sha256").update(`${pin}:${userId}`).digest("hex");
const MAX_TRIES = 5, LOCK_MINUTES = 15;

async function settingsMap(keys: string[]) {
  const sb = supabaseAdmin();
  const { data } = await sb.from("settings").select("key,value").in("key", keys);
  return Object.fromEntries(((data || []) as { key: string; value: string }[]).map((r) => [r.key, r.value]));
}

export async function GET() {
  try {
    const s = await settingsMap(["login_pin_hash"]);
    return NextResponse.json({ enabled: !!s.login_pin_hash });
  } catch { return NextResponse.json({ enabled: false }); }
}

export async function POST(req: Request) {
  const { pin } = (await req.json().catch(() => ({}))) as { pin?: string };
  if (!pin || !/^\d{6}$/.test(pin)) return NextResponse.json({ error: "bad_pin" }, { status: 400 });
  let admin;
  try { admin = supabaseAdmin(); } catch (e) { return NextResponse.json({ error: "not_configured", message: (e as Error).message }, { status: 500 }); }

  const s = await settingsMap(["login_pin_hash", "login_fail_count", "login_locked_until"]);
  if (!s.login_pin_hash) return NextResponse.json({ error: "disabled" }, { status: 400 });
  if (s.login_locked_until && new Date(s.login_locked_until) > new Date()) return NextResponse.json({ error: "locked" }, { status: 429 });

  const { data: fam } = await admin.from("family_members").select("user_id").order("created_at").limit(1).maybeSingle();
  if (!fam) return NextResponse.json({ error: "no_family" }, { status: 500 });

  if (pinHash(pin, fam.user_id) !== s.login_pin_hash) {
    const fails = Number(s.login_fail_count || 0) + 1;
    const rows = [{ key: "login_fail_count", value: String(fails) }];
    if (fails >= MAX_TRIES) rows.push({ key: "login_locked_until", value: new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() }, { key: "login_fail_count", value: "0" });
    await admin.from("settings").upsert(rows);
    return NextResponse.json({ error: fails >= MAX_TRIES ? "locked" : "wrong", left: Math.max(0, MAX_TRIES - fails) }, { status: 401 });
  }
  await admin.from("settings").upsert([{ key: "login_fail_count", value: "0" }, { key: "login_locked_until", value: "" }]);

  const { data: user } = await admin.auth.admin.getUserById(fam.user_id);
  if (!user.user?.email) return NextResponse.json({ error: "no_email" }, { status: 500 });
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email: user.user.email });
  if (linkErr || !link.properties?.hashed_token) return NextResponse.json({ error: "link", message: linkErr?.message }, { status: 500 });
  const sb = await supabaseServer(); // writes the session cookies on this response
  const { error } = await sb.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" });
  if (error) return NextResponse.json({ error: "session", message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
