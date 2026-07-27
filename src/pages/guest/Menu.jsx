import { useEffect, useMemo, useState } from "react";
import { useGuestData } from "../../contexts/GuestDataContext";
import { useGuestTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import { SkeletonGrid } from "../../components/Skeleton";
import { fmtINR } from "../../lib/format";
import { getMyRecommendations } from "../../lib/api";

export default function Menu() {
  const { dishes, loading } = useGuestData();
  const { T } = useGuestTheme();
  const { user, accountType } = useAuth();
  const [search, setSearch] = useState("");
  const [vegOnly, setVegOnly] = useState(false);
  const [category, setCategory] = useState("All");
  const [activeTags, setActiveTags] = useState([]);
  const [usuals, setUsuals] = useState([]);

  // Additive only — a signed-out guest or a member with no order history
  // just sees the normal menu, unchanged.
  useEffect(() => {
    if (accountType !== "member") {
      setUsuals([]);
      return;
    }
    getMyRecommendations({ memberId: user.uid })
      .then((res) => setUsuals(res.recommendations))
      // Additive strip — a failure just means it doesn't show, same as having no history.
      .catch((err) => console.error("getMyRecommendations failed:", err));
  }, [accountType, user]);

  // Sorted — otherwise the filter row's order is just whatever order
  // Firestore happens to return dishes in, which shuffles unpredictably.
  const categories = useMemo(
    () => ["All", ...[...new Set(dishes.map((d) => d.category))].sort((a, b) => a.localeCompare(b))],
    [dishes]
  );
  const allTags = useMemo(() => [...new Set(dishes.flatMap((d) => d.tags || []))], [dishes]);

  function toggleTag(tag) {
    setActiveTags((tags) => (tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag]));
  }

  const filtered = dishes.filter((d) => {
    if (vegOnly && !d.veg) return false;
    if (category !== "All" && d.category !== category) return false;
    if (search && !d.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (activeTags.length > 0 && !activeTags.every((t) => (d.tags || []).includes(t))) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-[1240px] px-4 pb-14 pt-10 sm:px-8">
      <div className="mb-1 text-[11px] font-semibold tracking-wide" style={{ color: T.faint }}>LIVE TONIGHT</div>
      <h1 className="mb-2 font-serif text-[32px] font-bold">The menu</h1>
      <div className="mb-5 text-sm" style={{ color: T.dim }}>
        Availability updates as orders come in. Greyed items are out for the night.
      </div>

      {usuals.length > 0 && (
        <div className="mb-5">
          <div className="mb-0.5 text-[13.5px] font-bold">Your usuals</div>
          <div className="mb-2 text-[11.5px]" style={{ color: T.faint }}>
            Based on how often you've ordered — not a recommendation engine, just a count of what's still available.
          </div>
          <div className="flex flex-wrap gap-2">
            {usuals.map((u) => (
              <div
                key={u.dishId}
                className="flex items-center gap-2 rounded-full border py-1.5 pl-3.5 pr-2"
                style={{ borderColor: T.borderDashed, background: T.panel }}
              >
                <span className="text-[13px] font-semibold">{u.name}</span>
                <span className="font-mono text-[12px]" style={{ color: T.faint }}>{fmtINR(u.price)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

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

      <div className="mb-3.5 flex flex-wrap gap-2">
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

      {allTags.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className="rounded-full border px-3.5 py-1 text-[12.5px] font-semibold transition-colors hover:opacity-80"
              style={
                activeTags.includes(tag)
                  ? { background: T.accent, color: "#fff", borderColor: T.accent }
                  : { background: T.panel, color: T.faint, borderColor: T.border }
              }
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3" style={{ color: T.faint }}>
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
            {m.tags?.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {m.tags.map((tag) => (
                  <span key={tag} className="rounded px-1.5 py-0.5 text-[10.5px] font-semibold" style={{ background: T.panel2, color: T.faint }}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
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
          <div className="col-span-1 text-sm sm:col-span-2 lg:col-span-3" style={{ color: T.faint }}>No dishes match that search.</div>
        )}
      </div>
    </div>
  );
}
