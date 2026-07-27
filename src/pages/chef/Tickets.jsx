import { useEffect, useMemo, useRef, useState } from "react";
import { advanceOrderItemStatus, cancelOrderItem } from "../../lib/api";
import { fmtElapsed } from "../../lib/format";
import { useOpsTheme } from "../../contexts/ThemeContext";
import { useOpsData } from "../../contexts/OpsDataContext";
import { useToast } from "../../contexts/ToastContext";
import { useTransitionWatch } from "../../lib/useTransitionWatch";
import { Button, Panel } from "../../components/ops/primitives";

function elapsedColor(ms, T) {
  const min = ms / 60000;
  if (min >= 20) return "#f87171";
  if (min >= 10) return "#fbbf24";
  return T.dim;
}

// Colour alone shouldn't be the only signal that a ticket is running late —
// this tag rides alongside the coloured timer so it reads the same for a
// colour-blind chef.
function elapsedTag(ms) {
  const min = ms / 60000;
  if (min >= 20) return "LATE";
  if (min >= 10) return "SLOW";
  return null;
}

const COLUMNS = [
  { key: "received", title: "RECEIVED", borderColor: "#57534e" },
  { key: "preparing", title: "PREPARING", borderColor: "#d97706" },
  { key: "ready", title: "READY", borderColor: "#16a34a" },
];

export default function Tickets() {
  const { T } = useOpsTheme();
  const { openOrders: orders, tables } = useOpsData();
  const { notify } = useToast();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(new Set());
  const [, setTick] = useState(0);
  const errorTimeout = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const tableNumberById = {};
  tables.forEach((t) => (tableNumberById[t.id] = t.number));

  // Flattened once so useTransitionWatch (same hook TableMap uses for
  // item -> ready) can diff a single itemId-keyed list. A brand-new item
  // shows up here as an undefined -> "received" transition.
  const flatItems = useMemo(
    () => orders.flatMap((o) => o.items.map((i) => ({ ...i, tableId: o.tableId }))),
    [orders]
  );

  useTransitionWatch(
    flatItems,
    (i) => i.itemId,
    (i) => i.itemStatus,
    (item, prev, next) => {
      if (next !== "received") return;
      notify({
        kind: "info",
        title: `New order — Table ${tableNumberById[item.tableId] ?? "?"}`,
        body: `${item.dishName} ×${item.qty}`,
      });
    }
  );

  const tickets = { received: [], preparing: [], ready: [] };
  orders.forEach((order) => {
    order.items.forEach((item) => {
      if (!tickets[item.itemStatus]) return; // "served" items drop off the board
      tickets[item.itemStatus].push({
        orderId: order.id,
        itemId: item.itemId,
        table: tableNumberById[order.tableId] ?? "?",
        name: item.dishName,
        qty: item.qty,
        // Time in the *current* stage, not total ticket age — falls back to
        // addedAt for items advanced before statusChangedAt existed.
        stageStartMs: item.statusChangedAt?.toDate?.().getTime() ?? item.addedAt?.toDate?.().getTime() ?? Date.now(),
      });
    });
  });
  Object.values(tickets).forEach((list) => list.sort((a, b) => a.stageStartMs - b.stageStartMs));

  async function run(key, fn) {
    setError("");
    setPending((p) => new Set(p).add(key));
    try {
      await fn();
    } catch (e) {
      setError(e.message || "That didn't work.");
      clearTimeout(errorTimeout.current);
      errorTimeout.current = setTimeout(() => setError(""), 5000);
    } finally {
      setPending((p) => {
        const next = new Set(p);
        next.delete(key);
        return next;
      });
    }
  }

  return (
    <div>
      <div className="mb-3.5 text-[19px] font-bold">Tonight's Tickets</div>

      {error && (
        <div className="mb-3 rounded-md border border-red-800 bg-red-950/40 px-3 py-2 text-[13px] text-red-300">
          {error}
        </div>
      )}

      {/* Below sm: swipeable kanban lanes, each ~85% of the viewport so the
          next one peeks in as a scroll hint. sm and up: the original static
          3-column grid. */}
      <div className="grid auto-cols-[85%] grid-flow-col snap-x snap-mandatory gap-3.5 overflow-x-auto pb-2 sm:auto-cols-auto sm:grid-flow-row sm:grid-cols-3 sm:overflow-visible sm:pb-0">
        {COLUMNS.map((col) => (
          <div key={col.key} className="snap-start">
            <div className="mb-2 flex items-center gap-2 border-b-2 pb-2" style={{ borderColor: col.borderColor }}>
              <div className="text-[13px] font-bold" style={{ color: T.header }}>
                {col.title}
              </div>
              <div
                className="rounded-full px-1.5 py-0.5 font-mono text-[11.5px] font-bold"
                style={{ background: T.panel2, color: T.dim }}
              >
                {tickets[col.key].length}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {tickets[col.key].map((tk) => (
                <Panel key={tk.itemId} className="p-2.5">
                  <div className="flex items-baseline justify-between">
                    <div className="text-sm font-bold">Table {tk.table}</div>
                    <div className="flex items-center gap-1">
                      <div className="font-mono text-xs font-bold" style={{ color: elapsedColor(Date.now() - tk.stageStartMs, T) }}>
                        {fmtElapsed(Date.now() - tk.stageStartMs)}
                      </div>
                      {elapsedTag(Date.now() - tk.stageStartMs) && (
                        <span
                          className="rounded px-1 py-0.5 text-[8.5px] font-bold leading-none tracking-wide"
                          style={{ color: elapsedColor(Date.now() - tk.stageStartMs, T), border: "1px solid currentColor" }}
                        >
                          {elapsedTag(Date.now() - tk.stageStartMs)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-0.5 text-[13.5px]" style={{ color: T.bright }}>
                    {tk.name} <span style={{ color: T.faint }}>×{tk.qty}</span>
                  </div>
                  <div className="mt-2 flex gap-1.5">
                    {col.key === "received" && (
                      <>
                        <Button
                          variant="primary"
                          className="flex-1"
                          disabled={pending.has(`start-${tk.itemId}`)}
                          onClick={() => run(`start-${tk.itemId}`, () => advanceOrderItemStatus({ orderId: tk.orderId, itemId: tk.itemId, newStatus: "preparing" }))}
                        >
                          Start
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={pending.has(`cancel-${tk.itemId}`)}
                          onClick={() => run(`cancel-${tk.itemId}`, () => cancelOrderItem({ orderId: tk.orderId, itemId: tk.itemId }))}
                        >
                          Cancel
                        </Button>
                      </>
                    )}
                    {col.key === "preparing" && (
                      <Button
                        variant="primary"
                        className="flex-1"
                        disabled={pending.has(`ready-${tk.itemId}`)}
                        onClick={() => run(`ready-${tk.itemId}`, () => advanceOrderItemStatus({ orderId: tk.orderId, itemId: tk.itemId, newStatus: "ready" }))}
                      >
                        Ready
                      </Button>
                    )}
                    {col.key === "ready" && (
                      <div className="text-[12px]" style={{ color: T.faint }}>
                        Waiting for pickup
                      </div>
                    )}
                  </div>
                </Panel>
              ))}
              {tickets[col.key].length === 0 && (
                <div className="text-[12.5px]" style={{ color: T.faint }}>
                  Nothing here.
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
