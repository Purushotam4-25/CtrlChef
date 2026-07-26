import { useOpsTheme } from "../../contexts/ThemeContext";
import { STATUS_COLORS } from "../../opsTheme";

export function Panel({ className = "", style, children, ...rest }) {
  const { T } = useOpsTheme();
  return (
    <div
      className={`rounded-lg border ${className}`}
      style={{ background: T.panel, borderColor: T.border, ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}

export function StatTile({ label, value, valueColor }) {
  const { T } = useOpsTheme();
  return (
    <Panel className="px-3.5 py-2.5">
      <div className="text-[11px] font-semibold" style={{ color: T.faint }}>
        {label}
      </div>
      <div className="font-mono text-xl font-bold" style={{ color: valueColor || T.bright }}>
        {value}
      </div>
    </Panel>
  );
}

export function Badge({ kind = "gray", children }) {
  const sc = STATUS_COLORS[kind] || STATUS_COLORS.gray;
  return (
    <span
      className="inline-block rounded px-2 py-0.5 text-[10.5px] font-bold tracking-wide"
      style={{ background: sc.bg, color: sc.color }}
    >
      {children}
    </span>
  );
}

export function Button({ variant = "primary", className = "", style, ...rest }) {
  const { T } = useOpsTheme();
  const variants = {
    primary: { background: T.accent, color: "#fff" },
    secondary: { background: T.panel2, color: T.header, border: `1px solid ${T.borderAlt}` },
    ghost: { background: "none", color: T.faint },
  };
  return (
    <button
      className={`rounded-md px-3 py-2 text-[13px] font-semibold cursor-pointer font-sans disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      style={{ ...variants[variant], ...style }}
      {...rest}
    />
  );
}

export function Modal({ open, onClose, children, width = 360 }) {
  const { T } = useOpsTheme();
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] overflow-y-auto rounded-xl border p-4"
        style={{ background: T.panel, borderColor: T.borderAlt, width }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
