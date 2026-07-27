import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useGuestTheme } from "../../contexts/ThemeContext";

// Optional customer login — a member gets their own order history and
// "usuals" on the menu (see Menu.jsx / OrderHistory.jsx). Staff accounts are
// still manager-provisioned only (createStaffMember); this page only ever
// signs up/in a member.
function authErrorMessage(err) {
  if (err.code === "auth/email-already-in-use") return "That email's already registered — sign in instead.";
  if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" || err.code === "auth/user-not-found") {
    return "Couldn't sign in — check the email and password.";
  }
  if (err.code === "auth/weak-password") return "Password needs to be at least 6 characters.";
  return "Something went wrong. Try again.";
}

export default function Account() {
  const { T } = useGuestTheme();
  const { user, member, accountType, loading, signIn, signUpMember, signOut } = useAuth();
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "signup") {
        await signUpMember(name, email, password);
      } else {
        await signIn(email, password);
      }
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-[420px] px-4 sm:px-8 py-14 text-sm" style={{ color: T.faint }}>Loading…</div>;
  }

  if (user && accountType === "staff") {
    return (
      <div className="mx-auto max-w-[420px] px-4 sm:px-8 py-14 text-center">
        <div className="mb-2 text-[15px] font-bold">You're signed in as staff</div>
        <div className="mb-4 text-[13.5px]" style={{ color: T.dim }}>
          This account isn't a customer account. Head to the staff portal instead.
        </div>
        <Link to="/staff" className="text-[13px] font-semibold underline" style={{ color: T.accent }}>
          Go to staff portal
        </Link>
      </div>
    );
  }

  if (user && accountType === "member") {
    return (
      <div className="mx-auto max-w-[420px] px-4 sm:px-8 py-14">
        <div className="mb-1 text-[11px] font-semibold tracking-wide" style={{ color: T.faint }}>MY ACCOUNT</div>
        <h1 className="mb-4 font-serif text-[26px] font-bold">Hi, {member.name}</h1>
        <div className="flex flex-col gap-2">
          <Link
            to="/account/orders"
            className="rounded-lg border px-4 py-3 text-[13.5px] font-semibold transition-colors hover:opacity-80"
            style={{ borderColor: T.border, background: T.panel, color: T.text }}
          >
            My order history →
          </Link>
          <button
            onClick={signOut}
            className="mt-2 text-left text-[13px] underline transition-opacity hover:opacity-70"
            style={{ color: T.faint }}
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  if (user) {
    // Signed in, but the member doc hasn't landed yet (auto-provisioned by
    // AuthContext) — a brief transitional state, not a dead end.
    return <div className="mx-auto max-w-[420px] px-4 sm:px-8 py-14 text-sm" style={{ color: T.faint }}>Setting up your account…</div>;
  }

  return (
    <div className="mx-auto max-w-[420px] px-4 sm:px-8 py-14">
      <div className="mb-1 text-[11px] font-semibold tracking-wide" style={{ color: T.faint }}>MY ACCOUNT</div>
      <h1 className="mb-2 font-serif text-[26px] font-bold">{mode === "signup" ? "Create an account" : "Sign in"}</h1>
      <p className="mb-5 text-[13.5px]" style={{ color: T.dim }}>
        Optional — sign in to see your order history and your usual picks on the menu.
      </p>

      <form onSubmit={onSubmit} className="flex flex-col gap-2.5">
        {mode === "signup" && (
          <div>
            <label className="mb-1 block text-[13px] font-semibold">Name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border px-3 py-2.5 text-sm outline-none"
              style={{ borderColor: T.border, background: T.panel, color: T.text }}
            />
          </div>
        )}
        <div>
          <label className="mb-1 block text-[13px] font-semibold">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border px-3 py-2.5 text-sm outline-none"
            style={{ borderColor: T.border, background: T.panel, color: T.text }}
          />
        </div>
        <div>
          <label className="mb-1 block text-[13px] font-semibold">Password</label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border px-3 py-2.5 text-sm outline-none"
            style={{ borderColor: T.border, background: T.panel, color: T.text }}
          />
        </div>

        {error && <div className="text-[13px] text-red-500">{error}</div>}

        <button
          type="submit"
          disabled={busy}
          className="mt-1 w-full rounded-md py-2.5 text-[13.5px] font-bold text-white transition-[filter] hover:brightness-110 disabled:opacity-60"
          style={{ background: T.accent }}
        >
          {busy ? "Working…" : mode === "signup" ? "Create account" : "Sign in"}
        </button>
      </form>

      <button
        onClick={() => {
          setMode(mode === "signup" ? "signin" : "signup");
          setError("");
        }}
        className="mt-4 text-[12.5px] underline transition-opacity hover:opacity-70"
        style={{ color: T.faint }}
      >
        {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
      </button>
    </div>
  );
}
