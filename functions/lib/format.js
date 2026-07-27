// Duplicated (not imported) from src/lib/format.js — that file is an ESM
// frontend module, this one's CJS backend, and it's two one-line pure
// functions, not worth a shared package across the boundary. Keep them in
// sync by hand if the display format ever changes.
function fmtINR(n) {
  return "₹" + Math.round(n || 0).toLocaleString("en-IN");
}

function fmtHour(h) {
  return h === 0 ? "12AM" : h < 12 ? h + "AM" : h === 12 ? "12PM" : h - 12 + "PM";
}

module.exports = { fmtINR, fmtHour };
