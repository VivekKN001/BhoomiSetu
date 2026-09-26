// Forgot-password without SMS or email. There's no inbox behind the
// synthetic 91XXXXXXXXXX@bhoomisetu.local login address (see
// src/lib/auth.js), so instead each user holds a one-time recovery code:
//
//   { action: "issue" }                          -- logged-in user (JWT in
//       Authorization header) gets a fresh code; any older code stops working.
//   { action: "reset", phone, code, newPassword } -- logged-out user proves
//       ownership with the code; password is changed and a NEW code is
//       returned (each code works once).
//
// Needs the service role key (to change another user's password and to
// read recovery_codes, which has RLS on and no policies) -- Supabase
// injects SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY into every Edge Function
// automatically, nothing to `secrets set`. Only a SHA-256 hash of each code
// is stored. Always responds HTTP 200 with either { code } or { error },
// so the client has one simple contract.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMAIL_DOMAIN = "bhoomisetu.local";
// No 0/O, 1/I/L, U -- easy to read back off a screenshot or paper.
const ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
const CODE_LENGTH = 16;

function respond(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function generateCode() {
  const chars: string[] = [];
  while (chars.length < CODE_LENGTH) {
    for (const b of crypto.getRandomValues(new Uint8Array(32))) {
      // Rejection sampling keeps every character equally likely.
      if (b < 240 && chars.length < CODE_LENGTH) chars.push(ALPHABET[b % ALPHABET.length]);
    }
  }
  return chars.join("").match(/.{4}/g)!.join("-");
}

function normalizeCode(code: string) {
  return String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

async function hashCode(code: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalizeCode(code)));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Mirrors normalizePhone() in src/lib/auth.js.
function loginEmailForPhone(raw: string) {
  const digits = String(raw || "").trim().replace(/\D/g, "");
  const ten = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  if (!/^[6-9]\d{9}$/.test(ten)) return null;
  return `91${ten}@${EMAIL_DOMAIN}`;
}

// Mirrors validatePassword() in src/lib/auth.js.
function passwordProblem(password: string) {
  const problems = [];
  if (password.length < 8) problems.push("at least 8 characters");
  if (!/[A-Z]/.test(password)) problems.push("one uppercase letter");
  if (!/[0-9]/.test(password)) problems.push("one number");
  if (!/[^A-Za-z0-9]/.test(password)) problems.push("one special character");
  return problems.length ? `Password needs ${problems.join(", ")}.` : null;
}

async function storeNewCode(admin: ReturnType<typeof createClient>, userId: string, loginEmail: string) {
  const code = generateCode();
  const { error } = await admin
    .from("recovery_codes")
    .upsert({ user_id: userId, login_email: loginEmail, code_hash: await hashCode(code), created_at: new Date().toISOString() });
  if (error) throw error;
  return code;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });
    const body = await req.json();

    if (body.action === "issue") {
      const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
      const { data, error } = await admin.auth.getUser(jwt);
      if (error || !data.user?.email) return respond({ error: "Please log in again." });
      return respond({ code: await storeNewCode(admin, data.user.id, data.user.email) });
    }

    if (body.action === "reset") {
      const invalid = "That mobile number and recovery code don't match.";
      const loginEmail = loginEmailForPhone(body.phone);
      if (!loginEmail) return respond({ error: "Enter a valid 10-digit mobile number." });
      const problem = passwordProblem(String(body.newPassword || ""));
      if (problem) return respond({ error: problem });

      const { data: row, error } = await admin
        .from("recovery_codes")
        .select("user_id, code_hash")
        .eq("login_email", loginEmail)
        .maybeSingle();
      if (error) throw error;
      if (!row || row.code_hash !== (await hashCode(body.code))) return respond({ error: invalid });

      const { error: updErr } = await admin.auth.admin.updateUserById(row.user_id, {
        password: String(body.newPassword),
      });
      if (updErr) throw updErr;
      return respond({ code: await storeNewCode(admin, row.user_id, loginEmail) });
    }

    return respond({ error: "Unknown action." });
  } catch (e) {
    console.error(e);
    return respond({ error: "Something went wrong. Please try again." });
  }
});
