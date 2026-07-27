import { useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useOpsData } from "../contexts/OpsDataContext";
import { useOpsTheme } from "../contexts/ThemeContext";
import { useToast } from "../contexts/ToastContext";
import { useTransitionWatch } from "../lib/useTransitionWatch";

const NAV_ITEMS = [
  { to: "/waiter", label: "Waiter — Table Map", roles: ["waiter", "manager"] },
  { to: "/chef", label: "Kitchen — Tickets", roles: ["chef", "manager"] },
  { to: "/manager", label: "Manager — Dashboard", roles: ["manager"] },
];

export default function OpsLayout() {
  const { staff, signOut } = useAuth();
  const { restaurant, ingredients } = useOpsData();
  const { mode, setTheme, T } = useOpsTheme();
  const { notify } = useToast();
  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(staff?.role));
  const name = restaurant?.name || "CtrlChef";

  useEffect(() => {
    document.title = name;
  }, [name]);

  // Lives here rather than Dashboard.jsx (manager-only) because the trigger
  // table wants manager AND chef to see it — this layout is the one place
  // both roles' routes pass through. The ingredients listener itself already
  // lives in OpsDataContext, shared by every ops role.
  useTransitionWatch(
    ingredients,
    (i) => i.id,
    (i) => i.lowStock,
    (ingredient, prev, next) => {
      if (!next || prev) return; // only the false -> true edge, not restocks
      if (staff?.role !== "manager" && staff?.role !== "chef") return;
      notify({
        kind: "warn",
        title: `${ingredient.name} is low`,
        body: `${ingredient.currentStock}${ingredient.unit || ""} left (threshold ${ingredient.lowStockThreshold}${ingredient.unit || ""})`,
      });
    }
  );

  return (
    <div
      className="flex h-screen w-full overflow-hidden font-sans"
      style={{ background: T.bg, color: T.text }}
    >
      <div
        className="flex w-[216px] flex-shrink-0 flex-col border-r p-3"
        style={{ background: T.sidebar, borderColor: T.border }}
      >
        <div
          className="mb-3.5 flex items-center gap-2.5 border-b pb-4 px-2 pt-1.5"
          style={{ borderColor: T.border }}
        >
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: T.accent }}>
            <div className="h-4 w-3 rotate-45 rounded-[60%_60%_60%_5%] bg-white" />
          </div>
          <div>
            <div className="text-[15px] font-bold leading-tight">{name}</div>
            <div className="text-[10px] tracking-wide" style={{ color: T.faint }}>
              FLOOR OPERATIONS
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-0.5">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className="flex items-center gap-2.5 rounded-md px-2.5 py-2.5 text-[13.5px] font-semibold transition-colors hover:brightness-125"
              style={({ isActive }) => ({
                background: isActive ? T.accentSoft : "transparent",
                color: isActive ? T.text : T.dim,
              })}
            >
              {({ isActive }) => (
                <>
                  <div
                    className="h-1.5 w-1.5 flex-shrink-0 rounded-sm"
                    style={{ background: isActive ? T.accentBright : T.navInactiveDot }}
                  />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </div>

        <div className="mt-auto border-t pt-3.5" style={{ borderColor: T.border }}>
          <div className="mb-1.5 pl-0.5 text-[10px] tracking-wide" style={{ color: T.faintest }}>
            {staff?.name} · {staff?.role}
          </div>
          <button
            onClick={signOut}
            className="mb-2 block text-[12px] underline transition-opacity hover:opacity-70"
            style={{ color: T.faint }}
          >
            Sign out
          </button>
          <div
            className="mt-1 flex gap-1 rounded-md border p-[3px]"
            style={{ background: T.panel2, borderColor: T.borderAlt }}
          >
            <button
              onClick={() => setTheme("dark")}
              className="flex-1 rounded py-1.5 text-[11.5px] font-semibold transition-colors hover:brightness-125"
              style={{ background: mode === "dark" ? T.accent : "transparent", color: mode === "dark" ? "#fff" : T.dim }}
            >
              Dark
            </button>
            <button
              onClick={() => setTheme("light")}
              className="flex-1 rounded py-1.5 text-[11.5px] font-semibold transition-colors hover:brightness-125"
              style={{ background: mode === "light" ? T.accent : "transparent", color: mode === "light" ? "#fff" : T.dim }}
            >
              Light
            </button>
          </div>
        </div>
      </div>

      <div className="min-w-0 flex-1 overflow-y-auto px-7 py-5 pb-10">
        <Outlet />
      </div>
    </div>
  );
}
