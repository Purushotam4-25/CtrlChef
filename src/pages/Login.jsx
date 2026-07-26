import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await signIn(email, password);
      navigate("/staff", { replace: true });
    } catch (err) {
      setError("Couldn't sign in — check the email and password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#1a1816] font-sans text-[#f2ede8]">
      <form
        onSubmit={onSubmit}
        className="w-[340px] rounded-xl border border-[#35302b] bg-[#211e1b] p-6"
      >
        <div className="mb-1 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#c2662f]">
            <div className="h-4 w-3 rotate-45 rounded-[60%_60%_60%_5%] bg-white" />
          </div>
          <div>
            <div className="text-[15px] font-bold leading-tight">CtrlChef</div>
            <div className="text-[10px] tracking-wide text-[#8a8177]">STAFF PORTAL</div>
          </div>
        </div>
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
          className="mb-4 w-full rounded-md border border-[#3d3733] bg-[#1c1917] px-3 py-2.5 text-sm text-[#f2ede8] outline-none"
        />

        {error && <div className="mb-3 text-[13px] text-red-400">{error}</div>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-[#c2662f] py-2.5 text-[13.5px] font-bold text-white disabled:opacity-60"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>

        <a href="/menu" className="mt-4 block text-center text-[12.5px] text-[#8a8177]">
          ← Back to the public menu
        </a>
      </form>
    </div>
  );
}
