import { NavLink, Outlet } from "react-router-dom";

const navLinkClass = ({ isActive }) =>
  `rounded-lg px-4 py-2 text-[13.5px] font-semibold ${
    isActive ? "bg-guest-accent text-white" : "text-guest-text"
  }`;

export default function GuestLayout() {
  return (
    <div className="min-h-screen bg-guest-bg font-sans text-guest-text">
      <div className="flex items-center justify-between border-b border-guest-border px-8 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-guest-accent">
            <div className="h-4 w-3 rotate-45 rounded-[60%_60%_60%_5%] bg-white" />
          </div>
          <div>
            <div className="text-base font-bold leading-tight">Tandoor &amp; Tales</div>
            <div className="text-[10px] tracking-wide text-guest-faint">SMART RESTAURANT OS</div>
          </div>
        </div>
        <div className="flex gap-1.5">
          <NavLink to="/" end className={navLinkClass}>
            Home
          </NavLink>
          <NavLink to="/menu" className={navLinkClass}>
            Menu
          </NavLink>
          <NavLink to="/queue" className={navLinkClass}>
            Join the queue
          </NavLink>
        </div>
        <div className="flex items-center gap-2">
          <NavLink
            to="/login"
            className="rounded-lg border border-guest-border bg-guest-panel px-4 py-2 text-[13.5px] font-semibold text-guest-text"
          >
            Staff portal
          </NavLink>
          <NavLink
            to="/queue"
            className="rounded-lg bg-guest-accent px-4 py-2.5 text-[13.5px] font-bold text-white"
          >
            Reserve a table
          </NavLink>
        </div>
      </div>

      <Outlet />

      <div className="flex items-center justify-between border-t border-guest-border px-8 py-4 text-[13px] text-guest-faint">
        <div>Tandoor &amp; Tales · MG Road, Bengaluru</div>
        <div>Open daily · 12:00 – 23:30</div>
      </div>
    </div>
  );
}
