import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getTableOrderStatus } from "../../lib/api";
import { fmtINR } from "../../lib/format";
import { useGuestTheme } from "../../contexts/ThemeContext";

const POLL_MS = 8000;

// Guest-facing order tracker, reachable by a QR code at the table (per the
// route /table/:tableId). Not a live Firestore listener — orders is
// staff-read-only in the rules, so this polls the getTableOrderStatus
// callable instead, same pattern Queue.jsx uses for estimateQueueWait.
export default function TableStatus() {
  const { tableId } = useParams();
  const { T } = useGuestTheme();
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    function refresh() {
      getTableOrderStatus({ tableId })
        .then((res) => {
          if (!cancelled) setStatus(res);
        })
        .catch((e) => {
          if (!cancelled) setError(e.message || "Couldn't load this table's order.");
        });
    }
    refresh();
    const t = setInterval(refresh, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [tableId]);

  return (
    <div className="mx-auto max-w-[600px] px-4 sm:px-8 pb-14 pt-10">
      <div className="mb-1 text-[11px] font-semibold tracking-wide" style={{ color: T.faint }}>
        YOUR ORDER
      </div>
      <h1 className="mb-5 font-serif text-[32px] font-bold">
        {status ? `Table ${status.tableNumber}` : "Table"}
      </h1>

      {error && (
        <div className="mb-4 rounded-md border border-red-800 bg-red-950/20 px-3.5 py-2.5 text-[13px] text-red-400">
          {error}
        </div>
      )}

      {!status && !error && (
        <div className="text-sm" style={{ color: T.faint }}>
          Loading…
        </div>
      )}

      {status && !status.hasOpenOrder && (
        <div className="rounded-xl border p-5 text-sm" style={{ borderColor: T.border, background: T.panel, color: T.dim }}>
          No open order for this table right now.
        </div>
      )}

      {status?.hasOpenOrder && (
        <div className="rounded-xl border p-5" style={{ borderColor: T.border, background: T.panel }}>
          <div className="flex flex-col gap-2">
            {status.items.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="text-sm">
                  {item.dishName} <span style={{ color: T.faint }}>×{item.qty}</span>
                </div>
                <span
                  className="rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize"
                  style={
                    item.itemStatus === "ready" || item.itemStatus === "served"
                      ? { background: T.pillOkBg, color: T.pillOkText }
                      : { background: T.pillOffBg, color: T.pillOffText }
                  }
                >
                  {item.itemStatus}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-between border-t pt-3.5 font-bold" style={{ borderColor: T.border }}>
            <span>Running total</span>
            <span className="font-mono">{fmtINR(status.totalAmount)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
