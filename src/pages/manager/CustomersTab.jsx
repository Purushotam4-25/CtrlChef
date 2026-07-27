import { useMemo } from "react";
import { fmtINR } from "../../lib/format";
import { useOpsTheme } from "../../contexts/ThemeContext";
import { Panel } from "../../components/ops/primitives";

// Plain aggregation over members + `closedOrders` (unbounded, unlike the
// Orders tab's capped `allOrders` — a member's lifetime spend needs their
// full history, not just the 50 most recent orders restaurant-wide). No new
// backend call: everything here is already in OpsDataContext.
export default function CustomersTab({ members, orders }) {
  const { T } = useOpsTheme();

  const rows = useMemo(() => {
    return members.map((m) => {
      const own = orders.filter((o) => o.memberId === m.id);
      const spend = own.reduce((sum, o) => sum + (o.bill?.total ?? o.totalAmount), 0);
      const countByDish = {};
      let lastVisit = null;
      for (const o of own) {
        for (const item of o.items) countByDish[item.dishName] = (countByDish[item.dishName] || 0) + item.qty;
        const at = o.createdAt?.toDate ? o.createdAt.toDate() : null;
        if (at && (!lastVisit || at > lastVisit)) lastVisit = at;
      }
      const favourite = Object.entries(countByDish).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
      return { id: m.id, name: m.name, email: m.email, visits: own.length, spend, favourite, lastVisit };
    });
  }, [members, orders]);

  return (
    <div>
      <div className="mb-3 text-[12.5px]" style={{ color: T.faint }}>
        Members only — order history from guests who never signed in isn't linked to anyone.
      </div>
      <Panel className="overflow-x-auto">
        <div className="min-w-[640px]">
        <div className="grid grid-cols-[1.4fr_0.7fr_0.9fr_1fr_1fr] border-b px-4 py-2.5" style={{ borderColor: T.border }}>
          {["NAME", "VISITS", "TOTAL SPEND", "FAVOURITE DISH", "LAST VISIT"].map((h) => (
            <div key={h} className="text-[11.5px] font-bold" style={{ color: T.faint }}>{h}</div>
          ))}
        </div>
        {rows.map((r, idx) => (
          <div
            key={r.id}
            className="grid grid-cols-[1.4fr_0.7fr_0.9fr_1fr_1fr] items-center border-b px-4 py-2.5 text-[13.5px]"
            style={{ borderColor: T.panel2, background: idx % 2 === 1 ? T.zebra : "transparent" }}
          >
            <div>
              {r.name}
              <div className="text-[11px]" style={{ color: T.faint }}>{r.email}</div>
            </div>
            <div style={{ color: T.dim }}>{r.visits}</div>
            <div className="font-mono font-semibold" style={{ color: T.accentBright }}>{fmtINR(r.spend)}</div>
            <div style={{ color: T.dim }}>{r.favourite}</div>
            <div style={{ color: T.dim }}>{r.lastVisit ? r.lastVisit.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}</div>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="px-4 py-6 text-center text-[13px]" style={{ color: T.faint }}>No members yet.</div>
        )}
        </div>
      </Panel>
    </div>
  );
}
