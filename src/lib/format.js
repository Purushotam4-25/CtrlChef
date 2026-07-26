export function fmtINR(n) {
  return "₹" + Math.round(n || 0).toLocaleString("en-IN");
}

export function fmtElapsed(ms) {
  const m = Math.max(0, Math.floor(ms / 60000));
  if (m < 60) return m + "m";
  return Math.floor(m / 60) + "h " + (m % 60) + "m";
}

export function fmtTime(date) {
  return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export function fmtHour(h) {
  return h === 0 ? "12AM" : h < 12 ? h + "AM" : h === 12 ? "12PM" : h - 12 + "PM";
}
