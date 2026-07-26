import { useEffect, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db, RESTAURANT_ID } from "../../firebase";
import { useOpsTheme } from "../../contexts/ThemeContext";
import { Button, Panel } from "../../components/ops/primitives";

const restaurantRef = doc(db, "restaurants", RESTAURANT_ID);

// Direct Firestore write, same pattern as StaffTab's clock-in — this doc is
// already unconditionally manager-writable per firestore.rules, so there's
// no need for a Cloud Function just to change a name or a percentage.
export default function SettingsTab({ restaurant }) {
  const { T } = useOpsTheme();
  const [form, setForm] = useState({ name: "", address: "", hoursLabel: "", serviceChargePct: "", gstPct: "" });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!restaurant) return;
    setForm({
      name: restaurant.name || "",
      address: restaurant.address || "",
      hoursLabel: restaurant.hoursLabel || "",
      serviceChargePct: String(restaurant.serviceChargePct ?? ""),
      gstPct: String(restaurant.gstPct ?? ""),
    });
  }, [restaurant]);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setSaved(false);
    const serviceChargePct = Number(form.serviceChargePct);
    const gstPct = Number(form.gstPct);
    if (!form.name.trim() || !Number.isFinite(serviceChargePct) || serviceChargePct < 0 || !Number.isFinite(gstPct) || gstPct < 0) {
      setError("A name and non-negative percentages are required.");
      return;
    }
    setSubmitting(true);
    try {
      await updateDoc(restaurantRef, {
        name: form.name.trim(),
        address: form.address.trim(),
        hoursLabel: form.hoursLabel.trim(),
        serviceChargePct,
        gstPct,
      });
      setSaved(true);
    } catch (e) {
      setError(e.message || "That didn't work.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Panel className="max-w-[420px] p-4">
      <div className="mb-3 text-[15px] font-bold">Restaurant settings</div>
      <div className="mb-3.5 text-[12.5px]" style={{ color: T.faint }}>
        Shown on the public menu, receipts, and the staff portal. Changes apply everywhere immediately.
      </div>
      <form onSubmit={submit} className="flex flex-col gap-2.5">
        <div>
          <label className="mb-1 block text-[13px] font-semibold">Site name</label>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full rounded-md border px-3 py-2 text-sm outline-none"
            style={{ background: T.inputBg, borderColor: T.borderAlt, color: T.text }}
          />
        </div>
        <div>
          <label className="mb-1 block text-[13px] font-semibold">Address</label>
          <input
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            className="w-full rounded-md border px-3 py-2 text-sm outline-none"
            style={{ background: T.inputBg, borderColor: T.borderAlt, color: T.text }}
          />
        </div>
        <div>
          <label className="mb-1 block text-[13px] font-semibold">Hours</label>
          <input
            value={form.hoursLabel}
            onChange={(e) => setForm((f) => ({ ...f, hoursLabel: e.target.value }))}
            placeholder="e.g. 11am – 11pm"
            className="w-full rounded-md border px-3 py-2 text-sm outline-none"
            style={{ background: T.inputBg, borderColor: T.borderAlt, color: T.text }}
          />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="mb-1 block text-[13px] font-semibold">Service charge %</label>
            <input
              value={form.serviceChargePct}
              onChange={(e) => setForm((f) => ({ ...f, serviceChargePct: e.target.value }))}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none"
              style={{ background: T.inputBg, borderColor: T.borderAlt, color: T.text }}
            />
          </div>
          <div>
            <label className="mb-1 block text-[13px] font-semibold">GST %</label>
            <input
              value={form.gstPct}
              onChange={(e) => setForm((f) => ({ ...f, gstPct: e.target.value }))}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none"
              style={{ background: T.inputBg, borderColor: T.borderAlt, color: T.text }}
            />
          </div>
        </div>
        {error && <div className="text-[13px] text-red-400">{error}</div>}
        {saved && !error && <div className="text-[13px] text-green-400">Saved.</div>}
        <Button variant="primary" type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </Panel>
  );
}
