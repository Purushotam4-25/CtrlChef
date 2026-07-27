import { useState } from "react";
import { deleteIngredient, restockIngredient, upsertIngredient } from "../../lib/api";
import { useOpsTheme } from "../../contexts/ThemeContext";
import { Badge, Button, Modal, Panel } from "../../components/ops/primitives";

const emptyForm = { name: "", unit: "", lowStockThreshold: "", currentStock: "", costPerUnit: "" };

// ponytail: daily-use / days-left figures live on the Forecast tab (backed by
// getStockForecast, which derives them from real order history) rather than
// duplicated here — ingredients don't store a dailyUsage field.
export default function InventoryTab({ ingredients, dishes = [] }) {
  const { T } = useOpsTheme();
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState(1);
  const [restockTarget, setRestockTarget] = useState(null);
  const [qty, setQty] = useState("");
  const [editing, setEditing] = useState(null); // null closed, {} for new, ingredient for edit
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

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
  const sortLabel = (key, label) =>
    `Sort by ${label}${sortKey === key ? (sortDir > 0 ? ", ascending" : ", descending") : ""}`;

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

  function openNew() {
    setForm(emptyForm);
    setError("");
    setEditing({});
  }

  function openEdit(i) {
    setForm({
      name: i.name,
      unit: i.unit,
      lowStockThreshold: String(i.lowStockThreshold),
      currentStock: "",
      costPerUnit: i.costPerUnit !== undefined ? String(i.costPerUnit) : "",
    });
    setError("");
    setEditing(i);
  }

  async function submitForm(e) {
    e.preventDefault();
    setError("");
    const lowStockThreshold = Number(form.lowStockThreshold);
    if (!form.name.trim() || !form.unit.trim() || !Number.isFinite(lowStockThreshold) || lowStockThreshold < 0) {
      setError("Name, unit, and a non-negative threshold are required.");
      return;
    }
    let currentStock;
    if (!editing.id) {
      currentStock = Number(form.currentStock);
      if (!Number.isFinite(currentStock) || currentStock < 0) {
        setError("Enter a non-negative starting stock.");
        return;
      }
    }
    let costPerUnit;
    if (form.costPerUnit.trim() !== "") {
      costPerUnit = Number(form.costPerUnit);
      if (!Number.isFinite(costPerUnit) || costPerUnit < 0) {
        setError("Cost per unit must be a non-negative number.");
        return;
      }
    }
    setSubmitting(true);
    try {
      await upsertIngredient({
        ingredientId: editing.id,
        name: form.name.trim(),
        unit: form.unit.trim(),
        lowStockThreshold,
        ...(currentStock !== undefined ? { currentStock } : {}),
        ...(costPerUnit !== undefined ? { costPerUnit } : {}),
      });
      setEditing(null);
    } catch (e) {
      setError(e.message || "That didn't work.");
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(i) {
    const affected = dishes.filter((d) => (d.ingredientIds || []).includes(i.id)).map((d) => d.name);
    const warning = affected.length > 0 ? ` This will make these dishes unavailable: ${affected.join(", ")}.` : "";
    if (!confirm(`Delete ${i.name}?${warning}`)) return;
    setDeletingId(i.id);
    try {
      await deleteIngredient({ ingredientId: i.id });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button variant="primary" onClick={openNew}>+ Add ingredient</Button>
      </div>
      <Panel className="overflow-x-auto">
        <div className="min-w-[640px]">
        <div className="grid grid-cols-[1.4fr_1fr_1fr_0.8fr_1.3fr] border-b px-4 py-2.5" style={{ borderColor: T.border }}>
          <button
            className="text-left text-[11.5px] font-bold transition-opacity hover:opacity-70"
            style={{ color: T.faint }}
            onClick={() => sortBy("name")}
            aria-label={sortLabel("name", "ingredient name")}
          >
            INGREDIENT {arrow("name")}
          </button>
          <button
            className="text-left text-[11.5px] font-bold transition-opacity hover:opacity-70"
            style={{ color: T.faint }}
            onClick={() => sortBy("stock")}
            aria-label={sortLabel("stock", "stock level")}
          >
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
            className="grid grid-cols-[1.4fr_1fr_1fr_0.8fr_1.3fr] items-center border-b px-4 py-2.5 text-[13.5px]"
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
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setRestockTarget(i)}>
                Restock
              </Button>
              <button className="text-[11px] underline hover:opacity-70" style={{ color: T.faint }} onClick={() => openEdit(i)}>
                Edit
              </button>
              <button
                className="text-[11px] underline hover:opacity-70 disabled:opacity-40"
                style={{ color: T.faint }}
                disabled={deletingId === i.id}
                onClick={() => remove(i)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        </div>
      </Panel>

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

      <Modal open={!!editing} onClose={() => setEditing(null)} width={320}>
        <div className="mb-3 text-[15px] font-bold">{editing?.id ? `Edit ${editing.name}` : "Add ingredient"}</div>
        <form onSubmit={submitForm}>
          <label className="mb-1.5 block text-[13px] font-semibold">Name</label>
          <input
            autoFocus
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="mb-3 w-full rounded-md border px-3 py-2.5 text-sm outline-none"
            style={{ background: T.inputBg, borderColor: T.borderAlt, color: T.text }}
          />
          <label className="mb-1.5 block text-[13px] font-semibold">Unit</label>
          <input
            value={form.unit}
            onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
            placeholder="kg / L / pcs"
            className="mb-3 w-full rounded-md border px-3 py-2.5 text-sm outline-none"
            style={{ background: T.inputBg, borderColor: T.borderAlt, color: T.text }}
          />
          <label className="mb-1.5 block text-[13px] font-semibold">Low-stock threshold</label>
          <input
            value={form.lowStockThreshold}
            onChange={(e) => setForm((f) => ({ ...f, lowStockThreshold: e.target.value }))}
            className="mb-3 w-full rounded-md border px-3 py-2.5 text-sm outline-none"
            style={{ background: T.inputBg, borderColor: T.borderAlt, color: T.text }}
          />
          <label className="mb-1.5 block text-[13px] font-semibold">Cost per unit (₹)</label>
          <input
            value={form.costPerUnit}
            onChange={(e) => setForm((f) => ({ ...f, costPerUnit: e.target.value }))}
            placeholder="optional — feeds the food-cost report"
            className="mb-3 w-full rounded-md border px-3 py-2.5 text-sm outline-none"
            style={{ background: T.inputBg, borderColor: T.borderAlt, color: T.text }}
          />
          {!editing?.id && (
            <>
              <label className="mb-1.5 block text-[13px] font-semibold">Starting stock</label>
              <input
                value={form.currentStock}
                onChange={(e) => setForm((f) => ({ ...f, currentStock: e.target.value }))}
                className="mb-3 w-full rounded-md border px-3 py-2.5 text-sm outline-none"
                style={{ background: T.inputBg, borderColor: T.borderAlt, color: T.text }}
              />
            </>
          )}
          {error && <div className="mb-3 text-[13px] text-red-400">{error}</div>}
          <Button variant="primary" type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Saving…" : "Save"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
