import { useMemo, useState } from "react";
import { closeOrder } from "../../lib/api";
import { fmtINR } from "../../lib/format";
import { computeBillPreview, byItemSplit, evenSplit } from "../../lib/splitBill";
import { useOpsData } from "../../contexts/OpsDataContext";
import { useOpsTheme } from "../../contexts/ThemeContext";
import { Button, Modal } from "../../components/ops/primitives";

const PAYMENT_METHODS = ["cash", "card", "upi"];

// Pre-close configuration: discount, payment method, and an optional split
// preview — all computed client-side (src/lib/splitBill.js) before the
// single atomic closeOrder call. The split itself is never sent to the
// backend; it's a calculator, not a settlement record (per the project's
// display-only billing design — see functions/lib/billing.js).
export default function BillModal({ order, tableNumber, onClose, onClosed }) {
  const { T } = useOpsTheme();
  const { restaurant } = useOpsData();
  const [discountType, setDiscountType] = useState("none");
  const [discountValue, setDiscountValue] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [splitMode, setSplitMode] = useState("none");
  const [names, setNames] = useState([]);
  const [newName, setNewName] = useState("");
  const [assignments, setAssignments] = useState({}); // itemId -> string[] (length qty, "" = unassigned)
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const discount = useMemo(() => {
    if (discountType === "none") return undefined;
    const value = Number(discountValue);
    if (!Number.isFinite(value) || value <= 0) return null; // invalid, not "no discount"
    return { type: discountType, value };
  }, [discountType, discountValue]);

  const previewBill = useMemo(
    () =>
      computeBillPreview({
        subtotal: order.totalAmount,
        discount: discount || null,
        serviceChargePct: restaurant?.serviceChargePct,
        gstPct: restaurant?.gstPct,
      }),
    [order.totalAmount, discount, restaurant]
  );

  function addName() {
    const name = newName.trim();
    if (!name || names.includes(name)) return;
    setNames((n) => [...n, name]);
    setNewName("");
  }

  function removeName(name) {
    setNames((n) => n.filter((x) => x !== name));
    setAssignments((a) => {
      const next = {};
      for (const [itemId, slots] of Object.entries(a)) {
        next[itemId] = slots.map((s) => (s === name ? "" : s));
      }
      return next;
    });
  }

  function slotsFor(item) {
    return assignments[item.itemId] || Array.from({ length: item.qty }, () => "");
  }

  function assignUnit(item, unitIndex, name) {
    setAssignments((a) => {
      const slots = [...slotsFor(item)];
      slots[unitIndex] = name;
      return { ...a, [item.itemId]: slots };
    });
  }

  const assignmentsByPerson = useMemo(() => {
    const map = {};
    for (const item of order.items) {
      const slots = slotsFor(item);
      const perPerson = {};
      slots.forEach((name) => {
        if (name) perPerson[name] = (perPerson[name] || 0) + 1;
      });
      map[item.itemId] = perPerson;
    }
    return map;
  }, [assignments, order.items]);

  const itemSplit = useMemo(() => {
    if (splitMode !== "item") return null;
    try {
      return { rows: byItemSplit(previewBill, order.items, assignmentsByPerson), error: null };
    } catch (e) {
      return { rows: null, error: e.message };
    }
  }, [splitMode, previewBill, order.items, assignmentsByPerson]);

  const evenRows = splitMode === "even" && names.length >= 2 ? evenSplit(previewBill, names) : null;

  const discountInvalid = discountType !== "none" && discount === null;
  const splitInvalid =
    (splitMode === "even" && names.length < 2) || (splitMode === "item" && (!itemSplit || itemSplit.error));
  const canConfirm = !!paymentMethod && !discountInvalid && !splitInvalid && !submitting;

  async function confirm() {
    setError("");
    setSubmitting(true);
    try {
      const res = await closeOrder({ orderId: order.id, discount, paymentMethod });
      const split =
        splitMode === "even"
          ? evenSplit(res.bill, names)
          : splitMode === "item"
          ? byItemSplit(res.bill, order.items, assignmentsByPerson)
          : null;
      onClosed({ bill: res.bill, paymentMethod: res.paymentMethod, split });
    } catch (e) {
      setError(e.message || "That didn't work.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} width={440}>
      <div className="mb-3 text-[15px] font-bold">Bill Table {tableNumber}</div>

      <div className="mb-3">
        <div className="mb-1.5 text-[13px] font-semibold">Discount</div>
        <div className="flex gap-1.5">
          {["none", "flat", "pct"].map((t) => (
            <button
              key={t}
              onClick={() => setDiscountType(t)}
              className="rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-colors"
              style={{ background: discountType === t ? T.accent : T.panel2, color: discountType === t ? "#fff" : T.dim }}
            >
              {t === "none" ? "None" : t === "flat" ? "Flat ₹" : "%"}
            </button>
          ))}
          {discountType !== "none" && (
            <input
              autoFocus
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              placeholder={discountType === "flat" ? "₹ amount" : "% amount"}
              className="w-28 rounded-md border px-2.5 py-1.5 text-[12.5px] outline-none"
              style={{ background: T.inputBg, borderColor: T.borderAlt, color: T.text }}
            />
          )}
        </div>
        {discountInvalid && <div className="mt-1 text-[12px] text-red-400">Enter a positive discount value.</div>}
      </div>

      <div className="mb-3">
        <div className="mb-1.5 text-[13px] font-semibold">Payment method</div>
        <div className="flex gap-1.5">
          {PAYMENT_METHODS.map((m) => (
            <button
              key={m}
              onClick={() => setPaymentMethod(m)}
              className="flex-1 rounded-md px-3 py-1.5 text-[12.5px] font-semibold capitalize transition-colors"
              style={{ background: paymentMethod === m ? T.accent : T.panel2, color: paymentMethod === m ? "#fff" : T.dim }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3">
        <div className="mb-1.5 text-[13px] font-semibold">Split</div>
        <div className="mb-2 flex gap-1.5">
          {["none", "even", "item"].map((m) => (
            <button
              key={m}
              onClick={() => setSplitMode(m)}
              className="rounded-md px-3 py-1.5 text-[12.5px] font-semibold capitalize transition-colors"
              style={{ background: splitMode === m ? T.accent : T.panel2, color: splitMode === m ? "#fff" : T.dim }}
            >
              {m === "item" ? "By item" : m}
            </button>
          ))}
        </div>

        {splitMode !== "none" && (
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            {names.map((name) => (
              <span
                key={name}
                className="flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-semibold"
                style={{ borderColor: T.border, background: T.panel2, color: T.text }}
              >
                {name}
                <button className="hover:opacity-70" style={{ color: T.faint }} onClick={() => removeName(name)} aria-label={`Remove ${name} from the split`}>×</button>
              </span>
            ))}
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addName())}
              placeholder="Add a name"
              className="w-32 rounded-md border px-2.5 py-1 text-[12.5px] outline-none"
              style={{ background: T.inputBg, borderColor: T.borderAlt, color: T.text }}
            />
          </div>
        )}

        {splitMode === "even" && (
          <>
            {names.length < 2 && <div className="text-[12px]" style={{ color: T.faint }}>Add at least 2 names.</div>}
            {evenRows &&
              evenRows.map((r) => (
                <div key={r.name} className="flex justify-between text-[12.5px]" style={{ color: T.dim }}>
                  <span>{r.name}</span>
                  <span className="font-mono">{fmtINR(r.total)}</span>
                </div>
              ))}
          </>
        )}

        {splitMode === "item" && (
          <div className="flex flex-col gap-1.5">
            {names.length === 0 && <div className="text-[12px]" style={{ color: T.faint }}>Add names first, then assign each unit below.</div>}
            {names.length > 0 &&
              order.items.map((item) => (
                <div key={item.itemId} className="text-[12.5px]" style={{ color: T.dim }}>
                  <div className="mb-0.5">{item.dishName} ×{item.qty}</div>
                  <div className="flex flex-wrap gap-1">
                    {slotsFor(item).map((assigned, idx) => (
                      <select
                        key={idx}
                        value={assigned}
                        onChange={(e) => assignUnit(item, idx, e.target.value)}
                        className="rounded border px-1.5 py-1 text-[12px] outline-none"
                        style={{ background: T.inputBg, borderColor: T.borderAlt, color: T.text }}
                      >
                        <option value="">unassigned</option>
                        {names.map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    ))}
                  </div>
                </div>
              ))}
            {itemSplit?.error && <div className="text-[12px] text-red-400">Assign every unit before closing.</div>}
            {itemSplit?.rows &&
              itemSplit.rows.map((r) => (
                <div key={r.name} className="flex justify-between border-t pt-1" style={{ borderColor: T.panel2 }}>
                  <span>{r.name} <span style={{ color: T.faint }}>(₹{r.subtotal} in items)</span></span>
                  <span className="font-mono">{fmtINR(r.total)}</span>
                </div>
              ))}
          </div>
        )}
      </div>

      <div className="mb-3 flex flex-col gap-1 border-t pt-2.5 text-[13px]" style={{ borderColor: T.border }}>
        <div className="flex justify-between"><span style={{ color: T.dim }}>Subtotal</span><span>{fmtINR(previewBill.subtotal)}</span></div>
        {previewBill.discountAmount > 0 && (
          <div className="flex justify-between"><span style={{ color: T.dim }}>Discount</span><span>-{fmtINR(previewBill.discountAmount)}</span></div>
        )}
        <div className="flex justify-between"><span style={{ color: T.dim }}>Service charge</span><span>{fmtINR(previewBill.serviceCharge)}</span></div>
        <div className="flex justify-between"><span style={{ color: T.dim }}>GST</span><span>{fmtINR(previewBill.gst)}</span></div>
        <div className="flex justify-between font-bold"><span>Total</span><span className="font-mono">{fmtINR(previewBill.total)}</span></div>
      </div>

      {error && <div className="mb-3 text-[13px] text-red-400">{error}</div>}
      <Button variant="primary" className="w-full" disabled={!canConfirm} onClick={confirm}>
        {submitting ? "Closing…" : "Confirm & close"}
      </Button>
    </Modal>
  );
}
