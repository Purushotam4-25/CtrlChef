import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import { db, RESTAURANT_ID } from "../firebase";
import logoIcon from "../assets/logo-icon.png";

// Firebase Auth errors are typed — worth telling "wrong password" apart from
// "the emulator/network is down", which otherwise look identical to the user.
function loginErrorMessage(err) {
  if (err.code === "auth/network-request-failed") {
    return "Can't reach the auth server — is it running?";
  }
  if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" || err.code === "auth/user-not-found") {
    return "Couldn't sign in — check the email and password.";
  }
  if (err.code === "auth/popup-closed-by-user") {
    return "";
  }
  return "Couldn't sign in — something went wrong. Try again.";
}

export default function Login() {
  const { user, staff, loading, signIn, signInWithGoogle, resetPassword, signOut } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("CtrlChef");
  const [mode, setMode] = useState("signin"); // "signin" | "reset"
  const [resetSent, setResetSent] = useState(false);

  // This page sits outside both data providers (its own top-level route in
  // App.jsx) — a small local listener is cheaper than restructuring the
  // route tree for one field. restaurants/{id} is public-read, no auth
  // needed.
  useEffect(() => {
    return onSnapshot(doc(db, "restaurants", RESTAURANT_ID), (snap) => setName(snap.data()?.name || "CtrlChef"));
  }, []);

  useEffect(() => {
    document.title = name;
  }, [name]);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await signIn(email, password);
      navigate("/staff", { replace: true });
    } catch (err) {
      setError(loginErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    setError("");
    setBusy(true);
    try {
      await signInWithGoogle();
      navigate("/staff", { replace: true });
    } catch (err) {
      setError(loginErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onReset(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await resetPassword(email);
      setResetSent(true);
    } catch (err) {
      setError(loginErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const card = "w-[340px] max-w-[calc(100vw-2rem)] rounded-xl border border-[#35302b] bg-[#211e1b] p-6";
  const header = (
    <div className="mb-1 flex items-center gap-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white p-1">
        <img src={logoIcon} alt="" className="h-full w-full object-contain" />
      </div>
      <div>
        <div className="text-[15px] font-bold leading-tight">{name}</div>
        <div className="text-[10px] tracking-wide text-[#8a8177]">STAFF PORTAL</div>
      </div>
    </div>
  );

  // Signed in (any provider) but no matching staff doc — an explicit message
  // instead of silently bouncing back to this same page, which reads as
  // broken software rather than access control.
  if (!loading && user && !staff) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#1a1816] font-sans text-[#f2ede8]">
        <div className={card}>
          {header}
          <p className="mt-4 mb-4 text-[13px] text-[#a89e96]">
            <span className="font-semibold text-[#f2ede8]">{user.email}</span> isn't registered
            as staff for this restaurant. Ask a manager to add you, or browse the menu as a guest.
          </p>
          <button
            onClick={signOut}
            className="w-full rounded-md border border-[#3d3733] py-2.5 text-[13.5px] font-semibold text-[#f2ede8] transition-colors hover:bg-[#2a2622]"
          >
            Sign out
          </button>
          <a href="/menu" className="mt-4 block text-center text-[12.5px] text-[#8a8177] transition-opacity hover:opacity-70">
            ← Back to the public menu
          </a>
        </div>
      </div>
    );
  }

  if (mode === "reset") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#1a1816] font-sans text-[#f2ede8]">
        <form onSubmit={onReset} className={card}>
          {header}
          {resetSent ? (
            <p className="mt-4 text-[13px] text-[#a89e96]">
              If an account exists for <span className="font-semibold text-[#f2ede8]">{email}</span>,
              a password reset link is on its way.
            </p>
          ) : (
            <>
              <p className="mt-4 mb-4 text-[13px] text-[#a89e96]">Enter your email and we'll send a reset link.</p>
              <label className="mb-1 block text-[13px] font-semibold">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mb-4 w-full rounded-md border border-[#3d3733] bg-[#1c1917] px-3 py-2.5 text-sm text-[#f2ede8] outline-none"
              />
              {error && <div className="mb-3 text-[13px] text-red-400">{error}</div>}
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-md bg-[#c2662f] py-2.5 text-[13.5px] font-bold text-white transition-[filter] hover:brightness-110 disabled:opacity-60"
              >
                {busy ? "Sending…" : "Send reset link"}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => { setMode("signin"); setResetSent(false); setError(""); }}
            className="mt-4 block w-full text-center text-[12.5px] text-[#8a8177] transition-opacity hover:opacity-70"
          >
            ← Back to sign in
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#1a1816] font-sans text-[#f2ede8]">
      <form onSubmit={onSubmit} className={card}>
        {header}
        <p className="mt-4 mb-4 text-[13px] text-[#a89e96]">Sign in with your staff account.</p>

        <label className="mb-1 block text-[13px] font-semibold">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-3 w-full rounded-md border border-[#3d3733] bg-[#1c1917] px-3 py-2.5 text-sm text-[#f2ede8] outline-none"
        />

        <label className="mb-1 block text-[13px] font-semibold">Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-2 w-full rounded-md border border-[#3d3733] bg-[#1c1917] px-3 py-2.5 text-sm text-[#f2ede8] outline-none"
        />

        <button
          type="button"
          onClick={() => { setMode("reset"); setError(""); }}
          className="mb-4 block text-[12px] text-[#8a8177] transition-opacity hover:opacity-70"
        >
          Forgot password?
        </button>

        {error && <div className="mb-3 text-[13px] text-red-400">{error}</div>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-[#c2662f] py-2.5 text-[13.5px] font-bold text-white transition-[filter] hover:brightness-110 disabled:opacity-60 disabled:hover:brightness-100"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>

        <div className="my-3 flex items-center gap-2 text-[11px] text-[#8a8177]">
          <div className="h-px flex-1 bg-[#35302b]" />
          or
          <div className="h-px flex-1 bg-[#35302b]" />
        </div>

        <button
          type="button"
          onClick={onGoogle}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-[#3d3733] bg-[#1c1917] py-2.5 text-[13.5px] font-semibold text-[#f2ede8] transition-colors hover:bg-[#2a2622] disabled:opacity-60"
        >
          <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z" />
            <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.6 15.8 18.9 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6 29.6 4 24 4c-7.4 0-13.8 4.1-17.2 10.2z" />
            <path fill="#4CAF50" d="M24 44c5.5 0 10.4-1.9 14.2-5.1l-6.6-5.4c-2 1.4-4.6 2.3-7.6 2.3-5.3 0-9.7-3.4-11.3-8.1l-6.5 5.1C9.9 39.6 16.4 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.6 5.4C41.5 35.6 44 30.2 44 24c0-1.2-.1-2.4-.4-3.5z" />
          </svg>
          Continue with Google
        </button>

        <a href="/signup" className="mt-4 block text-center text-[12.5px] text-[#8a8177] transition-opacity hover:opacity-70">
          Need an account? Sign up
        </a>
        <a href="/menu" className="mt-2 block text-center text-[12.5px] text-[#8a8177] transition-opacity hover:opacity-70">
          ← Back to the public menu
        </a>
      </form>
    </div>
  );
}
