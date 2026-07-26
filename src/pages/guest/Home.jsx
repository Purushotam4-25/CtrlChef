import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db, RESTAURANT_ID } from "../../firebase";
import { fmtINR } from "../../lib/format";

export default function Home() {
  const [dishes, setDishes] = useState([]);
  const [queueCount, setQueueCount] = useState(0);

  useEffect(() => {
    const dishesRef = collection(db, "restaurants", RESTAURANT_ID, "dishes");
    return onSnapshot(dishesRef, (snap) => setDishes(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, "restaurants", RESTAURANT_ID, "queue"),
      where("status", "==", "waiting")
    );
    return onSnapshot(q, (snap) => setQueueCount(snap.size));
  }, []);

  const available = dishes.filter((d) => d.available);
  const highlights = available.slice(0, 6);

  return (
    <div className="mx-auto max-w-[1240px] px-8 pb-6 pt-14">
      <div className="grid grid-cols-[1.1fr_0.9fr] items-start gap-10">
        <div>
          <h1 className="mb-2.5 font-serif text-[44px] font-bold leading-tight">Tandoor &amp; Tales</h1>
          <div className="mb-6 text-[15.5px] text-guest-dim">
            Modern Indian · MG Road, Bengaluru · Open daily, 12:00–23:30
          </div>
          <div className="mb-7 flex gap-2.5">
            <Link to="/menu" className="rounded-lg bg-guest-accent px-5 py-3 text-[14.5px] font-bold text-white">
              See tonight's menu
            </Link>
            <Link
              to="/queue"
              className="rounded-lg border border-guest-border bg-guest-panel px-5 py-3 text-[14.5px] font-semibold text-guest-text"
            >
              Join the queue
            </Link>
          </div>
          <div className="flex gap-9 border-t border-guest-border pt-4">
            <div>
              <div className="text-[11px] font-semibold tracking-wide text-guest-faint">GUESTS IN QUEUE</div>
              <div className="font-serif text-[26px] font-bold">{queueCount}</div>
            </div>
            <div>
              <div className="text-[11px] font-semibold tracking-wide text-guest-faint">DISHES ON TONIGHT</div>
              <div className="font-serif text-[26px] font-bold">{available.length}</div>
            </div>
            <div>
              <div className="text-[11px] font-semibold tracking-wide text-guest-faint">AVG. WAIT</div>
              <div className="font-serif text-[26px] font-bold">~8 min</div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-guest-border bg-guest-panel p-5">
          <div className="mb-0.5 text-[11px] font-semibold tracking-wide text-guest-faint">TONIGHT'S PICKS</div>
          <div className="mb-3.5 font-serif text-[19px] font-bold">Chef's highlights</div>
          {highlights.map((h) => (
            <div key={h.id} className="flex items-center justify-between border-b border-[#EFE7D8] py-2.5">
              <div>
                <div className="text-sm font-semibold">{h.name}</div>
                {h.desc && <div className="text-xs text-guest-dim">{h.desc}</div>}
              </div>
              <div className="ml-3 flex-shrink-0 text-right font-mono font-bold">{fmtINR(h.price)}</div>
            </div>
          ))}
          <Link to="/menu" className="mt-2.5 inline-block text-[13.5px] font-semibold text-guest-accent">
            Full menu →
          </Link>
        </div>
      </div>

      <div className="mt-12 border-t border-guest-border pt-8">
        <div className="mb-4 text-[15px] font-bold">How it works</div>
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg border border-guest-border bg-guest-panel p-4 text-[13.5px] text-[#4a4038]">
            Menu items grey out automatically when the kitchen runs low.
          </div>
          <div className="rounded-lg border border-guest-border bg-guest-panel p-4 text-[13.5px] text-[#4a4038]">
            Join the queue and we'll route you to the smallest table that fits.
          </div>
          <div className="rounded-lg border border-guest-border bg-guest-panel p-4 text-[13.5px] text-[#4a4038]">
            Orders are added to your table's bill as they're placed.
          </div>
        </div>
      </div>
    </div>
  );
}
