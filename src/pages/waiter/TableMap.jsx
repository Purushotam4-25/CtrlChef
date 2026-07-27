import { useEffect, useMemo, useRef, useState } from "react";
import { addOrderItem, advanceOrderItemStatus, cancelOrderItem, markTableClean, seatTable } from "../../lib/api";
import { fmtElapsed, fmtINR } from "../../lib/format";
import { useOpsTheme } from "../../contexts/ThemeContext";
import { useOpsData } from "../../contexts/OpsDataContext";
import { Button, Modal, Panel, StatTile } from "../../components/ops/primitives";
import { STATUS_COLORS } from "../../opsTheme";
import { SkeletonGrid } from "../../components/Skeleton";
import QueuePanel from "./QueuePanel";
import BillModal from "./BillModal";

export default function TableMap() {
  const { T } = useOpsTheme();
  const { tables, openOrders: orders, dishes, members, loading } = useOpsData();
  const [orderModalTableId, setOrderModalTableId] = useState(null);
  const [billTarget, setBillTarget] = useState(null); // order being configured/closed
  const [bill, setBill] = useState(null); // final result to display, once closed
  const [error, setError] = useState("");
  const [pending, setPending] = useState(new Set());
  const [tick, setTick] = useState(0);
  const [memberQuery, setMemberQuery] = useState("");
  const [selectedMember, setSelectedMember] = useState(null); // {id, name} — attached once, at order creation
  const errorTimeout = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const orderByTable = useMemo(() => {
    const map = {};
    orders.forEach((o) => (map[o.tableId] = o));
    return map;
  }, [orders]);

  const occupiedCount = tables.filter((t) => t.status === "occupied").length;
  const emptyCount = tables.filter((t) => t.status === "empty").length;
  const cleaningCount = tables.filter((t) => t.status === "needs_cleaning").length;
  const openTabsTotal = orders.reduce((sum, o) => sum + o.totalAmount, 0);

  // Guards against double-submits (e.g. clicking + Order twice before the
  // first call round-trips) by disabling just the one button mid-flight,
  // keyed per action rather than locking the whole page.
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

  const modalTable = tables.find((t) => t.id === orderModalTableId);
  const modalOrder = orderByTable[orderModalTableId];

  const memberMatches = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    if (!q) return [];
    return members
      .filter((m) => m.name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q))
      .slice(0, 5);
  }, [memberQuery, members]);

  return (
    <div>
      <div className="mb-3.5 flex items-baseline justify-between">
        <div className="text-[19px] font-bold">Table Map</div>
        <div className="text-[12.5px]" style={{ color: T.faint }}>
          Tap a table to add items or close out.
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-md border border-red-800 bg-red-950/40 px-3 py-2 text-[13px] text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-[260px_1fr] items-start gap-4">
        <QueuePanel tables={tables} onError={(msg) => setError(msg)} />

        <div>
          <div className="mb-4 grid grid-cols-4 gap-2.5">
            <StatTile label="OCCUPIED" value={occupiedCount} />
            <StatTile label="EMPTY" value={emptyCount} />
            <StatTile label="NEEDS CLEANING" value={cleaningCount} />
            <StatTile label="OPEN TABS" value={fmtINR(openTabsTotal)} valueColor={T.accentBright} />
          </div>

          <div className="grid grid-cols-4 gap-2.5">
            {loading && <SkeletonGrid count={8} itemClassName="h-[150px] text-neutral-500" />}
            {!loading && tables.map((t) => {
          const order = orderByTable[t.id];
          const sc =
            t.status === "empty" ? STATUS_COLORS.green : t.status === "occupied" ? STATUS_COLORS.gray : STATUS_COLORS.amber;
          const label = t.status === "empty" ? "EMPTY" : t.status === "occupied" ? "OCCUPIED" : "NEEDS CLEANING";
          const canCloseOut = order && order.items.every((i) => i.itemStatus === "served");

          return (
            <Panel key={t.id} className="flex flex-col gap-2 p-3">
              <div className="flex items-center justify-between">
                <div className="text-[15px] font-bold">Table {t.number}</div>
                <div className="text-[11px]" style={{ color: T.faint }}>
                  {t.capacity} seats
                </div>
              </div>
              <span
                className="inline-block w-fit rounded px-1.5 py-0.5 text-[10.5px] font-bold tracking-wide"
                style={{ background: sc.bg, color: sc.color }}
              >
                {label}
              </span>

              {t.status === "occupied" && (
                <>
                  <div className="text-[11.5px]" style={{ color: T.dim }}>
                    Seated {t.seatedAt ? fmtElapsed(Date.now() - t.seatedAt.toDate().getTime()) : "—"} ago
                  </div>
                  <div className="font-mono text-[17px] font-bold" style={{ color: T.bright }}>
                    {fmtINR(order?.totalAmount || 0)}
                  </div>
                  {order?.items.length > 0 && (
                    <div className="flex flex-col gap-1">
                      {order.items.map((item) => (
                        <div key={item.itemId} className="flex items-center justify-between text-[12px]" style={{ color: T.dim }}>
                          <span>
                            {item.dishName} ×{item.qty} <span style={{ color: T.faint }}>({item.itemStatus})</span>
                          </span>
                          {item.itemStatus === "received" && (
                            <button
                              className="text-[11px] underline transition-opacity hover:opacity-70 disabled:opacity-40"
                              style={{ color: T.faint }}
                              disabled={pending.has(`cancel-${item.itemId}`)}
                              onClick={() => run(`cancel-${item.itemId}`, () => cancelOrderItem({ orderId: order.id, itemId: item.itemId }))}
                            >
                              cancel
                            </button>
                          )}
                          {item.itemStatus === "ready" && (
                            <button
                              className="text-[11px] font-semibold underline transition-opacity hover:opacity-70 disabled:opacity-40"
                              style={{ color: T.accentBright }}
                              disabled={pending.has(`serve-${item.itemId}`)}
                              onClick={() =>
                                run(`serve-${item.itemId}`, () => advanceOrderItemStatus({ orderId: order.id, itemId: item.itemId, newStatus: "served" }))
                              }
                            >
                              mark served
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              <div className="mt-0.5 flex gap-1.5">
                {(t.status === "empty" || t.status === "occupied") && (
                  <Button
                    variant="primary"
                    className="min-h-[40px] flex-1"
                    disabled={t.status === "empty" && pending.has(`seat-${t.id}`)}
                    onClick={() => {
                      if (t.status === "empty") {
                        run(`seat-${t.id}`, () => seatTable({ tableId: t.id }));
                      } else {
                        setMemberQuery("");
                        setSelectedMember(null);
                        setOrderModalTableId(t.id);
                      }
                    }}
                  >
                    + Order
                  </Button>
                )}
                {t.status === "occupied" && (
                  <Button
                    variant="secondary"
                    className="min-h-[40px]"
                    disabled={!canCloseOut}
                    title={canCloseOut ? "" : "Every item must be served first"}
                    onClick={() => setBillTarget(order)}
                  >
                    Bill
                  </Button>
                )}
                {t.status === "needs_cleaning" && (
                  <Button
                    variant="primary"
                    className="min-h-[40px] flex-1"
                    disabled={pending.has(`clean-${t.id}`)}
                    onClick={() => run(`clean-${t.id}`, () => markTableClean({ tableId: t.id }))}
                  >
                    Mark Clean
                  </Button>
                )}
              </div>
            </Panel>
          );
            })}
          </div>
        </div>
      </div>

      <Modal open={!!modalTable} onClose={() => setOrderModalTableId(null)}>
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[15px] font-bold">Add to Table {modalTable?.number}</div>
          <button style={{ color: T.dim }} className="text-lg transition-opacity hover:opacity-70" onClick={() => setOrderModalTableId(null)}>
            ×
          </button>
        </div>
        {/* Only relevant before the order exists — memberId is set once, at
            order creation, and never revisited on later items. */}
        {!modalOrder && (
          <div className="mb-3">
            <label className="mb-1 block text-[12px] font-semibold" style={{ color: T.dim }}>
              Attach a member (optional)
            </label>
            {selectedMember ? (
              <div
                className="flex items-center justify-between rounded-md border px-3 py-2 text-[13px]"
                style={{ background: T.panel2, borderColor: T.borderAlt, color: T.text }}
              >
                <span>{selectedMember.name}</span>
                <button className="text-[11px] underline" style={{ color: T.faint }} onClick={() => setSelectedMember(null)}>
                  clear
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  value={memberQuery}
                  onChange={(e) => setMemberQuery(e.target.value)}
                  placeholder="Search by name or email…"
                  className="w-full rounded-md border px-3 py-2 text-[13px] outline-none"
                  style={{ background: T.inputBg, borderColor: T.borderAlt, color: T.text }}
                />
                {memberMatches.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border" style={{ background: T.panel, borderColor: T.borderAlt }}>
                    {memberMatches.map((m) => (
                      <button
                        key={m.id}
                        className="block w-full px-3 py-2 text-left text-[13px] transition-colors hover:brightness-125"
                        style={{ color: T.text }}
                        onClick={() => {
                          setSelectedMember({ id: m.id, name: m.name });
                          setMemberQuery("");
                        }}
                      >
                        {m.name} <span style={{ color: T.faint }}>{m.email}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          {dishes.map((m) => (
            <button
              key={m.id}
              disabled={!m.available || pending.has(`add-${m.id}`)}
              onClick={() =>
                run(`add-${m.id}`, () =>
                  addOrderItem({
                    tableId: modalTable.id,
                    dishId: m.id,
                    qty: 1,
                    ...(selectedMember ? { memberId: selectedMember.id } : {}),
                  })
                )
              }
              className="flex items-center justify-between rounded-md border px-3 py-2.5 text-[13.5px] transition-colors hover:brightness-125 disabled:opacity-40 disabled:hover:brightness-100"
              style={{ background: T.panel2, borderColor: T.borderAlt, color: T.text }}
            >
              <span>{m.name}</span>
              <span className="font-mono font-semibold" style={{ color: T.accentBright }}>
                {m.available ? fmtINR(m.price) : "Sold out"}
              </span>
            </button>
          ))}
        </div>
        <Button variant="primary" className="mt-3.5 w-full" onClick={() => setOrderModalTableId(null)}>
          Done
        </Button>
      </Modal>

      {billTarget && (
        <BillModal
          order={billTarget}
          tableNumber={tables.find((t) => t.id === billTarget.tableId)?.number}
          onClose={() => setBillTarget(null)}
          onClosed={(result) => {
            setBillTarget(null);
            setBill(result);
          }}
        />
      )}

      <Modal open={!!bill} onClose={() => setBill(null)} width={320}>
        <div className="mb-3 text-[15px] font-bold">Final bill</div>
        {bill && (
          <div className="flex flex-col gap-1.5 text-[13.5px]">
            <div className="flex justify-between"><span style={{ color: T.dim }}>Subtotal</span><span>{fmtINR(bill.bill.subtotal)}</span></div>
            {bill.bill.discountAmount > 0 && (
              <div className="flex justify-between"><span style={{ color: T.dim }}>Discount</span><span>-{fmtINR(bill.bill.discountAmount)}</span></div>
            )}
            <div className="flex justify-between"><span style={{ color: T.dim }}>Service charge</span><span>{fmtINR(bill.bill.serviceCharge)}</span></div>
            <div className="flex justify-between"><span style={{ color: T.dim }}>GST</span><span>{fmtINR(bill.bill.gst)}</span></div>
            <div className="mt-1.5 flex justify-between border-t pt-1.5 font-bold" style={{ borderColor: T.border }}>
              <span>Total</span><span className="font-mono">{fmtINR(bill.bill.total)}</span>
            </div>
            <div className="mt-0.5 text-[11.5px] capitalize" style={{ color: T.faint }}>Paid by {bill.paymentMethod}</div>
            {bill.split && (
              <div className="mt-2 flex flex-col gap-1 border-t pt-2" style={{ borderColor: T.border }}>
                <div className="text-[11.5px] font-bold" style={{ color: T.faint }}>SPLIT</div>
                {bill.split.map((r) => (
                  <div key={r.name} className="flex justify-between">
                    <span>{r.name}</span>
                    <span className="font-mono">{fmtINR(r.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <Button variant="primary" className="mt-3.5 w-full" onClick={() => setBill(null)}>
          Done
        </Button>
      </Modal>
    </div>
  );
}
