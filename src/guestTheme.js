// Guest surface color tokens. Light mode matches the values already in
// tailwind.config.js's `guest.*` palette exactly — dark mode reuses the ops
// dark palette's warm/terracotta family so it reads as "same brand, dark
// version" rather than a mismatched second theme.
export const GUEST_THEME = {
  light: {
    bg: "#F5F0E6", panel: "#FBF6EC", panel2: "#EFE7D8",
    border: "#E4D9C3", borderAlt: "#D8CBAE", borderDashed: "#B7A072",
    text: "#302B27", dim: "#6B5F52",
    // Darkened to clear 4.5:1 against panel2 — same fix as opsTheme.js's
    // light.faint, see the comment there.
    faint: "#746651",
    accent: "#A35D3A", accentDark: "#8A4A2E",
    cardText: "#4a4038", pillOkBg: "rgba(94,120,98,0.15)", pillOkText: "#5E7862",
    pillOffBg: "rgba(139,123,99,0.2)", pillOffText: "#8A7A63",
  },
  dark: {
    bg: "#1a1816", panel: "#211e1b", panel2: "#2a2622",
    border: "#35302b", borderAlt: "#3d3733", borderDashed: "#4a3826",
    text: "#f2ede8", dim: "#a89e96", faint: "#8a8177",
    accent: "#c2662f", accentDark: "#dd8548",
    cardText: "#cfc7bd", pillOkBg: "rgba(94,163,120,0.18)", pillOkText: "#7fbf9a",
    pillOffBg: "rgba(255,255,255,0.08)", pillOffText: "#8a8177",
  },
};
