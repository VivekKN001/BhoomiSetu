import { useState } from "react";
import { UserCircle, KeyRound, Lock, LogOut } from "lucide-react";
import { PASSWORD_RULES_HINT, issueRecoveryCode, updateFullName, updatePassword } from "../lib/auth.js";
import { updateSellerName } from "../lib/storage.js";

// Small per-section status line: { kind: "ok" | "error", text }.
function Status({ status }) {
  if (!status) return null;
  return <p className={status.kind === "ok" ? "okText" : "errorText"}>{status.text}</p>;
}

export default function ProfileView({ user, listings, swipes, onChange, onRecoveryCode, onLogout }) {
  const [fullName, setFullName] = useState(user.fullName);
  const [nameStatus, setNameStatus] = useState(null);
  const [savingName, setSavingName] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState(null);
  const [savingPassword, setSavingPassword] = useState(false);

  const [codeStatus, setCodeStatus] = useState(null);
  const [issuingCode, setIssuingCode] = useState(false);

  const myListingCount = listings.filter((l) => l.sellerId === user.id).length;

  const saveName = async (e) => {
    e.preventDefault();
    setSavingName(true);
    setNameStatus(null);
    try {
      const name = await updateFullName(fullName);
      // Listings carry a copy of the seller's name -- keep them in step.
      await updateSellerName(user.id, name);
      await onChange();
      setNameStatus({ kind: "ok", text: "Name updated." });
    } catch (err) {
      setNameStatus({ kind: "error", text: err.message || "Could not update your name." });
    }
    setSavingName(false);
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      setPasswordStatus({ kind: "error", text: "Enter both your current and new password." });
      return;
    }
    setSavingPassword(true);
    setPasswordStatus(null);
    try {
      await updatePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setPasswordStatus({ kind: "ok", text: "Password changed." });
    } catch (err) {
      setPasswordStatus({ kind: "error", text: err.message || "Could not change your password." });
    }
    setSavingPassword(false);
  };

  const newCode = async () => {
    setIssuingCode(true);
    setCodeStatus(null);
    try {
      onRecoveryCode(await issueRecoveryCode());
    } catch (err) {
      setCodeStatus({ kind: "error", text: err.message });
    }
    setIssuingCode(false);
  };

  return (
    <div className="panel">
      <div className="profileHead">
        <UserCircle size={40} color="#2F6E6E" />
        <div>
          <h2>{user.fullName}</h2>
          <p className="subtext">{user.phoneDisplay}</p>
        </div>
      </div>
      <div className="profileStats">
        <div><strong>{myListingCount}</strong><span>listing{myListingCount === 1 ? "" : "s"}</span></div>
        <div><strong>{swipes.liked.length}</strong><span>shortlisted</span></div>
      </div>

      <section className="profileSection">
        <h3>Your details</h3>
        <form onSubmit={saveName}>
          <label className="field">
            <span>Full name</span>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </label>
          <label className="field">
            <span>Mobile number</span>
            <input value={user.phoneDisplay} disabled />
            <small className="passwordHint">Your mobile number is your login and can't be changed yet.</small>
          </label>
          <Status status={nameStatus} />
          <button className="btn btnPrimary" type="submit" disabled={savingName || fullName.trim() === user.fullName}>
            {savingName ? "Saving…" : "Save name"}
          </button>
        </form>
      </section>

      <section className="profileSection">
        <h3><Lock size={15} /> Change password</h3>
        <form onSubmit={savePassword}>
          <label className="field">
            <span>Current password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </label>
          <label className="field">
            <span>New password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <small className="passwordHint">{PASSWORD_RULES_HINT}</small>
          </label>
          <Status status={passwordStatus} />
          <button className="btn btnPrimary" type="submit" disabled={savingPassword}>
            {savingPassword ? "Saving…" : "Change password"}
          </button>
        </form>
      </section>

      <section className="profileSection">
        <h3><KeyRound size={15} /> Recovery code</h3>
        <p className="subtext">
          Your recovery code is how you reset a forgotten password. Lost it, or never saved one? Generate a new one —
          your old code stops working immediately.
        </p>
        <Status status={codeStatus} />
        <button className="btn btnGhost" onClick={newCode} disabled={issuingCode}>
          {issuingCode ? "Generating…" : "Generate new recovery code"}
        </button>
      </section>

      <button className="btn btnGhost wide" onClick={onLogout} style={{ marginTop: 20 }}>
        <LogOut size={16} /> Log out
      </button>
    </div>
  );
}
