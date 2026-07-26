import { useMemo, useState } from "react";
import { useGuestData } from "../../contexts/GuestDataContext";
import { useGuestTheme } from "../../contexts/ThemeContext";
import { SkeletonGrid } from "../../components/Skeleton";
import { fmtINR } from "../../lib/format";

export default function Menu() {
  const { dishes, loading } = useGuestData();
  const { T } = useGuestTheme();
  const [search, setSearch] = useState("");
  const [vegOnly, setVegOnly] = useState(false);
  const [category, setCategory] = useState("All");

  const categories = useMemo(() => ["All", ...new Set(dishes.map((d) => d.category))], [dishes]);

  const filtered = dishes.filter((d) => {
    if (vegOnly && !d.veg) return false;
    if (category !== "All" && d.category !== category) return false;
    if (search && !d.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-[1240px] px-8 pb-14 pt-10">
      <div className="mb-1 text-[11px] font-semibold tracking-wide" style={{ color: T.faint }}>LIVE TONIGHT</div>
      <h1 className="mb-2 font-serif text-[32px] font-bold">The menu</h1>
      <div className="mb-5 text-sm" style={{ color: T.dim }}>
        Availability updates as orders come in. Greyed items are out for the night.
      </div>

      <div className="mb-3.5 flex items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search paneer, biryani, naan..."
          className="flex-1 rounded-md border px-3.5 py-2.5 text-[13.5px] outline-none"
          style={{ borderColor: T.border, background: T.panel, color: T.text }}
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
            className="rounded-full border px-4 py-1.5 text-[13px] font-semibold capitalize transition-colors hover:opacity-80"
            style={
              category === cat
                ? { background: T.accent, color: "#fff", borderColor: T.accent }
                : { background: T.panel, color: T.text, borderColor: T.border }
            }
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3.5" style={{ color: T.faint }}>
        {loading && <SkeletonGrid count={6} itemClassName="h-[140px]" />}
        {!loading && filtered.map((m) => (
          <div
            key={m.id}
            className="rounded-lg border p-4"
            style={{ borderColor: T.border, background: m.available ? T.panel : T.panel2, color: T.text }}
          >
            <div className="flex justify-between">
              <div className="text-[15px] font-bold">{m.name}</div>
              <div className="font-mono font-bold">{fmtINR(m.price)}</div>
            </div>
            <div className="mt-0.5 text-[11px] tracking-wide capitalize" style={{ color: T.faint }}>{m.category}</div>
            {m.desc && <div className="mt-1.5 text-[13px]" style={{ color: T.cardText }}>{m.desc}</div>}
            <div className="mt-2.5">
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                style={
                  m.available
                    ? { background: T.pillOkBg, color: T.pillOkText }
                    : { background: T.pillOffBg, color: T.pillOffText }
                }
              >
                {m.available ? "Available" : "Sold out"}
              </span>
            </div>
          </div>
        ))}
        {!loading && filtered.length === 0 && (
          <div className="col-span-3 text-sm" style={{ color: T.faint }}>No dishes match that search.</div>
        )}
      </div>
    </div>
  );
}
