import { Home as HomeIcon, PlusCircle, Sparkles, Users, ShieldCheck, UserCircle } from "lucide-react";

const ITEMS = [
  { id: "home", label: "Home", icon: HomeIcon },
  { id: "sell", label: "List land", icon: PlusCircle },
  { id: "buy", label: "Browse", icon: Sparkles },
  { id: "matches", label: "Matches", icon: Users },
];

const ADMIN_ITEM = { id: "review", label: "Review", icon: ShieldCheck };

export default function Header({ view, setView, user, isAdmin, onLogout }) {
  const items = isAdmin ? [...ITEMS, ADMIN_ITEM] : ITEMS;
  return (
    <header className="header">
      <button className="brand" onClick={() => setView("home")}>
        <svg width="26" height="26" viewBox="0 0 26 26">
          <polyline points="1,20 7,7 13,20 19,7 25,20" fill="none" stroke="#C9A227" strokeWidth="2" />
          <line x1="1" y1="20" x2="25" y2="20" stroke="#C9A227" strokeWidth="2" />
        </svg>
        <span>BhoomiSetu</span>
      </button>
      <nav>
        {items.map((it) => (
          <button
            key={it.id}
            className={`navbtn ${view === it.id ? "active" : ""}`}
            onClick={() => setView(it.id)}
          >
            <it.icon size={16} />
            <span>{it.label}</span>
          </button>
        ))}
      </nav>
      {user ? (
        <div className="authArea">
          <button
            className={`navbtn ${view === "profile" ? "active" : ""}`}
            onClick={() => setView("profile")}
            title="Your profile"
          >
            <UserCircle size={16} />
            <span className="userName">{user.fullName}</span>
          </button>
          <button className="btn btnGhost sm" onClick={onLogout}>Log out</button>
        </div>
      ) : (
        <button className="navbtn" onClick={() => setView("buy")}>Log in</button>
      )}
    </header>
  );
}
