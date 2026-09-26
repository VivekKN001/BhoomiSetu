import { supabase } from "./supabaseClient.js";

const EMAIL_DOMAIN = "bhoomisetu.local";

// Supabase's hosted phone-auth field requires a configured SMS provider
// even without OTP, which this project doesn't have. So login is really
// email+password under the hood, with a synthetic, never-emailed address
// derived from the phone number -- the UI only ever shows a phone number.
export function normalizePhone(raw) {
  const digits = String(raw || "").trim().replace(/\D/g, "");
  const ten = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  if (!/^[6-9]\d{9}$/.test(ten)) {
    throw new Error("Enter a valid 10-digit mobile number.");
  }
  return {
    display: `+91 ${ten.slice(0, 5)} ${ten.slice(5)}`,
    syntheticEmail: `91${ten}@${EMAIL_DOMAIN}`,
  };
}

export const PASSWORD_RULES_HINT =
  "At least 8 characters, with 1 uppercase letter, 1 number, and 1 special character.";

function validatePassword(password) {
  const problems = [];
  if (password.length < 8) problems.push("at least 8 characters");
  if (!/[A-Z]/.test(password)) problems.push("one uppercase letter");
  if (!/[0-9]/.test(password)) problems.push("one number");
  if (!/[^A-Za-z0-9]/.test(password)) problems.push("one special character");
  if (problems.length) throw new Error(`Password needs ${problems.join(", ")}.`);
}

export async function signUp(fullName, phone, password) {
  const name = String(fullName || "").trim();
  if (!name) throw new Error("Enter your full name.");
  validatePassword(password);
  const { syntheticEmail, display } = normalizePhone(phone);

  const { data, error } = await supabase.auth.signUp({
    email: syntheticEmail,
    password,
    options: { data: { full_name: name, phone_display: display } },
  });
  if (error) {
    if (/registered/i.test(error.message)) {
      throw new Error("That phone number already has an account — try logging in instead.");
    }
    throw error;
  }
  if (data.user && data.user.identities?.length === 0) {
    throw new Error("That phone number already has an account — try logging in instead.");
  }
  return data.session;
}

export async function signIn(phone, password) {
  const { syntheticEmail } = normalizePhone(phone);
  const { data, error } = await supabase.auth.signInWithPassword({
    email: syntheticEmail,
    password,
  });
  if (error) throw new Error("Incorrect phone number or password.");
  return data.session;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onAuthStateChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

export function currentUser(session) {
  if (!session?.user) return null;
  const { id, user_metadata } = session.user;
  return {
    id,
    fullName: user_metadata?.full_name || "",
    phoneDisplay: user_metadata?.phone_display || "",
  };
}

// Recovery codes -- the only forgot-password path, since there's no SMS
// provider and nothing ever reaches the synthetic email. Both go through
// the account-recovery Edge Function (see supabase/functions/account-recovery),
// which always answers { code } or { error }.
async function invokeRecovery(body) {
  const { data, error } = await supabase.functions.invoke("account-recovery", { body });
  if (error || !data) {
    throw new Error("Account recovery isn't available right now. Please try again later.");
  }
  if (data.error) throw new Error(data.error);
  return data.code;
}

// Issues a fresh code for the logged-in user. Any older code stops working.
export async function issueRecoveryCode() {
  return invokeRecovery({ action: "issue" });
}

// Resets the password, logs in with it, and returns the user's NEW
// recovery code (each code works once).
export async function resetPasswordWithCode(phone, code, newPassword) {
  normalizePhone(phone);
  validatePassword(newPassword);
  const newCode = await invokeRecovery({ action: "reset", phone, code, newPassword });
  await signIn(phone, newPassword);
  return newCode;
}

// Re-checks the current password first, so an unlocked phone left logged
// in isn't enough to take over the account.
export async function updatePassword(currentPassword, newPassword) {
  validatePassword(newPassword);
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const { error: checkErr } = await supabase.auth.signInWithPassword({
    email: userData.user.email,
    password: currentPassword,
  });
  if (checkErr) throw new Error("Your current password is incorrect.");
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function updateFullName(fullName) {
  const name = String(fullName || "").trim();
  if (!name) throw new Error("Enter your full name.");
  const { error } = await supabase.auth.updateUser({ data: { full_name: name } });
  if (error) throw error;
  return name;
}

