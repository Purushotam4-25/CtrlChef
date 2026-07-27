import { useEffect, useRef } from "react";
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

const BUTTON_HOVER_CLASS = {
  primary: "hover:brightness-110",
  secondary: "hover:brightness-125",
  ghost: "hover:opacity-70",
};

export function Button({ variant = "primary", className = "", style, ...rest }) {
  const { T } = useOpsTheme();
  const variants = {
    primary: { background: T.accent, color: "#fff" },
    secondary: { background: T.panel2, color: T.header, border: `1px solid ${T.borderAlt}` },
    ghost: { background: "none", color: T.faint },
  };
  return (
    <button
      className={`rounded-md px-3 py-2 text-[13px] font-semibold cursor-pointer font-sans transition-[filter,opacity] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100 disabled:hover:opacity-50 ${BUTTON_HOVER_CLASS[variant]} ${className}`}
      style={{ ...variants[variant], ...style }}
      {...rest}
    />
  );
}

const TOAST_ACCENT = { success: "#16a34a", warn: "#f59e0b" };

export function Toast({ kind = "info", title, body, onDismiss }) {
  const { T } = useOpsTheme();
  return (
    <div
      onClick={onDismiss}
      className="w-[calc(100vw-2rem)] max-w-[300px] cursor-pointer rounded-lg border border-l-4 p-3 shadow-lg transition-opacity hover:opacity-90"
      style={{ background: T.panel, borderColor: T.borderAlt, borderLeftColor: TOAST_ACCENT[kind] || T.accent }}
    >
      <div className="text-[13px] font-bold" style={{ color: T.bright }}>
        {title}
      </div>
      {body && (
        <div className="mt-0.5 text-[12px]" style={{ color: T.dim }}>
          {body}
        </div>
      )}
    </div>
  );
}

// Native <dialog> gets a focus trap, Escape-to-close, and the implicit
// role="dialog"/aria-modal semantics for free once shown via showModal() —
// none of which the old hand-rolled fixed-overlay div had. `open` is never
// passed as a DOM attribute; it's applied imperatively via ref so the
// browser actually promotes the element into the modal top layer (a plain
// `open` attribute renders it inline, non-modal, with no backdrop or focus
// trap).
export function Modal({ open, onClose, children, width = 360 }) {
  const { T } = useOpsTheme();
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      // Clicking the ::backdrop targets the <dialog> element itself (there's
      // nothing else there to hit) — the standard way to detect a
      // click-outside on a native dialog.
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      className="max-h-[85vh] max-w-[90vw] rounded-xl border-0 bg-transparent p-0 [&::backdrop]:bg-black/55"
    >
      <div
        className="max-h-[80vh] overflow-y-auto rounded-xl border p-4"
        style={{ background: T.panel, borderColor: T.borderAlt, width, maxWidth: "90vw" }}
      >
        {children}
      </div>
    </dialog>
  );
}
