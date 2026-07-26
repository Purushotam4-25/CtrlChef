import { useState } from "react";
import { arrayRemove, arrayUnion, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db, RESTAURANT_ID } from "../../firebase";
import { upsertDish } from "../../lib/api";
import { fmtINR } from "../../lib/format";
import { useOpsTheme } from "../../contexts/ThemeContext";
import { Badge, Button, Modal, Panel } from "../../components/ops/primitives";

const restaurantRef = doc(db, "restaurants", RESTAURANT_ID);

const emptyForm = { name: "", category: "", price: "", desc: "", veg: false, tags: [], ingredients: [] };

export default function MenuTab({ dishes, ingredients, restaurant }) {
  const { T } = useOpsTheme();
  const dishTags = restaurant?.dishTags || [];
  const [editing, setEditing] = useState(null); // null closed, {} for new, dish for edit
  const [form, setForm] = useState(emptyForm);
  const [newTag, setNewTag] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const ingredientName = (id) => ingredients.find((i) => i.id === id)?.name || id;

  function openNew() {
    setForm(emptyForm);
    setError("");
    setEditing({});
  }

  function openEdit(d) {
    setForm({
      name: d.name,
      category: d.category,
      price: String(d.price),
      desc: d.desc || "",
      veg: !!d.veg,
      tags: d.tags || [],
      ingredients: d.ingredients.map((i) => ({ ingredientId: i.ingredientId, qtyRequired: String(i.qtyRequired) })),
    });
    setError("");
    setEditing(d);
  }

  function toggleTag(tag) {
    setForm((f) => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter((t) => t !== tag) : [...f.tags, tag],
    }));
  }

  function addRecipeRow() {
    setForm((f) => ({ ...f, ingredients: [...f.ingredients, { ingredientId: ingredients[0]?.id || "", qtyRequired: "" }] }));
  }

  function updateRecipeRow(idx, patch) {
    setForm((f) => ({
      ...f,
      ingredients: f.ingredients.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    }));
  }

  function removeRecipeRow(idx) {
    setForm((f) => ({ ...f, ingredients: f.ingredients.filter((_, i) => i !== idx) }));
  }

  async function addTag() {
    const tag = newTag.trim();
    if (!tag) return;
    await updateDoc(restaurantRef, { dishTags: arrayUnion(tag) });
    setNewTag("");
  }

  async function removeTag(tag) {
    await updateDoc(restaurantRef, { dishTags: arrayRemove(tag) });
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    const price = Number(form.price);
    if (!form.name.trim() || !form.category.trim() || !Number.isFinite(price) || price <= 0) {
      setError("Name, category, and a positive price are required.");
      return;
    }
    if (form.ingredients.length === 0 || form.ingredients.some((r) => !r.ingredientId || !(Number(r.qtyRequired) > 0))) {
      setError("Add at least one recipe row with an ingredient and a positive quantity.");
      return;
    }
    setSubmitting(true);
    try {
      await upsertDish({
        dishId: editing.id,
        name: form.name.trim(),
        category: form.category.trim(),
        price,
        desc: form.desc.trim(),
        veg: form.veg,
        tags: form.tags,
        ingredients: form.ingredients.map((r) => ({ ingredientId: r.ingredientId, qtyRequired: Number(r.qtyRequired) })),
      });
      setEditing(null);
    } catch (e) {
      setError(e.message || "That didn't work.");
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(d) {
    if (!confirm(`Delete "${d.name}"? Past orders keep their own snapshot, so this is safe for history.`)) return;
    setDeletingId(d.id);
    try {
      await deleteDoc(doc(db, "restaurants", RESTAURANT_ID, "dishes", d.id));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <Panel className="mb-4 p-3.5">
        <div className="mb-2 text-[13px] font-bold">Dietary tags</div>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {dishTags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-semibold"
              style={{ borderColor: T.border, background: T.panel2, color: T.text }}
            >
              {tag}
              <button className="hover:opacity-70" style={{ color: T.faint }} onClick={() => removeTag(tag)} title="Remove from the tag list">
                ×
              </button>
            </span>
          ))}
          {dishTags.length === 0 && <span className="text-[12.5px]" style={{ color: T.faint }}>No tags yet.</span>}
        </div>
        <div className="flex gap-2">
          <input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
            placeholder="e.g. High Protein"
            className="w-56 rounded-md border px-3 py-1.5 text-[13px] outline-none"
            style={{ background: T.inputBg, borderColor: T.borderAlt, color: T.text }}
          />
          <Button variant="secondary" onClick={addTag}>+ Add tag</Button>
        </div>
      </Panel>

      <div className="mb-3 flex justify-end">
        <Button variant="primary" onClick={openNew}>+ Add dish</Button>
      </div>

      <Panel className="overflow-hidden">
        <div className="grid grid-cols-[1.3fr_0.8fr_0.7fr_0.6fr_1.3fr_0.7fr_1fr] border-b px-4 py-2.5" style={{ borderColor: T.border }}>
          {["DISH", "CATEGORY", "PRICE", "VEG", "TAGS", "STATUS", "ACTION"].map((h) => (
            <div key={h} className="text-[11.5px] font-bold" style={{ color: T.faint }}>{h}</div>
          ))}
        </div>
        {dishes.map((d, idx) => (
          <div
            key={d.id}
            className="grid grid-cols-[1.3fr_0.8fr_0.7fr_0.6fr_1.3fr_0.7fr_1fr] items-center border-b px-4 py-2.5 text-[13.5px]"
            style={{ borderColor: T.panel2, background: idx % 2 === 1 ? T.zebra : "transparent" }}
          >
            <div>{d.name}</div>
            <div className="capitalize" style={{ color: T.dim }}>{d.category}</div>
            <div className="font-mono">{fmtINR(d.price)}</div>
            <div style={{ color: T.dim }}>{d.veg ? "Veg" : "Non-veg"}</div>
            <div className="flex flex-wrap gap-1">
              {(d.tags || []).map((t) => (
                <span key={t} className="rounded px-1.5 py-0.5 text-[10.5px]" style={{ background: T.panel2, color: T.dim }}>
                  {t}
                </span>
              ))}
            </div>
            <div>
              <Badge kind={d.available ? "green" : "gray"}>{d.available ? "AVAILABLE" : "SOLD OUT"}</Badge>
            </div>
            <div className="flex gap-2">
              <button className="text-[11px] underline hover:opacity-70" style={{ color: T.faint }} onClick={() => openEdit(d)}>
                Edit
              </button>
              <button
                className="text-[11px] underline hover:opacity-70 disabled:opacity-40"
                style={{ color: T.faint }}
                disabled={deletingId === d.id}
                onClick={() => remove(d)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </Panel>

      <Modal open={!!editing} onClose={() => setEditing(null)} width={440}>
        <div className="mb-3 text-[15px] font-bold">{editing?.id ? `Edit ${editing.name}` : "Add dish"}</div>
        <form onSubmit={submit} className="flex flex-col gap-2.5">
          <div>
            <label className="mb-1 block text-[13px] font-semibold">Name</label>
            <input
              autoFocus
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none"
              style={{ background: T.inputBg, borderColor: T.borderAlt, color: T.text }}
            />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="mb-1 block text-[13px] font-semibold">Category</label>
              <input
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="starter / main / dessert"
                className="w-full rounded-md border px-3 py-2 text-sm outline-none"
                style={{ background: T.inputBg, borderColor: T.borderAlt, color: T.text }}
              />
            </div>
            <div>
              <label className="mb-1 block text-[13px] font-semibold">Price (₹)</label>
              <input
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                className="w-full rounded-md border px-3 py-2 text-sm outline-none"
                style={{ background: T.inputBg, borderColor: T.borderAlt, color: T.text }}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[13px] font-semibold">Description</label>
            <input
              value={form.desc}
              onChange={(e) => setForm((f) => ({ ...f, desc: e.target.value }))}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none"
              style={{ background: T.inputBg, borderColor: T.borderAlt, color: T.text }}
            />
          </div>
          <label className="flex items-center gap-1.5 text-[13px]">
            <input type="checkbox" checked={form.veg} onChange={(e) => setForm((f) => ({ ...f, veg: e.target.checked }))} />
            Vegetarian
          </label>

          <div>
            <label className="mb-1 block text-[13px] font-semibold">Tags</label>
            <div className="flex flex-wrap gap-1.5">
              {dishTags.map((tag) => (
                <button
                  type="button"
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className="rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors"
                  style={
                    form.tags.includes(tag)
                      ? { background: T.accent, color: "#fff", borderColor: T.accent }
                      : { background: T.panel2, color: T.dim, borderColor: T.borderAlt }
                  }
                >
                  {tag}
                </button>
              ))}
              {dishTags.length === 0 && <span className="text-[12px]" style={{ color: T.faint }}>Add tags above first.</span>}
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-[13px] font-semibold">Recipe</label>
              <button type="button" className="text-[12px] underline hover:opacity-70" style={{ color: T.faint }} onClick={addRecipeRow}>
                + Add ingredient
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              {form.ingredients.map((row, idx) => (
                <div key={idx} className="flex gap-1.5">
                  <select
                    value={row.ingredientId}
                    onChange={(e) => updateRecipeRow(idx, { ingredientId: e.target.value })}
                    className="flex-1 rounded-md border px-2 py-1.5 text-[12.5px] outline-none"
                    style={{ background: T.inputBg, borderColor: T.borderAlt, color: T.text }}
                  >
                    {ingredients.map((i) => (
                      <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
                    ))}
                  </select>
                  <input
                    value={row.qtyRequired}
                    onChange={(e) => updateRecipeRow(idx, { qtyRequired: e.target.value })}
                    placeholder="qty"
                    className="w-20 rounded-md border px-2 py-1.5 text-[12.5px] outline-none"
                    style={{ background: T.inputBg, borderColor: T.borderAlt, color: T.text }}
                  />
                  <button type="button" onClick={() => removeRecipeRow(idx)} className="px-1 text-[13px] hover:opacity-70" style={{ color: T.faint }}>
                    ×
                  </button>
                </div>
              ))}
              {form.ingredients.length === 0 && (
                <div className="text-[12px]" style={{ color: T.faint }}>No ingredients yet — "Add ingredient" to build the recipe.</div>
              )}
            </div>
          </div>

          {error && <div className="text-[13px] text-red-400">{error}</div>}
          <Button variant="primary" type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save dish"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
