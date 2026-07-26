import { useEffect, useState } from "react";
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp, where } from "firebase/firestore";
import { db, RESTAURANT_ID } from "../../firebase";
import { estimateQueueWait } from "../../lib/api";

const PARTY_SIZES = [1, 2, 3, 4, 5, 6, 7, 8];

export default function Queue() {
  const [name, setName] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [estimate, setEstimate] = useState(null);
  const [queueList, setQueueList] = useState([]);
  const [checkedIn, setCheckedIn] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, "restaurants", RESTAURANT_ID, "queue"),
      where("status", "==", "waiting"),
      orderBy("checkedInAt", "asc")
    );
    return onSnapshot(q, (snap) => setQueueList(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, []);

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
    if (!name.trim()) return;
    await addDoc(collection(db, "restaurants", RESTAURANT_ID, "queue"), {
      name: name.trim(),
      partySize,
      status: "waiting",
      checkedInAt: serverTimestamp(),
    });
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
          <div className="mb-1 text-[11px] font-semibold tracking-wide text-guest-faint">WALK-INS</div>
          <h1 className="mb-2 font-serif text-[32px] font-bold">Join the queue</h1>
          <div className="mb-5 text-sm text-guest-dim">
            Tell us your party size. We'll route you to the smallest table that fits and estimate the wait from
            tonight's turnover.
          </div>

          <div className="rounded-xl border border-guest-border bg-guest-panel p-5">
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
                  className="mb-4 w-full rounded-md border border-guest-border bg-guest-bg px-3.5 py-2.5 text-sm text-guest-text outline-none"
                />
                <div className="mb-1.5 text-[13px] font-semibold">Party size</div>
                <div className="mb-3.5 grid grid-cols-8 gap-1.5">
                  {PARTY_SIZES.map((n) => (
                    <button
                      key={n}
                      onClick={() => setPartySize(n)}
                      className="rounded-md border border-guest-border py-2 text-[13.5px] font-bold"
                      style={
                        partySize === n
                          ? { background: "#A35D3A", color: "#fff" }
                          : { background: "#F5F0E6", color: "#302B27" }
                      }
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <div className="mb-4 rounded-md border border-dashed border-guest-borderDashed px-3 py-2.5 text-[13px]">
                  {matchLabel}
                </div>
                <button
                  onClick={checkIn}
                  className="w-full rounded-md bg-guest-accent py-3 text-[14.5px] font-bold text-white"
                >
                  Check me in
                </button>
              </>
            )}
          </div>
        </div>

        <div>
          <div className="mb-1 text-[11px] font-semibold tracking-wide text-guest-faint">LIVE QUEUE</div>
          <div className="mb-3.5 font-serif text-xl font-bold">Who's waiting</div>
          <div className="flex flex-col gap-0.5">
            {queueList.map((q) => (
              <div key={q.id} className="flex items-center gap-3 rounded-lg bg-guest-panel px-3.5 py-3">
                <div className="h-8 w-8 flex-shrink-0 rounded-full bg-guest-panel2" />
                <div className="flex-1">
                  <div className="text-sm font-semibold">
                    {q.name} ({q.partySize})
                  </div>
                  <div className="text-xs text-guest-faint">Party of {q.partySize}</div>
                </div>
              </div>
            ))}
            {queueList.length === 0 && <div className="text-sm text-guest-faint">Nobody's waiting right now.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
