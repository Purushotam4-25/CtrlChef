import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db, RESTAURANT_ID } from "../../firebase";
import { fmtINR } from "../../lib/format";

export default function Menu() {
  const [dishes, setDishes] = useState([]);
  const [search, setSearch] = useState("");
  const [vegOnly, setVegOnly] = useState(false);
  const [category, setCategory] = useState("All");

  useEffect(() => {
    const dishesRef = collection(db, "restaurants", RESTAURANT_ID, "dishes");
    return onSnapshot(dishesRef, (snap) => setDishes(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, []);

  const categories = useMemo(() => ["All", ...new Set(dishes.map((d) => d.category))], [dishes]);

  const filtered = dishes.filter((d) => {
    if (vegOnly && !d.veg) return false;
    if (category !== "All" && d.category !== category) return false;
    if (search && !d.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-[1240px] px-8 pb-14 pt-10">
      <div className="mb-1 text-[11px] font-semibold tracking-wide text-guest-faint">LIVE TONIGHT</div>
      <h1 className="mb-2 font-serif text-[32px] font-bold">The menu</h1>
      <div className="mb-5 text-sm text-guest-dim">
        Availability updates as orders come in. Greyed items are out for the night.
      </div>

      <div className="mb-3.5 flex items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search paneer, biryani, naan..."
          className="flex-1 rounded-md border border-guest-border bg-guest-panel px-3.5 py-2.5 text-[13.5px] text-guest-text outline-none"
        />
        <label className="flex items-center gap-1.5 whitespace-nowrap text-[13px]">
          <input type="checkbox" checked={vegOnly} onChange={(e) => setVegOnly(e.target.checked)} />
          Vegetarian only
        </label>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className="rounded-full border px-4 py-1.5 text-[13px] font-semibold capitalize"
            style={
              category === cat
                ? { background: "#A35D3A", color: "#fff", borderColor: "#A35D3A" }
                : { background: "#FBF6EC", color: "#302B27", borderColor: "#E4D9C3" }
            }
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3.5">
        {filtered.map((m) => (
          <div
            key={m.id}
            className="rounded-lg border border-guest-border p-4"
            style={{ background: m.available ? "#FBF6EC" : "#EFE7D8" }}
          >
            <div className="flex justify-between">
              <div className="text-[15px] font-bold">{m.name}</div>
              <div className="font-mono font-bold">{fmtINR(m.price)}</div>
            </div>
            <div className="mt-0.5 text-[11px] tracking-wide text-guest-faint capitalize">{m.category}</div>
            {m.desc && <div className="mt-1.5 text-[13px] text-[#4a4038]">{m.desc}</div>}
            <div className="mt-2.5">
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                style={
                  m.available
                    ? { background: "rgba(94,120,98,0.15)", color: "#5E7862" }
                    : { background: "rgba(139,123,99,0.2)", color: "#8A7A63" }
                }
              >
                {m.available ? "Available" : "Sold out"}
              </span>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="col-span-3 text-sm text-guest-faint">No dishes match that search.</div>}
      </div>
    </div>
  );
}
