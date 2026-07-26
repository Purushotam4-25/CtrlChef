// Ops surface color tokens, ported straight from the design mockup. Kept as
// plain hex (applied via inline style) rather than Tailwind classes because
// the whole set swaps at runtime on a user toggle, not via prefers-color-scheme.
export const OPS_THEME = {
  dark: {
    bg: "#1a1816", sidebar: "#211e1b", panel: "#211e1b", panel2: "#2a2622", zebra: "#231f1c",
    border: "#35302b", borderAlt: "#3d3733", borderDashed: "#4a3826",
    text: "#f2ede8", bright: "#e8e2db", dim: "#a89e96", faint: "#8a8177",
    fainter: "#7a726b", faintest: "#6f675f", header: "#c7bfb6",
    accent: "#c2662f", accentBright: "#dd8548", accentSoft: "rgba(194,102,47,0.16)",
    inputBg: "#1c1917", navInactiveDot: "#4a453f",
  },
  light: {
    bg: "#F5F0E6", sidebar: "#FBF6EC", panel: "#FFFFFF", panel2: "#EFE7D8", zebra: "#F1E9DA",
    border: "#E4D9C3", borderAlt: "#D8CBAE", borderDashed: "#B7A072",
    text: "#302B27", bright: "#302B27", dim: "#6B5F52", faint: "#8A7A63",
    fainter: "#A3927A", faintest: "#B7A072", header: "#55483C",
    accent: "#A35D3A", accentBright: "#8A4A2E", accentSoft: "rgba(163,93,58,0.14)",
    inputBg: "#EFE7D8", navInactiveDot: "#B7A072",
  },
};

export const STATUS_COLORS = {
  green: { bg: "#16a34a", color: "#fff" },
  amber: { bg: "#f59e0b", color: "#1a1200" },
  red: { bg: "#ef4444", color: "#fff" },
  gray: { bg: "#57534e", color: "#fff" },
};
