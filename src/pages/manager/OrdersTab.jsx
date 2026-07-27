import { useState } from "react";
import { fmtElapsed, fmtINR, fmtTime } from "../../lib/format";
import { useOpsTheme } from "../../contexts/ThemeContext";
import { Badge, Panel } from "../../components/ops/primitives";

// Read-only — orders.js/tables.js enforce `allow write: if false` on this
// collection for everyone including managers, every mutation goes through a
// Cloud Function. This is the only place order history is visible anywhere
// in the UI (the waiter table map only ever shows the open order).
export default function OrdersTab({ orders, restaurant, tables, staffList }) {
  const { T } = useOpsTheme();
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState(null);

  const tableNumber = (id) => tables.find((t) => t.id === id)?.number ?? "—";
  const waiterName = (uid) => staffList.find((s) => s.id === uid)?.name || "—";

  const filtered = orders.filter((o) => filter === "all" || o.status === filter);

  // closeOrder persists the actual bill on order.bill now, frozen at close
  // time — use that instead of recomputing from the restaurant's *current*
  // service-charge/GST%, which would silently drift for old orders once
  // those settings change. Fall back to a live recompute only for orders
  // closed before that field existed.
  function bill(order) {
    if (order.bill) return order.bill;
    const subtotal = order.totalAmount;
    const serviceCharge = (subtotal * (restaurant?.serviceChargePct || 0)) / 100;
    const gst = (subtotal * (restaurant?.gstPct || 0)) / 100;
    return { subtotal, serviceCharge, gst, total: subtotal + serviceCharge + gst };
  }

  return (
    <div>
      <div className="mb-3 flex gap-1.5">
        {["all", "open", "closed"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="rounded-full border px-3.5 py-1 text-[12.5px] font-semibold capitalize transition-colors hover:opacity-80"
            style={
              filter === f
                ? { background: T.accent, color: "#fff", borderColor: T.accent }
                : { background: T.panel, color: T.text, borderColor: T.border }
            }
          >
            {f}
          </button>
        ))}
      </div>

      <Panel className="overflow-x-auto">
        <div className="min-w-[640px]">
        <div className="grid grid-cols-[0.8fr_1fr_1fr_0.8fr_1fr_0.9fr_0.8fr] border-b px-4 py-2.5" style={{ borderColor: T.border }}>
          {["TABLE", "WAITER", "ITEMS", "TOTAL", "STATUS", "AGE", ""].map((h) => (
            <div key={h} className="text-[11.5px] font-bold" style={{ color: T.faint }}>{h}</div>
          ))}
        </div>
        {filtered.map((o, idx) => {
          const isOpen = expanded === o.id;
          const at = o.createdAt?.toDate ? o.createdAt.toDate() : null;
          return (
            <div key={o.id} style={{ background: idx % 2 === 1 ? T.zebra : "transparent" }}>
              <button
                onClick={() => setExpanded(isOpen ? null : o.id)}
                className="grid w-full grid-cols-[0.8fr_1fr_1fr_0.8fr_1fr_0.9fr_0.8fr] items-center border-b px-4 py-2.5 text-left text-[13.5px] transition-colors hover:brightness-125"
                style={{ borderColor: T.panel2 }}
              >
                <div>Table {tableNumber(o.tableId)}</div>
                <div style={{ color: T.dim }}>{waiterName(o.createdBy)}</div>
                <div style={{ color: T.dim }}>{o.items.length}</div>
                <div className="font-mono font-semibold">{fmtINR(o.totalAmount)}</div>
                <div>
                  <Badge kind={o.status === "open" ? "amber" : "gray"}>{o.status.toUpperCase()}</Badge>
                </div>
                <div style={{ color: T.dim }}>{at ? fmtElapsed(Date.now() - at.getTime()) : "—"}</div>
                <div className="text-[11px]" style={{ color: T.faint }}>{isOpen ? "Hide ▲" : "Details ▼"}</div>
              </button>
              {isOpen && (
                <div className="border-b px-4 py-3" style={{ borderColor: T.panel2, background: T.panel2 }}>
                  <div className="mb-2 flex flex-col gap-1">
                    {o.items.map((item) => (
                      <div key={item.itemId} className="flex items-center justify-between text-[12.5px]" style={{ color: T.dim }}>
                        <span>
                          {item.dishName} ×{item.qty} <span style={{ color: T.faint }}>({item.itemStatus})</span>
                        </span>
                        <span className="font-mono">{fmtINR(item.price * item.qty)}</span>
                      </div>
                    ))}
                  </div>
                  {o.status === "closed" &&
                    (() => {
                      const b = bill(o);
                      return (
                        <div className="mt-2 flex flex-col gap-1 border-t pt-2 text-[12.5px]" style={{ borderColor: T.border }}>
                          <div className="flex justify-between"><span style={{ color: T.dim }}>Subtotal</span><span>{fmtINR(b.subtotal)}</span></div>
                          {b.discountAmount > 0 && (
                            <div className="flex justify-between"><span style={{ color: T.dim }}>Discount</span><span>-{fmtINR(b.discountAmount)}</span></div>
                          )}
                          <div className="flex justify-between"><span style={{ color: T.dim }}>Service charge</span><span>{fmtINR(b.serviceCharge)}</span></div>
                          <div className="flex justify-between"><span style={{ color: T.dim }}>GST</span><span>{fmtINR(b.gst)}</span></div>
                          <div className="flex justify-between font-bold"><span>Total</span><span className="font-mono">{fmtINR(b.total)}</span></div>
                          {o.paymentMethod && (
                            <div className="mt-0.5" style={{ color: T.faint }}>Paid via {o.paymentMethod}</div>
                          )}
                          {o.closedAt?.toDate && (
                            <div className="mt-0.5" style={{ color: T.faint }}>Closed {fmtTime(o.closedAt.toDate())}</div>
                          )}
                        </div>
                      );
                    })()}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="px-4 py-6 text-center text-[13px]" style={{ color: T.faint }}>No orders.</div>
        )}
        </div>
      </Panel>
    </div>
  );
}
