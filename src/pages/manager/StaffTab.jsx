import { useState } from "react";
import { deleteDoc, deleteField, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db, RESTAURANT_ID } from "../../firebase";
import { createStaffMember } from "../../lib/api";
import { fmtElapsed, fmtTime } from "../../lib/format";
import { useAuth } from "../../contexts/AuthContext";
import { useOpsTheme } from "../../contexts/ThemeContext";
import { Badge, Button, Modal, Panel } from "../../components/ops/primitives";

const ROLES = ["waiter", "chef", "manager"];
const emptyForm = { name: "", email: "", password: "", role: "waiter" };

// Clocking in/out is a direct Firestore write, not a Cloud Function —
// firestore.rules already lets a manager update any staff doc, and lets
// staff flip their own clockedIn field without a manager doing it for them.
// Role change and removal are the same direct-write pattern (rules already
// allow a manager to update/delete any staff doc unconditionally) — the only
// thing new here beyond that is a self-lockout guard, and creating a staff
// member, which needs the Admin SDK (createStaffMember) to pair an Auth user
// with the doc.
export default function StaffTab({ staff }) {
  const { T } = useOpsTheme();
  const { staff: currentStaff } = useAuth();
  const [pendingId, setPendingId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function toggle(person) {
    setPendingId(person.id);
    const ref = doc(db, "restaurants", RESTAURANT_ID, "staff", person.id);
    try {
      await updateDoc(
        ref,
        person.clockedIn
          ? { clockedIn: false, clockedInAt: deleteField() }
          : { clockedIn: true, clockedInAt: serverTimestamp() }
      );
    } finally {
      setPendingId(null);
    }
  }

  async function changeRole(person, role) {
    setPendingId(person.id);
    try {
      await updateDoc(doc(db, "restaurants", RESTAURANT_ID, "staff", person.id), { role });
    } finally {
      setPendingId(null);
    }
  }

  async function remove(person) {
    if (!confirm(`Remove ${person.name}? This revokes all their access immediately.`)) return;
    setPendingId(person.id);
    try {
      await deleteDoc(doc(db, "restaurants", RESTAURANT_ID, "staff", person.id));
    } finally {
      setPendingId(null);
    }
  }

  function openAdd() {
    setForm(emptyForm);
    setError("");
    setAdding(true);
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!form.name.trim() || !form.email.trim() || form.password.length < 6) {
      setError("Name, email, and a password of at least 6 characters are required.");
      return;
    }
    setSubmitting(true);
    try {
      await createStaffMember({ name: form.name.trim(), email: form.email.trim(), password: form.password, role: form.role });
      setAdding(false);
    } catch (e) {
      setError(e.message || "That didn't work.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button variant="primary" onClick={openAdd}>+ Add staff</Button>
      </div>
      <Panel className="overflow-x-auto">
        <div className="min-w-[640px]">
        <div className="grid grid-cols-[1.4fr_1fr_1fr_0.9fr_1.1fr] border-b px-4 py-2.5" style={{ borderColor: T.border }}>
          <div className="text-[11.5px] font-bold" style={{ color: T.faint }}>NAME</div>
          <div className="text-[11.5px] font-bold" style={{ color: T.faint }}>ROLE</div>
          <div className="text-[11.5px] font-bold" style={{ color: T.faint }}>SHIFT</div>
          <div className="text-[11.5px] font-bold" style={{ color: T.faint }}>STATUS</div>
          <div className="text-[11.5px] font-bold" style={{ color: T.faint }}>ACTION</div>
        </div>
        {staff.map((p) => {
          const isSelf = p.id === currentStaff?.id;
          return (
            <div
              key={p.id}
              className="grid grid-cols-[1.4fr_1fr_1fr_0.9fr_1.1fr] items-center border-b px-4 py-2.5 text-[13.5px]"
              style={{ borderColor: T.panel2 }}
            >
              <div>{p.name}</div>
              <div>
                <select
                  value={p.role}
                  disabled={isSelf || pendingId === p.id}
                  onChange={(e) => changeRole(p, e.target.value)}
                  title={isSelf ? "You can't change your own role" : ""}
                  className="rounded-md border px-1.5 py-1 text-[12.5px] capitalize outline-none disabled:opacity-50"
                  style={{ background: T.inputBg, borderColor: T.borderAlt, color: T.text }}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div className="font-mono" style={{ color: T.dim }}>
                {p.clockedIn && p.clockedInAt ? (
                  <>
                    {fmtTime(p.clockedInAt.toDate())} · {fmtElapsed(Date.now() - p.clockedInAt.toDate().getTime())}
                  </>
                ) : (
                  "—"
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge kind={p.clockedIn ? "green" : "gray"}>{p.clockedIn ? "ON SHIFT" : "OFF SHIFT"}</Badge>
                <button
                  className="text-[11px] underline transition-opacity hover:opacity-70 disabled:opacity-40"
                  style={{ color: T.faint }}
                  disabled={pendingId === p.id}
                  onClick={() => toggle(p)}
                >
                  {p.clockedIn ? "Clock out" : "Clock in"}
                </button>
              </div>
              <div>
                <button
                  className="text-[11px] underline transition-opacity hover:opacity-70 disabled:opacity-40"
                  style={{ color: T.faint }}
                  disabled={isSelf || pendingId === p.id}
                  title={isSelf ? "You can't remove yourself" : ""}
                  onClick={() => remove(p)}
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}
        </div>
      </Panel>

      <Modal open={adding} onClose={() => setAdding(false)} width={340}>
        <div className="mb-3 text-[15px] font-bold">Add staff</div>
        <form onSubmit={submit} className="flex flex-col gap-2.5">
          <div>
            <label className="mb-1 block text-[13px] font-semibold">Name</label>
            <input
              autoFocus
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none"
              style={{ background: T.inputBg, borderColor: T.borderAlt, color: T.text }}
            />
          </div>
          <div>
            <label className="mb-1 block text-[13px] font-semibold">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none"
              style={{ background: T.inputBg, borderColor: T.borderAlt, color: T.text }}
            />
          </div>
          <div>
            <label className="mb-1 block text-[13px] font-semibold">Password</label>
            <input
              type="text"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="At least 6 characters"
              className="w-full rounded-md border px-3 py-2 text-sm outline-none"
              style={{ background: T.inputBg, borderColor: T.borderAlt, color: T.text }}
            />
          </div>
          <div>
            <label className="mb-1 block text-[13px] font-semibold">Role</label>
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              className="w-full rounded-md border px-3 py-2 text-sm capitalize outline-none"
              style={{ background: T.inputBg, borderColor: T.borderAlt, color: T.text }}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          {error && <div className="text-[13px] text-red-400">{error}</div>}
          <Button variant="primary" type="submit" disabled={submitting}>
            {submitting ? "Adding…" : "Add staff"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
