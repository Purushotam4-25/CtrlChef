import { NavLink, Outlet } from "react-router-dom";
import { Moon, Sun } from "lucide-react";
import { useGuestData } from "../contexts/GuestDataContext";
import { useGuestTheme } from "../contexts/ThemeContext";

export default function GuestLayout() {
  const { restaurant } = useGuestData();
  const { mode, setTheme, T } = useGuestTheme();
  const name = restaurant?.name || "CtrlChef";

  const navLinkStyle = ({ isActive }) => ({
    background: isActive ? T.accent : "transparent",
    color: isActive ? "#fff" : T.text,
  });

  return (
    <div className="min-h-screen font-sans" style={{ background: T.bg, color: T.text }}>
      <div
        className="flex items-center justify-between border-b px-8 py-4"
        style={{ borderColor: T.border }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
            style={{ background: T.accent }}
          >
            <div className="h-4 w-3 rotate-45 rounded-[60%_60%_60%_5%] bg-white" />
          </div>
          <div>
            <div className="text-base font-bold leading-tight">{name}</div>
            <div className="text-[10px] tracking-wide" style={{ color: T.faint }}>
              SMART RESTAURANT OS
            </div>
          </div>
        </div>
        <div className="flex gap-1.5">
          <NavLink to="/" end className="rounded-lg px-4 py-2 text-[13.5px] font-semibold transition-colors hover:opacity-80" style={navLinkStyle}>
            Home
          </NavLink>
          <NavLink to="/menu" className="rounded-lg px-4 py-2 text-[13.5px] font-semibold transition-colors hover:opacity-80" style={navLinkStyle}>
            Menu
          </NavLink>
          <NavLink to="/queue" className="rounded-lg px-4 py-2 text-[13.5px] font-semibold transition-colors hover:opacity-80" style={navLinkStyle}>
            Join the queue
          </NavLink>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTheme(mode === "dark" ? "light" : "dark")}
            title={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="flex h-9 w-9 items-center justify-center rounded-lg border transition-colors hover:opacity-80"
            style={{ borderColor: T.border, background: T.panel, color: T.text }}
          >
            {mode === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <NavLink
            to="/login"
            className="rounded-lg border px-4 py-2 text-[13.5px] font-semibold transition-colors hover:opacity-80"
            style={{ borderColor: T.border, background: T.panel, color: T.text }}
          >
            Staff portal
          </NavLink>
          <NavLink
            to="/queue"
            className="rounded-lg px-4 py-2.5 text-[13.5px] font-bold text-white transition-colors hover:opacity-90"
            style={{ background: T.accent }}
          >
            Reserve a table
          </NavLink>
        </div>
      </div>

      <Outlet />

      <div
        className="flex items-center justify-between border-t px-8 py-4 text-[13px]"
        style={{ borderColor: T.border, color: T.faint }}
      >
        <div>{[name, restaurant?.address].filter(Boolean).join(" · ")}</div>
        {restaurant?.hoursLabel && <div>{restaurant.hoursLabel}</div>}
      </div>
    </div>
  );
}
