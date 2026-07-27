import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useGuestData } from "../../contexts/GuestDataContext";
import { useGuestTheme } from "../../contexts/ThemeContext";
import { fmtINR } from "../../lib/format";
import { estimateQueueWait } from "../../lib/api";

// Table-for-2 is the most common walk-in size — used as a representative
// estimate for this general "how long's the wait" tile, not tied to any
// specific party. Real number from the backend's turnover heuristic, same
// one the queue check-in page shows, not an invented figure.
const SAMPLE_PARTY_SIZE = 2;

export default function Home() {
  const { restaurant, dishes, queueList } = useGuestData();
  const { T } = useGuestTheme();
  const queueCount = queueList.length;
  const [waitEstimate, setWaitEstimate] = useState(null);

  useEffect(() => {
    let cancelled = false;
    estimateQueueWait({ partySize: SAMPLE_PARTY_SIZE }).then((res) => {
      if (!cancelled) setWaitEstimate(res);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const waitLabel = !waitEstimate
    ? "—"
    : waitEstimate.available
    ? "No wait"
    : `~${Math.round(waitEstimate.estimatedWaitMinutes)} min`;

  const available = dishes.filter((d) => d.available);
  const highlights = available.slice(0, 6);

  return (
    <div className="mx-auto max-w-[1240px] px-8 pb-6 pt-14">
      <div className="grid grid-cols-[1.1fr_0.9fr] items-start gap-10">
        <div>
          <h1 className="mb-2.5 font-serif text-[44px] font-bold leading-tight">
            {restaurant?.name || "CtrlChef"}
          </h1>
          <div className="mb-6 text-[15.5px]" style={{ color: T.dim }}>
            {[restaurant?.cuisine, restaurant?.address, restaurant?.hoursLabel].filter(Boolean).join(" · ")}
          </div>
          <div className="mb-7 flex gap-2.5">
            <Link
              to="/menu"
              className="rounded-lg px-5 py-3 text-[14.5px] font-bold text-white transition-colors hover:opacity-90"
              style={{ background: T.accent }}
            >
              See tonight's menu
            </Link>
            <Link
              to="/queue"
              className="rounded-lg border px-5 py-3 text-[14.5px] font-semibold transition-colors hover:opacity-80"
              style={{ borderColor: T.border, background: T.panel, color: T.text }}
            >
              Join the queue
            </Link>
          </div>
          <div className="flex gap-9 border-t pt-4" style={{ borderColor: T.border }}>
            <div>
              <div className="text-[11px] font-semibold tracking-wide" style={{ color: T.faint }}>GUESTS IN QUEUE</div>
              <div className="font-serif text-[26px] font-bold">{queueCount}</div>
            </div>
            <div>
              <div className="text-[11px] font-semibold tracking-wide" style={{ color: T.faint }}>DISHES ON TONIGHT</div>
              <div className="font-serif text-[26px] font-bold">{available.length}</div>
            </div>
            <div>
              <div className="text-[11px] font-semibold tracking-wide" style={{ color: T.faint }}>AVG. WAIT</div>
              <div className="font-serif text-[26px] font-bold">{waitLabel}</div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border p-5" style={{ borderColor: T.border, background: T.panel }}>
          <div className="mb-0.5 text-[11px] font-semibold tracking-wide" style={{ color: T.faint }}>TONIGHT'S PICKS</div>
          <div className="mb-3.5 font-serif text-[19px] font-bold">Chef's highlights</div>
          {highlights.map((h) => (
            <div key={h.id} className="flex items-center justify-between border-b py-2.5" style={{ borderColor: T.panel2 }}>
              <div>
                <div className="text-sm font-semibold">{h.name}</div>
                {h.desc && <div className="text-xs" style={{ color: T.dim }}>{h.desc}</div>}
              </div>
              <div className="ml-3 flex-shrink-0 text-right font-mono font-bold">{fmtINR(h.price)}</div>
            </div>
          ))}
          <Link
            to="/menu"
            className="mt-2.5 inline-block text-[13.5px] font-semibold transition-colors hover:opacity-80"
            style={{ color: T.accent }}
          >
            Full menu →
          </Link>
        </div>
      </div>

      <div className="mt-12 border-t pt-8" style={{ borderColor: T.border }}>
        <div className="mb-4 text-[15px] font-bold">How it works</div>
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg border p-4 text-[13.5px]" style={{ borderColor: T.border, background: T.panel, color: T.cardText }}>
            Menu items grey out automatically when the kitchen runs low.
          </div>
          <div className="rounded-lg border p-4 text-[13.5px]" style={{ borderColor: T.border, background: T.panel, color: T.cardText }}>
            Join the queue and we'll route you to the smallest table that fits.
          </div>
          <div className="rounded-lg border p-4 text-[13.5px]" style={{ borderColor: T.border, background: T.panel, color: T.cardText }}>
            Orders are added to your table's bill as they're placed.
          </div>
        </div>
      </div>
    </div>
  );
}
