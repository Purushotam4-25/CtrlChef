import { useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { LogOut, Moon, Sun } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useOpsData } from "../contexts/OpsDataContext";
import { useOpsTheme } from "../contexts/ThemeContext";
import { useToast } from "../contexts/ToastContext";
import { useTransitionWatch } from "../lib/useTransitionWatch";
import logoIcon from "../assets/logo-icon.png";

const NAV_ITEMS = [
  { to: "/waiter", label: "Waiter — Table Map", shortLabel: "Tables", roles: ["waiter", "manager"] },
  { to: "/chef", label: "Kitchen — Tickets", shortLabel: "Tickets", roles: ["chef", "manager"] },
  { to: "/manager", label: "Manager — Dashboard", shortLabel: "Dashboard", roles: ["manager"] },
];

export default function OpsLayout() {
  const { staff, signOut } = useAuth();
  const { restaurant, ingredients, error: dataError } = useOpsData();
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
      // h-dvh, not h-screen — 100vh is a fixed number that doesn't account
      // for a mobile browser's collapsing URL bar, so it either clips
      // content or leaves a dead gap depending on scroll state. 100dvh
      // tracks the *actual* visible viewport instead.
      // Column below md (mobile top bar + content + bottom nav stacked),
      // row at md+ (sidebar beside content) — see the comment above the
      // desktop sidebar for why DOM order still works both ways.
      className="flex h-dvh w-full flex-col overflow-hidden font-sans md:flex-row"
      style={{ background: T.bg, color: T.text }}
    >
      {/* Desktop sidebar — hidden below md, where the mobile top bar +
          bottom nav below take over. Kept first in DOM so md:flex-row
          still puts it on the left; it collapses to zero width when
          hidden, so its position doesn't affect the mobile column layout. */}
      <div
        className="hidden w-[216px] flex-shrink-0 flex-col border-r p-3 md:flex"
        style={{ background: T.sidebar, borderColor: T.border }}
      >
        <div
          className="mb-3.5 flex items-center gap-2.5 border-b pb-4 px-2 pt-1.5"
          style={{ borderColor: T.border }}
        >
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white p-1">
            <img src={logoIcon} alt="" className="h-full w-full object-contain" />
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

      {/* Mobile top bar — replaces the sidebar's header below md. */}
      <div
        className="flex flex-shrink-0 items-center justify-between border-b px-4 py-2.5 md:hidden"
        style={{ background: T.sidebar, borderColor: T.border }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-white p-0.5">
            <img src={logoIcon} alt="" className="h-full w-full object-contain" />
          </div>
          <div className="truncate text-[14px] font-bold leading-tight">{name}</div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          <button
            onClick={() => setTheme(mode === "dark" ? "light" : "dark")}
            aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="flex h-8 w-8 items-center justify-center rounded-md transition-opacity hover:opacity-70"
            style={{ color: T.dim }}
          >
            {mode === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            onClick={signOut}
            aria-label="Sign out"
            title="Sign out"
            className="flex h-8 w-8 items-center justify-center rounded-md transition-opacity hover:opacity-70"
            style={{ color: T.dim }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      <div className="min-w-0 flex-1 overflow-y-auto px-4 py-4 md:px-7 md:py-5 md:pb-10">
        {dataError && (
          <div className="mb-3.5 rounded-md border border-red-800 bg-red-950/20 px-3 py-2 text-[12.5px] text-red-400">
            Having trouble reaching the server — some information here may be out of date. Try refreshing.
          </div>
        )}
        <Outlet />
      </div>

      {/* Mobile bottom nav — replaces the sidebar's nav list below md. */}
      <div
        className="flex flex-shrink-0 border-t pb-[env(safe-area-inset-bottom)] md:hidden"
        style={{ background: T.sidebar, borderColor: T.border }}
      >
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold"
            style={({ isActive }) => ({ color: isActive ? T.text : T.dim })}
          >
            {({ isActive }) => (
              <>
                <div className="h-1.5 w-1.5 rounded-sm" style={{ background: isActive ? T.accentBright : T.navInactiveDot }} />
                {item.shortLabel}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </div>
  );
}
