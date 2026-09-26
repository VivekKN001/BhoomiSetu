import { useState } from "react";
import { KeyRound, Copy, Check } from "lucide-react";

// Shown once whenever a new recovery code is issued (signup, password
// reset, or "generate new code" in Profile). The code is never stored in
// readable form anywhere, so this is the user's only chance to save it.
export default function RecoveryCodeModal({ code, onClose }) {
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // Clipboard API is unavailable over plain-HTTP LAN addresses --
      // the code is still selectable on screen.
    }
  };

  return (
    <div className="overlay">
      <div className="panel recoveryPanel" role="dialog" aria-label="Your recovery code">
        <KeyRound size={30} color="#8B3A2B" />
        <h2>Save your recovery code</h2>
        <p className="subtext">
          If you ever forget your password, this code is the <strong>only</strong> way back into your account. Write it
          down or take a screenshot and keep it somewhere safe. It works once — you'll get a new one after using it.
        </p>
        <div className="recoveryCode">{code}</div>
        <button className="btn btnGhost wide" onClick={copy}>
          {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Copied" : "Copy code"}
        </button>
        <label className="checkRow">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
          I've saved this code somewhere safe
        </label>
        <button className="btn btnPrimary wide" disabled={!confirmed} onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}
