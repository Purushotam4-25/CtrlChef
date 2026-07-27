import { useState } from "react";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db, RESTAURANT_ID } from "../../firebase";
import { forceResetTable } from "../../lib/api";
import { fmtElapsed } from "../../lib/format";
import { useOpsTheme } from "../../contexts/ThemeContext";
import { Badge, Button, Modal, Panel } from "../../components/ops/primitives";

const tablesRef = () => collection(db, "restaurants", RESTAURANT_ID, "tables");

// Add/edit a table's number/capacity is a direct Firestore write —
// firestore.rules already lets a manager create/update/delete a table, with
// `status` pinned unchanged so the empty/occupied/needs_cleaning lifecycle
// stays function-only (seatTable/closeOrder/markTableClean). Deleting an
// occupied table is blocked client-side, not by the rules — there's no rule
// against it, but it would orphan whatever order is sitting on it.
export default function TablesTab({ tables }) {
  const { T } = useOpsTheme();
  const [editing, setEditing] = useState(null); // null closed, {} for new, table for edit
  const [form, setForm] = useState({ number: "", capacity: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pendingId, setPendingId] = useState(null);

  function openNew() {
    setForm({ number: "", capacity: "" });
    setError("");
    setEditing({});
  }

  function openEdit(t) {
    setForm({ number: String(t.number), capacity: String(t.capacity) });
    setError("");
    setEditing(t);
  }

  async function submit(e) {
    e.preventDefault();
    const number = Number(form.number);
    const capacity = Number(form.capacity);
    if (!Number.isInteger(number) || number <= 0 || !Number.isInteger(capacity) || capacity <= 0) {
      setError("Enter a positive table number and capacity.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      if (editing.id) {
        await updateDoc(doc(db, "restaurants", RESTAURANT_ID, "tables", editing.id), { number, capacity });
      } else {
        await addDoc(tablesRef(), { number, capacity, status: "empty" });
      }
      setEditing(null);
    } catch (e) {
      setError(e.message || "That didn't work.");
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(t) {
    if (!confirm(`Delete Table ${t.number}?`)) return;
    setPendingId(t.id);
    try {
      await deleteDoc(doc(db, "restaurants", RESTAURANT_ID, "tables", t.id));
    } finally {
      setPendingId(null);
    }
  }

  async function reset(t) {
    setPendingId(t.id);
    try {
      await forceResetTable({ tableId: t.id });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button variant="primary" onClick={openNew}>+ Add table</Button>
      </div>
      <Panel className="overflow-x-auto">
        <div className="min-w-[560px]">
        <div className="grid grid-cols-[1fr_1fr_1fr_1fr_1.2fr] border-b px-4 py-2.5" style={{ borderColor: T.border }}>
          {["TABLE", "CAPACITY", "STATUS", "SEATED", "ACTION"].map((h) => (
            <div key={h} className="text-[11.5px] font-bold" style={{ color: T.faint }}>{h}</div>
          ))}
        </div>
        {tables.map((t, idx) => (
          <div
            key={t.id}
            className="grid grid-cols-[1fr_1fr_1fr_1fr_1.2fr] items-center border-b px-4 py-2.5 text-[13.5px]"
            style={{ borderColor: T.panel2, background: idx % 2 === 1 ? T.zebra : "transparent" }}
          >
            <div>Table {t.number}</div>
            <div style={{ color: T.dim }}>{t.capacity} seats</div>
            <div>
              <Badge kind={t.status === "empty" ? "green" : t.status === "occupied" ? "gray" : "amber"}>
                {t.status.replace("_", " ").toUpperCase()}
              </Badge>
            </div>
            <div style={{ color: T.dim }}>
              {t.status === "occupied" && t.seatedAt ? fmtElapsed(Date.now() - t.seatedAt.toDate().getTime()) + " ago" : "—"}
            </div>
            <div className="flex gap-2">
              <button className="text-[11px] underline hover:opacity-70" style={{ color: T.faint }} onClick={() => openEdit(t)}>
                Edit
              </button>
              <button
                className="text-[11px] underline hover:opacity-70 disabled:opacity-40"
                style={{ color: T.faint }}
                disabled={t.status !== "empty" || pendingId === t.id}
                title={t.status !== "empty" ? "Only an empty table can be deleted" : ""}
                onClick={() => remove(t)}
              >
                Delete
              </button>
              {t.status !== "empty" && (
                <button
                  className="text-[11px] font-semibold underline hover:opacity-70 disabled:opacity-40"
                  style={{ color: T.accentBright }}
                  disabled={pendingId === t.id}
                  onClick={() => reset(t)}
                >
                  Force reset
                </button>
              )}
            </div>
          </div>
        ))}
        </div>
      </Panel>

      <Modal open={!!editing} onClose={() => setEditing(null)} width={320}>
        <div className="mb-3 text-[15px] font-bold">{editing?.id ? `Edit Table ${editing.number}` : "Add table"}</div>
        <form onSubmit={submit}>
          <label className="mb-1.5 block text-[13px] font-semibold">Table number</label>
          <input
            autoFocus
            value={form.number}
            onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
            className="mb-3 w-full rounded-md border px-3 py-2.5 text-sm outline-none"
            style={{ background: T.inputBg, borderColor: T.borderAlt, color: T.text }}
          />
          <label className="mb-1.5 block text-[13px] font-semibold">Capacity</label>
          <input
            value={form.capacity}
            onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
            className="mb-3 w-full rounded-md border px-3 py-2.5 text-sm outline-none"
            style={{ background: T.inputBg, borderColor: T.borderAlt, color: T.text }}
          />
          {error && <div className="mb-3 text-[13px] text-red-400">{error}</div>}
          <Button variant="primary" type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Saving…" : "Save"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
