import { useState } from "react";
import { restockIngredient } from "../../lib/api";
import { useOpsTheme } from "../../contexts/ThemeContext";
import { Badge, Button, Modal, Panel } from "../../components/ops/primitives";

// ponytail: daily-use / days-left figures live on the Forecast tab (backed by
// getStockForecast, which derives them from real order history) rather than
// duplicated here — ingredients don't store a dailyUsage field.
export default function InventoryTab({ ingredients }) {
  const { T } = useOpsTheme();
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState(1);
  const [restockTarget, setRestockTarget] = useState(null);
  const [qty, setQty] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function sortBy(key) {
    if (key === sortKey) setSortDir((d) => -d);
    else {
      setSortKey(key);
      setSortDir(1);
    }
  }

  const sorted = [...ingredients].sort((a, b) => {
    let diff = 0;
    if (sortKey === "name") diff = a.name.localeCompare(b.name);
    if (sortKey === "stock") diff = a.currentStock - b.currentStock;
    return diff * sortDir;
  });

  const arrow = (key) => (sortKey === key ? (sortDir > 0 ? "↑" : "↓") : "");

  async function submitRestock(e) {
    e.preventDefault();
    setError("");
    const qtyAdded = Number(qty);
    if (!Number.isFinite(qtyAdded) || qtyAdded <= 0) {
      setError("Enter a positive amount.");
      return;
    }
    setSubmitting(true);
    try {
      await restockIngredient({ ingredientId: restockTarget.id, qtyAdded });
      setRestockTarget(null);
      setQty("");
    } catch (e) {
      setError(e.message || "That didn't work.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Panel className="overflow-hidden">
      <div className="grid grid-cols-[1.6fr_1fr_1fr_0.9fr_0.9fr] border-b px-4 py-2.5" style={{ borderColor: T.border }}>
        <button className="text-left text-[11.5px] font-bold transition-opacity hover:opacity-70" style={{ color: T.faint }} onClick={() => sortBy("name")}>
          INGREDIENT {arrow("name")}
        </button>
        <button className="text-left text-[11.5px] font-bold transition-opacity hover:opacity-70" style={{ color: T.faint }} onClick={() => sortBy("stock")}>
          STOCK {arrow("stock")}
        </button>
        <div className="text-[11.5px] font-bold" style={{ color: T.faint }}>
          THRESHOLD
        </div>
        <div className="text-[11.5px] font-bold" style={{ color: T.faint }}>
          STATUS
        </div>
        <div className="text-[11.5px] font-bold" style={{ color: T.faint }}>
          ACTION
        </div>
      </div>
      {sorted.map((i, idx) => (
        <div
          key={i.id}
          className="grid grid-cols-[1.6fr_1fr_1fr_0.9fr_0.9fr] items-center border-b px-4 py-2.5 text-[13.5px]"
          style={{ borderColor: T.panel2, background: idx % 2 === 1 ? T.zebra : "transparent" }}
        >
          <div>{i.name}</div>
          <div className="font-mono">
            {i.currentStock} {i.unit}
          </div>
          <div className="font-mono" style={{ color: T.dim }}>
            {i.lowStockThreshold} {i.unit}
          </div>
          <div>
            <Badge kind={i.lowStock ? "amber" : "green"}>{i.lowStock ? "LOW" : "OK"}</Badge>
          </div>
          <div>
            <Button variant="secondary" onClick={() => setRestockTarget(i)}>
              Restock
            </Button>
          </div>
        </div>
      ))}

      <Modal open={!!restockTarget} onClose={() => setRestockTarget(null)} width={320}>
        <div className="mb-3 text-[15px] font-bold">Restock {restockTarget?.name}</div>
        <form onSubmit={submitRestock}>
          <label className="mb-1.5 block text-[13px] font-semibold">Quantity added ({restockTarget?.unit})</label>
          <input
            autoFocus
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="mb-3 w-full rounded-md border px-3 py-2.5 text-sm outline-none"
            style={{ background: T.inputBg, borderColor: T.borderAlt, color: T.text }}
          />
          {error && <div className="mb-3 text-[13px] text-red-400">{error}</div>}
          <Button variant="primary" type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Restocking…" : "Confirm restock"}
          </Button>
        </form>
      </Modal>
    </Panel>
  );
}
