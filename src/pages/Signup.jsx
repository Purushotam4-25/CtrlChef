import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import { db, RESTAURANT_ID } from "../firebase";
import logoIcon from "../assets/logo-icon.png";

function signupErrorMessage(err) {
  if (err.code === "auth/email-already-in-use") return "An account with that email already exists.";
  if (err.code === "auth/weak-password") return "Password must be at least 6 characters.";
  if (err.code === "auth/network-request-failed") return "Can't reach the auth server — is it running?";
  return "Couldn't create the account — something went wrong. Try again.";
}

export default function Signup() {
  const { user, signUp, resendVerification, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [resent, setResent] = useState(false);
  const [name, setName] = useState("CtrlChef");

  useEffect(() => {
    return onSnapshot(doc(db, "restaurants", RESTAURANT_ID), (snap) => setName(snap.data()?.name || "CtrlChef"));
  }, []);

  useEffect(() => {
    document.title = name;
  }, [name]);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      await signUp(email, password);
      setSent(true);
    } catch (err) {
      setError(signupErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onResend() {
    setBusy(true);
    try {
      await resendVerification();
      setResent(true);
    } catch (err) {
      setError(signupErrorMessage(err));
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

  if (sent || (user && !user.emailVerified)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#1a1816] font-sans text-[#f2ede8]">
        <div className={card}>
          {header}
          <p className="mt-4 mb-4 text-[13px] text-[#a89e96]">
            Check <span className="font-semibold text-[#f2ede8]">{user?.email || email}</span> for a
            verification link. In the emulator, the link is logged to the Auth emulator's console
            instead of a real email.
          </p>
          {resent && <p className="mb-3 text-[13px] text-[#a89e96]">Verification email resent.</p>}
          {error && <div className="mb-3 text-[13px] text-red-400">{error}</div>}
          <button
            onClick={onResend}
            disabled={busy}
            className="w-full rounded-md bg-[#c2662f] py-2.5 text-[13.5px] font-bold text-white transition-[filter] hover:brightness-110 disabled:opacity-60"
          >
            {busy ? "Sending…" : "Resend email"}
          </button>
          <button
            onClick={signOut}
            className="mt-3 w-full rounded-md border border-[#3d3733] py-2.5 text-[13.5px] font-semibold text-[#f2ede8] transition-colors hover:bg-[#2a2622]"
          >
            Sign out
          </button>
          <a href="/login" className="mt-4 block text-center text-[12.5px] text-[#8a8177] transition-opacity hover:opacity-70">
            ← Back to sign in
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#1a1816] font-sans text-[#f2ede8]">
      <form onSubmit={onSubmit} className={card}>
        {header}
        <p className="mt-4 mb-4 text-[13px] text-[#a89e96]">Create an account.</p>

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
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-3 w-full rounded-md border border-[#3d3733] bg-[#1c1917] px-3 py-2.5 text-sm text-[#f2ede8] outline-none"
        />

        <label className="mb-1 block text-[13px] font-semibold">Confirm password</label>
        <input
          type="password"
          required
          minLength={6}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="mb-4 w-full rounded-md border border-[#3d3733] bg-[#1c1917] px-3 py-2.5 text-sm text-[#f2ede8] outline-none"
        />

        {error && <div className="mb-3 text-[13px] text-red-400">{error}</div>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-[#c2662f] py-2.5 text-[13.5px] font-bold text-white transition-[filter] hover:brightness-110 disabled:opacity-60"
        >
          {busy ? "Creating account…" : "Sign up"}
        </button>

        <a href="/login" className="mt-4 block text-center text-[12.5px] text-[#8a8177] transition-opacity hover:opacity-70">
          Already have an account? Sign in
        </a>
      </form>
    </div>
  );
}
