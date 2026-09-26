import { useState } from "react";
import { LogIn, UserPlus, KeyRound } from "lucide-react";
import { PASSWORD_RULES_HINT, issueRecoveryCode, resetPasswordWithCode, signIn, signUp } from "../lib/auth.js";

const TITLES = {
  login: "Log in",
  signup: "Create your account",
  forgot: "Reset your password",
};

const SUBTEXTS = {
  login: "Log in to list land, browse, and see your matches.",
  signup: "Buyers and sellers both use the same login.",
  forgot: "Enter the recovery code you saved when you signed up (or last generated in your profile).",
};

// onRecoveryCode(code): hands a freshly issued recovery code up to App,
// which shows it in a modal -- this view unmounts the moment the new
// session lands, so it can't display the code itself.
export default function AuthView({ onRecoveryCode }) {
  const [mode, setMode] = useState("login");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const isSignup = mode === "signup";
  const isForgot = mode === "forgot";

  const switchMode = (next) => {
    setMode(next);
    setErrorMsg(null);
    setPassword("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!phone || !password || (isSignup && !fullName) || (isForgot && !recoveryCode)) {
      setErrorMsg("Please fill in every field.");
      return;
    }
    setErrorMsg(null);
    setSubmitting(true);
    try {
      if (isSignup) {
        await signUp(fullName, phone, password);
        // Best effort: if the account-recovery function isn't deployed,
        // signup still succeeds and a code can be generated from Profile.
        issueRecoveryCode().then(onRecoveryCode, () => {});
      } else if (isForgot) {
        const newCode = await resetPasswordWithCode(phone, recoveryCode, password);
        onRecoveryCode(newCode);
      } else {
        await signIn(phone, password);
      }
      // No further action needed here -- App.jsx's auth-state subscription
      // picks up the new session and re-renders past this view.
    } catch (err) {
      setErrorMsg(err.message || "Something went wrong.");
    }
    setSubmitting(false);
  };

  return (
    <div className="panel">
      <h2>{TITLES[mode]}</h2>
      <p className="subtext">{SUBTEXTS[mode]}</p>

      <form onSubmit={handleSubmit}>
        {isSignup && (
          <label className="field">
            <span>Full name</span>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" />
          </label>
        )}

        <label className="field">
          <span>Mobile number</span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="90000 00001"
          />
        </label>

        {isForgot && (
          <label className="field">
            <span>Recovery code</span>
            <input
              value={recoveryCode}
              onChange={(e) => setRecoveryCode(e.target.value)}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              autoCapitalize="characters"
              autoComplete="off"
            />
          </label>
        )}

        <label className="field">
          <span>{isForgot ? "New password" : "Password"}</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isForgot ? "New password" : "Password"}
            autoComplete={isSignup || isForgot ? "new-password" : "current-password"}
          />
          {(isSignup || isForgot) && <small className="passwordHint">{PASSWORD_RULES_HINT}</small>}
        </label>

        {errorMsg && <p className="errorText">{errorMsg}</p>}

        <button className="btn btnPrimary wide" type="submit" disabled={submitting}>
          {isSignup ? <UserPlus size={16} /> : isForgot ? <KeyRound size={16} /> : <LogIn size={16} />}
          {submitting ? "Please wait…" : isSignup ? "Sign up" : isForgot ? "Reset password" : "Log in"}
        </button>
      </form>

      {mode === "login" && (
        <button type="button" className="linkBtn forgotLink" onClick={() => switchMode("forgot")}>
          Forgot password?
        </button>
      )}

      <button
        type="button"
        className="btn btnGhost wide"
        style={{ marginTop: 10 }}
        onClick={() => switchMode(isSignup || isForgot ? "login" : "signup")}
      >
        {isSignup || isForgot ? "Back to log in" : "New here? Sign up"}
      </button>

      {isForgot && (
        <p className="subtext" style={{ marginTop: 14 }}>
          Lost your recovery code too? We can't reset your password without it — there's no SMS or email
          behind BhoomiSetu accounts yet.
        </p>
      )}
    </div>
  );
}
