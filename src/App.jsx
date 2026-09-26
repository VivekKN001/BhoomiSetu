import { useEffect, useState } from "react";
import Header from "./components/Header.jsx";
import HomeView from "./components/HomeView.jsx";
import SellView from "./components/SellView.jsx";
import BuyView from "./components/BuyView.jsx";
import MatchesView from "./components/MatchesView.jsx";
import AuthView from "./components/AuthView.jsx";
import ProfileView from "./components/ProfileView.jsx";
import ReviewView from "./components/ReviewView.jsx";
import RecoveryCodeModal from "./components/RecoveryCodeModal.jsx";
import {
  fetchListings,
  fetchSwipes,
  fetchContacts,
  fetchMyListingInterest,
  fetchIsAdmin,
  recordSwipe,
  removeMatch,
} from "./lib/storage.js";
import { currentUser, getSession, onAuthStateChange, signOut } from "./lib/auth.js";
import { isSupabaseConfigured } from "./lib/supabaseClient.js";

const GATED_VIEWS = new Set(["sell", "buy", "matches", "profile", "review"]);
const NO_USER_DATA = { swipes: { liked: [], skipped: [] }, contacts: {}, interest: {}, isAdmin: false };

export default function App() {
  const [view, setView] = useState("home");
  const [listings, setListings] = useState([]);
  const [swipes, setSwipes] = useState(NO_USER_DATA.swipes);
  const [contacts, setContacts] = useState(NO_USER_DATA.contacts);
  const [interest, setInterest] = useState(NO_USER_DATA.interest);
  const [isAdmin, setIsAdmin] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const user = currentUser(session);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthLoading(false);
      return;
    }
    getSession().then((s) => {
      setSession(s);
      setAuthLoading(false);
    });
    return onAuthStateChange(setSession);
  }, []);

  // `loading` only covers the very first load. Later refreshes (after a
  // save, login, etc.) update data in place, so the current view keeps its
  // local state -- e.g. SellView's "Listing published" screen, or a
  // status message on ProfileView.
  const refresh = async () => {
    setError(null);
    try {
      const [l, userData] = await Promise.all([
        fetchListings(),
        user
          ? Promise.all([fetchSwipes(user.id), fetchContacts(), fetchMyListingInterest(), fetchIsAdmin(user.id)]).then(
              ([swipes, contacts, interest, isAdmin]) => ({ swipes, contacts, interest, isAdmin })
            )
          : Promise.resolve(NO_USER_DATA),
      ]);
      setListings(l);
      setSwipes(userData.swipes);
      setContacts(userData.contacts);
      setInterest(userData.interest);
      setIsAdmin(userData.isAdmin);
    } catch (e) {
      setError(e.message || "Could not reach the database.");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isSupabaseConfigured && !authLoading) refresh();
    else if (!isSupabaseConfigured) setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id]);

  const handleSwipe = async (listingId, direction) => {
    setSwipes((s) =>
      direction === "right"
        ? { ...s, liked: [...s.liked, listingId] }
        : { ...s, skipped: [...s.skipped, listingId] }
    );
    try {
      await recordSwipe(user.id, listingId, direction);
      // A right swipe on a verified listing unlocks its contact (RLS).
      if (direction === "right") setContacts(await fetchContacts());
    } catch (e) {
      console.error("Failed to save swipe:", e);
    }
  };

  const handleUnmatch = async (listingId) => {
    setSwipes((s) => ({ ...s, liked: s.liked.filter((id) => id !== listingId) }));
    try {
      await removeMatch(user.id, listingId);
    } catch (e) {
      console.error("Failed to remove match:", e);
    }
  };

  const handleLogout = async () => {
    await signOut();
    setView("home");
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="app">
        <div className="panel centerPanel" style={{ margin: "40px 16px" }}>
          <h2>Database not connected</h2>
          <p>
            Copy <code>.env.example</code> to <code>.env</code>, add your
            Supabase project URL and anon key, then restart{" "}
            <code>npm run dev</code>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <Header view={view} setView={setView} user={user} isAdmin={isAdmin} onLogout={handleLogout} />
      {recoveryCode && <RecoveryCodeModal code={recoveryCode} onClose={() => setRecoveryCode(null)} />}
      <main className="main">
        {loading ? (
          <div className="panel centerPanel"><p>Loading Mysuru listings…</p></div>
        ) : error ? (
          <div className="panel centerPanel">
            <p>{error}</p>
            <button className="btn btnPrimary" onClick={() => { setLoading(true); refresh(); }}>Try again</button>
          </div>
        ) : view === "home" ? (
          <HomeView setView={setView} listingCount={listings.length} />
        ) : GATED_VIEWS.has(view) && !user ? (
          <AuthView onRecoveryCode={setRecoveryCode} />
        ) : view === "sell" ? (
          <SellView listings={listings} interest={interest} onChange={refresh} setView={setView} user={user} />
        ) : view === "buy" ? (
          <BuyView listings={listings} swipes={swipes} onSwipe={handleSwipe} />
        ) : view === "profile" ? (
          <ProfileView
            user={user}
            listings={listings}
            swipes={swipes}
            onChange={refresh}
            onRecoveryCode={setRecoveryCode}
            onLogout={handleLogout}
          />
        ) : view === "review" && isAdmin ? (
          <ReviewView listings={listings} contacts={contacts} onChange={refresh} />
        ) : (
          <MatchesView listings={listings} swipes={swipes} contacts={contacts} onUnmatch={handleUnmatch} />
        )}
      </main>
    </div>
  );
}
