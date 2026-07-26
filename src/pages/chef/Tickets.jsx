import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db, RESTAURANT_ID } from "../../firebase";
import { advanceOrderItemStatus, cancelOrderItem } from "../../lib/api";
import { fmtElapsed } from "../../lib/format";
import { useOpsTheme } from "../../contexts/ThemeContext";
import { Button, Panel } from "../../components/ops/primitives";

// ponytail: elapsed time is measured from when the item was first ordered
// (addedAt), not from when it entered its current stage — the backend
// doesn't stamp a per-stage timestamp. Add one in advanceOrderItemStatus if
// per-stage timing turns out to matter more than total ticket age.
function elapsedColor(ms, T) {
  const min = ms / 60000;
  if (min >= 20) return "#f87171";
  if (min >= 10) return "#fbbf24";
  return T.dim;
}

const COLUMNS = [
  { key: "received", title: "RECEIVED", borderColor: "#57534e" },
  { key: "preparing", title: "PREPARING", borderColor: "#d97706" },
  { key: "ready", title: "READY", borderColor: "#16a34a" },
];

export default function Tickets() {
  const { T } = useOpsTheme();
  const [orders, setOrders] = useState([]);
  const [tableNumberById, setTableNumberById] = useState({});
  const [error, setError] = useState("");

  useEffect(() => {
    const t = setInterval(() => setOrders((o) => [...o]), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const q = query(collection(db, "restaurants", RESTAURANT_ID, "orders"), where("status", "==", "open"));
    return onSnapshot(q, (snap) => setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, []);

  useEffect(
    () => onSnapshot(collection(db, "restaurants", RESTAURANT_ID, "tables"), (snap) => {
      const map = {};
      snap.forEach((d) => (map[d.id] = d.data().number));
      setTableNumberById(map);
    }),
    []
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
        addedAtMs: item.addedAt.toDate().getTime(),
      });
    });
  });
  Object.values(tickets).forEach((list) => list.sort((a, b) => a.addedAtMs - b.addedAtMs));

  async function run(fn) {
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e.message || "That didn't work.");
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

      <div className="grid grid-cols-3 gap-3.5">
        {COLUMNS.map((col) => (
          <div key={col.key}>
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
                    <div className="font-mono text-xs font-bold" style={{ color: elapsedColor(Date.now() - tk.addedAtMs, T) }}>
                      {fmtElapsed(Date.now() - tk.addedAtMs)}
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
                          onClick={() => run(() => advanceOrderItemStatus({ orderId: tk.orderId, itemId: tk.itemId, newStatus: "preparing" }))}
                        >
                          Start
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => run(() => cancelOrderItem({ orderId: tk.orderId, itemId: tk.itemId }))}
                        >
                          Cancel
                        </Button>
                      </>
                    )}
                    {col.key === "preparing" && (
                      <Button
                        variant="primary"
                        className="flex-1"
                        onClick={() => run(() => advanceOrderItemStatus({ orderId: tk.orderId, itemId: tk.itemId, newStatus: "ready" }))}
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
