import { useState } from "react";
import { deleteField, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db, RESTAURANT_ID } from "../../firebase";
import { fmtElapsed, fmtTime } from "../../lib/format";
import { useOpsTheme } from "../../contexts/ThemeContext";
import { Badge, Panel } from "../../components/ops/primitives";

// Clocking in/out is a direct Firestore write, not a Cloud Function —
// firestore.rules already lets a manager update any staff doc, and lets
// staff flip their own clockedIn field without a manager doing it for them.
export default function StaffTab({ staff }) {
  const { T } = useOpsTheme();
  const [pendingId, setPendingId] = useState(null);

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

  return (
    <Panel className="overflow-hidden">
      <div className="grid grid-cols-[1.4fr_1fr_1fr_0.9fr] border-b px-4 py-2.5" style={{ borderColor: T.border }}>
        <div className="text-[11.5px] font-bold" style={{ color: T.faint }}>NAME</div>
        <div className="text-[11.5px] font-bold" style={{ color: T.faint }}>ROLE</div>
        <div className="text-[11.5px] font-bold" style={{ color: T.faint }}>SHIFT</div>
        <div className="text-[11.5px] font-bold" style={{ color: T.faint }}>STATUS</div>
      </div>
      {staff.map((p) => (
        <div
          key={p.id}
          className="grid grid-cols-[1.4fr_1fr_1fr_0.9fr] items-center border-b px-4 py-2.5 text-[13.5px]"
          style={{ borderColor: T.panel2 }}
        >
          <div>{p.name}</div>
          <div className="capitalize" style={{ color: T.dim }}>{p.role}</div>
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
        </div>
      ))}
    </Panel>
  );
}
