import { useEffect, useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db, RESTAURANT_ID } from "../../firebase";
import { estimateQueueWait } from "../../lib/api";
import { useGuestData } from "../../contexts/GuestDataContext";
import { useGuestTheme } from "../../contexts/ThemeContext";

const PARTY_SIZES = [1, 2, 3, 4, 5, 6, 7, 8];

export default function Queue() {
  const { queueList } = useGuestData();
  const { T } = useGuestTheme();
  const [name, setName] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [estimate, setEstimate] = useState(null);
  const [checkedIn, setCheckedIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    estimateQueueWait({ partySize }).then((res) => {
      if (!cancelled) setEstimate(res);
    });
    return () => {
      cancelled = true;
    };
  }, [partySize]);

  async function checkIn() {
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    await addDoc(collection(db, "restaurants", RESTAURANT_ID, "queue"), {
      name: name.trim(),
      partySize,
      status: "waiting",
      checkedInAt: serverTimestamp(),
    });
    setSubmitting(false);
    setCheckedIn(true);
  }

  const matchLabel = !estimate
    ? "Checking table availability…"
    : estimate.available
    ? `A table for ${partySize} is free right now — no wait.`
    : `No table free for that size yet — about ${Math.round(estimate.estimatedWaitMinutes)} min estimated wait.`;

  return (
    <div className="mx-auto max-w-[1240px] px-8 pb-14 pt-10">
      <div className="grid grid-cols-2 items-start gap-10">
        <div>
          <div className="mb-1 text-[11px] font-semibold tracking-wide" style={{ color: T.faint }}>WALK-INS</div>
          <h1 className="mb-2 font-serif text-[32px] font-bold">Join the queue</h1>
          <div className="mb-5 text-sm" style={{ color: T.dim }}>
            Tell us your party size. We'll route you to the smallest table that fits and estimate the wait from
            tonight's turnover.
          </div>

          <div className="rounded-xl border p-5" style={{ borderColor: T.border, background: T.panel }}>
            {checkedIn ? (
              <div className="text-sm">
                You're on the list, {name} — party of {partySize}. We'll call you when a table's ready.
              </div>
            ) : (
              <>
                <div className="mb-1.5 text-[13px] font-semibold">Name on the queue</div>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mb-4 w-full rounded-md border px-3.5 py-2.5 text-sm outline-none"
                  style={{ borderColor: T.border, background: T.bg, color: T.text }}
                />
                <div className="mb-1.5 text-[13px] font-semibold">Party size</div>
                <div className="mb-3.5 grid grid-cols-8 gap-1.5">
                  {PARTY_SIZES.map((n) => (
                    <button
                      key={n}
                      onClick={() => setPartySize(n)}
                      className="rounded-md border py-2 text-[13.5px] font-bold transition-colors hover:opacity-80"
                      style={
                        partySize === n
                          ? { background: T.accent, color: "#fff", borderColor: T.accent }
                          : { background: T.bg, color: T.text, borderColor: T.border }
                      }
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <div className="mb-4 rounded-md border border-dashed px-3 py-2.5 text-[13px]" style={{ borderColor: T.borderDashed }}>
                  {matchLabel}
                </div>
                <button
                  onClick={checkIn}
                  disabled={submitting}
                  className="w-full rounded-md py-3 text-[14.5px] font-bold text-white transition-colors hover:opacity-90 disabled:opacity-60"
                  style={{ background: T.accent }}
                >
                  {submitting ? "Checking in…" : "Check me in"}
                </button>
              </>
            )}
          </div>
        </div>

        <div>
          <div className="mb-1 text-[11px] font-semibold tracking-wide" style={{ color: T.faint }}>LIVE QUEUE</div>
          <div className="mb-3.5 font-serif text-xl font-bold">Who's waiting</div>
          <div className="flex flex-col gap-0.5">
            {queueList.map((q) => (
              <div key={q.id} className="flex items-center gap-3 rounded-lg px-3.5 py-3" style={{ background: T.panel }}>
                <div className="h-8 w-8 flex-shrink-0 rounded-full" style={{ background: T.panel2 }} />
                <div className="flex-1">
                  <div className="text-sm font-semibold">
                    {q.name} ({q.partySize})
                  </div>
                  <div className="text-xs" style={{ color: T.faint }}>Party of {q.partySize}</div>
                </div>
              </div>
            ))}
            {queueList.length === 0 && <div className="text-sm" style={{ color: T.faint }}>Nobody's waiting right now.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
